import { DurableObject } from 'cloudflare:workers';
import type {
	PlayerConnection,
	ClientMessage,
	ServerMessage,
	MakeMovePayload,
	GameStatePayload,
	MoveResultPayload,
	GameOverPayload,
	ErrorPayload,
	GameState,
	PlayerSymbol,
	StoredMove,
} from '../types/messages';
import { createNewGame, applyMove, createMove } from '../lib/gameEngine';
import { moveToChessNotation } from '../lib/chessNotation';

export class GameSession extends DurableObject<Env> {
	private gameState: GameState | null = null;
	private players: Map<string, PlayerConnection> = new Map();
	private gameId: string = '';
	private moveRateLimit: Map<string, { count: number; resetTime: number }> = new Map();
	private moves: StoredMove[] = [];
	private playerSequenceNumbers: Map<string, number> = new Map(); // Track expected sequence numbers per player
	private allowedPlayers: Map<string, { symbol: PlayerSymbol; token: string; nickname?: string }> = new Map(); // admitted players and tokens

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	private async persist(): Promise<void> {
		await this.ctx.storage.put({ moves: this.moves, gameState: this.gameState });
	}

	private async initializeGameSession(gameId: string): Promise<void> {
		this.gameId = gameId;
		this.moves = (await this.ctx.storage.get<StoredMove[]>('moves')) ?? [];
		this.gameState = (await this.ctx.storage.get<GameState>('gameState')) ?? createNewGame(gameId);
	}

	// Security: Rate limiting for moves to prevent spam
	private checkMoveRateLimit(playerId: string, maxMoves: number = 5, windowMs: number = 10000): boolean {
		const now = Date.now();
		const limit = this.moveRateLimit.get(playerId);

		if (!limit || now > limit.resetTime) {
			this.moveRateLimit.set(playerId, { count: 1, resetTime: now + windowMs });
			return true;
		}

		if (limit.count >= maxMoves) {
			return false;
		}

		limit.count++;
		return true;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Initialization from MatchmakingQueue with allowed players/tokens
		if (request.method === 'POST' && url.pathname === '/init') {
			try {
				const bodyText = await request.text();
				if (bodyText.length > 2048) {
					return new Response('Payload too large', { status: 413 });
				}
				const body = JSON.parse(bodyText) as {
					gameId: string;
					players: Array<{ id: string; symbol: PlayerSymbol; token: string; nickname?: string }>;
				};
				if (!body || typeof body !== 'object' || !body.gameId || !Array.isArray(body.players) || body.players.length !== 2) {
					return new Response('Invalid init payload', { status: 400 });
				}

				await this.initializeGameSession(body.gameId);
				this.allowedPlayers.clear();
				for (const p of body.players) {
					if (!/^[a-zA-Z0-9\-_]+$/.test(p.id) || (p.symbol !== 'X' && p.symbol !== 'O') || typeof p.token !== 'string') {
						return new Response('Invalid player data', { status: 400 });
					}
					this.allowedPlayers.set(p.id, { symbol: p.symbol, token: p.token, nickname: p.nickname });
				}
				// Persist allowed players and game id
				await this.ctx.storage.put('allowedPlayers', Array.from(this.allowedPlayers.entries()));
				await this.persist();
				await this.updateAlarm();
				return new Response('ok');
			} catch (error) {
				console.error('Failed to initialize session from /init:', error);
			}
			return new Response('Invalid request', { status: 400 });
		}

		// Handle WebSocket upgrade
		if (request.headers.get('Upgrade') === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			// Accept the WebSocket connection
			server.accept();

			// Extract player info from query params
			const playerId = url.searchParams.get('playerId');
			const gameId = url.searchParams.get('gameId');
			const token = url.searchParams.get('token');

			// Security: Validate required parameters
			if (!playerId || !gameId || !token) {
				server.close(1008, 'Invalid connection parameters');
				return new Response(null, { status: 400 });
			}

			// Security: Validate parameter formats and sanitize
			if (typeof playerId !== 'string' || playerId.length > 100 || typeof gameId !== 'string' || gameId.length > 100) {
				server.close(1008, 'Invalid connection parameters');
				return new Response(null, { status: 400 });
			}

			// Security: Sanitize IDs - only allow alphanumeric, hyphens, underscores
			if (!/^[a-zA-Z0-9\-_]+$/.test(playerId) || !/^[a-zA-Z0-9\-_]+$/.test(gameId)) {
				server.close(1008, 'Invalid connection parameters');
				return new Response(null, { status: 400 });
			}

			// Initialize game if not exists; also load allowed players if needed
			if (!this.gameState) {
				await this.initializeGameSession(gameId);
			}
			if (this.allowedPlayers.size === 0) {
				const stored = await this.ctx.storage.get<[string, { symbol: PlayerSymbol; token: string }][]>('allowedPlayers');
				if (stored) {
					this.allowedPlayers = new Map(stored);
				}
			}

			// Enforce admission control using token
			const allowed = this.allowedPlayers.get(playerId);
			if (!allowed || allowed.token !== token) {
				server.close(1008, 'Unauthorized');
				return new Response(null, { status: 401 });
			}

			// Check if this player is reconnecting to an existing game
			const existingPlayer = this.players.get(playerId);
			let playerSymbol: PlayerSymbol = allowed.symbol;

			if (existingPlayer) {
				// Player is reconnecting - preserve their symbol and update connection
				playerSymbol = existingPlayer.symbol;
				existingPlayer.websocket = server;
				existingPlayer.connected = true;
				existingPlayer.lastPing = Date.now();
				if (this.env.ENVIRONMENT !== 'production') console.log(`Player ${playerId} reconnected with symbol ${playerSymbol}`);
			} else {
				// New player joining - symbol comes from allowed list

				// Add new player connection
				const playerConnection: PlayerConnection = {
					playerId,
					symbol: playerSymbol,
					websocket: server,
					connected: true,
					lastPing: Date.now(),
					nickname: this.allowedPlayers.get(playerId)?.nickname,
				};

				this.players.set(playerId, playerConnection);
				if (this.env.ENVIRONMENT !== 'production') console.log(`New player ${playerId} joined with symbol ${playerSymbol}`);
			}


			// Set up WebSocket message handler
			server.addEventListener('message', async (event) => {
				// NOTE: If future client messages include display names, enforce the
				// same nickname validation as frontend `src/utils/nickname.ts` before
				// storing or broadcasting. Keep ASCII letters/digits/spaces only,
				// length 3-20, and basic profanity filtering.
				await this.handleWebSocketMessage(playerId, event.data);
			});

			// Set up WebSocket close handler
			server.addEventListener('close', () => {
				this.handlePlayerDisconnect(playerId);
			});

			if (this.players.size >= 2 && this.gameState!.status === 'waiting') {
				this.gameState!.status = 'playing';
				await this.persist();
			}
			this.broadcastGameState();
			await this.updateAlarm();

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		// Handle HTTP requests for game info
		if (url.pathname === '/game-info') {
			return new Response(
				JSON.stringify({
					gameId: this.gameId,
					playerCount: this.players.size,
					status: this.gameState?.status || 'waiting',
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		return new Response('Not found', { status: 404 });
	}

	private async handleWebSocketMessage(playerId: string, message: string) {
		try {
			// Security: Limit message size to prevent memory exhaustion
			if (message.length > 1024) {
				// 1KB limit
				this.sendError(playerId, 'Message too large');
				return;
			}

			const clientMessage: ClientMessage = JSON.parse(message);
			const player = this.players.get(playerId);

			if (!player || !this.gameState) {
				this.sendError(playerId, 'Invalid request');
				return;
			}

			// Security: Validate message structure
			if (!clientMessage.type || typeof clientMessage.type !== 'string') {
				this.sendError(playerId, 'Invalid message format');
				return;
			}

			switch (clientMessage.type) {
				case 'MAKE_MOVE':
					// Security: Rate limit moves to prevent spam
					if (!this.checkMoveRateLimit(playerId)) {
						this.sendError(playerId, 'Too many requests');
						return;
					}
					await this.handleMakeMove(playerId, clientMessage.payload as MakeMovePayload);
					break;
				default:
					this.sendError(playerId, 'Invalid request');
			}
		} catch {
			this.sendError(playerId, 'Invalid message format');
		}
	}

	private async handleMakeMove(playerId: string, payload: MakeMovePayload) {
		const player = this.players.get(playerId);
		if (!player || !this.gameState) {
			this.sendError(playerId, 'Invalid request');
			return;
		}

		// Security: Validate payload structure and types
		if (!payload || typeof payload !== 'object') {
			this.sendError(playerId, 'Invalid move data');
			return;
		}

		const { boardIndex, cellIndex, sequenceNumber } = payload;

		// Validate sequence number if provided (for optimistic update validation)
		if (sequenceNumber !== undefined) {
			const expectedSequence = this.playerSequenceNumbers.get(playerId) || 0;
			if (sequenceNumber <= expectedSequence) {
				// This is a duplicate or out-of-order move
				this.sendError(playerId, 'Duplicate or out-of-order move');
				return;
			}
		}

		// Check for duplicate moves in recent history (last 10 moves)
		const recentMoves = this.moves.slice(-10);
		const isDuplicate = recentMoves.some(
			(storedMove) =>
				storedMove.boardIndex === boardIndex &&
				storedMove.cellIndex === cellIndex &&
				storedMove.player === player.symbol &&
				Date.now() - storedMove.timestamp < 5000 // Within 5 seconds
		);

		if (isDuplicate) {
			this.sendError(playerId, 'Duplicate move detected');
			return;
		}

		// Security: Strict bounds checking for board and cell indices
		if (
			!Number.isInteger(boardIndex) ||
			boardIndex < 0 ||
			boardIndex > 8 ||
			!Number.isInteger(cellIndex) ||
			cellIndex < 0 ||
			cellIndex > 8
		) {
			this.sendError(playerId, 'Invalid move position');
			return;
		}

		// Check if it's the player's turn
		if (this.gameState.currentPlayer !== player.symbol) {
			this.sendError(playerId, 'Invalid request');
			return;
		}

		// Check if game is in progress
		if (this.gameState.status !== 'playing') {
			this.sendError(playerId, 'Game not active');
			return;
		}

		// Create and apply the move with additional server-side validation
		const move = createMove(boardIndex, cellIndex, player.symbol);
		const result = applyMove(this.gameState, move);

		if (!result.valid) {
			// Security: Sanitized error message - don't expose internal game logic
			const moveResultPayload: MoveResultPayload = {
				valid: false,
				board: this.gameState.board,
				currentPlayer: this.gameState.currentPlayer,
				gameStatus: this.gameState.status,
				error: 'Invalid move',
			};

			this.sendToPlayer(playerId, {
				type: 'MOVE_RESULT',
				payload: moveResultPayload,
			});
			return;
		}

		// Update game state
		this.gameState = result.newGameState!;

		// Create and store the move
		const notation = moveToChessNotation(move);
		const storedMove: StoredMove = {
			notation,
			player: move.player,
			moveNumber: this.moves.length + 1,
			timestamp: move.timestamp,
			boardIndex: move.boardIndex,
			cellIndex: move.cellIndex,
		};

		this.moves.push(storedMove);
		await this.persist();

		// Update sequence number tracking for this player
		if (sequenceNumber !== undefined) {
			this.playerSequenceNumbers.set(playerId, sequenceNumber);
		}

		// Send successful move result to all players
		const moveResultPayload: MoveResultPayload = {
			valid: true,
			board: this.gameState.board,
			currentPlayer: this.gameState.currentPlayer,
			gameStatus: this.gameState.status,
			move: storedMove,
		};

		this.broadcast({
			type: 'MOVE_RESULT',
			payload: moveResultPayload,
		});

		// Check if game is over
		if (this.gameState.status === 'finished') {
			const gameOverPayload: GameOverPayload = {
				winner: this.gameState.winner,
				reason: this.gameState.winner === 'draw' ? 'draw' : 'win',
				finalBoard: this.gameState.board,
			};

			this.broadcast({
				type: 'GAME_OVER',
				payload: gameOverPayload,
			});

			await this.updateAlarm();
		}
	}

	private async handlePlayerDisconnect(playerId: string) {
		const player = this.players.get(playerId);
		if (!player) return;
		player.connected = false;
		this.broadcastGameState();
		await this.updateAlarm();
	}

	// Alarm policy: no alarm while a game is in progress with everyone connected.
	// Finished games are wiped after 30s. Otherwise (waiting for a player, or
	// someone dropped) the alarm fires in 60s: a lone connected player wins by
	// forfeit, an empty session is wiped.
	private async updateAlarm() {
		const allConnected = [...this.players.values()].every((p) => p.connected);
		if (this.gameState?.status === 'finished') {
			await this.ctx.storage.setAlarm(Date.now() + 30_000);
		} else if (this.gameState?.status === 'playing' && allConnected) {
			await this.ctx.storage.deleteAlarm();
		} else {
			await this.ctx.storage.setAlarm(Date.now() + 60_000);
		}
	}

	async alarm() {
		const connected = [...this.players.values()].filter((p) => p.connected);
		if (this.gameState?.status === 'playing' && connected.length === 1) {
			this.gameState.status = 'finished';
			this.gameState.winner = connected[0].symbol;
			await this.persist();
			const payload: GameOverPayload = { winner: this.gameState.winner, reason: 'forfeit', finalBoard: this.gameState.board };
			this.broadcast({ type: 'GAME_OVER', payload });
			await this.updateAlarm();
			return;
		}
		if (this.gameState?.status === 'waiting') {
			this.broadcast({ type: 'ERROR', payload: { message: 'Opponent never connected' } });
		}
		await this.destroy();
	}

	private async destroy() {
		for (const player of this.players.values()) {
			try {
				player.websocket.close(1000, 'Game closed');
			} catch {
				// already closed
			}
		}
		this.players.clear();
		this.allowedPlayers.clear();
		this.moveRateLimit.clear();
		this.playerSequenceNumbers.clear();
		this.gameState = null;
		this.moves = [];
		await this.ctx.storage.deleteAll();
	}

	private sendGameStateToPlayer(playerId: string) {
		const player = this.players.get(playerId);
		if (!player || !this.gameState) return;

		const payload: GameStatePayload = {
			gameId: this.gameState.gameId,
			yourSymbol: player.symbol,
			board: this.gameState.board,
			currentPlayer: this.gameState.currentPlayer,
			status: this.gameState.status,
			winner: this.gameState.winner,
			opponentConnected: this.getOpponentConnected(playerId),
			yourNickname: this.allowedPlayers.get(playerId)?.nickname,
			opponentNickname: this.getOpponentNickname(playerId),
			moves: this.moves,
		};

		this.sendToPlayer(playerId, {
			type: 'GAME_STATE',
			payload,
		});
	}

	private broadcastGameState() {
		this.players.forEach((_, playerId) => {
			this.sendGameStateToPlayer(playerId);
		});
	}

	private getConnectedPlayerCount(): number {
		let count = 0;
		for (const player of this.players.values()) {
			if (player.connected) {
				count++;
			}
		}
		return count;
	}

	private getOpponentConnected(playerId: string): boolean {
		for (const [id, player] of this.players) {
			if (id !== playerId) {
				return player.connected;
			}
		}
		return false;
	}

	private getOpponentNickname(playerId: string): string | undefined {
		for (const [id, player] of this.players) {
			if (id !== playerId) {
				return player.nickname ?? this.allowedPlayers.get(id)?.nickname;
			}
		}
		return undefined;
	}

	private sendToPlayer(playerId: string, message: ServerMessage) {
		const player = this.players.get(playerId);
		if (player && player.connected) {
			try {
				player.websocket.send(JSON.stringify(message));
			} catch (error) {
				console.error(`Failed to send message to player ${playerId}:`, error);
				player.connected = false;
			}
		}
	}

	private broadcast(message: ServerMessage) {
		this.players.forEach((_, playerId) => {
			this.sendToPlayer(playerId, message);
		});
	}

	private sendError(playerId: string, message: string) {
		const errorPayload: ErrorPayload = { message };
		this.sendToPlayer(playerId, {
			type: 'ERROR',
			payload: errorPayload,
		});
	}
}

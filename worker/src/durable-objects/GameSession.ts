import { DurableObject } from 'cloudflare:workers';
import type {
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
} from '../../../src/types/messages';
import { createNewGame, applyMove, createMove } from '../../../src/lib/gameEngine';
import { moveToChessNotation } from '../../../src/utils/chessNotation';

const TURN_TIMEOUT_MS = 90_000;

interface PlayerConnection {
	symbol: PlayerSymbol;
	websocket: WebSocket;
	connected: boolean;
	nickname?: string;
}

export class GameSession extends DurableObject<Env> {
	private gameState: GameState | null = null;
	private players: Map<string, PlayerConnection> = new Map();
	private moveRateLimit: Map<string, { count: number; resetTime: number }> = new Map();
	private moves: StoredMove[] = [];
	private turnDeadline = 0; // epoch ms when the current player loses on time
	private forfeitAt = 0; // epoch ms when a dropped player forfeits
	private allowedPlayers: Map<string, { symbol: PlayerSymbol; token: string; nickname?: string }> = new Map(); // admitted players and tokens
	private wins: Record<string, number> = {}; // series score by playerId
	private rematchVotes = new Set<string>();

	private async persist(): Promise<void> {
		await this.ctx.storage.put({
			moves: this.moves,
			gameState: this.gameState,
			turnDeadline: this.turnDeadline,
			wins: this.wins,
			allowedPlayers: Array.from(this.allowedPlayers.entries()),
		});
	}

	private async initializeGameSession(gameId: string): Promise<void> {
		this.moves = (await this.ctx.storage.get<StoredMove[]>('moves')) ?? [];
		this.gameState = (await this.ctx.storage.get<GameState>('gameState')) ?? createNewGame(gameId);
		this.turnDeadline = (await this.ctx.storage.get<number>('turnDeadline')) ?? 0;
		this.wins = (await this.ctx.storage.get<Record<string, number>>('wins')) ?? {};
	}

	// Security: Rate limiting for moves to prevent spam
	private checkMoveRateLimit(playerId: string, maxMoves: number = 20, windowMs: number = 10000): boolean {
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

			// Security: only allow alphanumeric, hyphens, underscores
			if (playerId.length > 100 || gameId.length > 100 || !/^[a-zA-Z0-9\-_]+$/.test(playerId) || !/^[a-zA-Z0-9\-_]+$/.test(gameId)) {
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

			if (existingPlayer) {
				// Close the replaced socket so a stale tab can't keep playing.
				try {
					existingPlayer.websocket.close(1000, 'Replaced by new connection');
				} catch {
					// already closed
				}
				existingPlayer.websocket = server;
				existingPlayer.connected = true;
				if (this.env.ENVIRONMENT !== 'production') console.log(`Player ${playerId} reconnected with symbol ${allowed.symbol}`);
			} else {
				this.players.set(playerId, { symbol: allowed.symbol, websocket: server, connected: true, nickname: allowed.nickname });
				if (this.env.ENVIRONMENT !== 'production') console.log(`New player ${playerId} joined with symbol ${allowed.symbol}`);
			}

			server.addEventListener('message', async (event) => {
				await this.handleWebSocketMessage(playerId, event.data as string);
			});

			// Set up WebSocket close handler
			// The close of a replaced socket can land after the reconnect; only the
			// current socket closing means the player is gone.
			server.addEventListener('close', () => {
				if (this.players.get(playerId)?.websocket === server) this.handlePlayerDisconnect(playerId);
			});

			// updateAlarm starts the turn clock once both players are in, so run it first
			await this.updateAlarm();
			this.broadcastGameState();

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
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
					await this.handleMakeMove(playerId, player, this.gameState, clientMessage.payload);
					break;
				case 'REMATCH':
					await this.handleRematch(playerId);
					break;
				default:
					this.sendError(playerId, 'Invalid request');
			}
		} catch {
			this.sendError(playerId, 'Invalid message format');
		}
	}

	private async handleMakeMove(playerId: string, player: PlayerConnection, gameState: GameState, payload: MakeMovePayload) {
		// Security: Validate payload structure and types
		if (!payload || typeof payload !== 'object') {
			this.sendError(playerId, 'Invalid move data');
			return;
		}

		const { boardIndex, cellIndex } = payload;

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
		if (gameState.currentPlayer !== player.symbol) {
			this.sendError(playerId, 'Invalid request');
			return;
		}

		// Check if game is in progress
		if (gameState.status !== 'playing') {
			this.sendError(playerId, 'Game not active');
			return;
		}

		// Create and apply the move with additional server-side validation
		const move = createMove(boardIndex, cellIndex, player.symbol);
		const result = applyMove(gameState, move);

		if (!result.valid) {
			// Security: Sanitized error message - don't expose internal game logic
			const moveResultPayload: MoveResultPayload = {
				valid: false,
				board: gameState.board,
				currentPlayer: gameState.currentPlayer,
				gameStatus: gameState.status,
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
		this.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
		await this.persist();

		// Send successful move result to all players
		const moveResultPayload: MoveResultPayload = {
			valid: true,
			board: this.gameState.board,
			currentPlayer: this.gameState.currentPlayer,
			gameStatus: this.gameState.status,
			move: storedMove,
			turnTimeLeftMs: this.turnTimeLeftMs(),
		};

		this.broadcast({
			type: 'MOVE_RESULT',
			payload: moveResultPayload,
		});

		// Check if game is over
		if (this.gameState.status === 'finished') {
			await this.recordWin(this.gameState.winner);
			const gameOverPayload: GameOverPayload = {
				winner: this.gameState.winner,
				reason: this.gameState.winner === 'draw' ? 'draw' : 'win',
				finalBoard: this.gameState.board,
			};

			this.broadcast({
				type: 'GAME_OVER',
				payload: gameOverPayload,
			});
			this.broadcastGameState();
		}

		// While someone is dropped, keep their 60s forfeit clock instead of restarting it
		if (this.gameState.status === 'finished' || this.allConnected()) await this.updateAlarm();
	}

	private async recordWin(winner: GameState['winner']) {
		for (const [id, p] of this.allowedPlayers) {
			if (p.symbol === winner) this.wins[id] = (this.wins[id] ?? 0) + 1;
		}
		await this.persist();
	}

	// Both players vote; the second vote starts a fresh game in the same session
	// with sides swapped so the first move alternates.
	private async handleRematch(playerId: string) {
		if (this.gameState?.status !== 'finished') return this.sendError(playerId, 'Game still in progress');
		if (!this.allConnected()) return this.sendError(playerId, 'Opponent has left');

		this.rematchVotes.add(playerId);
		if (this.rematchVotes.size === 2) {
			this.rematchVotes.clear();
			for (const [id, p] of this.allowedPlayers) {
				p.symbol = p.symbol === 'X' ? 'O' : 'X';
				const conn = this.players.get(id);
				if (conn) conn.symbol = p.symbol;
			}
			this.gameState = createNewGame(this.gameState.gameId);
			this.moves = [];
			this.turnDeadline = 0;
			await this.persist();
			await this.updateAlarm();
		}
		this.broadcastGameState();
	}

	private allConnected() {
		return this.players.size === 2 && [...this.players.values()].every((p) => p.connected);
	}

	private turnTimeLeftMs() {
		// Clock hasn't started until both players have connected once
		return this.gameState?.status === 'playing' && this.turnDeadline ? Math.max(0, this.turnDeadline - Date.now()) : undefined;
	}

	private async handlePlayerDisconnect(playerId: string) {
		const player = this.players.get(playerId);
		if (!player) return;
		player.connected = false;
		this.rematchVotes.clear();
		await this.updateAlarm(); // sets forfeitAt, which the broadcast reports
		this.broadcastGameState();
	}

	// Alarm policy: finished games are wiped after 30s, or 10min while both
	// players are still there and might rematch. A game in progress with
	// both players connected runs the turn clock: the player to move loses at
	// turnDeadline. Otherwise (waiting for a player, or someone dropped) the alarm
	// fires in 60s: a lone connected player wins by forfeit, an empty session is wiped.
	private async updateAlarm() {
		if (this.gameState?.status === 'finished') {
			await this.ctx.storage.setAlarm(Date.now() + (this.allConnected() ? 600_000 : 30_000));
		} else if (this.gameState?.status === 'playing' && this.allConnected()) {
			if (!this.turnDeadline) this.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
			await this.ctx.storage.setAlarm(this.turnDeadline);
		} else {
			this.forfeitAt = Date.now() + 60_000;
			await this.ctx.storage.setAlarm(this.forfeitAt);
		}
	}

	async alarm() {
		const connected = [...this.players.values()].filter((p) => p.connected);
		if (this.gameState?.status === 'playing' && connected.length > 0) {
			const timedOut = connected.length === 2;
			if (timedOut && Date.now() < this.turnDeadline) {
				await this.updateAlarm();
				return;
			}
			const loser = this.gameState.currentPlayer;
			this.gameState.status = 'finished';
			this.gameState.winner = timedOut ? (loser === 'X' ? 'O' : 'X') : connected[0].symbol;
			await this.recordWin(this.gameState.winner);
			const payload: GameOverPayload = {
				winner: this.gameState.winner,
				reason: timedOut ? 'timeout' : 'forfeit',
				finalBoard: this.gameState.board,
			};
			this.broadcast({ type: 'GAME_OVER', payload });
			this.broadcastGameState();
			await this.updateAlarm();
			return;
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
			turnTimeLeftMs: this.turnTimeLeftMs(),
			opponentForfeitMs:
				this.gameState.status === 'playing' && !this.getOpponentConnected(playerId) && this.forfeitAt
					? Math.max(0, this.forfeitAt - Date.now())
					: undefined,
			yourNickname: this.allowedPlayers.get(playerId)?.nickname,
			opponentNickname: this.getOpponentNickname(playerId),
			moves: this.moves,
			yourWins: this.wins[playerId] ?? 0,
			opponentWins: Object.entries(this.wins).reduce((n, [id, w]) => (id === playerId ? n : n + w), 0),
			youWantRematch: this.rematchVotes.has(playerId),
			opponentWantsRematch: [...this.rematchVotes].some((id) => id !== playerId),
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
				return player.nickname;
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

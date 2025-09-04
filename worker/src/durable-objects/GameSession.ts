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
} from '../types/messages';
import { createNewGame, applyMove, createMove } from '../lib/gameEngine';

export class GameSession extends DurableObject<Env> {
	private gameState: GameState | null = null;
	private players: Map<string, PlayerConnection> = new Map();
	private gameId: string = '';
	private moveRateLimit: Map<string, { count: number; resetTime: number }> = new Map();
	private cleanupAlarmId: string | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
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

		// Handle WebSocket upgrade
		if (request.headers.get('Upgrade') === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			// Accept the WebSocket connection
			server.accept();

			// Extract player info from query params
			const playerId = url.searchParams.get('playerId');
			const gameId = url.searchParams.get('gameId');

			// Security: Validate required parameters
			if (!playerId || !gameId) {
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

			// Initialize game if not exists
			if (!this.gameState) {
				this.gameState = createNewGame(gameId);
				this.gameId = gameId;
			}

			// Determine player symbol based on connection order
			let playerSymbol: PlayerSymbol;
			if (this.players.size === 0) {
				playerSymbol = 'X'; // First player is X
			} else if (this.players.size === 1) {
				playerSymbol = 'O'; // Second player is O
			} else {
				// Game is full (should not happen with size check, but safety)
				server.close(1008, 'Game is full');
				return new Response(null, { status: 400 });
			}

			// Add player connection
			const playerConnection: PlayerConnection = {
				playerId,
				symbol: playerSymbol,
				websocket: server,
				connected: true,
				lastPing: Date.now(),
			};

			this.players.set(playerId, playerConnection);

			// Cancel cleanup alarm since we have an active player
			this.cancelCleanupAlarm();

			// Set up WebSocket message handler
			server.addEventListener('message', (event) => {
				this.handleWebSocketMessage(playerId, event.data);
			});

			// Set up WebSocket close handler
			server.addEventListener('close', () => {
				this.handlePlayerDisconnect(playerId);
			});

			// Send initial game state to the connecting player
			this.sendGameStateToPlayer(playerId);

			// If this is the second player, start the game
			if (this.players.size >= 2) {
				this.gameState!.status = 'playing';
				this.broadcastGameState();
			}

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

	private handleWebSocketMessage(playerId: string, message: string) {
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
					this.handleMakeMove(playerId, clientMessage.payload as MakeMovePayload);
					break;
				default:
					this.sendError(playerId, 'Invalid request');
			}
		} catch (error) {
			this.sendError(playerId, 'Invalid message format');
		}
	}

	private handleMakeMove(playerId: string, payload: MakeMovePayload) {
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

		// Send successful move result to all players
		const moveResultPayload: MoveResultPayload = {
			valid: true,
			board: this.gameState.board,
			currentPlayer: this.gameState.currentPlayer,
			gameStatus: this.gameState.status,
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

			// Schedule cleanup since game is over
			this.scheduleCleanupAlarm(30000); // 30 seconds after game ends
		}
	}

	private handlePlayerDisconnect(playerId: string) {
		const player = this.players.get(playerId);
		if (player) {
			player.connected = false;

			// Notify other players about disconnection
			this.broadcastGameState();

			// Security: Set up cleanup alarm for abandoned games
			this.scheduleCleanupAlarm(120000); // 2 minutes
		}
	}

	// Security: Cleanup stale connections and games
	private cleanupStaleConnections() {
		try {
			const now = Date.now();
			const staleTimeout = 120000; // 2 minutes (reduced from 5 minutes)

			for (const [playerId, player] of this.players) {
				if (!player.connected && now - player.lastPing > staleTimeout) {
					// Close websocket if still open
					try {
						player.websocket.close(1000, 'Cleanup: Stale connection');
					} catch (error) {
						console.warn(`Failed to close websocket for player ${playerId}:`, error);
					}
					this.players.delete(playerId);
					console.log(`Removed stale player: ${playerId}`);
				}
			}

			// If no players remain, prepare for hibernation
			if (this.players.size === 0) {
				this.prepareForHibernation();
			}
		} catch (error) {
			console.error('Error during cleanup:', error);
		}
	}

	// Prepare the Durable Object for hibernation
	private prepareForHibernation() {
		try {
			console.log(`Preparing GameSession ${this.gameId} for hibernation`);

			// Clear all state
			this.gameState = null;
			this.gameId = '';
			this.moveRateLimit.clear();
			this.players.clear();

			// Cancel any pending cleanup alarms
			if (this.cleanupAlarmId) {
				this.ctx.storage.deleteAlarm();
				this.cleanupAlarmId = null;
			}

			console.log(`GameSession hibernated successfully`);
		} catch (error) {
			console.error('Error preparing for hibernation:', error);
		}
	}

	// Schedule cleanup alarm
	private scheduleCleanupAlarm(delayMs: number) {
		try {
			// Cancel existing alarm if any
			if (this.cleanupAlarmId) {
				this.ctx.storage.deleteAlarm();
			}

			const alarmTime = Date.now() + delayMs;
			this.cleanupAlarmId = `cleanup-${Date.now()}`;
			this.ctx.storage.setAlarm(alarmTime);
			console.log(`Scheduled cleanup alarm for ${new Date(alarmTime).toISOString()}`);
		} catch (error) {
			console.error('Error scheduling cleanup alarm:', error);
		}
	}

	// Cancel cleanup alarm when players are active
	private cancelCleanupAlarm() {
		try {
			if (this.cleanupAlarmId) {
				this.ctx.storage.deleteAlarm();
				this.cleanupAlarmId = null;
				console.log('Cancelled cleanup alarm - players active');
			}
		} catch (error) {
			console.error('Error cancelling cleanup alarm:', error);
		}
	}

	// Durable Object alarm handler
	alarm() {
		try {
			console.log(`Cleanup alarm triggered for GameSession ${this.gameId}`);
			this.cleanupAlarmId = null;

			// Check if we have any connected players
			const hasConnectedPlayers = Array.from(this.players.values()).some((player) => player.connected);

			if (!hasConnectedPlayers) {
				console.log('No connected players found, initiating cleanup');
				this.cleanupStaleConnections();
			} else {
				console.log('Connected players found, rescheduling cleanup alarm');
				this.scheduleCleanupAlarm(120000); // Reschedule for 2 minutes
			}
		} catch (error) {
			console.error('Error in alarm handler:', error);
		}
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
			opponentConnected: this.getOpponentConnected(playerId),
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

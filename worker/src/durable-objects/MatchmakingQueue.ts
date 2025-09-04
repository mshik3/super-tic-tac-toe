import { DurableObject } from 'cloudflare:workers';
import type { QueueEntry, QueueStatusPayload, OpponentFoundPayload, ServerMessage } from '../types/messages';

export class MatchmakingQueue extends DurableObject<Env> {
	private queue: QueueEntry[] = [];
	private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	// Security: Rate limiting helper
	private checkRateLimit(ip: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
		const now = Date.now();
		const limit = this.rateLimitMap.get(ip);

		if (!limit || now > limit.resetTime) {
			// Reset or create new limit window
			this.rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
			return true;
		}

		if (limit.count >= maxRequests) {
			return false; // Rate limit exceeded
		}

		limit.count++;
		return true;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Security: Rate limiting based on IP address
		const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

		if (!this.checkRateLimit(clientIP)) {
			return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (request.method === 'POST' && url.pathname === '/join') {
			return this.handleJoinQueue(request);
		}

		if (request.method === 'POST' && url.pathname === '/leave') {
			return this.handleLeaveQueue(request);
		}

		if (request.method === 'GET' && url.pathname === '/status') {
			return this.handleGetStatus();
		}

		return new Response('Not found', { status: 404 });
	}

	private async handleJoinQueue(request: Request): Promise<Response> {
		try {
			const body = await request.text();

			// Security: Limit request body size
			if (body.length > 1024) {
				// 1KB limit
				return new Response(JSON.stringify({ error: 'Request too large' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const { playerId } = JSON.parse(body) as { playerId: string };

			// Security: Validate playerId format and sanitize
			if (!playerId || typeof playerId !== 'string' || playerId.length > 100) {
				return new Response(JSON.stringify({ error: 'Invalid request' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Security: Sanitize playerId - only allow alphanumeric, hyphens, underscores
			if (!/^[a-zA-Z0-9\-_]+$/.test(playerId)) {
				return new Response(JSON.stringify({ error: 'Invalid request' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Check if player has already been matched
			const matchInfo = this.matchedPlayers.get(playerId);
			if (matchInfo) {
				// Remove from matched players (they're claiming their match)
				this.matchedPlayers.delete(playerId);
				return new Response(
					JSON.stringify({
						matched: true,
						gameId: matchInfo.gameId,
						yourSymbol: matchInfo.symbol,
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Check if player is already in queue
			const existingIndex = this.queue.findIndex((entry) => entry.playerId === playerId);
			if (existingIndex !== -1) {
				// Return current position
				return new Response(
					JSON.stringify({
						matched: false,
						position: existingIndex + 1,
						estimatedWaitTime: this.calculateWaitTime(existingIndex),
						playersInQueue: this.queue.length,
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Add player to queue
			const queueEntry: QueueEntry = {
				playerId,
				joinedAt: Date.now(),
			};

			this.queue.push(queueEntry);

			// Try to match immediately if we have 2+ players
			const matchResult = await this.tryMatch(playerId);

			if (matchResult) {
				// Players were matched, return game info for the requesting player
				return new Response(
					JSON.stringify({
						matched: true,
						gameId: matchResult.gameId,
						yourSymbol: matchResult.yourSymbol,
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// No match yet, return queue position
			const position = this.queue.findIndex((entry) => entry.playerId === playerId) + 1;
			return new Response(
				JSON.stringify({
					matched: false,
					position,
					estimatedWaitTime: this.calculateWaitTime(position - 1),
					playersInQueue: this.queue.length,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Invalid request' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	private async handleLeaveQueue(request: Request): Promise<Response> {
		try {
			const body = await request.text();

			// Security: Limit request body size
			if (body.length > 1024) {
				// 1KB limit
				return new Response(JSON.stringify({ error: 'Request too large' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			const { playerId } = JSON.parse(body) as { playerId: string };

			// Security: Validate playerId format and sanitize
			if (!playerId || typeof playerId !== 'string' || playerId.length > 100) {
				return new Response(JSON.stringify({ error: 'Invalid request' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Security: Sanitize playerId - only allow alphanumeric, hyphens, underscores
			if (!/^[a-zA-Z0-9\-_]+$/.test(playerId)) {
				return new Response(JSON.stringify({ error: 'Invalid request' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Remove player from queue
			const initialLength = this.queue.length;
			this.queue = this.queue.filter((entry) => entry.playerId !== playerId);

			const removed = this.queue.length < initialLength;

			return new Response(
				JSON.stringify({
					success: removed,
					playersInQueue: this.queue.length,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Invalid request' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	private handleGetStatus(): Response {
		return new Response(
			JSON.stringify({
				playersInQueue: this.queue.length,
				averageWaitTime: this.calculateAverageWaitTime(),
			}),
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// Store matched players temporarily
	private matchedPlayers: Map<string, { gameId: string; symbol: 'X' | 'O' }> = new Map();

	private async tryMatch(requestingPlayerId: string): Promise<{ gameId: string; yourSymbol: string } | null> {
		if (this.queue.length < 2) {
			return null;
		}

		// Take first two players from queue (FIFO)
		const player1 = this.queue.shift()!;
		const player2 = this.queue.shift()!;

		// Generate cryptographically secure unique game ID
		const gameId = `game-${crypto.randomUUID()}`;

		// Create game session
		try {
			await this.createGameSession(gameId, player1.playerId, player2.playerId);

			// Store match info for both players
			this.matchedPlayers.set(player1.playerId, { gameId, symbol: 'X' });
			this.matchedPlayers.set(player2.playerId, { gameId, symbol: 'O' });

			// Return match info for the requesting player
			const requestingPlayerSymbol = requestingPlayerId === player1.playerId ? 'X' : 'O';
			return {
				gameId,
				yourSymbol: requestingPlayerSymbol,
			};
		} catch (error) {
			// If game creation fails, put players back in queue
			this.queue.unshift(player2, player1);
			throw error;
		}
	}

	private async createGameSession(gameId: string, player1Id: string, player2Id: string) {
		// Get a reference to the GameSession Durable Object
		const gameSessionId = this.env.GAME_SESSION.idFromName(gameId);
		const gameSessionStub = this.env.GAME_SESSION.get(gameSessionId);

		// Initialize the game session by making a request to it
		// This ensures the Durable Object is created and ready for WebSocket connections
		try {
			await gameSessionStub.fetch(new Request(`http://localhost/game-info?gameId=${gameId}`));
			console.log(`Created game session ${gameId} for players ${player1Id} and ${player2Id}`);
		} catch (error) {
			console.error(`Failed to create game session ${gameId}:`, error);
			throw error;
		}
	}

	private calculateWaitTime(position: number): number {
		// Simple estimation: assume 10 seconds per position ahead
		// In a real app, you'd use historical data
		return Math.max(0, position * 10);
	}

	private calculateAverageWaitTime(): number {
		if (this.queue.length === 0) return 0;

		const now = Date.now();
		const totalWaitTime = this.queue.reduce((sum, entry) => {
			return sum + (now - entry.joinedAt);
		}, 0);

		return Math.round(totalWaitTime / this.queue.length / 1000); // Convert to seconds
	}

	// Cleanup method to remove stale entries (called periodically)
	private cleanupStaleEntries() {
		const now = Date.now();
		const maxWaitTime = 5 * 60 * 1000; // 5 minutes

		this.queue = this.queue.filter((entry) => {
			return now - entry.joinedAt < maxWaitTime;
		});
	}
}

import { DurableObject } from 'cloudflare:workers';
import type { QueueEntry } from '../types/messages';

export class MatchmakingQueue extends DurableObject<Env> {
	private queue: QueueEntry[] = [];
	private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
	private cleanupAlarmId: string | null = null;
	private lastActivity: number = Date.now();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// Schedule initial cleanup alarm
		this.scheduleCleanupAlarm(300000); // 5 minutes
	}

	// Security: Rate limiting helper
	private checkRateLimit(ip: string, maxRequests: number = 30, windowMs: number = 60000): boolean {
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
		this.updateActivity();
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

			const { playerId, nickname } = JSON.parse(body) as { playerId: string; nickname?: string };

			// Minimal nickname validation (ASCII letters/digits/spaces, 3-20, basic profanity)
			let sanitizedNickname: string | undefined = undefined;
			if (typeof nickname === 'string') {
				const trimmed = nickname.trim();
				if (trimmed.length > 0) {
					// Only allow ASCII letters, digits, and spaces
					if (!/^[A-Za-z0-9 ]+$/.test(trimmed)) {
						return new Response(JSON.stringify({ error: 'Invalid request' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						});
					}
					if (trimmed.length < 3 || trimmed.length > 20) {
						return new Response(JSON.stringify({ error: 'Invalid request' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						});
					}
					// Basic profanity blocklist
					const blocked = ['fuck', 'shit', 'bitch', 'asshole', 'dick', 'cunt', 'pussy', 'slut', 'whore', 'porn', 'xxx'];
					const normalized = trimmed.toLowerCase().replace(/\s+/g, '');
					if (blocked.some((w) => normalized.includes(w))) {
						return new Response(JSON.stringify({ error: 'Invalid request' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' },
						});
					}
					sanitizedNickname = trimmed;
				}
			}

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
						connectToken: matchInfo.token,
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
				nickname: sanitizedNickname,
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
						connectToken: matchResult.connectToken,
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
			console.error('Error in handleJoinQueue:', error);
			return new Response(JSON.stringify({ error: 'Invalid request' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	private async handleLeaveQueue(request: Request): Promise<Response> {
		this.updateActivity();
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
			console.error('Error in handleLeaveQueue:', error);
			return new Response(JSON.stringify({ error: 'Invalid request' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	private handleGetStatus(): Response {
		this.updateActivity();
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

	// Store matched players temporarily with timestamps
	private matchedPlayers: Map<string, { gameId: string; symbol: 'X' | 'O'; token: string; matchedAt: number }> = new Map();

	private async tryMatch(requestingPlayerId: string): Promise<{ gameId: string; yourSymbol: string; connectToken: string } | null> {
		if (this.queue.length < 2) {
			return null;
		}

		// Take first two players from queue (FIFO)
		const player1 = this.queue.shift()!;
		const player2 = this.queue.shift()!;

		// Generate cryptographically secure unique game ID
		const gameId = `game-${crypto.randomUUID()}`;

		// Generate per-player one-time connect tokens
		const tokenPlayer1 = crypto.randomUUID();
		const tokenPlayer2 = crypto.randomUUID();

		// Create game session
		try {
			await this.createGameSession(
				gameId,
				{
					playerId: player1.playerId,
					symbol: 'X',
					token: tokenPlayer1,
					nickname: player1.nickname,
				},
				{
					playerId: player2.playerId,
					symbol: 'O',
					token: tokenPlayer2,
					nickname: player2.nickname,
				}
			);

			// Store match info for both players with timestamps
			const matchedAt = Date.now();
			this.matchedPlayers.set(player1.playerId, { gameId, symbol: 'X', token: tokenPlayer1, matchedAt });
			this.matchedPlayers.set(player2.playerId, { gameId, symbol: 'O', token: tokenPlayer2, matchedAt });

			// Return match info for the requesting player
			const requestingPlayerSymbol = requestingPlayerId === player1.playerId ? 'X' : 'O';
			const connectToken = requestingPlayerId === player1.playerId ? tokenPlayer1 : tokenPlayer2;
			return {
				gameId,
				yourSymbol: requestingPlayerSymbol,
				connectToken,
			};
		} catch (error) {
			// If game creation fails, put players back in queue
			this.queue.unshift(player2, player1);
			throw error;
		}
	}

	private async createGameSession(
		gameId: string,
		player1: { playerId: string; symbol: 'X' | 'O'; token: string },
		player2: { playerId: string; symbol: 'X' | 'O'; token: string }
	) {
		// Get a reference to the GameSession Durable Object
		const gameSessionId = this.env.GAME_SESSION.idFromName(gameId);
		const gameSessionStub = this.env.GAME_SESSION.get(gameSessionId);

		// Initialize the game session by making a request to it
		// This ensures the Durable Object is created and ready for WebSocket connections
		try {
			// Initialize the game with allowed players and tokens
			await gameSessionStub.fetch(
				new Request(`http://localhost/init`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						gameId,
						players: [
							{ id: player1.playerId, symbol: player1.symbol, token: player1.token },
							{ id: player2.playerId, symbol: player2.symbol, token: player2.token },
						],
					}),
				})
			);
			console.log(`Created game session ${gameId} for players ${player1.playerId} and ${player2.playerId}`);
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

	// Enhanced cleanup method to remove stale entries
	private cleanupStaleEntries() {
		try {
			const now = Date.now();
			const maxWaitTime = 5 * 60 * 1000; // 5 minutes
			const matchedPlayerTimeout = 30 * 60 * 1000; // 30 minutes for matched players (increased reliability)
			const rateLimitTimeout = 60 * 1000; // 1 minute for rate limits

			// Clean stale queue entries
			const initialQueueSize = this.queue.length;
			this.queue = this.queue.filter((entry) => {
				return now - entry.joinedAt < maxWaitTime;
			});
			const removedQueueEntries = initialQueueSize - this.queue.length;

			// Clean stale matched players
			const initialMatchedSize = this.matchedPlayers.size;
			for (const [playerId, matchInfo] of this.matchedPlayers.entries()) {
				if (now - matchInfo.matchedAt > matchedPlayerTimeout) {
					this.matchedPlayers.delete(playerId);
				}
			}
			const removedMatchedPlayers = initialMatchedSize - this.matchedPlayers.size;

			// Clean stale rate limit entries
			const initialRateLimitSize = this.rateLimitMap.size;
			for (const [ip, limitInfo] of this.rateLimitMap.entries()) {
				if (now > limitInfo.resetTime + rateLimitTimeout) {
					this.rateLimitMap.delete(ip);
				}
			}
			const removedRateLimits = initialRateLimitSize - this.rateLimitMap.size;

			if (removedQueueEntries > 0 || removedMatchedPlayers > 0 || removedRateLimits > 0) {
				console.log(
					`MatchmakingQueue cleanup: removed ${removedQueueEntries} queue entries, ${removedMatchedPlayers} matched players, ${removedRateLimits} rate limits`
				);
			}

			// Check if we should prepare for hibernation
			if (this.shouldHibernate()) {
				this.prepareForHibernation();
			} else {
				// Schedule next cleanup
				this.scheduleCleanupAlarm(300000); // 5 minutes
			}
		} catch (error) {
			console.error('Error during MatchmakingQueue cleanup:', error);
		}
	}

	// Check if the queue should hibernate
	private shouldHibernate(): boolean {
		const now = Date.now();
		const hibernationTimeout = 30 * 60 * 1000; // 30 minutes of inactivity

		return this.queue.length === 0 && this.matchedPlayers.size === 0 && now - this.lastActivity > hibernationTimeout;
	}

	// Prepare for hibernation
	private prepareForHibernation() {
		try {
			console.log('Preparing MatchmakingQueue for hibernation');

			// Clear all data
			this.queue = [];
			this.rateLimitMap.clear();
			this.matchedPlayers.clear();

			// Cancel cleanup alarm
			if (this.cleanupAlarmId) {
				this.ctx.storage.deleteAlarm();
				this.cleanupAlarmId = null;
			}

			console.log('MatchmakingQueue hibernated successfully');
		} catch (error) {
			console.error('Error preparing MatchmakingQueue for hibernation:', error);
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
			if (this.env.ENVIRONMENT !== 'production')
				console.log(`MatchmakingQueue: Scheduled cleanup alarm for ${new Date(alarmTime).toISOString()}`);
		} catch (error) {
			console.error('Error scheduling MatchmakingQueue cleanup alarm:', error);
		}
	}

	// Update last activity timestamp
	private updateActivity() {
		this.lastActivity = Date.now();
	}

	// Durable Object alarm handler
	alarm() {
		try {
			if (this.env.ENVIRONMENT !== 'production') console.log('MatchmakingQueue cleanup alarm triggered');
			this.cleanupAlarmId = null;
			this.cleanupStaleEntries();
		} catch (error) {
			console.error('Error in MatchmakingQueue alarm handler:', error);
		}
	}
}

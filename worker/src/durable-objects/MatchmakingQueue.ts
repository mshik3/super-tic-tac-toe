import { DurableObject } from 'cloudflare:workers';
import type { PlayerSymbol } from '../../../src/types/messages';

interface QueueEntry {
	playerId: string;
	lastSeen: number; // last poll; clients poll every ~2s while searching
	nickname?: string;
}

interface MatchInfo {
	gameId: string;
	symbol: PlayerSymbol;
	token: string;
	matchedAt: number;
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const invalid = () => json({ error: 'Invalid request' }, 400);

const isValidPlayerId = (id: unknown): id is string => typeof id === 'string' && id.length <= 100 && /^[a-zA-Z0-9\-_]+$/.test(id);

const BLOCKED_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'dick', 'cunt', 'pussy', 'slut', 'whore', 'porn', 'xxx'];

// Ascii letters/digits/spaces, 3-20 chars, basic profanity. undefined = no nickname given, null = rejected.
function sanitizeNickname(nickname: unknown): string | undefined | null {
	if (typeof nickname !== 'string' || !nickname.trim()) return undefined;
	const trimmed = nickname.trim();
	if (!/^[A-Za-z0-9 ]{3,20}$/.test(trimmed)) return null;
	const normalized = trimmed.toLowerCase().replace(/\s+/g, '');
	return BLOCKED_WORDS.some((w) => normalized.includes(w)) ? null : trimmed;
}

export class MatchmakingQueue extends DurableObject<Env> {
	private queue: QueueEntry[] = [];
	private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
	private matchedPlayers: Map<string, MatchInfo> = new Map();

	private checkRateLimit(ip: string, maxRequests = 60, windowMs = 60000): boolean {
		const now = Date.now();
		for (const [key, limit] of this.rateLimitMap) if (now > limit.resetTime) this.rateLimitMap.delete(key);

		const limit = this.rateLimitMap.get(ip);
		if (!limit) {
			this.rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
			return true;
		}
		if (limit.count >= maxRequests) return false;
		limit.count++;
		return true;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

		if (!this.checkRateLimit(clientIP)) return json({ error: 'Rate limit exceeded' }, 429);
		if (request.method !== 'POST' || (url.pathname !== '/join' && url.pathname !== '/leave')) {
			return new Response('Not found', { status: 404 });
		}

		try {
			const body = await request.text();
			if (body.length > 1024) return json({ error: 'Request too large' }, 400);
			const { playerId, nickname } = JSON.parse(body) as { playerId: unknown; nickname?: unknown };
			if (!isValidPlayerId(playerId)) return invalid();

			if (url.pathname === '/leave') {
				const initialLength = this.queue.length;
				this.queue = this.queue.filter((entry) => entry.playerId !== playerId);
				return json({ success: this.queue.length < initialLength, playersInQueue: this.queue.length });
			}

			const sanitizedNickname = sanitizeNickname(nickname);
			if (sanitizedNickname === null) return invalid();
			return await this.handleJoin(playerId, sanitizedNickname);
		} catch (error) {
			console.error('Error in MatchmakingQueue:', error);
			return invalid();
		}
	}

	private async handleJoin(playerId: string, nickname: string | undefined): Promise<Response> {
		const matchInfo = this.matchedPlayers.get(playerId);
		if (matchInfo) {
			this.matchedPlayers.delete(playerId);
			return json({ matched: true, gameId: matchInfo.gameId, yourSymbol: matchInfo.symbol, connectToken: matchInfo.token });
		}

		let index = this.queue.findIndex((entry) => entry.playerId === playerId);
		if (index !== -1) {
			this.queue[index].lastSeen = Date.now();
		} else {
			this.queue.push({ playerId, lastSeen: Date.now(), nickname });
			const match = await this.tryMatch(playerId);
			if (match) return json({ matched: true, ...match });
			index = this.queue.findIndex((entry) => entry.playerId === playerId);
		}

		return json({ matched: false, position: index + 1, playersInQueue: this.queue.length });
	}

	private async tryMatch(requestingPlayerId: string): Promise<{ gameId: string; yourSymbol: PlayerSymbol; connectToken: string } | null> {
		const now = Date.now();
		// A closed or refreshed tab never calls /leave; don't pair anyone with its ghost
		this.queue = this.queue.filter((entry) => entry.lastSeen > now - 20_000);
		for (const [id, info] of this.matchedPlayers) if (now - info.matchedAt > 30 * 60_000) this.matchedPlayers.delete(id);

		if (this.queue.length < 2) return null;

		const player1 = this.queue.shift()!;
		const player2 = this.queue.shift()!;
		const gameId = `game-${crypto.randomUUID()}`;
		const players = [
			{ entry: player1, info: { gameId, symbol: 'X' as const, token: crypto.randomUUID(), matchedAt: now } },
			{ entry: player2, info: { gameId, symbol: 'O' as const, token: crypto.randomUUID(), matchedAt: now } },
		];

		// Park both players, so a repeated join (e.g. the client dropped this response)
		// still finds the match; clients use a fresh playerId per search, so a parked
		// entry never leaks into a later search. Park before awaiting: other requests
		// interleave during the session fetch, and a poll that finds neither queue nor
		// match entry would re-queue that player into a second game.
		for (const { entry, info } of players) this.matchedPlayers.set(entry.playerId, info);

		try {
			const stub = this.env.GAME_SESSION.get(this.env.GAME_SESSION.idFromName(gameId));
			await stub.fetch('http://localhost/init', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					gameId,
					players: players.map(({ entry, info }) => ({ id: entry.playerId, symbol: info.symbol, token: info.token, nickname: entry.nickname })),
				}),
			});
		} catch (error) {
			for (const { entry } of players) this.matchedPlayers.delete(entry.playerId);
			this.queue.unshift(player1, player2);
			throw error;
		}

		const mine = players.find(({ entry }) => entry.playerId === requestingPlayerId)!.info;
		return { gameId, yourSymbol: mine.symbol, connectToken: mine.token };
	}
}

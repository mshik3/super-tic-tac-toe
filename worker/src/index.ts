// Export Durable Object classes
export { GameSession } from './durable-objects/GameSession';
export { MatchmakingQueue } from './durable-objects/MatchmakingQueue';

export default {
	/**
	 * Main Worker fetch handler - routes requests to appropriate Durable Objects
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		// Security: Environment-specific CORS origins from environment variables
		const allowedOriginsStr = env.ALLOWED_ORIGINS || 'https://super-tic-tac-toe.pages.dev';
		const allowedOrigins = allowedOriginsStr.split(',').map((o: string) => o.trim());

		const origin = request.headers.get('Origin');
		const isDev = env.ENVIRONMENT !== 'production';

		// Safer origin check: exact match or subdomain match when pattern like https://*.pages.dev
		const originAllowed = (incoming: string | null): string | null => {
			if (!incoming) return null;
			try {
				const incomingUrl = new URL(incoming);
				for (const allowed of allowedOrigins) {
					if (!allowed) continue;
					if (allowed.includes('*')) {
						const allowedUrl = new URL(allowed.replace('*.', 'subdomain.'));
						if (
							incomingUrl.protocol === allowedUrl.protocol &&
							incomingUrl.hostname.endsWith(allowedUrl.hostname.replace('subdomain.', ''))
						) {
							return incoming;
						}
					} else if (incoming === allowed) {
						return incoming;
					}
				}
				// Allow localhost in non-production environments
				if (isDev && incomingUrl.hostname === 'localhost') return incoming;
			} catch (error) {
				// Ignore malformed Origin header but continue with base security headers
				console.warn('Origin parse failed:', error);
			}
			return null;
		};

		const allowedOrigin = originAllowed(origin);

		const baseHeaders: Record<string, string> = {
			'X-Content-Type-Options': 'nosniff',
			'Referrer-Policy': 'no-referrer',
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Resource-Policy': 'cross-origin',
			Vary: 'Origin',
		};

		const corsHeaders = allowedOrigin
			? {
					...baseHeaders,
					'Access-Control-Allow-Origin': allowedOrigin,
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Access-Control-Max-Age': '86400',
			  }
			: baseHeaders;

		// Handle preflight requests
		if (request.method === 'OPTIONS') {
			if (!allowedOrigin) return new Response(null, { status: 403, headers: baseHeaders });
			return new Response(null, { headers: corsHeaders });
		}

		// Route to matchmaking queue
		if (url.pathname.startsWith('/queue')) {
			const queueId = env.MATCHMAKING_QUEUE.idFromName('global-queue');
			const queueStub = env.MATCHMAKING_QUEUE.get(queueId);

			// Forward the request to the queue, stripping /queue prefix
			const newUrl = new URL(request.url);
			newUrl.pathname = url.pathname.replace('/queue', '');

			const newRequest = new Request(newUrl, request);
			const response = await queueStub.fetch(newRequest);

			// Add security and CORS headers to response
			const newResponse = new Response(response.body, response);
			Object.entries(corsHeaders).forEach(([key, value]) => {
				newResponse.headers.set(key, value);
			});

			return newResponse;
		}

		// Route to game sessions
		if (url.pathname.startsWith('/game')) {
			const gameId = url.searchParams.get('gameId');

			if (!gameId) {
				return new Response(JSON.stringify({ error: 'Missing gameId parameter' }), {
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			const sessionId = env.GAME_SESSION.idFromName(gameId);
			const sessionStub = env.GAME_SESSION.get(sessionId);

			// Forward the request to the game session
			const response = await sessionStub.fetch(request);

			// Add headers if not a WebSocket upgrade
			if (!response.headers.get('Upgrade')) {
				const newResponse = new Response(response.body, response);
				Object.entries(corsHeaders).forEach(([key, value]) => {
					newResponse.headers.set(key, value);
				});
				return newResponse;
			}

			return response;
		}

		// Health check endpoint
		if (url.pathname === '/health') {
			return new Response(
				JSON.stringify({
					status: 'healthy',
					timestamp: Date.now(),
					version: '1.0.0',
				}),
				{
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}

		// Default response
		return new Response(
			JSON.stringify({
				error: 'Not found',
				availableEndpoints: ['/queue', '/game', '/health'],
			}),
			{
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	},
} satisfies ExportedHandler<Env>;

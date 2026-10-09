// Export Durable Object classes
export { GameSession } from './durable-objects/GameSession';
export { MatchmakingQueue } from './durable-objects/MatchmakingQueue';

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		const origin = request.headers.get('Origin');
		const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim());
		const isDevLocalhost = env.ENVIRONMENT !== 'production' && URL.parse(origin ?? '')?.hostname === 'localhost';
		const allowedOrigin = origin && (allowedOrigins.includes(origin) || isDevLocalhost) ? origin : null;

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
			JSON.stringify({ error: 'Not found' }),
			{
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	},
} satisfies ExportedHandler<Env>;

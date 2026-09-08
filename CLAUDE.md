# Super Tic-Tac-Toe — Online multiplayer super tic-tac-toe with local and online modes.

## Commands
```bash
# Frontend
npm run dev              # Vite dev server (localhost:5173)
npm test                 # Vitest
npm run build            # production build to dist/

# Worker
cd worker
npm run dev              # wrangler dev (local)
npm run deploy           # deploy to Cloudflare
```

## Architecture
- Frontend: React + Vite + TypeScript + Tailwind + Zustand
- Backend: Cloudflare Worker with Durable Objects
  - `MatchmakingQueue` DO — global singleton FIFO, issues one-time connect tokens
  - `GameSession` DO — one per game, owns WebSocket connections, validates moves server-side
- Deployed: Worker `super-tic-tac-toe-worker.mshik3.workers.dev`, Pages `super-tic-tac-toe-76l.pages.dev`

## Environment
- Frontend: `VITE_WORKER_URL` (defaults to hardcoded prod URL in vite.config.ts)
- Worker: `ALLOWED_ORIGINS` (CORS), `ENVIRONMENT` ("production" suppresses verbose logging)

## Key Decisions
- Durable Objects over database — <5ms latency, geographic co-location of players
- HTTP polling for matchmaking (stateless), WebSocket for gameplay (stateful)
- Game engine duplicated in `src/lib/` and `worker/src/lib/` (shared package adds build complexity)

## Known Limitations
- No rematch flow — players must find new match after game ends
- No disconnect countdown UI — worker waits 10min before cleanup (intentionally lenient for MVP)
- Nickname not persisted — refreshing resets it

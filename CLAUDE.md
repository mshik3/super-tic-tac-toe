# Super Tic-Tac-Toe — Online multiplayer super tic-tac-toe with local and online modes.

## Commands
```bash
# Frontend
npm run dev              # Vite dev server (localhost:5173)
npm test                 # Vitest
npm run build            # production build to dist/
npm run deploy:pages     # manual Pages upload; normally push to main and Pages builds it

# Worker
cd worker
npm run dev              # wrangler dev (local)
npm run smoke            # ~3 min multiplayer regression check; needs `npm run dev` running
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
- Worker imports the game engine and protocol types straight from `src/` by relative path (wrangler bundles them); no shared package

## Known Limitations
- Disconnect banner says 60s but shows no live countdown (the turn clock is live)

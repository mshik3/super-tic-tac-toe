---
paths:
  - "src/**/*.{ts,tsx}"
  - "worker/**/*.ts"
---

# Game Architecture

## Matchmaking Flow
1. Player enters nickname, clicks "Play Online"
2. `MatchmakingScreen` calls `POST /queue/join` with `{ playerId, nickname }`
3. Polls every ~1s until `matched: true` (circuit breaker after 5 failures)
4. `connectToGame` opens WebSocket to `/game?gameId=&playerId=&token=`
5. `GameSession` DO validates one-time token, sends `GAME_STATE`

## WebSocket Messages
- Server → Client: `GAME_STATE`, `MOVE_RESULT`, `GAME_OVER`, `ERROR`
- Client → Server: `MAKE_MOVE` `{ boardIndex, cellIndex, sequenceNumber? }`

## State Management (store/gameStore.ts)
- Single Zustand store — both local and online game state
- Optimistic updates: moves applied locally, sent to server, rolled back if rejected
- `pendingMoves` tracks in-flight moves
- Named selector hooks (e.g. `useGameState`, `usePlayerSymbol`)
- `devtools` middleware in dev builds only, `storeImpl` shared — `any` type for set/get is intentional (documented in store)

## Security
- One-time `connectToken` per player per game (no token = 401)
- Server-authoritative move validation
- Rate limits: queue 30 req/min/IP, moves 5 per 10s per player
- Input: player IDs `^[a-zA-Z0-9\-_]+$`, nicknames ASCII 3-20 chars
- CORS: `ALLOWED_ORIGINS` env var, localhost in non-production
- Message size: WS 1KB, HTTP 1KB (queue) / 2KB (game init)

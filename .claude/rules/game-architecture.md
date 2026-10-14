---
paths:
  - "src/**/*.{ts,tsx}"
  - "worker/**/*.ts"
---

# Game Architecture

## Matchmaking Flow
1. Player enters nickname, clicks "Play Online"
2. `MatchmakingScreen` calls `POST /queue/join` with `{ playerId, nickname }`
3. Polls every ~2s until `matched: true` (circuit breaker after 5 failures)
4. `connectToGame` opens WebSocket to `/game?gameId=&playerId=&token=`
5. `GameSession` DO validates one-time token, sends `GAME_STATE`
6. Disconnect during play: 60s alarm (`forfeitAt`, sent to the opponent as `opponentForfeitMs` for the banner countdown), then remaining player wins by forfeit
7. Turn clock: 90s per move (`TURN_TIMEOUT_MS`), runs only while both are connected (a drop freezes the time left in `turnPausedMs`; reconnect resumes it); player to move loses with reason `timeout`. Server sends `turnTimeLeftMs` (remaining, not a timestamp, to dodge clock skew)
8. Refresh rejoins: client keeps `{gameId, playerId, symbol, token}` in sessionStorage (per tab on purpose); token is reusable for the game's life
9. Rematch: after a finish, both send `REMATCH`; the second vote resets the same `GameSession` with symbols swapped (first move alternates). Series score (`wins` by playerId) persists across rematches. Finished sessions live 10min while both are connected, 30s otherwise
10. Private games: "Play a Friend" posts `/queue/private`, which inits a `GameSession` with only the host (X). The link is `/?join=<gameId>`; the friend posts `/game/join?gameId=` to claim seat O (409 once full, 404 once expired). Until then `waitingForOpponent` is true, moves are refused, and the invite expires after 30min (`INVITE_TTL_MS`)
11. Bots: client-only (`src/lib/bot.ts`, run in `bot.worker.ts`), store `gameMode: "bot"`. Easy = random, medium = one-ply rules, hard/legendary = MCTS (1.5k playouts / 2s). Own flat board for speed; `bot.test.ts` checks moves stay legal against the real engine
12. Deploys restart Durable Objects and drop sockets. Clients reconnect on their own; `GameSession` reloads from storage (`restore()`), and `MatchmakingQueue` mirrors queue and parked matches to storage on every membership change (not on every poll)
13. Matchmaking: both matched players are parked in `matchedPlayers` before the `/init` fetch (requests interleave across that await), so a repeated join returns the same match. Client uses a fresh `playerId` per search so parked entries never leak into a later search. Queue entries not polled for 20s are dropped; tabs also beacon `/queue/leave` on `pagehide`

## WebSocket Messages
- Server → Client: `GAME_STATE`, `MOVE_RESULT`, `GAME_OVER`, `ERROR`
- HTTP: `POST /queue/join`, `/queue/leave`, `/queue/private`, `/game/join?gameId=`
- Client → Server: `MAKE_MOVE` `{ boardIndex, cellIndex }` (replays are rejected by the turn check), `REMATCH`

## State Management (store/gameStore.ts)
- Single Zustand store — both local and online game state
- Optimistic updates: moves applied locally, sent to server, rolled back if rejected
- `pendingMoves` tracks in-flight moves
- Named selector hooks (e.g. `useGameState`, `usePlayerSymbol`)
- `devtools` middleware in dev builds only, `storeImpl` shared — `any` type for set/get is intentional (documented in store)

## Security
- One-time `connectToken` per player per game (no token = 401)
- Server-authoritative move validation
- Rate limits: queue 60 req/min per playerId plus 1200/min per IP (shared IPs: schools, carrier NAT), moves 20 per 10s per player
- Input: player IDs `^[a-zA-Z0-9\-_]+$`, nicknames ASCII 3-20 chars
- CORS: `ALLOWED_ORIGINS` env var, localhost in non-production
- Message size: WS 1KB, HTTP 1KB (queue) / 2KB (game init)

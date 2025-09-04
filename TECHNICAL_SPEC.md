# Technical Specification - Super Tic-Tac-Toe MVP

## 🏗️ System Architecture

### Infrastructure Components

1. **Cloudflare Pages** - Static React app hosting
2. **Cloudflare Worker** - Matchmaking API and routing
3. **Queue Durable Object** - Global player queue management
4. **Game Durable Objects** - Individual game sessions with WebSocket handling

### Communication Flow

```
Player → Cloudflare Pages → Cloudflare Worker → Durable Objects → WebSocket → Player
```

## 🎮 Game Engine Specifications

### Super Tic-Tac-Toe Rules Implementation

```typescript
// Game board representation
type Cell = "X" | "O" | null;
type SubBoard = Cell[]; // 9 cells
type MainBoard = Cell[]; // 9 positions (sub-board winners)

interface GameBoard {
  main: MainBoard; // Winners of each sub-board
  sub: SubBoard[]; // 9 sub-boards, each with 9 cells
  activeBoard: number | null; // Which sub-board is active (0-8, null = any)
}
```

### Move Validation Logic

1. **Valid Move Check:**

   - Target cell must be empty
   - Must play in active sub-board (or any if null)
   - Game must be in progress

2. **Move Processing:**

   - Update cell with player symbol
   - Check sub-board win condition
   - Update main board if sub-board won
   - Calculate next active board
   - Check main board win condition
   - Switch current player

3. **Next Board Calculation:**
   - If move at position `cellIndex`, next active board = `cellIndex`
   - If target board is complete, next active board = `null` (any)

## 🔌 WebSocket Protocol

### Connection Lifecycle

1. **Connection Established**

   ```typescript
   // Server sends initial game state
   {
     type: 'GAME_STATE',
     payload: {
       gameId: string,
       yourSymbol: 'X' | 'O',
       board: GameBoard,
       currentPlayer: 'X' | 'O',
       status: 'waiting' | 'playing'
     }
   }
   ```

2. **Move Exchange**

   ```typescript
   // Client sends move
   {
     type: 'MAKE_MOVE',
     payload: {
       boardIndex: number,  // 0-8
       cellIndex: number    // 0-8
     }
   }

   // Server responds
   {
     type: 'MOVE_RESULT',
     payload: {
       valid: boolean,
       board: GameBoard,
       currentPlayer: 'X' | 'O',
       gameStatus: 'playing' | 'finished'
     }
   }
   ```

3. **Game End**
   ```typescript
   {
     type: 'GAME_OVER',
     payload: {
       winner: 'X' | 'O' | 'draw',
       reason: 'win' | 'draw' | 'forfeit' | 'timeout',
       finalBoard: GameBoard
     }
   }
   ```

## 🎯 Matchmaking Algorithm

### Queue Management (FIFO for MVP)

```typescript
interface QueueEntry {
  playerId: string;
  joinedAt: number;
  region?: string; // Future use
}

class MatchmakingQueue {
  private queue: QueueEntry[] = [];

  addPlayer(playerId: string): number {
    // Add to end of queue
    // Return queue position
  }

  removePlayer(playerId: string): boolean {
    // Remove from queue
    // Return success status
  }

  tryMatch(): { player1: string; player2: string } | null {
    // Match first two players in queue
    // Return match or null if <2 players
  }
}
```

### Session Creation Flow

1. Two players matched from queue
2. Create new Game Durable Object
3. Generate unique game ID
4. Send WebSocket URLs to both players
5. Initialize game state
6. Wait for both WebSocket connections

## 🎨 Frontend Architecture

### Component Structure

```
App
├── Router
├── MainMenu
├── MatchmakingScreen
├── GameScreen
│   ├── PlayerInfo
│   ├── GameBoard
│   │   ├── SubBoard (×9)
│   │   └── Cell (×81 total)
│   └── GameStatus
└── GameOverScreen
```

### State Management (Zustand)

```typescript
interface GameStore {
  // Connection state
  connectionStatus: "disconnected" | "connecting" | "connected";
  gameId: string | null;
  playerId: string;

  // Game state
  gameState: GameState | null;
  playerSymbol: "X" | "O" | null;

  // UI state
  currentScreen: "menu" | "searching" | "playing" | "gameOver";
  error: string | null;

  // Actions
  findGame: () => void;
  makeMove: (boardIndex: number, cellIndex: number) => void;
  requestRematch: () => void;
  quitGame: () => void;
}
```

## 🔧 Durable Objects Implementation

### Game Session Object

```typescript
export class GameSession {
  private state: {
    gameId: string;
    players: Map<string, PlayerConnection>;
    gameState: GameState;
    createdAt: number;
  };

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrades
    // Handle HTTP game state requests
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    // Parse and handle WebSocket messages
    // Validate moves
    // Broadcast state updates
  }

  async webSocketClose(ws: WebSocket, code: number) {
    // Handle player disconnection
    // Notify remaining player
    // Set forfeit timer
  }
}
```

### Queue Management Object

```typescript
export class MatchmakingQueue {
  private queue: QueueEntry[] = [];

  async addPlayer(playerId: string): Promise<number> {
    // Add player to queue
    // Try to match with existing player
    // Return queue position or game info
  }

  async removePlayer(playerId: string): Promise<boolean> {
    // Remove player from queue
  }

  private async createGameSession(player1: string, player2: string) {
    // Create new Game Durable Object
    // Initialize game state
    // Return WebSocket URLs
  }
}
```

## 🚦 Error Handling

### Connection Errors

- **WebSocket Disconnection:** 30-second reconnection window
- **Network Timeout:** Automatic retry with exponential backoff
- **Server Error:** Graceful fallback to main menu with error message

### Game Errors

- **Invalid Move:** Client-side validation + server confirmation
- **Opponent Disconnect:** 60-second wait period, then forfeit win
- **Session Expired:** Redirect to main menu

### Matchmaking Errors

- **Queue Timeout:** 2-minute maximum wait, then retry option
- **Failed Connection:** Automatic re-queue with notification

## 📊 Performance Requirements

### Latency Targets

- **Move Response Time:** <100ms globally
- **Matchmaking Time:** <5 seconds average
- **WebSocket Connection:** <500ms establishment

### Scalability Targets

- **Concurrent Games:** 10,000+ simultaneous
- **Queue Throughput:** 1,000+ matches/minute
- **Global Distribution:** <150ms latency worldwide

### Resource Limits (Cloudflare Free Tier)

- **Workers:** 100k requests/day
- **Durable Objects:** 1M requests/month
- **WebSocket Connections:** No explicit limit
- **CPU Time:** 10ms per request

## 🔐 Security Considerations

### Move Validation

- All moves validated server-side
- Client predictions for UX only
- State authority on Durable Object

### Anti-Cheat Measures

- Server-side game logic
- Move timing validation
- Connection integrity checks

### Data Privacy

- No persistent user data
- Anonymous player IDs
- Automatic session cleanup

## 🧪 Testing Strategy

### Unit Tests

- Game logic validation
- Move calculation algorithms
- Win condition detection

### Integration Tests

- WebSocket message flow
- Matchmaking queue behavior
- Session lifecycle management

### Load Tests

- Concurrent connection handling
- Queue performance under load
- Durable Object scaling

## 📈 Monitoring & Analytics

### Key Metrics

- Active concurrent games
- Average matchmaking time
- Connection success rate
- Game completion rate
- Error rates by type

### Logging

- Game session events
- Player connection events
- Error conditions
- Performance metrics

---

**This specification provides the complete technical blueprint for implementing the Super Tic-Tac-Toe MVP.**

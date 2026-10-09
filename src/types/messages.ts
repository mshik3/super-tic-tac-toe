// Message protocol shared by the frontend and the worker
import type {
  GameBoard,
  GameStatus,
  GameWinner,
  PlayerSymbol,
} from "./game";

export type * from "./game";

export interface ClientMessage {
  type: "MAKE_MOVE";
  payload: MakeMovePayload;
}

export interface ServerMessage {
  type: "GAME_STATE" | "MOVE_RESULT" | "GAME_OVER" | "ERROR";
  payload: GameStatePayload | MoveResultPayload | GameOverPayload | ErrorPayload;
}

export interface MakeMovePayload {
  boardIndex: number;
  cellIndex: number;
}

export interface GameStatePayload {
  gameId: string;
  yourSymbol: PlayerSymbol;
  board: GameBoard;
  currentPlayer: PlayerSymbol;
  status: GameStatus;
  winner?: GameWinner;
  opponentConnected: boolean;
  turnTimeLeftMs?: number; // ms left on the current turn while playing
  yourNickname?: string;
  opponentNickname?: string;
  moves: StoredMove[];
}

export interface MoveResultPayload {
  valid: boolean;
  board: GameBoard;
  currentPlayer: PlayerSymbol;
  gameStatus: GameStatus;
  error?: string;
  move?: StoredMove; // The move that was just made
  turnTimeLeftMs?: number; // ms left on the current turn while playing
}

export interface GameOverPayload {
  winner: GameWinner;
  reason: "win" | "draw" | "forfeit" | "timeout";
  finalBoard: GameBoard;
}

export interface QueueStatusPayload {
  position: number;
  playersInQueue: number;
}

export interface StoredMove {
  notation: string;
  player: PlayerSymbol;
  moveNumber: number;
  timestamp: number;
  boardIndex: number;
  cellIndex: number;
}

export interface ErrorPayload {
  message: string;
}

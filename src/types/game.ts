// Core game types for Super Tic-Tac-Toe
export type PlayerSymbol = "X" | "O";
export type Cell = PlayerSymbol | null;

// Sub-board: 3x3 grid of cells
export type SubBoard = Cell[];

// Main board: 3x3 grid representing the winners of each sub-board
export type MainBoard = Cell[];

// Complete game board structure
export interface GameBoard {
  // Winners of each sub-board (9 positions)
  main: MainBoard;
  // 9 sub-boards, each containing 9 cells
  sub: SubBoard[];
  // Which sub-board is currently active (0-8), null means any board
  activeBoard: number | null;
}

// Game status
export type GameStatus = "waiting" | "playing" | "finished";

// Game winner
export type GameWinner = PlayerSymbol | "draw" | null;

// Complete game state
export interface GameState {
  gameId: string;
  board: GameBoard;
  currentPlayer: PlayerSymbol;
  status: GameStatus;
  winner: GameWinner;
  createdAt: number;
  lastMove: number;
}

// Player information
export interface Player {
  id: string;
  symbol: PlayerSymbol;
  connected: boolean;
}

// Move representation
export interface Move {
  boardIndex: number; // Which sub-board (0-8)
  cellIndex: number; // Which cell in the sub-board (0-8)
  player: PlayerSymbol;
  timestamp: number;
}

// Move validation result
export interface MoveResult {
  valid: boolean;
  error?: string;
  newGameState?: GameState;
}

// UI-specific types
export interface CellPosition {
  boardIndex: number;
  cellIndex: number;
}

export interface GameUIState {
  hoveredCell: CellPosition | null;
  selectedCell: CellPosition | null;
  showValidMoves: boolean;
}

// Constants
export const BOARD_SIZE = 3;
export const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;
export const WINNING_COMBINATIONS = [
  // Rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // Columns
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // Diagonals
  [0, 4, 8],
  [2, 4, 6],
];

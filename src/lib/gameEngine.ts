import type {
  GameState,
  GameBoard,
  PlayerSymbol,
  Move,
  MoveResult,
  SubBoard,
} from "../types/game";
import { TOTAL_CELLS } from "../types/game";
import {
  checkSubBoardWinner,
  checkMainBoardWinner,
  isSubBoardCompleted,
  getValidMoves,
  isGameDraw,
} from "./winDetection";

/**
 * Create a new empty game state
 * @param gameId - Unique identifier for the game
 * @returns Initial game state
 */
export function createNewGame(gameId: string): GameState {
  const emptySubBoard = (): SubBoard => Array(TOTAL_CELLS).fill(null);

  const gameBoard: GameBoard = {
    main: Array(TOTAL_CELLS).fill(null),
    sub: Array(TOTAL_CELLS)
      .fill(null)
      .map(() => emptySubBoard()),
    activeBoard: null, // First player can choose any board
  };

  return {
    gameId,
    board: gameBoard,
    currentPlayer: "X", // X always goes first
    status: "playing",
    winner: null,
    createdAt: Date.now(),
    lastMove: Date.now(),
  };
}

/**
 * Validate if a move is legal
 * @param gameState - Current game state
 * @param move - The move to validate
 * @returns True if the move is valid
 */
export function isValidMove(gameState: GameState, move: Move): boolean {
  const { board, currentPlayer, status } = gameState;
  const { boardIndex, cellIndex, player } = move;

  // Game must be in progress
  if (status !== "playing") {
    return false;
  }

  // Must be the correct player's turn
  if (player !== currentPlayer) {
    return false;
  }

  // Board and cell indices must be valid
  if (
    boardIndex < 0 ||
    boardIndex >= TOTAL_CELLS ||
    cellIndex < 0 ||
    cellIndex >= TOTAL_CELLS
  ) {
    return false;
  }

  // Target cell must be empty
  if (board.sub[boardIndex][cellIndex] !== null) {
    return false;
  }

  // Target sub-board must not be completed
  if (isSubBoardCompleted(board.sub[boardIndex])) {
    return false;
  }

  // If there's an active board constraint, must play in that board
  if (board.activeBoard !== null && boardIndex !== board.activeBoard) {
    return false;
  }

  return true;
}

/**
 * Calculate the next active board based on the move
 * @param cellIndex - The cell index where the move was made
 * @param subBoards - All sub-boards to check completion status
 * @returns The next active board index or null if any board is allowed
 */
function calculateNextActiveBoard(
  cellIndex: number,
  subBoards: SubBoard[]
): number | null {
  const targetBoard = cellIndex;

  // If the target board is completed, player can choose any board
  if (isSubBoardCompleted(subBoards[targetBoard])) {
    return null;
  }

  return targetBoard;
}

/**
 * Apply a move to the game state
 * @param gameState - Current game state
 * @param move - The move to apply
 * @returns Result containing the new game state or error
 */
export function applyMove(gameState: GameState, move: Move): MoveResult {
  // Validate the move
  if (!isValidMove(gameState, move)) {
    return {
      valid: false,
      error: "Invalid move",
    };
  }

  // Create deep copy of the game state
  const newGameState: GameState = JSON.parse(JSON.stringify(gameState));
  const { boardIndex, cellIndex, player } = move;

  // Apply the move to the sub-board
  newGameState.board.sub[boardIndex][cellIndex] = player;
  newGameState.lastMove = Date.now();

  // Check if this move won the sub-board
  const subBoardWinner = checkSubBoardWinner(
    newGameState.board.sub[boardIndex]
  );
  if (subBoardWinner) {
    newGameState.board.main[boardIndex] = subBoardWinner;
  } else if (
    newGameState.board.sub[boardIndex].every((cell) => cell !== null)
  ) {
    // Sub-board is full but no winner (draw) - leave as null to indicate draw
  }

  // Calculate next active board
  newGameState.board.activeBoard = calculateNextActiveBoard(
    cellIndex,
    newGameState.board.sub
  );

  // Check for main board winner
  const mainBoardWinner = checkMainBoardWinner(newGameState.board.main);
  if (mainBoardWinner) {
    newGameState.winner = mainBoardWinner;
    newGameState.status = "finished";
  } else if (isGameDraw(newGameState.board.main)) {
    newGameState.winner = "draw";
    newGameState.status = "finished";
  }

  // Switch to next player if game is still ongoing
  if (newGameState.status === "playing") {
    newGameState.currentPlayer = player === "X" ? "O" : "X";
  }

  return {
    valid: true,
    newGameState,
  };
}

/**
 * Get all valid moves for the current game state
 * @param gameState - Current game state
 * @returns Array of valid move positions
 */
export function getValidMovesForGame(
  gameState: GameState
): Array<{ boardIndex: number; cellIndex: number }> {
  if (gameState.status !== "playing") {
    return [];
  }

  return getValidMoves(gameState.board.sub, gameState.board.activeBoard);
}

/**
 * Create a move object
 * @param boardIndex - Sub-board index (0-8)
 * @param cellIndex - Cell index within sub-board (0-8)
 * @param player - Player making the move
 * @returns Move object
 */
export function createMove(
  boardIndex: number,
  cellIndex: number,
  player: PlayerSymbol
): Move {
  return {
    boardIndex,
    cellIndex,
    player,
    timestamp: Date.now(),
  };
}

/**
 * Reset game to initial state
 * @param gameId - Game identifier to maintain
 * @returns Fresh game state
 */
export function resetGame(gameId: string): GameState {
  return createNewGame(gameId);
}

import type { Cell, SubBoard, MainBoard } from "../types/game";
import { WINNING_COMBINATIONS } from "../types/game";

/**
 * Check if a sub-board has a winner
 * @param subBoard - The 3x3 sub-board to check
 * @returns The winning player symbol or null if no winner
 */
export function checkSubBoardWinner(subBoard: SubBoard): Cell {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (
      subBoard[a] &&
      subBoard[a] === subBoard[b] &&
      subBoard[a] === subBoard[c]
    ) {
      return subBoard[a];
    }
  }
  return null;
}

/**
 * Check if the main board (game) has a winner
 * @param mainBoard - The 3x3 main board representing sub-board winners
 * @returns The winning player symbol or null if no winner
 */
export function checkMainBoardWinner(mainBoard: MainBoard): Cell {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (
      mainBoard[a] &&
      mainBoard[a] === mainBoard[b] &&
      mainBoard[a] === mainBoard[c]
    ) {
      return mainBoard[a];
    }
  }
  return null;
}

/**
 * Check if a sub-board is full (draw condition for sub-board)
 * @param subBoard - The sub-board to check
 * @returns True if the sub-board is completely filled
 */
export function isSubBoardFull(subBoard: SubBoard): boolean {
  return subBoard.every((cell) => cell !== null);
}

/**
 * Check if the entire game is a draw
 * @param mainBoard - The main board to check
 * @param subBoards - All 9 sub-boards (needed because drawn sub-boards leave null in mainBoard)
 * @returns True if all sub-boards are completed but no winner
 */
export function isGameDraw(mainBoard: MainBoard, subBoards: SubBoard[]): boolean {
  // Drawn sub-boards leave their main board slot as null, so we cannot use
  // mainBoard.every(c => c !== null) — it would never detect a draw when any
  // sub-board drew. Instead, check sub-board completion directly.
  const allSubBoardsCompleted = subBoards.every(isSubBoardCompleted);
  const hasWinner = checkMainBoardWinner(mainBoard) !== null;

  return allSubBoardsCompleted && !hasWinner;
}

/**
 * Check if a sub-board is completed (either won or drawn)
 * @param subBoard - The sub-board to check
 * @returns True if the sub-board cannot accept more moves
 */
export function isSubBoardCompleted(subBoard: SubBoard): boolean {
  return checkSubBoardWinner(subBoard) !== null || isSubBoardFull(subBoard);
}

/**
 * Get all valid move positions for the current game state
 * @param subBoards - Array of all sub-boards
 * @param activeBoard - Currently active board (null means any board)
 * @returns Array of valid {boardIndex, cellIndex} positions
 */
export function getValidMoves(
  subBoards: SubBoard[],
  activeBoard: number | null
): Array<{ boardIndex: number; cellIndex: number }> {
  const validMoves: Array<{ boardIndex: number; cellIndex: number }> = [];

  if (activeBoard !== null) {
    // Must play in specific board
    const targetBoard = subBoards[activeBoard];
    if (!isSubBoardCompleted(targetBoard)) {
      targetBoard.forEach((cell, cellIndex) => {
        if (cell === null) {
          validMoves.push({ boardIndex: activeBoard, cellIndex });
        }
      });
    }
  } else {
    // Can play in any non-completed board
    subBoards.forEach((subBoard, boardIndex) => {
      if (!isSubBoardCompleted(subBoard)) {
        subBoard.forEach((cell, cellIndex) => {
          if (cell === null) {
            validMoves.push({ boardIndex, cellIndex });
          }
        });
      }
    });
  }

  return validMoves;
}

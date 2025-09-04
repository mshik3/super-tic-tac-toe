import type { Move, PlayerSymbol } from "../types/game";

// Board position mappings for chess-style notation
const BOARD_NOTATION: Record<number, string> = {
  0: "UL", // Upper Left
  1: "U", // Upper
  2: "UR", // Upper Right
  3: "L", // Left
  4: "M", // Middle
  5: "R", // Right
  6: "LL", // Lower Left
  7: "Lo", // Lower
  8: "LR", // Lower Right
};

const CELL_NOTATION: Record<number, string> = {
  0: "ul", // upper left
  1: "u", // upper
  2: "ur", // upper right
  3: "l", // left
  4: "m", // middle
  5: "r", // right
  6: "ll", // lower left
  7: "lo", // lower
  8: "lr", // lower right
};

/**
 * Convert a move to chess-style notation
 * @param move - The move to convert
 * @returns Chess notation string (e.g., "Rr", "URm", "Mlo")
 */
export function moveToChessNotation(move: Move): string {
  const boardNotation = BOARD_NOTATION[move.boardIndex];
  const cellNotation = CELL_NOTATION[move.cellIndex];

  return `${boardNotation}${cellNotation}`;
}

/**
 * Convert chess notation back to board and cell indices
 * @param notation - Chess notation string
 * @returns Object with boardIndex and cellIndex, or null if invalid
 */
export function chessNotationToMove(
  notation: string
): { boardIndex: number; cellIndex: number } | null {
  // Find where board notation ends and cell notation begins
  let boardPart = "";
  let cellPart = "";

  // Try different splits to find valid board/cell combination
  for (let i = 1; i <= notation.length - 1; i++) {
    const potentialBoard = notation.substring(0, i);
    const potentialCell = notation.substring(i);

    const boardIndex = Object.entries(BOARD_NOTATION).find(
      ([, value]) => value === potentialBoard
    )?.[0];
    const cellIndex = Object.entries(CELL_NOTATION).find(
      ([, value]) => value === potentialCell
    )?.[0];

    if (boardIndex !== undefined && cellIndex !== undefined) {
      return {
        boardIndex: parseInt(boardIndex),
        cellIndex: parseInt(cellIndex),
      };
    }
  }

  return null;
}

/**
 * Get a human-readable description of a move
 * @param notation - Chess notation string
 * @returns Human-readable description
 */
export function getNotationDescription(notation: string): string {
  const move = chessNotationToMove(notation);
  if (!move) return notation;

  const boardName = BOARD_NOTATION[move.boardIndex];
  const cellName = CELL_NOTATION[move.cellIndex];

  const boardDesc =
    {
      UL: "Upper Left",
      U: "Upper",
      UR: "Upper Right",
      L: "Left",
      M: "Middle",
      R: "Right",
      LL: "Lower Left",
      Lo: "Lower",
      LR: "Lower Right",
    }[boardName] || boardName;

  const cellDesc =
    {
      ul: "upper left",
      u: "upper",
      ur: "upper right",
      l: "left",
      m: "middle",
      r: "right",
      ll: "lower left",
      lo: "lower",
      lr: "lower right",
    }[cellName] || cellName;

  return `${boardDesc} board, ${cellDesc} cell`;
}

export interface GameMove {
  notation: string;
  player: PlayerSymbol;
  moveNumber: number;
  timestamp: number;
}

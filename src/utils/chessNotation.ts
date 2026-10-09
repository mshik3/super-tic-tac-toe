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

// e.g. "Rr", "URm", "Mlo"
export function moveToChessNotation(move: Move): string {
  return `${BOARD_NOTATION[move.boardIndex]}${CELL_NOTATION[move.cellIndex]}`;
}

export interface GameMove {
  notation: string;
  player: PlayerSymbol;
  moveNumber: number;
  timestamp: number;
}

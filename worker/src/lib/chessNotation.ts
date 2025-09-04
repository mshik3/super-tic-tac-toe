import type { PlayerSymbol } from '../types/messages';

// Board position mappings for chess-style notation
const BOARD_NOTATION: Record<number, string> = {
	0: 'UL', // Upper Left
	1: 'U', // Upper
	2: 'UR', // Upper Right
	3: 'L', // Left
	4: 'M', // Middle
	5: 'R', // Right
	6: 'LL', // Lower Left
	7: 'Lo', // Lower
	8: 'LR', // Lower Right
};

const CELL_NOTATION: Record<number, string> = {
	0: 'ul', // upper left
	1: 'u', // upper
	2: 'ur', // upper right
	3: 'l', // left
	4: 'm', // middle
	5: 'r', // right
	6: 'll', // lower left
	7: 'lo', // lower
	8: 'lr', // lower right
};

/**
 * Convert a move to chess-style notation
 * @param move - The move to convert
 * @returns Chess notation string (e.g., "Rr", "URm", "Mlo")
 */
export function moveToChessNotation(move: { boardIndex: number; cellIndex: number; player: PlayerSymbol; timestamp: number }): string {
	const boardNotation = BOARD_NOTATION[move.boardIndex];
	const cellNotation = CELL_NOTATION[move.cellIndex];

	return `${boardNotation}${cellNotation}`;
}

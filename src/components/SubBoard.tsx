import React from "react";
import type { SubBoard as SubBoardType } from "../types/game";
import { Cell } from "./Cell";
import { clsx } from "clsx";
import { checkSubBoardWinner, isSubBoardCompleted } from "../lib/winDetection";

interface SubBoardProps {
  board: SubBoardType;
  boardIndex: number;
  isActive: boolean;
  validMoves: Array<{ boardIndex: number; cellIndex: number }>;
  hoveredCell: { boardIndex: number; cellIndex: number } | null;
  onCellClick: (boardIndex: number, cellIndex: number) => void;
  onCellHover: (boardIndex: number, cellIndex: number) => void;
  onCellLeave: () => void;
  disabled?: boolean;
}

export const SubBoard: React.FC<SubBoardProps> = React.memo(
  ({
    board,
    boardIndex,
    isActive,
    validMoves,
    hoveredCell,
    onCellClick,
    onCellHover,
    onCellLeave,
    disabled = false,
  }) => {
    const winner = checkSubBoardWinner(board);
    const isCompleted = isSubBoardCompleted(board);

    // Get valid moves for this specific board
    const validMovesForBoard = validMoves.filter(
      (move) => move.boardIndex === boardIndex
    );

    const isValidMove = (cellIndex: number): boolean => {
      return validMovesForBoard.some((move) => move.cellIndex === cellIndex);
    };

    const isCellHovered = (cellIndex: number): boolean => {
      return (
        hoveredCell?.boardIndex === boardIndex &&
        hoveredCell?.cellIndex === cellIndex
      );
    };

    return (
      <div
        className={clsx("sub-board relative", {
          active: isActive && !isCompleted,
          won: isCompleted,
          "opacity-60": disabled,
        })}
        role="grid"
        aria-label={`Sub-board ${boardIndex + 1} ${
          winner ? `won by ${winner}` : isActive ? "(active)" : ""
        }`}
      >
        {/* Winner overlay for completed boards */}
        {winner && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg z-10">
            <span
              className={clsx("text-6xl font-bold", {
                "text-blue-600": winner === "X",
                "text-red-600": winner === "O",
              })}
            >
              {winner}
            </span>
          </div>
        )}

        {/* Draw overlay for drawn boards */}
        {isCompleted && !winner && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-90 rounded-lg z-10">
            <span className="text-2xl font-bold text-gray-600">DRAW</span>
          </div>
        )}

        {/* Grid of cells */}
        {board.map((cell, cellIndex) => (
          <Cell
            key={`${boardIndex}-${cellIndex}`}
            value={cell}
            onClick={() => onCellClick(boardIndex, cellIndex)}
            isValidMove={isValidMove(cellIndex)}
            isHovered={isCellHovered(cellIndex)}
            onMouseEnter={() => onCellHover(boardIndex, cellIndex)}
            onMouseLeave={onCellLeave}
            disabled={disabled || isCompleted}
          />
        ))}
      </div>
    );
  }
);

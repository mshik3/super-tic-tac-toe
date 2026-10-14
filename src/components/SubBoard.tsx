import React from "react";
import type { SubBoard as SubBoardType, PlayerSymbol } from "../types/game";
import { Cell } from "./Cell";
import { clsx } from "clsx";
import { checkSubBoardWinner, isSubBoardCompleted } from "../lib/winDetection";

interface SubBoardProps {
  board: SubBoardType;
  boardIndex: number;
  isActive: boolean;
  validMoves: Array<{ boardIndex: number; cellIndex: number }>;
  onCellClick: (boardIndex: number, cellIndex: number) => void;
  disabled?: boolean;
  currentPlayer?: PlayerSymbol;
}

export const SubBoard: React.FC<SubBoardProps> = React.memo(
  ({
    board,
    boardIndex,
    isActive,
    validMoves,
    onCellClick,
    disabled = false,
    currentPlayer,
  }) => {
    const winner = checkSubBoardWinner(board);
    const isCompleted = isSubBoardCompleted(board);
    const isLive = isActive && !isCompleted;

    const isValidMove = (cellIndex: number): boolean =>
      validMoves.some(
        (move) => move.boardIndex === boardIndex && move.cellIndex === cellIndex
      );

    return (
      <div
        className={clsx("sub-board relative", {
          active: isLive,
          "x-active": isLive && currentPlayer === "X",
          "o-active": isLive && currentPlayer === "O",
        })}
        role="grid"
        aria-label={`Sub-board ${boardIndex + 1} ${
          winner ? `won by ${winner}` : isActive ? "(active)" : ""
        }`}
      >
        {isCompleted && (
          <div
            className={clsx(
              "absolute inset-0 z-10 flex items-center justify-center font-bold leading-none",
              winner === "X" && "bg-x-soft/90 text-x",
              winner === "O" && "bg-o-soft/90 text-o",
              !winner && "bg-strip/90 hatch text-muted text-xs uppercase tracking-widest"
            )}
            style={winner ? { fontSize: "clamp(2.5rem, 10vmin, 4.5rem)" } : undefined}
          >
            {winner ?? "Draw"}
          </div>
        )}

        {board.map((cell, cellIndex) => (
          <Cell
            key={cellIndex}
            value={cell}
            cellIndex={cellIndex}
            onClick={() => onCellClick(boardIndex, cellIndex)}
            isValidMove={isValidMove(cellIndex)}
            disabled={disabled || isCompleted}
            currentPlayer={currentPlayer}
          />
        ))}
      </div>
    );
  }
);

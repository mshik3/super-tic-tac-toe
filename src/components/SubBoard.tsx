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

    const validMovesForBoard = validMoves.filter(
      (move) => move.boardIndex === boardIndex
    );

    const isValidMove = (cellIndex: number): boolean =>
      validMovesForBoard.some((move) => move.cellIndex === cellIndex);

    const activeColorClass =
      isActive && !isCompleted
        ? currentPlayer === "X"
          ? "x-active"
          : "o-active"
        : "";

    return (
      <div
        className={clsx("sub-board relative", {
          active: isActive && !isCompleted,
          won: isCompleted,
          [activeColorClass]: !!activeColorClass,
        })}
        role="grid"
        aria-label={`Sub-board ${boardIndex + 1} ${
          winner ? `won by ${winner}` : isActive ? "(active)" : ""
        }`}
      >
        {/* Winner overlay — uses CSS vars so it respects board-light/dark theme */}
        {winner && (
          <div
            className={`absolute inset-0 flex items-center justify-center rounded-lg z-10 animate-winner-pop winner-overlay-${winner.toLowerCase()}`}
            style={{ backdropFilter: "blur(2px)" }}
          >
            <span
              className={`font-bold leading-none select-none winner-text-${winner.toLowerCase()}`}
              style={{ fontSize: "clamp(2.5rem, 10vmin, 4.5rem)" }}
            >
              {winner}
            </span>
          </div>
        )}

        {/* Draw overlay */}
        {isCompleted && !winner && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-lg z-10"
            style={{ background: "rgba(6, 12, 23, 0.82)", backdropFilter: "blur(2px)" }}
          >
            <span
              className="font-bold tracking-widest uppercase"
              style={{
                color: "var(--text-dim)",
                fontSize: "clamp(0.55rem, 1.8vmin, 0.8rem)",
              }}
            >
              DRAW
            </span>
          </div>
        )}

        {board.map((cell, cellIndex) => (
          <Cell
            key={`${boardIndex}-${cellIndex}`}
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

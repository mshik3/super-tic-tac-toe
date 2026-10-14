import React from "react";
import type { Cell as CellType, PlayerSymbol } from "../types/game";
import { clsx } from "clsx";

interface CellProps {
  value: CellType;
  cellIndex: number;
  onClick: () => void;
  isValidMove: boolean;
  disabled?: boolean;
  currentPlayer?: PlayerSymbol;
}

export const Cell: React.FC<CellProps> = React.memo(
  ({
    value,
    cellIndex,
    onClick,
    isValidMove,
    disabled = false,
    currentPlayer,
  }) => {
    const canPlay = isValidMove && !value && !disabled;

    return (
      <button
        className={clsx("game-cell", {
          x: value === "X",
          o: value === "O",
          playable: isValidMove || value !== null,
          "x-valid": canPlay && currentPlayer === "X",
          "o-valid": canPlay && currentPlayer === "O",
        })}
        onClick={() => canPlay && onClick()}
        disabled={!canPlay}
        type="button"
        aria-label={`Cell ${cellIndex + 1}, ${value ?? "empty"}`}
      >
        {value}
      </button>
    );
  }
);

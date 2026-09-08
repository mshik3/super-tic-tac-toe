import React from "react";
import type { Cell as CellType, PlayerSymbol } from "../types/game";
import { clsx } from "clsx";

interface CellProps {
  value: CellType;
  onClick: () => void;
  isValidMove: boolean;
  disabled?: boolean;
  currentPlayer?: PlayerSymbol;
}

export const Cell: React.FC<CellProps> = React.memo(
  ({
    value,
    onClick,
    isValidMove,
    disabled = false,
    currentPlayer,
  }) => {
    const handleClick = () => {
      if (!disabled && isValidMove) {
        onClick();
      }
    };

    const canPlay = isValidMove && !value && !disabled;

    return (
      <button
        className={clsx("game-cell", {
          occupied: value !== null,
          x: value === "X",
          o: value === "O",
          "x-valid": canPlay && currentPlayer === "X",
          "o-valid": canPlay && currentPlayer === "O",
          "opacity-25": disabled && !value,
          "cursor-pointer": canPlay,
          "cursor-not-allowed": !canPlay && !value,
        })}
        onClick={handleClick}
        disabled={disabled || !isValidMove}
        type="button"
        aria-label={`Cell ${value ? `occupied by ${value}` : "empty"}`}
      >
        {value && (
          <span className="font-bold leading-none select-none">{value}</span>
        )}
      </button>
    );
  }
);

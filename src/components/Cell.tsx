import React from "react";
import type { Cell as CellType } from "../types/game";
import { clsx } from "clsx";

interface CellProps {
  value: CellType;
  onClick: () => void;
  isValidMove: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  disabled?: boolean;
}

export const Cell: React.FC<CellProps> = React.memo(
  ({
    value,
    onClick,
    isValidMove,
    isHovered,
    onMouseEnter,
    onMouseLeave,
    disabled = false,
  }) => {
    const handleClick = () => {
      if (!disabled && isValidMove) {
        onClick();
      }
    };

    return (
      <button
        className={clsx("game-cell", {
          occupied: value !== null,
          x: value === "X",
          o: value === "O",
          "hover:bg-blue-50 border-blue-300":
            isValidMove && !value && isHovered,
          "hover:bg-gray-100": isValidMove && !value && !isHovered,
          "cursor-not-allowed opacity-50": disabled || !isValidMove,
          "cursor-pointer": isValidMove && !disabled,
          "bg-green-50 border-green-300": isValidMove && !value && !disabled,
        })}
        onClick={handleClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        disabled={disabled || !isValidMove}
        type="button"
        aria-label={`Cell ${value ? `occupied by ${value}` : "empty"}`}
      >
        {value && (
          <span
            className={clsx("font-bold text-2xl", {
              "text-blue-600": value === "X",
              "text-red-600": value === "O",
            })}
          >
            {value}
          </span>
        )}
      </button>
    );
  }
);

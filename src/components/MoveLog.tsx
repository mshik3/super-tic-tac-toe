import React, { useEffect, useRef } from "react";
import { clsx } from "clsx";
import type { GameMove } from "../utils/chessNotation";
import type { PlayerSymbol } from "../types/game";

interface MoveLogProps {
  moves: GameMove[];
  currentPlayer: PlayerSymbol;
  isGameActive: boolean;
  variant?: "default" | "compact";
  order?: "asc" | "desc"; // ascending = oldest first, descending = newest first
  maxHeightClass?: string; // optional Tailwind class for max-height of scroll area
}

export const MoveLog: React.FC<MoveLogProps> = React.memo(
  ({
    moves,
    currentPlayer,
    isGameActive,
    variant = "default",
    order = "asc",
    maxHeightClass,
  }) => {
    const moveListRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new moves are added
    useEffect(() => {
      if (moveListRef.current) {
        if (order === "asc") {
          moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
        } else {
          moveListRef.current.scrollTop = 0;
        }
      }
    }, [moves, order]);

    const isCompact = variant === "compact";

    return (
      <div className={clsx("flex flex-col h-full", isCompact && "text-xs")}>
        {/* Header */}
        <div
          className={clsx(
            "border-b border-gray-200 transition-colors duration-300",
            {
              "bg-blue-50": isGameActive && currentPlayer === "X",
              "bg-red-50": isGameActive && currentPlayer === "O",
              "bg-gray-50": !isGameActive,
            }
          )}
        >
          <div
            className={clsx(
              "flex items-center justify-between",
              isCompact ? "p-2" : "p-4"
            )}
          >
            <h3
              className={clsx(
                "font-semibold text-gray-900",
                isCompact ? "text-base" : "text-lg"
              )}
            >
              Move Log
            </h3>
            {isGameActive && (
              <p
                className={clsx(
                  isCompact ? "text-xs" : "text-sm",
                  "font-medium",
                  {
                    "text-blue-700": currentPlayer === "X",
                    "text-red-700": currentPlayer === "O",
                  }
                )}
              >
                {currentPlayer}'s Turn
              </p>
            )}
            {!isGameActive && (
              <p
                className={clsx(
                  isCompact ? "text-xs" : "text-sm",
                  "text-gray-500"
                )}
              >
                Game Over
              </p>
            )}
          </div>
        </div>

        {/* Move list */}
        <div
          ref={moveListRef}
          className={clsx(
            "overflow-y-auto",
            isCompact ? "p-2" : "p-3",
            maxHeightClass ?? ""
          )}
        >
          {moves.length === 0 ? (
            <div
              className={clsx(
                "text-center text-gray-500",
                isCompact ? "py-6" : "py-8"
              )}
            >
              <p className={clsx(isCompact ? "text-xs" : "text-sm")}>
                No moves yet
              </p>
              <p className="text-xs mt-1">
                Game will start when X makes the first move
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {(order === "desc" ? [...moves].reverse() : moves).map((move) => (
                <div
                  key={`${move.moveNumber}-${move.player}`}
                  className={clsx("flex items-center justify-between rounded", {
                    "bg-blue-100 text-blue-900": move.player === "X",
                    "bg-red-100 text-red-900": move.player === "O",
                  })}
                >
                  <div
                    className={clsx(
                      "flex items-center space-x-2",
                      isCompact ? "p-1" : "p-2"
                    )}
                  >
                    <span className="font-mono font-bold text-xs bg-white px-1.5 py-0.5 rounded">
                      {move.moveNumber}
                    </span>
                    <span
                      className={clsx(
                        "font-bold",
                        isCompact ? "text-base" : "text-lg",
                        {
                          "text-blue-700": move.player === "X",
                          "text-red-700": move.player === "O",
                        }
                      )}
                    >
                      {move.player}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      "font-mono font-semibold",
                      isCompact ? "text-sm pr-2" : "text-base pr-3"
                    )}
                  >
                    {move.notation}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notation guide */}
        <div
          className={clsx(
            "border-t border-gray-200",
            isCompact ? "p-2" : "p-3"
          )}
        >
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer font-medium hover:text-gray-800">
              Notation Guide
            </summary>
            <div className="mt-2 space-y-1 text-xs">
              <div>
                <strong>Boards:</strong> UL, U, UR, L, M, R, LL, Lo, LR
              </div>
              <div>
                <strong>Cells:</strong> ul, u, ur, l, m, r, ll, lo, lr
              </div>
              <div>
                <strong>Example:</strong> "Rm" = Right board, middle cell
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }
);

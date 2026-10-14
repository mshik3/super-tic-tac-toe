import React, { useEffect, useRef } from "react";
import type { GameMove } from "../utils/chessNotation";
import type { PlayerSymbol } from "../types/game";

interface MoveLogProps {
  moves: GameMove[];
  currentPlayer: PlayerSymbol;
  isGameActive: boolean;
  order?: "asc" | "desc";
  heightClass?: string;
  autoScroll?: boolean;
}

export const MoveLog: React.FC<MoveLogProps> = React.memo(
  ({
    moves,
    currentPlayer,
    isGameActive,
    order = "asc",
    heightClass,
    autoScroll = false,
  }) => {
    const moveListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!autoScroll || !moveListRef.current) return;
      if (order === "asc") {
        moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
      } else {
        moveListRef.current.scrollTop = 0;
      }
    }, [moves, order, autoScroll]);

    const orderedMoves = order === "desc" ? [...moves].reverse() : moves;

    return (
      <div
        className="flex flex-col flex-1 min-h-0"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--text-dim)" }}
          >
            Move Log
          </span>
          {isGameActive && (
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-bold tracking-wider uppercase animate-blink"
                style={{ color: currentPlayer === "X" ? "var(--x)" : "var(--o)" }}
              >
                {currentPlayer}
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-dim)" }}
              >
                to move
              </span>
            </div>
          )}
          {!isGameActive && (
            <span
              className="text-xs font-medium tracking-wider uppercase"
              style={{ color: "var(--text-dim)" }}
            >
              Game Over
            </span>
          )}
        </div>

        {/* Move list */}
        <div
          ref={moveListRef}
          className={`overflow-y-auto p-2 ${heightClass ?? "flex-1"}`}
        >
          {moves.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
              <div
                className="text-3xl font-bold opacity-10 select-none"
                style={{ color: "var(--text)" }}
              >
                —
              </div>
              <p
                className="text-xs font-medium tracking-wide text-center"
                style={{ color: "var(--text-dim)" }}
              >
                No moves yet
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {orderedMoves.map((move) => (
                <div
                  key={`${move.moveNumber}-${move.player}`}
                  className="flex items-center justify-between rounded px-2 py-1.5"
                  style={{
                    backgroundColor:
                      move.player === "X"
                        ? "rgba(0, 204, 255, 0.06)"
                        : "rgba(255, 68, 68, 0.06)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-xs w-5 text-right"
                      style={{ color: "var(--text-dim)" }}
                    >
                      {move.moveNumber}
                    </span>
                    <span
                      className="font-bold text-sm w-4"
                      style={{
                        color: move.player === "X" ? "var(--x)" : "var(--o)",
                      }}
                    >
                      {move.player}
                    </span>
                  </div>
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{ color: "var(--text)" }}
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
          className="border-t px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        >
          <details className="text-xs" style={{ color: "var(--text-dim)" }}>
            <summary
              className="cursor-pointer font-semibold tracking-wide uppercase hover:opacity-80 text-xs"
              style={{ fontSize: "0.65rem" }}
            >
              Notation Guide
            </summary>
            <div className="mt-2 space-y-1 font-mono text-xs leading-relaxed">
              <div>Boards: UL U UR / L M R / LL Lo LR</div>
              <div>Cells: ul u ur / l m r / ll lo lr</div>
              <div style={{ color: "var(--text)" }}>e.g. "Rm" = Right, middle</div>
            </div>
          </details>
        </div>
      </div>
    );
  }
);

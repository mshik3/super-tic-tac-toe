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
      moveListRef.current.scrollTop =
        order === "asc" ? moveListRef.current.scrollHeight : 0;
    }, [moves, order, autoScroll]);

    const orderedMoves = order === "desc" ? [...moves].reverse() : moves;

    return (
      <div className="flex flex-col flex-1 min-h-0 bg-panel">
        <div className="panel-title flex items-center justify-between">
          <span>Move log</span>
          <span className="normal-case font-normal">
            {isGameActive ? (
              <>
                <b className={currentPlayer === "X" ? "text-x" : "text-o"}>
                  {currentPlayer}
                </b>{" "}
                to move
              </>
            ) : (
              "Game over"
            )}
          </span>
        </div>

        <div
          ref={moveListRef}
          className={`overflow-y-auto ${heightClass ?? "flex-1"}`}
        >
          {moves.length === 0 ? (
            <p className="p-3 text-xs text-muted">No moves yet.</p>
          ) : (
            <table className="w-full text-xs font-mono">
              <tbody>
                {orderedMoves.map((move) => (
                  <tr
                    key={`${move.moveNumber}-${move.player}`}
                    className="border-b border-line/60 even:bg-strip/50"
                  >
                    <td className="w-10 px-3 py-1 text-right text-muted">
                      {move.moveNumber}.
                    </td>
                    <td
                      className={`w-6 py-1 font-bold ${
                        move.player === "X" ? "text-x" : "text-o"
                      }`}
                    >
                      {move.player}
                    </td>
                    <td className="py-1 pr-3">{move.notation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }
);

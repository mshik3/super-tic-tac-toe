import React, { useState } from "react";
import type { GameState } from "../types/game";
import { SubBoard } from "./SubBoard";
import { getValidMovesForGame } from "../lib/gameEngine";

interface GameBoardProps {
  gameState: GameState;
  onMove: (boardIndex: number, cellIndex: number) => void;
  disabled?: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = React.memo(
  ({ gameState, onMove, disabled = false }) => {
    const [hoveredCell, setHoveredCell] = useState<{
      boardIndex: number;
      cellIndex: number;
    } | null>(null);

    const validMoves = getValidMovesForGame(gameState);
    const { board } = gameState;

    const handleCellClick = (boardIndex: number, cellIndex: number) => {
      if (!disabled) {
        onMove(boardIndex, cellIndex);
      }
    };

    const handleCellHover = (boardIndex: number, cellIndex: number) => {
      if (!disabled) {
        setHoveredCell({ boardIndex, cellIndex });
      }
    };

    const handleCellLeave = () => {
      setHoveredCell(null);
    };

    return (
      <div className="flex flex-col items-center space-y-4 w-full">
        {/* Game status - only show winner */}
        {gameState.status === "finished" && (
          <div className="text-center">
            <div className="text-2xl font-bold">
              {gameState.winner === "draw" ? (
                <span className="text-gray-600">Game Draw!</span>
              ) : (
                <span
                  className={`${
                    gameState.winner === "X" ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  Player {gameState.winner} Wins!
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main game board */}
        <div
          className="main-board w-full max-w-[min(92vw,92vh)] md:max-w-none"
          role="grid"
          aria-label="Super Tic-Tac-Toe game board"
        >
          {board.sub.map((subBoard, boardIndex) => (
            <SubBoard
              key={boardIndex}
              board={subBoard}
              boardIndex={boardIndex}
              isActive={
                board.activeBoard === null || board.activeBoard === boardIndex
              }
              validMoves={validMoves}
              hoveredCell={hoveredCell}
              onCellClick={handleCellClick}
              onCellHover={handleCellHover}
              onCellLeave={handleCellLeave}
              disabled={disabled}
            />
          ))}
        </div>

        {/* Game info */}
        <div className="text-sm text-gray-600 max-w-md text-center">
          {board.activeBoard !== null ? (
            <p>Must play in highlighted board (#{board.activeBoard + 1})</p>
          ) : (
            <p>Can play in any available board</p>
          )}
        </div>
      </div>
    );
  }
);

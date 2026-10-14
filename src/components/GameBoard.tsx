import React from "react";
import type { GameState, PlayerSymbol } from "../types/game";
import { SubBoard } from "./SubBoard";
import { getValidMovesForGame } from "../lib/gameEngine";
import { BOARD_NOTATION } from "../utils/chessNotation";

interface GameBoardProps {
  gameState: GameState;
  onMove: (boardIndex: number, cellIndex: number) => void;
  disabled?: boolean;
  currentPlayer?: PlayerSymbol;
}

export const GameBoard: React.FC<GameBoardProps> = React.memo(
  ({ gameState, onMove, disabled = false, currentPlayer }) => {
    const validMoves = getValidMovesForGame(gameState);
    const { board } = gameState;
    const activePlayer = currentPlayer ?? gameState.currentPlayer;

    const handleCellClick = (boardIndex: number, cellIndex: number) => {
      if (!disabled) onMove(boardIndex, cellIndex);
    };

    return (
      <div className="flex flex-col items-center gap-1.5">
        <div
          className={`main-board ${board.activeBoard === null || gameState.status !== "playing" ? "unforced" : ""}`}
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
              onCellClick={handleCellClick}
              disabled={disabled}
              currentPlayer={activePlayer}
            />
          ))}
        </div>

        {gameState.status === "playing" && (
          <p className="text-xs text-muted">
            {activePlayer} plays in:{" "}
            <span className="font-mono font-bold text-ink">
              {board.activeBoard === null
                ? "any board"
                : BOARD_NOTATION[board.activeBoard]}
            </span>
          </p>
        )}
      </div>
    );
  }
);

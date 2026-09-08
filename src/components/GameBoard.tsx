import React, { useState, useEffect } from "react";
import type { GameState, PlayerSymbol } from "../types/game";
import { SubBoard } from "./SubBoard";
import { getValidMovesForGame } from "../lib/gameEngine";

interface GameBoardProps {
  gameState: GameState;
  onMove: (boardIndex: number, cellIndex: number) => void;
  disabled?: boolean;
  currentPlayer?: PlayerSymbol;
}

const THEME_KEY = "board-theme";

export const GameBoard: React.FC<GameBoardProps> = React.memo(
  ({ gameState, onMove, disabled = false, currentPlayer }) => {
    const [isLight, setIsLight] = useState<boolean>(() => {
      try {
        return localStorage.getItem(THEME_KEY) === "light";
      } catch {
        return false;
      }
    });

    useEffect(() => {
      try {
        localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
      } catch {
        // ignore
      }
    }, [isLight]);

    const validMoves = getValidMovesForGame(gameState);
    const { board } = gameState;
    const activePlayer = currentPlayer ?? gameState.currentPlayer;

    const handleCellClick = (boardIndex: number, cellIndex: number) => {
      if (!disabled) onMove(boardIndex, cellIndex);
    };

    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className={`main-board ${isLight ? "board-light" : "board-dark"}`}
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

        {/* Controls row: hint + theme toggle */}
        <div className="flex items-center justify-between w-full px-1"
          style={{ maxWidth: "min(88vmin, 560px)" }}
        >
          <p
            className="text-xs font-medium tracking-wide uppercase"
            style={{ color: "var(--text-dim)" }}
          >
            {gameState.status === "playing"
              ? board.activeBoard !== null
                ? `Board #${board.activeBoard + 1}`
                : "Any board"
              : ""}
          </p>

          <button
            className="board-theme-toggle"
            onClick={() => setIsLight((v) => !v)}
            aria-label={isLight ? "Switch to dark board" : "Switch to light board"}
          >
            {isLight ? (
              <>
                <MoonIcon />
                Dark
              </>
            ) : (
              <>
                <SunIcon />
                Light
              </>
            )}
          </button>
        </div>
      </div>
    );
  }
);

function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

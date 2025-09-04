import { create } from "zustand";
import type { GameState } from "../types/game";
import {
  createNewGame,
  applyMove,
  createMove,
  resetGame,
} from "../lib/gameEngine";
import { devtools } from "zustand/middleware";
import { moveToChessNotation, type GameMove } from "../utils/chessNotation";

interface GameStore {
  // Game state
  gameState: GameState | null;
  moves: GameMove[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Local multiplayer state
  localMode: boolean;

  // Actions
  startNewGame: () => void;
  makeMove: (boardIndex: number, cellIndex: number) => void;
  resetCurrentGame: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      // Initial state - start with a game already created
      gameState: createNewGame(`local-${Date.now()}`),
      moves: [],
      isLoading: false,
      error: null,
      localMode: true, // Start in local mode for MVP

      // Actions
      startNewGame: () => {
        const gameId = `local-${Date.now()}`;
        const newGameState = createNewGame(gameId);

        set({
          gameState: newGameState,
          moves: [],
          error: null,
          isLoading: false,
        });
      },

      makeMove: (boardIndex: number, cellIndex: number) => {
        const { gameState, moves } = get();

        if (!gameState) {
          set({ error: "No active game" });
          return;
        }

        if (gameState.status !== "playing") {
          set({ error: "Game is not in progress" });
          return;
        }

        // Create move for current player
        const move = createMove(boardIndex, cellIndex, gameState.currentPlayer);

        // Apply the move
        const result = applyMove(gameState, move);

        if (!result.valid) {
          set({ error: result.error || "Invalid move" });
          return;
        }

        // Create chess notation for the move
        const notation = moveToChessNotation(move);
        const gameMove: GameMove = {
          notation,
          player: move.player,
          moveNumber: moves.length + 1,
          timestamp: move.timestamp,
        };

        // Update game state with successful move
        set({
          gameState: result.newGameState,
          moves: [...moves, gameMove],
          error: null,
        });
      },

      resetCurrentGame: () => {
        const { gameState } = get();

        if (!gameState) {
          // Start a new game if none exists
          get().startNewGame();
          return;
        }

        const resetGameState = resetGame(gameState.gameId);

        set({
          gameState: resetGameState,
          moves: [],
          error: null,
        });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "super-tic-tac-toe-store",
      // Only include game state in devtools for debugging
      partialize: (state: GameStore) => ({
        gameState: state.gameState,
        error: state.error,
        localMode: state.localMode,
      }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useGameState = () => useGameStore((state) => state.gameState);
export const useGameError = () => useGameStore((state) => state.error);
export const useGameMoves = () => useGameStore((state) => state.moves);

// Individual action hooks to prevent re-render issues
export const useStartNewGame = () =>
  useGameStore((state) => state.startNewGame);
export const useMakeMove = () => useGameStore((state) => state.makeMove);
export const useResetCurrentGame = () =>
  useGameStore((state) => state.resetCurrentGame);
export const useClearError = () => useGameStore((state) => state.clearError);

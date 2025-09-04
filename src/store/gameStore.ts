import { create } from "zustand";
import type { GameState } from "../types/game";
import type {
  PlayerSymbol,
  ServerMessage,
  GameStatePayload,
  MoveResultPayload,
  GameOverPayload,
} from "../types/messages";
import {
  createNewGame,
  applyMove,
  createMove,
  resetGame,
} from "../lib/gameEngine";
import { devtools } from "zustand/middleware";
import { moveToChessNotation, type GameMove } from "../utils/chessNotation";
import { GameWebSocket, GameAPIClient } from "../lib/websocket";
import type { WebSocketStatus } from "../lib/websocket";

export type GameMode = "local" | "online";
export type Screen = "menu" | "searching" | "playing";

interface GameStore {
  // Game state
  gameState: GameState | null;
  moves: GameMove[];

  // UI state
  isLoading: boolean;
  error: string | null;
  currentScreen: Screen;

  // Game mode
  gameMode: GameMode;

  // Online multiplayer state
  playerId: string;
  playerNickname: string;
  playerSymbol: PlayerSymbol | null;
  gameId: string | null;
  connectionStatus: WebSocketStatus;
  opponentConnected: boolean;
  websocket: GameWebSocket | null;
  apiClient: GameAPIClient;

  // Actions
  startNewGame: () => void;
  makeMove: (boardIndex: number, cellIndex: number) => void;
  resetCurrentGame: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Online actions
  setGameMode: (mode: GameMode) => void;
  setScreen: (screen: Screen) => void;
  setPlayerNickname: (nickname: string) => void;
  findOnlineGame: () => void;
  connectToGame: (gameId: string, playerSymbol: PlayerSymbol) => void;
  disconnectFromGame: () => void;
  handleServerMessage: (message: ServerMessage) => void;
}

// Generate a cryptographically secure unique player ID
const generatePlayerId = () => {
  // Fallback for environments without crypto.randomUUID()
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `player-${crypto.randomUUID()}`;
  }
  // Secure fallback using crypto.getRandomValues()
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const hex = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `player-${hex}`;
};

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      gameState: null,
      moves: [],
      isLoading: false,
      error: null,
      currentScreen: "menu",

      // Game mode
      gameMode: "local",

      // Online state
      playerId: generatePlayerId(),
      playerNickname: "Anonymous",
      playerSymbol: null,
      gameId: null,
      connectionStatus: "disconnected",
      opponentConnected: false,
      websocket: null,
      apiClient: new GameAPIClient(),

      // Actions
      startNewGame: () => {
        const gameId = `local-${Date.now()}`;
        const newGameState = createNewGame(gameId);

        set({
          gameState: newGameState,
          moves: [],
          error: null,
          isLoading: false,
          currentScreen: "playing",
          gameMode: "local",
        });
      },

      makeMove: (boardIndex: number, cellIndex: number) => {
        const { gameState, moves, gameMode, websocket, playerSymbol } = get();

        if (!gameState) {
          set({ error: "No active game" });
          return;
        }

        if (gameState.status !== "playing") {
          set({ error: "Game is not in progress" });
          return;
        }

        // For online games, send move via WebSocket
        if (gameMode === "online" && websocket) {
          // Check if it's our turn
          if (gameState.currentPlayer !== playerSymbol) {
            set({ error: "Not your turn" });
            return;
          }

          // Send move to server (optimistic update will happen on server response)
          const success = websocket.makeMove(boardIndex, cellIndex);
          if (!success) {
            set({ error: "Failed to send move" });
          }
          return;
        }

        // Local game logic
        const move = createMove(boardIndex, cellIndex, gameState.currentPlayer);
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
        const { gameState, gameMode } = get();

        if (gameMode === "online") {
          // For online games, disconnect and return to menu
          get().disconnectFromGame();
          return;
        }

        if (!gameState) {
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

      // Online actions
      setGameMode: (mode: GameMode) => {
        set({ gameMode: mode });
        if (mode === "local") {
          // Initialize local game
          get().startNewGame();
        }
      },

      setScreen: (screen: Screen) => {
        set({ currentScreen: screen });
      },

      setPlayerNickname: (nickname: string) => {
        set({ playerNickname: nickname });
      },

      findOnlineGame: () => {
        set({
          gameMode: "online",
          currentScreen: "searching",
          error: null,
          isLoading: true,
        });
      },

      connectToGame: (gameId: string, playerSymbol: PlayerSymbol) => {
        const { playerId, apiClient } = get();

        // Disconnect existing WebSocket if any
        get().disconnectFromGame();

        const wsUrl = apiClient.getWebSocketUrl(gameId, playerId);

        const websocket = new GameWebSocket({
          url: wsUrl,
          onMessage: get().handleServerMessage,
          onStatusChange: (status) => set({ connectionStatus: status }),
          onError: (error) => set({ error: error.message }),
        });

        websocket.connect();

        set({
          gameId,
          playerSymbol,
          websocket,
          gameMode: "online", // CRITICAL: Keep online mode!
          currentScreen: "playing",
          isLoading: false,
        });
      },

      disconnectFromGame: () => {
        const { websocket } = get();

        if (websocket) {
          websocket.disconnect();
        }

        set({
          websocket: null,
          gameId: null,
          playerSymbol: null,
          gameState: null,
          moves: [],
          connectionStatus: "disconnected",
          opponentConnected: false,
          currentScreen: "menu",
          gameMode: "local",
          error: null,
        });
      },

      handleServerMessage: (message: ServerMessage) => {
        switch (message.type) {
          case "GAME_STATE":
            const gameStatePayload = message.payload as GameStatePayload;

            // Convert online game state to local format
            const localGameState: GameState = {
              gameId: gameStatePayload.gameId,
              board: gameStatePayload.board,
              currentPlayer: gameStatePayload.currentPlayer,
              status: gameStatePayload.status,
              winner: null, // Will be updated by GAME_OVER message
              createdAt: Date.now(),
              lastMove: Date.now(),
            };

            set({
              gameState: localGameState,
              playerSymbol: gameStatePayload.yourSymbol, // Update player symbol from server
              opponentConnected: gameStatePayload.opponentConnected,
              error: null,
            });

            break;

          case "MOVE_RESULT":
            const moveResultPayload = message.payload as MoveResultPayload;
            if (moveResultPayload.valid) {
              // Update game state with the move result
              const updatedGameState: GameState = {
                gameId: get().gameId || "",
                board: moveResultPayload.board,
                currentPlayer: moveResultPayload.currentPlayer,
                status: moveResultPayload.gameStatus,
                winner: null, // Will be updated by GAME_OVER if needed
                createdAt: get().gameState?.createdAt || Date.now(),
                lastMove: Date.now(),
              };

              set({
                gameState: updatedGameState,
                error: null,
              });
            } else {
              set({ error: moveResultPayload.error || "Invalid move" });
            }
            break;

          case "GAME_OVER":
            const gameOverPayload = message.payload as GameOverPayload;
            const currentGameState = get().gameState;
            if (currentGameState) {
              set({
                gameState: {
                  ...currentGameState,
                  status: "finished",
                  winner: gameOverPayload.winner,
                  board: gameOverPayload.finalBoard,
                },
              });
            }
            break;

          case "ERROR":
            set({ error: message.payload.message });
            break;

          default:
            console.warn("Unhandled server message:", message);
        }
      },
    }),
    {
      name: "super-tic-tac-toe-store",
      // Only include essential state in devtools for debugging
      partialize: (state: GameStore) => ({
        gameState: state.gameState,
        error: state.error,
        gameMode: state.gameMode,
        currentScreen: state.currentScreen,
        connectionStatus: state.connectionStatus,
      }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useGameState = () => useGameStore((state) => state.gameState);
export const useGameError = () => useGameStore((state) => state.error);
export const useGameMoves = () => useGameStore((state) => state.moves);
export const useCurrentScreen = () =>
  useGameStore((state) => state.currentScreen);
export const useGameMode = () => useGameStore((state) => state.gameMode);
export const useConnectionStatus = () =>
  useGameStore((state) => state.connectionStatus);
export const usePlayerSymbol = () =>
  useGameStore((state) => state.playerSymbol);
export const useOpponentConnected = () =>
  useGameStore((state) => state.opponentConnected);
export const usePlayerId = () => useGameStore((state) => state.playerId);

// Individual action hooks to prevent re-render issues
export const useStartNewGame = () =>
  useGameStore((state) => state.startNewGame);
export const useMakeMove = () => useGameStore((state) => state.makeMove);
export const useResetCurrentGame = () =>
  useGameStore((state) => state.resetCurrentGame);
export const useClearError = () => useGameStore((state) => state.clearError);
export const useSetGameMode = () => useGameStore((state) => state.setGameMode);
export const useSetPlayerNickname = () =>
  useGameStore((state) => state.setPlayerNickname);
export const useFindOnlineGame = () =>
  useGameStore((state) => state.findOnlineGame);
export const useConnectToGame = () =>
  useGameStore((state) => state.connectToGame);
export const useDisconnectFromGame = () =>
  useGameStore((state) => state.disconnectFromGame);

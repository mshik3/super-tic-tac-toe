import { create } from "zustand";
import type { GameState } from "../types/game";
import type {
  PlayerSymbol,
  ServerMessage,
  GameStatePayload,
  MoveResultPayload,
  GameOverPayload,
  StoredMove,
  ErrorPayload,
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
import { validateNickname } from "../utils/nickname";

export type GameMode = "local" | "online";
export type Screen = "menu" | "searching" | "playing";

interface PendingMove {
  boardIndex: number;
  cellIndex: number;
  player: PlayerSymbol;
  timestamp: number;
  sequenceNumber: number;
}

interface GameStore {
  // Game state
  gameState: GameState | null;
  moves: GameMove[];
  pendingMoves: PendingMove[];
  moveSequenceNumber: number;

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
  opponentNickname: string | null;
  gameOverReason: GameOverPayload["reason"] | null;
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
  connectToGame: (
    gameId: string,
    playerSymbol: PlayerSymbol,
    connectToken?: string
  ) => void;
  disconnectFromGame: () => void;
  handleServerMessage: (message: ServerMessage) => void;
}

// Generate a cryptographically secure unique player ID
const generatePlayerId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `player-${crypto.randomUUID()}`;
  }
  // Fallback for environments without crypto.randomUUID()
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const hex = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `player-${hex}`;
};

// Single store implementation — devtools middleware applied conditionally below.
// Using `any` for set/get here is intentional: the external API is fully typed
// by the create<GameStore>() wrapper; the internal Zustand mutator types differ
// between plain and devtools variants and cannot be unified without `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storeImpl = (set: any, get: any): GameStore => ({
  // Initial state
  gameState: null,
  moves: [],
  pendingMoves: [],
  moveSequenceNumber: 0,
  isLoading: false,
  error: null,
  currentScreen: "menu",

  gameMode: "local",

  playerId: generatePlayerId(),
  playerNickname: "Anonymous",
  playerSymbol: null,
  gameId: null,
  connectionStatus: "disconnected",
  opponentConnected: false,
  opponentNickname: null,
  gameOverReason: null,
  websocket: null,
  apiClient: new GameAPIClient(),

  // ─── Local game actions ────────────────────────────────────────────────────

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
    const {
      gameState,
      moves,
      pendingMoves,
      moveSequenceNumber,
      gameMode,
      websocket,
      playerSymbol,
    } = get();

    if (!gameState) {
      set({ error: "No active game" });
      return;
    }

    if (gameState.status !== "playing") {
      set({ error: "Game is not in progress" });
      return;
    }

    // ── Online: optimistic update, then send to server ──
    if (gameMode === "online" && websocket) {
      if (gameState.currentPlayer !== playerSymbol) {
        set({ error: "Not your turn" });
        return;
      }

      const move = createMove(boardIndex, cellIndex, playerSymbol);
      const result = applyMove(gameState, move);

      if (!result.valid) {
        set({ error: result.error || "Invalid move" });
        return;
      }

      const notation = moveToChessNotation(move);
      const gameMove: GameMove = {
        notation,
        player: move.player,
        moveNumber: moves.length + 1,
        timestamp: move.timestamp,
      };

      const pendingMove: PendingMove = {
        boardIndex,
        cellIndex,
        player: playerSymbol,
        timestamp: move.timestamp,
        sequenceNumber: moveSequenceNumber + 1,
      };

      set({
        gameState: result.newGameState,
        moves: [...moves, gameMove],
        pendingMoves: [...pendingMoves, pendingMove],
        moveSequenceNumber: moveSequenceNumber + 1,
        error: null,
      });

      const success = websocket.makeMove(
        boardIndex,
        cellIndex,
        moveSequenceNumber + 1
      );
      if (!success) {
        // Network failure — roll back the optimistic update
        set({
          gameState,
          moves,
          pendingMoves,
          moveSequenceNumber,
          error: "Failed to send move - please try again",
        });
      }
      return;
    }

    // ── Local game ──
    const move = createMove(boardIndex, cellIndex, gameState.currentPlayer);
    const result = applyMove(gameState, move);

    if (!result.valid) {
      set({ error: result.error || "Invalid move" });
      return;
    }

    const notation = moveToChessNotation(move);
    const gameMove: GameMove = {
      notation,
      player: move.player,
      moveNumber: moves.length + 1,
      timestamp: move.timestamp,
    };

    set({
      gameState: result.newGameState,
      moves: [...moves, gameMove],
      error: null,
    });
  },

  resetCurrentGame: () => {
    const { gameState, gameMode } = get();

    if (gameMode === "online") {
      get().disconnectFromGame();
      return;
    }

    if (!gameState) {
      get().startNewGame();
      return;
    }

    const resetGameState = resetGame(gameState.gameId);
    set({ gameState: resetGameState, moves: [], error: null });
  },

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),

  // ─── Online actions ────────────────────────────────────────────────────────

  setGameMode: (mode: GameMode) => {
    set({ gameMode: mode });
    if (mode === "local") {
      get().startNewGame();
    }
  },

  setScreen: (screen: Screen) => set({ currentScreen: screen }),

  setPlayerNickname: (nickname: string) => {
    const result = validateNickname(nickname);
    if (!result.isValid) {
      set({ error: result.errors[0] || "Invalid display name" });
      return;
    }
    set({ playerNickname: result.sanitized, error: null });
  },

  findOnlineGame: () => {
    set({
      gameMode: "online",
      currentScreen: "searching",
      error: null,
      isLoading: true,
    });
  },

  connectToGame: (
    gameId: string,
    playerSymbol: PlayerSymbol,
    connectToken?: string
  ) => {
    const { playerId, apiClient } = get();

    // Clean up any existing connection first
    get().disconnectFromGame();

    const wsUrl = apiClient.getWebSocketUrl(gameId, playerId, connectToken);

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
      gameMode: "online",
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
      opponentNickname: null,
      gameOverReason: null,
      currentScreen: "menu",
      gameMode: "local",
      error: null,
    });
  },

  // ─── WebSocket message handler ─────────────────────────────────────────────

  handleServerMessage: (message: ServerMessage) => {
    switch (message.type) {
      case "GAME_STATE": {
        const payload = message.payload as GameStatePayload;

        const localGameState: GameState = {
          gameId: payload.gameId,
          board: payload.board,
          currentPlayer: payload.currentPlayer,
          status: payload.status,
          winner: payload.winner ?? null,
          createdAt: Date.now(),
          lastMove: Date.now(),
        };

        const gameMoves: GameMove[] = (payload.moves || []).map(
          (storedMove: StoredMove) => ({
            notation: storedMove.notation,
            player: storedMove.player,
            moveNumber: storedMove.moveNumber,
            timestamp: storedMove.timestamp,
          })
        );

        set({
          gameState: localGameState,
          moves: gameMoves,
          pendingMoves: [],
          playerSymbol: payload.yourSymbol,
          opponentConnected: payload.opponentConnected,
          opponentNickname: payload.opponentNickname ?? null,
          gameOverReason: payload.status === "finished" ? get().gameOverReason : null,
          error: null,
        });
        break;
      }

      case "MOVE_RESULT": {
        const payload = message.payload as MoveResultPayload;
        const { pendingMoves, moves } = get();

        if (payload.valid) {
          const updatedGameState: GameState = {
            gameId: get().gameId || "",
            board: payload.board,
            currentPlayer: payload.currentPlayer,
            status: payload.gameStatus,
            winner: null,
            createdAt: get().gameState?.createdAt || Date.now(),
            lastMove: Date.now(),
          };

          let updatedMoves = moves;
          if (payload.move) {
            const gameMove: GameMove = {
              notation: payload.move.notation,
              player: payload.move.player,
              moveNumber: payload.move.moveNumber,
              timestamp: payload.move.timestamp,
            };

            // Deduplicate: the move may already be in the log from an optimistic update
            const alreadyLogged = moves.some(
              (m: GameMove) =>
                m.moveNumber === gameMove.moveNumber &&
                m.player === gameMove.player &&
                m.notation === gameMove.notation
            );

            if (!alreadyLogged) {
              updatedMoves = [...moves, gameMove];
            }
          }

          set({
            gameState: updatedGameState,
            moves: updatedMoves,
            pendingMoves: pendingMoves.slice(0, -1),
            error: null,
          });
        } else {
          // Server rejected the move — roll back the last optimistic entry
          if (pendingMoves.length > 0) {
            set({
              moves: moves.slice(0, -1),
              pendingMoves: pendingMoves.slice(0, -1),
              error: payload.error || "Move was rejected by server",
            });
          } else {
            set({ error: payload.error || "Invalid move" });
          }
        }
        break;
      }

      case "GAME_OVER": {
        const payload = message.payload as GameOverPayload;
        const currentGameState = get().gameState;
        if (currentGameState) {
          set({
            gameState: {
              ...currentGameState,
              status: "finished",
              winner: payload.winner,
              board: payload.finalBoard,
            },
            gameOverReason: payload.reason,
          });
        }
        break;
      }

      case "ERROR":
        set({ error: (message.payload as ErrorPayload).message });
        break;

      default:
        break;
    }
  },
});

export const useGameStore = create<GameStore>()(
  import.meta.env.DEV
    ? devtools(storeImpl, { name: "super-tic-tac-toe-store" })
    : storeImpl
);

// ─── Selector hooks (granular subscriptions to avoid unnecessary re-renders) ──

export const useGameState = () => useGameStore((s) => s.gameState);
export const useGameError = () => useGameStore((s) => s.error);
export const useGameMoves = () => useGameStore((s) => s.moves);
export const useCurrentScreen = () => useGameStore((s) => s.currentScreen);
export const useGameMode = () => useGameStore((s) => s.gameMode);
export const useConnectionStatus = () => useGameStore((s) => s.connectionStatus);
export const usePlayerSymbol = () => useGameStore((s) => s.playerSymbol);
export const useOpponentConnected = () => useGameStore((s) => s.opponentConnected);
export const usePlayerId = () => useGameStore((s) => s.playerId);
export const useOpponentNickname = () => useGameStore((s) => s.opponentNickname);
export const useGameOverReason = () => useGameStore((s) => s.gameOverReason);
export const usePlayerNickname = () => useGameStore((s) => s.playerNickname);

export const useStartNewGame = () => useGameStore((s) => s.startNewGame);
export const useMakeMove = () => useGameStore((s) => s.makeMove);
export const useResetCurrentGame = () => useGameStore((s) => s.resetCurrentGame);
export const useClearError = () => useGameStore((s) => s.clearError);
export const useSetGameMode = () => useGameStore((s) => s.setGameMode);
export const useSetPlayerNickname = () => useGameStore((s) => s.setPlayerNickname);
export const useFindOnlineGame = () => useGameStore((s) => s.findOnlineGame);
export const useConnectToGame = () => useGameStore((s) => s.connectToGame);
export const useDisconnectFromGame = () => useGameStore((s) => s.disconnectFromGame);

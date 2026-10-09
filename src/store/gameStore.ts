import { create } from "zustand";
import type { GameState } from "../types/game";
import type {
  PlayerSymbol,
  ServerMessage,
  GameStatePayload,
  MoveResultPayload,
  GameOverPayload,
  ErrorPayload,
} from "../types/messages";
import { createNewGame, applyMove, createMove } from "../lib/gameEngine";
import { devtools } from "zustand/middleware";
import { moveToChessNotation, type GameMove } from "../utils/chessNotation";
import { GameWebSocket, GameAPIClient } from "../lib/websocket";
import type { WebSocketStatus } from "../lib/websocket";
import {
  loadSavedNickname,
  saveNickname,
  validateNickname,
} from "../utils/nickname";

export type GameMode = "local" | "online";
export type Screen = "menu" | "searching" | "playing";

interface GameStore {
  // Game state
  gameState: GameState | null;
  moves: GameMove[];
  pendingMoves: number; // optimistic online moves the server hasn't confirmed yet

  // UI state
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
  turnDeadline: number | null; // local epoch ms when the player to move loses on time
  websocket: GameWebSocket | null;
  apiClient: GameAPIClient;

  // Actions
  startNewGame: () => void;
  makeMove: (boardIndex: number, cellIndex: number) => void;
  resetCurrentGame: () => void;
  clearError: () => void;

  // Online actions
  setGameMode: (mode: GameMode) => void;
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

const generatePlayerId = () => `player-${crypto.randomUUID()}`;

// sessionStorage, not localStorage: a refresh rejoins the game, but a second
// tab must not take over the same seat.
const SESSION_KEY = "stt-online-session";

interface SavedSession {
  gameId: string;
  playerId: string;
  playerSymbol: PlayerSymbol;
  connectToken: string;
}

const loadSession = (): SavedSession | null => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
};

const saveSession = (session: SavedSession | null) => {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable (private mode): refresh just won't rejoin
  }
};

const deadlineFrom = (msLeft?: number) =>
  msLeft === undefined ? null : Date.now() + msLeft;

// Single store implementation — devtools middleware applied conditionally below.
// Using `any` for set/get here is intentional: the external API is fully typed
// by the create<GameStore>() wrapper; the internal Zustand mutator types differ
// between plain and devtools variants and cannot be unified without `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storeImpl = (set: any, get: any): GameStore => ({
  // Initial state
  gameState: null,
  moves: [],
  pendingMoves: 0,
  error: null,
  currentScreen: "menu",

  gameMode: "local",

  playerId: loadSession()?.playerId ?? generatePlayerId(),
  playerNickname: loadSavedNickname() ?? "Anonymous",
  playerSymbol: null,
  gameId: null,
  connectionStatus: "disconnected",
  opponentConnected: false,
  opponentNickname: null,
  gameOverReason: null,
  turnDeadline: null,
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
      currentScreen: "playing",
      gameMode: "local",
    });
  },

  makeMove: (boardIndex: number, cellIndex: number) => {
    const { gameState, moves, pendingMoves, gameMode, websocket, playerSymbol } =
      get();

    if (!gameState) {
      set({ error: "No active game" });
      return;
    }

    if (gameState.status !== "playing") {
      set({ error: "Game is not in progress" });
      return;
    }

    const online = gameMode === "online" && websocket;
    if (online && gameState.currentPlayer !== playerSymbol) {
      set({ error: "Not your turn" });
      return;
    }

    const move = createMove(boardIndex, cellIndex, gameState.currentPlayer);
    const result = applyMove(gameState, move);

    if (!result.valid) {
      set({ error: result.error || "Invalid move" });
      return;
    }

    const gameMove: GameMove = {
      notation: moveToChessNotation(move),
      player: move.player,
      moveNumber: moves.length + 1,
      timestamp: move.timestamp,
    };

    set({
      gameState: result.newGameState,
      moves: [...moves, gameMove],
      pendingMoves: online ? pendingMoves + 1 : pendingMoves,
      error: null,
    });

    // Online: the update above is optimistic; roll back if the send fails
    if (online && !websocket.send({ type: "MAKE_MOVE", payload: { boardIndex, cellIndex } })) {
      set({
        gameState,
        moves,
        pendingMoves,
        error: "Failed to send move - please try again",
      });
    }
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

    set({ gameState: createNewGame(gameState.gameId), moves: [], error: null });
  },

  clearError: () => set({ error: null }),

  // ─── Online actions ────────────────────────────────────────────────────────

  setGameMode: (mode: GameMode) => {
    set({ gameMode: mode });
    if (mode === "local") {
      get().startNewGame();
    }
  },

  setPlayerNickname: (nickname: string) => {
    const result = validateNickname(nickname);
    if (!result.isValid) {
      set({ error: result.errors[0] || "Invalid display name" });
      return;
    }
    saveNickname(result.sanitized);
    set({ playerNickname: result.sanitized, error: null });
  },

  findOnlineGame: () => {
    set({
      // Fresh id per search: the queue keys matches by playerId, so reusing one
      // could hand back a previous game's match
      playerId: generatePlayerId(),
      gameMode: "online",
      currentScreen: "searching",
      error: null,
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
      onStatusChange: (status) => {
        if (get().websocket !== websocket) return; // replaced socket
        set({ connectionStatus: status });
        // Gave up without ever receiving the game (e.g. a rejoin after the
        // session expired): don't leave the player on an endless spinner.
        if (status === "disconnected" && !get().gameState) {
          get().disconnectFromGame();
        }
      },
      onError: (error) => set({ error: error.message }),
    });

    websocket.connect();
    if (connectToken) {
      saveSession({ gameId, playerId, playerSymbol, connectToken });
    }

    set({
      gameId,
      playerSymbol,
      websocket,
      gameMode: "online",
      currentScreen: "playing",
    });
  },

  disconnectFromGame: () => {
    const { websocket } = get();

    if (websocket) {
      websocket.disconnect();
    }
    saveSession(null);

    set({
      turnDeadline: null,
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

        set({
          gameState: localGameState,
          moves: payload.moves,
          pendingMoves: 0,
          playerSymbol: payload.yourSymbol,
          opponentConnected: payload.opponentConnected,
          opponentNickname: payload.opponentNickname ?? null,
          playerNickname: payload.yourNickname ?? get().playerNickname,
          turnDeadline: deadlineFrom(payload.turnTimeLeftMs),
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
            pendingMoves: Math.max(0, pendingMoves - 1),
            turnDeadline: deadlineFrom(payload.turnTimeLeftMs),
            error: null,
          });
        } else {
          // Server rejected the move — roll back the last optimistic entry
          if (pendingMoves > 0) {
            set({
              moves: moves.slice(0, -1),
              pendingMoves: pendingMoves - 1,
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
            turnDeadline: null,
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
export const useTurnDeadline = () => useGameStore((s) => s.turnDeadline);

export const useStartNewGame = () => useGameStore((s) => s.startNewGame);
export const useMakeMove = () => useGameStore((s) => s.makeMove);
export const useResetCurrentGame = () => useGameStore((s) => s.resetCurrentGame);
export const useClearError = () => useGameStore((s) => s.clearError);
export const useSetGameMode = () => useGameStore((s) => s.setGameMode);
export const useSetPlayerNickname = () => useGameStore((s) => s.setPlayerNickname);
export const useFindOnlineGame = () => useGameStore((s) => s.findOnlineGame);
export const useConnectToGame = () => useGameStore((s) => s.connectToGame);
export const useDisconnectFromGame = () => useGameStore((s) => s.disconnectFromGame);

// A refresh mid-game rejoins with the saved seat; the server keeps the
// session for 60s after a disconnect.
const savedSession = loadSession();
if (savedSession) {
  useGameStore
    .getState()
    .connectToGame(savedSession.gameId, savedSession.playerSymbol, savedSession.connectToken);
}

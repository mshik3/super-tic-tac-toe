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
  import.meta.env.DEV
    ? devtools(
        (set, get) => ({
          // Initial state
          gameState: null,
          moves: [],
          pendingMoves: [],
          moveSequenceNumber: 0,
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
            const { gameState, moves, gameMode, websocket, playerSymbol } =
              get();

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
            const move = createMove(
              boardIndex,
              cellIndex,
              gameState.currentPlayer
            );
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

            // Disconnect existing WebSocket if any
            get().disconnectFromGame();

            const wsUrl = apiClient.getWebSocketUrl(
              gameId,
              playerId,
              connectToken
            );

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
              case "GAME_STATE": {
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
              }

              case "MOVE_RESULT": {
                const moveResultPayload = message.payload as MoveResultPayload;
                const { pendingMoves, moves } = get();

                if (moveResultPayload.valid) {
                  // Server confirmed the move - remove from pending moves
                  const updatedPendingMoves = pendingMoves.slice(0, -1); // Remove the last pending move

                  // Update game state with authoritative server result
                  const updatedGameState: GameState = {
                    gameId: get().gameId || "",
                    board: moveResultPayload.board,
                    currentPlayer: moveResultPayload.currentPlayer,
                    status: moveResultPayload.gameStatus,
                    winner: null, // Will be updated by GAME_OVER if needed
                    createdAt: get().gameState?.createdAt || Date.now(),
                    lastMove: Date.now(),
                  };

                  // Process the move for logging (ensures both players see all moves)
                  let updatedMoves = moves;
                  if (moveResultPayload.move) {
                    // Convert StoredMove to GameMove format
                    const gameMove: GameMove = {
                      notation: moveResultPayload.move.notation,
                      player: moveResultPayload.move.player,
                      moveNumber: moveResultPayload.move.moveNumber,
                      timestamp: moveResultPayload.move.timestamp,
                    };

                    // Check if this move is already in our log (from optimistic update)
                    const moveExists = moves.some(
                      (m) =>
                        m.moveNumber === gameMove.moveNumber &&
                        m.player === gameMove.player &&
                        m.notation === gameMove.notation
                    );

                    if (!moveExists) {
                      // This is an opponent's move, add it to our log
                      updatedMoves = [...moves, gameMove];
                      console.log("Added opponent move to log:", gameMove);
                    } else {
                      console.log(
                        "Move already in log (own move confirmed):",
                        gameMove
                      );
                    }
                  }

                  // The move was already optimistically applied, just confirm it
                  set({
                    gameState: updatedGameState,
                    moves: updatedMoves,
                    pendingMoves: updatedPendingMoves,
                    error: null,
                  });
                } else {
                  // Server rejected the move - rollback optimistic update
                  if (pendingMoves.length > 0) {
                    // Get the current state without pending moves
                    const { moves } = get();

                    // Remove the last optimistic move
                    const rolledBackMoves = moves.slice(0, -1);

                    // We need to reconstruct the game state without the failed move
                    // For now, request fresh state from server by clearing error
                    // The server will send updated GAME_STATE
                    set({
                      moves: rolledBackMoves,
                      pendingMoves: pendingMoves.slice(0, -1),
                      error:
                        moveResultPayload.error ||
                        "Move was rejected by server",
                    });
                  } else {
                    set({ error: moveResultPayload.error || "Invalid move" });
                  }
                }
                break;
              }

              case "GAME_OVER": {
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
              }

              case "ERROR":
                set({ error: (message.payload as ErrorPayload).message });
                break;

              default:
                console.warn("Unhandled server message:", message);
            }
          },
        }),
        {
          name: "super-tic-tac-toe-store",
        }
      )
    : (set, get) => ({
        // Initial state
        gameState: null,
        moves: [],
        pendingMoves: [],
        moveSequenceNumber: 0,
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

          // For online games, apply optimistic update then send to server
          if (gameMode === "online" && websocket) {
            // Check if it's our turn
            if (gameState.currentPlayer !== playerSymbol) {
              set({ error: "Not your turn" });
              return;
            }

            // Create the move for validation and optimistic update
            const move = createMove(boardIndex, cellIndex, playerSymbol);
            const result = applyMove(gameState, move);

            // Validate move locally first
            if (!result.valid) {
              set({ error: result.error || "Invalid move" });
              return;
            }

            // Apply optimistic update immediately for instant feedback
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

            // Update state with optimistic move
            console.log("Adding own move to log (optimistic):", gameMove);
            set({
              gameState: result.newGameState,
              moves: [...moves, gameMove],
              pendingMoves: [...pendingMoves, pendingMove],
              moveSequenceNumber: moveSequenceNumber + 1,
              error: null,
            });

            // Send move to server for authoritative validation
            const success = websocket.makeMove(
              boardIndex,
              cellIndex,
              moveSequenceNumber + 1
            );
            if (!success) {
              // If network fails, we need to rollback the optimistic update
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

          // Local game logic
          const move = createMove(
            boardIndex,
            cellIndex,
            gameState.currentPlayer
          );
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
            case "GAME_STATE": {
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

              // Convert StoredMove[] to GameMove[] for consistency (backward compatible)
              const gameMoves: GameMove[] = (gameStatePayload.moves || []).map(
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
                pendingMoves: [], // Reset pending moves for new game state
                playerSymbol: gameStatePayload.yourSymbol, // Update player symbol from server
                opponentConnected: gameStatePayload.opponentConnected,
                error: null,
              });

              break;
            }

            case "MOVE_RESULT": {
              const moveResultPayload = message.payload as MoveResultPayload;
              const { pendingMoves, moves } = get();

              if (moveResultPayload.valid) {
                // Server confirmed the move - remove from pending moves
                const updatedPendingMoves = pendingMoves.slice(0, -1); // Remove the last pending move

                // Update game state with authoritative server result
                const updatedGameState: GameState = {
                  gameId: get().gameId || "",
                  board: moveResultPayload.board,
                  currentPlayer: moveResultPayload.currentPlayer,
                  status: moveResultPayload.gameStatus,
                  winner: null, // Will be updated by GAME_OVER if needed
                  createdAt: get().gameState?.createdAt || Date.now(),
                  lastMove: Date.now(),
                };

                // Process the move for logging (ensures both players see all moves)
                let updatedMoves = moves;
                if (moveResultPayload.move) {
                  // Convert StoredMove to GameMove format
                  const gameMove: GameMove = {
                    notation: moveResultPayload.move.notation,
                    player: moveResultPayload.move.player,
                    moveNumber: moveResultPayload.move.moveNumber,
                    timestamp: moveResultPayload.move.timestamp,
                  };

                  // Check if this move is already in our log (from optimistic update)
                  const moveExists = moves.some(
                    (m) =>
                      m.moveNumber === gameMove.moveNumber &&
                      m.player === gameMove.player &&
                      m.notation === gameMove.notation
                  );

                  if (!moveExists) {
                    // This is an opponent's move, add it to our log
                    updatedMoves = [...moves, gameMove];
                    console.log("Added opponent move to log:", gameMove);
                  } else {
                    console.log(
                      "Move already in log (own move confirmed):",
                      gameMove
                    );
                  }
                }

                // The move was already optimistically applied, just confirm it
                set({
                  gameState: updatedGameState,
                  moves: updatedMoves,
                  pendingMoves: updatedPendingMoves,
                  error: null,
                });
              } else {
                // Server rejected the move - rollback optimistic update
                if (pendingMoves.length > 0) {
                  // Get the current state without pending moves
                  const { moves } = get();

                  // Remove the last optimistic move
                  const rolledBackMoves = moves.slice(0, -1);

                  // We need to reconstruct the game state without the failed move
                  // For now, request fresh state from server by clearing error
                  // The server will send updated GAME_STATE
                  set({
                    moves: rolledBackMoves,
                    pendingMoves: pendingMoves.slice(0, -1),
                    error:
                      moveResultPayload.error || "Move was rejected by server",
                  });
                } else {
                  set({ error: moveResultPayload.error || "Invalid move" });
                }
              }
              break;
            }

            case "GAME_OVER": {
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
            }

            case "ERROR":
              set({ error: (message.payload as ErrorPayload).message });
              break;

            default:
              console.warn("Unhandled server message:", message);
          }
        },
      })
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

import React, { useEffect, useState } from "react";
import { GameBoard } from "./GameBoard";
import { Instructions } from "./Instructions";
import { MoveLog } from "./MoveLog";
import { ConnectionStatus } from "./ConnectionStatus";
import {
  useGameState,
  useGameError,
  useGameMoves,
  useStartNewGame,
  useMakeMove,
  useResetCurrentGame,
  useClearError,
  useGameMode,
  useConnectionStatus,
  usePlayerSymbol,
  useOpponentConnected,
  useDisconnectFromGame,
  useFindOnlineGame,
} from "../store/gameStore";

export const GameScreen: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const gameState = useGameState();
  const error = useGameError();
  const moves = useGameMoves();

  const startNewGame = useStartNewGame();
  const makeMove = useMakeMove();
  const resetCurrentGame = useResetCurrentGame();
  const clearError = useClearError();

  // Online multiplayer state
  const gameMode = useGameMode();
  const connectionStatus = useConnectionStatus();
  const playerSymbol = usePlayerSymbol();
  const opponentConnected = useOpponentConnected();
  const disconnectFromGame = useDisconnectFromGame();
  const findOnlineGame = useFindOnlineGame();

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (!gameState) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Starting new game...</p>
        </div>
      </div>
    );
  }

  const handleDisconnect = () => {
    if (gameMode === "online") {
      disconnectFromGame();
    } else {
      resetCurrentGame();
    }
  };

  const handleNewGame = () => {
    if (gameMode === "online") {
      // For online games, disconnect and find a new match
      disconnectFromGame();
      // Small delay to ensure cleanup, then find new game
      setTimeout(() => {
        findOnlineGame();
      }, 100);
    } else {
      // For local games, just reset the current game
      resetCurrentGame();
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-2 md:py-4">
        {/* Mobile header row */}
        <div className="flex items-center justify-between md:hidden">
          <div className="flex items-center">
            <button
              aria-label="Open menu"
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 text-gray-700 hover:text-gray-900"
            >
              ☰
            </button>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Super Tic-Tac-Toe {gameMode === "online" && "- Online"}
          </h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleNewGame}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              {gameMode === "online" ? "New Match" : "New Game"}
            </button>
          </div>
        </div>

        {/* Desktop header title */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            Super Tic-Tac-Toe {gameMode === "online" && "- Online"}
          </h1>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-center">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Mobile inline status */}
        {gameMode === "online" && (
          <div className="md:hidden mt-2 flex items-center justify-between text-sm text-gray-700">
            <div className="flex items-center space-x-2">
              <span>
                {connectionStatus === "connected"
                  ? "🟢 Connected"
                  : connectionStatus === "connecting"
                  ? "🟡 Connecting..."
                  : connectionStatus === "error"
                  ? "🔴 Error"
                  : "⚪ Disconnected"}
              </span>
              {playerSymbol && (
                <span className="flex items-center space-x-1">
                  <span>You:</span>
                  <span className="font-bold">{playerSymbol}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <span>Opponent:</span>
              <span
                className={
                  opponentConnected ? "text-green-600" : "text-red-600"
                }
              >
                {opponentConnected ? "🟢 Online" : "🔴 Offline"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Connection Status for Online Games (desktop) */}
      {gameMode === "online" && (
        <div className="hidden md:block">
          <ConnectionStatus
            status={connectionStatus}
            opponentConnected={opponentConnected}
            playerSymbol={playerSymbol}
          />
        </div>
      )}

      {/* Main game area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Instructions (desktop only) */}
        <div className="hidden md:block w-80 bg-white border-r border-gray-200">
          <Instructions onNewGame={handleNewGame} />
        </div>

        {/* Center - Game board */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-y-auto">
          <div className="flex flex-col items-center space-y-4 md:space-y-6 w-full">
            <GameBoard gameState={gameState} onMove={makeMove} />

            {/* Game controls (desktop only) */}
            <div className="hidden md:flex space-x-4">
              <button
                onClick={handleNewGame}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {gameMode === "online" ? "Find New Match" : "New Game"}
              </button>

              {gameMode === "online" && (
                <button
                  onClick={handleDisconnect}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  Leave Game
                </button>
              )}

              {gameState.status === "finished" && gameMode === "local" && (
                <button
                  onClick={startNewGame}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Play Again
                </button>
              )}

              {gameState.status === "finished" && gameMode === "online" && (
                <button
                  onClick={disconnectFromGame}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Back to Menu
                </button>
              )}
            </div>

            {/* Move log under board (mobile only) */}
            <div className="w-full md:hidden bg-white rounded-lg shadow border border-gray-200">
              <MoveLog
                moves={moves}
                currentPlayer={gameState.currentPlayer}
                isGameActive={gameState.status === "playing"}
                variant="compact"
                order="desc"
                maxHeightClass="max-h-64"
              />
            </div>
          </div>
        </div>

        {/* Right sidebar - Move log (desktop only) */}
        <div className="hidden md:block w-80 bg-white border-l border-gray-200">
          <MoveLog
            moves={moves}
            currentPlayer={gameState.currentPlayer}
            isGameActive={gameState.status === "playing"}
            order="asc"
          />
        </div>
      </div>

      {/* Mobile slide-over for Instructions */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-xl transform transition-transform duration-200 ease-out">
            <Instructions
              onNewGame={handleNewGame}
              showHeaderClose
              onClose={() => setIsMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

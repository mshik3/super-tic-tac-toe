import React, { useEffect } from "react";
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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          Super Tic-Tac-Toe {gameMode === "online" && "- Online"}
        </h1>

        {/* Error display */}
        {error && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-center">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* Connection Status for Online Games */}
      {gameMode === "online" && (
        <ConnectionStatus
          status={connectionStatus}
          opponentConnected={opponentConnected}
          playerSymbol={playerSymbol}
        />
      )}

      {/* Main game area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Instructions */}
        <div className="w-80 bg-white border-r border-gray-200">
          <Instructions onNewGame={handleNewGame} />
        </div>

        {/* Center - Game board */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-6">
            <GameBoard gameState={gameState} onMove={makeMove} />

            {/* Game controls */}
            <div className="flex space-x-4">
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
          </div>
        </div>

        {/* Right sidebar - Move log */}
        <div className="w-80 bg-white border-l border-gray-200">
          <MoveLog
            moves={moves}
            currentPlayer={gameState.currentPlayer}
            isGameActive={gameState.status === "playing"}
          />
        </div>
      </div>
    </div>
  );
};

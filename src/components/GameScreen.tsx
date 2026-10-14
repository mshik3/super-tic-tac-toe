import React, { useEffect, useState } from "react";
import { GameBoard } from "./GameBoard";
import { Instructions } from "./Instructions";
import { MoveLog } from "./MoveLog";
import {
  useGameState,
  useGameError,
  useGameMoves,
  useMakeMove,
  useResetCurrentGame,
  useClearError,
  useGameMode,
  useConnectionStatus,
  usePlayerSymbol,
  useOpponentConnected,
  useOpponentNickname,
  useGameOverReason,
  usePlayerNickname,
  useDisconnectFromGame,
  useFindOnlineGame,
  useTurnDeadline,
  useScore,
  useForfeitDeadline,
  useRematch,
  useRequestRematch,
} from "../store/gameStore";

export const GameScreen: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const gameState = useGameState();
  const error = useGameError();
  const moves = useGameMoves();

  const makeMove = useMakeMove();
  const resetCurrentGame = useResetCurrentGame();
  const clearError = useClearError();

  const gameMode = useGameMode();
  const connectionStatus = useConnectionStatus();
  const playerSymbol = usePlayerSymbol();
  const opponentConnected = useOpponentConnected();
  const opponentNickname = useOpponentNickname();
  const gameOverReason = useGameOverReason();
  const playerNickname = usePlayerNickname();
  const disconnectFromGame = useDisconnectFromGame();
  const findOnlineGame = useFindOnlineGame();
  const score = useScore();
  const rematch = useRematch();
  const requestRematch = useRequestRematch();

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 3000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (!gameState) {
    return <p className="p-6 text-center text-muted">Loading…</p>;
  }

  const isOnline = gameMode === "online";
  const isMyTurn =
    !isOnline ||
    (gameState.status === "playing" &&
      gameState.currentPlayer === playerSymbol);

  const xName = isOnline
    ? playerSymbol === "X"
      ? playerNickname ?? "You"
      : opponentNickname ?? "Opponent"
    : "Player X";

  const oName = isOnline
    ? playerSymbol === "O"
      ? playerNickname ?? "You"
      : opponentNickname ?? "Opponent"
    : "Player O";

  const xIsMe = isOnline && playerSymbol === "X";
  const oIsMe = isOnline && playerSymbol === "O";
  const xWins = xIsMe ? score.you : score.opponent;
  const oWins = xIsMe ? score.opponent : score.you;

  const confirmLeave = () =>
    !isOnline ||
    gameState.status !== "playing" ||
    window.confirm("Leave this game? It counts as a forfeit.");

  const handleDisconnect = () => {
    if (confirmLeave()) disconnectFromGame();
  };

  const handleNewGame = () => {
    if (!isOnline) return resetCurrentGame();
    if (!confirmLeave()) return;
    disconnectFromGame();
    setTimeout(() => findOnlineGame(), 100);
  };

  const isFinished = gameState.status === "finished";
  const winner = gameState.winner;

  const winnerName =
    winner === "draw"
      ? null
      : winner === "X"
        ? xName
        : oName;

  const iWon =
    isOnline && winner !== "draw" && winner !== null && winner === playerSymbol;
  const iLost =
    isOnline && winner !== "draw" && winner !== null && winner !== playerSymbol;

  const resultText =
    winner === "draw"
      ? "Draw"
      : iWon
        ? "You win"
        : iLost
          ? "You lose"
          : `${winnerName} wins`;

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 bg-panel border-b border-line">
        <div className="flex items-stretch">
          <PlayerCard
            symbol="X"
            name={xName}
            isActive={gameState.status === "playing" && gameState.currentPlayer === "X"}
            isMe={xIsMe}
            isOnline={isOnline}
            connected={xIsMe ? connectionStatus === "connected" : opponentConnected}
            side="left"
          />
          <div className="shrink-0 flex flex-col items-center justify-center px-3 md:px-6 border-x border-line bg-strip font-mono">
            <span className="text-sm font-bold" aria-label="Series score">
              {isOnline ? `${xWins}–${oWins}` : "vs"}
            </span>
            {isOnline && !isFinished && <TurnClock />}
          </div>
          <PlayerCard
            symbol="O"
            name={oName}
            isActive={gameState.status === "playing" && gameState.currentPlayer === "O"}
            isMe={oIsMe}
            isOnline={isOnline}
            connected={oIsMe ? connectionStatus === "connected" : opponentConnected}
            side="right"
          />
        </div>

        {isOnline && !isFinished && !opponentConnected && gameState.status === "playing" && (
          <div className="px-3 py-1.5 text-center text-xs bg-warn-soft border-t border-warn-line text-warn">
            <ForfeitCountdown />
          </div>
        )}

        {error && (
          <div role="alert" className="px-3 py-1.5 text-center text-xs bg-o-soft border-t border-o text-o">
            {error}
          </div>
        )}

        {isFinished && (
          <div className="px-3 py-2 border-t border-line bg-strip flex items-center justify-center gap-x-4 gap-y-2 flex-wrap">
            <p className="text-base font-bold">
              <span className={winner === "X" ? "text-x" : winner === "O" ? "text-o" : ""}>
                {resultText}
              </span>
              {(gameOverReason === "forfeit" || gameOverReason === "timeout") && (
                <span className="ml-2 text-xs font-normal text-muted">
                  {gameOverReason === "forfeit" ? "by forfeit" : "on time"}
                </span>
              )}
            </p>

            <div className="flex gap-2 flex-wrap justify-center">
              {isOnline ? (
                <>
                  <button
                    onClick={requestRematch}
                    disabled={!opponentConnected || rematch.you}
                    className={`btn-primary ${rematch.opponent && !rematch.you ? "animate-pulse" : ""}`}
                  >
                    {!opponentConnected
                      ? "Opponent left"
                      : rematch.you
                        ? "Waiting for opponent…"
                        : rematch.opponent
                          ? "Accept rematch"
                          : "Rematch"}
                  </button>
                  <button onClick={handleNewGame} className="btn">
                    New opponent
                  </button>
                </>
              ) : (
                <button onClick={handleNewGame} className="btn-primary">
                  Play again
                </button>
              )}
              <button onClick={disconnectFromGame} className="btn">
                Menu
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex min-h-0 gap-3 p-3">
        <aside className="hidden md:block w-64 shrink-0 panel overflow-hidden">
          <Instructions />
        </aside>

        <div className="flex-1 flex overflow-y-auto">
          {/* m-auto, not items-center: centering would clip the top when content overflows */}
          <div className="m-auto flex flex-col items-center gap-3 w-full">
            <GameBoard
              gameState={gameState}
              onMove={makeMove}
              disabled={!isMyTurn || isFinished}
              currentPlayer={gameState.currentPlayer}
            />

            <div className="flex md:hidden items-center gap-2">
              <button onClick={() => setIsMenuOpen(true)} className="btn">
                Rules
              </button>
              <button onClick={handleNewGame} className="btn">
                {isOnline ? "New opponent" : "New game"}
              </button>
              <button onClick={handleDisconnect} className="btn">
                {isOnline ? "Leave" : "Menu"}
              </button>
            </div>

            <div className="w-full md:hidden panel overflow-hidden">
              <MoveLog
                moves={moves}
                currentPlayer={gameState.currentPlayer}
                isGameActive={gameState.status === "playing"}
                order="desc"
                heightClass="h-48"
              />
            </div>
          </div>
        </div>

        <aside className="hidden md:flex w-64 shrink-0 flex-col panel overflow-hidden">
          <MoveLog
            moves={moves}
            currentPlayer={gameState.currentPlayer}
            isGameActive={gameState.status === "playing"}
            autoScroll
          />
          <div className="p-3 border-t border-line flex flex-col gap-2">
            <button onClick={handleNewGame} className="btn">
              {isOnline ? "New opponent" : "New game"}
            </button>
            <button onClick={handleDisconnect} className="btn">
              {isOnline ? "Leave" : "Menu"}
            </button>
          </div>
        </aside>
      </div>

      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] border-r border-line-strong">
            <Instructions showHeaderClose onClose={() => setIsMenuOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

interface PlayerCardProps {
  symbol: "X" | "O";
  name: string;
  isActive: boolean;
  isMe: boolean;
  isOnline: boolean;
  connected: boolean | undefined;
  side: "left" | "right";
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  symbol,
  name,
  isActive,
  isMe,
  isOnline,
  connected,
  side,
}) => {
  const isX = symbol === "X";
  return (
    <div
      className={`flex-1 min-w-0 flex items-center gap-2 px-3 py-2 border-b-2 ${
        side === "right" ? "flex-row-reverse text-right" : ""
      } ${isActive ? (isX ? "bg-x-soft border-x" : "bg-o-soft border-o") : "border-transparent"}`}
    >
      <span
        className={`shrink-0 w-8 h-8 flex items-center justify-center rounded border bg-well text-lg font-bold ${
          isX ? "text-x border-x/50" : "text-o border-o/50"
        }`}
      >
        {symbol}
      </span>
      <div className={`min-w-0 flex flex-col ${side === "right" ? "items-end" : "items-start"}`}>
        <span className="flex items-center gap-1.5 max-w-full">
          {isOnline && (
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                connected === true ? "bg-ok" : connected === false ? "bg-o" : "bg-line"
              }`}
              title={connected ? "Connected" : "Disconnected"}
            />
          )}
          <span className="font-bold truncate">{name}</span>
          {isMe && isOnline && <span className="text-xs text-muted">(you)</span>}
        </span>
        <span className="text-xs text-muted">{isActive ? "to move" : " "}</span>
      </div>
    </div>
  );
};

function useSecondsLeft(deadline: number | null) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

const ForfeitCountdown: React.FC = () => {
  const secondsLeft = useSecondsLeft(useForfeitDeadline());
  return (
    <span role="timer">
      Your opponent dropped.{" "}
      {secondsLeft === null
        ? "Waiting for them to come back…"
        : `They have ${secondsLeft}s to come back or they forfeit.`}
    </span>
  );
};

const TurnClock: React.FC = () => {
  const secondsLeft = useSecondsLeft(useTurnDeadline());
  if (secondsLeft === null) return null;

  return (
    <span
      className={`text-xs tabular-nums ${secondsLeft <= 15 ? "text-o font-bold" : "text-muted"}`}
      role="timer"
      aria-label={`${secondsLeft} seconds left for this turn`}
    >
      {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
    </span>
  );
};

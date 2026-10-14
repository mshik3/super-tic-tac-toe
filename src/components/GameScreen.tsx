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
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--x)" }}
          />
          <p
            className="text-sm font-medium tracking-widest uppercase"
            style={{ color: "var(--text-dim)" }}
          >
            Loading…
          </p>
        </div>
      </div>
    );
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

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {/* ── Top Player HUD ─────────────────────────────────── */}
      <div
        className="shrink-0 border-b"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* Player vs Player bar */}
        <div className="flex items-stretch">
          {/* X player card */}
          <PlayerCard
            symbol="X"
            name={xName}
            isActive={gameState.status === "playing" && gameState.currentPlayer === "X"}
            isMe={xIsMe}
            isOnline={isOnline}
            connected={xIsMe ? connectionStatus === "connected" : opponentConnected}
            side="left"
          />

          {/* VS divider */}
          <div
            className="flex flex-col items-center justify-center px-3 md:px-6 shrink-0"
            style={{ backgroundColor: "var(--bg)" }}
          >
            <span
              className="text-xs font-bold tracking-widest"
              style={{ color: "var(--text-dim)" }}
            >
              {isOnline ? `${xWins} – ${oWins}` : "VS"}
            </span>
            {isOnline && !isFinished && <TurnClock />}
          </div>

          {/* O player card */}
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
          <div
            className="px-4 py-2 text-center text-sm font-medium"
            style={{
              backgroundColor: "rgba(245, 192, 48, 0.08)",
              borderTop: "1px solid rgba(245, 192, 48, 0.2)",
              color: "#F0B500",
            }}
          >
            <ForfeitCountdown />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="px-4 py-2 text-center text-sm font-medium"
            style={{
              backgroundColor: "rgba(248, 113, 113, 0.1)",
              borderTop: "1px solid rgba(248, 113, 113, 0.3)",
              color: "var(--o)",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* ── Game Over Banner ───────────────────────────────── */}
      {isFinished && (
        <div
          className="shrink-0 py-3 px-4 text-center animate-slide-up border-b"
          style={{
            backgroundColor:
              winner === "draw"
                ? "rgba(77, 96, 128, 0.15)"
                : winner === "X"
                  ? "rgba(34, 211, 238, 0.1)"
                  : "rgba(248, 113, 113, 0.1)",
            borderColor:
              winner === "draw"
                ? "var(--border)"
                : winner === "X"
                  ? "rgba(34, 211, 238, 0.35)"
                  : "rgba(248, 113, 113, 0.35)",
          }}
        >
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div>
              {winner === "draw" ? (
                <span
                  className="text-lg md:text-xl font-bold tracking-wide"
                  style={{ color: "var(--text)" }}
                >
                  DRAW
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="text-2xl md:text-3xl font-bold"
                    style={{
                      color: winner === "X" ? "var(--x)" : "var(--o)",
                      textShadow:
                        winner === "X"
                          ? "0 0 20px rgba(0,204,255,0.5)"
                          : "0 0 20px rgba(255,68,68,0.5)",
                    }}
                  >
                    {winner}
                  </span>
                  <span
                    className="text-lg md:text-xl font-bold tracking-wide"
                    style={{ color: "var(--text)" }}
                  >
                    {isOnline
                      ? iWon
                        ? "YOU WIN"
                        : iLost
                          ? "YOU LOSE"
                          : `${winnerName} WINS`
                      : `${winnerName} WINS`}
                    {(gameOverReason === "forfeit" || gameOverReason === "timeout") && (
                      <span
                        className="ml-2 text-xs font-medium tracking-wide normal-case"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {gameOverReason === "forfeit" ? "by forfeit" : "on time"}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              {isOnline ? (
                <button
                  onClick={requestRematch}
                  disabled={!opponentConnected || rematch.you}
                  className={`px-4 py-1.5 rounded text-sm font-bold tracking-wider uppercase transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                    rematch.opponent && !rematch.you ? "animate-pulse" : ""
                  }`}
                  style={{
                    backgroundColor: "var(--x)",
                    color: "var(--bg)",
                    border: "1px solid var(--border-2)",
                  }}
                >
                  {!opponentConnected
                    ? "Opponent left"
                    : rematch.you
                      ? "Waiting for opponent…"
                      : rematch.opponent
                        ? "Accept rematch"
                        : "Rematch"}
                </button>
              ) : (
                <button
                  onClick={handleNewGame}
                  className="px-4 py-1.5 rounded text-sm font-bold tracking-wider uppercase transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    color: "var(--text)",
                    border: "1px solid var(--border-2)",
                  }}
                >
                  Play Again
                </button>
              )}

              {isOnline && (
                <button
                  onClick={handleNewGame}
                  className="px-4 py-1.5 rounded text-sm font-semibold tracking-wide uppercase transition-opacity hover:opacity-70"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border)",
                  }}
                >
                  New opponent
                </button>
              )}

              <button
                onClick={disconnectFromGame}
                className="px-4 py-1.5 rounded text-sm font-semibold tracking-wide uppercase transition-opacity hover:opacity-70"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text-dim)",
                  border: "1px solid var(--border)",
                }}
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — Instructions (desktop) */}
        <div
          className="hidden md:block w-72 border-r shrink-0 overflow-y-auto"
          style={{ borderColor: "var(--border)" }}
        >
          <Instructions />
        </div>

        {/* Center — Board */}
        <div className="flex-1 flex p-3 md:p-6 overflow-y-auto">
          {/* m-auto, not items-center: centering would clip the top when content overflows */}
          <div className="m-auto flex flex-col items-center gap-3 w-full">
            <GameBoard
              gameState={gameState}
              onMove={makeMove}
              disabled={!isMyTurn || isFinished}
              currentPlayer={gameState.currentPlayer}
            />

            {/* Mobile controls */}
            <div className="flex md:hidden items-center gap-2 mt-1">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="px-3 py-1.5 rounded text-xs font-semibold tracking-wide uppercase"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text-dim)",
                  border: "1px solid var(--border)",
                }}
              >
                Rules
              </button>
              <button
                onClick={handleNewGame}
                className="px-3 py-1.5 rounded text-xs font-bold tracking-wide uppercase"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border-2)",
                }}
              >
                {isOnline ? "New Opponent" : "New Game"}
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded text-xs font-semibold tracking-wide uppercase"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: "var(--text-dim)",
                  border: "1px solid var(--border)",
                }}
              >
                {isOnline ? "Leave" : "Menu"}
              </button>
            </div>

            {/* Mobile — move log */}
            <div
              className="w-full md:hidden rounded border"
              style={{ borderColor: "var(--border)" }}
            >
              <MoveLog
                moves={moves}
                currentPlayer={gameState.currentPlayer}
                isGameActive={gameState.status === "playing"}
                order="desc"
                heightClass="h-48"
                autoScroll={false}
              />
            </div>
          </div>
        </div>

        {/* Right — Move log (desktop) */}
        <div
          className="hidden md:flex w-72 border-l shrink-0 flex-col"
          style={{ borderColor: "var(--border)" }}
        >
          <MoveLog
            moves={moves}
            currentPlayer={gameState.currentPlayer}
            isGameActive={gameState.status === "playing"}
            order="asc"
            autoScroll
          />

          {/* Desktop action buttons */}
          <div
            className="p-4 border-t space-y-2"
            style={{ borderColor: "var(--border)" }}
          >
            <button
              onClick={handleNewGame}
              className="w-full py-2 rounded font-bold text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "rgba(0,204,255,0.12)",
                color: "var(--x)",
                border: "1px solid rgba(0,204,255,0.3)",
              }}
            >
              {isOnline ? "New Opponent" : "New Game"}
            </button>

            <button
              onClick={handleDisconnect}
              className="w-full py-2 rounded font-semibold text-sm tracking-wide uppercase transition-opacity hover:opacity-70"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--text-dim)",
                border: "1px solid var(--border)",
              }}
            >
              {isOnline ? "Leave Game" : "Menu"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile slide-over for Instructions */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(8,12,20,0.7)" }}
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-2xl"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <Instructions
              showHeaderClose
              onClose={() => setIsMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Player Card Component ─────────────────────────────────────

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
  const color = isX ? "var(--x)" : "var(--o)";
  const dimColor = isX
    ? "rgba(34, 211, 238, 0.07)"
    : "rgba(248, 113, 113, 0.07)";
  const activeColor = isX
    ? "rgba(34, 211, 238, 0.13)"
    : "rgba(248, 113, 113, 0.13)";
  const borderActive = isX
    ? "rgba(34, 211, 238, 0.45)"
    : "rgba(248, 113, 113, 0.45)";

  return (
    <div
      className={`flex-1 flex items-center gap-3 px-3 md:px-5 py-2.5 transition-all duration-300 ${side === "right" ? "flex-row-reverse" : ""}`}
      style={{
        backgroundColor: isActive ? activeColor : dimColor,
        borderBottom: isActive ? `2px solid ${borderActive}` : "2px solid transparent",
      }}
    >
      {/* Symbol badge */}
      <div
        className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded flex items-center justify-center font-bold text-xl select-none"
        style={{
          backgroundColor: isActive ? `${color}22` : "var(--surface-2)",
          color: isActive ? color : "var(--text-dim)",
          border: `1px solid ${isActive ? `${color}55` : "var(--border)"}`,
          boxShadow: isActive ? `0 0 12px ${isX ? "rgba(34,211,238,0.25)" : "rgba(248,113,113,0.25)"}` : "none",
        }}
      >
        {symbol}
      </div>

      {/* Name + status */}
      <div className={`min-w-0 flex flex-col ${side === "right" ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-1.5">
          {/* Online connection dot */}
          {isOnline && (
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                backgroundColor:
                  connected === true
                    ? "#22c55e"
                    : connected === false
                      ? "#ef4444"
                      : "var(--text-dim)",
              }}
            />
          )}
          <span
            className="font-bold text-sm md:text-base tracking-wide truncate max-w-[100px] md:max-w-[160px]"
            style={{ color: isActive ? "var(--text)" : "var(--text-dim)" }}
          >
            {name}
          </span>
          {isMe && isOnline && (
            <span
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: "var(--text-dim)", fontSize: "0.6rem" }}
            >
              you
            </span>
          )}
        </div>

        {isActive && (
          <span
            className="text-xs font-bold tracking-widest uppercase animate-blink"
            style={{ color, fontSize: "0.6rem" }}
          >
            ▸ Your Turn
          </span>
        )}
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
      Opponent disconnected.{" "}
      {secondsLeft === null
        ? "Waiting for them to return…"
        : `They forfeit in ${secondsLeft}s unless they return.`}
    </span>
  );
};

const TurnClock: React.FC = () => {
  const secondsLeft = useSecondsLeft(useTurnDeadline());
  if (secondsLeft === null) return null;
  const low = secondsLeft <= 15;

  return (
    <span
      className="text-xs font-bold tabular-nums mt-1"
      style={{ color: low ? "#ef4444" : "var(--text-dim)" }}
      role="timer"
      aria-label={`${secondsLeft} seconds left for this turn`}
    >
      {secondsLeft}s
    </span>
  );
};

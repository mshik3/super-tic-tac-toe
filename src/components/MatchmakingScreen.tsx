import React, { useEffect, useMemo, useRef, useState } from "react";
import { GameAPIClient } from "../lib/websocket";

export interface MatchmakingScreenProps {
  playerId: string;
  playerNickname?: string;
  onGameFound: (
    gameId: string,
    playerSymbol: "X" | "O",
    connectToken: string
  ) => void;
  onCancel: () => void;
}

export const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({
  playerId,
  playerNickname,
  onGameFound,
  onCancel,
}) => {
  const [status, setStatus] = useState<"searching" | "error">("searching");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(null);
  const [playersInQueue, setPlayersInQueue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backoffDelayRef = useRef(1000);
  const consecutiveFailuresRef = useRef(0);
  const isCircuitBreakerOpenRef = useRef(false);

  const apiClient = useMemo(() => new GameAPIClient(), []);

  useEffect(() => {
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | undefined;
    let countdownInterval: ReturnType<typeof setInterval> | undefined;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      if (pollInterval !== undefined) clearInterval(pollInterval);
      if (countdownInterval !== undefined) clearInterval(countdownInterval);
      if (retryTimeout !== undefined) clearTimeout(retryTimeout);
    };

    const startPolling = () => {
      pollInterval = setInterval(async () => {
        if (cancelled) { clearTimers(); return; }
        if (isCircuitBreakerOpenRef.current) {
          clearInterval(pollInterval!);
          setStatus("error");
          setError("Too many connection failures. Please try again later.");
          return;
        }

        try {
          const joinResult = await apiClient.joinQueue(playerId, playerNickname);
          if (cancelled) return;

          if (joinResult.matched) {
            clearTimers();
            onGameFound(joinResult.gameId, joinResult.yourSymbol, joinResult.connectToken);
            return;
          }

          setQueuePosition(joinResult.position);
          setEstimatedWaitTime(joinResult.estimatedWaitTime);
          setPlayersInQueue(joinResult.playersInQueue);
          consecutiveFailuresRef.current = 0;
          setError(null);
        } catch (err) {
          if (cancelled) return;
          consecutiveFailuresRef.current += 1;
          const failures = consecutiveFailuresRef.current;

          if (failures >= 5) {
            isCircuitBreakerOpenRef.current = true;
            clearInterval(pollInterval!);
            setStatus("error");
            setError("Too many connection failures. Please refresh and try again.");
            return;
          }

          if (err instanceof Error && err.message.includes("Too many requests")) {
            backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 60000);
            const delaySecs = Math.ceil(backoffDelayRef.current / 1000);
            setError(`Rate limited. Retrying in ${delaySecs}s…`);

            let remaining = delaySecs;
            countdownInterval = setInterval(() => {
              remaining -= 1;
              if (remaining <= 0) {
                clearInterval(countdownInterval!);
                setError(null);
              } else {
                setError(`Rate limited. Retrying in ${remaining}s…`);
              }
            }, 1000);

            clearInterval(pollInterval!);
            retryTimeout = setTimeout(() => {
              if (!cancelled && !isCircuitBreakerOpenRef.current) startPolling();
            }, backoffDelayRef.current);
          } else {
            setError(`Connection error (${failures}/5). Retrying…`);
          }
        }
      }, Math.max(backoffDelayRef.current, 500));
    };

    const searchForGame = async () => {
      try {
        setStatus("searching");
        setError(null);
        const result = await apiClient.joinQueue(playerId, playerNickname);
        if (cancelled) return;

        if (result.matched) {
          onGameFound(result.gameId, result.yourSymbol, result.connectToken);
          return;
        }

        setQueuePosition(result.position);
        setEstimatedWaitTime(result.estimatedWaitTime);
        setPlayersInQueue(result.playersInQueue);
        startPolling();
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Failed to join queue");
        }
      }
    };

    searchForGame();
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [playerId, playerNickname, onGameFound, apiClient]);

  const handleCancel = async () => {
    try {
      await apiClient.leaveQueue(playerId);
    } catch {
      // best-effort
    }
    onCancel();
  };

  const formatWaitTime = (seconds: number | null): string => {
    if (seconds === null) return "—";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.round(seconds / 60)}m`;
  };

  return (
    <div
      className="h-screen flex items-center justify-center bg-grid"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-xl border overflow-hidden animate-fade-in"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border-2)",
        }}
      >
        {/* Header strip */}
        <div
          className="px-6 pt-6 pb-4 text-center border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <p
            className="text-xs font-bold tracking-widest uppercase mb-1"
            style={{ color: "var(--text-dim)" }}
          >
            Online
          </p>
          <h2
            className="text-2xl font-bold tracking-wide"
            style={{ color: "var(--text)" }}
          >
            {status === "searching" ? "Finding Opponent" : "Connection Error"}
          </h2>
          {playerNickname && (
            <p
              className="text-sm font-medium mt-1"
              style={{ color: "var(--text-dim)" }}
            >
              Playing as{" "}
              <span style={{ color: "var(--x)" }}>{playerNickname}</span>
            </p>
          )}
        </div>

        {/* Radar / content area */}
        <div className="px-6 py-8">
          {status === "searching" && (
            <div className="flex flex-col items-center gap-8">
              {/* Radar animation */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Pulsing rings */}
                <div
                  className="absolute inset-0 rounded-full animate-pulse-ring"
                  style={{ border: "1px solid rgba(34,211,238,0.3)" }}
                />
                <div
                  className="absolute inset-2 rounded-full animate-pulse-ring"
                  style={{
                    border: "1px solid rgba(34,211,238,0.2)",
                    animationDelay: "0.6s",
                  }}
                />
                <div
                  className="absolute inset-4 rounded-full animate-pulse-ring"
                  style={{
                    border: "1px solid rgba(34,211,238,0.15)",
                    animationDelay: "1.2s",
                  }}
                />
                {/* Sweep line */}
                <div
                  className="absolute inset-0 rounded-full overflow-hidden animate-radar-rotate"
                  style={{ border: "1px solid rgba(34,211,238,0.1)" }}
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, rgba(34,211,238,0.3) 0deg, transparent 60deg)",
                    }}
                  />
                </div>
                {/* Center dot */}
                <div
                  className="w-3 h-3 rounded-full z-10"
                  style={{
                    backgroundColor: "var(--x)",
                    boxShadow: "0 0 10px var(--x)",
                  }}
                />
              </div>

              {/* Stats */}
              <div className="w-full grid grid-cols-2 gap-3">
                <StatBox
                  label="Queue Position"
                  value={queuePosition !== null ? `#${queuePosition}` : "—"}
                />
                <StatBox
                  label="Est. Wait"
                  value={formatWaitTime(estimatedWaitTime)}
                />
              </div>

              {playersInQueue !== null && (
                <p
                  className="text-xs font-medium tracking-wide"
                  style={{ color: "var(--text-dim)" }}
                >
                  {playersInQueue}{" "}
                  {playersInQueue === 1 ? "player" : "players"} in queue
                </p>
              )}

              {error && (
                <div
                  className="w-full rounded px-3 py-2 text-xs font-medium text-center"
                  style={{
                    backgroundColor: "rgba(245, 192, 48, 0.08)",
                    border: "1px solid rgba(245, 192, 48, 0.2)",
                    color: "#F0B500",
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <div
                className="text-5xl font-bold"
                style={{ color: "var(--o)", opacity: 0.4 }}
              >
                !
              </div>
              <div
                className="w-full rounded px-4 py-3 text-sm font-medium text-center"
                style={{
                  backgroundColor: "rgba(255, 68, 68, 0.08)",
                  border: "1px solid rgba(255, 68, 68, 0.25)",
                  color: "var(--o)",
                }}
              >
                {error}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 rounded font-bold text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: "rgba(34,211,238,0.12)",
                  color: "var(--x)",
                  border: "1px solid rgba(34,211,238,0.3)",
                }}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Cancel */}
        <div
          className="px-6 pb-6 border-t pt-4"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={handleCancel}
            className="w-full py-2.5 rounded font-semibold text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
            style={{
              backgroundColor: "var(--surface-2)",
              color: "var(--text-dim)",
              border: "1px solid var(--border)",
            }}
          >
            Cancel Search
          </button>
        </div>
      </div>
    </div>
  );
};

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg px-3 py-3 text-center"
      style={{
        backgroundColor: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="text-xs font-medium tracking-wide uppercase mb-1"
        style={{ color: "var(--text-dim)" }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold font-mono"
        style={{ color: "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}

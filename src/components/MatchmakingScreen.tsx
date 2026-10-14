import React, { useEffect, useMemo, useState } from "react";
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
  const [playersInQueue, setPlayersInQueue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "searching") return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const apiClient = useMemo(() => new GameAPIClient(), []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let rateLimitDelay = 2000;

    const poll = async () => {
      let delay = 2000;
      try {
        const result = await apiClient.joinQueue(playerId, playerNickname);
        if (cancelled) return;
        if (result.matched) {
          onGameFound(result.gameId, result.yourSymbol, result.connectToken);
          return;
        }
        setQueuePosition(result.position);
        setPlayersInQueue(result.playersInQueue);
        failures = 0;
        setError(null);
      } catch (err) {
        if (cancelled) return;
        failures += 1;
        if (failures >= 5) {
          setStatus("error");
          setError("Can't reach the server. Check your connection and retry.");
          return;
        }
        if (err instanceof Error && err.message.includes("Too many requests")) {
          rateLimitDelay = Math.min(rateLimitDelay * 2, 60000);
          delay = rateLimitDelay;
          setError(`The server is busy. Trying again in ${Math.ceil(delay / 1000)}s…`);
        } else {
          setError(`Couldn't reach the server. Retrying (${failures} of 5)…`);
        }
      }
      timer = setTimeout(poll, delay);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [playerId, playerNickname, onGameFound, apiClient]);

  useEffect(() => {
    const leave = () => apiClient.leaveQueueOnUnload(playerId);
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [playerId, apiClient]);

  const handleCancel = async () => {
    try {
      await apiClient.leaveQueue(playerId);
    } catch {
      // best-effort
    }
    onCancel();
  };

  return (
    <div className="h-full overflow-y-auto p-3 md:p-6">
      <section className="panel mx-auto max-w-sm">
        <h2 className="panel-title">
          {status === "searching" ? "Looking for an opponent" : "Can't connect"}
        </h2>

        <div className="p-3 space-y-3">
          <table className="w-full text-xs">
            <tbody className="[&_td]:py-1 [&_tr]:border-b [&_tr]:border-line [&_td:last-child]:text-right [&_td:last-child]:font-mono">
              <tr>
                <td className="text-muted">Playing as</td>
                <td className="text-ink">{playerNickname ?? "—"}</td>
              </tr>
              <tr>
                <td className="text-muted">Queue position</td>
                <td>{queuePosition ?? "—"}</td>
              </tr>
              <tr>
                <td className="text-muted">Players in queue</td>
                <td>{playersInQueue ?? "—"}</td>
              </tr>
              <tr>
                <td className="text-muted">Time searching</td>
                <td>{formatElapsed(elapsed)}</td>
              </tr>
            </tbody>
          </table>

          {error && (
            <p
              role="status"
              className={`px-2 py-1.5 rounded border text-xs ${
                status === "error"
                  ? "bg-o-soft border-o text-o"
                  : "bg-warn-soft border-warn-line text-warn"
              }`}
            >
              {error}
            </p>
          )}

          <div className="flex gap-2">
            {status === "error" && (
              <button onClick={() => window.location.reload()} className="btn-primary flex-1">
                Retry
              </button>
            )}
            <button onClick={handleCancel} className="btn flex-1">
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

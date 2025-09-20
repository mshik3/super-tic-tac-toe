import React, { useEffect, useMemo, useState } from "react";
import { GameAPIClient } from "../lib/websocket";

export interface MatchmakingScreenProps {
  playerId: string;
  onGameFound: (
    gameId: string,
    playerSymbol: "X" | "O",
    connectToken: string
  ) => void;
  onCancel: () => void;
}

export const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({
  playerId,
  onGameFound,
  onCancel,
}) => {
  const [status, setStatus] = useState<"searching" | "error">("searching");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number | null>(
    null
  );
  const [playersInQueue, setPlayersInQueue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backoffDelay, setBackoffDelay] = useState<number>(1000); // Start with 1 second for faster matching
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [isCircuitBreakerOpen, setIsCircuitBreakerOpen] =
    useState<boolean>(false);
  const [, setRetryCountdown] = useState<number | null>(null);

  const apiClient = useMemo(() => new GameAPIClient(), []);

  useEffect(() => {
    let cancelled = false;
    let pollInterval: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;
    let retryTimeout: NodeJS.Timeout;

    const searchForGame = async () => {
      try {
        setStatus("searching");
        setError(null);

        // Join the queue
        const result = await apiClient.joinQueue(playerId);

        if (cancelled) return;

        if (result.matched) {
          // Game found immediately
          onGameFound(result.gameId, result.yourSymbol, result.connectToken);
          return;
        }

        // Update queue status
        setQueuePosition(result.position);
        setEstimatedWaitTime(result.estimatedWaitTime);
        setPlayersInQueue(result.playersInQueue);

        // Poll for updates with circuit breaker pattern
        const startPolling = () => {
          pollInterval = setInterval(async () => {
            try {
              // Check circuit breaker
              if (isCircuitBreakerOpen) {
                console.log("Circuit breaker is open, stopping polling");
                clearInterval(pollInterval);
                setStatus("error");
                setError(
                  "Too many connection failures. Please try again later."
                );
                return;
              }

              // Check if we've been matched by trying to join again
              const joinResult = await apiClient.joinQueue(playerId);
              if (cancelled) return;

              if (joinResult.matched) {
                clearInterval(pollInterval);
                onGameFound(
                  joinResult.gameId,
                  joinResult.yourSymbol,
                  joinResult.connectToken
                );
                return;
              }

              setQueuePosition(joinResult.position);
              setEstimatedWaitTime(joinResult.estimatedWaitTime);
              setPlayersInQueue(joinResult.playersInQueue);
              setConsecutiveFailures(0); // Reset failure counter on success
              setError(null);
              setRetryCountdown(null);
            } catch (error) {
              console.error("Error polling queue:", error);
              if (!cancelled) {
                const newFailureCount = consecutiveFailures + 1;
                setConsecutiveFailures(newFailureCount);

                // Circuit breaker: stop after 5 consecutive failures
                if (newFailureCount >= 5) {
                  setIsCircuitBreakerOpen(true);
                  clearInterval(pollInterval);
                  setStatus("error");
                  setError(
                    "Too many connection failures. Please refresh the page and try again."
                  );
                  return;
                }

                // Check if it's a rate limit error (429)
                if (
                  error instanceof Error &&
                  error.message.includes("Too many requests")
                ) {
                  const newBackoffDelay = Math.min(backoffDelay * 2, 60000); // Max 60 seconds
                  setBackoffDelay(newBackoffDelay);
                  setRetryCountdown(Math.ceil(newBackoffDelay / 1000));
                  setError(
                    `Rate limited. Retrying in ${Math.ceil(
                      newBackoffDelay / 1000
                    )}s...`
                  );

                  // Start countdown timer
                  countdownInterval = setInterval(() => {
                    setRetryCountdown((prev) => {
                      if (prev === null || prev <= 1) {
                        clearInterval(countdownInterval);
                        return null;
                      }
                      const newCount = prev - 1;
                      setError(`Rate limited. Retrying in ${newCount}s...`);
                      return newCount;
                    });
                  }, 1000);

                  // Clear current interval and restart with longer delay
                  clearInterval(pollInterval);
                  retryTimeout = setTimeout(() => {
                    if (!cancelled && !isCircuitBreakerOpen) {
                      startPolling();
                    }
                  }, newBackoffDelay);
                } else {
                  setError(
                    `Connection error (${newFailureCount}/5). Retrying...`
                  );
                }
              }
            }
          }, Math.max(backoffDelay, 500)); // Ensure minimum 500ms polling for responsiveness
        };

        startPolling();
      } catch (error) {
        console.error("Error joining queue:", error);
        if (!cancelled) {
          setStatus("error");
          setError(
            error instanceof Error ? error.message : "Failed to join queue"
          );
        }
      }
    };

    searchForGame();

    return () => {
      cancelled = true;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [
    playerId,
    onGameFound,
    apiClient,
    backoffDelay,
    consecutiveFailures,
    isCircuitBreakerOpen,
  ]);

  const handleCancel = async () => {
    try {
      await apiClient.leaveQueue(playerId);
    } catch (error) {
      console.error("Error leaving queue:", error);
    }
    onCancel();
  };

  const formatWaitTime = (seconds: number | null): string => {
    if (seconds === null) return "Calculating...";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.round(seconds / 60)}m`;
  };

  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {status === "searching"
                ? "Finding Opponent..."
                : "Connection Error"}
            </h2>
          </div>

          {status === "searching" && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Position in Queue</div>
                    <div className="font-semibold text-lg">
                      {queuePosition || "..."}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Estimated Wait</div>
                    <div className="font-semibold text-lg">
                      {formatWaitTime(estimatedWaitTime)}
                    </div>
                  </div>
                </div>
              </div>

              {playersInQueue !== null && (
                <div className="text-sm text-gray-600">
                  {playersInQueue} players in queue
                </div>
              )}

              {error && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-yellow-800 text-sm">{error}</p>
                </div>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-800">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Cancel Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

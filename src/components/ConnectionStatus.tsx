import React from "react";
import type { WebSocketStatus } from "../lib/websocket";

export interface ConnectionStatusProps {
  status: WebSocketStatus;
  opponentConnected?: boolean;
  playerSymbol?: "X" | "O" | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  opponentConnected,
  playerSymbol,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "text-green-600";
      case "connecting":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      case "disconnected":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "connected":
        return "🟢";
      case "connecting":
        return "🟡";
      case "error":
        return "🔴";
      case "disconnected":
        return "⚪";
      default:
        return "⚪";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Connection Error";
      case "disconnected":
        return "Disconnected";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
            <span>{getStatusIcon()}</span>
            <span className="font-medium">{getStatusText()}</span>
          </div>

          {playerSymbol && (
            <div className="flex items-center space-x-1 text-gray-600">
              <span>You are:</span>
              <span className="font-bold text-lg">{playerSymbol}</span>
            </div>
          )}
        </div>

        {status === "connected" && (
          <div className="flex items-center space-x-1 text-gray-600">
            <span>Opponent:</span>
            <span
              className={opponentConnected ? "text-green-600" : "text-red-600"}
            >
              {opponentConnected ? "🟢 Online" : "🔴 Offline"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

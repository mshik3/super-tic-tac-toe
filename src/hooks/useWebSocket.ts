import { useEffect, useRef, useState } from "react";
import { GameWebSocket } from "../lib/websocket";
import type { WebSocketStatus } from "../lib/websocket";
import type { ServerMessage } from "../types/messages";

export interface UseWebSocketOptions {
  url?: string;
  onMessage?: (message: ServerMessage) => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  status: WebSocketStatus;
  connect: () => void;
  disconnect: () => void;
  send: (message: any) => boolean;
  makeMove: (boardIndex: number, cellIndex: number) => boolean;
  lastMessage: ServerMessage | null;
  error: Error | null;
}

export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { url, onMessage, onError, autoConnect = false } = options;

  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<GameWebSocket | null>(null);

  const handleMessage = (message: ServerMessage) => {
    setLastMessage(message);
    setError(null); // Clear any previous errors on successful message
    onMessage?.(message);
  };

  const handleError = (err: Error) => {
    setError(err);
    onError?.(err);
  };

  const connect = () => {
    if (!url) {
      const err = new Error("WebSocket URL not provided");
      handleError(err);
      return;
    }

    if (wsRef.current) {
      wsRef.current.disconnect();
    }

    wsRef.current = new GameWebSocket({
      url,
      onMessage: handleMessage,
      onStatusChange: setStatus,
      onError: handleError,
    });

    wsRef.current.connect();
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }
  };

  const send = (message: any): boolean => {
    if (!wsRef.current) {
      const err = new Error("WebSocket not initialized");
      handleError(err);
      return false;
    }
    return wsRef.current.send(message);
  };

  const makeMove = (boardIndex: number, cellIndex: number): boolean => {
    if (!wsRef.current) {
      const err = new Error("WebSocket not initialized");
      handleError(err);
      return false;
    }
    return wsRef.current.makeMove(boardIndex, cellIndex);
  };

  // Auto-connect on mount if enabled and URL is provided
  useEffect(() => {
    if (autoConnect && url) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [url, autoConnect]);

  // Update WebSocket URL if it changes
  useEffect(() => {
    if (wsRef.current && url && status === "connected") {
      // Reconnect with new URL
      disconnect();
      setTimeout(connect, 100); // Small delay to ensure cleanup
    }
  }, [url]);

  return {
    status,
    connect,
    disconnect,
    send,
    makeMove,
    lastMessage,
    error,
  };
}

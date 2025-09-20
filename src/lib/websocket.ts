import type {
  ClientMessage,
  ServerMessage,
  MakeMovePayload,
  QueueStatusPayload,
} from "../types/messages";

export type WebSocketStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface WebSocketConfig {
  url: string;
  onMessage: (message: ServerMessage) => void;
  onStatusChange: (status: WebSocketStatus) => void;
  onError?: (error: Error) => void;
}

export class GameWebSocket {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private status: WebSocketStatus = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.setStatus("connected");
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          this.config.onMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          this.config.onError?.(new Error("Invalid message format"));
        }
      };

      this.ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        this.ws = null;

        if (
          event.code !== 1000 &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          // Attempt to reconnect if not a normal closure
          this.attemptReconnect();
        } else {
          this.setStatus("disconnected");
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.setStatus("error");
        this.config.onError?.(new Error("WebSocket connection failed"));
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.setStatus("error");
      this.config.onError?.(error as Error);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, "User disconnect");
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  send(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, cannot send message:", message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      this.config.onError?.(error as Error);
      return false;
    }
  }

  makeMove(
    boardIndex: number,
    cellIndex: number,
    sequenceNumber?: number
  ): boolean {
    const payload: MakeMovePayload = {
      boardIndex,
      cellIndex,
      ...(sequenceNumber !== undefined && { sequenceNumber }),
    };
    return this.send({
      type: "MAKE_MOVE",
      payload,
    });
  }

  getStatus(): WebSocketStatus {
    return this.status;
  }

  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.config.onStatusChange(status);
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    this.setStatus("connecting");

    setTimeout(() => {
      console.log(
        `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
      );
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }
}

// API client for HTTP requests to the worker
export class GameAPIClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Prefer Vite define, fallback to env, then hardcoded (legacy)
    const definedUrl =
      typeof __WORKER_URL__ !== "undefined" ? __WORKER_URL__ : undefined;
    // Vite exposes typed env via ImportMetaEnv, but handle undefined for SSR/tools
    const envUrl = (import.meta as unknown as { env?: Record<string, string> })
      .env?.VITE_WORKER_URL as string | undefined;
    this.baseUrl =
      baseUrl ||
      definedUrl ||
      envUrl ||
      "https://super-tic-tac-toe-worker.mshik3.workers.dev";
  }

  async joinQueue(
    playerId: string,
    nickname?: string
  ): Promise<
    | {
        matched: true;
        gameId: string;
        yourSymbol: "X" | "O";
        connectToken: string;
      }
    | ({ matched: false } & QueueStatusPayload)
  > {
    try {
      const response = await fetch(`${this.baseUrl}/queue/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId, nickname }),
      });

      if (!response.ok) {
        // Enhanced error handling for different HTTP status codes
        if (response.status === 0 || !response.status) {
          throw new Error(
            "Network connection failed. Please check your internet connection and try again."
          );
        }
        if (response.status >= 500) {
          throw new Error(
            "Server is temporarily unavailable. Please try again in a moment."
          );
        }
        if (response.status === 429) {
          throw new Error(
            "Too many requests. Please wait a moment and try again."
          );
        }
        throw new Error(
          `Failed to join queue: ${response.statusText || "Unknown error"}`
        );
      }

      return response.json();
    } catch (error) {
      // Handle network errors (CORS, DNS, connection issues)
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Unable to connect to game server. This may be due to network issues or server maintenance."
        );
      }
      throw error;
    }
  }

  async leaveQueue(
    playerId: string
  ): Promise<{ success: boolean; playersInQueue: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/queue/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerId }),
      });

      if (!response.ok) {
        if (response.status === 0 || !response.status) {
          throw new Error(
            "Network connection failed. Please check your internet connection and try again."
          );
        }
        if (response.status >= 500) {
          throw new Error(
            "Server is temporarily unavailable. Please try again in a moment."
          );
        }
        throw new Error(
          `Failed to leave queue: ${response.statusText || "Unknown error"}`
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Unable to connect to game server. This may be due to network issues or server maintenance."
        );
      }
      throw error;
    }
  }

  async getQueueStatus(): Promise<QueueStatusPayload> {
    try {
      const response = await fetch(`${this.baseUrl}/queue/status`);

      if (!response.ok) {
        if (response.status === 0 || !response.status) {
          throw new Error(
            "Network connection failed. Please check your internet connection and try again."
          );
        }
        if (response.status >= 500) {
          throw new Error(
            "Server is temporarily unavailable. Please try again in a moment."
          );
        }
        if (response.status === 429) {
          throw new Error(
            "Too many requests. Please wait a moment and try again."
          );
        }
        throw new Error(
          `Failed to get queue status: ${
            response.statusText || "Unknown error"
          }`
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Unable to connect to game server. This may be due to network issues or server maintenance."
        );
      }
      throw error;
    }
  }

  getWebSocketUrl(gameId: string, playerId: string, token?: string): string {
    const wsUrl = this.baseUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");
    const search = new URLSearchParams({ gameId, playerId });
    if (token) search.set("token", token);
    return `${wsUrl}/game?${search.toString()}`;
  }

  async getGameInfo(
    gameId: string
  ): Promise<{ gameId: string; playerCount: number; status: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/game/game-info?gameId=${gameId}`
      );

      if (!response.ok) {
        if (response.status === 0 || !response.status) {
          throw new Error(
            "Network connection failed. Please check your internet connection and try again."
          );
        }
        if (response.status >= 500) {
          throw new Error(
            "Server is temporarily unavailable. Please try again in a moment."
          );
        }
        if (response.status === 404) {
          throw new Error(
            "Game not found. It may have expired or been removed."
          );
        }
        throw new Error(
          `Failed to get game info: ${response.statusText || "Unknown error"}`
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "Unable to connect to game server. This may be due to network issues or server maintenance."
        );
      }
      throw error;
    }
  }
}

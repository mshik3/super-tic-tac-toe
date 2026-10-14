import type {
  ClientMessage,
  ServerMessage,
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
          this.config.onError?.(new Error("Got a message from the server we couldn't read."));
        }
      };

      this.ws.onclose = (event) => {
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
        this.config.onError?.(new Error("Lost connection to the game server."));
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

  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.config.onStatusChange(status);
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    this.setStatus("connecting");

    setTimeout(() => this.connect(), this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }
}

type JoinQueueResult =
  | { matched: true; gameId: string; yourSymbol: "X" | "O"; connectToken: string }
  | ({ matched: false } & QueueStatusPayload);

// API client for HTTP requests to the worker
export class GameAPIClient {
  private baseUrl = __WORKER_URL__;

  private async post<T>(path: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(
        "Can't reach the game server."
      );
    }
    if (response.status === 429) {
      throw new Error("Too many requests. Wait a few seconds.");
    }
    if (response.status >= 500) {
      throw new Error("The server is having trouble. Try again in a minute.");
    }
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}).`);
    }
    return response.json();
  }

  joinQueue(playerId: string, nickname?: string): Promise<JoinQueueResult> {
    return this.post("/queue/join", { playerId, nickname });
  }

  leaveQueue(playerId: string): Promise<{ success: boolean; playersInQueue: number }> {
    return this.post("/queue/leave", { playerId });
  }

  // fetch can be cancelled mid-unload; a beacon is delivered after the page is gone
  leaveQueueOnUnload(playerId: string): void {
    navigator.sendBeacon(`${this.baseUrl}/queue/leave`, JSON.stringify({ playerId }));
  }

  getWebSocketUrl(gameId: string, playerId: string, token?: string): string {
    const wsUrl = this.baseUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");
    const search = new URLSearchParams({ gameId, playerId });
    if (token) search.set("token", token);
    return `${wsUrl}/game?${search.toString()}`;
  }
}

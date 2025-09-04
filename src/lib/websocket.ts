import type {
  ClientMessage,
  ServerMessage,
  MakeMovePayload,
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

  makeMove(boardIndex: number, cellIndex: number): boolean {
    const payload: MakeMovePayload = { boardIndex, cellIndex };
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

  constructor(
    baseUrl: string = "https://super-tic-tac-toe-worker.mshik3.workers.dev"
  ) {
    this.baseUrl = baseUrl;
  }

  async joinQueue(playerId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/queue/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ playerId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to join queue: ${response.statusText}`);
    }

    return response.json();
  }

  async leaveQueue(playerId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/queue/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ playerId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to leave queue: ${response.statusText}`);
    }

    return response.json();
  }

  async getQueueStatus(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/queue/status`);

    if (!response.ok) {
      throw new Error(`Failed to get queue status: ${response.statusText}`);
    }

    return response.json();
  }

  getWebSocketUrl(gameId: string, playerId: string): string {
    const wsUrl = this.baseUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");
    return `${wsUrl}/game?gameId=${gameId}&playerId=${playerId}`;
  }

  async getGameInfo(gameId: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/game/game-info?gameId=${gameId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get game info: ${response.statusText}`);
    }

    return response.json();
  }
}

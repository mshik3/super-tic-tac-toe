// Shared message protocol types for Super Tic-Tac-Toe multiplayer
export type PlayerSymbol = 'X' | 'O';
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type GameWinner = PlayerSymbol | 'draw' | null;

// Game board types (matching frontend)
export type Cell = PlayerSymbol | null;
export type SubBoard = Cell[];
export type MainBoard = Cell[];

export interface GameBoard {
	main: MainBoard;
	sub: SubBoard[];
	activeBoard: number | null;
}

export interface GameState {
	gameId: string;
	board: GameBoard;
	currentPlayer: PlayerSymbol;
	status: GameStatus;
	winner: GameWinner;
	createdAt: number;
	lastMove: number;
}

// WebSocket message types
export interface ClientMessage {
	type: 'MAKE_MOVE' | 'JOIN_GAME' | 'LEAVE_QUEUE';
	payload: any;
}

export interface ServerMessage {
	type: 'GAME_STATE' | 'MOVE_RESULT' | 'GAME_OVER' | 'QUEUE_STATUS' | 'OPPONENT_FOUND' | 'ERROR';
	payload: any;
}

// Specific message payloads
export interface MakeMovePayload {
	boardIndex: number;
	cellIndex: number;
}

export interface GameStatePayload {
	gameId: string;
	yourSymbol: PlayerSymbol;
	board: GameBoard;
	currentPlayer: PlayerSymbol;
	status: GameStatus;
	opponentConnected: boolean;
}

export interface MoveResultPayload {
	valid: boolean;
	board: GameBoard;
	currentPlayer: PlayerSymbol;
	gameStatus: GameStatus;
	error?: string;
}

export interface GameOverPayload {
	winner: GameWinner;
	reason: 'win' | 'draw' | 'forfeit' | 'timeout';
	finalBoard: GameBoard;
}

export interface QueueStatusPayload {
	position: number;
	estimatedWaitTime: number;
	playersInQueue: number;
}

export interface OpponentFoundPayload {
	gameId: string;
	yourSymbol: PlayerSymbol;
}

export interface ErrorPayload {
	message: string;
	code?: string;
}

// Queue management types
export interface QueueEntry {
	playerId: string;
	joinedAt: number;
	websocket?: WebSocket;
}

export interface PlayerConnection {
	playerId: string;
	symbol: PlayerSymbol;
	websocket: WebSocket;
	connected: boolean;
	lastPing: number;
}

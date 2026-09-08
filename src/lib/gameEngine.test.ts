import { describe, it, expect } from "vitest";
import type { GameState, SubBoard } from "../types/game";
import {
  createNewGame,
  isValidMove,
  applyMove,
  createMove,
  getValidMovesForGame,
} from "./gameEngine";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DRAWN_SUB: SubBoard = ["X", "O", "X", "X", "X", "O", "O", "X", "O"];
const X_WINS_SUB: SubBoard = ["X", "X", "X", "O", "O", null, null, null, null];
const O_WINS_SUB: SubBoard = ["O", "O", "O", "X", "X", null, null, null, null];

// Helper: build a game state where 8 sub-boards are already completed and only
// sub-board 0 has one empty cell (index 7). When X plays there, sub-board 0
// draws and all 9 sub-boards are complete with no main board winner → DRAW.
//
// Completed state:
//   sub[0]: almost drawn (index 7 empty)
//   sub[1]: X wins → main[1] = 'X'
//   sub[2]: drawn   → main[2] = null
//   sub[3]: O wins  → main[3] = 'O'
//   sub[4]: drawn   → main[4] = null
//   sub[5]: X wins  → main[5] = 'X'
//   sub[6]: O wins  → main[6] = 'O'
//   sub[7]: drawn   → main[7] = null
//   sub[8]: X wins  → main[8] = 'X'
//
// main = [null, X, null, O, null, X, O, null, X]
//   rows: null,X,null; O,null,X; O,null,X — no winner
//   cols: null,O,O; X,null,null; null,X,X — no winner
//   diags: null,null,X; null,null,O       — no winner ✓
function buildNearDrawState(): GameState {
  return {
    gameId: "test",
    board: {
      main: [null, "X", null, "O", null, "X", "O", null, "X"],
      sub: [
        ["X", "O", "X", "X", "X", "O", "O", null, "O"], // sub[0]: one cell left
        X_WINS_SUB,
        DRAWN_SUB,
        O_WINS_SUB,
        DRAWN_SUB,
        X_WINS_SUB,
        O_WINS_SUB,
        DRAWN_SUB,
        X_WINS_SUB,
      ],
      activeBoard: 0, // X must play in sub-board 0
    },
    currentPlayer: "X",
    status: "playing",
    winner: null,
    createdAt: Date.now(),
    lastMove: Date.now(),
  };
}

// ─── createNewGame ────────────────────────────────────────────────────────────

describe("createNewGame", () => {
  it("creates a fresh game with all empty cells", () => {
    const game = createNewGame("g1");
    expect(game.board.sub.every((sub) => sub.every((c) => c === null))).toBe(true);
    expect(game.board.main.every((c) => c === null)).toBe(true);
  });

  it("starts with X as the current player, playing status, and no winner", () => {
    const game = createNewGame("g1");
    expect(game.currentPlayer).toBe("X");
    expect(game.status).toBe("playing");
    expect(game.winner).toBeNull();
  });

  it("starts with no active board constraint (either player can choose any sub-board)", () => {
    const game = createNewGame("g1");
    expect(game.board.activeBoard).toBeNull();
  });

  it("stores the provided game ID", () => {
    expect(createNewGame("abc123").gameId).toBe("abc123");
  });
});

// ─── isValidMove ─────────────────────────────────────────────────────────────

describe("isValidMove", () => {
  it("accepts a legal first move on an empty board", () => {
    const state = createNewGame("g");
    expect(isValidMove(state, createMove(4, 4, "X"))).toBe(true);
  });

  it("rejects a move when the game is not in playing status", () => {
    const state = createNewGame("g");
    state.status = "finished";
    expect(isValidMove(state, createMove(0, 0, "X"))).toBe(false);
  });

  it("rejects a move from the wrong player", () => {
    const state = createNewGame("g"); // X's turn
    expect(isValidMove(state, createMove(0, 0, "O"))).toBe(false);
  });

  it("rejects a move with an out-of-range board index", () => {
    const state = createNewGame("g");
    expect(isValidMove(state, createMove(-1, 0, "X"))).toBe(false);
    expect(isValidMove(state, createMove(9, 0, "X"))).toBe(false);
  });

  it("rejects a move with an out-of-range cell index", () => {
    const state = createNewGame("g");
    expect(isValidMove(state, createMove(0, -1, "X"))).toBe(false);
    expect(isValidMove(state, createMove(0, 9, "X"))).toBe(false);
  });

  it("rejects a move on an already-occupied cell", () => {
    const state = createNewGame("g");
    state.board.sub[0][0] = "O";
    expect(isValidMove(state, createMove(0, 0, "X"))).toBe(false);
  });

  it("rejects a move into a completed (won) sub-board", () => {
    const state = createNewGame("g");
    state.board.sub[2] = [...X_WINS_SUB];
    state.board.main[2] = "X";
    expect(isValidMove(state, createMove(2, 5, "X"))).toBe(false);
  });

  it("rejects a move into a completed (drawn) sub-board", () => {
    const state = createNewGame("g");
    state.board.sub[3] = [...DRAWN_SUB];
    // main[3] stays null (drawn)
    expect(isValidMove(state, createMove(3, 0, "X"))).toBe(false);
  });

  it("rejects a move in the wrong sub-board when activeBoard is set", () => {
    const state = createNewGame("g");
    state.board.activeBoard = 5;
    expect(isValidMove(state, createMove(4, 0, "X"))).toBe(false);
  });

  it("accepts a move in the correct active board when activeBoard is set", () => {
    const state = createNewGame("g");
    state.board.activeBoard = 5;
    expect(isValidMove(state, createMove(5, 0, "X"))).toBe(true);
  });
});

// ─── applyMove ────────────────────────────────────────────────────────────────

describe("applyMove", () => {
  it("returns invalid result for an illegal move", () => {
    const state = createNewGame("g");
    const result = applyMove(state, createMove(0, 0, "O")); // wrong player
    expect(result.valid).toBe(false);
    expect(result.newGameState).toBeUndefined();
  });

  it("places the piece in the correct cell", () => {
    const state = createNewGame("g");
    const result = applyMove(state, createMove(4, 4, "X"));
    expect(result.valid).toBe(true);
    expect(result.newGameState!.board.sub[4][4]).toBe("X");
  });

  it("switches the current player after a valid move", () => {
    const state = createNewGame("g");
    const result = applyMove(state, createMove(4, 4, "X"));
    expect(result.newGameState!.currentPlayer).toBe("O");
  });

  it("does not switch the player when the game ends on that move", () => {
    // Build state where X wins sub-board 4 and that wins the main board diagonally
    const state = createNewGame("g");
    state.board.sub[0] = [...X_WINS_SUB]; state.board.main[0] = "X";
    state.board.sub[4] = ["X", "X", null, "O", "O", null, null, null, null];
    state.board.main[4] = null; // not yet won
    state.board.sub[8] = [...X_WINS_SUB]; state.board.main[8] = "X";
    state.board.activeBoard = null;
    state.currentPlayer = "X";

    // X plays at sub[4][2] to win sub-board 4 via row 0 → main diagonal [0,4,8] = X,X,X
    const result = applyMove(state, createMove(4, 2, "X"));
    expect(result.valid).toBe(true);
    expect(result.newGameState!.status).toBe("finished");
    expect(result.newGameState!.winner).toBe("X");
    expect(result.newGameState!.currentPlayer).toBe("X"); // no switch on game-ending move
  });

  it("marks the sub-board winner in the main board when a sub-board is won", () => {
    const state = createNewGame("g");
    // X already has two in a row in sub-board 0; plays the third
    state.board.sub[0][0] = "X";
    state.board.sub[0][1] = "X";
    // X plays at [0][2] to win row 0 of sub-board 0
    const result = applyMove(state, createMove(0, 2, "X"));
    expect(result.valid).toBe(true);
    expect(result.newGameState!.board.main[0]).toBe("X");
  });

  it("does not mark the main board when the sub-board is drawn", () => {
    // Set up sub-board 0 with 8 cells filled and no winner (one null left)
    const state = createNewGame("g");
    // DRAWN_SUB with index 7 removed:
    state.board.sub[0] = ["X", "O", "X", "X", "X", "O", "O", null, "O"];
    state.board.activeBoard = 0;
    // X plays at index 7 to draw the sub-board
    const result = applyMove(state, createMove(0, 7, "X"));
    expect(result.valid).toBe(true);
    expect(result.newGameState!.board.main[0]).toBeNull(); // drawn → null in main
  });

  it("sets the next activeBoard to the played cell index", () => {
    const state = createNewGame("g"); // activeBoard: null
    const result = applyMove(state, createMove(3, 7, "X")); // cellIndex = 7
    expect(result.newGameState!.board.activeBoard).toBe(7);
  });

  it("sets activeBoard to null when the target sub-board is already completed", () => {
    const state = createNewGame("g");
    state.board.sub[5] = [...DRAWN_SUB]; // sub-board 5 is completed (drawn)
    // X plays at [0][5] → next active board would be 5, but 5 is completed → null
    const result = applyMove(state, createMove(0, 5, "X"));
    expect(result.valid).toBe(true);
    expect(result.newGameState!.board.activeBoard).toBeNull();
  });

  it("sets activeBoard to null when the move itself completes the target sub-board (self-referential)", () => {
    // X plays at boardIndex=4, cellIndex=4 — winning sub-board 4 via diagonal [0,4,8].
    // The next active board = cellIndex = 4, but sub-board 4 is now completed → null.
    const state = createNewGame("g");
    state.board.sub[4][0] = "X";
    state.board.sub[4][8] = "X";
    state.board.sub[4][1] = "O";
    state.board.sub[4][2] = "O";
    state.board.activeBoard = null;

    const result = applyMove(state, createMove(4, 4, "X")); // X wins sub[4] diagonal
    expect(result.valid).toBe(true);
    expect(result.newGameState!.board.main[4]).toBe("X");
    expect(result.newGameState!.board.activeBoard).toBeNull();
  });

  it("ends the game with winner='X' when X wins three sub-boards in a row", () => {
    const state = createNewGame("g");
    // X already won sub-boards 0 and 1; wins sub-board 2 to complete row 0 on main board
    state.board.sub[0] = [...X_WINS_SUB]; state.board.main[0] = "X";
    state.board.sub[1] = [...X_WINS_SUB]; state.board.main[1] = "X";
    state.board.sub[2] = ["X", "X", null, "O", "O", null, null, null, null];
    state.board.activeBoard = null;
    state.currentPlayer = "X";

    const result = applyMove(state, createMove(2, 2, "X")); // wins sub[2] row 0
    expect(result.valid).toBe(true);
    expect(result.newGameState!.status).toBe("finished");
    expect(result.newGameState!.winner).toBe("X");
  });

  // ── THE CRITICAL DRAW BUG ──────────────────────────────────────────────────
  //
  // Bug: isGameDraw checked mainBoard.every(c => c !== null). Drawn sub-boards
  // leave main[i] as null, so the game would never detect a draw if any sub-board
  // ended in a draw — causing a permanent deadlock (no moves possible, status
  // still 'playing').
  //
  it("ends the game as draw when the final move completes all sub-boards with no winner (the draw deadlock bug)", () => {
    const state = buildNearDrawState();
    // X plays at [boardIndex=0, cellIndex=7], drawing sub-board 0.
    // After this move, all 9 sub-boards are completed and main has no winner.
    const result = applyMove(state, createMove(0, 7, "X"));

    expect(result.valid).toBe(true);
    expect(result.newGameState!.status).toBe("finished");
    expect(result.newGameState!.winner).toBe("draw");
  });

  it("does not mutate the original game state", () => {
    const state = createNewGame("g");
    const subBefore = [...state.board.sub[4]];
    applyMove(state, createMove(4, 4, "X"));
    expect(state.board.sub[4]).toEqual(subBefore);
    expect(state.currentPlayer).toBe("X");
  });
});

// ─── getValidMovesForGame ─────────────────────────────────────────────────────

describe("getValidMovesForGame", () => {
  it("returns empty array when the game is finished", () => {
    const state = createNewGame("g");
    state.status = "finished";
    expect(getValidMovesForGame(state)).toHaveLength(0);
  });

  it("returns all 81 moves at the start of a game (no activeBoard constraint)", () => {
    const state = createNewGame("g");
    expect(getValidMovesForGame(state)).toHaveLength(81);
  });

  it("returns only moves in the active sub-board when activeBoard is set", () => {
    const state = createNewGame("g");
    state.board.activeBoard = 6;
    const moves = getValidMovesForGame(state);
    expect(moves).toHaveLength(9);
    expect(moves.every((m) => m.boardIndex === 6)).toBe(true);
  });

  it("returns moves across all non-completed sub-boards when activeBoard is null", () => {
    const state = createNewGame("g");
    state.board.sub[0] = [...X_WINS_SUB];
    state.board.main[0] = "X";
    state.board.activeBoard = null;
    const moves = getValidMovesForGame(state);
    expect(moves.every((m) => m.boardIndex !== 0)).toBe(true);
  });

  it("returns 0 valid moves when all sub-boards are completed (draw state)", () => {
    const state = buildNearDrawState();
    // Apply the final move to reach full draw
    const result = applyMove(state, createMove(0, 7, "X"));
    expect(getValidMovesForGame(result.newGameState!)).toHaveLength(0);
  });
});

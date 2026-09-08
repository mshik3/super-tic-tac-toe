import { describe, it, expect } from "vitest";
import type { SubBoard, MainBoard } from "../types/game";
import {
  checkSubBoardWinner,
  checkMainBoardWinner,
  isSubBoardFull,
  isSubBoardCompleted,
  isGameDraw,
  getValidMoves,
} from "./winDetection";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EMPTY_SUB: SubBoard = Array(9).fill(null);

// A valid drawn sub-board: all 9 cells filled, no winner
// X O X
// X X O
// O X O
// Verified: no row/col/diagonal has three matching values
const DRAWN_SUB: SubBoard = ["X", "O", "X", "X", "X", "O", "O", "X", "O"];

const X_WINS_SUB: SubBoard = ["X", "X", "X", "O", "O", null, null, null, null]; // row 0
const O_WINS_SUB: SubBoard = ["O", "O", "O", "X", "X", null, null, null, null]; // row 0

// ─── checkSubBoardWinner ─────────────────────────────────────────────────────

describe("checkSubBoardWinner", () => {
  it.each([
    ["row 0", ["X", "X", "X", "O", "O", null, null, null, null] as SubBoard, "X"],
    ["row 1", [null, null, null, "O", "O", "O", "X", "X", null] as SubBoard, "O"],
    ["row 2", [null, null, null, null, null, null, "X", "X", "X"] as SubBoard, "X"],
    ["col 0", ["O", null, null, "O", null, null, "O", null, null] as SubBoard, "O"],
    ["col 1", [null, "X", null, null, "X", null, null, "X", null] as SubBoard, "X"],
    ["col 2", [null, null, "O", null, null, "O", null, null, "O"] as SubBoard, "O"],
    ["main diagonal", ["X", null, null, null, "X", null, null, null, "X"] as SubBoard, "X"],
    ["anti-diagonal", [null, null, "O", null, "O", null, "O", null, null] as SubBoard, "O"],
  ])("detects %s win", (_, board, expectedWinner) => {
    expect(checkSubBoardWinner(board)).toBe(expectedWinner);
  });

  it("returns null for an empty board", () => {
    expect(checkSubBoardWinner(EMPTY_SUB)).toBeNull();
  });

  it("returns null for a drawn board (full, no winner)", () => {
    expect(checkSubBoardWinner(DRAWN_SUB)).toBeNull();
  });

  it("returns null for a partial board with no winner yet", () => {
    const partial: SubBoard = ["X", "O", null, null, null, null, null, null, null];
    expect(checkSubBoardWinner(partial)).toBeNull();
  });

  it("does not declare a winner if the winning combo contains a null", () => {
    // X at 0 and 1 but not 2 – incomplete row
    const almostWin: SubBoard = ["X", "X", null, null, null, null, null, null, null];
    expect(checkSubBoardWinner(almostWin)).toBeNull();
  });
});

// ─── checkMainBoardWinner ────────────────────────────────────────────────────

describe("checkMainBoardWinner", () => {
  it("returns null for an empty main board", () => {
    const empty: MainBoard = Array(9).fill(null);
    expect(checkMainBoardWinner(empty)).toBeNull();
  });

  it("detects row win on the main board", () => {
    const main: MainBoard = ["X", "X", "X", null, null, null, null, null, null];
    expect(checkMainBoardWinner(main)).toBe("X");
  });

  it("detects column win on the main board", () => {
    const main: MainBoard = ["O", null, null, "O", null, null, "O", null, null];
    expect(checkMainBoardWinner(main)).toBe("O");
  });

  it("detects diagonal win on the main board", () => {
    const main: MainBoard = ["X", null, null, null, "X", null, null, null, "X"];
    expect(checkMainBoardWinner(main)).toBe("X");
  });

  it("returns null when sub-boards are won but no main board line is complete", () => {
    // X wins 3 sub-boards but not in a line
    const main: MainBoard = ["X", "O", null, "O", "X", null, null, null, null];
    expect(checkMainBoardWinner(main)).toBeNull();
  });

  it("does not count null entries (drawn sub-boards) as a win", () => {
    // null entries from drawn sub-boards must not form a line
    const main: MainBoard = [null, null, null, null, null, null, null, null, null];
    expect(checkMainBoardWinner(main)).toBeNull();
  });
});

// ─── isSubBoardFull ──────────────────────────────────────────────────────────

describe("isSubBoardFull", () => {
  it("returns false for an empty board", () => {
    expect(isSubBoardFull(EMPTY_SUB)).toBe(false);
  });

  it("returns false for a partially filled board", () => {
    const partial: SubBoard = ["X", "O", null, null, null, null, null, null, null];
    expect(isSubBoardFull(partial)).toBe(false);
  });

  it("returns true for a fully filled board (won)", () => {
    const full: SubBoard = ["X", "X", "X", "O", "O", "X", "O", "X", "O"];
    expect(isSubBoardFull(full)).toBe(true);
  });

  it("returns true for a drawn board (full, no winner)", () => {
    expect(isSubBoardFull(DRAWN_SUB)).toBe(true);
  });
});

// ─── isSubBoardCompleted ─────────────────────────────────────────────────────

describe("isSubBoardCompleted", () => {
  it("returns false for an in-progress board", () => {
    expect(isSubBoardCompleted(EMPTY_SUB)).toBe(false);
    const partial: SubBoard = ["X", "O", null, null, null, null, null, null, null];
    expect(isSubBoardCompleted(partial)).toBe(false);
  });

  it("returns true for a won board (even if not all cells are filled)", () => {
    expect(isSubBoardCompleted(X_WINS_SUB)).toBe(true);
    expect(isSubBoardCompleted(O_WINS_SUB)).toBe(true);
  });

  it("returns true for a drawn board (full, no winner)", () => {
    expect(isSubBoardCompleted(DRAWN_SUB)).toBe(true);
  });
});

// ─── isGameDraw ───────────────────────────────────────────────────────────────
//
// KEY: drawn sub-boards leave board.main[i] as null (the engine intentionally
// does not write anything to main for a drawn sub-board). isGameDraw must not
// rely on mainBoard.every(c => c !== null) — it must check sub-board completion
// directly to avoid a deadlock where no moves are left but the game never ends.

describe("isGameDraw", () => {
  it("returns false when the game has just started", () => {
    const main: MainBoard = Array(9).fill(null);
    const subs: SubBoard[] = Array(9).fill(EMPTY_SUB);
    expect(isGameDraw(main, subs)).toBe(false);
  });

  it("returns false when some sub-boards are still in progress", () => {
    const main: MainBoard = ["X", null, null, null, null, null, null, null, null];
    const subs: SubBoard[] = [X_WINS_SUB, ...Array(8).fill(EMPTY_SUB)];
    expect(isGameDraw(main, subs)).toBe(false);
  });

  it("returns false when there is a main board winner (not a draw)", () => {
    // X wins row 0 of the main board
    const main: MainBoard = ["X", "X", "X", "O", "O", null, null, null, null];
    const subs: SubBoard[] = [
      X_WINS_SUB, X_WINS_SUB, X_WINS_SUB,
      O_WINS_SUB, O_WINS_SUB, EMPTY_SUB,
      EMPTY_SUB, EMPTY_SUB, EMPTY_SUB,
    ];
    expect(isGameDraw(main, subs)).toBe(false);
  });

  it("detects draw when all sub-boards are won but no main board line exists", () => {
    // Alternate X/O wins such that no row/col/diag on the main board is uniform
    // main = [X, O, X, O, X, O, X, O, X] — X has [0,2,4,6,8] (no line with only those)
    // Check: rows [0,1,2]=X,O,X; [3,4,5]=O,X,O; [6,7,8]=X,O,X — no winner
    // Cols [0,3,6]=X,O,X; [1,4,7]=O,X,O; [2,5,8]=X,O,X — no winner
    // Diags [0,4,8]=X,X,X — wait! That's a winner. Let me use a different arrangement.
    //
    // Adjust: main = [X, O, X, O, O, X, X, X, O]
    // Check: rows [0,1,2]=X,O,X; [3,4,5]=O,O,X; [6,7,8]=X,X,O — no winner
    // Cols [0,3,6]=X,O,X; [1,4,7]=O,O,X; [2,5,8]=X,X,O — no winner
    // Diags [0,4,8]=X,O,O; [2,4,6]=X,O,X — no winner ✓
    const main: MainBoard = ["X", "O", "X", "O", "O", "X", "X", "X", "O"];
    const subs: SubBoard[] = [
      X_WINS_SUB, O_WINS_SUB, X_WINS_SUB,
      O_WINS_SUB, O_WINS_SUB, X_WINS_SUB,
      X_WINS_SUB, X_WINS_SUB, O_WINS_SUB,
    ];
    expect(isGameDraw(main, subs)).toBe(true);
  });

  it("detects draw when some sub-boards are drawn, leaving null in the main board (THE BUG CASE)", () => {
    // Drawn sub-boards leave their main board slot as null.
    // With the old implementation (mainBoard.every(c => c !== null)), this case
    // was never detected as a draw — the game would deadlock with no valid moves.
    //
    // main = [null, X, null, O, null, X, O, null, X]
    // (positions 0, 2, 4, 7 are null because those sub-boards drew)
    // Verify no winner:
    //   rows: null,X,null; O,null,X; O,null,X — no
    //   cols: null,O,O; X,null,null; null,X,X — no
    //   diags: null,null,X; null,null,O — no ✓
    const main: MainBoard = [null, "X", null, "O", null, "X", "O", null, "X"];
    const subs: SubBoard[] = [
      DRAWN_SUB,   // sub[0]: drawn → main[0] = null
      X_WINS_SUB,  // sub[1]: X wins → main[1] = 'X'
      DRAWN_SUB,   // sub[2]: drawn → main[2] = null
      O_WINS_SUB,  // sub[3]: O wins → main[3] = 'O'
      DRAWN_SUB,   // sub[4]: drawn → main[4] = null
      X_WINS_SUB,  // sub[5]: X wins → main[5] = 'X'
      O_WINS_SUB,  // sub[6]: O wins → main[6] = 'O'
      DRAWN_SUB,   // sub[7]: drawn → main[7] = null
      X_WINS_SUB,  // sub[8]: X wins → main[8] = 'X'
    ];
    // All 9 sub-boards are completed. No main board winner.
    // This MUST be detected as a draw.
    expect(isGameDraw(main, subs)).toBe(true);
  });
});

// ─── getValidMoves ────────────────────────────────────────────────────────────

describe("getValidMoves", () => {
  it("returns all empty cells across all non-completed boards when activeBoard is null", () => {
    const subs: SubBoard[] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    const moves = getValidMoves(subs, null);
    expect(moves).toHaveLength(81); // 9 boards × 9 cells
  });

  it("returns only cells in the specified active board", () => {
    const subs: SubBoard[] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    const moves = getValidMoves(subs, 4);
    expect(moves).toHaveLength(9);
    expect(moves.every((m) => m.boardIndex === 4)).toBe(true);
  });

  it("skips completed sub-boards when activeBoard is null", () => {
    const subs: SubBoard[] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    subs[0] = X_WINS_SUB; // completed
    subs[1] = DRAWN_SUB;  // completed
    const moves = getValidMoves(subs, null);
    expect(moves.every((m) => m.boardIndex !== 0 && m.boardIndex !== 1)).toBe(true);
    // 7 remaining boards × 9 cells = 63; X_WINS_SUB has 4 filled so won't matter
    // since the whole board is excluded
    expect(moves.every((m) => m.boardIndex >= 2)).toBe(true);
  });

  it("returns empty array when activeBoard is a completed sub-board", () => {
    const subs: SubBoard[] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    subs[3] = DRAWN_SUB; // completed
    const moves = getValidMoves(subs, 3);
    expect(moves).toHaveLength(0);
  });

  it("returns only empty cells within the active board (excludes occupied cells)", () => {
    const subs: SubBoard[] = Array(9)
      .fill(null)
      .map(() => Array(9).fill(null));
    subs[2] = ["X", "O", null, null, null, null, null, null, null]; // 2 occupied
    const moves = getValidMoves(subs, 2);
    expect(moves).toHaveLength(7);
    expect(moves.every((m) => m.boardIndex === 2)).toBe(true);
  });
});

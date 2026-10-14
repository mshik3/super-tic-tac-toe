import type { GameState } from "../types/game";
import { WINNING_COMBINATIONS } from "../types/game";

export type BotLevel = "easy" | "medium" | "hard" | "legendary";

export const BOT_LEVELS: BotLevel[] = ["easy", "medium", "hard", "legendary"];

// The game engine deep-copies state on every move, far too slow for the
// thousands of playouts search needs, so the bot keeps its own flat board.
// cells: 81 squares (board * 9 + cell), 0 empty, 1 X, 2 O.
// macro: per small board, 0 open, 1 X won, 2 O won, 3 full with no winner.
interface Sim {
  cells: Int8Array;
  macro: Int8Array;
  active: number; // -1 = any open board
  toMove: 1 | 2;
  winner: number; // 0 none yet, 1 X, 2 O, 3 draw
}

const LINES = WINNING_COMBINATIONS;

function fromState(state: GameState): Sim {
  const cells = new Int8Array(81);
  const macro = new Int8Array(9);
  state.board.sub.forEach((sub, b) => {
    sub.forEach((v, c) => {
      cells[b * 9 + c] = v === "X" ? 1 : v === "O" ? 2 : 0;
    });
    macro[b] = state.board.main[b] === "X" ? 1 : state.board.main[b] === "O" ? 2 : 0;
    if (macro[b] === 0 && sub.every((v) => v !== null)) macro[b] = 3;
  });
  const active = state.board.activeBoard;
  return {
    cells,
    macro,
    active: active === null || macro[active] !== 0 ? -1 : active,
    toMove: state.currentPlayer === "X" ? 1 : 2,
    winner: 0,
  };
}

function clone(s: Sim): Sim {
  return { ...s, cells: s.cells.slice(), macro: s.macro.slice() };
}

function legalMoves(s: Sim): number[] {
  const moves: number[] = [];
  for (let b = 0; b < 9; b++) {
    if (s.macro[b] !== 0 || (s.active !== -1 && s.active !== b)) continue;
    for (let c = 0; c < 9; c++) if (s.cells[b * 9 + c] === 0) moves.push(b * 9 + c);
  }
  return moves;
}

function lineWinner(get: (i: number) => number, p: number): boolean {
  return LINES.some(([a, b, c]) => get(a) === p && get(b) === p && get(c) === p);
}

function play(s: Sim, m: number): void {
  const p = s.toMove;
  const b = (m / 9) | 0;
  const c = m % 9;
  s.cells[m] = p;

  if (lineWinner((i) => s.cells[b * 9 + i], p)) s.macro[b] = p;
  else {
    let full = true;
    for (let i = 0; i < 9; i++) if (s.cells[b * 9 + i] === 0) full = false;
    if (full) s.macro[b] = 3;
  }

  if (s.macro[b] === p && lineWinner((i) => s.macro[i], p)) s.winner = p;
  else if (s.macro.every((v) => v !== 0)) s.winner = 3;

  s.active = s.macro[c] === 0 ? c : -1;
  s.toMove = p === 1 ? 2 : 1;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// ─── Medium: one move of lookahead with rules a decent beginner knows ────────

function canWinBoard(s: Sim, b: number, p: number): boolean {
  if (s.macro[b] !== 0) return false;
  for (let c = 0; c < 9; c++) {
    if (s.cells[b * 9 + c] !== 0) continue;
    s.cells[b * 9 + c] = p;
    const wins = lineWinner((i) => s.cells[b * 9 + i], p);
    s.cells[b * 9 + c] = 0;
    if (wins) return true;
  }
  return false;
}

function heuristicMove(s: Sim): number {
  const me = s.toMove;
  const them = me === 1 ? 2 : 1;
  let best = -Infinity;
  let bestMoves: number[] = [];

  for (const m of legalMoves(s)) {
    const b = (m / 9) | 0;
    const c = m % 9;
    const next = clone(s);
    play(next, m);

    let score = Math.random(); // break ties differently each game
    if (next.winner === me) score += 10_000;
    if (next.macro[b] === me) score += 100;

    // Taking the square they need on this board
    s.cells[m] = them;
    if (lineWinner((i) => s.cells[b * 9 + i], them)) score += 60;
    s.cells[m] = 0;

    // Where this sends them
    if (next.active === -1) score -= 50;
    else if (canWinBoard(next, next.active, them)) score -= 80;

    if (c === 4) score += 3;
    if (b === 4) score += 2;

    if (score > best) {
      best = score;
      bestMoves = [m];
    } else if (score === best) bestMoves.push(m);
  }
  return pick(bestMoves);
}

// ─── Hard and legendary: Monte Carlo tree search ─────────────────────────────

interface Node {
  move: number;
  parent: Node | null;
  children: Node[];
  untried: number[];
  wins: number; // from the view of the player who made `move`
  visits: number;
  mover: number;
}

function randomPlayout(s: Sim): number {
  while (!s.winner) {
    const moves = legalMoves(s);
    play(s, moves[(Math.random() * moves.length) | 0]);
  }
  return s.winner;
}

function mcts(root: Sim, { iterations, timeMs }: { iterations: number; timeMs: number }): number {
  const tree: Node = {
    move: -1,
    parent: null,
    children: [],
    untried: legalMoves(root),
    wins: 0,
    visits: 0,
    mover: root.toMove === 1 ? 2 : 1,
  };
  const deadline = Date.now() + timeMs;

  for (let i = 0; i < iterations && (i % 256 !== 0 || Date.now() < deadline); i++) {
    let node = tree;
    const s = clone(root);

    // Select by UCB1 until a node still has unexplored moves
    while (node.untried.length === 0 && node.children.length > 0) {
      const logN = Math.log(node.visits);
      let bestScore = -Infinity;
      let bestChild = node.children[0];
      for (const child of node.children) {
        const score = child.wins / child.visits + 1.4 * Math.sqrt(logN / child.visits);
        if (score > bestScore) {
          bestScore = score;
          bestChild = child;
        }
      }
      node = bestChild;
      play(s, node.move);
    }

    // Expand
    if (node.untried.length > 0 && !s.winner) {
      const idx = (Math.random() * node.untried.length) | 0;
      const move = node.untried[idx];
      node.untried[idx] = node.untried[node.untried.length - 1];
      node.untried.pop();
      const mover = s.toMove;
      play(s, move);
      const child: Node = {
        move,
        parent: node,
        children: [],
        untried: s.winner ? [] : legalMoves(s),
        wins: 0,
        visits: 0,
        mover,
      };
      node.children.push(child);
      node = child;
    }

    // Simulate, then back up the result
    const result = s.winner || randomPlayout(s);
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++;
      if (result === n.mover) n.wins += 1;
      else if (result === 3) n.wins += 0.5;
    }
  }

  let best = tree.children[0];
  for (const child of tree.children) if (child.visits > best.visits) best = child;
  return best.move;
}

// Budgets tuned so each level is a clear step up; legendary searches for
// about two seconds, which is why the browser runs the bot in a worker.
export const SEARCH: Record<"hard" | "legendary", { iterations: number; timeMs: number }> = {
  hard: { iterations: 1_500, timeMs: 1_000 },
  legendary: { iterations: 1_000_000, timeMs: 2_000 },
};

export function chooseBotMove(
  state: GameState,
  level: BotLevel,
  search = SEARCH
): { boardIndex: number; cellIndex: number } {
  const s = fromState(state);
  const moves = legalMoves(s);

  // Never miss a move that wins the whole game, at any level
  const winning = level === "easy" ? undefined : moves.find((m) => {
    const next = clone(s);
    play(next, m);
    return next.winner === s.toMove;
  });

  const m =
    winning ??
    (level === "easy"
      ? pick(moves)
      : level === "medium"
        ? heuristicMove(s)
        : mcts(s, search[level]));

  return { boardIndex: (m / 9) | 0, cellIndex: m % 9 };
}

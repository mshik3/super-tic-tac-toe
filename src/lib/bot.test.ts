import { describe, expect, it } from "vitest";
import { applyMove, createMove, createNewGame, getValidMovesForGame } from "./gameEngine";
import { chooseBotMove, type BotLevel } from "./bot";
import type { GameState, PlayerSymbol } from "../types/game";

const fast = {
  hard: { iterations: 400, timeMs: 1_000 },
  legendary: { iterations: 800, timeMs: 1_000 },
};

// Plays a full game through the real engine, so an illegal bot move fails here
function playGame(x: BotLevel, o: BotLevel): GameState["winner"] {
  let state = createNewGame("test");
  while (state.status === "playing") {
    const level = state.currentPlayer === "X" ? x : o;
    const { boardIndex, cellIndex } = chooseBotMove(state, level, fast);
    const legal = getValidMovesForGame(state);
    expect(legal).toContainEqual({ boardIndex, cellIndex });
    const result = applyMove(state, createMove(boardIndex, cellIndex, state.currentPlayer));
    state = result.newGameState!;
  }
  return state.winner;
}

function winsAgainst(level: BotLevel, weaker: BotLevel, games: number) {
  let wins = 0;
  for (let i = 0; i < games; i++) {
    const botSide: PlayerSymbol = i % 2 === 0 ? "X" : "O";
    const winner = botSide === "X" ? playGame(level, weaker) : playGame(weaker, level);
    if (winner === botSide) wins++;
  }
  return wins;
}

describe("bot", () => {
  it("only plays legal moves at every level", () => {
    for (const level of ["easy", "medium", "hard", "legendary"] as const) {
      playGame(level, "easy");
    }
  });

  it("medium beats a random player most of the time", () => {
    expect(winsAgainst("medium", "easy", 20)).toBeGreaterThanOrEqual(15);
  });

  it("hard beats medium most of the time", () => {
    expect(winsAgainst("hard", "medium", 8)).toBeGreaterThanOrEqual(5);
  }, 20_000);
});

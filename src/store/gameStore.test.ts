import { describe, expect, it, beforeEach } from "vitest";
import { useGameStore } from "./gameStore";

describe("gameStore setPlayerNickname guard", () => {
  beforeEach(() => {
    // Reset the store state between tests
    const { getState, setState } = useGameStore;
    const initial = getState();
    setState({ ...initial, error: null, playerNickname: "Anonymous" });
  });

  it("rejects invalid nickname and sets an error", () => {
    const { setPlayerNickname } = useGameStore.getState();
    setPlayerNickname("sh1t");
    const state = useGameStore.getState();
    expect(state.playerNickname).toBe("Anonymous");
    expect(state.error).toMatch(/display name/i);
  });

  it("accepts valid nickname and clears error", () => {
    const { setPlayerNickname } = useGameStore.getState();
    setPlayerNickname("  Alice   42  ");
    const state = useGameStore.getState();
    expect(state.playerNickname).toBe("Alice 42");
    expect(state.error).toBeNull();
  });
});

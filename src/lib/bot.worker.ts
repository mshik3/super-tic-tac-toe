import { chooseBotMove, type BotLevel } from "./bot";
import type { GameState } from "../types/game";

// Search runs here so legendary's two seconds of thinking never freeze the page
self.onmessage = (e: MessageEvent<{ state: GameState; level: BotLevel }>) => {
  self.postMessage(chooseBotMove(e.data.state, e.data.level));
};

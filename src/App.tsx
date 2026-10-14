import { useState } from "react";
import { GameScreen } from "./components/GameScreen";
import { MainMenu } from "./components/MainMenu";
import { MatchmakingScreen } from "./components/MatchmakingScreen";
import {
  useCurrentScreen,
  useSetGameMode,
  useSetPlayerNickname,
  useFindOnlineGame,
  useConnectToGame,
  usePlayerId,
  useDisconnectFromGame,
  useStartBotGame,
  useCreatePrivateGame,
  useJoinPrivateGame,
} from "./store/gameStore";
import type { BotLevel } from "./lib/bot";

const readInvite = () => {
  const id = new URLSearchParams(window.location.search).get("join");
  return id && /^game-[0-9a-f-]{36}$/.test(id) ? id : null;
};
import { useGameStore } from "./store/gameStore";

function App() {
  const currentScreen = useCurrentScreen();
  const setGameMode = useSetGameMode();
  const setPlayerNickname = useSetPlayerNickname();
  const findOnlineGame = useFindOnlineGame();
  const connectToGame = useConnectToGame();
  const playerId = usePlayerId();
  const disconnectFromGame = useDisconnectFromGame();
  const playerNickname = useGameStore((s) => s.playerNickname);
  const startBotGame = useStartBotGame();
  const createPrivateGame = useCreatePrivateGame();
  const joinPrivateGame = useJoinPrivateGame();
  const [inviteId, setInviteId] = useState(readInvite);

  const clearInvite = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setInviteId(null);
  };

  const handlePlayFriend = async (nickname: string) => {
    setPlayerNickname(nickname);
    await createPrivateGame();
  };

  const handleJoinInvite = async (nickname: string) => {
    setPlayerNickname(nickname);
    await joinPrivateGame(inviteId!);
    clearInvite();
  };

  const handlePlayLocal = () => {
    setGameMode("local");
  };

  const handlePlayOnline = (nickname: string) => {
    // Store nickname in game store and start search
    setPlayerNickname(nickname);
    findOnlineGame();
  };

  const handleGameFound = (
    gameId: string,
    playerSymbol: "X" | "O",
    connectToken: string
  ) => {
    connectToGame(gameId, playerSymbol, connectToken);
  };

  const handleCancelSearch = () => {
    disconnectFromGame();
  };

  return (
    <div className="h-dvh flex flex-col">
      <header className="shrink-0 h-8 px-3 flex items-center bg-bar border-b-2 border-accent text-ink">
        <span className="text-sm font-bold">Super Tic-Tac-Toe</span>
      </header>
      <main className="flex-1 min-h-0">
        {currentScreen === "menu" ? (
          <MainMenu
            onPlayLocal={handlePlayLocal}
            onPlayOnline={handlePlayOnline}
            onPlayFriend={handlePlayFriend}
            onPlayBot={(level: BotLevel) => startBotGame(level)}
            invite={inviteId ? { onJoin: handleJoinInvite, onDismiss: clearInvite } : undefined}
          />
        ) : currentScreen === "searching" ? (
          <MatchmakingScreen
            playerId={playerId}
            playerNickname={playerNickname}
            onGameFound={handleGameFound}
            onCancel={handleCancelSearch}
          />
        ) : (
          <GameScreen />
        )}
      </main>
    </div>
  );
}

export default App;

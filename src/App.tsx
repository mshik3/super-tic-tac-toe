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
} from "./store/gameStore";
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
          <MainMenu onPlayLocal={handlePlayLocal} onPlayOnline={handlePlayOnline} />
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

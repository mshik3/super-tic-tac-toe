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
} from "./store/gameStore";
import { useGameStore } from "./store/gameStore";

function App() {
  const currentScreen = useCurrentScreen();
  const setGameMode = useSetGameMode();
  const setPlayerNickname = useSetPlayerNickname();
  const findOnlineGame = useFindOnlineGame();
  const connectToGame = useConnectToGame();
  const playerId = usePlayerId();
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
    setGameMode("local");
  };

  switch (currentScreen) {
    case "menu":
      return (
        <MainMenu
          onPlayLocal={handlePlayLocal}
          onPlayOnline={handlePlayOnline}
        />
      );

    case "searching":
      return (
        <MatchmakingScreen
          playerId={playerId}
          playerNickname={playerNickname}
          onGameFound={handleGameFound}
          onCancel={handleCancelSearch}
        />
      );

    case "playing":
      return <GameScreen />;

    default:
      return <GameScreen />;
  }
}

export default App;

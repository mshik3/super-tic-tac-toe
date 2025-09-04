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

function App() {
  const currentScreen = useCurrentScreen();
  const setGameMode = useSetGameMode();
  const setPlayerNickname = useSetPlayerNickname();
  const findOnlineGame = useFindOnlineGame();
  const connectToGame = useConnectToGame();
  const playerId = usePlayerId();

  const handlePlayLocal = () => {
    setGameMode("local");
  };

  const handlePlayOnline = (nickname: string) => {
    // Store nickname in game store and start search
    setPlayerNickname(nickname);
    findOnlineGame();
  };

  const handleGameFound = (gameId: string, playerSymbol: "X" | "O") => {
    connectToGame(gameId, playerSymbol);
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

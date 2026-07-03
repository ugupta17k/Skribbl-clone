import { useEffect, useState } from "react";
import Lobby from "./Components/Lobby";
import WordChoice from "./Components/Wordchoice";
import Canvas from "./Components/Canvas";
import Chat from "./Components/Chat";
import Auth from "./Auth";
import History from "./History";

type Player = { name: string; score: number };

export function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [inGame, setInGame] = useState(false);
  const [amIDrawer, setAmIDrawer] = useState(false);
  const [wordPicked, setWordPicked] = useState(false);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [hint, setHint] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [winner, setWinner] = useState<Player | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [showAuth, setShowAuth] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!wordPicked || gameOver || timeLeft <= 0) return;

    const timerId = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [wordPicked, gameOver, timeLeft]);

  function createSocket(currentPlayerName = playerName) {
    const token = localStorage.getItem("token");
    const socketUrl = token
      ? `ws://localhost:8080?token=${token}`
      : "ws://localhost:8080";

    const socket = new WebSocket(socketUrl);

    socket.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "round_start") {
        setInGame(true);
        setGameOver(false);
        setWordPicked(false);
        setTimeLeft(data.drawTime || 0);
        setCurrentRound(data.round || 1);
        setTotalRounds(data.totalRounds || 3);
        setAmIDrawer(data.drawer === currentPlayerName);
      }

      if (data.type === "choose_word") {
        setWordOptions(data.words);
      }

      if (data.type === "hint_update") {
        setHint(data.hint);
      }

      if (data.type === "game_started") {
        setWordPicked(true);
        setHint(data.hint);
        setTimeLeft(data.drawTime || 0);
        setCurrentRound(data.round || 1);
        setTotalRounds(data.totalRounds || 3);
        setWordOptions([]);
      }

      if (data.type === "guess_result" && data.players) {
        setPlayers(data.players);
      }

      if (data.type === "round_end") {
        setPlayers(data.players);
        setWordPicked(false);
        setTimeLeft(0);
        setWordOptions([]);
      }

      if (data.type === "game_over") {
        setGameOver(true);
        setInGame(false);
        setWordPicked(false);
        setTimeLeft(0);
        setWinner(data.winner || null);
        setPlayers(data.leaderboard || data.players || []);
      }
    });

    setWs(socket);
    return socket;
  }

  function startAgain() {
    if (!ws) return;

    setWinner(null);
    setPlayers([]);
    setGameOver(false);
    setWordPicked(false);
    setWordOptions([]);
    setTimeLeft(0);

    ws.send(JSON.stringify({ type: "start_game" }));
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {showHistory && <History onBack={() => setShowHistory(false)} />}

      {!showHistory && !showAuth && !inGame && !gameOver && (
        <Lobby
          createSocket={createSocket}
          ws={ws}
          onShowHistory={() => setShowHistory(true)}
          setPlayerName={setPlayerName}
        />
      )}

      {showAuth && !gameOver && (
        <Auth
          onLoginSuccess={() => {
            setShowAuth(false);
          }}
          onSkip={() => {
            setShowAuth(false);
          }}
        />
      )}

      {inGame && !wordPicked && amIDrawer && ws && (
        <WordChoice ws={ws} words={wordOptions} />
      )}

      {inGame && !wordPicked && !amIDrawer && (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-lg text-gray-600">
            Drawer word choose kar raha hai...
          </p>
        </div>
      )}

      {inGame && wordPicked && ws && (
        <div className="min-h-screen flex flex-col items-center p-6">
          <div className="w-full max-w-[980px] flex items-center justify-between mb-4 bg-white rounded-lg shadow px-5 py-3 text-gray-800">
            <p className="font-semibold">
              Round {currentRound} / {totalRounds}
            </p>
            <p className="text-xl font-bold text-red-500">{timeLeft}s</p>
            <p className="font-semibold">
              {amIDrawer ? "Your turn to draw" : "Guess the word"}
            </p>
          </div>

          {!amIDrawer && (
            <h3 className="text-2xl tracking-widest mb-4 font-bold">{hint}</h3>
          )}

          <div className="flex gap-4">
            <Canvas ws={ws} isDrawer={amIDrawer} />
            <Chat ws={ws} isDrawer={amIDrawer} />
          </div>
        </div>
      )}

      {gameOver && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md text-center min-w-80">
            <h2 className="text-2xl font-bold mb-4">Game Khatam!</h2>

            {winner && (
              <p className="text-lg font-semibold text-green-600 mb-4">
                Winner: {winner.name} ({winner.score} points)
              </p>
            )}

            <h3 className="font-semibold mb-2">Leaderboard:</h3>
            {players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <p key={i} className="py-1">
                  {i + 1}. {p.name} - {p.score} points
                </p>
              ))}

            <button
              className="mt-6 w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-lg transition"
              onClick={startAgain}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

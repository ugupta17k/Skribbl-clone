import { useState } from "react";

type Player = { name: string; score: number };
type PublicRoom = { roomId: string; playerCount: number };



function avatarColor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function Lobby({
  createSocket,
  ws,
  onShowHistory,
  setPlayerName,
}: {
  createSocket: (playerName?: string) => WebSocket;
  ws: WebSocket | null;
  onShowHistory: () => void;
  setPlayerName: (name: string) => void;
}) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [rounds, setRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(80);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function handleCreateRoom() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMsg("Enter your name first");
      return;
    }

    setErrorMsg("");
    setPlayerName(trimmedName);

    const socket = createSocket(trimmedName);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "create_room",
          hostName: trimmedName,
          isPublic,
          settings: { maxPlayers, rounds, drawTime },
        }),
      );
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "room_created") {
        setRoomId(data.roomId);
        setPlayers(data.players);
      }
      if (data.type === "player_joined") {
        setPlayers(data.players);
      }
    };
  }

  function handleJoinRoom(joinId?: string) {
    const trimmedName = name.trim();
    const targetRoomId = joinId || roomIdInput;

    if (!trimmedName) {
      setErrorMsg("Enter your name first");
      return;
    }

    if (!targetRoomId.trim()) {
      setErrorMsg("Enter a room code");
      return;
    }

    setErrorMsg("");
    setPlayerName(trimmedName);

    const socket = createSocket(trimmedName);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "join_room",
          roomId: targetRoomId.toUpperCase(),
          playerName: trimmedName,
        }),
      );
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "room_joined") {
        setRoomId(data.roomId);
        setPlayers(data.players);
      }
      if (data.type === "player_joined") {
        setPlayers(data.players);
      }
      if (data.type === "error") {
        setErrorMsg(data.message);
      }
    };
  }

  function loadPublicRooms() {
    setLoadingRooms(true);
    const socket = createSocket(name.trim());

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "get_public_rooms" }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "public_rooms_list") {
        setPublicRooms(data.rooms);
        setLoadingRooms(false);
      }
    };
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function startGame() {
    if (!ws) return;
    ws.send(JSON.stringify({ type: "start_game" }));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-orange-50 p-4">
      <div className="w-full max-w-md">
        <h1 className="text-center text-4xl font-black tracking-tight mb-6 select-none">
          Skribbl
        </h1>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {!roomId ? (
            <div>
              <div className="flex border-b border-gray-100">
                <button
                  className={
                    "flex-1 py-3 text-sm font-semibold transition " +
                    (tab === "create"
                      ? "text-violet-600 border-b-2 border-violet-600"
                      : "text-gray-400 hover:text-gray-600")
                  }
                  onClick={() => setTab("create")}
                >
                  Create Room
                </button>
                <button
                  className={
                    "flex-1 py-3 text-sm font-semibold transition " +
                    (tab === "join"
                      ? "text-violet-600 border-b-2 border-violet-600"
                      : "text-gray-400 hover:text-gray-600")
                  }
                  onClick={() => setTab("join")}
                >
                  Join Room
                </button>
              </div>

              <div className="p-6">
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />

                {errorMsg && (
                  <p className="text-rose-500 text-sm mb-3 -mt-2 bg-rose-50 px-3 py-2 rounded-lg">
                    {errorMsg}
                  </p>
                )}

                {tab === "create" ? (
                  <div>
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-4">
                      <label className="flex items-center justify-between text-sm text-gray-700">
                        <span>Public room</span>
                        <input
                          type="checkbox"
                          checked={isPublic}
                          onChange={(e) => setIsPublic(e.target.checked)}
                          className="w-4 h-4 accent-violet-600"
                        />
                      </label>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Max Players</span>
                          <span className="font-semibold text-gray-700">
                            {maxPlayers}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="20"
                          value={maxPlayers}
                          onChange={(e) =>
                            setMaxPlayers(Number(e.target.value))
                          }
                          className="w-full accent-violet-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Rounds</span>
                          <span className="font-semibold text-gray-700">
                            {rounds}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={rounds}
                          onChange={(e) => setRounds(Number(e.target.value))}
                          className="w-full accent-violet-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Draw Time</span>
                          <span className="font-semibold text-gray-700">
                            {drawTime}s
                          </span>
                        </div>
                        <input
                          type="range"
                          min="15"
                          max="240"
                          value={drawTime}
                          onChange={(e) => setDrawTime(Number(e.target.value))}
                          className="w-full accent-violet-600"
                        />
                      </div>
                    </div>

                    <button
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-lg transition"
                      onClick={handleCreateRoom}
                    >
                      Create Room
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 mb-3 text-sm tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-violet-400"
                      placeholder="Room code"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value)}
                    />

                    <button
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-lg mb-4 transition"
                      onClick={() => handleJoinRoom()}
                    >
                      Join Room
                    </button>

                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        Public Rooms
                      </p>
                      <button
                        className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                        onClick={loadPublicRooms}
                      >
                        {loadingRooms ? "Loading..." : "Refresh"}
                      </button>
                    </div>

                    {publicRooms.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No public rooms yet - tap refresh
                      </p>
                    )}

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {publicRooms.map((r, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <span className="text-sm font-medium text-gray-700">
                            {r.roomId}{" "}
                            <span className="text-gray-400 font-normal">
                              - {r.playerCount} playing
                            </span>
                          </span>
                          <button
                            className="bg-violet-100 text-violet-700 hover:bg-violet-200 px-3 py-1 rounded-md text-xs font-semibold transition"
                            onClick={() => handleJoinRoom(r.roomId)}
                          >
                            Join
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-5 underline"
                  onClick={onShowHistory}
                >
                  View my game history
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Room Code
              </p>

              <button
                onClick={copyRoomCode}
                className="w-full flex items-center justify-center gap-2 mb-6 group"
              >
                <span className="text-3xl font-black tracking-[0.3em] text-violet-600">
                  {roomId}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-violet-500 transition">
                  {copied ? "copied" : "copy"}
                </span>
              </button>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Players ({players.length})
              </p>

              <ul className="space-y-2 mb-6 max-h-56 overflow-y-auto">
                {players.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <span
                      className={
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold " +
                        avatarColor(p.name)
                      }
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      {p.name}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-lg transition"
                onClick={startGame}
              >
                Start Game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Lobby;

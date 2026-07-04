import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { existsSync } from 'fs';
import { prisma } from './lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
const PORT = process.env.PORT || 8080;
const frontendDistPath = path.resolve(import.meta.dir, '../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = app.listen(PORT, () => {
  console.log('server is running on port ' + PORT);
});

const wss = new WebSocketServer({ server: httpServer });

const rooms: any = {};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms[id] ? generateRoomId() : id;
}

function broadcastToRoom(roomId: string, data: any) {
  wss.clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN && client.roomId === roomId) {
      client.send(JSON.stringify(data));
    }
  });
}

async function getRandomWords() {
  const allWords = await prisma.word.findMany();
  const shuffled = allWords.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((w) => w.text);
}

function startHintTimer(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  const word = room.currentWord;
  let hintsGiven = 0;
  const maxHints = Math.min(3, word.length - 1);

  const interval = setInterval(() => {
    if (!rooms[roomId] || rooms[roomId].currentWord !== word) {
      clearInterval(interval);
      return;
    }
    if (hintsGiven >= maxHints) {
      clearInterval(interval);
      return;
    }

    const hiddenIndexes = room.hintArray
      .map((char: string, i: number) => (char === '_' ? i : -1))
      .filter((i: number) => i !== -1);

    if (hiddenIndexes.length === 0) {
      clearInterval(interval);
      return;
    }

    const randomIndex = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)];
    room.hintArray[randomIndex] = word[randomIndex];
    hintsGiven++;

    broadcastToRoom(roomId, { type: 'hint_update', hint: room.hintArray.join(' ') });
  }, 15000);

  room.hintInterval = interval;
}

async function endRound(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.hintInterval) clearInterval(room.hintInterval);
  if (room.roundTimeout) clearTimeout(room.roundTimeout);

  const endedWord = room.currentWord;
  room.currentWord = '';

  room.drawerIndex = room.drawerIndex + 1;

  if (room.drawerIndex >= room.players.length) {
    room.drawerIndex = 0;
    room.round = room.round + 1;
  }

  if (room.round > room.totalRounds) {
    const winner = room.players.reduce((max: any, p: any) => (p.score > max.score ? p : max), room.players[0]);

    broadcastToRoom(roomId, {
      type: 'game_over',
      winner,
      players: room.players,
      leaderboard: room.players.slice().sort((a: any, b: any) => b.score - a.score),
    });

    wss.clients.forEach(async (client: any) => {
      if (client.roomId === roomId && client.userId) {
        const player = room.players.find((p: any) => p.name === client.playerName);
        if (player) {
          try {
            await prisma.gameHistory.create({
              data: {
                roomId: roomId,
                score: player.score,
                won: player.name === winner.name,
                userId: client.userId,
              },
            });
          } catch (err) {
            console.log('error saving history:', err);
          }
        }
      }
    });

    return;
  }

  broadcastToRoom(roomId, { type: 'round_end', word: endedWord, players: room.players });

  setTimeout(async () => {
    const drawerPlayer = room.players[room.drawerIndex];
    broadcastToRoom(roomId, {
      type: 'round_start',
      drawer: drawerPlayer.name,
      round: room.round,
      totalRounds: room.totalRounds,
      drawTime: room.drawTime,
    });

    const wordOptions = await getRandomWords();

    wss.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId && client.playerName === drawerPlayer.name) {
        client.send(JSON.stringify({ type: 'choose_word', words: wordOptions }));
      }
    });
  }, 3000);
}

wss.on('connection', function connection(ws: any, req) {
  console.log('user connected');

  const url = new URL(req.url || '', 'http://' + req.headers.host);
  const token = url.searchParams.get('token');

  if (token) {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      ws.userId = decoded.userId;
    } catch (err) {
      console.log('invalid token, treating connection as guest');
    }
  }

  ws.on('message', async (message: any) => {
    const data = JSON.parse(message.toString());
    console.log('received:', data.type);

    if (data.type === 'create_room') {
      const roomId = generateRoomId();

      rooms[roomId] = {
        hostName: data.hostName,
        players: [{ name: data.hostName, score: 0 }],
        drawerIndex: 0,
        currentWord: '',
        round: 1,
        totalRounds: data.settings?.rounds || 3,
        maxPlayers: data.settings?.maxPlayers || 8,
        drawTime: data.settings?.drawTime || 80,
        isPublic: data.isPublic || false,
        hintArray: [],
      };

      ws.roomId = roomId;
      ws.playerName = data.hostName;

      ws.send(JSON.stringify({ type: 'room_created', roomId, players: rooms[roomId].players }));
    }

    else if (data.type === 'join_room') {
      const room = rooms[data.roomId];

      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
      }

      room.players.push({ name: data.playerName, score: 0 });

      ws.roomId = data.roomId;
      ws.playerName = data.playerName;

      ws.send(JSON.stringify({ type: 'room_joined', roomId: data.roomId, players: room.players }));

      broadcastToRoom(data.roomId, { type: 'player_joined', players: room.players });
    }

    else if (data.type === 'get_public_rooms') {
      const publicRoomsList = Object.keys(rooms)
        .filter((id) => rooms[id].isPublic && rooms[id].players.length < rooms[id].maxPlayers)
        .map((id) => ({ roomId: id, playerCount: rooms[id].players.length }));

      ws.send(JSON.stringify({ type: 'public_rooms_list', rooms: publicRoomsList }));
    }

    else if (data.type === 'start_game') {
      const roomId = ws.roomId;
      const room = rooms[roomId];
      if (!room) return;

      room.drawerIndex = 0;
      room.round = 1;
      room.currentWord = '';
      room.hintArray = [];
      room.players = room.players.map((player: any) => ({ ...player, score: 0 }));

      if (room.hintInterval) clearInterval(room.hintInterval);
      if (room.roundTimeout) clearTimeout(room.roundTimeout);

      const drawerPlayer = room.players[room.drawerIndex];

        broadcastToRoom(roomId, {
          type: 'round_start',
          drawer: drawerPlayer.name,
          round: room.round,
          totalRounds: room.totalRounds,
          drawTime: room.drawTime,
        });

        try {
          const wordOptions = await getRandomWords();
          console.log('word options:', wordOptions);
          console.log('looking for drawer named:', drawerPlayer.name);

          let sent = false;
          wss.clients.forEach((client: any) => {
            console.log('checking client - roomId:', client.roomId, 'playerName:', client.playerName);
            if (client.readyState === WebSocket.OPEN && client.roomId === roomId && client.playerName === drawerPlayer.name) {
              client.send(JSON.stringify({ type: 'choose_word', words: wordOptions }));
              sent = true;
            }
          });

          console.log('word options sent?', sent);
        } catch (err) {
          console.log('ERROR:', err);
        }
    }

    else if (data.type === 'word_chosen') {
      const roomId = ws.roomId;
      const room = rooms[roomId];
      if (!room) return;

      room.currentWord = data.word;
      room.hintArray = data.word.split('').map(() => '_');

      broadcastToRoom(roomId, {
        type: 'game_started',
        hint: room.hintArray.join(' '),
        round: room.round,
        totalRounds: room.totalRounds,
        drawTime: room.drawTime,
      });

      startHintTimer(roomId);

      room.roundTimeout = setTimeout(() => {
        if (rooms[roomId] && rooms[roomId].currentWord === data.word) {
          endRound(roomId);
        }
      }, room.drawTime * 1000);
    }

    else if (data.type === 'draw_data') {
      broadcastToRoom(ws.roomId, { type: 'draw_data', stroke: data.stroke });
    }

    else if (data.type === 'clear_canvas') {
      broadcastToRoom(ws.roomId, { type: 'clear_canvas' });
    }

    else if (data.type === 'redraw_canvas') {
      broadcastToRoom(ws.roomId, { type: 'redraw_canvas', strokes: data.strokes });
    }

    else if (data.type === 'guess') {
      const roomId = ws.roomId;
      const room = rooms[roomId];
      if (!room) return;
      if (!room.currentWord) return;

      const guess = data.text.trim().toLowerCase();
      const actualWord = room.currentWord.trim().toLowerCase();

      if (guess === actualWord) {
        const player = room.players.find((p: any) => p.name === ws.playerName);
        if (player) player.score += 10;

        broadcastToRoom(roomId, { type: 'guess_result', playerName: ws.playerName, correct: true, players: room.players });

        endRound(roomId);
      } else {
        broadcastToRoom(roomId, { type: 'chat_message', playerName: ws.playerName, text: data.text });
      }
    }
  });

  ws.on('close', () => {
    const roomId = ws.roomId;
    const playerName = ws.playerName;

    const room = rooms[roomId];
    if (!room) return;

    room.players = room.players.filter((p: any) => p.name !== playerName);

    broadcastToRoom(roomId, { type: 'player_left', players: room.players });

    if (room.players.length === 0) {
      if (room.hintInterval) clearInterval(room.hintInterval);
      if (room.roundTimeout) clearTimeout(room.roundTimeout);
      delete rooms[roomId];
    }
  });
});

function verifyToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) return res.status(400).json({ error: 'Username already taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({ data: { username, password: hashedPassword } });
    const token = jwt.sign({ userId: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Registered successfully', token, userId: newUser.id, username: newUser.username });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(400).json({ error: 'Incorrect password' });

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, userId: user.id, username: user.username });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.get('/my-history', verifyToken, async (req: any, res) => {
  try {
    const history = await prisma.gameHistory.findMany({ where: { userId: req.user.userId }, orderBy: { playedAt: 'desc' } });
    res.json(history);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.use(express.static(frontendDistPath));

app.get(/.*/, (req, res) => {
  if (existsSync(frontendIndexPath) && req.accepts('html')) {
    res.sendFile(frontendIndexPath);
    return;
  }

  res.send('Skribbl clone backend is running');
});

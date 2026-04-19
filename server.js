const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4'
};

const server = http.createServer((req, res) => {
  console.log(`HTTP request: ${req.method} ${req.url}`);
  
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server started on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomById(roomId) {
  return rooms.get(roomId);
}

function createRoom(playerName) {
  const roomId = generateRoomId();
  const room = {
    id: roomId,
    players: [],
    ships: [null, null],
    gameStarted: false,
    currentTurn: 1
  };
  rooms.set(roomId, room);
  return { roomId, room };
}

function joinRoom(roomId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Комната не найдена' };
  if (room.players.length >= 2) return { error: 'Комната полна' };
  if (room.gameStarted) return { error: 'Игра уже началась' };
  return { room, playerNum: 2 };
}

function getOpponent(room, playerNum) {
  const opponentNum = playerNum === 1 ? 2 : 1;
  return room.players.find(p => p.playerNum === opponentNum);
}

function broadcast(room, message, excludePlayerNum = null) {
  room.players.forEach(player => {
    if (player.playerNum !== excludePlayerNum && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  console.log('New WebSocket connection from:', ws.upgradeReq?.headers?.host || 'unknown');
  let currentRoom = null;
  let currentPlayer = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received:', message.type, 'from player');

      switch (message.type) {
        case 'create-room': {
          const { roomId, room } = createRoom(message.playerName);
          currentRoom = room;
          currentPlayer = {
            ws,
            playerNum: 1,
            name: message.playerName
          };
          room.players.push(currentPlayer);
          ws.send(JSON.stringify({
            type: 'room-created',
            roomId,
            playerNum: 1
          }));
          console.log(`Room ${roomId} created by player 1`);
          break;
        }

        case 'join-room': {
          const result = joinRoom(message.roomId, message.playerName);
          if (result.error) {
            ws.send(JSON.stringify({ type: 'error', message: result.error }));
            return;
          }
          currentRoom = result.room;
          currentPlayer = {
            ws,
            playerNum: 2,
            name: message.playerName
          };
          result.room.players.push(currentPlayer);
          ws.send(JSON.stringify({
            type: 'room-joined',
            roomId: message.roomId,
            playerNum: 2
          }));
          
          const player1 = result.room.players.find(p => p.playerNum === 1);
          if (player1 && player1.ws.readyState === WebSocket.OPEN) {
            player1.ws.send(JSON.stringify({
              type: 'player-joined',
              playerName: message.playerName,
              player2Name: message.playerName
            }));
          }
          
          ws.send(JSON.stringify({
            type: 'player-joined',
            playerName: player1 ? player1.name : 'Игрок 1',
            player2Name: message.playerName
          }));
          
          console.log(`Player 2 joined room ${message.roomId}`);
          break;
        }

        case 'ships-ready': {
          if (!currentRoom || !currentPlayer) return;
          
          currentRoom.ships[currentPlayer.playerNum - 1] = message.ships;
          
          const player1 = currentRoom.players.find(p => p.playerNum === 1);
          const player2 = currentRoom.players.find(p => p.playerNum === 2);
          
          if (player1 && player2) {
            const bothReady = currentRoom.ships[0] && currentRoom.ships[1];
            
            if (player1.ws && player1.ws.readyState === WebSocket.OPEN) {
              player1.ws.send(JSON.stringify({
                type: 'ships-status',
                opponentReady: !!currentRoom.ships[1],
                bothReady
              }));
              if (currentRoom.ships[1]) {
                player1.ws.send(JSON.stringify({
                  type: 'opponent-ships',
                  ships: currentRoom.ships[1]
                }));
              }
            }
            if (player2.ws && player2.ws.readyState === WebSocket.OPEN) {
              player2.ws.send(JSON.stringify({
                type: 'ships-status',
                opponentReady: !!currentRoom.ships[0],
                bothReady
              }));
            }
            
            if (bothReady && !currentRoom.gameStarted) {
              currentRoom.gameStarted = true;
              currentRoom.currentTurn = 1;
              
              if (player1.ws && player1.ws.readyState === WebSocket.OPEN) {
                player1.ws.send(JSON.stringify({ type: 'game-start', currentTurn: 1 }));
              }
              if (player2.ws && player2.ws.readyState === WebSocket.OPEN) {
                player2.ws.send(JSON.stringify({ 
                  type: 'game-start', 
                  currentTurn: 2,
                  opponentShips: currentRoom.ships[0]
                }));
              }
              console.log(`Game started in room ${currentRoom.id}`);
            }
          }
          break;
        }

        case 'player-move': {
          if (!currentRoom || !currentPlayer) return;
          
          const opponent = getOpponent(currentRoom, currentPlayer.playerNum);
          if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({
              type: 'opponent-move',
              x: message.x,
              y: message.y,
              hit: message.hit,
              sunk: message.sunk,
              shipCells: message.shipCells
            }));
          }
          break;
        }

        case 'change-turn': {
          if (!currentRoom || !currentPlayer) return;
          
          currentRoom.currentTurn = currentPlayer.playerNum === 1 ? 2 : 1;
          
          const opponent = getOpponent(currentRoom, currentPlayer.playerNum);
          if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({
              type: 'your-turn'
            }));
          }
          break;
        }

        case 'game-over': {
          if (!currentRoom || !currentPlayer) return;
          
          const opponent = getOpponent(currentRoom, currentPlayer.playerNum);
          if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({
              type: 'game-over',
              winner: message.winner
            }));
          }
          break;
        }

        case 'rematch-request': {
          if (!currentRoom || !currentPlayer) return;
          
          const opponent = getOpponent(currentRoom, currentPlayer.playerNum);
          if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({
              type: 'rematch-request',
              from: currentPlayer.name
            }));
          }
          break;
        }

        case 'rematch-accept': {
          if (!currentRoom || !currentPlayer) return;
          
          currentRoom.ships = [null, null];
          currentRoom.gameStarted = false;
          
          const opponent = getOpponent(currentRoom, currentPlayer.playerNum);
          if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({ type: 'rematch-accepted' }));
          }
          ws.send(JSON.stringify({ type: 'rematch-accepted' }));
          console.log(`Rematch accepted in room ${currentRoom.id}`);
          break;
        }

        case 'disconnect': {
          if (currentRoom && currentPlayer) {
            const opponent = getOpponent(currentRoom, currentPlayer.playerNum);
            if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
              opponent.ws.send(JSON.stringify({
                type: 'player-disconnected',
                playerNum: currentPlayer.playerNum
              }));
            }
          }
          break;
        }
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentPlayer) {
      console.log(`Player ${currentPlayer.playerNum} disconnected from room ${currentRoom.id}`);
      
      const opponent = getOpponent(currentRoom, currentPlayer.playerNum);
      if (opponent && opponent.ws && opponent.ws.readyState === WebSocket.OPEN) {
        opponent.ws.send(JSON.stringify({
          type: 'player-disconnected',
          playerNum: currentPlayer.playerNum
        }));
      }
      
      const remainingPlayers = currentRoom.players.filter(p => p.ws.readyState === WebSocket.OPEN);
      if (remainingPlayers.length === 0) {
        rooms.delete(currentRoom.id);
        console.log(`Room ${currentRoom.id} deleted (empty)`);
      }
    }
  });
});

console.log('WebSocket server started on port 3000');
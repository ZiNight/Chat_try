const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

// rooms[roomId] = Set of WebSocket clients
const rooms = {};

wss.on("connection", (ws) => {
  let currentRoom = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // JOIN room
    if (msg.type === "join") {
      const roomId = String(msg.room).trim().slice(0, 32);
      if (!roomId) return;

      currentRoom = roomId;
      if (!rooms[roomId]) rooms[roomId] = new Set();
      rooms[roomId].add(ws);

      const count = rooms[roomId].size;

      // Tell this client how many people are in the room
      ws.send(JSON.stringify({ type: "room_info", count }));

      // Tell the other person someone joined
      rooms[roomId].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "peer_joined" }));
        }
      });

      return;
    }

    // RELAY encrypted message — server never decrypts, just forwards
    if (msg.type === "message" && currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "message",
            cipher: msg.cipher,   // encrypted bytes (hex)
            iv: msg.iv,           // IV (hex)
            pubKey: msg.pubKey,   // sender public key (for key exchange)
          }));
        }
      });
      return;
    }

    // PUBLIC KEY exchange
    if (msg.type === "pubkey" && currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "pubkey", key: msg.key }));
        }
      });
    }
  });

  ws.on("close", () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].delete(ws);
      if (rooms[currentRoom].size === 0) {
        delete rooms[currentRoom];
      } else {
        rooms[currentRoom].forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "peer_left" }));
          }
        });
      }
    }
  });
});

console.log(`SecureChat server running on port ${PORT}`);

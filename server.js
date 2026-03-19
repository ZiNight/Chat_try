const WebSocket = require("ws");
const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

// users[id] = { ws, pubkey }
const users = {};

wss.on("connection", (ws) => {
  let myId = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Registrarse con un ID
    if (msg.type === "register") {
      myId = String(msg.id).trim().slice(0, 8).toUpperCase();
      users[myId] = { ws, pubkey: msg.pubkey || "" };
      return;
    }

    // Enviar solicitud de chat a otro usuario
    if (msg.type === "request") {
      const peer = users[msg.to];
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ type: "request", from: msg.from, name: msg.name }));
      }
      return;
    }

    // Aceptar solicitud — enviar nuestra pubkey al solicitante
    if (msg.type === "accept") {
      const peer = users[msg.to];
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ type: "accepted", pubkey: msg.pubkey }));
      }
      return;
    }

    // Rechazar solicitud
    if (msg.type === "reject") {
      const peer = users[msg.to];
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ type: "rejected" }));
      }
      return;
    }

    // Cancelar solicitud pendiente
    if (msg.type === "cancel") {
      const peer = users[msg.to];
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ type: "cancelled" }));
      }
      return;
    }

    // Relay de mensaje cifrado — servidor nunca descifra
    if (msg.type === "message") {
      const peer = users[msg.to];
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ type: "message", cipher: msg.cipher, iv: msg.iv }));
      }
      return;
    }

    // Relay de typing
    if (msg.type === "typing") {
      const peer = users[msg.to];
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ type: "typing" }));
      }
      return;
    }

    // Relay de pubkey (intercambio adicional si es necesario)
    if (msg.type === "pubkey") {
      const peer = users[msg.to];
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ type: "pubkey", key: msg.key }));
      }
      return;
    }
  });

  ws.on("close", () => {
    if (myId && users[myId]) {
      delete users[myId];
    }
  });
});

console.log(`SecureChat server running on port ${PORT}`);

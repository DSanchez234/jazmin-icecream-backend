const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store the latest location and tracking state in memory
let latestLocation = null;
let isTracking = false;

// Broadcast to all connected website clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = OPEN
      client.send(message);
    }
  });
}

// POST /location — called by the React Native app
app.post("/location", (req, res) => {
  const { latitude, longitude, tracking } = req.body;

  if (typeof tracking === "boolean") {
    isTracking = tracking;
  }

  if (isTracking && latitude && longitude) {
    latestLocation = { latitude, longitude, timestamp: Date.now() };
    broadcast({ type: "location", ...latestLocation, isTracking });
  } else if (!isTracking) {
    latestLocation = null;
    broadcast({ type: "status", isTracking: false });
  }

  res.json({ ok: true });
});

// GET /status — website can poll this on first load
app.get("/status", (req, res) => {
  res.json({ isTracking, location: latestLocation });
});

// WebSocket connection from website
wss.on("connection", (ws) => {
  console.log("Website client connected");
  // Send current state immediately on connect
  ws.send(
    JSON.stringify({
      type: isTracking ? "location" : "status",
      isTracking,
      ...(latestLocation || {}),
    })
  );
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`GPS server running on port ${PORT}`);
});
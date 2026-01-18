const http = require("http");
const url = require("url");
const crypto = require("crypto");
const { Simulation } = require("./simulation");

const PORT = process.env.PORT || 4000;
const RANDOMNESS = Number(process.env.SIM_RANDOMNESS || "1");

const simulations = new Map();

function createServer() {
  const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url || "", true);
    if (parsed.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (parsed.pathname && parsed.pathname.startsWith("/simulations/") && parsed.pathname.endsWith("/export") && req.method === "GET") {
      const parts = parsed.pathname.split("/");
      const simId = parts[2];
      const sim = simulations.get(simId);
      if (!sim) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "simulation not found" }));
        return;
      }
      const csv = sim.toCsv();
      res.writeHead(200, {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${simId}.csv"`
      });
      res.end(csv);
      return;
    }

    // POST /simulations/:id/brain-mode - Toggle brain auto/manual mode
    if (parsed.pathname && parsed.pathname.match(/^\/simulations\/[^\/]+\/brain-mode$/) && req.method === "POST") {
      const parts = parsed.pathname.split("/");
      const simId = parts[2];
      const sim = simulations.get(simId);
      if (!sim) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "simulation not found" }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          sim.brain.setAutoMode(data.autoMode === true);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, autoMode: sim.brain.autoMode }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid JSON" }));
        }
      });
      return;
    }

    // POST /simulations/:id/broadcast - Execute pending instruction
    if (parsed.pathname && parsed.pathname.match(/^\/simulations\/[^\/]+\/broadcast$/) && req.method === "POST") {
      const parts = parsed.pathname.split("/");
      const simId = parts[2];
      const sim = simulations.get(simId);
      if (!sim) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "simulation not found" }));
        return;
      }

      const success = sim.broadcastPendingInstruction();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success }));
      return;
    }

    // POST /simulations/:id/reject - Reject pending instruction
    if (parsed.pathname && parsed.pathname.match(/^\/simulations\/[^\/]+\/reject$/) && req.method === "POST") {
      const parts = parsed.pathname.split("/");
      const simId = parts[2];
      const sim = simulations.get(simId);
      if (!sim) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "simulation not found" }));
        return;
      }

      const success = sim.rejectPendingInstruction();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success }));
      return;
    }

    // GET /simulations/:id/conflicts - Get current conflicts
    if (parsed.pathname && parsed.pathname.match(/^\/simulations\/[^\/]+\/conflicts$/) && req.method === "GET") {
      const parts = parsed.pathname.split("/");
      const simId = parts[2];
      const sim = simulations.get(simId);
      if (!sim) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "simulation not found" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ conflicts: sim.brain.getCurrentConflicts() }));
      return;
    }

    // GET /simulations/:id/instructions - Get instruction history
    if (parsed.pathname && parsed.pathname.match(/^\/simulations\/[^\/]+\/instructions$/) && req.method === "GET") {
      const parts = parsed.pathname.split("/");
      const simId = parts[2];
      const sim = simulations.get(simId);
      if (!sim) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "simulation not found" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ instructions: sim.brain.getInstructionHistory(50) }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.on("upgrade", (req, socket) => {
    const parsed = url.parse(req.url || "", true);
    if (parsed.pathname !== "/simulations/live") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    const accept = generateAcceptValue(key.toString());
    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`
    ];
    socket.write(headers.concat("\r\n").join("\r\n"));

    const sim = new Simulation({
      randomness: RANDOMNESS,
      numAircraft: 3
    });
    simulations.set(sim.id, sim);

    const interval = setInterval(() => {
      try {
        const tick = sim.step();
        const payload = JSON.stringify(tick);
        const frame = encodeWebSocketFrame(payload);
        socket.write(frame);
      } catch (err) {
        clearInterval(interval);
        socket.destroy();
      }
    }, 1000);

    socket.on("close", () => {
      clearInterval(interval);
      simulations.delete(sim.id);
    });

    socket.on("error", () => {
      clearInterval(interval);
      simulations.delete(sim.id);
    });

    socket.on("data", () => { });
  });

  return server;
}

function generateAcceptValue(secWebSocketKey) {
  return crypto
    .createHash("sha1")
    .update(secWebSocketKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11", "binary")
    .digest("base64");
}

function encodeWebSocketFrame(data) {
  const json = typeof data === "string" ? data : JSON.stringify(data);
  const payload = Buffer.from(json);
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

const server = createServer();
server.listen(PORT, () => {
  console.log(`Simulation server listening on http://localhost:${PORT}`);
});

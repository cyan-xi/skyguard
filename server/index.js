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

    if (parsed.pathname === "/webhook/atc-logs" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          console.log("Received ATC Log:", data);

          // Inject into the active simulation(s) transcript if possible
          const firstSim = simulations.values().next().value;
          if (firstSim) {
            firstSim.addExternalTranscript(data.callsign, data.message);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "logged" }));
        } catch (e) {
          console.error("Invalid JSON in webhook", e);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
      return;
    }

    if (parsed.pathname === "/webhook/anomalies" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          console.log("Received External Anomaly:", data);

          const firstSim = simulations.values().next().value;
          if (firstSim) {
            firstSim.addExternalAnomaly(data);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "logged" }));
        } catch (e) {
          console.error("Invalid JSON in webhook", e);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
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
      numAircraft: 8
    });
    simulations.set(sim.id, sim);

    const interval = setInterval(async () => {
      try {
        const tick = sim.step();

        // --- Integration with MCP for Safety Checks ---
        // We only check for one aircraft per tick to avoid spamming the MCP
        // or check all periodically. Let's try checking the first active aircraft.
        if (sim.aircraft.length > 0) {
          const ac = sim.aircraft[Math.floor(Math.random() * sim.aircraft.length)];
          const traffic = sim.aircraft; // Pass all

          // Prepare payload for MCP
          const payload = {
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
              name: "checkSeparation",
              arguments: {
                aircraft: {
                  callsign: ac.callsign,
                  position: { lat: ac.lat, lon: ac.lon, alt: ac.altitudeFt },
                  speed: ac.groundSpeedKt,
                  heading: ac.headingDeg
                },
                traffic: traffic.map(t => ({
                  callsign: t.callsign,
                  position: { lat: t.lat, lon: t.lon, alt: t.altitudeFt },
                  speed: t.groundSpeedKt,
                  heading: t.headingDeg
                }))
              }
            },
            id: 1
          };

          if (globalThis.fetch) {
            fetch("http://localhost:3001/mcp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            }).then(r => r.json()).then(resp => {
              if (resp.result && resp.result.content && resp.result.content[0].text) {
                const result = JSON.parse(resp.result.content[0].text);
                if (result.status === "UNSAFE" || result.status === "WARNING") {
                  sim.addExternalAnomaly({
                    type: "MCP_SAFETY_ALERT",
                    severity: result.status === "UNSAFE" ? "critical" : "high",
                    description: result.message,
                    aircraftIds: [ac.callsign]
                  });
                }
              }
            }).catch(e => { /* ignore connection errors */ });
          }
        }

        const payload = JSON.stringify(tick);
        const frame = encodeWebSocketFrame(payload);
        socket.write(frame);
      } catch (err) {
        clearInterval(interval);
        try { socket.destroy(); } catch (e) { }
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

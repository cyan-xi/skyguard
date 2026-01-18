import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { useSimulationStream } from "./hooks/useSimulationStream";
import type {
  Anomaly,
  BroadcastDecision,
  McpBuffer,
  McpFrame,
  SimulationTick,
  TranscriptMessage
} from "./types";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { SkyMap2D } from "./components/SkyMap2D";
import { SuggestedMessagePanel } from "./components/SuggestedMessagePanel";
import { AnomaliesPanel } from "./components/AnomaliesPanel";

const SIM_WS_URL = "ws://localhost:4000/simulations/live";

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function App() {
  const { tick, connectionStatus, error } = useSimulationStream({
    url: SIM_WS_URL
  });

  const [decisionState, setDecisionState] = useState<BroadcastDecision>("idle");
  const mcpBufferRef = useRef<McpBuffer>([]);

  const aircraft = tick?.aircraft ?? [];
  const anomalies: Anomaly[] = tick?.anomalies ?? [];
  const transcript: TranscriptMessage[] = tick?.transcript ?? [];
  const suggestedMessage = tick?.suggestedMessage;

  const statusLabel = useMemo(() => {
    if (error) return "ERROR";
    switch (connectionStatus) {
      case "connecting":
        return "CONNECTING";
      case "open":
        return "LIVE";
      case "closed":
        return "DISCONNECTED";
      case "error":
      default:
        return "ERROR";
    }
  }, [connectionStatus, error]);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const utcTime = useMemo(() => {
    const d = now;
    const hours = pad2(d.getUTCHours());
    const minutes = pad2(d.getUTCMinutes());
    const seconds = pad2(d.getUTCSeconds());
    return `${hours}:${minutes}:${seconds}Z`;
  }, [now]);

  const utcDate = useMemo(() => {
    const d = now;
    const year = d.getUTCFullYear();
    const month = pad2(d.getUTCMonth() + 1);
    const day = pad2(d.getUTCDate());
    return `${year}-${month}-${day}`;
  }, [now]);

  const handleBroadcast = useCallback(async () => {
    if (!suggestedMessage) return;
    setDecisionState("pending");
    await new Promise(resolve => setTimeout(resolve, 250));
    setDecisionState("broadcasted");
  }, [suggestedMessage]);

  const handleReject = useCallback(() => {
    if (!suggestedMessage) return;
    setDecisionState("rejected");
  }, [suggestedMessage]);

  useEffect(() => {
    if (!tick) return;
     const anomaliesFromTick = tick.anomalies;
     const transcriptFromTick = tick.transcript;
     const suggestedFromTick = tick.suggestedMessage;
    const frame: McpFrame = {
      simId: tick.simId,
      simTimeSec: tick.simTimeSec,
      aircraft: tick.aircraft,
      anomalies: anomaliesFromTick,
      transcript: transcriptFromTick,
      suggestedMessage: suggestedFromTick,
      decisionState
    };
    const prev = mcpBufferRef.current;
    const next = [...prev, frame];
    const maxLength = 300;
    if (next.length > maxLength) {
      next.splice(0, next.length - maxLength);
    }
    mcpBufferRef.current = next;
    if (typeof window !== "undefined") {
      const w = window as typeof window & { __WOOD_WIDE_MCP_BUFFER__: McpBuffer };
      w.__WOOD_WIDE_MCP_BUFFER__ = next;
    }
  }, [tick, decisionState]);

  return (
    <>
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="top-title">SkyGuard AI</div>
          <div className="top-subtitle">Automated Air Traffic Control</div>
        </div>
        <div className="top-bar-right">
          <div className="status-chip">{statusLabel}</div>
          <div id="utc-time" className="utc-time">
            {utcTime}
          </div>
          <div id="utc-date" className="utc-date">
            {utcDate}
          </div>
        </div>
        <div className="top-names-block">
          <div className="top-names">
            Chelsea Yan · Jeffrey Moon · Lucas Yuan · Milena Martan
          </div>
          <div className="top-affiliation">UPenn</div>
        </div>
      </div>
      <div id="app">
        <div className="column transcript-column">
          <div className="panel-header">Transcript – Radio Communications</div>
          <div className="panel-content transcript-list">
            <TranscriptPanel messages={transcript} />
          </div>
        </div>
        <div className="column map-column">
          <div className="panel-header">Traffic Scope – Beaver County Airport</div>
          <div className="map-scope">
            <img
              id="airport-image"
              className="map-image"
              src="/beaver_airport.png"
              alt="Beaver County Airport"
            />
            <div className="map-dark-overlay"></div>
            <div className="crt-overlay"></div>
            <div className="map-status-badge">LIVE RADAR / KBVI</div>
            <div id="map-overlay" className="map-overlay">
              <SkyMap2D aircraft={aircraft} anomalies={anomalies} />
            </div>
          </div>
        </div>
        <div className="column right-column">
          <div className="panel suggested-panel">
            <div className="panel-header">SkyGuard Suggested Message</div>
            <div className="panel-content">
              <SuggestedMessagePanel
                suggestedMessage={suggestedMessage}
                decisionState={decisionState}
                onBroadcast={handleBroadcast}
                onReject={handleReject}
                simId={(tick as SimulationTick | null)?.simId}
              />
            </div>
          </div>
          <div className="panel anomalies-panel">
            <div className="panel-header">Anomalies – Traffic Dangers</div>
            <div className="panel-content anomalies-list">
              <AnomaliesPanel anomalies={anomalies} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

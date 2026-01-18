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

  const statusClass = useMemo(() => {
    if (error || connectionStatus === "error") return "status-badge-error";
    if (connectionStatus === "closed") return "status-badge-closed";
    if (connectionStatus === "open") return "status-badge-live";
    return "status-badge-connecting";
  }, [connectionStatus, error]);

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
    <div className="app-root">
      <header className="app-header">
        <div className="app-title">
          <span className="app-title-main">ATC MCP</span>
          <span className="app-title-sub">Automated Tower Console</span>
        </div>
        <div className="app-header-right">
          <div className={`status-badge ${statusClass}`}>{statusLabel}</div>
          <div className="simtime-display">
            t+
            <span className="simtime-value">
              {tick ? tick.simTimeSec.toFixed(1) : "0.0"}
            </span>
            s
          </div>
        </div>
      </header>
      <main className="app-main">
        <TranscriptPanel messages={transcript} />
        <SkyMap2D aircraft={aircraft} anomalies={anomalies} />
        <div className="right-column">
          <SuggestedMessagePanel
            suggestedMessage={suggestedMessage}
            decisionState={decisionState}
            onBroadcast={handleBroadcast}
            onReject={handleReject}
            simId={(tick as SimulationTick | null)?.simId}
          />
          <AnomaliesPanel anomalies={anomalies} />
        </div>
      </main>
    </div>
  );
}

export default App;

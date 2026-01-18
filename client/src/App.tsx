import { useEffect, useState } from "react";
import "./index.css"; // Ensure index.css is loaded
import {
  createInitialPlanes,
  createInitialTranscript,
  computeAnomalies,
  chooseSuggestion,
  updatePlanePositionsLogic,
  performManeuver,
} from "./simulation/engine";
import type { Plane, TranscriptEntry, Anomaly, SuggestedMessage } from "./simulation/types";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { MapOverlay } from "./components/MapOverlay";
import { SuggestedMessagePanel } from "./components/SuggestedMessagePanel";
import { AnomaliesPanel } from "./components/AnomaliesPanel";
import { ActiveAircraftPanel } from "./components/ActiveAircraftPanel";
import { ControlPanel } from "./components/ControlPanel";

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function App() {
  // Simulation State
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [suggestedMessage, setSuggestedMessage] = useState<SuggestedMessage | null>(null);
  const [selectedPlaneIds, setSelectedPlaneIds] = useState<Set<string>>(new Set());
  const [brainAutoMode, setBrainAutoMode] = useState(false);
  const [tickInterval, setTickInterval] = useState(2000); // ms per tick

  // Initialize
  useEffect(() => {
    const initialPlanes = createInitialPlanes();
    const initialTranscript = createInitialTranscript();
    setPlanes(initialPlanes);
    setTranscript(initialTranscript);

    const initialAnomalies = computeAnomalies(initialPlanes);
    setAnomalies(initialAnomalies);
    setSuggestedMessage(chooseSuggestion(initialPlanes, initialAnomalies));
  }, []);

  // Simulation Loop - Plane Movement (every 2s)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Logic
      const { planes: nextPlanes, messages: newMessages } = updatePlanePositionsLogic(planes);

      setPlanes(nextPlanes);

      if (newMessages.length > 0) {
        setTranscript(prev => {
          // Filter duplicates just in case
          const existingIds = new Set(prev.map(m => m.id));
          const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
          return [...prev, ...uniqueNew];
        });
      }

      // After moving, recompute anomalies
      const nextAnomalies = computeAnomalies(nextPlanes);
      setAnomalies(nextAnomalies);

      // If no suggestion, pick one
      setSuggestedMessage((prevSuggestion) => {
        const newSuggestion = prevSuggestion ? prevSuggestion : chooseSuggestion(nextPlanes, nextAnomalies);

        // AUTO MODE: Automatically broadcast if enabled
        if (newSuggestion && brainAutoMode) {
          // Auto-broadcast the suggestion
          const entry: TranscriptEntry = {
            id: "tx-auto-" + Date.now(),
            timestamp: new Date().toISOString(),
            from: "SKYGUARD",
            callsign: newSuggestion.targetCallsigns.length === 1 ? newSuggestion.targetCallsigns[0] : "",
            message: "[AUTO] " + newSuggestion.message,
          };
          setTranscript(prev => [...prev, entry]);

          // Execute the maneuver for the target plane
          if (newSuggestion.message.includes("360")) {
            const targetCallsign = newSuggestion.targetCallsigns[0];
            const targetPlane = nextPlanes.find(p => p.callsign === targetCallsign);
            if (targetPlane) {
              setPlanes(currentPlanes => currentPlanes.map(p => {
                if (p.id === targetPlane.id) {
                  return performManeuver(p, "DO_360", 0);
                }
                return p;
              }));
            }
          }

          // Clear suggestion after auto-broadcast
          return null;
        }

        return newSuggestion;
      });

    }, tickInterval); // Use adjustable tick interval

    return () => clearTimeout(timer);
  }, [planes, brainAutoMode, tickInterval]); // Add tickInterval dependency

  // Clock
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const utcTime = (() => {
    const d = now;
    const hours = pad2(d.getUTCHours());
    const minutes = pad2(d.getUTCMinutes());
    const seconds = pad2(d.getUTCSeconds());
    return `${hours}:${minutes}:${seconds} UTC`;
  })();

  const utcDate = (() => {
    const d = now;
    const year = d.getUTCFullYear();
    const month = pad2(d.getUTCMonth() + 1);
    const day = pad2(d.getUTCDate());
    return `${year}-${month}-${day}`;
  })();

  // Handlers
  const handlePlaneClick = (planeId: string) => {
    setSelectedPlaneIds(prev => {
      const next = new Set(prev);
      if (next.has(planeId)) {
        next.delete(planeId);
      } else {
        next.add(planeId);
      }
      return next;
    });
    // In app.js: updateSuggestedFromSelection() is called here.
    // We can implement simplified logic: if generic suggestion, maybe replace with specific?
    // For now, let's stick to the loop logic updating suggestions, or add specific effect for selection change.
    updateSuggestedFromSelection();
  };

  const updateSuggestedFromSelection = () => {
    // This needs access to valid planes state. 
    // Since we are in a handler, we might use a ref or simplified approach.
    // For this port, let's keep it simple: selection doesn't force immediate suggestion update in this react version 
    // unless we wire it fully.
  };


  const handleBroadcast = () => {
    if (!suggestedMessage) return;

    // Add to transcript
    const entry: TranscriptEntry = {
      id: "tx-" + Date.now(),
      timestamp: new Date().toISOString(),
      from: "SKYGUARD",
      callsign: suggestedMessage.targetCallsigns.length === 1 ? suggestedMessage.targetCallsigns[0] : "",
      message: suggestedMessage.message,
    };
    setTranscript(prev => [...prev, entry]);

    // Execute the maneuver for the target plane
    if (suggestedMessage.message.includes("360")) {
      const targetCallsign = suggestedMessage.targetCallsigns[0];
      const targetPlane = planes.find(p => p.callsign === targetCallsign);
      if (targetPlane) {
        setPlanes(currentPlanes => currentPlanes.map(p => {
          if (p.id === targetPlane.id) {
            return performManeuver(p, "DO_360", 0);
          }
          return p;
        }));
      }
    }

    // Clear suggestion and get next one
    setSuggestedMessage(chooseSuggestion(planes, anomalies));
  };

  const handleReject = () => {
    if (!suggestedMessage) return;
    setSuggestedMessage(chooseSuggestion(planes, anomalies));
  };


  const handleManeuver = (planeId: string, command: string, value: string | number) => {
    setPlanes(currentPlanes => currentPlanes.map(p => {
      if (p.id === planeId) {
        return performManeuver(p, command, value);
      }
      return p;
    }));
  };

  return (
    <>
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="top-title">SkyGuard AI</div>
          <div className="top-subtitle">Automated Air Traffic Control</div>
        </div>
        <div className="top-bar-right">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={brainAutoMode}
              onChange={(e) => setBrainAutoMode(e.target.checked)}
            />
            <span style={{ fontSize: '14px', color: brainAutoMode ? '#4ade80' : '#fff' }}>
              {brainAutoMode ? '🤖 AUTO MODE' : '👤 MANUAL MODE'}
            </span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '20px' }}>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Sim Speed:</span>
            <input
              type="range"
              min="500"
              max="5000"
              step="500"
              value={tickInterval}
              onChange={(e) => setTickInterval(Number(e.target.value))}
              style={{ width: '120px' }}
            />
            <span style={{ fontSize: '12px', color: '#4ade80' }}>
              {(1000 / tickInterval).toFixed(1)}x
            </span>
          </div>
          <div className="status-chip">SYSTEM ONLINE</div>
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
          <div className="left-panel-top">
            <div className="panel-header">Active Aircraft</div>
            <ActiveAircraftPanel planes={planes} />
          </div>
          <div className="left-panel-bottom">
            <div className="panel-header">Transcript – Radio Communications</div>
            <div id="transcript-list" className="panel-content transcript-list">
              <TranscriptPanel messages={transcript} />
            </div>
          </div>
        </div>
        <div className="column map-column">
          <div className="panel-header">Traffic Scope – Beaver County Airport</div>
          <div id="map" className="map-scope">
            <img
              id="airport-image"
              className="map-image"
              src="/beaver_airport.png"
              alt="Beaver County Airport"
            />
            <div className="map-dark-overlay"></div>
            <div className="crt-overlay"></div>
            <div className="map-status-badge">LIVE RADAR / KBVI</div>
            <MapOverlay
              planes={planes}
              anomalies={anomalies}
              onPlaneClick={handlePlaneClick}
              selectedPlaneIds={selectedPlaneIds}
            />
          </div>
        </div>
        <div className="column right-column">
          <div className="panel-header" style={{ marginBottom: '10px' }}>Manual Controls</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {planes.map(p => (
              <ControlPanel
                key={p.id}
                callsign={p.callsign}
                speed={p.groundspeed}
                onManeuver={(cmd, val) => handleManeuver(p.id, cmd, val)}
              />
            ))}
          </div>

          <div className="panel suggested-panel" style={{ marginTop: '20px' }}>
            <div className="panel-header">SkyGuard Suggested Message</div>
            <SuggestedMessagePanel
              suggestedMessage={suggestedMessage}
              onBroadcast={handleBroadcast}
              onReject={handleReject}
            />
          </div>
          <div className="panel anomalies-panel">
            <div className="panel-header">Anomalies – Traffic Dangers</div>
            <div id="anomalies-list" className="panel-content anomalies-list">
              <AnomaliesPanel anomalies={anomalies} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

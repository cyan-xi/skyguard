import { useEffect, useState, useRef } from "react";
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
import { createEmergencyScenario } from "./simulation/scenarios";

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
  const [brainAutoMode] = useState(false);
  const [tickInterval, setTickInterval] = useState(2000); // ms per tick
  const lastBroadcastTime = useRef<number>(0);
  const [scriptedMessages, setScriptedMessages] = useState<any[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isScriptedMode, setIsScriptedMode] = useState(false);

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

      // After moving, recompute anomalies and accumulate over time
      const nextAnomalies = computeAnomalies(nextPlanes);
      if (nextAnomalies.length > 0) {
        setAnomalies(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const uniqueNew = nextAnomalies.filter(a => !existingIds.has(a.id));
          if (uniqueNew.length === 0) return prev;
          return [...prev, ...uniqueNew];
        });
      }

      // If no suggestion, pick one
      setSuggestedMessage((prevSuggestion) => {
        return prevSuggestion ? prevSuggestion : chooseSuggestion(nextPlanes, nextAnomalies);
      });

    }, tickInterval); // Use adjustable tick interval

    return () => clearTimeout(timer);
  }, [planes, brainAutoMode, tickInterval]); // Add tickInterval dependency

  // Transcript Polling (Voice Agent Integration)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetch("http://localhost:4000/api/transcript/updates")
        .then(res => res.json())
        .then((data: any[]) => {
          if (data && data.length > 0) {
            setTranscript(prev => {
              const existing = new Set(prev.map(m => m.id));
              // Convert to TranscriptEntry format if needed
              const newEntries = data.filter((d: any) => !existing.has(d.id)).map((d: any) => ({
                id: d.id,
                timestamp: d.timestamp,
                from: "ATC", // Agent is acting as ATC
                callsign: d.callsign,
                message: d.message
              }));
              if (newEntries.length === 0) return prev;
              return [...prev, ...newEntries];
            });
          }
        })
        .catch(() => { }); // Ignore poll errors
    }, 1000); // 1 sec poll
    return () => clearInterval(pollInterval);
    return () => clearInterval(pollInterval);
  }, []);

  // Auto Mode Effect
  useEffect(() => {
    if (brainAutoMode && suggestedMessage) {
      const now = Date.now();
      const MIN_DELAY = 5000; // 5 seconds minimum between broadcasts
      const timeSinceLast = now - lastBroadcastTime.current;

      if (timeSinceLast < MIN_DELAY) {
        // Wait for the remainder of the delay
        const timeout = setTimeout(() => {
          handleBroadcast();
          lastBroadcastTime.current = Date.now();
        }, MIN_DELAY - timeSinceLast);
        return () => clearTimeout(timeout);
      } else {
        // Broadcast immediately
        handleBroadcast();
        lastBroadcastTime.current = Date.now();
      }
    }
  }, [brainAutoMode, suggestedMessage]);

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

    // Trigger Voice Agent
    console.log("Triggering voice agent with:", suggestedMessage.message);
    fetch("http://localhost:4000/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: suggestedMessage.message })
    })
      .then(res => res.json())
      .then(data => console.log("Voice Agent Response:", data))
      .catch(err => console.error("Failed to trigger voice agent:", err));

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
    setSuggestedMessage(null);
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

  const loadEmergencyDemo = () => {
    const scenario = createEmergencyScenario();
    setPlanes(scenario.planes);
    setTranscript(scenario.transcript);
    setAnomalies(scenario.anomalies || []);
    setSelectedPlaneIds(new Set());

    // Load scripted messages
    if (scenario.scriptedMessages) {
      setScriptedMessages(scenario.scriptedMessages);
      setCurrentMessageIndex(0);
      setIsScriptedMode(true);

      // Set first message as suggestion
      const firstMsg = scenario.scriptedMessages[0];
      setSuggestedMessage({
        message: firstMsg.message,
        targetCallsigns: [firstMsg.targetCallsign],
        priority: 'caution',
        createdAt: new Date().toISOString()
      });
    }
  };

  const handleAcceptScriptedMessage = () => {
    if (!isScriptedMode || currentMessageIndex >= scriptedMessages.length) return;

    const currentMsg = scriptedMessages[currentMessageIndex];

    // Broadcast aviation format message
    const entry: TranscriptEntry = {
      id: "atc-" + Date.now(),
      timestamp: new Date().toISOString(),
      from: "SKYGUARD",
      callsign: currentMsg.targetCallsign,
      message: currentMsg.aviationMessage,
    };
    setTranscript(prev => [...prev, entry]);

    // Execute instruction
    const targetPlane = planes.find(p => p.id === currentMsg.targetPlaneId);
    if (targetPlane && currentMsg.instruction) {
      if (currentMsg.instruction.type === "DO_360") {
        setPlanes(currentPlanes => currentPlanes.map(p => {
          if (p.id === currentMsg.targetPlaneId) {
            return performManeuver(p, "DO_360", 0);
          }
          return p;
        }));
      } else if (currentMsg.instruction.type === "EXTEND_DOWNWIND") {
        // Continue flying straight - don't follow pattern
        setPlanes(currentPlanes => currentPlanes.map(p => {
          if (p.id === currentMsg.targetPlaneId) {
            return {
              ...p,
              flightMode: "init", // Switch to straight flight mode
              targetHeading: 180 // Keep heading south on downwind
            };
          }
          return p;
        }));
      } else if (currentMsg.instruction.type === "CLEARED_TO_LAND") {
        // Set emergency aircraft to landing mode
        setPlanes(currentPlanes => currentPlanes.map(p => {
          if (p.id === currentMsg.targetPlaneId) {
            return { ...p, willTouchAndGo: false };
          }
          return p;
        }));
      }
    }

    // Move to next message
    advanceToNextMessage();
  };

  const handleOverrideScriptedMessage = () => {
    // Just skip to next message without executing
    advanceToNextMessage();
  };

  const advanceToNextMessage = () => {
    const nextIndex = currentMessageIndex + 1;

    if (nextIndex < scriptedMessages.length) {
      // Show next message
      setCurrentMessageIndex(nextIndex);
      const nextMsg = scriptedMessages[nextIndex];
      setSuggestedMessage({
        message: nextMsg.message,
        targetCallsigns: [nextMsg.targetCallsign],
        priority: 'caution',
        createdAt: new Date().toISOString()
      });
    } else {
      // End of scripted messages
      setIsScriptedMode(false);
      setSuggestedMessage(null);
    }
  };

  return (
    <>
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="top-title">SkyGuard</div>
          <div className="top-subtitle">Automated Air Traffic Control</div>
        </div>
        <div className="top-bar-right">
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
        <div className="column right-column" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="panel" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="panel-header">Manual Controls</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '5px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {planes.map(p => (
                <ControlPanel
                  key={p.id}
                  callsign={p.callsign}
                  speed={p.groundspeed}
                  onManeuver={(cmd, val) => handleManeuver(p.id, cmd, val)}
                />
              ))}
            </div>
            {/* Speed slider in footer of manual controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderTop: '1px solid #1f2937', background: 'rgba(2, 6, 23, 0.5)' }}>
              <span style={{ fontSize: '10px', color: '#aaa' }}>SIM SPEED:</span>
              <input
                type="range"
                min="500"
                max="5000"
                step="500"
                value={tickInterval}
                onChange={(e) => setTickInterval(Number(e.target.value))}
                style={{ flex: 1, height: '4px' }}
              />
              <span style={{ fontSize: '11px', color: '#4ade80', minWidth: '30px' }}>
                {(1000 / tickInterval).toFixed(1)}x
              </span>
            </div>
          </div>

          <div className="panel suggested-panel" style={{ flex: '0 0 auto' }}>
            <div className="panel-header">SkyGuard Suggested Message</div>
            <div style={{ padding: '0 4px' }}>
              <SuggestedMessagePanel
                suggestedMessage={suggestedMessage}
                onBroadcast={isScriptedMode ? handleAcceptScriptedMessage : handleBroadcast}
                onReject={isScriptedMode ? handleOverrideScriptedMessage : handleReject}
              />
            </div>
          </div>

          <div className="panel anomalies-panel" style={{ flex: '0 1 30%', display: 'flex', flexDirection: 'column', minHeight: '120px' }}>
            <div className="panel-header">Anomalies – Traffic Dangers</div>
            <div id="anomalies-list" className="panel-content anomalies-list" style={{ flex: 1, overflowY: 'auto' }}>
              <AnomaliesPanel anomalies={anomalies} />
            </div>
            <div style={{ padding: '8px', borderTop: '1px solid #1f2937', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                onClick={loadEmergencyDemo}
                style={{
                  padding: '6px 10px',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '11px',
                  width: '33%',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                🚨 DEMO
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

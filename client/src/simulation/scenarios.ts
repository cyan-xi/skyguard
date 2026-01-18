import type { Plane, TranscriptEntry, Anomaly } from './types';

/**
 * Demo Scenario Generator
 * Creates pre-scripted scenarios to demonstrate system capabilities
 */

export function createEmergencyScenario() {
  const planes: Plane[] = [];
  const transcript: TranscriptEntry[] = [];

  // Plane 1: Bottom of downwind (entering pattern)
  planes.push({
    id: "DEMO01",
    callsign: "N123AB",
    intention: "landing",
    x: -0.5,
    y: -0.3, // Near bottom of downwind
    altitude: 1500,
    heading: 180,
    groundspeed: 90,
    targetHeading: 180,
    targetAltitude: 1500,
    targetGroundspeed: 90,
    flightMode: "pattern",
    patternLeg: "downwind",
    willTouchAndGo: false,
    hasLanded: false,
    isEmergency: false,
    lastUpdated: new Date().toISOString()
  });

  // Plane 2: EMERGENCY - Middle of downwind
  planes.push({
    id: "DEMO02",
    callsign: "N456CD",
    intention: "emergency landing",
    x: -0.5,
    y: 0.0, // Middle of downwind
    altitude: 1800,
    heading: 180,
    groundspeed: 85,
    targetHeading: 180,
    targetAltitude: 1000,
    targetGroundspeed: 75,
    flightMode: "pattern",
    patternLeg: "downwind",
    willTouchAndGo: false,
    hasLanded: false,
    isEmergency: true, // EMERGENCY FLAG
    lastUpdated: new Date().toISOString()
  });

  // Plane 3: Top of downwind
  planes.push({
    id: "DEMO03",
    callsign: "N789EF",
    intention: "training",
    x: -0.5,
    y: 0.4, // Near top of downwind
    altitude: 1600,
    heading: 180,
    groundspeed: 95,
    targetHeading: 180,
    targetAltitude: 1600,
    targetGroundspeed: 95,
    flightMode: "pattern",
    patternLeg: "downwind",
    willTouchAndGo: true,
    hasLanded: false,
    isEmergency: false,
    lastUpdated: new Date().toISOString()
  });

  // Plane 4: Taking off near end of runway
  planes.push({
    id: "DEMO04",
    callsign: "DAL123",
    intention: "departure",
    x: 0,
    y: 0.3, // Near end of runway/final
    altitude: 500,
    heading: 0,
    groundspeed: 100,
    targetHeading: 0,
    targetAltitude: 2000,
    targetGroundspeed: 120,
    flightMode: "pattern",
    patternLeg: "final",
    willTouchAndGo: false,
    hasLanded: false,
    isEmergency: false,
    lastUpdated: new Date().toISOString()
  });

  // Emergency message
  transcript.push({
    id: "emergency-" + Date.now(),
    timestamp: new Date().toISOString(),
    from: "N456CD",
    callsign: "N456CD",
    message: "MAYDAY MAYDAY MAYDAY - Engine failure, requesting immediate landing!"
  });

  // Scripted instructions for emergency scenario
  const scriptedMessages = [
    {
      id: 1,
      targetCallsign: "N123AB",
      targetPlaneId: "DEMO01",
      message: "Emergency aircraft takes landing priority. Extend downwind to get out of the way",
      aviationMessage: "N123AB, extend downwind, emergency aircraft inbound, acknowledge",
      instruction: { type: "EXTEND_DOWNWIND" }
    },
    {
      id: 2,
      targetCallsign: "N789EF",
      targetPlaneId: "DEMO03",
      message: "Make space for aircraft in emergency. Make a right 360 for spacing immediately",
      aviationMessage: "N789EF, make right three-sixty, immediate, spacing for emergency traffic",
      instruction: { type: "DO_360" }
    },
    {
      id: 3,
      targetCallsign: "N456CD",
      targetPlaneId: "DEMO02",
      message: "You have right of way and are cleared to land",
      aviationMessage: "N456CD, cleared to land runway two-eight, emergency equipment standing by",
      instruction: { type: "CLEARED_TO_LAND" }
    }
  ];

  // Critical anomaly for demo
  const anomalies: Anomaly[] = [
    {
      id: "emergency-anomaly-" + Date.now(),
      type: "Distress",
      severity: "critical",
      description: "Aircraft with distress demands right of way. Immediately clear the airspace",
      involvedCallsigns: ["N456CD"],
      recommendedAction: "Clear immediate airspace for priority landing"
    }
  ];

  return { planes, transcript, scriptedMessages, anomalies };
}

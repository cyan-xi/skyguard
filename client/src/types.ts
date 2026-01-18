export type AircraftPhase =
  | "climb"
  | "cruise"
  | "descent"
  | "approach"
  | "pattern"
  | "ground";

export type ClearanceStatus =
  | "none"
  | "assigned"
  | "in_progress"
  | "compliant"
  | "non_compliant";

export interface AircraftState {
  id: string;
  callsign: string;
  icaoType: string;
  lat: number;
  lon: number;
  altitudeFt: number;
  groundSpeedKt: number;
  headingDeg: number;
  verticalSpeedFpm: number;
  phase: AircraftPhase;
  routeSegment: string;
  assignedAltitudeFt?: number;
  assignedHeadingDeg?: number;
  assignedSpeedKt?: number;
  lastInstructionId?: string;
  clearanceStatus: ClearanceStatus;
  squawk: string;
}

export type AnomalyType =
  | "LOSS_OF_SEPARATION"
  | "ALTITUDE_DEVIATION"
  | "HEADING_DEVIATION"
  | "SPEED_DEVIATION"
  | "LEVEL_BUST"
  | "RUNWAY_INCURRENCE"
  | "MISSED_READBACK"
  | "INSTRUCTION_NOT_FOLLOWED"
  | "COMM_LOSS";

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  simTimeSec: number;
  aircraftIds: string[];
  description: string;
}

export type TranscriptRole = "tower" | "pilot" | "system";

export interface TranscriptMessage {
  id: string;
  atSimTimeSec: number;
  role: TranscriptRole;
  callsign?: string;
  text: string;
}

export interface SimulationTick {
  simId: string;
  simTimeSec: number;
  aircraft: AircraftState[];
  anomalies: Anomaly[];
  transcript: TranscriptMessage[];
  suggestedMessage?: string;
}

export type BroadcastDecision = "idle" | "pending" | "broadcasted" | "rejected";

export interface McpFrame {
  simId: string;
  simTimeSec: number;
  aircraft: AircraftState[];
  anomalies: Anomaly[];
  transcript: TranscriptMessage[];
  suggestedMessage?: string;
  decisionState: BroadcastDecision;
}

export type McpBuffer = McpFrame[];

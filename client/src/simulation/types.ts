export type PatternLeg = "upwind" | "crosswind" | "downwind" | "base" | "final" | "none";
export type FlightMode = "pattern" | "transit" | "holding" | "init" | "entering_path" | "orbit_360";

export interface Plane {
    id: string;
    callsign: string;
    intention: string;

    // Position
    x: number;
    y: number;
    altitude: number;
    heading: number;
    groundspeed: number;

    // Physics Targets
    targetHeading?: number;
    targetAltitude?: number;
    targetGroundspeed?: number;

    // Physics Constraints
    turnRate?: number; // deg/sec
    climbRate?: number; // ft/min
    acceleration?: number; // kt/sec

    // AI Logic
    flightMode: FlightMode;
    patternLeg: PatternLeg;
    maneuverState?: {
        initialHeading?: number;
        degreesTurned?: number;
        previousMode?: FlightMode;
    };

    // Landing Logic
    willTouchAndGo?: boolean;
    hasLanded?: boolean;

    // Demo/Emergency
    isEmergency?: boolean;

    lastUpdated: string;
}

export interface TranscriptEntry {
    id: string;
    timestamp: string;
    from: string;
    callsign: string;
    message: string;
}

export interface Anomaly {
    id: string;
    type: string;
    severity: "info" | "warning" | "critical";
    description: string;
    involvedCallsigns: string[];
    recommendedAction: string;
}

export interface SuggestedMessage {
    message: string;
    targetCallsigns: string[];
    priority: "routine" | "caution";
    createdAt: string;
}

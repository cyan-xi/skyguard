export interface Plane {
    id: string;
    callsign: string;
    intention: string;
    x: number;
    y: number;
    altitude: number;
    heading: number;
    groundspeed: number;
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

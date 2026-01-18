import type { Plane, TranscriptEntry, Anomaly, SuggestedMessage, PatternLeg } from "./types";

let planeCounter = 0;

// Constants
const RUNWAY_HEADING = 278; // Approximate for Rwy 28
const TURN_RATE_DEG_PER_SEC = 3;
const CLIMB_RATE_FT_PER_MIN = 800;
const ACCEL_KT_PER_SEC = 2;
const FIELD_ELEVATION_FT = 1253;
const PATTERN_ALTITUDE_FT = 2250;
const PATTERN_SPEED_KT = 90;
const FINAL_APPROACH_SPEED_KT = 65;
const CLIMBOUT_SPEED_KT = 85;
const ENROUTE_ALT_MIN_FT = 3000;
const ENROUTE_ALT_MAX_FT = 4500;

// Pattern Geometry (NM relative to center)
// Simple state machine logic rather than strict spatial boxes for now, 
// unless we need to trigger leg changes based on position.
// For now, we'll initialize them with defaults.

export function createRandomPlane(): Plane {
    const now = new Date().toISOString();
    planeCounter += 1;

    const callsign = "N" + (100 + planeCounter) + String(planeCounter % 10) + "X";
    const intention = Math.random() < 0.5 ? "touch-and-go" : "full-stop";

    let x = 0;
    let y = 0;
    let heading = RUNWAY_HEADING;
    let altitude = PATTERN_ALTITUDE_FT;
    let groundspeed = PATTERN_SPEED_KT;
    let flightMode: Plane["flightMode"] = "pattern";
    let patternLeg: PatternLeg = "upwind";
    let targetHeading = heading;
    let targetAltitude = altitude;
    let targetGroundspeed = groundspeed;

    const spawnMode = Math.random();

    if (spawnMode < 0.4) {
        const legs: PatternLeg[] = ["upwind", "crosswind", "downwind", "base", "final"];
        patternLeg = legs[Math.floor(Math.random() * legs.length)];
        const isLeft = Math.random() < 0.5;
        const side = isLeft ? 1 : -1;

        switch (patternLeg) {
            case "upwind":
                x = 0.2 + Math.random() * (CROSS_X - 0.2);
                y = 0;
                heading = getPatternHeading("upwind", isLeft ? "left" : "right");
                altitude = PATTERN_ALTITUDE_FT;
                groundspeed = PATTERN_SPEED_KT;
                break;
            case "crosswind":
                x = CROSS_X;
                y = side * Math.random() * PATTERN_Y_OFFSET;
                heading = getPatternHeading("crosswind", isLeft ? "left" : "right");
                altitude = PATTERN_ALTITUDE_FT;
                groundspeed = PATTERN_SPEED_KT;
                break;
            case "downwind":
                x = BASE_X + Math.random() * (CROSS_X - BASE_X);
                y = side * PATTERN_Y_OFFSET;
                heading = getPatternHeading("downwind", isLeft ? "left" : "right");
                altitude = PATTERN_ALTITUDE_FT;
                groundspeed = PATTERN_SPEED_KT;
                break;
            case "base":
                x = BASE_X;
                y = side * Math.random() * PATTERN_Y_OFFSET;
                heading = getPatternHeading("base", isLeft ? "left" : "right");
                altitude = PATTERN_ALTITUDE_FT - 400;
                groundspeed = PATTERN_SPEED_KT - 10;
                break;
            case "final":
                x = BASE_X + Math.random() * (0.5 - BASE_X);
                y = side * 0.1;
                heading = getPatternHeading("final", isLeft ? "left" : "right");
                altitude = FIELD_ELEVATION_FT + 300;
                groundspeed = FINAL_APPROACH_SPEED_KT;
                break;
            case "none":
                x = 0;
                y = 0;
                heading = RUNWAY_HEADING;
                altitude = PATTERN_ALTITUDE_FT;
                groundspeed = PATTERN_SPEED_KT;
                break;
        }

        flightMode = "pattern";
        targetHeading = heading;
        targetAltitude = altitude;
        targetGroundspeed = groundspeed;
    } else {
        const innerSpawn = spawnMode < 0.7;
        const spawnRadius = innerSpawn ? 2.0 : 3.0;
        const spawnAngle = Math.random() * Math.PI * 2;
        x = Math.cos(spawnAngle) * spawnRadius;
        y = Math.sin(spawnAngle) * spawnRadius;

        const joinX = BASE_X + Math.random() * (CROSS_X - BASE_X);
        const joinY = PATTERN_Y_OFFSET * (Math.random() < 0.5 ? 1 : -1);
        const headingRad = Math.atan2(joinY - y, joinX - x);
        heading = normalizeHeading((headingRad * 180) / Math.PI);

        altitude =
            ENROUTE_ALT_MIN_FT + Math.random() * (ENROUTE_ALT_MAX_FT - ENROUTE_ALT_MIN_FT);
        groundspeed = PATTERN_SPEED_KT + 20;

        flightMode = "transit";
        patternLeg = "none";
        targetHeading = heading;
        targetAltitude = PATTERN_ALTITUDE_FT;
        targetGroundspeed = PATTERN_SPEED_KT + 10;
    }

    return {
        id: callsign,
        callsign,
        intention,
        x,
        y,
        altitude,
        heading,
        groundspeed,

        targetHeading,
        targetAltitude,
        targetGroundspeed,

        turnRate: TURN_RATE_DEG_PER_SEC,
        climbRate: CLIMB_RATE_FT_PER_MIN,
        acceleration: ACCEL_KT_PER_SEC,

        flightMode,
        patternLeg,

        lastUpdated: now,
    };
}

export function createInitialPlanes(): Plane[] {
    const planes = [];
    for (let i = 0; i < 3; i++) {
        planes.push(createRandomPlane());
    }
    return planes;
}

export function createInitialTranscript(): TranscriptEntry[] {
    const now = new Date();
    const t0 = new Date(now.getTime() - 120000);
    const t1 = new Date(now.getTime() - 90000);
    const t2 = new Date(now.getTime() - 45000);
    const t3 = new Date(now.getTime() - 20000);
    return [
        {
            id: "t1",
            timestamp: t0.toISOString(),
            from: "PILOT",
            callsign: "N123AB",
            message: "Beaver Tower, N123AB ten miles east, inbound full stop with information Bravo.",
        },
        {
            id: "t2",
            timestamp: t1.toISOString(),
            from: "ATC",
            callsign: "N123AB",
            message: "N123AB, Beaver Tower, enter right downwind runway 28, report midfield.",
        },
        {
            id: "t3",
            timestamp: t2.toISOString(),
            from: "PILOT",
            callsign: "N456CD",
            message: "Beaver Tower, N456CD five miles northwest, touch and go.",
        },
        {
            id: "t4",
            timestamp: t3.toISOString(),
            from: "ATC",
            callsign: "N456CD",
            message: "N456CD, Beaver Tower, make left traffic runway 28, report two mile final.",
        },
    ];
}

// Pattern Constants (Local Coordinates)
// X axis: Along runway (0 = midpoint, positive towards Rwy 28 end)
// Y axis: Across runway (0 = centerline, positive = Left of Rwy 28)
// Runway 28 len ~ 1.0 (from -0.5 to 0.5)
const CROSS_X = 1.0;          // Turn Crosswind
const PATTERN_Y_OFFSET = 0.7; // Standard width
const BASE_X = -1.2;          // Turn Base

function getTargetStateForLoop(plane: Plane, _dt: number): Partial<Plane> {
    // If not in pattern mode, keep current targets
    if (plane.flightMode !== "pattern" || plane.patternLeg === "none") return {};

    const newState: Partial<Plane> = {};
    const { x, y, altitude, intention } = plane;

    // Determine traffic side (Left Traffic if y > 0)
    const isLeft = y >= 0;
    const trafficDirection = isLeft ? "left" : "right";

    // Pattern State Machine
    // Headings: Rwy 28 = 278.
    // Upwind (278) -> Cross (188) -> Downwind (098) -> Base (008) -> Final (278) [LEFT]
    // Upwind (278) -> Cross (008) -> Downwind (098) -> Base (188) -> Final (278) [RIGHT]

    switch (plane.patternLeg) {
        case "upwind":
            newState.targetAltitude = PATTERN_ALTITUDE_FT;
            newState.targetGroundspeed = PATTERN_SPEED_KT;
            newState.targetHeading = getPatternHeading("upwind", trafficDirection);
            if (x > CROSS_X) {
                newState.patternLeg = "crosswind";
                newState.targetHeading = getPatternHeading("crosswind", trafficDirection);
            }
            break;
        case "crosswind":
            newState.targetAltitude = PATTERN_ALTITUDE_FT;
            newState.targetGroundspeed = PATTERN_SPEED_KT;
            if (Math.abs(y) >= PATTERN_Y_OFFSET) {
                newState.patternLeg = "downwind";
                newState.targetHeading = getPatternHeading("downwind", trafficDirection);
            }
            break;
        case "downwind":
            newState.targetAltitude = PATTERN_ALTITUDE_FT;
            newState.targetGroundspeed = PATTERN_SPEED_KT;
            if (x < BASE_X) {
                newState.patternLeg = "base";
                newState.targetHeading = getPatternHeading("base", trafficDirection);
                newState.targetAltitude = PATTERN_ALTITUDE_FT - 400;
            }
            break;
        case "base":
            newState.targetGroundspeed = PATTERN_SPEED_KT - 10;
            if (altitude > FIELD_ELEVATION_FT + 300) {
                newState.targetAltitude = PATTERN_ALTITUDE_FT - 600;
            }
            const distYC = Math.abs(y);
            if (distYC < 0.15) {
                newState.patternLeg = "final";
                newState.targetHeading = getPatternHeading("final", trafficDirection);
                newState.targetAltitude = FIELD_ELEVATION_FT + 200;
            }
            break;
        case "final":
            newState.targetHeading = getPatternHeading("final", trafficDirection);
            if (altitude > FIELD_ELEVATION_FT + 200) {
                newState.targetAltitude = FIELD_ELEVATION_FT + 200;
                newState.targetGroundspeed = FINAL_APPROACH_SPEED_KT;
            } else if (altitude > FIELD_ELEVATION_FT + 50) {
                newState.targetAltitude = FIELD_ELEVATION_FT + 50;
                newState.targetGroundspeed = FINAL_APPROACH_SPEED_KT - 20;
            } else {
                if (intention === "full-stop") {
                    newState.targetAltitude = FIELD_ELEVATION_FT;
                    newState.targetGroundspeed = 15;
                } else if (intention === "touch-and-go") {
                    newState.targetGroundspeed = 15;
                    if (Math.abs(x) < 0.3 && Math.abs(y) < 0.15) {
                        newState.patternLeg = "upwind";
                        newState.targetHeading = getPatternHeading("upwind", trafficDirection);
                        newState.targetAltitude = PATTERN_ALTITUDE_FT;
                        newState.targetGroundspeed = CLIMBOUT_SPEED_KT;
                    } else {
                        newState.targetAltitude = FIELD_ELEVATION_FT + 30;
                    }
                }
            }
            break;
    }

    return newState;
}

function normalizeHeading(h: number) {
    return ((h % 360) + 360) % 360;
}

function turnTowards(current: number, target: number, rate: number, dt: number): number {
    const diff = normalizeHeading(target - current);
    const step = rate * dt;
    if (Math.abs(diff) < 0.1 || Math.abs(diff - 360) < 0.1) return target;

    if (diff <= 180) {
        // Turn right
        return normalizeHeading(current + Math.min(diff, step));
    } else {
        // Turn left (diff > 180 means target is to the left effectively)
        const leftDiff = 360 - diff;
        return normalizeHeading(current - Math.min(leftDiff, step));
    }
}

function moveValueTowards(current: number, target: number, rate: number, dt: number): number {
    const step = rate * dt;
    if (Math.abs(target - current) <= step) return target;
    return current < target ? current + step : current - step;
}

function getAiUpdates(plane: Plane, dt: number): Partial<Plane> {
    if (plane.flightMode === "transit") {
        const r = Math.hypot(plane.x, plane.y);
        if (r <= CROSS_X + 0.2) {
            const isLeft = plane.y >= 0;
            return {
                flightMode: "pattern",
                patternLeg: "downwind",
                targetHeading: getPatternHeading("downwind", isLeft ? "left" : "right"),
                targetAltitude: PATTERN_ALTITUDE_FT,
                targetGroundspeed: PATTERN_SPEED_KT,
            };
        }

        const headingToCenterRad = Math.atan2(-plane.y, -plane.x);
        const headingToCenter = normalizeHeading((headingToCenterRad * 180) / Math.PI);
        return {
            targetHeading: headingToCenter,
            targetAltitude: PATTERN_ALTITUDE_FT,
            targetGroundspeed: PATTERN_SPEED_KT + 10,
        };
    }

    if (plane.flightMode === "pattern") {
        return getTargetStateForLoop(plane, dt);
    }

    if (plane.flightMode === "holding") {
        return {};
    }

    return {};
}

export function updatePlanePositionsLogic(currentPlanes: Plane[]): Plane[] {
    const dtSeconds = 2.0;
    const maxRadiusActive = 3.5;
    const maxPlanes = 3;

    let nextPlanes = currentPlanes.map((plane) => {
        // 0. AI / Logic Update
        const aiUpdates = getAiUpdates(plane, dtSeconds);
        const p = { ...plane, ...aiUpdates };

        // 1. Physics Update

        // Handle Holding (360s)
        if (p.flightMode === "holding") {
            const turnDir = 1; // Right turn default
            p.targetHeading = normalizeHeading(p.heading + 10 * turnDir);
        }

        // Heading
        let newHeading = p.heading;
        if (p.targetHeading !== undefined) {
            newHeading = turnTowards(p.heading, p.targetHeading, p.turnRate || TURN_RATE_DEG_PER_SEC, dtSeconds);
        }

        // Altitude
        let newAltitude = p.altitude;
        if (p.targetAltitude !== undefined) {
            newAltitude = moveValueTowards(p.altitude, p.targetAltitude, (p.climbRate || CLIMB_RATE_FT_PER_MIN) / 60, dtSeconds);
        }

        // Speed
        let newSpeed = p.groundspeed;
        if (p.targetGroundspeed !== undefined) {
            newSpeed = moveValueTowards(p.groundspeed, p.targetGroundspeed, p.acceleration || ACCEL_KT_PER_SEC, dtSeconds);
        }

        // Move
        const rad = (newHeading * Math.PI) / 180;
        const speedNmPerSec = (newSpeed / 3600);
        const simSpeedFactor = 0.5; // Visual scaling
        const dist = speedNmPerSec * simSpeedFactor * dtSeconds;

        const nx = p.x + Math.cos(rad) * dist;
        const ny = p.y + Math.sin(rad) * dist;

        return {
            ...p,
            x: nx,
            y: ny,
            heading: newHeading,
            altitude: newAltitude,
            groundspeed: newSpeed,
            lastUpdated: new Date().toISOString(),
        };
    });

    // Remove landed planes
    // Landed = on final, altitude < 50, x > Runway Start (-0.5)
    // Actually runway numbers start at ~ -0.5 (Runway 10) and +0.5 (Runway 28).
    // Runway 28 means landing towards East (280 deg).
    // Rwy 10 is 098 (East-ish).
    // If heading is 278, we are flying Left on the screen (-X).
    // 28 threshold is closer to Right (+X). 10 threshold is Left (-X).
    // Landing on 28 means flying right-to-left.
    // So "x > -0.5" check needs verification.
    // If we land on 28, we start at X=0.5, fly to X=-0.5.
    // So if x < -0.5 (passed end of runway) we are done?
    // Let's assume landing is complete when we touch down near the threshold or roll out.
    // Let's clean up when speed is low or passed midpoint significantly.

    nextPlanes = nextPlanes.filter((plane) => {
        const isFullStopLanded =
            plane.intention === "full-stop" &&
            plane.patternLeg === "final" &&
            plane.altitude <= FIELD_ELEVATION_FT + 10 &&
            plane.groundspeed <= 20;
        if (isFullStopLanded) return false;

        // Also remove far away
        const r = Math.hypot(plane.x, plane.y);
        return r <= maxRadiusActive;
    });

    // Replenish
    while (nextPlanes.length < maxPlanes) {
        nextPlanes.push(createRandomPlane());
    }

    return nextPlanes;
}

export function computeAnomalies(planes: Plane[]): Anomaly[] {
    const result: Anomaly[] = [];
    const horizontalThresholdNm = 1.0; // Stricter? Or keeping same?
    const verticalThresholdFt = 300;

    for (let i = 0; i < planes.length; i++) {
        for (let j = i + 1; j < planes.length; j++) {
            const a = planes[i];
            const b = planes[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const altDiff = Math.abs(a.altitude - b.altitude);

            if (dist <= horizontalThresholdNm && altDiff <= verticalThresholdFt) {
                result.push({
                    id: "anomaly-" + a.id + "-" + b.id,
                    type: "loss-of-separation",
                    severity: "critical",
                    description: `Loss of separation: ${dist.toFixed(2)} NM / ${altDiff.toFixed(0)} ft`,
                    involvedCallsigns: [a.callsign, b.callsign],
                    recommendedAction: "Issue vectors immediately.",
                });
            } else if (dist <= horizontalThresholdNm * 1.5 && altDiff <= verticalThresholdFt * 1.5) {
                result.push({
                    id: "anomaly-close-" + a.id + "-" + b.id,
                    type: "converging-head-on",
                    severity: "warning",
                    description: `Traffic Alert: ${dist.toFixed(2)} NM / ${altDiff.toFixed(0)} ft`,
                    involvedCallsigns: [a.callsign, b.callsign],
                    recommendedAction: "Monitor and advise.",
                });
            }
        }
    }
    return result;
}

export function chooseSuggestion(planes: Plane[], anomalies: Anomaly[]): SuggestedMessage | null {
    // For now, simple logic similar to before, but we can expand this for pattern entries
    if (anomalies.length > 0) {
        const critical = anomalies.find((a) => a.severity === "critical");
        const anomaly = critical || anomalies[0];
        const callsigns = anomaly.involvedCallsigns;
        if (callsigns.length >= 2) {
            return {
                message: `${callsigns[0]}, turn right heading 360 immediately, traffic 12 o'clock less than mile.`,
                targetCallsigns: callsigns.slice(0, 2),
                priority: "caution",
                createdAt: new Date().toISOString(),
            };
        }
    }

    // Suggest pattern entry for a transit plane
    const transitPlane = planes.find(p => p.flightMode === "transit" && !p.intention.includes("departing"));
    if (transitPlane) {
        return {
            message: `${transitPlane.callsign}, enter left downwind runway 28.`,
            targetCallsigns: [transitPlane.callsign],
            priority: "routine",
            createdAt: new Date().toISOString(),
        };
    }

    return null;
}

// Helpers
function getPatternHeading(leg: PatternLeg, trafficDirection: "left" | "right"): number {
    // Rwy 28 = 278 deg
    const RWY = RUNWAY_HEADING;
    if (leg === "upwind" || leg === "final") return RWY;
    if (leg === "downwind") return normalizeHeading(RWY + 180);

    if (trafficDirection === "left") {
        if (leg === "crosswind") return normalizeHeading(RWY - 90); // 278 - 90 = 188
        if (leg === "base") return normalizeHeading(RWY + 90); // 278 + 90 = 008 (Wait, Base for Left traffic 28: Downwind 098 -> Left Turn -> 008 North -> Left Turn -> 278)
        // Let's verify:
        // Rwy 278. 
        // Upwind 278.
        // Crosswind (Left Turn) -> 188.
        // Downwind (Left Turn) -> 098.
        // Base (Left Turn) -> 008.
        // Final (Left Turn) -> 278.
        // Yes.
    } else {
        // Right Traffic
        if (leg === "crosswind") return normalizeHeading(RWY + 90); // 008
        if (leg === "base") return normalizeHeading(RWY - 90); // 188
    }
    return RWY;
}

export function performManeuver(plane: Plane, command: string, value: string | number): Plane {
    const p = { ...plane };

    switch (command) {
        case "HEADING":
            p.targetHeading = Number(value);
            p.flightMode = "transit"; // Override pattern Logic
            break;

        case "ALTITUDE":
            p.targetAltitude = Number(value);
            break;

        case "ENTER_PATTERN":
            // value e.g., "left-downwind"
            // Parse leg
            const parts = String(value).split("-");
            const direction = parts[0] as "left" | "right";
            const leg = parts[1] as PatternLeg;

            p.patternLeg = leg;
            p.targetHeading = getPatternHeading(leg, direction);
            p.flightMode = "pattern";
            break;

        case "PERFORM_360":
            // Value = "left" or "right"
            // Simple 360: Just keep turning?
            // Or we can manipulate targetHeading to be currentHeading - 10 (and keep updating it?)
            // For a simple sim, maybe we just set a high turn rate for 2 full minutes? 
            // Better: Set a flag. 
            // We don't have a specific 'doing360' flag in types yet, but we can hack it or add it.
            // For now, let's just do a heading change that happens to be a circle? No that's hard.
            // Let's set a "holding" mode.
            p.flightMode = "holding";
            // We'll need the engine to respect "holding" by constantly updating targetHeading
            break;
    }

    return p;
}

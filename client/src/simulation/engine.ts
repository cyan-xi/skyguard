import type { Plane, TranscriptEntry, Anomaly, SuggestedMessage } from "./types";

// User Defined Geometry
// Visual: Top=Crosswind, Left=Downwind, Bottom=Base, Right=Runway
// Flow: Runway (Bottom-to-Top) -> Crosswind (Right-to-Left) -> Downwind (Top-to-Bottom) -> Base (Left-to-Right)

// Logical Coordinates (Normalized 0-1 or NM? Let's use local NM approximations)
// Let's assume Runway Length = 1.0 NM.
// Width = 0.5 NM.
// Center = (0,0).
// Runway Axis = Vertical (Y).
// Runway Top = (0, 0.5). Runway Bottom = (0, -0.5).
// BUT map space might be rotated.
// Let's stick to the abstract concept:
// Leg 1 (Runway): (0, -0.5) to (0, 0.5)
// Leg 2 (Crosswind): (0, 0.5) to (-0.5, 0.5)  <-- "Left" is negative X?
// Leg 3 (Downwind): (-0.5, 0.5) to (-0.5, -0.5)
// Leg 4 (Base): (-0.5, -0.5) to (0, -0.5)

// Coordinate mapping to Screen:
// Engine X/Y -> Screen X/Y.
// MapOverlay assumes: localToImagePixels scales X (Along) and Y (Across).
// Wait, MapOverlay logic: 
// dx = xLocal * alongScale; (Along runway)
// dy = yLocal * acrossScale; (Across runway)
// Our logic above: Y is Along, X is Across.
// So:
// Engine X = Across (0.5 width)
// Engine Y = Along (1.0 length)

// const RUNWAY_LEN = 1.0;
// const PATTERN_WIDTH = 0.5;

// const WAYPOINTS = {
//     RUNWAY_START: { x: 0, y: -0.5 }, // Bottom
//     RUNWAY_END: { x: 0, y: 0.5 },  // Top
//     CROSS_END: { x: 0.5, y: 0.5 }, // Top-Left (Wait, MapOverlay 'Left' corresponds to Positive Y in its logic? Let's check)
//     // MapOverlay: RUNWAY_UNIT_ACROSS = {-uy, ux}.
//     // If Runway is (0,1), Across is (-1, 0) Left.
//     // localToImage: imgX = ... + across * dy.
//     // So Positive 'yLocal' in MapOverlay is 'Left'.
//     // I will map Engine 'Y' to MapOverlay 'X' (Along) and Engine 'X' to MapOverlay 'Y' (Across).
//     // CONFUSING.
// };

// SIMPLER:
// Engine State: x, y.
// Visuals: x, y passed directly to localToImagePixels.
// localToImagePixels(x, y):
//   x is "Along Runway" (-0.5 to 0.5).
//   y is "Across Runway" (0 to 0.7?).
// User wants Width = Half Length = 0.5.
// So pattern y goes from 0 to 0.5 (Left).

// Path Cycle:
// 1. Runway: x (-0.5 -> 0.5), y=0.
// 2. Crosswind: x=0.5, y (0 -> 0.5).
// 3. Downwind: x (0.5 -> -0.5), y=0.5.
// 4. Base: x=-0.5, y (0.5 -> 0).

// Wait, Visual Top is Runway 10 (P1).
// RUNWAY10_PIXEL corresponds to xLocal = -0.5 approx?
// Let's verify MapOverlay.tsx:
// midX = (start.x + end.x) / 2
// dx = xLocal * alongScale.
// If xLocal is -0.5 -> moves towards P1?
// RUNWAY_UNIT_ALONG = (P2-P1).
// P1 is Start. P2 is End.
// So Vector is P1 -> P2.
// If xLocal is positive, we move towards P2 (Bottom).
// If xLocal is negative, we move towards P1 (Top).

// So Top = Negative X.
// Bottom = Positive X.

// User Cycle: Runway (Bottom to Top) -> Crosswind (Top Edge).
// So Runway Leg = P2 -> P1 (Positive X to Negative X).
// Crosswind Leg = Top Edge (at X = -0.5). Moving Right to Left.
// Right side is Y=0. Left side is Y=0.5 (Positive Y is Left).
// So Crosswind: X=-0.5, Y goes 0 -> 0.5.
// Downwind Leg: Left Edge (Y=0.5). Moving Top to Bottom (X: -0.5 -> 0.5).
// Base Leg: Bottom Edge (X=0.5). Moving Left to Right (Y: 0.5 -> 0).

// Constants
const SPEED_KT = 90;
const TURN_RATE = 3; // deg/sec

export function createInitialPlanes(): Plane[] {
    // 1. Existing Pattern Plane
    const p1 = createPlaneOnDownwind();

    // 2. New Transit Plane (Top Left, flying to Downwind Entry)
    const p2 = createTransitPlane();

    return [p1, p2];
}

function createPlaneOnDownwind(): Plane {
    return {
        id: "TEST01",
        callsign: "TEST01",
        intention: "full-stop",
        x: -0.5,
        y: 0.0,
        altitude: 1000,
        heading: 180,
        groundspeed: SPEED_KT,
        targetHeading: 180,
        targetAltitude: 1000,
        targetGroundspeed: SPEED_KT,
        turnRate: TURN_RATE,
        climbRate: 0,
        acceleration: 0,
        flightMode: "pattern",
        patternLeg: "downwind",
        lastUpdated: new Date().toISOString()
    };
}

function createTransitPlane(): Plane {
    // Spawn Top-Left (Outside)
    // Map is roughly +/- 1.0. 
    // Pattern Top-Left is (-0.5, 0.5).
    // Spawn at (-0.9, 0.9).
    const startX = -0.9;
    const startY = 0.9;

    // Target: Downwind Entry (-0.5, 0.5)
    // Calculate Heading logic
    const dx = -0.5 - startX;
    const dy = 0.5 - startY;
    // Map Angle: 0 is Up, 90 Right.
    // atan2(y, x) -> standard math.
    // mapHeading = 90 - deg(atan2(dy, dx)).
    const rad = Math.atan2(dy, dx);
    const deg = (rad * 180) / Math.PI;
    const mapHeading = (90 - deg + 360) % 360;

    return {
        id: "INBOUND02",
        callsign: "INBOUND02",
        intention: "pattern-entry",
        x: startX,
        y: startY,
        altitude: 1500, // Higher initially
        heading: mapHeading,
        groundspeed: SPEED_KT,
        targetHeading: mapHeading,
        targetAltitude: 1000,
        targetGroundspeed: SPEED_KT,
        turnRate: TURN_RATE,
        climbRate: 0,
        acceleration: 0,
        flightMode: "transit",
        patternLeg: "none",
        lastUpdated: new Date().toISOString()
    };
}

export function updatePlanePositionsLogic(currentPlanes: Plane[]): Plane[] {
    const step = 0.04; // Speed per tick

    // Filter out despawned planes (return null/undefined filtering usually done by map, but here we rebuild array)
    const nextPlanes: Plane[] = [];

    currentPlanes.forEach(p => {
        let nx = p.x;
        let ny = p.y;
        let nextLeg = p.patternLeg;
        let newHeading = p.heading;
        let flightMode = p.flightMode;

        // --- TRANSIT LOGIC ---
        if (flightMode === "transit") {
            // Target: Downwind Entry (-0.5, 0.5)
            const targetX = -0.5;
            const targetY = 0.5;

            // Move towards target
            const dx = targetX - nx;
            const dy = targetY - ny;
            const dist = Math.hypot(dx, dy);

            if (dist < step) {
                // Arrived!
                nx = targetX;
                ny = targetY;
                flightMode = "pattern";
                nextLeg = "downwind";
                newHeading = 180; // Turn to Downwind flows
            } else {
                // Keep moving
                const moveX = (dx / dist) * step;
                const moveY = (dy / dist) * step;
                nx += moveX;
                ny += moveY;
                // Heading remains constant transit heading
            }

            nextPlanes.push({
                ...p,
                x: nx,
                y: ny,
                flightMode,
                patternLeg: nextLeg as any,
                heading: newHeading
            });
            return;
        }

        // --- PATTERN LOGIC ---

        let despawn = false;

        if (p.patternLeg === "crosswind") {
            // Y=0.5. Right(0) to Left(-0.5). Heading 270.
            if (ny < 0.5) ny = 0.5;
            nx -= step;
            newHeading = 270;
            if (nx <= -0.5) {
                nx = -0.5;
                nextLeg = "downwind";
            }
        }
        else if (p.patternLeg === "downwind") {
            // X=-0.5. Top(0.5) to Bot(-0.5). Heading 180.
            if (nx > -0.5) nx = -0.5;
            ny -= step;
            newHeading = 180;
            if (ny <= -0.5) {
                ny = -0.5;
                nextLeg = "base";
            }
        }
        else if (p.patternLeg === "base") {
            // Y=-0.5. Left(-0.5) to Right(0). Heading 90.
            if (ny > -0.5) ny = -0.5;
            nx += step;
            newHeading = 90;
            if (nx >= 0.0) {
                nx = 0.0;
                nextLeg = "final";
            }
        }
        else if (p.patternLeg === "final" || p.patternLeg === "upwind") {
            // Leg: Right/Runway (X=0). Moves Bot(-0.5) to Top(0.5).
            // Heading: 0.
            // DESPAWN CHECK: Midpoint (Y=0.0)

            if (nx < 0) nx = 0;
            ny += step;
            newHeading = 0;

            if (ny >= 0.0) {
                // Despawn!
                despawn = true;
            }
        }

        if (!despawn) {
            nextPlanes.push({
                ...p,
                x: nx,
                y: ny,
                flightMode,
                patternLeg: nextLeg as any,
                heading: newHeading
            });
        }
    });

    return nextPlanes;
}

// Stubs
export function createInitialTranscript(): TranscriptEntry[] { return []; }
export function computeAnomalies(_planes: Plane[]): Anomaly[] { return []; }
export function chooseSuggestion(_planes: Plane[], _anomalies: Anomaly[]): SuggestedMessage | null { return null; }
export function performManeuver(plane: Plane, _command: string, _value: string | number): Plane { return plane; }

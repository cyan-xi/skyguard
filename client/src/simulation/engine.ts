import type { Plane, TranscriptEntry, Anomaly, SuggestedMessage, PatternLeg } from "./types";

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

export function createInitialPlanes(): Plane[] {
    const planes: Plane[] = [];
    const radius = 1.2;
    const count = 3;

    for (let i = 0; i < count; i++) {
        const angleDeg = (360 / count) * i;
        const angleRad = (angleDeg * Math.PI) / 180;

        // Spawn position (Polar to Cartesian)
        // Adjust angle so 0 starts at Top? Or just standard math (0 = Right).
        // Let's use standard math: x = r cos(th), y = r sin(th)
        const startX = radius * Math.cos(angleRad);
        const startY = radius * Math.sin(angleRad);

        // Heading: Face Center (0,0)
        // Vector from Plane to Center = (-x, -y).
        // Angle = atan2(-y, -x).
        // Convert to Compass Heading (0=Up, 90=Right).
        const toCenterRad = Math.atan2(-startY, -startX);
        const heading = (90 - (toCenterRad * 180 / Math.PI) + 360) % 360;

        planes.push({
            id: `PLANE0${i + 1}`,
            callsign: `TEST0${i + 1}`,
            intention: "training",
            x: startX,
            y: startY,
            altitude: 2000,
            heading: heading,
            groundspeed: SPEED_KT,
            targetHeading: heading,
            targetAltitude: 2000,
            targetGroundspeed: SPEED_KT,
            turnRate: 0,
            climbRate: 0,
            acceleration: 0,
            flightMode: "init",
            patternLeg: "none",
            lastUpdated: new Date().toISOString()
        });
    }

    return planes;
}

export function updatePlanePositionsLogic(currentPlanes: Plane[]): { planes: Plane[], messages: TranscriptEntry[] } {
    // const step = 0.04; // Speed per tick (approx) - OLD CONSTANT
    const dt = 2.0; // Seconds per tick (simulated)
    const messages: TranscriptEntry[] = [];

    const nextPlanes = currentPlanes.map(p => {
        // Dynamic Step based on Speed
        // 90 kts ~= 0.04 units/tick ?
        // Let's stick to that ratio: step = speed * (0.04 / 90)
        const step = (p.groundspeed || 90) * (0.04 / 90);

        let nx = p.x;
        let ny = p.y;
        let nextLeg = p.patternLeg;
        let newHeading = p.heading;
        let flightMode = p.flightMode;
        let maneuverState = p.maneuverState;
        let altitude = p.altitude;
        let groundspeed = p.groundspeed;

        // Altitude Logic (Simple Lerp)
        if (p.targetAltitude !== undefined && Math.abs(altitude - p.targetAltitude) > 10) {
            const climbParams = 500 / 60 * dt; // 500 fpm
            if (altitude < p.targetAltitude) altitude += climbParams;
            else altitude -= climbParams;
        }

        // Speed Logic (Acceleration)
        if (p.targetGroundspeed !== undefined && Math.abs(groundspeed - p.targetGroundspeed) > 1) {
            // Acceleration Logic using fixed rate for now
            // const accRate = (p.acceleration || 5) * dt; // Unused
            // acceleration property in Plane type is kt/sec.
            // If undefined, use 2 kts/s = 4kts/tick.
            const rate = 4;
            if (groundspeed < p.targetGroundspeed) groundspeed = Math.min(p.targetGroundspeed, groundspeed + rate);
            else groundspeed = Math.max(p.targetGroundspeed, groundspeed - rate);
        }

        // --- MANEUVER LOGIC ---
        if (flightMode === "orbit_360") {
            // Turn right 360 degrees
            const turnAmount = (p.turnRate || 3) * dt;
            newHeading = (newHeading + turnAmount) % 360;

            // Track progress
            if (!maneuverState) maneuverState = { degreesTurned: 0 };
            const turned = (maneuverState.degreesTurned || 0) + turnAmount;
            maneuverState = { ...maneuverState, degreesTurned: turned };

            // Move in circle direction? Or just pivot? User said "going around in a circle".
            // If we just change heading, we fly in a circle if we update position based on heading.
            // Let's update position based on new heading:
            // 0 deg = Up (Y+), 90 deg = Right (X+)
            // rad = (90 - heading) * PI / 180
            const rad = (90 - newHeading) * (Math.PI / 180);
            nx += Math.cos(rad) * step;
            ny += Math.sin(rad) * step;

            if (turned >= 360) {
                // Complete
                flightMode = maneuverState.previousMode || "pattern";
                maneuverState = undefined;
                // Snap alignment if returning to pattern? 
                // For "smoothish" visuals, maybe just let it flow or snap closest leg.
                // If we were in pattern, we might be far off now. 
                // User said "returning back into the rectangular path for separation".
                // Simple logic: Switch to 'entering_path' to merge back.
                flightMode = "entering_path";
            }
        }
        else if (flightMode === "init") {
            // Just fly straight
            const rad = (90 - newHeading) * (Math.PI / 180);
            nx += Math.cos(rad) * step;
            ny += Math.sin(rad) * step;
        }
        else if (flightMode === "entering_path") {
            // Altitude adjustment is handled by lerp at start of function using p.targetAltitude.


            // 1. Find Closest Point on Pattern
            // Pattern: Top=0.5, Bottom=-0.5, Left=-0.5, Right=0.0
            const closest = getClosestPointOnPerimeter(nx, ny);

            // 2. Vector to Closest
            const dx = closest.x - nx;
            const dy = closest.y - ny;
            const dist = Math.hypot(dx, dy);

            // 3. Initial Direction Vector
            // Stored in maneuverState.initialHeading.
            // If missing, use current heading vector.
            const initHeading = maneuverState?.initialHeading ?? p.heading;

            // Convert Heading (0=North, 90=East) to Math Angle (0=East/X+, 90=North/Y+)
            // standard angle = 90 - heading
            const initRad = (90 - initHeading) * (Math.PI / 180);
            const initVx = Math.cos(initRad);
            const initVy = Math.sin(initRad);

            // 4. Vector Reuse Logic ("Closest Point" Vector)
            // Normalized vector to closest point
            const toClosestVx = dx / dist;
            const toClosestVy = dy / dist;

            // 5. Avg Vector
            // Weighting: Can be 50/50.
            const avgVx = initVx + toClosestVx;
            const avgVy = initVy + toClosestVy;
            const avgRad = Math.atan2(avgVy, avgVx); // Math angle

            // Convert back to Heading
            const avgHeading = (90 - (avgRad * 180 / Math.PI) + 360) % 360;

            // Move
            newHeading = avgHeading;
            nx += Math.cos(avgRad) * step;
            ny += Math.sin(avgRad) * step;

            // Transition Logic
            if (dist < step * 1.5) {
                // Arrived at pattern edge
                flightMode = "pattern";
                nx = closest.x;
                ny = closest.y;
                nextLeg = closest.leg;

                // Snap Heading based on leg flow
                if (nextLeg === "downwind") newHeading = 180;
                else if (nextLeg === "base") newHeading = 90;
                else if (nextLeg === "final") newHeading = 0; // "final" moves up Y axis
                else if (nextLeg === "crosswind") newHeading = 270;
            }
        }
        else if (flightMode === "pattern") {
            // --- PATTERN LOGIC ---
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
                    nextLeg = "final"; // "final" in code, visually "upwind/runway"
                }
            }
            else if (p.patternLeg === "final" || p.patternLeg === "upwind") {
                // Leg: Right/Runway (X=0). Moves Bot(-0.5) to Top(0.5).
                if (nx < 0) nx = 0;
                ny += step;
                newHeading = 0;

                if (ny >= 0.5) {
                    // Loop back to Crosswind
                    ny = 0.5;
                    nextLeg = "crosswind";
                }
            } else {
                // Fallback to downwind if lost
                nextLeg = "downwind";
                flightMode = "entering_path";
            }
        }

        return {
            ...p,
            x: nx,
            y: ny,
            altitude,
            groundspeed,
            flightMode,
            patternLeg: nextLeg as any,
            heading: newHeading,
            maneuverState
        };
    });

    return { planes: nextPlanes, messages };
}

// Stubs
export function createInitialTranscript(): TranscriptEntry[] { return []; }
export function computeAnomalies(_planes: Plane[]): Anomaly[] { return []; }
export function chooseSuggestion(_planes: Plane[], _anomalies: Anomaly[]): SuggestedMessage | null { return null; }
// Helper to find closest point on rectangle (-0.5, -0.5) to (0.0, 0.5)
// Returns {x, y, leg}
function getClosestPointOnPerimeter(x: number, y: number): { x: number, y: number, leg: PatternLeg } {
    const left = -0.5;
    const right = 0.0;
    const top = 0.5;
    const bottom = -0.5;

    // Clamps
    const clampX = Math.max(left, Math.min(right, x));
    const clampY = Math.max(bottom, Math.min(top, y));

    // Check if points are on edges
    const onLeft = Math.abs(clampX - left) < 0.001;
    const onRight = Math.abs(clampX - right) < 0.001;
    const onTop = Math.abs(clampY - top) < 0.001;
    const onBottom = Math.abs(clampY - bottom) < 0.001;

    let leg: PatternLeg = "downwind"; // Default fallback

    if (onLeft) leg = "downwind";
    else if (onTop) leg = "crosswind";
    else if (onBottom) leg = "base";
    else if (onRight) leg = "final";

    // Corner cases (overlap):
    // Top-Left (Cross/Down): Entering Crosswind or Downwind?
    // Traffic flows Cross -> Down. If we hit corner, usually we join the 'next' one or 'current'?
    // Let's say we join the one we are 'projecting' onto.
    // Simplify: Just pick one. Top-Left -> Downwind seems safer (turn 180).

    return { x: clampX, y: clampY, leg };
}

export function performManeuver(plane: Plane, command: string, value: string | number): Plane {
    const newPlane = { ...plane };

    if (command === "ENTER_PATH") {
        newPlane.flightMode = "entering_path";
        newPlane.targetAltitude = 1000;
        // Capture initial heading for 'midpoint' vector logic
        // Use current heading as 'initial'
        newPlane.maneuverState = {
            initialHeading: plane.heading
        };
    } else if (command === "SET_ALTITUDE") {
        newPlane.targetAltitude = Number(value);
    } else if (command === "SPEED_CHANGE") {
        const delta = Number(value);
        const currentTgt = newPlane.targetGroundspeed || newPlane.groundspeed;
        newPlane.targetGroundspeed = Math.max(50, Math.min(300, currentTgt + delta));
    } else if (command === "DO_360") {
        newPlane.maneuverState = {
            previousMode: plane.flightMode,
            degreesTurned: 0,
            initialHeading: plane.heading
        };
        newPlane.flightMode = "orbit_360";
        newPlane.turnRate = 3; // Standard rate
    }

    return newPlane;
}

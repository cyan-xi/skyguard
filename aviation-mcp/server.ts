import "reflect-metadata";
import { createHTTPServer, Tool, SchemaConstraint, Optional, MCPServer } from "@leanmcp/core";

const PORT = 3001;

// --- Data Models ---

class AircraftPosition {
    @SchemaConstraint({ description: 'Latitude in degrees' })
    lat!: number;

    @SchemaConstraint({ description: 'Longitude in degrees' })
    lon!: number;

    @SchemaConstraint({ description: 'Altitude in feet MSL' })
    alt!: number;
}

class LastInstruction {
    @SchemaConstraint({ description: 'The type of instruction given', enum: ['HEADING', 'ALTITUDE', 'SPEED', 'HOLD', 'LAND', 'TAKEOFF'] })
    type!: string;

    @SchemaConstraint({ description: 'The value associated with the instruction (e.g., degrees, feet)', default: 0 })
    value!: number;
}

class AircraftState {
    @SchemaConstraint({ description: 'Unique callsign of the aircraft' })
    callsign!: string;

    @SchemaConstraint({ description: 'Current position of the aircraft' })
    position!: AircraftPosition;

    @SchemaConstraint({ description: 'Ground speed in knots' })
    speed!: number;

    @SchemaConstraint({ description: 'Heading in degrees' })
    heading!: number;

    @Optional()
    @SchemaConstraint({ description: 'Vertical speed in fpm', default: 0 })
    verticalSpeed?: number;
}

class ComplianceCheckInput {
    @SchemaConstraint({ description: 'Current state of the aircraft' })
    aircraft!: AircraftState;

    @Optional()
    @SchemaConstraint({ description: 'The last instruction given to this aircraft' })
    lastInstruction?: LastInstruction;
}

class SeparationCheckInput {
    @SchemaConstraint({ description: 'The primary aircraft to check' })
    aircraft!: AircraftState;

    @SchemaConstraint({ description: 'List of other aircraft in the vicinity' })
    traffic!: AircraftState[];
}

class SafetyAssessment {
    @SchemaConstraint({ description: 'Is the situation/action safe?', enum: ['SAFE', 'WARNING', 'UNSAFE'] })
    status!: string;

    @SchemaConstraint({ description: 'Detailed message explaining the assessment' })
    message!: string;

    @SchemaConstraint({ description: 'Recommended immediate action or standard phraseology' })
    recommendation!: string;
}

class PatternTurnInput {
    @SchemaConstraint({ description: 'Current leg in the traffic pattern', enum: ['upwind', 'crosswind', 'downwind', 'base', 'final', 'entry', 'exit'] })
    currentLeg!: string;

    @SchemaConstraint({ description: 'Distance from runway threshold in nm' })
    distanceFromThreshold!: number;

    @SchemaConstraint({ description: 'Altitude relative to field elevation' })
    relativeAltitude!: number;

    @Optional()
    @SchemaConstraint({ description: 'Heading relative to runway heading', default: 0 })
    relativeHeading?: number;
}

class AircraftPriorityStatus {
    @SchemaConstraint({ description: 'Aircraft callsign' })
    callsign!: string;

    @SchemaConstraint({ description: 'Current flight status', enum: ['CRUISING', 'LANDING', 'TAKEOFF', 'EMERGENCY', 'DISTRESS'] })
    status!: string;
}

class PriorityCheckInput {
    @SchemaConstraint({ description: 'List of aircraft to prioritize' })
    aircraft!: AircraftPriorityStatus[];
}

class PriorityList {
    @SchemaConstraint({ description: 'Callsigns in order of priority (highest first)' })
    orderedCallsigns!: string[];

    @SchemaConstraint({ description: 'Explanation of the priority content' })
    explanation!: string;
}

// --- Service ---

export class AviationSafetyService {

    @Tool({
        description: 'Check deviation from assigned instructions (heading/altitude)',
        inputClass: ComplianceCheckInput
    })
    async monitorCompliance(args: ComplianceCheckInput): Promise<SafetyAssessment> {
        const { aircraft, lastInstruction } = args;

        if (!lastInstruction) {
            return { status: 'SAFE', message: 'No active instructions to monitor.', recommendation: 'Continue.' };
        }

        if (lastInstruction.type === 'HEADING') {
            const diff = Math.abs(aircraft.heading - lastInstruction.value);
            // Handle 360 wrap-around
            const deviation = Math.min(diff, 360 - diff);

            if (deviation > 15) {
                return {
                    status: 'WARNING',
                    message: `Aircraft heading ${aircraft.heading} deviates from assigned ${lastInstruction.value}`,
                    recommendation: `${aircraft.callsign}, correct your heading`
                };
            }
        }

        if (lastInstruction.type === 'ALTITUDE') {
            const diff = Math.abs(aircraft.position.alt - lastInstruction.value);
            if (diff > 200) {
                return {
                    status: 'WARNING',
                    message: `Altitude deviation: ${aircraft.position.alt} vs assigned ${lastInstruction.value}`,
                    recommendation: `${aircraft.callsign}, confirm altitude`
                };
            }
        }

        return { status: 'SAFE', message: 'Compliance nominal.', recommendation: 'Continue.' };
    }

    @Tool({
        description: 'Check separation minimums between an aircraft and traffic.',
        inputClass: SeparationCheckInput
    })
    async checkSeparation(args: SeparationCheckInput): Promise<SafetyAssessment> {
        const { aircraft, traffic } = args;
        let minDistance = Number.MAX_VALUE;
        let closestTraffic: AircraftState | null = null;
        let verticalSep = Number.MAX_VALUE;

        // Simple flat-earth approximation for "toy" logic
        for (const remote of traffic) {
            if (remote.callsign === aircraft.callsign) continue;

            const dLat = (remote.position.lat - aircraft.position.lat) * 60; // nm
            const dLon = (remote.position.lon - aircraft.position.lon) * 60 * Math.cos(aircraft.position.lat * Math.PI / 180); // nm
            const dist = Math.sqrt(dLat * dLat + dLon * dLon);
            const vDist = Math.abs(remote.position.alt - aircraft.position.alt);

            if (dist < minDistance) {
                minDistance = dist;
                verticalSep = vDist;
                closestTraffic = remote;
            }
        }

        // Rules: Min 3nm lateral or 1000ft vertical
        if (closestTraffic) {
            if (minDistance < 1.0 && verticalSep < 500) {
                return {
                    status: 'UNSAFE',
                    message: `CRITICAL CONFLICT with ${closestTraffic.callsign}.`,
                    recommendation: `${aircraft.callsign}, immediate left turn heading 090` // Placeholder logic for turn
                };
            } else if (minDistance < 3.0 && verticalSep < 1000) {
                return {
                    status: 'UNSAFE',
                    message: `Conflict with ${closestTraffic.callsign}: ${minDistance.toFixed(1)}nm / ${verticalSep.toFixed(0)}ft separation.`,
                    recommendation: `${aircraft.callsign}, make right 360 for separation`
                };
            } else if (minDistance < 5.0 && verticalSep < 1000) {
                return {
                    status: 'WARNING',
                    message: `Traffic warning: ${closestTraffic.callsign} is ${minDistance.toFixed(1)}nm away.`,
                    recommendation: `${aircraft.callsign}, traffic alert`
                };
            }
        }

        return {
            status: 'SAFE',
            message: 'No traffic conflicts detected.',
            recommendation: 'Maintain current course.'
        };
    }

    @Tool({
        description: 'Validate traffic pattern entry, altitude, and leg status.',
        inputClass: PatternTurnInput
    })
    async monitorTrafficPattern(args: PatternTurnInput): Promise<SafetyAssessment> {
        const { currentLeg, distanceFromThreshold, relativeAltitude, relativeHeading } = args;

        // 1. Altitude Compliance
        // Rule: Pattern altitude usually 1000ft AGL
        if (Math.abs(relativeAltitude - 1000) > 300) {
            if (relativeAltitude > 1300) {
                return {
                    status: 'WARNING',
                    message: `Too high in pattern (${relativeAltitude}ft).`,
                    recommendation: 'Descend to pattern altitude.'
                };
            } else {
                return {
                    status: 'WARNING',
                    message: `Too low in pattern (${relativeAltitude}ft).`,
                    recommendation: 'Climb to pattern altitude.'
                };
            }
        }

        // 2. Location/Path Compliance
        if (currentLeg === 'downwind' && distanceFromThreshold > 2.5) {
            return {
                status: 'WARNING',
                message: 'Extended downwind too far.',
                recommendation: 'Turn base immediately.'
            };
        }

        // 3. Incorrect Pattern Entry
        if (currentLeg === 'entry' && relativeHeading && Math.abs(relativeHeading - 45) > 20) {
            // Assuming 45 degree entry is standard for this specific scenario
            return {
                status: 'WARNING',
                message: 'Non-standard entry angle.',
                recommendation: 'You are entering incorrect traffic pattern'
            };
        }

        return {
            status: 'SAFE',
            message: 'Pattern position normal.',
            recommendation: 'Continue approach.'
        };
    }

    @Tool({
        description: 'Determine priority among multiple aircraft based on status.',
        inputClass: PriorityCheckInput
    })
    async assessPriority(args: PriorityCheckInput): Promise<PriorityList> {
        const scoredAircraft = args.aircraft.map(ac => {
            let score = 0;
            if (ac.status === 'DISTRESS') score += 1000;
            else if (ac.status === 'EMERGENCY') score += 500;
            else if (ac.status === 'LANDING') score += 50;
            else if (ac.status === 'TAKEOFF') score += 20;

            return { callsign: ac.callsign, score, status: ac.status };
        });

        scoredAircraft.sort((a, b) => b.score - a.score);

        return {
            orderedCallsigns: scoredAircraft.map(a => a.callsign),
            explanation: `Priority given to ${scoredAircraft[0].status} aircraft (${scoredAircraft[0].callsign}). Immediate action required.`
        };
    }
}

// --- Bootstrap ---

async function bootstrap() {
    const serverFactory = async () => {
        const server = new MCPServer({
            name: "aviation-safety-mcp",
            version: "1.1.0",
            autoDiscover: false
        });

        server.registerService(new AviationSafetyService());
        return server.getServer();
    };

    await createHTTPServer(serverFactory, {
        port: PORT,
        cors: true,
        logging: true,
    });

    console.log(`Aviation Safety MCP running on port ${PORT}`);
}

bootstrap().catch(console.error);

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import "reflect-metadata";
import { createHTTPServer, Tool, SchemaConstraint, Optional, MCPServer } from "@leanmcp/core";
const PORT = 3001;
// --- Data Models ---
class AircraftPosition {
    lat;
    lon;
    alt;
}
__decorate([
    SchemaConstraint({ description: 'Latitude in degrees' }),
    __metadata("design:type", Number)
], AircraftPosition.prototype, "lat", void 0);
__decorate([
    SchemaConstraint({ description: 'Longitude in degrees' }),
    __metadata("design:type", Number)
], AircraftPosition.prototype, "lon", void 0);
__decorate([
    SchemaConstraint({ description: 'Altitude in feet MSL' }),
    __metadata("design:type", Number)
], AircraftPosition.prototype, "alt", void 0);
class LastInstruction {
    type;
    value;
}
__decorate([
    SchemaConstraint({ description: 'The type of instruction given', enum: ['HEADING', 'ALTITUDE', 'SPEED', 'HOLD', 'LAND', 'TAKEOFF'] }),
    __metadata("design:type", String)
], LastInstruction.prototype, "type", void 0);
__decorate([
    SchemaConstraint({ description: 'The value associated with the instruction (e.g., degrees, feet)', default: 0 }),
    __metadata("design:type", Number)
], LastInstruction.prototype, "value", void 0);
class AircraftState {
    callsign;
    position;
    speed;
    heading;
    verticalSpeed;
}
__decorate([
    SchemaConstraint({ description: 'Unique callsign of the aircraft' }),
    __metadata("design:type", String)
], AircraftState.prototype, "callsign", void 0);
__decorate([
    SchemaConstraint({ description: 'Current position of the aircraft' }),
    __metadata("design:type", AircraftPosition)
], AircraftState.prototype, "position", void 0);
__decorate([
    SchemaConstraint({ description: 'Ground speed in knots' }),
    __metadata("design:type", Number)
], AircraftState.prototype, "speed", void 0);
__decorate([
    SchemaConstraint({ description: 'Heading in degrees' }),
    __metadata("design:type", Number)
], AircraftState.prototype, "heading", void 0);
__decorate([
    Optional(),
    SchemaConstraint({ description: 'Vertical speed in fpm', default: 0 }),
    __metadata("design:type", Number)
], AircraftState.prototype, "verticalSpeed", void 0);
class ComplianceCheckInput {
    aircraft;
    lastInstruction;
}
__decorate([
    SchemaConstraint({ description: 'Current state of the aircraft' }),
    __metadata("design:type", AircraftState)
], ComplianceCheckInput.prototype, "aircraft", void 0);
__decorate([
    Optional(),
    SchemaConstraint({ description: 'The last instruction given to this aircraft' }),
    __metadata("design:type", LastInstruction)
], ComplianceCheckInput.prototype, "lastInstruction", void 0);
class SeparationCheckInput {
    aircraft;
    traffic;
}
__decorate([
    SchemaConstraint({ description: 'The primary aircraft to check' }),
    __metadata("design:type", AircraftState)
], SeparationCheckInput.prototype, "aircraft", void 0);
__decorate([
    SchemaConstraint({ description: 'List of other aircraft in the vicinity' }),
    __metadata("design:type", Array)
], SeparationCheckInput.prototype, "traffic", void 0);
class SafetyAssessment {
    status;
    message;
    recommendation;
}
__decorate([
    SchemaConstraint({ description: 'Is the situation/action safe?', enum: ['SAFE', 'WARNING', 'UNSAFE'] }),
    __metadata("design:type", String)
], SafetyAssessment.prototype, "status", void 0);
__decorate([
    SchemaConstraint({ description: 'Detailed message explaining the assessment' }),
    __metadata("design:type", String)
], SafetyAssessment.prototype, "message", void 0);
__decorate([
    SchemaConstraint({ description: 'Recommended immediate action or standard phraseology' }),
    __metadata("design:type", String)
], SafetyAssessment.prototype, "recommendation", void 0);
class PatternTurnInput {
    currentLeg;
    distanceFromThreshold;
    relativeAltitude;
    relativeHeading;
}
__decorate([
    SchemaConstraint({ description: 'Current leg in the traffic pattern', enum: ['upwind', 'crosswind', 'downwind', 'base', 'final', 'entry', 'exit'] }),
    __metadata("design:type", String)
], PatternTurnInput.prototype, "currentLeg", void 0);
__decorate([
    SchemaConstraint({ description: 'Distance from runway threshold in nm' }),
    __metadata("design:type", Number)
], PatternTurnInput.prototype, "distanceFromThreshold", void 0);
__decorate([
    SchemaConstraint({ description: 'Altitude relative to field elevation' }),
    __metadata("design:type", Number)
], PatternTurnInput.prototype, "relativeAltitude", void 0);
__decorate([
    Optional(),
    SchemaConstraint({ description: 'Heading relative to runway heading', default: 0 }),
    __metadata("design:type", Number)
], PatternTurnInput.prototype, "relativeHeading", void 0);
class AircraftPriorityStatus {
    callsign;
    status;
}
__decorate([
    SchemaConstraint({ description: 'Aircraft callsign' }),
    __metadata("design:type", String)
], AircraftPriorityStatus.prototype, "callsign", void 0);
__decorate([
    SchemaConstraint({ description: 'Current flight status', enum: ['CRUISING', 'LANDING', 'TAKEOFF', 'EMERGENCY', 'DISTRESS'] }),
    __metadata("design:type", String)
], AircraftPriorityStatus.prototype, "status", void 0);
class PriorityCheckInput {
    aircraft;
}
__decorate([
    SchemaConstraint({ description: 'List of aircraft to prioritize' }),
    __metadata("design:type", Array)
], PriorityCheckInput.prototype, "aircraft", void 0);
class PriorityList {
    orderedCallsigns;
    explanation;
}
__decorate([
    SchemaConstraint({ description: 'Callsigns in order of priority (highest first)' }),
    __metadata("design:type", Array)
], PriorityList.prototype, "orderedCallsigns", void 0);
__decorate([
    SchemaConstraint({ description: 'Explanation of the priority content' }),
    __metadata("design:type", String)
], PriorityList.prototype, "explanation", void 0);
// --- Service ---
export class AviationSafetyService {
    async monitorCompliance(args) {
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
    async checkSeparation(args) {
        const { aircraft, traffic } = args;
        let minDistance = Number.MAX_VALUE;
        let closestTraffic = null;
        let verticalSep = Number.MAX_VALUE;
        // Simple flat-earth approximation for "toy" logic
        for (const remote of traffic) {
            if (remote.callsign === aircraft.callsign)
                continue;
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
            }
            else if (minDistance < 3.0 && verticalSep < 1000) {
                return {
                    status: 'UNSAFE',
                    message: `Conflict with ${closestTraffic.callsign}: ${minDistance.toFixed(1)}nm / ${verticalSep.toFixed(0)}ft separation.`,
                    recommendation: `${aircraft.callsign}, make right 360 for separation`
                };
            }
            else if (minDistance < 5.0 && verticalSep < 1000) {
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
    async monitorTrafficPattern(args) {
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
            }
            else {
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
    async assessPriority(args) {
        const scoredAircraft = args.aircraft.map(ac => {
            let score = 0;
            if (ac.status === 'DISTRESS')
                score += 1000;
            else if (ac.status === 'EMERGENCY')
                score += 500;
            else if (ac.status === 'LANDING')
                score += 50;
            else if (ac.status === 'TAKEOFF')
                score += 20;
            return { callsign: ac.callsign, score, status: ac.status };
        });
        scoredAircraft.sort((a, b) => b.score - a.score);
        return {
            orderedCallsigns: scoredAircraft.map(a => a.callsign),
            explanation: `Priority given to ${scoredAircraft[0].status} aircraft (${scoredAircraft[0].callsign}). Immediate action required.`
        };
    }
}
__decorate([
    Tool({
        description: 'Check deviation from assigned instructions (heading/altitude)',
        inputClass: ComplianceCheckInput
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ComplianceCheckInput]),
    __metadata("design:returntype", Promise)
], AviationSafetyService.prototype, "monitorCompliance", null);
__decorate([
    Tool({
        description: 'Check separation minimums between an aircraft and traffic.',
        inputClass: SeparationCheckInput
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SeparationCheckInput]),
    __metadata("design:returntype", Promise)
], AviationSafetyService.prototype, "checkSeparation", null);
__decorate([
    Tool({
        description: 'Validate traffic pattern entry, altitude, and leg status.',
        inputClass: PatternTurnInput
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PatternTurnInput]),
    __metadata("design:returntype", Promise)
], AviationSafetyService.prototype, "monitorTrafficPattern", null);
__decorate([
    Tool({
        description: 'Determine priority among multiple aircraft based on status.',
        inputClass: PriorityCheckInput
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PriorityCheckInput]),
    __metadata("design:returntype", Promise)
], AviationSafetyService.prototype, "assessPriority", null);
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

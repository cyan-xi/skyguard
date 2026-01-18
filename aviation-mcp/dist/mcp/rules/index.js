var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Tool, SchemaConstraint, Optional } from "@leanmcp/core";
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
    SchemaConstraint({ description: 'Recommended immediate action' }),
    __metadata("design:type", String)
], SafetyAssessment.prototype, "recommendation", void 0);
class PatternTurnInput {
    currentLeg;
    distanceFromThreshold;
    relativeAltitude;
}
__decorate([
    SchemaConstraint({ description: 'Current leg in the traffic pattern', enum: ['upwind', 'crosswind', 'downwind', 'base', 'final'] }),
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
class AircraftPriorityStatus {
    callsign;
    status;
}
__decorate([
    SchemaConstraint({ description: 'Aircraft callsign' }),
    __metadata("design:type", String)
], AircraftPriorityStatus.prototype, "callsign", void 0);
__decorate([
    SchemaConstraint({ description: 'Current flight status', enum: ['CRUISING', 'LANDING', 'TAKEOFF', 'EMERGENCY'] }),
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
            if (minDistance < 3.0 && verticalSep < 1000) {
                return {
                    status: 'UNSAFE',
                    message: `Conflict with ${closestTraffic.callsign}: ${minDistance.toFixed(1)}nm / ${verticalSep.toFixed(0)}ft separation.`,
                    recommendation: 'IMMEDIATE CLIMB OR TURN.'
                };
            }
            else if (minDistance < 5.0 && verticalSep < 1000) {
                return {
                    status: 'WARNING',
                    message: `Traffic warning: ${closestTraffic.callsign} is ${minDistance.toFixed(1)}nm away.`,
                    recommendation: 'Monitor traffic.'
                };
            }
        }
        return {
            status: 'SAFE',
            message: 'No traffic conflicts detected.',
            recommendation: 'Maintain current course.'
        };
    }
    async validatePatternTurn(args) {
        const { currentLeg, distanceFromThreshold, relativeAltitude } = args;
        // Rule: Pattern altitude usually 1000ft AGL
        if (Math.abs(relativeAltitude - 1000) > 200) {
            return {
                status: 'WARNING',
                message: `Non-standard pattern altitude: ${relativeAltitude}ft (Expected ~1000ft).`,
                recommendation: 'Correct altitude.'
            };
        }
        if (currentLeg === 'downwind' && distanceFromThreshold > 2.0) {
            return {
                status: 'WARNING',
                message: 'Extended downwind too far.',
                recommendation: 'Turn base recommended.'
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
            // Simple priority rules
            if (ac.status === 'EMERGENCY')
                score += 100;
            else if (ac.status === 'LANDING')
                score += 50;
            else if (ac.status === 'TAKEOFF')
                score += 20;
            return { callsign: ac.callsign, score, status: ac.status };
        });
        scoredAircraft.sort((a, b) => b.score - a.score);
        return {
            orderedCallsigns: scoredAircraft.map(a => a.callsign),
            explanation: `Priority given to ${scoredAircraft[0].status} aircraft (${scoredAircraft[0].callsign}).`
        };
    }
}
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
        description: 'Validate if a turn in the traffic pattern is safe and standard.',
        inputClass: PatternTurnInput
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PatternTurnInput]),
    __metadata("design:returntype", Promise)
], AviationSafetyService.prototype, "validatePatternTurn", null);
__decorate([
    Tool({
        description: 'Determine priority among multiple aircraft based on status.',
        inputClass: PriorityCheckInput
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PriorityCheckInput]),
    __metadata("design:returntype", Promise)
], AviationSafetyService.prototype, "assessPriority", null);

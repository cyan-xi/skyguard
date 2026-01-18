/**
 * Brain - Intelligent air traffic control decision-making system
 * 
 * Monitors aircraft separation using Euclidean distance calculations,
 * detects conflicts at multiple threat levels, and generates collision
 * avoidance instructions.
 * 
 * Operates in two modes:
 * - Manual: Generates suggestions for human controller approval
 * - Automatic: Directly executes conflict resolution instructions
 */

class Brain {
    constructor(options = {}) {
        this.autoMode = options.autoMode || false;
        this.instructionHistory = [];
        this.conflictHistory = [];

        // Conflict detection thresholds
        this.thresholds = {
            critical: { horizontal: 1.0, vertical: 500 },   // NM, ft
            warning: { horizontal: 2.0, vertical: 1000 },   // NM, ft
            advisory: { horizontal: 3.0, vertical: 1500 }   // NM, ft
        };

        // Cooldown to prevent instruction spam (seconds)
        this.instructionCooldown = 5;
        this.lastInstructionTime = {};
    }

    /**
     * Toggle between automatic and manual mode
     */
    setAutoMode(enabled) {
        this.autoMode = enabled;
        console.log(`[Brain] Mode changed to: ${enabled ? 'AUTOMATIC' : 'MANUAL'}`);
    }

    /**
     * Calculate Euclidean distance between two aircraft in NM
     */
    _distanceNm(a, b) {
        const dx = a._xNm - b._xNm;
        const dy = a._yNm - b._yNm;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate relative velocity (closing rate) between two aircraft
     */
    _closingRate(a, b) {
        // Convert heading to radians and calculate velocity components
        const aHeadRad = (a.headingDeg * Math.PI) / 180;
        const bHeadRad = (b.headingDeg * Math.PI) / 180;

        const aVx = a.groundSpeedKt * Math.sin(aHeadRad) / 3600; // NM/sec
        const aVy = a.groundSpeedKt * Math.cos(aHeadRad) / 3600;
        const bVx = b.groundSpeedKt * Math.sin(bHeadRad) / 3600;
        const bVy = b.groundSpeedKt * Math.cos(bHeadRad) / 3600;

        // Relative velocity
        const relVx = bVx - aVx;
        const relVy = bVy - aVy;

        // Position difference
        const dx = b._xNm - a._xNm;
        const dy = b._yNm - a._yNm;

        // Closing rate (negative means approaching)
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.01) return 0;

        const closingRate = (dx * relVx + dy * relVy) / dist;
        return closingRate;
    }

    /**
     * Analyze airspace for conflicts between all aircraft pairs
     */
    analyzeAirspace(aircraft, simTimeSec) {
        const conflicts = [];

        for (let i = 0; i < aircraft.length; i++) {
            for (let j = i + 1; j < aircraft.length; j++) {
                const a = aircraft[i];
                const b = aircraft[j];

                // Skip if either aircraft is landed
                if (a._mode === 'landed' || b._mode === 'landed') continue;

                const horizontal = this._distanceNm(a, b);
                const vertical = Math.abs(a.altitudeFt - b.altitudeFt);
                const closingRate = this._closingRate(a, b);

                // Determine severity level
                let severity = null;
                if (horizontal < this.thresholds.critical.horizontal &&
                    vertical < this.thresholds.critical.vertical) {
                    severity = 'critical';
                } else if (horizontal < this.thresholds.warning.horizontal &&
                    vertical < this.thresholds.warning.vertical) {
                    severity = 'warning';
                } else if (horizontal < this.thresholds.advisory.horizontal &&
                    vertical < this.thresholds.advisory.vertical &&
                    closingRate < 0) {  // Only advisory if approaching
                    severity = 'advisory';
                }

                if (severity) {
                    conflicts.push({
                        id: `conflict-${a.id}-${b.id}`,
                        aircraft: [a, b],
                        aircraftIds: [a.id, b.id],
                        callsigns: [a.callsign, b.callsign],
                        horizontalSep: horizontal,
                        verticalSep: vertical,
                        closingRate,
                        severity,
                        detectedAt: simTimeSec,
                        geometry: this._analyzeGeometry(a, b)
                    });
                }
            }
        }

        // Sort by severity and distance
        conflicts.sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, advisory: 2 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return a.horizontalSep - b.horizontalSep;
        });

        this.conflictHistory = conflicts;
        return conflicts;
    }

    /**
     * Analyze geometric relationship between two aircraft
     */
    _analyzeGeometry(a, b) {
        // Determine if overtaking, head-on, or converging
        const dx = b._xNm - a._xNm;
        const dy = b._yNm - a._yNm;
        const bearingRad = Math.atan2(dx, dy);
        const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;

        const aHeading = a.headingDeg;
        const bHeading = b.headingDeg;

        // Relative heading difference
        let headingDiff = Math.abs(aHeading - bHeading);
        if (headingDiff > 180) headingDiff = 360 - headingDiff;

        // Determine scenario
        let scenario = 'converging';
        if (headingDiff < 30) {
            // Same direction - check if overtaking
            scenario = a.groundSpeedKt < b.groundSpeedKt ? 'overtaking' : 'same-direction';
        } else if (headingDiff > 150) {
            scenario = 'head-on';
        }

        return {
            scenario,
            bearingFromA: bearingDeg,
            headingDiff,
            fasterAircraft: a.groundSpeedKt > b.groundSpeedKt ? a.id : b.id
        };
    }

    /**
     * Generate conflict resolution instructions
     */
    generateInstructions(conflicts, simTimeSec) {
        if (!conflicts || conflicts.length === 0) return [];

        const instructions = [];

        // Handle most critical conflict first
        for (const conflict of conflicts.slice(0, 3)) { // Max 3 simultaneous conflicts
            if (conflict.severity === 'advisory') continue; // Only act on warning/critical

            const [a, b] = conflict.aircraft;

            // Check cooldown to prevent instruction spam
            const cooldownA = this._checkCooldown(a.id, simTimeSec);
            const cooldownB = this._checkCooldown(b.id, simTimeSec);

            if (!cooldownA && !cooldownB) {
                continue; // Skip if both on cooldown
            }

            // Generate appropriate instruction based on geometry
            const instr = this._selectResolutionStrategy(conflict, simTimeSec, cooldownA, cooldownB);
            if (instr) {
                instructions.push(instr);
                this.instructionHistory.push(instr);
                this.lastInstructionTime[instr.aircraftId] = simTimeSec;
            }
        }

        return instructions;
    }

    /**
     * Check if enough time has passed since last instruction for this aircraft
     */
    _checkCooldown(aircraftId, simTimeSec) {
        const lastTime = this.lastInstructionTime[aircraftId];
        if (!lastTime) return true;
        return (simTimeSec - lastTime) >= this.instructionCooldown;
    }

    /**
     * Select the best resolution strategy based on conflict geometry
     */
    _selectResolutionStrategy(conflict, simTimeSec, cooldownA, cooldownB) {
        const [a, b] = conflict.aircraft;
        const geometry = conflict.geometry;

        // Priority order: speed > heading > altitude

        // Overtaking scenario: slow down faster aircraft
        if (geometry.scenario === 'overtaking') {
            const faster = geometry.fasterAircraft === a.id ? a : b;
            if ((faster.id === a.id && cooldownA) || (faster.id === b.id && cooldownB)) {
                const targetSpeed = Math.max(faster.groundSpeedKt - 20, 80);
                return {
                    id: `instr-${Date.now()}-${faster.id}`,
                    aircraftId: faster.id,
                    callsign: faster.callsign,
                    type: 'SPEED_CHANGE',
                    params: { targetSpeedKt: targetSpeed },
                    reason: `Overtaking ${faster.id === a.id ? b.callsign : a.callsign}`,
                    priority: conflict.severity,
                    createdAt: simTimeSec,
                    status: 'pending'
                };
            }
        }

        // Head-on or converging: turn one aircraft
        if (geometry.scenario === 'head-on' || geometry.scenario === 'converging') {
            // Turn the aircraft with cooldown available
            const targetAircraft = cooldownA ? a : b;

            // Turn right by 30-45 degrees
            const turnAmount = conflict.severity === 'critical' ? 45 : 30;
            const newHeading = (targetAircraft.headingDeg + turnAmount) % 360;

            return {
                id: `instr-${Date.now()}-${targetAircraft.id}`,
                aircraftId: targetAircraft.id,
                callsign: targetAircraft.callsign,
                type: 'HEADING_CHANGE',
                params: { targetHeadingDeg: newHeading },
                reason: `Traffic conflict with ${targetAircraft.id === a.id ? b.callsign : a.callsign}`,
                priority: conflict.severity,
                createdAt: simTimeSec,
                status: 'pending'
            };
        }

        // Vertical separation if close horizontally but some vertical gap
        if (conflict.horizontalSep < 1.5 && conflict.verticalSep > 200 && conflict.verticalSep < 800) {
            const targetAircraft = cooldownA ? a : b;
            const direction = a.altitudeFt > b.altitudeFt ? 1 : -1;
            const targetAlt = targetAircraft.altitudeFt + (direction * 1000);

            return {
                id: `instr-${Date.now()}-${targetAircraft.id}`,
                aircraftId: targetAircraft.id,
                callsign: targetAircraft.callsign,
                type: 'ALTITUDE_CHANGE',
                params: { targetAltitudeFt: targetAlt },
                reason: `Vertical separation from ${targetAircraft.id === a.id ? b.callsign : a.callsign}`,
                priority: conflict.severity,
                createdAt: simTimeSec,
                status: 'pending'
            };
        }

        // Default: speed reduction
        const targetAircraft = cooldownA ? a : b;
        const targetSpeed = Math.max(targetAircraft.groundSpeedKt - 15, 80);
        return {
            id: `instr-${Date.now()}-${targetAircraft.id}`,
            aircraftId: targetAircraft.id,
            callsign: targetAircraft.callsign,
            type: 'SPEED_CHANGE',
            params: { targetSpeedKt: targetSpeed },
            reason: `Maintain separation from ${targetAircraft.id === a.id ? b.callsign : a.callsign}`,
            priority: conflict.severity,
            createdAt: simTimeSec,
            status: 'pending'
        };
    }

    /**
     * Format instruction as human-readable suggestion
     */
    formatAsSuggestion(instruction) {
        if (!instruction) return '';

        const { callsign, type, params, reason } = instruction;

        switch (type) {
            case 'SPEED_CHANGE':
                return `${callsign}, reduce speed to ${params.targetSpeedKt} knots. ${reason}.`;
            case 'HEADING_CHANGE':
                return `${callsign}, turn right heading ${Math.round(params.targetHeadingDeg)}. ${reason}.`;
            case 'ALTITUDE_CHANGE':
                const direction = params.targetAltitudeFt > 0 ? 'climb' : 'descend';
                return `${callsign}, ${direction} to ${Math.abs(params.targetAltitudeFt)} feet. ${reason}.`;
            case 'PATTERN_HOLD':
                return `${callsign}, make right 360 for spacing. ${reason}.`;
            default:
                return `${callsign}, maintain separation.`;
        }
    }

    /**
     * Get recent instruction history
     */
    getInstructionHistory(limit = 10) {
        return this.instructionHistory.slice(-limit);
    }

    /**
     * Get current conflicts
     */
    getCurrentConflicts() {
        return this.conflictHistory;
    }
}

module.exports = { Brain };

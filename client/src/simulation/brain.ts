/**
 * Client-side Brain - Collision avoidance logic
 */

import type { Plane, SuggestedMessage } from './types';

interface Conflict {
    planeA: Plane;
    planeB: Plane;
    distance: number;
    severity: 'critical' | 'warning' | 'advisory';
}

// Conflict detection thresholds (in coordinate units)
const THRESHOLDS = {
    critical: 0.15,  // Very close
    warning: 0.25,   // Getting close
    advisory: 0.35   // Watch zone
};

/**
 * Calculate distance between two planes
 */
function getDistance(a: Plane, b: Plane): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Detect conflicts between all plane pairs
 */
export function detectConflicts(planes: Plane[]): Conflict[] {
    const conflicts: Conflict[] = [];

    for (let i = 0; i < planes.length; i++) {
        for (let j = i + 1; j < planes.length; j++) {
            const planeA = planes[i];
            const planeB = planes[j];
            const distance = getDistance(planeA, planeB);

            let severity: 'critical' | 'warning' | 'advisory' | null = null;

            if (distance < THRESHOLDS.critical) {
                severity = 'critical';
            } else if (distance < THRESHOLDS.warning) {
                severity = 'warning';
            } else if (distance < THRESHOLDS.advisory) {
                severity = 'advisory';
            }

            if (severity) {
                conflicts.push({
                    planeA,
                    planeB,
                    distance,
                    severity
                });
            }
        }
    }

    // Sort by severity then distance
    const severityOrder = { critical: 0, warning: 1, advisory: 2 };
    conflicts.sort((a, b) => {
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return a.distance - b.distance;
    });

    return conflicts;
}

/**
 * Generate suggestion for most critical conflict
 */
export function generateConflictSuggestion(planes: Plane[]): SuggestedMessage | null {
    const conflicts = detectConflicts(planes);

    if (conflicts.length === 0) return null;

    // Handle most critical conflict
    const conflict = conflicts[0];

    // Only suggest for warning/critical, not advisory
    if (conflict.severity === 'advisory') return null;

    const { planeA, planeB } = conflict;

    // Determine which plane to instruct (pick slower one to speed up, or faster one to slow down)
    const fasterPlane = planeA.groundspeed > planeB.groundspeed ? planeA : planeB;
    const slowerPlane = fasterPlane === planeA ? planeB : planeA;

    // Strategy: Tell faster plane to do a 360 for spacing
    const message = `${fasterPlane.callsign}, make right 360 for spacing. Traffic ${slowerPlane.callsign} at ${conflict.distance.toFixed(2)} units.`;

    return {
        message,
        targetCallsigns: [fasterPlane.callsign],
        priority: conflict.severity === 'critical' ? 'caution' : 'routine',
        createdAt: new Date().toISOString()
    };
}

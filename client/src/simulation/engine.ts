import type { Plane, TranscriptEntry, Anomaly, SuggestedMessage } from "./types";

let planeCounter = 0;

export function createRandomPlane(): Plane {
    const now = new Date().toISOString();
    planeCounter += 1;
    const radius = 1.3;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const headingRad = Math.atan2(-y, -x);
    const heading = ((headingRad * 180) / Math.PI + 360) % 360;
    const intentions = ["touch-and-go", "full-stop"];
    const intention = intentions[Math.floor(Math.random() * intentions.length)];
    const callsign = "N" + (100 + planeCounter) + String(planeCounter % 10) + "X";
    const altitude = 1900 + Math.random() * 800;
    const groundspeed = 70 + Math.random() * 20;
    return {
        id: callsign,
        callsign,
        intention,
        x,
        y,
        altitude,
        heading,
        groundspeed,
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

export function computeAnomalies(planes: Plane[]): Anomaly[] {
    const result: Anomaly[] = [];
    const horizontalThresholdNm = 1.5;
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
                    description:
                        "Loss of separation between " +
                        a.callsign +
                        " and " +
                        b.callsign +
                        ": " +
                        dist.toFixed(2) +
                        " NM / " +
                        altDiff.toFixed(0) +
                        " ft.",
                    involvedCallsigns: [a.callsign, b.callsign],
                    recommendedAction: "Issue vectors or altitude change to restore separation.",
                });
            } else if (dist <= horizontalThresholdNm * 2 && altDiff <= verticalThresholdFt * 2) {
                result.push({
                    id: "anomaly-close-" + a.id + "-" + b.id,
                    type: "converging-head-on",
                    severity: "warning",
                    description:
                        "Converging traffic " +
                        a.callsign +
                        " and " +
                        b.callsign +
                        ": " +
                        dist.toFixed(2) +
                        " NM / " +
                        altDiff.toFixed(0) +
                        " ft.",
                    involvedCallsigns: [a.callsign, b.callsign],
                    recommendedAction: "Consider sequencing turn or speed adjustment.",
                });
            }
        }
    }
    return result;
}

export function chooseSuggestion(planes: Plane[], anomalies: Anomaly[]): SuggestedMessage | null {
    if (anomalies.length > 0) {
        const critical = anomalies.find((a) => a.severity === "critical");
        const anomaly = critical || anomalies[0];
        if (anomaly.type === "loss-of-separation" || anomaly.type === "converging-head-on") {
            const callsigns = anomaly.involvedCallsigns.slice(0, 2);
            const primary = callsigns[0];
            const secondary = callsigns[1];
            const message =
                primary +
                ", make right three-sixty for spacing, " +
                "traffic " +
                secondary +
                " on converging leg.";
            return {
                message,
                targetCallsigns: callsigns,
                priority: "caution",
                createdAt: new Date().toISOString(),
            };
        }
    }
    if (planes.length > 0) {
        const plane = planes[Math.floor(Math.random() * planes.length)];
        const direction = Math.random() > 0.5 ? "right" : "left";
        const pattern = direction === "right" ? "right traffic" : "left traffic";
        const message =
            plane.callsign +
            ", continue " +
            pattern +
            " runway 28, " +
            "report base.";
        return {
            message,
            targetCallsigns: [plane.callsign],
            priority: "routine",
            createdAt: new Date().toISOString(),
        };
    }
    return null;
}

export function updatePlanePositionsLogic(currentPlanes: Plane[]): Plane[] {
    const dtSeconds = 2.0;
    const maxRadiusActive = 1.4;
    const maxPlanes = 3;
    let nextPlanes = currentPlanes.map((plane) => {
        const rad = (plane.heading * Math.PI) / 180;
        const speedNmPerSec = (plane.groundspeed / 3600) * 0.3;
        const nx = plane.x + Math.cos(rad) * speedNmPerSec * dtSeconds;
        const ny = plane.y + Math.sin(rad) * speedNmPerSec * dtSeconds;
        const jitter = (Math.random() - 0.5) * 0.01;
        const jitterAlt = (Math.random() - 0.5) * 10;
        let heading = plane.heading + (Math.random() - 0.5) * 1.2;
        if (heading < 0) heading += 360;
        if (heading >= 360) heading -= 360;
        return {
            ...plane,
            x: nx + jitter,
            y: ny + jitter,
            altitude: plane.altitude + jitterAlt,
            heading,
            lastUpdated: new Date().toISOString(),
        };
    });
    nextPlanes = nextPlanes.filter((plane) => {
        const r = Math.hypot(plane.x, plane.y);
        return r <= maxRadiusActive;
    });
    while (nextPlanes.length < maxPlanes) {
        nextPlanes.push(createRandomPlane());
    }
    return nextPlanes;
}

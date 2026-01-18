import type { Plane } from "../simulation/types";

interface ActiveAircraftPanelProps {
    planes: Plane[];
}

export function ActiveAircraftPanel({ planes }: ActiveAircraftPanelProps) {
    if (planes.length === 0) {
        return <div className="panel-content empty-state">No Active Aircraft</div>;
    }

    const getStatusText = (p: Plane) => {
        if (p.flightMode === "transit") return "INBOUND";
        if (p.patternLeg === "crosswind") return "CROSSWIND";
        if (p.patternLeg === "downwind") return "DOWNWIND";
        if (p.patternLeg === "base") return "BASE";
        if (p.patternLeg === "final" || p.patternLeg === "upwind") return "RUNWAY";
        return "UNKNOWN";
    };

    return (
        <div className="active-aircraft-list">
            {planes.map(p => (
                <div key={p.id} className="aircraft-card">
                    <div className="aircraft-header">
                        <span className="aircraft-callsign">{p.callsign}</span>
                        <span className="aircraft-status-badge">{getStatusText(p)}</span>
                    </div>
                    <div className="aircraft-details">
                        <div className="detail-row">
                            <span className="label">POS:</span>
                            <span className="value">X:{p.x.toFixed(2)} Y:{p.y.toFixed(2)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="label">ALT:</span>
                            <span className="value">{Math.round(p.altitude)} FT</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

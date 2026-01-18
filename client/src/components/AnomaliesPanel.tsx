import type { Anomaly } from "../types";
import "./AnomaliesPanel.css";

interface AnomaliesPanelProps {
  anomalies: Anomaly[];
}

function severityRank(severity: Anomaly["severity"]): number {
  switch (severity) {
    case "critical":
      return 3;
    case "high":
      return 2;
    case "medium":
      return 1;
    case "low":
    default:
      return 0;
  }
}

export function AnomaliesPanel({ anomalies }: AnomaliesPanelProps) {
  const sorted = [...anomalies].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity)
  );

  return (
    <div className="anomalies-panel">
      <div className="panel-header">Anomalies</div>
      <div className="anomalies-list">
        {sorted.length === 0 && (
          <div className="anomalies-empty">No current conflicts.</div>
        )}
        {sorted.map(anom => (
          <div key={anom.id} className={`anomaly-item anomaly-${anom.severity}`}>
            <div className="anomaly-header-row">
              <span className="anomaly-type">{anom.type}</span>
              <span className="anomaly-time">
                {anom.simTimeSec.toFixed(1)}s
              </span>
            </div>
            <div className="anomaly-body">
              <div className="anomaly-description">{anom.description}</div>
              {anom.aircraftIds.length > 0 && (
                <div className="anomaly-aircraft">
                  {anom.aircraftIds.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


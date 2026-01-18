import type { Anomaly } from "../simulation/types";

interface AnomaliesPanelProps {
  anomalies: Anomaly[];
}

export function AnomaliesPanel({ anomalies }: AnomaliesPanelProps) {
  if (anomalies.length === 0) {
    return <div style={{ color: "#546a8e", fontSize: "11px" }}>No active anomalies.</div>;
  }

  return (
    <>
      {anomalies.map((anomaly) => {
        let severityClass = "";
        if (anomaly.severity === "info") {
          severityClass = "severity-info";
        } else if (anomaly.severity === "warning") {
          severityClass = "severity-warning";
        } else {
          severityClass = "severity-critical";
        }

        return (
          <div key={anomaly.id} className="anomaly-row">
            <div className="anomaly-header">
              <div className="anomaly-type">{anomaly.type.replace(/-/g, " ")}</div>
              <div className={`anomaly-severity ${severityClass}`}>
                {anomaly.severity.toUpperCase()}
              </div>
            </div>
            <div className="anomaly-description">{anomaly.description}</div>
            <div className="anomaly-callsigns">
              {anomaly.involvedCallsigns.map((cs) => (
                <span key={cs} className="callsign-chip">
                  {cs}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

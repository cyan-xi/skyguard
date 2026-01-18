import type { BroadcastDecision } from "../types";
import "./SuggestedMessagePanel.css";

interface SuggestedMessagePanelProps {
  suggestedMessage?: string;
  decisionState: BroadcastDecision;
  onBroadcast: () => void;
  onReject: () => void;
  simId?: string;
}

export function SuggestedMessagePanel({
  suggestedMessage,
  decisionState,
  onBroadcast,
  onReject,
  simId
}: SuggestedMessagePanelProps) {
  const disabled = !suggestedMessage || decisionState === "pending";

  return (
    <div className="suggested-panel">
      <div className="panel-header">Suggested Transmission</div>
      <div className="suggested-body">
        <div className="suggested-message">
          {suggestedMessage ? (
            <span>{suggestedMessage}</span>
          ) : (
            <span className="suggested-placeholder">
              Waiting for controller context...
            </span>
          )}
        </div>
        <div className="suggested-status-row">
          <span className={`suggested-status suggested-status-${decisionState}`}>
            {decisionState === "idle" && "Standing by"}
            {decisionState === "pending" && "Transmitting..."}
            {decisionState === "broadcasted" && "Broadcasted"}
            {decisionState === "rejected" && "Rejected"}
          </span>
        </div>
        <div className="suggested-actions">
          <button
            className="btn btn-broadcast"
            disabled={disabled}
            onClick={onBroadcast}
          >
            Broadcast
          </button>
          <button
            className="btn btn-reject"
            disabled={disabled}
            onClick={onReject}
          >
            Reject
          </button>
        </div>
        {simId && (
          <div className="suggested-export-row">
            <a
              className="export-link"
              href={`http://localhost:4000/simulations/${simId}/export`}
              target="_blank"
              rel="noreferrer"
            >
              Download run CSV
            </a>
          </div>
        )}
      </div>
    </div>
  );
}


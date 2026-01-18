import type { SuggestedMessage } from "../simulation/types";

interface SuggestedMessagePanelProps {
  suggestedMessage: SuggestedMessage | null;
  onBroadcast: () => void;
  onReject: () => void;
}

export function SuggestedMessagePanel({
  suggestedMessage,
  onBroadcast,
  onReject,
}: SuggestedMessagePanelProps) {
  if (!suggestedMessage) {
    return (
      <>
        <div id="suggested-meta" className="suggested-meta">
          No active suggestion.
        </div>
        <div id="suggested-message-text" className="suggested-message-text"></div>
        <div className="suggested-actions">
          <button id="broadcast-btn" className="btn primary" disabled>
            Broadcast
          </button>
          <button id="reject-btn" className="btn secondary" disabled>
            Reject
          </button>
        </div>
      </>
    );
  }

  const targets = suggestedMessage.targetCallsigns.join(", ");
  const headerText =
    "[" +
    suggestedMessage.priority.toUpperCase() +
    "] " +
    (targets ? "To: " + targets : "Pattern-wide advisory");

  return (
    <>
      <div id="suggested-meta" className="suggested-meta">
        {headerText}
      </div>
      <div id="suggested-message-text" className="suggested-message-text">
        {suggestedMessage.message}
      </div>
      <div className="suggested-actions">
        <button id="broadcast-btn" className="btn primary" onClick={onBroadcast}>
          Broadcast
        </button>
        <button id="reject-btn" className="btn secondary" onClick={onReject}>
          Reject
        </button>
      </div>
    </>
  );
}

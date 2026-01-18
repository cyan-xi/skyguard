import type { TranscriptMessage } from "../types";
import "./TranscriptPanel.css";

interface TranscriptPanelProps {
  messages: TranscriptMessage[];
}

export function TranscriptPanel({ messages }: TranscriptPanelProps) {
  return (
    <div className="transcript-panel">
      <div className="transcript-list">
        {messages.length === 0 && (
          <div className="transcript-empty">Awaiting traffic...</div>
        )}
        {messages
          .slice()
          .reverse()
          .map(msg => (
            <div key={msg.id} className={`transcript-item transcript-${msg.role}`}>
              <div className="transcript-meta">
                <span className="transcript-time">
                  {msg.atSimTimeSec.toFixed(1)}s
                </span>
                {msg.callsign && (
                  <span className="transcript-callsign">{msg.callsign}</span>
                )}
                <span className="transcript-role-label">
                  {msg.role === "tower"
                    ? "TWR"
                    : msg.role === "pilot"
                    ? "PILOT"
                    : "SYS"}
                </span>
              </div>
              <div className="transcript-text">{msg.text}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

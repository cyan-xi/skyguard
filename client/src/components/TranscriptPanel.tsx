import type { TranscriptEntry } from "../simulation/types";

interface TranscriptPanelProps {
  messages: TranscriptEntry[];
}

function formatTime(isoString: string) {
  const date = new Date(isoString);
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return h + ":" + m + ":" + s;
}

export function TranscriptPanel({ messages }: TranscriptPanelProps) {
  return (
    <>
      {messages.map((entry) => {
        let originClass = "";
        if (entry.from === "ATC") {
          originClass = "origin-atc";
        } else if (entry.from === "SKYGUARD") {
          originClass = "origin-skyguard";
        } else {
          originClass = "origin-pilot";
        }

        return (
          <div key={entry.id} className="transcript-entry">
            <div className="transcript-timestamp">{formatTime(entry.timestamp)}</div>
            <div className={`transcript-origin ${originClass}`}>{entry.from}</div>
            <div className="transcript-callsign">{entry.callsign}</div>
            <div className="transcript-message">{entry.message}</div>
          </div>
        );
      })}
    </>
  );
}

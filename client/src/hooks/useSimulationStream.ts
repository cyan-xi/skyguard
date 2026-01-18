import { useEffect, useRef, useState } from "react";
import type { SimulationTick } from "../types";

interface UseSimulationStreamOptions {
  url: string;
}

interface UseSimulationStreamResult {
  tick: SimulationTick | null;
  connectionStatus: "connecting" | "open" | "closed" | "error";
  error?: string;
}

export function useSimulationStream(
  options: UseSimulationStreamOptions
): UseSimulationStreamResult {
  const { url } = options;
  const [tick, setTick] = useState<SimulationTick | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "error">(
    "connecting"
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      setError(undefined);
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data) as SimulationTick;
        setTick(data);
      } catch {
        setStatus("error");
        setError("Failed to parse simulation tick");
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setError("WebSocket error");
    };

    ws.onclose = () => {
      setStatus("closed");
    };

    return () => {
      ws.close();
    };
  }, [url]);

  return { tick, connectionStatus: status, error };
}

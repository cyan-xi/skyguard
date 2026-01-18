import { useEffect, useState } from "react";

export interface AtcLog {
    timestamp: string;
    callsign: string;
    command: string;
    value: string;
    message: string;
}

export function useAtcLogs() {
    const [logs, setLogs] = useState<AtcLog[]>([]);

    // In a real app with backend persistence, we might fetch history here.
    // For this demo, we will expose a global function that the WebSocket handler
    // or a direct fetcher can call to push new logs.

    // However, since the current architecture streams the entire state via useSimulationStream,
    // we might want to integrate with that or use a separate event mechanism.

    // Given the user wants a separate hook/file, let's make this hook listen
    // to a custom window event that our WebSocket handler creates, OR
    // simply expose a method to add logs.

    useEffect(() => {
        const handleLogEvent = (event: CustomEvent<AtcLog>) => {
            setLogs((prev) => [...prev, event.detail]);
        };

        window.addEventListener("atc-log" as any, handleLogEvent as any);
        return () => {
            window.removeEventListener("atc-log" as any, handleLogEvent as any);
        };
    }, []);

    return { logs };
}

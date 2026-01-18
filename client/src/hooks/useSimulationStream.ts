import { useEffect, useState } from 'react';

export interface SimulationTick {
    simId: string;
    simTimeSec: number;
    aircraft: any[];
    anomalies: any[];
    conflicts?: any[];
    transcript: any[];
    suggestedMessage?: string;
    brainMode?: string;
}

interface UseSimulationStreamResult {
    tick: SimulationTick | null;
    connectionStatus: 'connecting' | 'open' | 'closed' | 'error';
    error: string | null;
}

export function useSimulationStream(url: string): UseSimulationStreamResult {
    const [tick, setTick] = useState<SimulationTick | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let ws: WebSocket | null = null;

        try {
            ws = new WebSocket(url);

            ws.onopen = () => {
                console.log('[WebSocket] Connected to simulation server');
                setConnectionStatus('open');
                setError(null);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setTick(data);
                } catch (err) {
                    console.error('[WebSocket] Failed to parse message:', err);
                    setError('Failed to parse server data');
                    setConnectionStatus('error');
                }
            };

            ws.onerror = (event) => {
                console.error('[WebSocket] Error:', event);
                setError('WebSocket error');
                setConnectionStatus('error');
            };

            ws.onclose = () => {
                console.log('[WebSocket] Connection closed');
                setConnectionStatus('closed');
            };

        } catch (err) {
            console.error('[WebSocket] Failed to connect:', err);
            setError('Failed to connect to server');
            setConnectionStatus('error');
        }

        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [url]);

    return { tick, connectionStatus, error };
}

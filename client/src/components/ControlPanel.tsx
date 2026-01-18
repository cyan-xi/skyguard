import './ControlPanel.css';

interface ControlPanelProps {
    callsign: string;
    speed: number;
    onManeuver: (command: string, value: string | number) => void;
}

export function ControlPanel({ callsign, speed, onManeuver }: ControlPanelProps) {
    return (
        <div className="control-panel">
            <div className="control-header">Control: {callsign} | {Math.round(speed)} kt</div>
            <div className="control-buttons">
                <button onClick={() => onManeuver("ENTER_PATH", 0)}>
                    Enter Pattern
                </button>
                <button onClick={() => onManeuver("SET_ALTITUDE", 1000)}>
                    Hover Altitude (1000ft)
                </button>
                <button onClick={() => onManeuver("DO_360", 0)}>
                    Right 360
                </button>
                <div className="speed-controls" style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => onManeuver("SPEED_CHANGE", 20)} title="Increase Speed">
                        Spd +20
                    </button>
                    <button onClick={() => onManeuver("SPEED_CHANGE", -20)} title="Decrease Speed">
                        Spd -20
                    </button>
                </div>
            </div>
        </div>
    );
}

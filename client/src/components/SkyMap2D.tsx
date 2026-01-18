import type { AircraftState, Anomaly } from "../types";
import "./SkyMap2D.css";

interface SkyMap2DProps {
  aircraft: AircraftState[];
  anomalies: Anomaly[];
}

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;

const BASE_LAT = 40.6413;
const BASE_LON = -73.7781;
const NM_TO_DEG_LAT = 1 / 60;
const NM_TO_DEG_LON = 1 / (60 * Math.cos((BASE_LAT * Math.PI) / 180));
const FRAME_HALF_WIDTH_NM = 6;
const FRAME_HALF_HEIGHT_NM = 6;
const PATTERN_WIDTH_NM = 8;
const PATTERN_HEIGHT_NM = 4;

function latLonToNm(lat: number, lon: number) {
  const yNm = (lat - BASE_LAT) / NM_TO_DEG_LAT;
  const xNm = (lon - BASE_LON) / NM_TO_DEG_LON;
  return { xNm, yNm };
}

function nmToView(
  xNm: number,
  yNm: number,
  width: number,
  height: number
): { x: number; y: number } | null {
  if (
    Math.abs(xNm) > FRAME_HALF_WIDTH_NM ||
    Math.abs(yNm) > FRAME_HALF_HEIGHT_NM
  ) {
    return null;
  }
  const x =
    ((xNm + FRAME_HALF_WIDTH_NM) / (FRAME_HALF_WIDTH_NM * 2)) * width;
  const y =
    height -
    ((yNm + FRAME_HALF_HEIGHT_NM) / (FRAME_HALF_HEIGHT_NM * 2)) * height;
  return { x, y };
}

function computeAircraftPositions(
  aircraft: AircraftState[],
  width: number,
  height: number
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const a of aircraft) {
    const { xNm, yNm } = latLonToNm(a.lat, a.lon);
    const view = nmToView(xNm, yNm, width, height);
    if (!view) continue;
    positions[a.id] = view;
  }
  return positions;
}

export function SkyMap2D({ aircraft, anomalies }: SkyMap2DProps) {
  const positions = computeAircraftPositions(aircraft, VIEW_WIDTH, VIEW_HEIGHT);
  const criticalIds = new Set(
    anomalies
      .filter(a => a.severity === "high" || a.severity === "critical")
      .flatMap(a => a.aircraftIds)
  );

  return (
    <svg
      className="skymap-svg"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="radarGradient" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#0b1826" />
          <stop offset="60%" stopColor="#040a11" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
      </defs>
      <rect
        x={0}
        y={0}
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        fill="url(#radarGradient)"
      />
      {(() => {
        const halfW = PATTERN_WIDTH_NM / 2;
        const halfH = PATTERN_HEIGHT_NM / 2;
        const runwayStart = nmToView(-halfW, -halfH, VIEW_WIDTH, VIEW_HEIGHT);
        const runwayEnd = nmToView(halfW, -halfH, VIEW_WIDTH, VIEW_HEIGHT);
        if (!runwayStart || !runwayEnd) return null;
        return (
          <g>
            <line
              x1={runwayStart.x}
              y1={runwayStart.y}
              x2={runwayEnd.x}
              y2={runwayEnd.y}
              className="skymap-runway"
            />
          </g>
        );
      })()}
      {(() => {
        const halfW = PATTERN_WIDTH_NM / 2;
        const halfH = PATTERN_HEIGHT_NM / 2;
        const bottomLeft = nmToView(-halfW, -halfH, VIEW_WIDTH, VIEW_HEIGHT);
        const bottomRight = nmToView(halfW, -halfH, VIEW_WIDTH, VIEW_HEIGHT);
        const topRight = nmToView(halfW, halfH, VIEW_WIDTH, VIEW_HEIGHT);
        const topLeft = nmToView(-halfW, halfH, VIEW_WIDTH, VIEW_HEIGHT);
        if (!bottomLeft || !bottomRight || !topRight || !topLeft) {
          return null;
        }
        return (
          <g>
            <line
              x1={bottomLeft.x}
              y1={bottomLeft.y}
              x2={bottomRight.x}
              y2={bottomRight.y}
              className="skymap-pattern-line"
            />
            <line
              x1={bottomRight.x}
              y1={bottomRight.y}
              x2={topRight.x}
              y2={topRight.y}
              className="skymap-pattern-line"
            />
            <line
              x1={topRight.x}
              y1={topRight.y}
              x2={topLeft.x}
              y2={topLeft.y}
              className="skymap-pattern-line"
            />
            <line
              x1={topLeft.x}
              y1={topLeft.y}
              x2={bottomLeft.x}
              y2={bottomLeft.y}
              className="skymap-pattern-line"
            />
          </g>
        );
      })()}
      {Array.from({ length: 4 }).map((_, i) => {
        const r = ((i + 1) / 4) * (VIEW_HEIGHT / 2);
        return (
          <circle
            key={i}
            cx={VIEW_WIDTH / 2}
            cy={VIEW_HEIGHT / 2}
            r={r}
            className="skymap-grid-circle"
          />
        );
      })}
      <line
        x1={VIEW_WIDTH / 2}
        y1={0}
        x2={VIEW_WIDTH / 2}
        y2={VIEW_HEIGHT}
        className="skymap-grid-line"
      />
      <line
        x1={0}
        y1={VIEW_HEIGHT / 2}
        x2={VIEW_WIDTH}
        y2={VIEW_HEIGHT / 2}
        className="skymap-grid-line"
      />
      {aircraft.map(a => {
        const pos = positions[a.id];
        if (!pos) return null;
        const inDanger = criticalIds.has(a.callsign);
        return (
          <g key={a.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle
              r={inDanger ? 6 : 4}
              className={inDanger ? "skymap-target-danger" : "skymap-target"}
            />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={-10}
              className="skymap-target-heading"
              transform={`rotate(${a.headingDeg})`}
            />
            <text x={8} y={-4} className="skymap-label-callsign">
              {a.callsign}
            </text>
            <text x={8} y={10} className="skymap-label-altitude">
              {Math.round(a.altitudeFt / 100)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

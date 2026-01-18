import { useEffect, useRef, useState } from "react";
import type { Plane, Anomaly } from "../simulation/types";

interface MapOverlayProps {
    planes: Plane[];
    anomalies: Anomaly[];
    onPlaneClick: (planeId: string) => void;
    selectedPlaneIds: Set<string>;
}

const IMAGE_WIDTH = 1194;
const IMAGE_HEIGHT = 1177;
const RUNWAY10_PIXEL = { x: 584, y: 339 };
const RUNWAY28_PIXEL = { x: 557, y: 792 };

const RUNWAY_VECTOR = {
    x: RUNWAY28_PIXEL.x - RUNWAY10_PIXEL.x,
    y: RUNWAY28_PIXEL.y - RUNWAY10_PIXEL.y,
};

const RUNWAY_LENGTH_PIXELS = Math.hypot(RUNWAY_VECTOR.x, RUNWAY_VECTOR.y);

// const RUNWAY_UNIT_ALONG = {
//     x: RUNWAY_VECTOR.x / RUNWAY_LENGTH_PIXELS,
//     y: RUNWAY_VECTOR.y / RUNWAY_LENGTH_PIXELS,
// };

// const RUNWAY_UNIT_ACROSS = {
//     x: -RUNWAY_UNIT_ALONG.y,
//     y: RUNWAY_UNIT_ALONG.x,
// };

const RUNWAY_MIDPOINT = {
    x: (RUNWAY10_PIXEL.x + RUNWAY28_PIXEL.x) / 2,
    y: (RUNWAY10_PIXEL.y + RUNWAY28_PIXEL.y) / 2,
};

// function localToImagePixels(xLocal: number, yLocal: number) {
//     const alongScale = RUNWAY_LENGTH_PIXELS * 1.1;
//     const acrossScale = RUNWAY_LENGTH_PIXELS * 0.7;
//     const dx = xLocal * alongScale;
//     const dy = yLocal * acrossScale;
//     const imgX =
//         RUNWAY_MIDPOINT.x +
//         RUNWAY_UNIT_ALONG.x * dx +
//         RUNWAY_UNIT_ACROSS.x * dy;
//     const imgY =
//         RUNWAY_MIDPOINT.y +
//         RUNWAY_UNIT_ALONG.y * dx +
//         RUNWAY_UNIT_ACROSS.y * dy;
//     return { x: imgX, y: imgY };
// }


export function MapOverlay({ planes, anomalies, onPlaneClick }: MapOverlayProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState<{ scale: number; offsetX: number; offsetY: number } | null>(null);

    useEffect(() => {
        const updateTransform = () => {
            if (!containerRef.current) return;
            // We assume the image is a sibling or parent, but strictly speaking we need to match the logic:
            // In app.js it was: overlayRect vs imageRect.
            // Here, we can rely on the fact that the overlay and the image are in the same container and same size.
            // Wait, in app.js: #map (container) -> #airport-image (img) + #map-overlay (div)
            // The image fits via object-fit: contain.
            // We need to calculate the actual displayed image rect relative to the overlay.

            const container = containerRef.current.parentElement;
            if (!container) return;
            const img = container.querySelector("img.map-image") as HTMLImageElement;
            if (!img) return;

            const imgRect = img.getBoundingClientRect(); // This gives the dimensions of the img ELEMENT, but not necessarily the rendered image content if object-fit is involved.
            // Actually, if the img element fills the container, but object-fit is contain, we need to calculate the intrinsic ratio.

            if (!imgRect.width || !imgRect.height) return;

            // Calculate the "displayed" image rect within the img element
            const naturalRatio = IMAGE_WIDTH / IMAGE_HEIGHT;
            const containerRatio = imgRect.width / imgRect.height;

            let displayedW, displayedH, displayedTop, displayedLeft;

            if (containerRatio > naturalRatio) {
                // Container is wider than image -> image is full height, centered horizontally
                displayedH = imgRect.height;
                displayedW = displayedH * naturalRatio;
                displayedTop = 0;
                displayedLeft = (imgRect.width - displayedW) / 2;
            } else {
                // Container is taller than image -> image is full width, centered vertically
                displayedW = imgRect.width;
                displayedH = displayedW / naturalRatio;
                displayedLeft = 0;
                displayedTop = (imgRect.height - displayedH) / 2;
            }

            const scale = displayedW / IMAGE_WIDTH;
            // The offset in the overlay is strictly the position of the image top-left relative to the overlay top-left.
            // Since overlay is absolute inset 0, it matches the container/img element frame.
            const offsetX = displayedLeft;
            const offsetY = displayedTop;

            setTransform({ scale, offsetX, offsetY });
        };

        updateTransform();
        window.addEventListener("resize", updateTransform);
        // Also trigger on image load if possible
        const img = document.querySelector("img.map-image");
        if (img) {
            img.addEventListener("load", updateTransform);
        }
        return () => {
            window.removeEventListener("resize", updateTransform);
            if (img) img.removeEventListener("load", updateTransform);
        };
    }, []);

    if (!transform) return <div ref={containerRef} className="map-overlay" />;

    const renderElements = () => {
        const elements = [];

        // Radar Rings
        const radii = [0.5, 0.9, 1.3].map((v) => v * RUNWAY_LENGTH_PIXELS * transform.scale);
        const centerImage = RUNWAY_MIDPOINT;
        const centerX = transform.offsetX + centerImage.x * transform.scale;
        const centerY = transform.offsetY + centerImage.y * transform.scale;

        radii.forEach((r, i) => {
            elements.push(
                <div
                    key={`ring-${i}`}
                    className="radar-ring"
                    style={{
                        width: r * 2,
                        height: r * 2,
                        left: centerX - r,
                        top: centerY - r,
                    }}
                />
            );
        });

        // Runway
        const start = RUNWAY10_PIXEL;
        const end = RUNWAY28_PIXEL;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const dx = (end.x - start.x) * transform.scale;
        const dy = (end.y - start.y) * transform.scale;
        const length = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const rCenterX = transform.offsetX + midX * transform.scale;
        const rCenterY = transform.offsetY + midY * transform.scale;

        elements.push(
            <div
                key="runway"
                className="runway-highlight"
                style={{
                    width: length,
                    left: rCenterX,
                    top: rCenterY,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                }}
            />
        );

        // Runway Labels
        const startPx = {
            x: transform.offsetX + start.x * transform.scale,
            y: transform.offsetY + start.y * transform.scale,
        };
        const endPx = {
            x: transform.offsetX + end.x * transform.scale,
            y: transform.offsetY + end.y * transform.scale,
        };

        elements.push(
            <div key="label-10" className="runway-end-label" style={{ left: startPx.x, top: startPx.y }}>10</div>
        );
        elements.push(
            <div key="label-28" className="runway-end-label" style={{ left: endPx.x, top: endPx.y }}>28</div>
        );


        // Pattern Construction (User Requested: Single Rectangle, Left of Runway)
        // Runway 10 (Top) -> Runway 28 (Bottom)
        // Width = Half Runway Length
        // Orientation: Top=Crosswind, Left=Downwind, Bottom=Base

        const patternWidth = RUNWAY_LENGTH_PIXELS * 0.5;

        // Vectors
        // Runway Vector P1 (Top/10) -> P2 (Bottom/28)
        const p1 = RUNWAY10_PIXEL;
        const p2 = RUNWAY28_PIXEL;

        // Unit vector Left (Perpendicular to P1->P2)
        // Logic: If P1->P2 is roughly (0, 1), Left is (1, 0)? No, Left of screen is -x.
        // Standard perp: (x, y) -> (-y, x) is Left rotation?
        // Let's verify: (0, 1) -> (-1, 0). Yes.

        const vecDx = p2.x - p1.x;
        const vecDy = p2.y - p1.y;
        const len = Math.hypot(vecDx, vecDy);
        const ux = vecDx / len;
        const uy = vecDy / len;

        const perpX = -uy; // Pointing Left
        const perpY = ux;

        // Corners
        // P3 = P1 + Width * Left (Top-Left)
        const p3 = {
            x: p1.x + perpX * patternWidth,
            y: p1.y + perpY * patternWidth
        };

        // P4 = P2 + Width * Left (Bottom-Left)
        const p4 = {
            x: p2.x + perpX * patternWidth,
            y: p2.y + perpY * patternWidth
        };

        // Segments to render (Dotted Lines)
        // 1. Crosswind (Top: P1 -> P3)
        // 2. Downwind (Left: P3 -> P4)
        // 3. Base (Bottom: P4 -> P2)

        const patternSegments = [
            { start: p1, end: p3, label: "CROSSWIND" },
            { start: p3, end: p4, label: "DOWNWIND" },
            { start: p4, end: p2, label: "BASE" }
        ];

        patternSegments.forEach((seg, idx) => {
            const x1 = transform.offsetX + seg.start.x * transform.scale;
            const y1 = transform.offsetY + seg.start.y * transform.scale;
            const x2 = transform.offsetX + seg.end.x * transform.scale;
            const y2 = transform.offsetY + seg.end.y * transform.scale;

            const segDx = x2 - x1;
            const segDy = y2 - y1;
            const segLen = Math.hypot(segDx, segDy);
            const segAng = (Math.atan2(segDy, segDx) * 180) / Math.PI;
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;

            elements.push(
                <div
                    key={`pattern-seg-${idx}`}
                    className="radar-ring" // Re-using radar-ring style for width/color match
                    style={{
                        position: 'absolute',
                        width: segLen,
                        height: 0,
                        left: cx,
                        top: cy,
                        transform: `translate(-50%, -50%) rotate(${segAng}deg)`,
                        border: 'none',
                        borderTop: '2px dashed rgba(255, 255, 255, 0.4)', // Thicker to match rings (2px)
                        borderRadius: 0,
                    }}
                />
            );

            // Label
            elements.push(
                <div
                    key={`pattern-lbl-${idx}`}
                    className="pattern-label"
                    style={{
                        left: cx,
                        top: cy,
                        transform: 'translate(-50%, -50%)',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '10px',
                        textShadow: '0 0 2px black'
                    }}
                >
                    {seg.label}
                </div>
            );
        });

        // Planes Rendering
        // Coordinate System:
        // Engine Y: +0.5 (Top/Runway10) to -0.5 (Bottom/Runway28).
        // Engine X: -0.5 (Left/Crosswind) to 0.5 (Right/BaseStart?).
        // Map Projection:
        // Center = RUNWAY_MIDPOINT
        // Vector Up (Y+) = RUNWAY10_PIXEL - Midpoint
        // Vector Left (X-) = perp * (RUNWAY_LENGTH_PIXELS * 0.5) ??
        // No, let's use the unit vectors directly.

        // U_UP = Vector from Mid to P1 (Top).
        const uUp = { x: p1.x - ((p1.x + p2.x) / 2), y: p1.y - ((p1.y + p2.y) / 2) };
        // U_RIGHT = Vector perpendicular pointing Right.
        // Left was perp (-uy, ux). Right is (uy, -ux).
        // const uRight = { x: uy * (RUNWAY_LENGTH_PIXELS), y: -ux * (RUNWAY_LENGTH_PIXELS) };
        // Wait, length of uUp is Half Runway Length.
        // Engine X=0.5 should be Half Runway Length to the Right.
        // So scale U_RIGHT to be full runway length??
        // Pattern Width was 0.5 * Length.
        // So Engine X=0.5 -> 0.5 * Length.
        // So just normalize U_RIGHT to Length, then multiply by plane.x.

        // Simpler:
        // Pos = Mid + (plane.y * 2) * uUp + (plane.x) * (UnitVectorRight * Length)
        // Check:
        // plane.y = 0.5 -> Mid + 1.0 * uUp = Mid + (P1 - Mid) = P1. Correct.
        // plane.y = -0.5 -> Mid - 1.0 * uUp = Mid - (P1 - Mid) = Mid + (Mid - P1) = Mid + (P2 - Mid) = P2. Correct.
        // plane.x = -0.5 -> Mid + (-0.5 * Len * UnitRight) = Mid + 0.5 * Len * UnitLeft. Correct (Pattern Edge).

        planes.forEach(plane => {
            // 1. Calculate Image Pixel Position
            // Scale factors
            const scaleY = 2.0; // Because y=0.5 is full reach of uUp
            const vecY = { x: uUp.x * scaleY, y: uUp.y * scaleY }; // Full Runway Length Vector pointing Up

            // Vector Right (Normal * Length)
            // Left was (-uy, ux). Right is (uy, -ux).
            const vecX = { x: uy * RUNWAY_LENGTH_PIXELS, y: -ux * RUNWAY_LENGTH_PIXELS };

            const mid = RUNWAY_MIDPOINT;

            const imgX = mid.x + (plane.x * vecX.x) + (plane.y * vecY.x);
            const imgY = mid.y + (plane.x * vecX.y) + (plane.y * vecY.y);

            const px = transform.offsetX + imgX * transform.scale;
            const py = transform.offsetY + imgY * transform.scale;

            // Anomaly Check
            const isCritical = anomalies && anomalies.some((a) => a.involvedCallsigns.includes(plane.callsign));
            const isEmergency = (plane as any).isEmergency;

            elements.push(
                <div
                    key={plane.id}
                    className={"plane" + (isCritical ? " plane-critical" : "")}
                    style={{ left: px, top: py }}
                    onClick={(e) => { e.stopPropagation(); onPlaneClick(plane.id); }}
                >
                    {/* Emergency flashing ring */}
                    {isEmergency && (
                        <div style={{
                            position: 'absolute',
                            width: '40px',
                            height: '40px',
                            left: '8px',
                            top: '8px',
                            transform: 'translate(-50%, -50%)',
                            border: '3px solid #dc2626',
                            borderRadius: '50%',
                            pointerEvents: 'none',
                            animation: 'emergency-pulse 1s ease-in-out infinite',
                        }} />
                    )}
                    {/* Rotate icon based on heading. Map Up is 0, but Runway is tilted. 
                        We should rotate relative to screen.
                        Heading 0 (North) -> Screen Up.
                        Heading 270 (West) -> Screen Left.
                        So standard rotation is fine.
                    */}
                    <div className="plane-icon" style={{
                        transform: `rotate(${plane.heading}deg)`,
                        borderBottomColor: isEmergency ? '#dc2626' : undefined,
                        filter: isEmergency ? 'drop-shadow(0 0 6px #dc2626)' : undefined
                    }} />
                    <div className="plane-leader" />
                    <div className="plane-label">
                        <div className="plane-label-line1">
                            {plane.callsign}{isEmergency ? ' 🚨' : ''}
                        </div>
                        <div className="plane-label-line2">
                            {Math.round(plane.altitude)} ft / {Math.round(plane.groundspeed)} kt
                        </div>
                    </div>
                </div>
            );
        });

        return elements;
    };

    return (
        <div ref={containerRef} className="map-overlay" id="map-overlay">
            {renderElements()}
        </div>
    );
}

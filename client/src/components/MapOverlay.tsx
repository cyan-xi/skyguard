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

const RUNWAY_UNIT_ALONG = {
    x: RUNWAY_VECTOR.x / RUNWAY_LENGTH_PIXELS,
    y: RUNWAY_VECTOR.y / RUNWAY_LENGTH_PIXELS,
};

const RUNWAY_UNIT_ACROSS = {
    x: -RUNWAY_UNIT_ALONG.y,
    y: RUNWAY_UNIT_ALONG.x,
};

const RUNWAY_MIDPOINT = {
    x: (RUNWAY10_PIXEL.x + RUNWAY28_PIXEL.x) / 2,
    y: (RUNWAY10_PIXEL.y + RUNWAY28_PIXEL.y) / 2,
};

function localToImagePixels(xLocal: number, yLocal: number) {
    const alongScale = RUNWAY_LENGTH_PIXELS * 1.1;
    const acrossScale = RUNWAY_LENGTH_PIXELS * 0.7;
    const dx = xLocal * alongScale;
    const dy = yLocal * acrossScale;
    const imgX =
        RUNWAY_MIDPOINT.x +
        RUNWAY_UNIT_ALONG.x * dx +
        RUNWAY_UNIT_ACROSS.x * dy;
    const imgY =
        RUNWAY_MIDPOINT.y +
        RUNWAY_UNIT_ALONG.y * dx +
        RUNWAY_UNIT_ACROSS.y * dy;
    return { x: imgX, y: imgY };
}

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


        // Pattern (Simplified rendering for React - can duplicate logic or simplify)
        // For brevity, let's implement the pattern logic as well since it's key visual.
        const renderPatternSide = (sideMultiplier: number, labelText: string) => {
            const alongExtend = RUNWAY_LENGTH_PIXELS * 0.5;
            const offset = RUNWAY_LENGTH_PIXELS * 0.7;
            const a = {
                x: start.x - RUNWAY_UNIT_ALONG.x * alongExtend,
                y: start.y - RUNWAY_UNIT_ALONG.y * alongExtend,
            };
            const b = {
                x: end.x + RUNWAY_UNIT_ALONG.x * alongExtend,
                y: end.y + RUNWAY_UNIT_ALONG.y * alongExtend,
            };
            const c = {
                x: b.x + RUNWAY_UNIT_ACROSS.x * offset * sideMultiplier,
                y: b.y + RUNWAY_UNIT_ACROSS.y * offset * sideMultiplier,
            };
            const d = {
                x: a.x + RUNWAY_UNIT_ACROSS.x * offset * sideMultiplier,
                y: a.y + RUNWAY_UNIT_ACROSS.y * offset * sideMultiplier,
            };

            const segments = [
                [a, b],
                [b, c],
                [c, d],
                [d, a],
            ];

            segments.forEach((pair, idx) => {
                const p1 = pair[0];
                const p2 = pair[1];
                const x1 = transform.offsetX + p1.x * transform.scale;
                const y1 = transform.offsetY + p1.y * transform.scale;
                const x2 = transform.offsetX + p2.x * transform.scale;
                const y2 = transform.offsetY + p2.y * transform.scale;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy);
                const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
                const cx = (x1 + x2) / 2;
                const cy = (y1 + y2) / 2;

                elements.push(
                    <div
                        key={`pattern-${labelText}-${idx}`}
                        className="pattern-edge"
                        style={{
                            width: len,
                            left: cx,
                            top: cy,
                            transform: `translate(-50%, -50%) rotate(${ang}deg)`,
                        }}
                    />
                );
            });

            // Label
            const center = [a, b, c, d].reduce(
                (acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }),
                { x: 0, y: 0 }
            );
            const labelX = transform.offsetX + center.x * transform.scale;
            const labelY = transform.offsetY + center.y * transform.scale - 14 * sideMultiplier;

            elements.push(
                <div
                    key={`pattern-label-${labelText}`}
                    className="pattern-label"
                    style={{
                        left: labelX,
                        top: labelY,
                        transform: "translate(-50%, -50%)",
                    }}
                >
                    {labelText}
                </div>
            );
        };

        renderPatternSide(1, "RIGHT TRAFFIC");
        renderPatternSide(-1, "LEFT TRAFFIC");


        // Planes
        planes.forEach(plane => {
            const imagePos = localToImagePixels(plane.x, plane.y);
            const px = transform.offsetX + imagePos.x * transform.scale;
            const py = transform.offsetY + imagePos.y * transform.scale;

            const isCritical = anomalies.some((a) => a.involvedCallsigns.includes(plane.callsign));

            elements.push(
                <div
                    key={plane.id}
                    className={"plane" + (isCritical ? " plane-critical" : "")}
                    style={{ left: px, top: py }}
                    onClick={(e) => { e.stopPropagation(); onPlaneClick(plane.id); }}
                >
                    <div className="plane-icon" style={{ transform: `rotate(${plane.heading}deg)` }} />
                    <div className="plane-leader" />
                    <div className="plane-label">
                        <div className="plane-label-line1">
                            {plane.callsign}
                            <span className="plane-badge">
                                {plane.intention === "touch-and-go" ? "T&G" : "FULL"}
                            </span>
                        </div>
                        <div className="plane-label-line2">
                            {Math.round(plane.altitude)} ft
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

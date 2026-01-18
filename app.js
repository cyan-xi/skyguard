const mapElement = document.getElementById("map");
const airportImage = document.getElementById("airport-image");
const mapOverlayElement = document.getElementById("map-overlay");
const transcriptListElement = document.getElementById("transcript-list");
const anomaliesListElement = document.getElementById("anomalies-list");
const suggestedTextElement = document.getElementById("suggested-message-text");
const suggestedMetaElement = document.getElementById("suggested-meta");
const broadcastButton = document.getElementById("broadcast-btn");
const rejectButton = document.getElementById("reject-btn");
const utcTimeElement = document.getElementById("utc-time");
const utcDateElement = document.getElementById("utc-date");

const state = {
  planes: [],
  transcript: [],
  anomalies: [],
  suggestedMessage: null,
  selectedPlaneIds: new Set(),
};

let planeCounter = 0;

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

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return h + ":" + m + ":" + s;
}

function updateUtcClock() {
  if (!utcTimeElement || !utcDateElement) {
    return;
  }
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, "0");
  const m = String(now.getUTCMinutes()).padStart(2, "0");
  const s = String(now.getUTCSeconds()).padStart(2, "0");
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  utcTimeElement.textContent = h + ":" + m + ":" + s + " UTC";
  utcDateElement.textContent = year + "-" + month + "-" + day;
}

function createInitialPlanes() {
  const planes = [];
  for (let i = 0; i < 3; i++) {
    planes.push(createRandomPlane());
  }
  return planes;
}

function createRandomPlane() {
  const now = new Date().toISOString();
  planeCounter += 1;
  const radius = 1.3;
  const angle = Math.random() * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const headingRad = Math.atan2(-y, -x);
  const heading = ((headingRad * 180) / Math.PI + 360) % 360;
  const intentions = ["touch-and-go", "full-stop"];
  const intention = intentions[Math.floor(Math.random() * intentions.length)];
  const callsign = "N" + (100 + planeCounter) + String(planeCounter % 10) + "X";
  const altitude = 1900 + Math.random() * 800;
  const groundspeed = 70 + Math.random() * 20;
  return {
    id: callsign,
    callsign,
    intention,
    x,
    y,
    altitude,
    heading,
    groundspeed,
    lastUpdated: now,
  };
}

function createInitialTranscript() {
  const now = new Date();
  const t0 = new Date(now.getTime() - 120000);
  const t1 = new Date(now.getTime() - 90000);
  const t2 = new Date(now.getTime() - 45000);
  const t3 = new Date(now.getTime() - 20000);
  return [
    {
      id: "t1",
      timestamp: t0.toISOString(),
      from: "PILOT",
      callsign: "N123AB",
      message: "Beaver Tower, N123AB ten miles east, inbound full stop with information Bravo.",
    },
    {
      id: "t2",
      timestamp: t1.toISOString(),
      from: "ATC",
      callsign: "N123AB",
      message: "N123AB, Beaver Tower, enter right downwind runway 28, report midfield.",
    },
    {
      id: "t3",
      timestamp: t2.toISOString(),
      from: "PILOT",
      callsign: "N456CD",
      message: "Beaver Tower, N456CD five miles northwest, touch and go.",
    },
    {
      id: "t4",
      timestamp: t3.toISOString(),
      from: "ATC",
      callsign: "N456CD",
      message: "N456CD, Beaver Tower, make left traffic runway 28, report two mile final.",
    },
  ];
}

function chooseSuggestion(planes, anomalies) {
  if (anomalies.length > 0) {
    const critical = anomalies.find((a) => a.severity === "critical");
    const anomaly = critical || anomalies[0];
    if (anomaly.type === "loss-of-separation" || anomaly.type === "converging-head-on") {
      const callsigns = anomaly.involvedCallsigns.slice(0, 2);
      const primary = callsigns[0];
      const secondary = callsigns[1];
      const message =
        primary +
        ", make right three-sixty for spacing, " +
        "traffic " +
        secondary +
        " on converging leg.";
      return {
        message,
        targetCallsigns: callsigns,
        priority: "caution",
        createdAt: new Date().toISOString(),
      };
    }
  }
  if (planes.length > 0) {
    const plane = planes[Math.floor(Math.random() * planes.length)];
    const direction = Math.random() > 0.5 ? "right" : "left";
    const pattern = direction === "right" ? "right traffic" : "left traffic";
    const message =
      plane.callsign +
      ", continue " +
      pattern +
      " runway 28, " +
      "report base.";
    return {
      message,
      targetCallsigns: [plane.callsign],
      priority: "routine",
      createdAt: new Date().toISOString(),
    };
  }
  return null;
}

function computeAnomalies(planes) {
  const result = [];
  const horizontalThresholdNm = 1.5;
  const verticalThresholdFt = 300;
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i];
      const b = planes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const altDiff = Math.abs(a.altitude - b.altitude);
      if (dist <= horizontalThresholdNm && altDiff <= verticalThresholdFt) {
        result.push({
          id: "anomaly-" + a.id + "-" + b.id,
          type: "loss-of-separation",
          severity: "critical",
          description:
            "Loss of separation between " +
            a.callsign +
            " and " +
            b.callsign +
            ": " +
            dist.toFixed(2) +
            " NM / " +
            altDiff.toFixed(0) +
            " ft.",
          involvedCallsigns: [a.callsign, b.callsign],
          recommendedAction: "Issue vectors or altitude change to restore separation.",
        });
      } else if (dist <= horizontalThresholdNm * 2 && altDiff <= verticalThresholdFt * 2) {
        result.push({
          id: "anomaly-close-" + a.id + "-" + b.id,
          type: "converging-head-on",
          severity: "warning",
          description:
            "Converging traffic " +
            a.callsign +
            " and " +
            b.callsign +
            ": " +
            dist.toFixed(2) +
            " NM / " +
            altDiff.toFixed(0) +
            " ft.",
          involvedCallsigns: [a.callsign, b.callsign],
          recommendedAction: "Consider sequencing turn or speed adjustment.",
        });
      }
    }
  }
  return result;
}

function localToImagePixels(xLocal, yLocal) {
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

function getImageTransform() {
  const overlayRect = mapOverlayElement.getBoundingClientRect();
  const imageRect = airportImage.getBoundingClientRect();
  if (!imageRect.width || !imageRect.height) {
    return null;
  }
  const scaleX = imageRect.width / IMAGE_WIDTH;
  const scaleY = imageRect.height / IMAGE_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = imageRect.left - overlayRect.left;
  const offsetY = imageRect.top - overlayRect.top;
  return { scale, offsetX, offsetY };
}

function renderRunway(transform) {
  const start = RUNWAY10_PIXEL;
  const end = RUNWAY28_PIXEL;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const dx = (end.x - start.x) * transform.scale;
  const dy = (end.y - start.y) * transform.scale;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const centerX = transform.offsetX + midX * transform.scale;
  const centerY = transform.offsetY + midY * transform.scale;
  const runwayElement = document.createElement("div");
  runwayElement.className = "runway-highlight";
  runwayElement.style.width = length + "px";
  runwayElement.style.left = centerX + "px";
  runwayElement.style.top = centerY + "px";
  runwayElement.style.transform =
    "translate(-50%, -50%) rotate(" + angle + "deg)";
  mapOverlayElement.appendChild(runwayElement);
  const startPx = {
    x: transform.offsetX + start.x * transform.scale,
    y: transform.offsetY + start.y * transform.scale,
  };
  const endPx = {
    x: transform.offsetX + end.x * transform.scale,
    y: transform.offsetY + end.y * transform.scale,
  };
  const label10 = document.createElement("div");
  label10.className = "runway-end-label";
  label10.textContent = "10";
  label10.style.left = startPx.x + "px";
  label10.style.top = startPx.y + "px";
  mapOverlayElement.appendChild(label10);
  const label28 = document.createElement("div");
  label28.className = "runway-end-label";
  label28.textContent = "28";
  label28.style.left = endPx.x + "px";
  label28.style.top = endPx.y + "px";
  mapOverlayElement.appendChild(label28);
}

function renderRadarRings(transform) {
  const centerImage = RUNWAY_MIDPOINT;
  const centerX = transform.offsetX + centerImage.x * transform.scale;
  const centerY = transform.offsetY + centerImage.y * transform.scale;
  const radii = [0.5, 0.9, 1.3].map((v) => v * RUNWAY_LENGTH_PIXELS * transform.scale);
  radii.forEach((radius) => {
    const ring = document.createElement("div");
    ring.className = "radar-ring";
    ring.style.width = radius * 2 + "px";
    ring.style.height = radius * 2 + "px";
    ring.style.left = centerX - radius + "px";
    ring.style.top = centerY - radius + "px";
    mapOverlayElement.appendChild(ring);
  });
}

function renderPatternSide(transform, sideMultiplier, labelText) {
  const start = RUNWAY10_PIXEL;
  const end = RUNWAY28_PIXEL;
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
  const corners = [a, b, c, d];
  const segments = [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ];
  segments.forEach(function (pair) {
    const p1 = pair[0];
    const p2 = pair[1];
    const x1 = transform.offsetX + p1.x * transform.scale;
    const y1 = transform.offsetY + p1.y * transform.scale;
    const x2 = transform.offsetX + p2.x * transform.scale;
    const y2 = transform.offsetY + p2.y * transform.scale;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const edge = document.createElement("div");
    edge.className = "pattern-edge";
    edge.style.width = length + "px";
    edge.style.left = cx + "px";
    edge.style.top = cy + "px";
    edge.style.transform =
      "translate(-50%, -50%) rotate(" + angle + "deg)";
    mapOverlayElement.appendChild(edge);
  });
  const center = corners.reduce(
    function (acc, p) {
      return { x: acc.x + p.x / 4, y: acc.y + p.y / 4 };
    },
    { x: 0, y: 0 }
  );
  const labelX = transform.offsetX + center.x * transform.scale;
  const labelY =
    transform.offsetY + center.y * transform.scale - 14 * sideMultiplier;
  const label = document.createElement("div");
  label.className = "pattern-label";
  label.textContent = labelText;
  label.style.left = labelX + "px";
  label.style.top = labelY + "px";
  label.style.transform = "translate(-50%, -50%)";
  mapOverlayElement.appendChild(label);
}

function renderTrafficPattern(transform) {
  renderPatternSide(transform, 1, "RIGHT TRAFFIC");
  renderPatternSide(transform, -1, "LEFT TRAFFIC");
}

function renderPlanes() {
  while (mapOverlayElement.firstChild) {
    mapOverlayElement.removeChild(mapOverlayElement.firstChild);
  }
  const transform = getImageTransform();
  if (!transform) {
    return;
  }
  renderRadarRings(transform);
  renderTrafficPattern(transform);
  renderRunway(transform);
  state.planes.forEach((plane) => {
    const imagePos = localToImagePixels(plane.x, plane.y);
    const px = transform.offsetX + imagePos.x * transform.scale;
    const py = transform.offsetY + imagePos.y * transform.scale;
    const planeElement = document.createElement("div");
    const isCritical = state.anomalies.some((a) =>
      a.involvedCallsigns.includes(plane.callsign)
    );
    planeElement.className = "plane" + (isCritical ? " plane-critical" : "");
    planeElement.style.left = px + "px";
    planeElement.style.top = py + "px";
    const icon = document.createElement("div");
    icon.className = "plane-icon";
    icon.style.transform = "rotate(" + plane.heading + "deg)";
    const leader = document.createElement("div");
    leader.className = "plane-leader";
    const label = document.createElement("div");
    label.className = "plane-label";
    const line1 = document.createElement("div");
    line1.className = "plane-label-line1";
    line1.textContent = plane.callsign;
    const line2 = document.createElement("div");
    line2.className = "plane-label-line2";
    line2.textContent = plane.altitude.toFixed(0) + " ft";
    const badge = document.createElement("span");
    badge.className = "plane-badge";
    badge.textContent = plane.intention === "touch-and-go" ? "T&G" : "FULL";
    line1.appendChild(badge);
    label.appendChild(line1);
    label.appendChild(line2);
    planeElement.appendChild(icon);
    planeElement.appendChild(leader);
    planeElement.appendChild(label);
    planeElement.addEventListener("click", function () {
      if (state.selectedPlaneIds.has(plane.id)) {
        state.selectedPlaneIds.delete(plane.id);
      } else {
        state.selectedPlaneIds.add(plane.id);
      }
      updateSuggestedFromSelection();
      render();
    });
    mapOverlayElement.appendChild(planeElement);
  });
}

function renderTranscript() {
  while (transcriptListElement.firstChild) {
    transcriptListElement.removeChild(transcriptListElement.firstChild);
  }
  state.transcript.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "transcript-entry";
    const t = document.createElement("div");
    t.className = "transcript-timestamp";
    const time = new Date(entry.timestamp);
    t.textContent = formatTime(time);
    const o = document.createElement("div");
    o.className = "transcript-origin";
    o.textContent = entry.from;
    if (entry.from === "ATC") {
      o.classList.add("origin-atc");
    } else if (entry.from === "SKYGUARD") {
      o.classList.add("origin-skyguard");
    } else {
      o.classList.add("origin-pilot");
    }
    const c = document.createElement("div");
    c.className = "transcript-callsign";
    c.textContent = entry.callsign || "";
    const msg = document.createElement("div");
    msg.className = "transcript-message";
    msg.textContent = entry.message;
    row.appendChild(t);
    row.appendChild(o);
    row.appendChild(c);
    row.appendChild(msg);
    transcriptListElement.appendChild(row);
  });
  transcriptListElement.scrollTop = transcriptListElement.scrollHeight;
}

function renderAnomalies() {
  while (anomaliesListElement.firstChild) {
    anomaliesListElement.removeChild(anomaliesListElement.firstChild);
  }
  if (state.anomalies.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "No active anomalies.";
    empty.style.color = "#546a8e";
    empty.style.fontSize = "11px";
    anomaliesListElement.appendChild(empty);
    return;
  }
  state.anomalies.forEach((anomaly) => {
    const row = document.createElement("div");
    row.className = "anomaly-row";
    const header = document.createElement("div");
    header.className = "anomaly-header";
    const type = document.createElement("div");
    type.className = "anomaly-type";
    type.textContent = anomaly.type.replace(/-/g, " ");
    const sev = document.createElement("div");
    sev.className = "anomaly-severity";
    if (anomaly.severity === "info") {
      sev.classList.add("severity-info");
    } else if (anomaly.severity === "warning") {
      sev.classList.add("severity-warning");
    } else {
      sev.classList.add("severity-critical");
    }
    sev.textContent = anomaly.severity.toUpperCase();
    header.appendChild(type);
    header.appendChild(sev);
    const desc = document.createElement("div");
    desc.className = "anomaly-description";
    desc.textContent = anomaly.description;
    const callsigns = document.createElement("div");
    callsigns.className = "anomaly-callsigns";
    anomaly.involvedCallsigns.forEach((cs) => {
      const chip = document.createElement("span");
      chip.className = "callsign-chip";
      chip.textContent = cs;
      callsigns.appendChild(chip);
    });
    row.appendChild(header);
    row.appendChild(desc);
    row.appendChild(callsigns);
    row.addEventListener("click", function () {
      state.selectedPlaneIds = new Set();
      anomaly.involvedCallsigns.forEach((cs) => {
        const plane = state.planes.find((p) => p.callsign === cs);
        if (plane) {
          state.selectedPlaneIds.add(plane.id);
        }
      });
      updateSuggestedFromSelection();
      render();
    });
    anomaliesListElement.appendChild(row);
  });
}

function renderSuggested() {
  const s = state.suggestedMessage;
  if (!s) {
    suggestedMetaElement.textContent = "No active suggestion.";
    suggestedTextElement.textContent = "";
    broadcastButton.disabled = true;
    rejectButton.disabled = true;
    return;
  }
  const targets = s.targetCallsigns.join(", ");
  suggestedMetaElement.textContent =
    "[" +
    s.priority.toUpperCase() +
    "] " +
    (targets ? "To: " + targets : "Pattern-wide advisory");
  suggestedTextElement.textContent = s.message;
  broadcastButton.disabled = false;
  rejectButton.disabled = false;
}

function render() {
  renderPlanes();
  renderTranscript();
  renderAnomalies();
  renderSuggested();
}

function broadcastSuggested() {
  if (!state.suggestedMessage) {
    return;
  }
  const message = state.suggestedMessage;
  const entry = {
    id: "tx-" + Date.now(),
    timestamp: new Date().toISOString(),
    from: "SKYGUARD",
    callsign: message.targetCallsigns.length === 1 ? message.targetCallsigns[0] : "",
    message: message.message,
  };
  state.transcript.push(entry);
  state.suggestedMessage = chooseSuggestion(state.planes, state.anomalies);
  render();
}

function rejectSuggested() {
  if (!state.suggestedMessage) {
    return;
  }
  state.suggestedMessage = chooseSuggestion(state.planes, state.anomalies);
  render();
}

function updateSuggestedFromSelection() {
  if (state.selectedPlaneIds.size === 0) {
    state.suggestedMessage = chooseSuggestion(state.planes, state.anomalies);
    return;
  }
  const selected = state.planes.filter((p) => state.selectedPlaneIds.has(p.id));
  if (selected.length === 0) {
    state.suggestedMessage = chooseSuggestion(state.planes, state.anomalies);
    return;
  }
  const primary = selected[0];
  const direction = Math.random() > 0.5 ? "right" : "left";
  const pattern = direction === "right" ? "right traffic" : "left traffic";
  const message =
    primary.callsign +
    ", " +
    "continue " +
    pattern +
    " runway 28, " +
    "make " +
    direction +
    " three-sixty on downwind if advised.";
  state.suggestedMessage = {
    message,
    targetCallsigns: [primary.callsign],
    priority: "routine",
    createdAt: new Date().toISOString(),
  };
}

function updatePlanePositions() {
  const dtSeconds = 2.0;
  const maxRadiusActive = 1.4;
  const maxPlanes = 3;
  state.planes = state.planes.map((plane) => {
    const rad = (plane.heading * Math.PI) / 180;
    const speedNmPerSec = (plane.groundspeed / 3600) * 0.3;
    const nx = plane.x + Math.cos(rad) * speedNmPerSec * dtSeconds;
    const ny = plane.y + Math.sin(rad) * speedNmPerSec * dtSeconds;
    const jitter = (Math.random() - 0.5) * 0.01;
    const jitterAlt = (Math.random() - 0.5) * 10;
    let heading = plane.heading + (Math.random() - 0.5) * 1.2;
    if (heading < 0) heading += 360;
    if (heading >= 360) heading -= 360;
    return {
      ...plane,
      x: nx + jitter,
      y: ny + jitter,
      altitude: plane.altitude + jitterAlt,
      heading,
      lastUpdated: new Date().toISOString(),
    };
  });
  state.planes = state.planes.filter((plane) => {
    const r = Math.hypot(plane.x, plane.y);
    return r <= maxRadiusActive;
  });
  while (state.planes.length < maxPlanes) {
    state.planes.push(createRandomPlane());
  }
  state.anomalies = computeAnomalies(state.planes);
  if (!state.suggestedMessage) {
    state.suggestedMessage = chooseSuggestion(state.planes, state.anomalies);
  }
  render();
}

function init() {
  state.planes = createInitialPlanes();
  state.transcript = createInitialTranscript();
  state.anomalies = computeAnomalies(state.planes);
  state.suggestedMessage = chooseSuggestion(state.planes, state.anomalies);
  broadcastButton.addEventListener("click", broadcastSuggested);
  rejectButton.addEventListener("click", rejectSuggested);
  window.addEventListener("resize", render);
  if (airportImage.complete) {
    render();
  } else {
    airportImage.addEventListener("load", render);
  }
  updateUtcClock();
  setInterval(updateUtcClock, 1000);
  setInterval(updatePlanePositions, 2000);
}

init();

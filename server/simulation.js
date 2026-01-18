const crypto = require("crypto");

const BASE_LAT = 40.6413;
const BASE_LON = -73.7781;
const NM_TO_DEG_LAT = 1 / 60;
const NM_TO_DEG_LON = 1 / (60 * Math.cos((BASE_LAT * Math.PI) / 180));

function nmToLatLon(xNm, yNm) {
  const lat = BASE_LAT + yNm * NM_TO_DEG_LAT;
  const lon = BASE_LON + xNm * NM_TO_DEG_LON;
  return { lat, lon };
}

function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PLANE_MODELS = [
  { icaoType: "C172", patternSpeedKt: 90, cruiseSpeedKt: 110, patternAltitudeFt: 1500 },
  { icaoType: "B738", patternSpeedKt: 150, cruiseSpeedKt: 450, patternAltitudeFt: 2500 },
  { icaoType: "A320", patternSpeedKt: 150, cruiseSpeedKt: 440, patternAltitudeFt: 2500 },
  { icaoType: "E190", patternSpeedKt: 140, cruiseSpeedKt: 430, patternAltitudeFt: 2200 }
];

class Simulation {
  constructor(options = {}) {
    this.id = options.id || crypto.randomUUID();
    this.simTimeSec = 0;
    this.dt = options.dt || 1;
    this.patternRadiusNm = options.patternRadiusNm || 5;
    this.patternDirection = options.patternDirection || (Math.random() < 0.5 ? "cw" : "ccw");
    this.patternWidthNm = options.patternWidthNm || 8;
    this.patternHeightNm = options.patternHeightNm || 4;
    this.maxAircraft = options.numAircraft || 6;
    this._aircraftCounter = 0;
    this.randomness =
      typeof options.randomness === "number" && !Number.isNaN(options.randomness)
        ? options.randomness
        : 1;
    this.chaosLevel = options.chaosLevel || 5.0; // Default to medium chaos
    this.aircraft = [];
    this.anomalies = [];
    this.transcript = [];
    this.historyRows = [];
    this._transcriptCounter = 0;
    this._nextArrivalTimeSec = 20;
    this._initAircraft(this.maxAircraft);
  }

  _nextAircraftId() {
    this._aircraftCounter += 1;
    return `ac${this._aircraftCounter}`;
  }

  _initAircraft(numAircraft) {
    const callsigns = ["N123AB", "N456CD", "N789EF", "DAL123", "UAL789", "AAL456"];
    const direction = this.patternDirection;
    const widthNm = this.patternWidthNm;
    const heightNm = this.patternHeightNm;
    const perimeterNm = 2 * (widthNm + heightNm);
    for (let i = 0; i < numAircraft; i++) {
      const model = randomFromArray(PLANE_MODELS);
      const trackPosNm = perimeterNm > 0 ? (perimeterNm * i) / numAircraft : 0;
      const { xNm, yNm, headingDeg } = this._rectTrackPosition(
        trackPosNm,
        widthNm,
        heightNm,
        direction
      );
      const altitudeFt = model.patternAltitudeFt;
      const { lat, lon } = nmToLatLon(xNm, yNm);
      const callsign = callsigns[i % callsigns.length];
      const id = this._nextAircraftId();
      this.aircraft.push({
        id,
        callsign,
        icaoType: model.icaoType,
        lat,
        lon,
        altitudeFt,
        groundSpeedKt: model.patternSpeedKt,
        headingDeg,
        verticalSpeedFpm: 0,
        phase: "pattern",
        routeSegment: "pattern",
        assignedAltitudeFt: altitudeFt,
        assignedHeadingDeg: headingDeg,
        assignedSpeedKt: model.patternSpeedKt,
        lastInstructionId: undefined,
        clearanceStatus: "assigned",
        squawk: String(1000 + this._aircraftCounter),
        _xNm: xNm,
        _yNm: yNm,
        _angleRad: 0,
        _radiusNm: 0,
        _direction: direction,
        _mode: "pattern",
        _targetAngleRad: 0,
        _patternSpeedKt: model.patternSpeedKt,
        _trackPosNm: trackPosNm,
        _trackLengthNm: perimeterNm,
        _arrivalTargetXNm: 0,
        _arrivalTargetYNm: 0,
        _willTouchAndGo: Math.random() < 0.5,
        _hasRunwayEvent: false,
        _onRunwayLeg: false,
        _prevOnRunwayLeg: false
      });
    }
  }

  _rectTrackPosition(trackPosNm, widthNm, heightNm, direction) {
    const perimeterNm = 2 * (widthNm + heightNm);
    if (!perimeterNm || perimeterNm <= 0) {
      return { xNm: 0, yNm: 0, headingDeg: 0 };
    }
    const halfW = widthNm / 2;
    const halfH = heightNm / 2;
    let s = trackPosNm % perimeterNm;
    if (s < 0) {
      s += perimeterNm;
    }
    if (direction === "ccw") {
      s = perimeterNm - s;
    }
    if (s < widthNm) {
      const t = s;
      return { xNm: -halfW + t, yNm: -halfH, headingDeg: 90 };
    }
    if (s < widthNm + heightNm) {
      const t = s - widthNm;
      return { xNm: halfW, yNm: -halfH + t, headingDeg: 0 };
    }
    if (s < widthNm * 2 + heightNm) {
      const t = s - widthNm - heightNm;
      return { xNm: halfW - t, yNm: halfH, headingDeg: 270 };
    }
    const t = s - widthNm * 2 - heightNm;
    return { xNm: -halfW, yNm: halfH - t, headingDeg: 180 };
  }

  _addTranscript(role, text, callsign) {
    this._transcriptCounter += 1;
    this.transcript.push({
      id: `msg${this._transcriptCounter}`,
      atSimTimeSec: this.simTimeSec,
      role,
      callsign,
      text
    });
  }

  addExternalTranscript(callsign, text) {
    // Treat external logs (from voice agent) as system or pilot messages, or create a new role if needed.
    // For now, let's map them to 'system' if essentially logging, or infer role.
    // However, the agent logs "ATC instruction", so it's likely the TOWER speaking (or the agent acting as tower).
    this._addTranscript("tower", `[Voice Agent] ${text}`, callsign || "ALL");
  }

  addExternalAnomaly(anomaly) {
    // anomaly: { type, severity, description, aircraftIds }
    const id = `ext-${this.simTimeSec}-${crypto.randomUUID().slice(0, 8)}`;
    this.anomalies.push({
      id,
      simTimeSec: this.simTimeSec,
      ...anomaly
    });
  }

  _updateAircraftPositions() {
    for (const a of this.aircraft) {
      const speedKt = a._patternSpeedKt || a.groundSpeedKt;
      const speedNmPerSec = speedKt / 3600;
      const direction = a._direction || this.patternDirection;
      const perimeterNm = a._trackLengthNm || 2 * (this.patternWidthNm + this.patternHeightNm);
      if (a._mode === "arrival") {
        const targetX = a._arrivalTargetXNm;
        const targetY = a._arrivalTargetYNm;
        const dx = targetX - a._xNm;
        const dy = targetY - a._yNm;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const stepDist = speedNmPerSec * this.dt;
        if (dist > 0 && stepDist < dist) {
          const f = stepDist / dist;
          a._xNm += dx * f;
          a._yNm += dy * f;
        } else {
          a._xNm = targetX;
          a._yNm = targetY;
          a._mode = "pattern";
          a.phase = "pattern";
          a.routeSegment = "pattern";
        }
        const headingRad = Math.atan2(targetY - a._yNm, targetX - a._xNm);
        const headingDegArr = (((headingRad * 180) / Math.PI) % 360 + 360) % 360;
        const jitterArr = (Math.random() - 0.5) * 0.5 * this.randomness;
        const headingVal = headingDegArr + jitterArr;
        a.headingDeg = ((headingVal % 360) + 360) % 360;
        const posArrival = nmToLatLon(a._xNm, a._yNm);
        a.lat = posArrival.lat;
        a.lon = posArrival.lon;
      } else if (perimeterNm > 0 && a._mode === "pattern") {
        const delta = speedNmPerSec * this.dt;
        let nextTrackPos = (a._trackPosNm || 0) + delta;
        if (direction === "ccw") {
          // In CCW flow, we still move 'forward' along the perimeter distance in our logic,
          // but the POSITION lookup handles the CCW coordinate mapping.
          // If the previous code was subtracting delta, it might have been reversing the 's' parameter
          // incorrectly relative to how _rectTrackPosition calculates heading.
          // Let's stick to positive progression of 's' (distance traveled) and let the track function handle geometry.
          nextTrackPos = (a._trackPosNm || 0) + delta;
        }

        let wrapped = nextTrackPos % perimeterNm;
        if (wrapped < 0) {
          wrapped += perimeterNm;
        }
        a._trackPosNm = wrapped;

        // Calculate position
        const pos = this._rectTrackPosition(
          a._trackPosNm,
          this.patternWidthNm,
          this.patternHeightNm,
          direction
        );
        a._xNm = pos.xNm;
        a._yNm = pos.yNm;

        const jitter = (Math.random() - 0.5) * 0.5 * this.randomness;
        const heading = pos.headingDeg + jitter;
        a.headingDeg = ((heading % 360) + 360) % 360;
        const posLatLon = nmToLatLon(a._xNm, a._yNm);
        a.lat = posLatLon.lat;
        a.lon = posLatLon.lon;
      }
      const halfW = this.patternWidthNm / 2;
      const halfH = this.patternHeightNm / 2;
      const runwayY = -halfH;
      const onRunwayLeg =
        Math.abs(a._yNm - runwayY) < 0.1 && Math.abs(a._xNm) <= halfW + 0.001;
      const prevOnRunwayLeg = a._onRunwayLeg || false;
      a._prevOnRunwayLeg = prevOnRunwayLeg;
      a._onRunwayLeg = onRunwayLeg;
      if (
        a._mode === "pattern" &&
        onRunwayLeg &&
        !prevOnRunwayLeg &&
        !a._hasRunwayEvent
      ) {
        if (a._willTouchAndGo) {
          a._hasRunwayEvent = true;
          a.phase = "pattern";
          a.routeSegment = "pattern";
        } else {
          a._hasRunwayEvent = true;
          a._mode = "landed";
          a.phase = "ground";
          a.routeSegment = "runway";
          a.groundSpeedKt = 0;
          a.verticalSpeedFpm = 0;
        }
      }
      const altitudeProb = 0.01 * this.randomness;
      if (Math.random() < altitudeProb) {
        const delta = (Math.random() < 0.5 ? -1 : 1) * 500;
        a.altitudeFt += delta;
        a.verticalSpeedFpm = (delta / this.dt) * 60;
      } else {
        a.verticalSpeedFpm = 0;
      }

      // --- CHAOS LOGIC ---
      // If chaosLevel is high, occasionally force a dangerous deviation
      if (this.chaosLevel > 0 && Math.random() < (0.005 * this.chaosLevel)) {
        const deviationType = Math.random();
        if (deviationType < 0.33) {
          // 1. Altitude Deviation (Sudden drop/climb)
          const badAlt = Math.random() < 0.5 ? 800 : 3500;
          a.altitudeFt = badAlt; // Snap to bad altitude likely to trigger low/high warnings
          this.addExternalTranscript(a.callsign, `Simulated altitude deviation to ${badAlt}ft`);
        } else if (deviationType < 0.66) {
          // 2. Heading Deviation (Turn off course)
          const badTurn = (Math.random() < 0.5 ? -90 : 90);
          a.headingDeg = (a.headingDeg + badTurn + 360) % 360;
          this.addExternalTranscript(a.callsign, `Simulated heading deviation ${badTurn} deg`);
        } else {
          // 3. Stop mid-air (Speed deviation)
          a.groundSpeedKt = 40; // Stall speed
          this.addExternalTranscript(a.callsign, `Simulated speed drop to 40kt`);
        }
      }
    }
  }

  _removeLandedAircraft() {
    this.aircraft = this.aircraft.filter(a => a._mode !== "landed");
  }

  _scheduleNextArrival() {
    const baseInterval = 20;
    const jitter = 40 * Math.random();
    this._nextArrivalTimeSec = this.simTimeSec + baseInterval + jitter;
  }

  _spawnArrival() {
    const maxActive = (this.maxAircraft || 3) * 10;
    if (this.aircraft.length >= maxActive) {
      this._scheduleNextArrival();
      return;
    }
    const callsigns = ["N123AB", "N456CD", "N789EF", "DAL123", "UAL789", "AAL456"];
    const widthNm = this.patternWidthNm;
    const heightNm = this.patternHeightNm;
    const perimeterNm = 2 * (widthNm + heightNm);
    if (!perimeterNm) {
      this._scheduleNextArrival();
      return;
    }
    const model = randomFromArray(PLANE_MODELS);
    const joinTrackPosNm = Math.random() * perimeterNm;
    const joinPos = this._rectTrackPosition(
      joinTrackPosNm,
      widthNm,
      heightNm,
      this.patternDirection
    );
    const maxDim = Math.max(widthNm, heightNm) || 1;
    const radius = maxDim * 2 + 5;
    const angle = Math.random() * 2 * Math.PI;
    const xNm = Math.cos(angle) * radius;
    const yNm = Math.sin(angle) * radius;
    const dx = joinPos.xNm - xNm;
    const dy = joinPos.yNm - yNm;
    const headingRad = Math.atan2(dy, dx);
    const headingDeg = (((headingRad * 180) / Math.PI) % 360 + 360) % 360;
    const altitudeFt = model.patternAltitudeFt;
    const posLatLon = nmToLatLon(xNm, yNm);
    const callsign = randomFromArray(callsigns);
    const id = this._nextAircraftId();
    this.aircraft.push({
      id,
      callsign,
      icaoType: model.icaoType,
      lat: posLatLon.lat,
      lon: posLatLon.lon,
      altitudeFt,
      groundSpeedKt: model.patternSpeedKt,
      headingDeg,
      verticalSpeedFpm: 0,
      phase: "approach",
      routeSegment: "arrival",
      assignedAltitudeFt: altitudeFt,
      assignedHeadingDeg: headingDeg,
      assignedSpeedKt: model.patternSpeedKt,
      lastInstructionId: undefined,
      clearanceStatus: "assigned",
      squawk: String(1000 + this._aircraftCounter),
      _xNm: xNm,
      _yNm: yNm,
      _angleRad: 0,
      _radiusNm: 0,
      _direction: this.patternDirection,
      _mode: "arrival",
      _targetAngleRad: 0,
      _patternSpeedKt: model.patternSpeedKt,
      _trackPosNm: joinTrackPosNm,
      _trackLengthNm: perimeterNm,
      _arrivalTargetXNm: joinPos.xNm,
      _arrivalTargetYNm: joinPos.yNm,
      _willTouchAndGo: Math.random() < 0.5,
      _hasRunwayEvent: false,
      _onRunwayLeg: false,
      _prevOnRunwayLeg: false
    });
    this._scheduleNextArrival();
  }

  _distanceNm(a, b) {
    const dx = a._xNm - b._xNm;
    const dy = a._yNm - b._yNm;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _detectAnomalies() {
    const anomalies = [];
    for (let i = 0; i < this.aircraft.length; i++) {
      for (let j = i + 1; j < this.aircraft.length; j++) {
        const a = this.aircraft[i];
        const b = this.aircraft[j];
        const horizontal = this._distanceNm(a, b);
        const vertical = Math.abs(a.altitudeFt - b.altitudeFt);
        if (horizontal < 3 && vertical < 1000) {
          anomalies.push({
            id: `anom-${this.simTimeSec}-${a.id}-${b.id}`,
            type: "LOSS_OF_SEPARATION",
            severity: horizontal < 1.5 ? "critical" : "high",
            simTimeSec: this.simTimeSec,
            aircraftIds: [a.callsign, b.callsign],
            description: `Loss of separation between ${a.callsign} and ${b.callsign} (${horizontal.toFixed(
              1
            )} NM / ${vertical.toFixed(0)} ft)`
          });
        }
      }
    }
    return anomalies;
  }

  _generateSuggestedMessage(currentAnomalies) {
    if (!currentAnomalies.length) {
      if (this.simTimeSec % 15 === 0) {
        const a = randomFromArray(this.aircraft);
        return `${a.callsign}, report turning base.`;
      }
      return "";
    }
    const anom = currentAnomalies[0];
    const pair = anom.aircraftIds;
    if (pair.length >= 2) {
      return `${pair[0]}, traffic alert, maintain visual separation from ${pair[1]}, turn left heading 220.`;
    }
    return "Traffic alert, maintain separation.";
  }

  _updateTranscriptForAnomalies(currentAnomalies) {
    for (const anom of currentAnomalies) {
      if (anom.type === "LOSS_OF_SEPARATION") {
        const pair = anom.aircraftIds;
        if (pair.length >= 2) {
          this._addTranscript(
            "tower",
            `${pair[0]}, traffic alert, ${pair[1]} at your 2 o'clock, maintain separation.`,
            pair[0]
          );
          if (Math.random() < 0.6) {
            this._addTranscript(
              "pilot",
              "Traffic in sight, maintaining separation.",
              pair[0]
            );
          }
        }
      }
    }
  }

  _appendCsvRows(currentAnomalies) {
    for (const a of this.aircraft) {
      const anomaly = currentAnomalies.find(an => an.aircraftIds.includes(a.callsign));
      this.historyRows.push({
        sim_id: this.id,
        sim_time_sec: this.simTimeSec,
        aircraft_id: a.id,
        callsign: a.callsign,
        lat: a.lat,
        lon: a.lon,
        altitude_ft: a.altitudeFt,
        ground_speed_kt: a.groundSpeedKt,
        heading_deg: a.headingDeg,
        phase: a.phase,
        route_segment: a.routeSegment,
        anomaly_id: anomaly ? anomaly.id : "",
        anomaly_type: anomaly ? anomaly.type : "",
        anomaly_severity: anomaly ? anomaly.severity : "",
        anomaly_description: anomaly ? anomaly.description : ""
      });
    }
  }

  step() {
    this.simTimeSec += this.dt;
    this._updateAircraftPositions();
    this._removeLandedAircraft();
    if (
      typeof this._nextArrivalTimeSec === "number" &&
      this.simTimeSec >= this._nextArrivalTimeSec
    ) {
      this._spawnArrival();
    }
    const anomalies = this._detectAnomalies();
    this._updateTranscriptForAnomalies(anomalies);
    this._appendCsvRows(anomalies);
    const suggestedMessage = this._generateSuggestedMessage(anomalies);
    return {
      simId: this.id,
      simTimeSec: this.simTimeSec,
      aircraft: this.aircraft.map(a => ({
        id: a.id,
        callsign: a.callsign,
        icaoType: a.icaoType,
        lat: a.lat,
        lon: a.lon,
        altitudeFt: a.altitudeFt,
        groundSpeedKt: a.groundSpeedKt,
        headingDeg: a.headingDeg,
        verticalSpeedFpm: a.verticalSpeedFpm,
        phase: a.phase,
        routeSegment: a.routeSegment,
        assignedAltitudeFt: a.assignedAltitudeFt,
        assignedHeadingDeg: a.assignedHeadingDeg,
        assignedSpeedKt: a.assignedSpeedKt,
        lastInstructionId: a.lastInstructionId,
        clearanceStatus: a.clearanceStatus,
        squawk: a.squawk
      })),
      anomalies,
      transcript: this.transcript.slice(-30),
      suggestedMessage
    };
  }

  toCsv() {
    const header =
      "sim_id,sim_time_sec,aircraft_id,callsign,lat,lon,altitude_ft,ground_speed_kt,heading_deg,phase,route_segment,anomaly_id,anomaly_type,anomaly_severity,anomaly_description";
    const rows = this.historyRows.map(r =>
      [
        r.sim_id,
        r.sim_time_sec,
        r.aircraft_id,
        r.callsign,
        r.lat.toFixed(6),
        r.lon.toFixed(6),
        Math.round(r.altitude_ft),
        Math.round(r.ground_speed_kt),
        r.heading_deg.toFixed(1),
        r.phase,
        r.route_segment,
        r.anomaly_id,
        r.anomaly_type,
        r.anomaly_severity,
        `"${r.anomaly_description.replace(/"/g, '""')}"`
      ].join(",")
    );
    return [header, ...rows].join("\n");
  }
}

module.exports = {
  Simulation
};

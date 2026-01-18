# SkyGuard AI – Logic and Structure Overview

This document summarizes how the codebase is structured and how the core logic works across the server-side simulation and the client-side visualization/UI.

## High-Level Architecture

- **Server (`/server`)**
  - Node.js/HTTP server that:
    - Exposes a `/health` endpoint.
    - Serves a WebSocket endpoint at `/simulations/live` that streams simulation ticks in JSON.
    - Exposes `/simulations/:id/export` to download a CSV history of a run.
  - Contains the `Simulation` class that models aircraft, arrivals, the traffic pattern, runway behavior, anomalies, and suggested controller messages.

- **Client (`/client`)**
  - React + TypeScript single-page app (Vite).
  - Connects to the WebSocket stream.
  - Renders:
    - A 2D radar-style visualization of aircraft, the rectangular traffic pattern, and the runway.
    - Anomalies list.
    - Transcript of tower/pilot/system messages.
    - Suggested message panel with “Broadcast” / “Reject” actions.
  - Maintains a buffer of frames for external consumption (Wood Wide AI MCP) via a global on `window`.

The server is the source of truth for simulation state; the client is a real-time dashboard over that state.

---

## Server Side

### Simulation Coordinate System

File: `server/simulation.js`

- **Reference point**
  - `BASE_LAT` and `BASE_LON` define a fixed geographic origin (airport reference).
  - Nautical miles are converted to lat/lon using `NM_TO_DEG_LAT` and `NM_TO_DEG_LON`.

- **Helpers**
  - `nmToLatLon(xNm, yNm)`:
    - Converts coordinates in nautical miles (x east/west, y north/south) into latitude/longitude relative to the base.
  - `randomFromArray(arr)`:
    - Utility to pick a random element; used for aircraft models and callsigns.

- **Aircraft models**
  - `PLANE_MODELS` array defines common aircraft types with:
    - `icaoType`
    - `patternSpeedKt` (used in the traffic pattern)
    - `cruiseSpeedKt`
    - `patternAltitudeFt`

### Simulation Class

#### Core State

- `id`: Unique simulation ID (UUID).
- `simTimeSec`: Simulation time in seconds.
- `dt`: Time step increment (seconds per tick).
- `patternWidthNm` / `patternHeightNm`:
  - Dimensions of the rectangular traffic pattern, centered on the airport.
  - The **bottom edge** of this rectangle is treated as the **runway** (touch-and-go or full-stop landing leg).
- `patternDirection`:
  - `"cw"` or `"ccw"` for clockwise or counter-clockwise pattern flow.
- `maxAircraft`:
  - Baseline number used for initial pattern occupancy and rough cap for active aircraft.
- `randomness`:
  - Scalar used to scale various random behaviors (heading jitter, altitude changes, etc.).
- `aircraft`:
  - Array of live aircraft; each entry mixes public fields (sent to client) and internal fields used for the dynamics.
- `anomalies`:
  - Array of generated anomaly records (loss of separation).
- `transcript`:
  - Rolling list of transcript messages (tower/pilot/system).
- `historyRows`:
  - Accumulated state per tick, for CSV export.
- `_aircraftCounter`:
  - Used to generate unique aircraft IDs and squawk codes.
- `_transcriptCounter`:
  - For unique transcript message IDs.
- `_nextArrivalTimeSec`:
  - Simulation time at which the next arrival should spawn.

#### Private Fields on Each Aircraft

Beyond the public `AircraftState` fields (id, callsign, lat, lon, altitude, etc.), each aircraft instance also holds internal fields to drive the simulation:

- Position / pattern state:
  - `_xNm`, `_yNm`: Position in nautical miles relative to airport origin.
  - `_trackPosNm`: Scalar distance along the rectangle perimeter (for pattern mode).
  - `_trackLengthNm`: Total perimeter length of the pattern.
  - `_direction`: `"cw"` or `"ccw"` for pattern direction.
- Movement mode:
  - `_mode`: `"pattern"`, `"arrival"`, or `"landed"`.
    - `"pattern"`: Following the rectangular loop.
    - `"arrival"`: Flying straight from an outer spawn point to a pattern join point.
    - `"landed"`: Full-stop landing, to be removed from the sim.
- Arrival targeting:
  - `_arrivalTargetXNm`, `_arrivalTargetYNm`: Pattern coordinates of the join point for arrivals.
- Runway / landing behavior:
  - `_willTouchAndGo`: Random boolean chosen at creation time:
    - `true`: Aircraft does a touch-and-go and continues in the pattern.
    - `false`: Aircraft performs a full-stop landing and disappears afterward.
  - `_hasRunwayEvent`: Ensures the runway behavior triggers only once per aircraft.
  - `_onRunwayLeg` / `_prevOnRunwayLeg`: Track entry into the runway leg.
- Speed:
  - `_patternSpeedKt`: Baseline speed used in pattern and arrival motion.

#### Geometry: Rectangular Pattern

- `_rectTrackPosition(trackPosNm, widthNm, heightNm, direction)`
  - Takes a perimeter distance along the rectangle and returns:
    - `xNm`, `yNm`: Position on the rectangle in NM.
    - `headingDeg`: Nominal track heading at that segment.
  - The rectangle is centered on `(0, 0)` with:
    - `x` in `[-width/2, width/2]`
    - `y` in `[-height/2, height/2]`
  - Edges (in clockwise order):
    1. Bottom edge (runway): heading ~90° (eastbound).
    2. Right side: heading ~0° (northbound).
    3. Top edge: heading ~270° (westbound).
    4. Left side: heading ~180° (southbound).
  - `direction` flips how the perimeter is traversed for `"cw"` vs `"ccw"`.

#### Initialization: `_initAircraft(numAircraft)`

- Seeds the initial pattern occupancy:
  - Divides the rectangle perimeter evenly for `numAircraft`.
  - For each slot:
    - Picks a random `PLANE_MODELS` entry.
    - Computes `trackPosNm` along the perimeter.
    - Uses `_rectTrackPosition` to get initial `_xNm`, `_yNm`, `headingDeg`.
    - Converts to lat/lon.
    - Generates `id` via `_nextAircraftId()`.
    - Sets the public fields:
      - `phase = "pattern"`
      - `routeSegment = "pattern"`
      - `groundSpeedKt = patternSpeed`
      - `assigned*` fields equal to current values.
      - `clearanceStatus = "assigned"`.
    - Sets internal fields described above, including:
      - `_mode = "pattern"`
      - `_willTouchAndGo` random boolean.
      - Runway flags initialized to false.

#### Position Update: `_updateAircraftPositions()`

Runs once per tick for each aircraft:

1. **Arrival mode (`_mode === "arrival"`)**
   - Aircraft moves in a straight line toward its arrival target (`_arrivalTargetXNm`, `_arrivalTargetYNm`).
   - Movement:
     - Compute vector from current `_xNm/_yNm` to target.
     - Move along that vector by `speedNmPerSec * dt` (or snap to target if within that distance).
   - When it reaches the target:
     - Switches `_mode` to `"pattern"`.
     - Sets `phase = "pattern"`, `routeSegment = "pattern"`.
   - Heading:
     - Computed from the direction to the target with a small random jitter.
   - Lat/lon:
     - Updated using `nmToLatLon` from `_xNm/_yNm`.

2. **Pattern mode (`_mode === "pattern"`)**
   - Aircraft follows the perimeter of the rectangle:
     - `_trackPosNm` is advanced by `±speedNmPerSec * dt` depending on `patternDirection`.
     - Wrapped around using modulus with `perimeterNm`.
   - `_rectTrackPosition` converts `_trackPosNm` to `xNm`, `yNm`, `headingDeg`.
   - Heading:
     - Uses `headingDeg` plus a small random jitter.
   - Lat/lon:
     - Computed from `_xNm/_yNm` as above.

3. **Runway detection and landing decision**
   - The bottom edge is the runway:
     - `runwayY = -patternHeightNm / 2`.
     - Aircraft is considered “on the runway leg” if:
       - `|_yNm - runwayY| < small_threshold`
       - `|_xNm| <= patternWidthNm/2 + small_margin`.
   - `_onRunwayLeg` is updated every tick; a transition from `false` to `true` means the aircraft has just entered the runway leg.
   - If `_mode === "pattern"` and this is the first time on the runway leg (`!_hasRunwayEvent`):
     - If `_willTouchAndGo` is `true`:
       - Marks `_hasRunwayEvent = true`.
       - Leaves `_mode = "pattern"`.
       - Aircraft essentially performs a touch-and-go and keeps flying the pattern.
     - If `_willTouchAndGo` is `false`:
       - Marks `_hasRunwayEvent = true`.
       - Sets `_mode = "landed"`.
       - Sets `phase = "ground"`, `routeSegment = "runway"`.
       - Sets `groundSpeedKt = 0` and `verticalSpeedFpm = 0`.

4. **Altitude changes**
   - On each tick, there is a small random chance to adjust altitude by ±500 ft.
   - This updates `altitudeFt` and sets a corresponding `verticalSpeedFpm` for that tick; otherwise vertical speed is 0.

#### Landing Removal: `_removeLandedAircraft()`

- After positions are updated, this method filters out any aircraft with `_mode === "landed"`.
- This models full-stop landings as “land and disappear”.

#### Arrivals: `_scheduleNextArrival()` and `_spawnArrival()`

- `_scheduleNextArrival()`
  - Chooses the next arrival time as:
    - `simTimeSec + baseInterval + randomJitter`.
  - Used to spread arrivals out in time.

- `_spawnArrival()`
  - Enforces a soft cap on the number of active aircraft (based on `maxAircraft`).
  - If allowed:
    - Picks a random aircraft model.
    - Picks a random point along the rectangle perimeter as the join target (`joinTrackPosNm`).
    - Uses `_rectTrackPosition` to get the pattern join coordinates (`joinPos`).
    - Picks a random spawn position on a circle outside the pattern:
      - Radius is larger than the pattern dimensions, so arrivals start “from outside”.
    - Computes heading from spawn to join target.
    - Creates a new aircraft with:
      - `phase = "approach"`, `routeSegment = "arrival"`.
      - `_mode = "arrival"`.
      - `_arrivalTargetXNm/_arrivalTargetYNm` set to the join coordinates.
      - `_trackPosNm` set to the join perimeter distance (so once it reaches the target, it can continue along the pattern).
      - `_willTouchAndGo` randomly chosen.
    - Calls `_scheduleNextArrival()` to set the next arrival time.

#### Anomalies and Transcript

- `_distanceNm(a, b)`:
  - Computes Euclidean distance between two aircraft in NM using `_xNm/_yNm`.

- `_detectAnomalies()`
  - For each pair of aircraft:
    - Computes horizontal separation (NM) and vertical separation (ft).
    - If horizontal < 3 NM and vertical < 1000 ft:
      - Creates a `LOSS_OF_SEPARATION` anomaly.
      - Severity is `high` or `critical` based on distance.

- `_generateSuggestedMessage(currentAnomalies)`
  - If there are no anomalies:
    - Periodically (e.g., every 15 seconds of sim time) chooses a random aircraft and suggests a pattern-related instruction (e.g., “report turning base”).
  - If there are anomalies:
    - Uses the first anomaly’s involved aircraft to generate a traffic alert message (e.g., “maintain visual separation, turn left heading 220”).

- `_addTranscript(role, text, callsign)`
  - Appends a transcript entry with timestamp and role.

- `_updateTranscriptForAnomalies(currentAnomalies)`
  - For each LOSS_OF_SEPARATION anomaly:
    - Adds a tower call describing the traffic alert.
    - With some probability, adds a pilot response (“traffic in sight, maintaining separation.”).

- `_appendCsvRows(currentAnomalies)`
  - For each aircraft at the current tick:
    - Appends a row to `historyRows`, including any active anomaly data for that aircraft.

#### Public API

- `step()`
  - Increments `simTimeSec` by `dt`.
  - Updates aircraft positions and modes.
  - Removes landed aircraft.
  - Spawns arrivals when `simTimeSec >= _nextArrivalTimeSec`.
  - Detects anomalies.
  - Updates transcripts for anomalies.
  - Appends to CSV history.
  - Computes `suggestedMessage`.
  - Returns a `SimulationTick` object containing:
    - `simId`, `simTimeSec`
    - `aircraft`: public fields only
    - `anomalies`
    - `transcript` (last N entries)
    - `suggestedMessage`

- `toCsv()`
  - Serializes `historyRows` into CSV format for export.

### Server HTTP/WebSocket Wrapper

File: `server/index.js`

- Creates an HTTP server with:
  - `/health`:
    - Returns a JSON `{ status: "ok" }`.
  - `/simulations/:id/export`:
    - Looks up an existing `Simulation` and returns its `toCsv()` output.
  - Fallback 404 for unknown endpoints.

- WebSocket upgrade handler:
  - Accepts connections to `/simulations/live`.
  - Performs WebSocket handshake using the `Sec-WebSocket-Key`.
  - Creates a new `Simulation` instance:
    - Currently configured with a specific randomness and initial aircraft count.
  - Sets up a timer (e.g., every 1 second):
    - Calls `sim.step()`.
    - Encodes the returned tick as a WebSocket frame and writes it to the socket.
  - Cleans up when the socket closes or errors.

---

## Client Side

### Types

File: `client/src/types.ts`

- Mirrors server-side shape for data coming over the WebSocket:
  - `AircraftPhase`, `ClearanceStatus`
  - `AircraftState`
  - `AnomalyType`, `AnomalySeverity`, `Anomaly`
  - `TranscriptRole`, `TranscriptMessage`
  - `SimulationTick` (top-level object sent by server on each tick)
  - `BroadcastDecision`: local UI state for the suggested message panel.

- MCP-specific types:
  - `McpFrame`:
    - Captures a snapshot of:
      - `simId`, `simTimeSec`
      - `aircraft`, `anomalies`, `transcript`
      - `suggestedMessage`
      - `decisionState` (what the controller did with the suggestion)
  - `McpBuffer = McpFrame[]`:
    - Rolling buffer of `McpFrame` entries.

### WebSocket Hook

File: `client/src/hooks/useSimulationStream.ts`

- `useSimulationStream({ url })`
  - Creates a WebSocket to the given URL when the hook mounts.
  - Manages:
    - `tick`: latest `SimulationTick` parsed from the socket.
    - `connectionStatus`: `"connecting" | "open" | "closed" | "error"`.
    - `error`: optional string if parsing or socket errors occur.
  - `ws.onmessage`:
    - Parses `event.data` as JSON.
    - On success, updates `tick`.
    - On error, sets `status = "error"` and `error` message.
  - `ws.onopen` / `ws.onerror` / `ws.onclose`:
    - Update connection status and error state appropriately.
  - Clean-up:
    - Closes the WebSocket when the component unmounts or URL changes.

### Root App Component

File: `client/src/App.tsx`

- Connects to the simulation:
  - Calls `useSimulationStream` with `SIM_WS_URL`.
  - Derives:
    - `aircraft` array from `tick?.aircraft ?? []`.
    - `anomalies`, `transcript`, `suggestedMessage` similarly.

- Broadcast decision state:
  - `decisionState: BroadcastDecision` with values:
    - `"idle"`, `"pending"`, `"broadcasted"`, `"rejected"`.
  - `handleBroadcast()`:
    - If there is a suggested message:
      - Sets `decisionState = "pending"`.
      - After a short delay (simulated transmission), sets `decisionState = "broadcasted"`.
  - `handleReject()`:
    - If there is a suggested message:
      - Sets `decisionState = "rejected"`.

- MCP buffer:
  - `const mcpBufferRef = useRef<McpBuffer>([])`.
  - `useEffect` runs whenever `tick` or `decisionState` changes:
    - If `tick` exists:
      - Creates an `McpFrame` with:
        - Current `tick.simId`, `tick.simTimeSec`.
        - `tick.aircraft`, `tick.anomalies`, `tick.transcript`.
        - `tick.suggestedMessage`.
        - Current `decisionState`.
      - Appends to `mcpBufferRef.current` and trims to a max length (e.g., 300).
      - Exposes the buffer globally as:
        - `window.__WOOD_WIDE_MCP_BUFFER__ = mcpBufferRef.current`.
    - This provides Wood Wide AI MCP with a rolling log of all relevant state and decisions.

- Layout:
  - Header:
    - Shows app title and live/disconnected/error status badge based on connection state.
    - Displays sim time `t+...s`.
  - Main:
    - Left: `TranscriptPanel` showing textual transcript.
    - Center: `SkyMap2D` radar visualization with aircraft and pattern/runway.
    - Right:
      - `SuggestedMessagePanel` with the current suggested transmission and buttons.
      - `AnomaliesPanel` listing anomalies sorted by severity.

### Radar Visualization

File: `client/src/components/SkyMap2D.tsx` and `SkyMap2D.css`

- Viewport:
  - Fixed `VIEW_WIDTH` x `VIEW_HEIGHT` SVG.
  - Background gradient to emulate a radar scope.

- Coordinate mapping:
  - Uses the same `BASE_LAT`/`BASE_LON` and NM conversion as server to compute:
    - `latLonToNm(lat, lon)` → `xNm`, `yNm`.
  - Defines a fixed visual frame in NM:
    - `FRAME_HALF_WIDTH_NM`, `FRAME_HALF_HEIGHT_NM`.
    - Any aircraft whose NM coordinates are outside this frame is not rendered.
  - `nmToView(xNm, yNm, width, height)`:
    - Maps NM coordinates into SVG x/y.

- Pattern and runway drawing:
  - Uses the same `PATTERN_WIDTH_NM` / `PATTERN_HEIGHT_NM` as the server to draw:
    - A dashed rectangle representing the traffic pattern.
    - A thicker line along the bottom edge representing the runway.
  - This keeps the visual pattern aligned with the simulated geometry.

- Aircraft rendering:
  - `computeAircraftPositions`:
    - For each `AircraftState`, converts lat/lon to NM, then to view coordinates.
    - Filters out aircraft outside the frame.
  - Each aircraft is rendered as:
    - A circle:
      - Normal targets vs. “danger” targets (if involved in high/critical anomalies).
    - A heading tick mark showing the aircraft heading.
    - Two text labels:
      - Callsign.
      - Approximate altitude (hundreds of feet).

- Grid:
  - Concentric circles and crosshair lines for visual reference.

### Transcript and Anomalies UI

- `TranscriptPanel.tsx`
  - Displays transcript messages in reverse chronological order.
  - Shows time, callsign, and a short role label (`TWR`, `PILOT`, `SYS`).

- `AnomaliesPanel.tsx`
  - Sorts anomalies by severity and displays them in a list.
  - Shows type, time, description, and involved aircraft callsigns.

### Suggested Message Panel

File: `client/src/components/SuggestedMessagePanel.tsx`

- Shows the current suggested transmission text.
- Displays status text based on `decisionState`:
  - “Standing by”, “Transmitting…”, “Broadcasted”, or “Rejected”.
- Buttons:
  - “Broadcast” and “Reject”, wired to handlers passed from `App`.
- CSV export:
  - When `simId` is present, displays a link to:
    - `http://localhost:4000/simulations/{simId}/export`
  - This calls the server’s CSV endpoint to download the run.

---

## Plane Lifecycle Summary

Putting it all together, the life of a plane in this system:

1. **Spawn**
   - Either:
     - Part of the initial pattern occupancy (starts already in the loop), or
     - Spawned later as an arrival at a point outside the pattern.
   - Is assigned a model, speed, altitude, callsign, and landing behavior flag (`_willTouchAndGo`).

2. **Arrival (if applicable)**
   - Flies in a straight line from its spawn point toward a chosen join point on the rectangle.
   - When it reaches the join point, switches into pattern mode.

3. **Pattern**
   - Flies the rectangular traffic pattern, following the perimeter.
   - Occasionally has small heading/altitude fluctuations.
   - On each pass over the runway leg:
     - If `_willTouchAndGo` is `true`, performs a touch-and-go and continues.
     - If `_willTouchAndGo` is `false`, performs a full-stop landing.

4. **Landing**
   - Full-stop landings set `_mode = "landed"` and then the aircraft is removed entirely from the simulation.

5. **Anomalies and Messages**
   - Throughout, the system monitors aircraft pairs for loss-of-separation.
   - It generates:
     - Anomaly records.
     - Suggested controller messages.
     - Transcript entries for tower and pilot.

6. **Client Visualization and MCP Buffer**
   - Each tick is streamed to the client.
   - The client:
     - Renders the current situation.
     - Tracks your choices for suggested messages.
     - Records every frame in `window.__WOOD_WIDE_MCP_BUFFER__` for Wood Wide AI MCP to consume.


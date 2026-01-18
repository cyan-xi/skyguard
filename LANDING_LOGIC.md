# Touch-and-Go vs Landing Logic

## How It Works

The system is **already implemented** and active in the server simulation!

### Landing Requirements

For an aircraft to **land** (disappear from simulation), it must meet:

1. **Intent**: `_willTouchAndGo` must be `false` (assigned randomly at spawn - 50% chance)
2. Aircraft must cross the runway threshold

### Behavior

#### Touch-and-Go ✈️
- Aircraft with `_willTouchAndGo = true`
- Crosses runway and **continues in pattern**
- Loops around for another approach

#### Full Stop Landing 🛬
- Aircraft with `_willTouchAndGo = false`
- Crosses runway and **stops**
- `groundSpeedKt` → 0
- `_mode` → "landed"
- Aircraft **disappears** from simulation (removed by `_removeLandedAircraft()`)

## Current Implementation

The logic is in `simulation.js` lines 224-237:

```javascript
if (a._willTouchAndGo) {
  a._hasRunwayEvent = true;
  a.phase = "pattern";
  a.routeSegment = "pattern";
  // Continues loop
} else {
  a._hasRunwayEvent = true;
  a._mode = "landed";
  a.phase = "ground";
  a.routeSegment = "runway";
  a.groundSpeedKt = 0;
  a.verticalSpeedFpm = 0;
  // Will be removed on next tick
}
```

## How to See It

1. **Run simulation** - server is already running
2. **Wait** for aircraft to complete pattern approach
3. **Watch**:
   - Some aircraft will touch-and-go (continue pattern)
   - Some aircraft will land (disappear)
4. **New arrivals** spawn periodically to replace landed aircraft

## Statistics

- **50%** of aircraft do touch-and-go (keep flying)
- **50%** of aircraft land (disappear)
- This is assigned randomly when aircraft spawns
- Maintains dynamic traffic flow

## Already Active! ✅

This feature is **already working** in your simulation. Just watch the aircraft as they approach the runway - half will continue the pattern (touch-and-go) and half will land and disappear!

No additional changes needed - the system is live!

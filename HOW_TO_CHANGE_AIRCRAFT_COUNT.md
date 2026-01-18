# How to Change the Number of Aircraft

## Quick Answer

**File**: [`server/index.js`](file:///Users/jemoon/Documents/trae_projects/skyguard/server/index.js)  
**Line**: 159

```javascript
const sim = new Simulation({
  randomness: RANDOMNESS,
  numAircraft: 8  // ← CHANGE THIS NUMBER
});
```

## Options

- **Minimum**: 1 aircraft
- **Recommended**: 6-12 aircraft  
- **Maximum**: No hard limit, but performance may degrade with 20+

## Examples

```javascript
// Light traffic
numAircraft: 4

// Medium traffic (good for testing)
numAircraft: 8

// Heavy traffic (more conflicts)
numAircraft: 12

// Stress test
numAircraft: 20
```

## Effect on Brain System

- **More aircraft** = More conflicts = More brain suggestions
- **Fewer aircraft** = Fewer conflicts = Longer wait for suggestions
- Randomized speeds/altitudes ensure conflicts occur even with fewer aircraft

---

## What Just Changed

✅ **Aircraft now spawn at screen perimeter heading toward center**
- Aircraft appear around the edges in a circle
- All heading toward the center/airport
- Start in "approach" phase, not in the pattern
- Requires operator instructions to guide them onto the rectangular pattern

This gives you more control and makes the brain system more useful for providing guidance instructions!

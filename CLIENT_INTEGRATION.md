# SkyGuard Client - WebSocket Integration

## Changes Made

### Problem
The client was using a **local simulation engine** instead of connecting to the server's WebSocket, so brain suggestions from the server were not appearing.

### Solution
1. **Created WebSocket Hook**: [`useSimulationStream.ts`](file:///Users/jemoon/Documents/trae_projects/skyguard/client/src/hooks/useSimulationStream.ts)
   - Connects to `ws://localhost:4000/simulations/live`
   - Receives live simulation ticks from server
   - Handles connection status and errors

2. **Updated App.tsx**: Completely rewrote to use WebSocket
   - Removed local simulation engine imports
   - Uses `useSimulationStream` hook for data
   - Displays live aircraft with randomized speeds/altitudes from server
   - Shows brain suggestions and conflicts in real-time
   - Brain mode toggle controls server's brain system
   - Broadcast/Reject buttons send commands to server

### Features Now Working

✅ **Live Server Connection**
- Client connects to server's WebSocket
- Receives updates every second
- Shows connection status in header (ONLINE/CONNECTING/DISCONNECTED)

✅ **Randomized Aircraft**
- Aircraft with varied speeds (±20 kt)
- Aircraft with varied altitudes (±500 ft)
- Creates realistic conflict scenarios

✅ **Brain Suggestions**
- Brain detects conflicts on server
- Suggestions appear in "SkyGuard Brain Suggestions" panel
- Shows conflict severity and separation distances
- Manual mode: Click "Broadcast" or "Reject"
- Automatic mode: Instructions execute automatically

✅ **Active Conflicts Display**
- New panel shows real-time conflicts
- Color-coded by severity (critical/warning/advisory)
- Updates every tick with current separation distances

✅ **Brain Mode Toggle**
- Toggle in top-right header
- 🧠 AUTO-CONTROL mode: Brain controls aircraft automatically
- Manual Control mode: You approve each suggestion
- Sends mode change to server via API

### What You Should See

1. **On Load**: 
   - Status shows "CONNECTING..." then "SYSTEM ONLINE"
   - Active Aircraft panel shows 8 planes with varied speeds/altitudes

2. **Within 30-60 seconds**:
   - Conflicts panel appears (🚨 Active Conflicts)
   - Brain suggestions appear below
   - Example: "N123AB, reduce speed to 100 knots. Overtaking N456CD."

3. **Manual Mode** (default):
   - Suggestion appears with Broadcast/Reject buttons
   - Click Broadcast to execute instruction
   - Watch aircraft smoothly adjust speed/heading/altitude

4. **Automatic Mode**:
   - Check "🧠 AUTO-CONTROL" toggle
   - Brain automatically resolves conflicts
   - See instructions in transcript as they execute

### Connection Details

- **WebSocket**: `ws://localhost:4000/simulations/live`
- **API Endpoints**: `http://localhost:4000/simulations/:id/*`
- **Update Rate**: 1 tick per second

### If Issues

1. **No connection**: Make sure server is running (`node index.js` in server folder)
2. **No suggestions**: Wait 30-60 seconds for conflicts to develop
3. **Client not updating**: Refresh browser (dev server should auto-reload)

## Architecture

```
┌─────────────────┐         WebSocket         ┌─────────────────┐
│                 │◄────────────────────────────│                 │
│  React Client   │                             │  Node Server    │
│  (Browser)      │         HTTP API            │  (Port 4000)    │
│                 │────────────────────────────►│                 │
└─────────────────┘                             └─────────────────┘
                                                        │
                                                        │
                                                ┌───────▼────────┐
                                                │ Brain System   │
                                                │ - Conflicts    │
                                                │ - Instructions │
                                                └────────────────┘
```

✅ Client now fully integrated with server's brain system!

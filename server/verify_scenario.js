
// Using Node native WebSocket
// const WebSocket = require('ws');

// Simple script to test scenarios
const SCENARIO = "Collision Course";
const PORT = 4000;

console.log(`Connecting to ws://localhost:${PORT}/simulations/live?scenario=${encodeURIComponent(SCENARIO)}`);

// Node 22+ has global WebSocket
const ws = new WebSocket(`ws://localhost:${PORT}/simulations/live?scenario=${encodeURIComponent(SCENARIO)}`);

ws.onopen = () => {
    console.log('Connected!');
};

ws.onmessage = (event) => {
    try {
        const json = JSON.parse(event.data);
        if (json.aircraft && json.aircraft.length > 0) {
            console.log(`Received Frame. Aircraft Count: ${json.aircraft.length}`);
            const ac = json.aircraft[0];
            console.log(`First AC: ${ac.callsign} at ${ac.lat.toFixed(4)}, ${ac.lon.toFixed(4)} (x: ${ac.xNm?.toFixed(2)}, y: ${ac.yNm?.toFixed(2)})`);
            console.log('Scenario verification passed if aircraft match scenario spec.');
            ws.close();
            process.exit(0);
        }
    } catch (e) {
        console.error(e);
    }
};

ws.onerror = (e) => {
    console.error("Connection Error (Server likely down):", e);
    // process.exit(1); 
};

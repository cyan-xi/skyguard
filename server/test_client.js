// Native WebSocket in Node 24+
const ws = new WebSocket('ws://localhost:4000/simulations/live?scenario=Manual');

ws.onopen = () => {
    console.log('Connected to Simulation Server');
};

ws.onmessage = (event) => {
    const data = event.data;
    const state = JSON.parse(data);
    const p = state.aircraft[0];
    console.log(`[${state.simTimeSec.toFixed(1)}s] Callsign: ${p.callsign} Mode: ${p.phase} Pos: (${p.xNm.toFixed(2)}, ${p.yNm.toFixed(2)}) Hdg: ${p.headingDeg.toFixed(1)} Alt: ${p.altitudeFt.toFixed(0)}`);
};

ws.onclose = () => {
    console.log('Disconnected');
};

ws.onerror = (err) => {
    console.error('Error:', err.message);
};

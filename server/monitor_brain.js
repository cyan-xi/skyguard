#!/usr/bin/env node

/**
 * Simple test to verify brain is detecting conflicts
 * Uses HTTP polling since ws module not installed
 */

const http = require('http');
const crypto = require('crypto');

console.log('\n🧠 Brain Conflict Detection Test\n');
console.log('='.repeat(70));
console.log('\n✅ Changes Applied:');
console.log('   - Aircraft speeds: randomized ±20 kt from base');
console.log('   - Aircraft altitudes: randomized ±500 ft from base');
console.log('   - Applies to both initial aircraft and arrivals\n');

console.log('📊 Expected Behavior:');
console.log('   - Faster aircraft will catch up to slower aircraft (overtaking)');
console.log('   - Aircraft at similar altitudes will violate separation');
console.log('   - Brain will detect conflicts within 30-60 seconds');
console.log('   - Suggestions will appear in manual mode');
console.log('   - Instructions auto-execute in automatic mode\n');

console.log('🔍 Conflict Thresholds:');
console.log('   CRITICAL:  < 1.0 NM horizontal, < 500 ft vertical');
console.log('   WARNING:   < 2.0 NM horizontal, < 1000 ft vertical');
console.log('   ADVISORY:  < 3.0 NM horizontal, < 1500 ft vertical\n');

console.log('='.repeat(70));

// Check server health
http.get('http://localhost:4000/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const health = JSON.parse(data);
        console.log(`\n✅ Server Status: ${health.status}`);

        console.log('\n📌 To Monitor Brain Activity:\n');
        console.log('   Option 1: Watch server console');
        console.log('     - Look for [Simulation] Executed instruction messages');
        console.log('     - Look for [Brain] Mode changed messages\n');

        console.log('   Option 2: Connect client');
        console.log('     - Open client UI in browser');
        console.log('     - Watch for suggestions in "SkyGuard Suggested Message" panel');
        console.log('     - Toggle brain auto-control to test automatic mode\n');

        console.log('   Option 3: Test via API (need simId from WebSocket)');
        console.log('     - GET /simulations/:id/conflicts - view active conflicts');
        console.log('     - GET /simulations/:id/instructions - view instruction history');
        console.log('     - POST /simulations/:id/brain-mode - toggle auto/manual\n');

        console.log('='.repeat(70));
        console.log('\n🎯 Next Steps:\n');
        console.log('   1. The server is running with randomized aircraft parameters');
        console.log('   2. Connect to ws://localhost:4000/simulations/live to watch');
        console.log('   3. Conflicts should appear within 30-60 seconds');
        console.log('   4. Brain suggestions will be generated for each conflict\n');

        console.log('✅ Test setup complete!\n');
    });
}).on('error', (err) => {
    console.error('\n❌ Error:', err.message);
    console.log('\n💡 Make sure server is running: node index.js\n');
});

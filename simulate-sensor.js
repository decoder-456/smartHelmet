#!/usr/bin/env node
/**
 * Smart Helmet — ESP32 Sensor Simulator
 * ──────────────────────────────────────
 * Simulates real-time sensor data being pushed to Firebase Realtime Database,
 * exactly like the ESP32 hardware would. Uses the Firebase REST API directly
 * so no SDK is needed.
 *
 * Usage:
 *   node simulate-sensor.js <phone>            → push normal live data loop
 *   node simulate-sensor.js <phone> crash      → trigger a crash alert
 *   node simulate-sensor.js <phone> clear      → wipe the vehicle node
 *
 * Example:
 *   node simulate-sensor.js 6200071174
 *   node simulate-sensor.js 6200071174 crash
 */

const https = require('https');

// ── Firebase Config ────────────────────────────────────────────────────────
const FIREBASE_DB_URL = 'https://smarthelmet-961f1-default-rtdb.firebaseio.com';

// ── CLI Args ───────────────────────────────────────────────────────────────
const rawPhone = process.argv[2];
const mode     = process.argv[3] || 'live';

if (!rawPhone) {
  console.error('Usage: node simulate-sensor.js <phone_number> [live|crash|clear]');
  process.exit(1);
}

const phone = rawPhone.replace(/\D/g, '');
const path  = `/vehicles/${phone}.json`;

console.log(`\n🛠️  Smart Helmet Sensor Simulator`);
console.log(`📱 Phone key  : ${phone}`);
console.log(`📡 Firebase   : ${FIREBASE_DB_URL}${path}`);
console.log(`🎮 Mode       : ${mode}\n`);

// ── HTTP Helper ────────────────────────────────────────────────────────────
function firebasePatch(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url  = new URL(`${FIREBASE_DB_URL}${path}`);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PATCH',             // PATCH = merge/update fields
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
        } else {
          resolve(JSON.parse(raw));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function firebaseDelete() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FIREBASE_DB_URL}${path}`);
    const req = https.request(
      { hostname: url.hostname, path: url.pathname, method: 'DELETE' },
      (res) => { res.resume(); res.on('end', resolve); }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── GPS Route Simulation ───────────────────────────────────────────────────
// Simulates a vehicle moving through Patna, India
const ROUTE = [
  { lat: 25.5941, lng: 85.1376 },
  { lat: 25.5955, lng: 85.1390 },
  { lat: 25.5968, lng: 85.1412 },
  { lat: 25.5980, lng: 85.1435 },
  { lat: 25.5993, lng: 85.1458 },
  { lat: 25.6010, lng: 85.1478 },
  { lat: 25.6025, lng: 85.1495 },
  { lat: 25.6040, lng: 85.1510 },
  { lat: 25.6025, lng: 85.1495 },
  { lat: 25.6010, lng: 85.1478 },
  { lat: 25.5993, lng: 85.1458 },
  { lat: 25.5980, lng: 85.1435 },
  { lat: 25.5968, lng: 85.1412 },
  { lat: 25.5955, lng: 85.1390 },
];

let step = 0;

// ── Modes ──────────────────────────────────────────────────────────────────
async function runLive() {
  const statuses = ['IDLE', 'IDLE', 'DRIVING', 'DRIVING', 'DRIVING', 'DRIVING', 'LOCKED'];
  let statusIdx  = 2; // start at DRIVING

  console.log('🚗 Starting live data loop (Ctrl+C to stop)...\n');

  const tick = async () => {
    const { lat, lng } = ROUTE[step % ROUTE.length];
    const status       = statuses[statusIdx % statuses.length];
    const helmetOn     = Math.random() > 0.1; // 90% chance helmet is on

    const payload = {
      status,
      helmetOn,
      lat,
      lng,
      crashActive: false,
      timestamp: Date.now(),
      pendingCommand: null,
    };

    try {
      await firebasePatch(payload);
      console.log(
        `[${new Date().toLocaleTimeString()}] ` +
        `${status.padEnd(8)} | Helmet: ${helmetOn ? 'ON ' : 'OFF'} | ` +
        `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
    } catch (err) {
      console.error('❌ Write failed:', err.message);
    }

    step++;
    statusIdx++;
  };

  await tick();
  setInterval(tick, 2000); // push every 2 seconds (like real ESP32)
}

async function runCrash() {
  const { lat, lng } = ROUTE[3];
  console.log('🚨 Simulating CRASH event...');

  const payload = {
    status: 'CRASH',
    helmetOn: false,
    lat,
    lng,
    crashActive: true,
    timestamp: Date.now(),
    pendingCommand: null,
  };

  try {
    await firebasePatch(payload);
    console.log('✅ Crash data written to Firebase!');
    console.log(`   Path: vehicles/${phone}`);
    console.log(`   Location: ${lat}, ${lng}`);
    console.log('\n⏳ Both apps should now show the crash alert...');
    console.log('   Run with "live" mode to resume normal data.');
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

async function runClear() {
  console.log('🗑️  Clearing vehicle data...');
  try {
    await firebaseDelete();
    console.log(`✅ Cleared vehicles/${phone} from Firebase`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

// ── Entry ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    if (mode === 'crash')      await runCrash();
    else if (mode === 'clear') await runClear();
    else                       await runLive();
  } catch (err) {
    console.error('Fatal:', err.message);
    process.exit(1);
  }
})();

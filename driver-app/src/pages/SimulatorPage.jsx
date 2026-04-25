import React, { useContext, useState } from 'react';
import { ref, update, set } from 'firebase/database';
import { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import CrashOverlay from '../components/CrashOverlay';
import './SimulatorPage.css';

const phoneToKey = (phone) => String(phone || '').replace(/\D/g, '');

// Realistic GPS coordinates (Patna, India area for demo)
const GPS_PRESETS = [
  { label: '📍 Patna City Center', lat: 25.5941, lng: 85.1376 },
  { label: '📍 Gandhi Maidan', lat: 25.6093, lng: 85.1376 },
  { label: '📍 Patna Junction', lat: 25.6040, lng: 85.1113 },
  { label: '📍 Custom', lat: null, lng: null },
];

const SimulatorPage = () => {
  const { user } = useContext(AuthContext);
  const { crashAlert, acknowledgeCrash } = useContext(SocketContext);
  const [status, setStatus] = useState('IDLE');
  const [helmetOn, setHelmetOn] = useState(true);
  const [gpsPreset, setGpsPreset] = useState(0);
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const phone = phoneToKey(user?.phone);
  const vehiclePath = `vehicles/${phone}`;

  const getCoords = () => {
    const preset = GPS_PRESETS[gpsPreset];
    if (preset.lat !== null) return { lat: preset.lat, lng: preset.lng };
    return {
      lat: parseFloat(customLat) || 25.5941,
      lng: parseFloat(customLng) || 85.1376,
    };
  };

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  const pushToFirebase = async (payload) => {
    if (!phone) return showFeedback('❌ No phone number on your account');
    setLoading(true);
    try {
      await update(ref(db, vehiclePath), { ...payload, timestamp: Date.now() });
      showFeedback(`✅ Pushed to Firebase: vehicles/${phone}`);
    } catch (err) {
      showFeedback('❌ Firebase write failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendNormal = () => {
    const { lat, lng } = getCoords();
    pushToFirebase({ status, helmetOn, lat, lng, crashActive: false });
  };

  const sendCrash = () => {
    const { lat, lng } = getCoords();
    pushToFirebase({ status: 'CRASH', helmetOn, lat, lng, crashActive: true });
  };

  const sendHelmetOff = () => {
    const { lat, lng } = getCoords();
    pushToFirebase({ status: 'IDLE', helmetOn: false, lat, lng, crashActive: false });
  };

  const clearData = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      await set(ref(db, vehiclePath), null);
      showFeedback('🗑️ Cleared vehicle data from Firebase');
    } catch (err) {
      showFeedback('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sim-container">
      {crashAlert && (
        <CrashOverlay 
          alert={crashAlert} 
          onAcknowledge={acknowledgeCrash}
        />
      )}
      <header className="sim-header">
        <h1>🛠️ Firebase Sensor Simulator</h1>
        <p className="sim-path">Writing to: <code>vehicles/{phone || 'loading...'}</code></p>
      </header>

      {feedback && <div className="sim-feedback">{feedback}</div>}

      <div className="sim-grid">
        {/* Status Control */}
        <div className="sim-card">
          <h3>Vehicle Status</h3>
          <div className="sim-radio-group">
            {['IDLE', 'DRIVING', 'LOCKED'].map((s) => (
              <label key={s} className={`sim-radio ${status === s ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        {/* Helmet */}
        <div className="sim-card">
          <h3>Helmet Sensor</h3>
          <div className="sim-toggle-row">
            <span>Helmet Status:</span>
            <button
              className={`sim-toggle ${helmetOn ? 'on' : 'off'}`}
              onClick={() => setHelmetOn(!helmetOn)}
            >
              {helmetOn ? '✅ ON' : '❌ OFF'}
            </button>
          </div>
        </div>

        {/* GPS */}
        <div className="sim-card">
          <h3>GPS Location</h3>
          <div className="sim-radio-group">
            {GPS_PRESETS.map((p, i) => (
              <label key={i} className={`sim-radio ${gpsPreset === i ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="gps"
                  value={i}
                  checked={gpsPreset === i}
                  onChange={() => setGpsPreset(i)}
                />
                {p.label}
              </label>
            ))}
          </div>
          {gpsPreset === GPS_PRESETS.length - 1 && (
            <div className="sim-custom-gps">
              <input
                type="number"
                placeholder="Latitude"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                step="0.0001"
              />
              <input
                type="number"
                placeholder="Longitude"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                step="0.0001"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sim-card sim-actions-card">
          <h3>Send to Firebase</h3>
          <div className="sim-actions">
            <button
              className="sim-btn sim-btn-normal"
              onClick={sendNormal}
              disabled={loading}
            >
              📡 Send Normal Data
            </button>
            <button
              className="sim-btn sim-btn-crash"
              onClick={sendCrash}
              disabled={loading}
            >
              🚨 Simulate CRASH
            </button>
            <button
              className="sim-btn sim-btn-helmet"
              onClick={sendHelmetOff}
              disabled={loading}
            >
              🪖 Helmet OFF Alert
            </button>
            <button
              className="sim-btn sim-btn-clear"
              onClick={clearData}
              disabled={loading}
            >
              🗑️ Clear Firebase Data
            </button>
          </div>
        </div>
      </div>

      <div className="sim-info">
        <h3>📋 Firebase Data Structure</h3>
        <pre>{`vehicles/${phone || '<phone>'}/
  status:      "IDLE" | "DRIVING" | "CRASH" | "LOCKED"
  helmetOn:    true | false
  lat:         25.5941
  lng:         85.1376
  crashActive: false | true
  timestamp:   <unix ms>
  pendingCommand: "lock" | "unlock"  ← written by driver app`}</pre>
      </div>
    </div>
  );
};

export default SimulatorPage;

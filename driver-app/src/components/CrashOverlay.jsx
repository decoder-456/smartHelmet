import React, { useEffect, useState } from 'react';
import { useCrashAlarm } from '../hooks/useCrashAlarm';
import './CrashOverlay.css';

const CrashOverlay = ({ alert, onAcknowledge }) => {
  const [countdown, setCountdown] = useState(15);

  // ── Siren + Vibration ────────────────────────────────────────────
  useCrashAlarm(true);

  // ── Countdown before auto-calling emergency ───────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className="crash-overlay">
      <div className="crash-strobe" />

      <div className="crash-content">
        <div className="crash-icon">⚠️</div>
        <h1 className="crash-title">CRASH DETECTED</h1>
        <p className="crash-sub">Emergency services will be notified in</p>

        <div className={`crash-countdown ${countdown <= 5 ? 'urgent' : ''}`}>
          {countdown}s
        </div>

        {alert?.lat && alert?.lng && (
          <div className="crash-location">
            <span className="location-label">📍 Location</span>
            <span className="location-coords">
              {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
            </span>
          </div>
        )}

        <div className="crash-actions">
          <a
            href={alert?.mapsUrl || `https://www.google.com/maps?q=${alert?.lat},${alert?.lng}`}
            target="_blank"
            rel="noreferrer"
            className="crash-btn maps-btn"
          >
            🗺️ Open in Google Maps
          </a>

          <a href="tel:112" className="crash-btn emergency-btn">
            📞 Call Emergency (112)
          </a>

          <button onClick={onAcknowledge} className="crash-btn ok-btn">
            ✅ I'm OK — Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrashOverlay;

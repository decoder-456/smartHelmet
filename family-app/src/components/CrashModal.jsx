import React, { useEffect, useState } from 'react';
import { useCrashAlarm } from '../hooks/useCrashAlarm';
import './CrashModal.css';

const CrashModal = ({ crashAlert, onAcknowledge }) => {
  const [countdown, setCountdown] = useState(20);
  const [alarmMuted, setAlarmMuted] = useState(false);

  // ── Siren + Vibration (stops if muted locally) ───────────────────
  useCrashAlarm(!alarmMuted);

  // ── Countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className="crash-modal-overlay">
      <div className="crash-modal-strobe" />

      <div className="crash-modal">
        <div className="crash-modal-icon">🚨</div>
        <h1>CRASH ALERT!</h1>
        <p className="crash-modal-sub">Your driver may be in danger</p>

        <div className={`crash-modal-countdown ${countdown <= 5 ? 'urgent' : ''}`}>
          {countdown}s
        </div>
        <p className="crash-modal-countdown-label">until emergency alert</p>

        {crashAlert?.lat && crashAlert?.lng && (
          <div className="crash-modal-location">
            <span className="loc-label">📍 Last Known Location</span>
            <span className="loc-coords">
              {crashAlert.lat.toFixed(5)}, {crashAlert.lng.toFixed(5)}
            </span>
          </div>
        )}

        <div className="crash-modal-actions">
          <a
            href={crashAlert?.mapsUrl || `https://www.google.com/maps?q=${crashAlert?.lat},${crashAlert?.lng}`}
            target="_blank"
            rel="noreferrer"
            className="cmodal-btn maps-btn"
          >
            🗺️ Open GPS Location
          </a>
          <a href="tel:112" className="cmodal-btn emergency-btn">
            📞 Call Emergency (112)
          </a>
          {/* Family cannot acknowledge — only the driver can close this */}
          <button
            onClick={() => setAlarmMuted(true)}
            className="cmodal-btn mute-btn"
            disabled={alarmMuted}
          >
            {alarmMuted ? '🔇 Alarm Muted' : '🔇 Mute Alarm'}
          </button>
        </div>

        {/* Waiting indicator — closes automatically when driver says "I'm OK" */}
        <div className="crash-modal-waiting">
          <span className="waiting-dot" />
          <span className="waiting-dot" />
          <span className="waiting-dot" />
          <span className="waiting-text">Waiting for driver to respond…</span>
        </div>
      </div>
    </div>
  );
};

export default CrashModal;


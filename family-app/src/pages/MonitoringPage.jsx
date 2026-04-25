import React, { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import CrashModal from '../components/CrashModal';
import './Monitoring.css';

// Fix Leaflet default icon
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow });
L.Marker.prototype.options.icon = DefaultIcon;

// Helper: re-centers map when coords change
const MapUpdater = ({ lat, lng }) => {
  const map = useMap();
  if (lat && lng) map.setView([lat, lng], map.getZoom());
  return null;
};

// Status metadata (color, label, icon)
const STATUS_META = {
  IDLE:    { color: '#10b981', label: 'IDLE',    icon: '⏸️', pulse: false },
  DRIVING: { color: '#3b82f6', label: 'DRIVING', icon: '🏍️', pulse: true  },
  CRASH:   { color: '#ef4444', label: 'CRASH',   icon: '🚨', pulse: true  },
  LOCKED:  { color: '#f59e0b', label: 'LOCKED',  icon: '🔒', pulse: false },
};

const MonitoringPage = () => {
  const { user, logout } = useContext(AuthContext);
  const { vehicleState, crashAlert, acknowledgeCrash } = useContext(SocketContext);

  // ── Live event log ─────────────────────────────────────────────────
  const [eventLog, setEventLog] = useState([]);
  const prevStateRef = useRef(null);

  useEffect(() => {
    if (!vehicleState) return;
    const prev = prevStateRef.current;

    const events = [];
    const time = new Date().toLocaleTimeString();

    if (!prev) {
      events.push({ time, msg: `📡 Connected — Status: ${vehicleState.status}`, type: 'info' });
    } else {
      if (prev.status !== vehicleState.status) {
        const meta = STATUS_META[vehicleState.status];
        events.push({
          time,
          msg: `${meta?.icon || '🔄'} Status changed: ${prev.status} → ${vehicleState.status}`,
          type: vehicleState.status === 'CRASH' ? 'danger'
              : vehicleState.status === 'DRIVING' ? 'info'
              : 'normal',
        });
      }
      if (prev.helmetOn !== vehicleState.helmetOn) {
        events.push({
          time,
          msg: vehicleState.helmetOn
            ? '✅ Driver put helmet ON'
            : '⚠️ Driver removed helmet!',
          type: vehicleState.helmetOn ? 'normal' : 'warning',
        });
      }
    }

    if (events.length > 0) {
      setEventLog((log) => [...events, ...log].slice(0, 12)); // keep last 12
    }

    prevStateRef.current = vehicleState;
  }, [vehicleState]);

  const meta = STATUS_META[vehicleState?.status] || { color: '#6b7280', icon: '📡', pulse: false };
  const hasGPS = vehicleState?.lat && vehicleState?.lng;
  const helmetOff = vehicleState && !vehicleState.helmetOn;

  return (
    <div className="monitoring-container">
      {/* ── Crash Alert Modal ─────────────────────────────────────── */}
      {crashAlert && (
        <CrashModal
          crashAlert={crashAlert}
          onAcknowledge={acknowledgeCrash}
        />
      )}

      {/* ── Helmet-Off Warning Banner ─────────────────────────────── */}
      {helmetOff && !crashAlert && (
        <div className="helmet-warning-banner">
          <span className="helmet-warning-icon">🪖</span>
          <span>
            <strong>Helmet is OFF!</strong> — Driver is not wearing a helmet.
          </span>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="monitoring-header">
        <div className="header-info">
          <h2>👨‍👩‍👧 Family Dashboard</h2>
          <span className="user-email">{user?.email}</span>
        </div>
        <button onClick={logout} className="btn-logout">Logout</button>
      </header>

      {/* ── Grid ──────────────────────────────────────────────────── */}
      <div className="monitoring-grid">

        {/* Status Card */}
        <div className="card status-card">
          <h3>Driver Status</h3>
          <div
            className={`status-ring ${meta.pulse ? 'status-ring-pulse' : ''}`}
            style={{ borderColor: meta.color }}
          >
            <div className="status-icon">{meta.icon}</div>
            <span className="status-text" style={{ color: meta.color }}>
              {vehicleState?.status || 'WAITING'}
            </span>
          </div>

          {/* Helmet Badge */}
          <div className={`helmet-badge ${helmetOff ? 'helmet-badge-off' : ''}`}>
            <span className="helmet-badge-label">Helmet:</span>
            <span className={vehicleState?.helmetOn ? 'on' : 'off'}>
              {vehicleState ? (vehicleState.helmetOn ? '✅ ON' : '❌ OFF') : '—'}
            </span>
          </div>
        </div>

        {/* Info Card */}
        <div className="card info-card">
          <h3>Monitoring Info</h3>
          <p>Driver Phone: <strong>{user?.linkedPhone || 'Not set'}</strong></p>
          <p>
            Last Update:&nbsp;
            <strong>
              {vehicleState?.timestamp
                ? new Date(vehicleState.timestamp).toLocaleTimeString()
                : 'N/A'}
            </strong>
          </p>
          {hasGPS && (
            <>
              <p>Lat: <strong>{vehicleState.lat.toFixed(5)}</strong></p>
              <p>Lng: <strong>{vehicleState.lng.toFixed(5)}</strong></p>
            </>
          )}
          {hasGPS && (
            <a
              href={`https://www.google.com/maps?q=${vehicleState.lat},${vehicleState.lng}`}
              target="_blank"
              rel="noreferrer"
              className="btn-maps"
            >
              📍 Open in Google Maps
            </a>
          )}
        </div>

        {/* Live Map */}
        <div className="card map-card">
          <h3>Live Location</h3>
          {hasGPS ? (
            <div className="map-wrapper">
              <MapContainer
                center={[vehicleState.lat, vehicleState.lng]}
                zoom={15}
                style={{ height: '240px', width: '100%', borderRadius: '8px' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapUpdater lat={vehicleState.lat} lng={vehicleState.lng} />
                <Marker position={[vehicleState.lat, vehicleState.lng]}>
                  <Popup>
                    🏍️ Driver Location<br />
                    Status: {vehicleState.status}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            <div className="no-gps-map">
              <div className="gps-waiting-icon">📡</div>
              <p>Waiting for GPS signal...</p>
            </div>
          )}
        </div>

        {/* Live Event Log */}
        <div className="card event-log-card">
          <h3>📋 Live Event Log</h3>
          {eventLog.length === 0 ? (
            <p className="event-log-empty">Waiting for updates from driver...</p>
          ) : (
            <ul className="event-log-list">
              {eventLog.map((ev, i) => (
                <li key={i} className={`event-log-item event-${ev.type}`}>
                  <span className="event-time">{ev.time}</span>
                  <span className="event-msg">{ev.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
};

export default MonitoringPage;

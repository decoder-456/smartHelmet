import React, { useContext, useState } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';

// Strips non-numeric chars — mirrors the helper in SocketContext
const phoneToKey = (phone) => String(phone || '').replace(/\D/g, '');

const RideControls = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [rideActive, setRideActive] = useState(false);

  const vehiclePath = `vehicles/${phoneToKey(user?.phone)}`;

  const startRide = async () => {
    if (!user?.phone) return;
    setLoading(true);
    try {
      await update(ref(db, vehiclePath), {
        status: 'DRIVING',
        crashActive: false,
        timestamp: Date.now(),
      });
      setRideActive(true);
    } catch (err) {
      console.error('[RideControls] Failed to start ride:', err);
    } finally {
      setLoading(false);
    }
  };

  const endRide = async () => {
    if (!user?.phone) return;
    setLoading(true);
    try {
      await update(ref(db, vehiclePath), {
        status: 'IDLE',
        crashActive: false,
        timestamp: Date.now(),
      });
      setRideActive(false);
    } catch (err) {
      console.error('[RideControls] Failed to end ride:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ride-controls">
      <h3>Ride Management</h3>
      {rideActive ? (
        <button className="btn-end-ride" onClick={endRide} disabled={loading}>
          {loading ? 'Processing...' : 'End Ride'}
        </button>
      ) : (
        <button className="btn-start-ride" onClick={startRide} disabled={loading}>
          {loading ? 'Processing...' : 'Start Ride'}
        </button>
      )}
    </div>
  );
};

export default RideControls;

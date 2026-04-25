import React, { createContext, useState, useEffect, useContext } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext(null);

// Helper to strip non-numeric chars for Firebase path safety
const phoneToKey = (phone) => String(phone).replace(/\D/g, '');

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [vehicleState, setVehicleState] = useState(null);
  const [crashAlert, setCrashAlert] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Drivers monitor their OWN phone; family monitors the driver's linked phone
    const targetPhone = user.role === 'driver'
      ? phoneToKey(user.phone)
      : phoneToKey(user.linkedPhone);

    if (!targetPhone) {
      console.warn('[Firebase] No target phone found for user', user);
      return;
    }

    const vehicleRef = ref(db, `vehicles/${targetPhone}`);

    const unsubscribe = onValue(vehicleRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      setVehicleState({
        status: data.status,
        helmetOn: data.helmetOn,
        lat: data.lat,
        lng: data.lng,
        timestamp: data.timestamp,
      });

      // Trigger crash overlay when ESP32 sends CRASH + crashActive flag
      if (data.status === 'CRASH' && data.crashActive === true) {
        setCrashAlert({
          alertId: `${targetPhone}_${Date.now()}`,
          lat: data.lat,
          lng: data.lng,
          mapsUrl: `https://www.google.com/maps?q=${data.lat},${data.lng}`,
          timestamp: data.timestamp,
          vehiclePath: `vehicles/${targetPhone}`,
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Driver sends lock/unlock command to Firebase
  const sendVehicleCommand = (command) => {
    if (!user?.phone) return;
    const path = `vehicles/${phoneToKey(user.phone)}`;
    update(ref(db, path), { pendingCommand: command, crashActive: false });
  };

  // Acknowledge crash — clears the crash flag on Firebase
  const acknowledgeCrash = () => {
    if (crashAlert?.vehiclePath) {
      update(ref(db, crashAlert.vehiclePath), {
        crashActive: false,
        status: 'LOCKED',
      });
    }
    setCrashAlert(null);
  };

  return (
    <SocketContext.Provider value={{ vehicleState, crashAlert, setCrashAlert, sendVehicleCommand, acknowledgeCrash }}>
      {children}
    </SocketContext.Provider>
  );
};

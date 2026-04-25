import React, { createContext, useState, useEffect, useContext } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext(null);

const phoneToKey = (phone) => String(phone).replace(/\D/g, '');

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [vehicleState, setVehicleState] = useState(null);
  const [crashAlert, setCrashAlert] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Family members monitor the driver's linked phone
    const targetPhone = phoneToKey(user.linkedPhone);

    if (!targetPhone) {
      console.warn('[Firebase] No linkedPhone found for family user', user);
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

      if (data.status === 'CRASH' && data.crashActive === true) {
        // Driver has an active crash — show alert on family side
        setCrashAlert({
          alertId: `${targetPhone}_${Date.now()}`,
          lat: data.lat,
          lng: data.lng,
          mapsUrl: `https://www.google.com/maps?q=${data.lat},${data.lng}`,
          timestamp: data.timestamp,
          vehiclePath: `vehicles/${targetPhone}`,
        });
      } else if (data.crashActive === false) {
        // Driver acknowledged ("I'm OK") — auto-close family modal + stop siren
        setCrashAlert(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

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
    <SocketContext.Provider value={{ vehicleState, crashAlert, setCrashAlert, acknowledgeCrash }}>
      {children}
    </SocketContext.Provider>
  );
};

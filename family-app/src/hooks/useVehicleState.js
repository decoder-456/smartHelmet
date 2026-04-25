import { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import api from '../services/api';

export const useVehicleState = () => {
  const socket = useContext(SocketContext);
  const [vehicleState, setVehicleState] = useState(null);
  const [crashAlert, setCrashAlert] = useState(null);

  useEffect(() => {
    // Fetch initial state
    const fetchInitialState = async () => {
      try {
        const { data } = await api.get('/vehicle/state');
        setVehicleState(data);
      } catch (err) {
        console.error('Failed to fetch initial vehicle state', err);
      }
    };
    fetchInitialState();

    if (!socket) return;

    // Listen for real-time updates
    socket.on('vehicle:update', (data) => {
      setVehicleState(data);
    });

    socket.on('crash:alert', (alertData) => {
      setCrashAlert(alertData);
    });

    return () => {
      socket.off('vehicle:update');
      socket.off('crash:alert');
    };
  }, [socket]);

  return { vehicleState, crashAlert, setCrashAlert };
};

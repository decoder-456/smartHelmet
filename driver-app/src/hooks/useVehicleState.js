import { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';

export const useVehicleState = () => {
  const { vehicleState, crashAlert, setCrashAlert } = useContext(SocketContext);
  return { vehicleState, crashAlert, setCrashAlert };
};

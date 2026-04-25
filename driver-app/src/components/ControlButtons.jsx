import React, { useContext, useState } from 'react';
import { SocketContext } from '../context/SocketContext';

const ControlButtons = () => {
  const { sendVehicleCommand } = useContext(SocketContext);
  const [loading, setLoading] = useState(false);

  const sendCommand = (command) => {
    setLoading(true);
    sendVehicleCommand(command);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <div className="control-buttons">
      <button 
        className="btn-lock" 
        onClick={() => sendCommand('lock')}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Lock Engine'}
      </button>
      <button 
        className="btn-unlock" 
        onClick={() => sendCommand('unlock')}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Unlock Engine'}
      </button>
    </div>
  );
};

export default ControlButtons;

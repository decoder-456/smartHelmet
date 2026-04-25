import React from 'react';

const StatusRing = ({ status }) => {
  let color = '#10b981'; // IDLE - green
  if (status === 'DRIVING') color = '#3b82f6'; // blue
  if (status === 'CRASH') color = '#ef4444'; // red

  return (
    <div className="status-ring-container">
      <div className="status-ring" style={{ borderColor: color }}>
        <span className="status-text" style={{ color }}>{status || 'UNKNOWN'}</span>
      </div>
    </div>
  );
};

export default StatusRing;

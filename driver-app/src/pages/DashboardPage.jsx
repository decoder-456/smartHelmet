import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { useVehicleState } from '../hooks/useVehicleState';
import StatusRing from '../components/StatusRing';
import GPSDisplay from '../components/GPSDisplay';
import ControlButtons from '../components/ControlButtons';
import RideControls from '../components/RideControls';
import CrashOverlay from '../components/CrashOverlay';
import './Dashboard.css';

const DashboardPage = () => {
  const { user, logout } = useContext(AuthContext);
  const { acknowledgeCrash } = useContext(SocketContext);
  const { vehicleState, crashAlert } = useVehicleState();

  return (
    <div className="dashboard-container">
      {crashAlert && (
        <CrashOverlay 
          alert={crashAlert} 
          onAcknowledge={acknowledgeCrash}
        />
      )}
      
      <header className="dashboard-header">
        <div className="header-info">
          <h2>🏍️ Driver Dashboard</h2>
          <span className="user-email">{user?.email}</span>
        </div>
        <div className="header-actions">
          <Link to="/simulator" className="btn-simulator">🛠️ Simulator</Link>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="card status-card">
          <h3>Vehicle Status</h3>
          <StatusRing status={vehicleState?.status || 'IDLE'} />
        </div>
        
        <div className="card control-card">
          <h3>Engine Control</h3>
          <ControlButtons />
        </div>

        <div className="card ride-card">
          <RideControls />
        </div>
        
        <div className="card map-card">
          <h3>Live Location</h3>
          <GPSDisplay 
            lat={vehicleState?.lat} 
            lng={vehicleState?.lng} 
            helmetOn={vehicleState?.helmetOn} 
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

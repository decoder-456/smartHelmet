import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow
});
L.Marker.prototype.options.icon = DefaultIcon;

const GPSDisplay = ({ lat, lng, helmetOn }) => {
  const position = [lat || 0, lng || 0];
  const hasValidGPS = lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0;

  return (
    <div className="gps-container">
      <div className="helmet-status">
        Helmet: <span className={helmetOn ? 'helmet-on' : 'helmet-off'}>{helmetOn ? 'ON' : 'OFF'}</span>
      </div>
      <div className="map-wrapper">
        {hasValidGPS ? (
          <MapContainer center={position} zoom={15} style={{ height: '200px', width: '100%', borderRadius: '8px' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={position}>
              <Popup>Vehicle Location</Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="no-gps">Waiting for GPS signal...</div>
        )}
      </div>
    </div>
  );
};

export default GPSDisplay;

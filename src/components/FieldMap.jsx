import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

function getStatus(m) {
  return String(m.recommendationStatus || '').toLowerCase();
}

function isAbnormal(m) {
  return m.abnormalFlag === true || m.abnormalFlag === 1 || m.abnormalFlag === 'Yes' || m.abnormalFlag === 'true';
}

export default function FieldMap({ measurements }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // all, tappable, approaching, below, abnormal
  const [tileError, setTileError] = useState(false);

  // Filter measurements that have valid GPS coordinates
  const gpsMeasurements = useMemo(() => {
    return measurements.filter(m => m.latitude && m.longitude && !isNaN(m.latitude) && !isNaN(m.longitude));
  }, [measurements]);

  const filteredMeasurements = useMemo(() => {
    return gpsMeasurements.filter(m => {
      if (filter === 'all') return true;
      if (filter === 'abnormal') return isAbnormal(m);
      if (filter === 'tappable') return getStatus(m) === 'tappable';
      if (filter === 'approaching') return getStatus(m) === 'approaching';
      if (filter === 'below') return getStatus(m) === 'not_ready';
      return true;
    });
  }, [gpsMeasurements, filter]);

  // Calculate center of map
  const center = useMemo(() => {
    if (gpsMeasurements.length === 0) return [0, 0];
    const sumLat = gpsMeasurements.reduce((sum, m) => sum + parseFloat(m.latitude), 0);
    const sumLng = gpsMeasurements.reduce((sum, m) => sum + parseFloat(m.longitude), 0);
    return [sumLat / gpsMeasurements.length, sumLng / gpsMeasurements.length];
  }, [gpsMeasurements]);

  if (gpsMeasurements.length === 0) {
    return (
      <div className="glass-card field-insights-card mt-2">
        <button className="field-insights-toggle" onClick={() => setExpanded(!expanded)}>
          <span><MapPin size={16} /> Field GPS Map</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>0 GPS pts</span>
          </span>
        </button>
        {expanded && (
          <div className="field-insights-body" style={{ textAlign: 'center', padding: '1rem' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              No GPS-tagged measurements available for this field/session yet. Take measurements after location permission is enabled.
            </p>
          </div>
        )}
      </div>
    );
  }

  const getMarkerColor = (m) => {
    if (isAbnormal(m)) return '#9c27b0'; // purple
    if (getStatus(m) === 'tappable') return '#4caf50'; // green
    if (getStatus(m) === 'approaching') return '#ff9800'; // orange
    if (getStatus(m) === 'not_ready') return '#f44336'; // red
    return '#2196f3'; // default blue
  };

  return (
    <div className="glass-card field-insights-card mt-2">
      <button className="field-insights-toggle" onClick={() => setExpanded(!expanded)}>
        <span><MapPin size={16} /> Field GPS Map</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>{gpsMeasurements.length} pts</span>
        </span>
      </button>

      {expanded && (
        <div className="field-insights-body" style={{ padding: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>
              GPS locations are approximate and depend on device accuracy.
            </p>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="form-select"
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', width: 'auto', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            >
              <option value="all">All</option>
              <option value="tappable">Tappable</option>
              <option value="approaching">Approaching</option>
              <option value="below">Below threshold</option>
              <option value="abnormal">Abnormal only</option>
            </select>
          </div>

          {tileError && (
             <div style={{ backgroundColor: 'rgba(244, 67, 54, 0.1)', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#f44336' }}>
               Map tiles require internet connection. GPS data is still saved.
             </div>
          )}

          <div style={{ height: '300px', width: '100%', borderRadius: '8px', overflow: 'hidden', zIndex: 1, position: 'relative' }}>
            <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
                eventHandlers={{
                  tileerror: () => setTileError(true)
                }}
              />
              {filteredMeasurements.map((m) => (
                <CircleMarker
                  key={m.id}
                  center={[parseFloat(m.latitude), parseFloat(m.longitude)]}
                  radius={6}
                  pathOptions={{
                    fillColor: getMarkerColor(m),
                    color: getMarkerColor(m),
                    weight: 1,
                    fillOpacity: 0.8
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '0.9rem' }}>
                      <strong>Tree: {m.treeNo}</strong><br/>
                      Girth: {m.girth}&quot;<br/>
                      Date: {new Date(m.timestamp).toLocaleDateString()}<br/>
                      Status: {m.recommendationText || m.recommendationStatus || 'N/A'}<br/>
                      {isAbnormal(m) && <span style={{ color: '#9c27b0', fontWeight: 'bold' }}>⚠️ Abnormal Reading</span>}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}

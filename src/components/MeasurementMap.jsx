import { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Target } from 'lucide-react';

function getStatus(m) {
  return String(m.recommendationStatus || m.recommendationText || '').toLowerCase();
}

function isAbnormal(m) {
  return m.abnormalFlag === true || 
         m.abnormalFlag === 1 || 
         String(m.abnormalFlag).toLowerCase() === 'true' || 
         String(m.abnormalFlag).toLowerCase() === 'yes';
}

function getMarkerColor(m) {
  if (isAbnormal(m)) return '#9c27b0'; // purple
  
  const status = getStatus(m);
  // Order matters: 'approaching' before 'tappable' if status has both (unlikely but safe)
  if (status.includes('approaching')) return '#ff9800'; // orange
  if (status.includes('tappable')) return '#4caf50'; // green
  if (status.includes('not_ready') || status.includes('below') || status.includes('not ready')) return '#f44336'; // red
  
  return '#2196f3'; // default blue
}

function getMarkerClass(m) {
  if (isAbnormal(m)) return 'abnormal';
  const status = getStatus(m);
  if (status.includes('approaching')) return 'approaching';
  if (status.includes('tappable')) return 'tappable';
  if (status.includes('not_ready') || status.includes('below') || status.includes('not ready')) return 'below';
  return 'unknown';
}

const createDivIcon = (m) => {
  const colorClass = getMarkerClass(m);
  return L.divIcon({
    className: 'tree-marker-icon',
    html: `<span class="map-legend-dot ${colorClass}" style="display: block; width: 14px; height: 14px; border-radius: 50%; border: 1px solid white;"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7]
  });
};

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    try {
      const bounds = L.latLngBounds(
        points.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)])
      );

      if (bounds.isValid()) {
        if (points.length === 1) {
          map.setView([parseFloat(points[0].latitude), parseFloat(points[0].longitude)], 18);
        } else {
          map.fitBounds(bounds, {
            padding: [24, 24],
            maxZoom: 18
          });
        }
      }
    } catch (e) {
      console.warn('Error fitting bounds:', e);
    }
  }, [map, points]);

  return null;
}

function MapControls({ points }) {
  const map = useMap();

  const recenter = () => {
    if (!points || points.length === 0) return;
    try {
      const bounds = L.latLngBounds(
        points.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)])
      );

      if (bounds.isValid()) {
        if (points.length === 1) {
          map.setView([parseFloat(points[0].latitude), parseFloat(points[0].longitude)], 18);
        } else {
          map.fitBounds(bounds, {
            padding: [24, 24],
            maxZoom: 18
          });
        }
      }
    } catch (e) {
       console.warn('Error re-centering:', e);
    }
  };

  return (
    <button 
      type="button" 
      className="btn btn-secondary map-recenter-btn" 
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); recenter(); }}
      style={{
        position: 'absolute',
        zIndex: 1000,
        right: '12px',
        top: '12px',
        padding: '0.4rem 0.6rem',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        border: '1px solid var(--glass-border)',
        borderRadius: '6px',
        width: 'auto'
      }}
    >
      <Target size={14} /> Re-center
    </button>
  );
}

function MapLegend() {
  return (
    <div className="map-legend overlay">
      <div className="map-legend-item"><span className="map-legend-dot tappable"></span> Tappable</div>
      <div className="map-legend-item"><span className="map-legend-dot approaching"></span> Approaching</div>
      <div className="map-legend-item"><span className="map-legend-dot below"></span> Below threshold</div>
      <div className="map-legend-item"><span className="map-legend-dot abnormal"></span> Abnormal</div>
      <div className="map-legend-item"><span className="map-legend-dot unknown"></span> Unknown</div>
    </div>
  );
}

export default function MeasurementMap({ 
  measurements = [], 
  filter = 'all', 
  showAccuracy = false, 
  height = '300px',
  adminMode = false 
}) {
  const gpsMeasurements = useMemo(() => {
    return measurements.filter(m => 
      m.latitude && m.longitude && 
      !isNaN(parseFloat(m.latitude)) && 
      !isNaN(parseFloat(m.longitude))
    );
  }, [measurements]);

  const filteredMeasurements = useMemo(() => {
    return gpsMeasurements.filter(m => {
      if (filter === 'all') return true;
      if (filter === 'abnormal') return isAbnormal(m);
      
      const status = getStatus(m);
      if (filter === 'tappable') return status.includes('tappable') && !status.includes('approaching');
      if (filter === 'approaching') return status.includes('approaching');
      if (filter === 'below') return status.includes('not_ready') || status.includes('below') || status.includes('not ready');
      return true;
    });
  }, [gpsMeasurements, filter]);

  if (gpsMeasurements.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          No GPS-tagged measurements available.
        </p>
      </div>
    );
  }

  // Default center if somehow FitBounds fails or before it runs
  const defaultCenter = [
    parseFloat(filteredMeasurements[0]?.latitude || gpsMeasurements[0]?.latitude || 6.9271),
    parseFloat(filteredMeasurements[0]?.longitude || gpsMeasurements[0]?.longitude || 79.8612)
  ];

  return (
    <div style={{ height, width: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden', zIndex: 1 }}>
      <MapContainer 
        center={defaultCenter} 
        zoom={16} 
        style={{ height: '100%', width: '100%' }}
        preferCanvas={true}
      >
        <FitBounds points={filteredMeasurements} />
        <MapControls points={filteredMeasurements} />
        <MapLegend />
        
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {showAccuracy && filteredMeasurements.map((m, i) => {
          const acc = parseFloat(m.gpsAccuracy);
          if (isNaN(acc) || acc <= 0) return null;
          
          return (
            <Circle
              key={`acc-${m.id || m.treeNo || i}`}
              center={[parseFloat(m.latitude), parseFloat(m.longitude)]}
              radius={acc}
              pathOptions={{
                color: getMarkerColor(m),
                fillColor: getMarkerColor(m),
                weight: 1,
                opacity: 0.3,
                fillOpacity: 0.1
              }}
            />
          );
        })}

        <MarkerClusterGroup 
          chunkedLoading 
          maxClusterRadius={40}
        >
          {filteredMeasurements.map((m, i) => (
            <Marker
              key={m.id || `${m.treeNo}-${i}`}
              position={[parseFloat(m.latitude), parseFloat(m.longitude)]}
              icon={createDivIcon(m)}
            >
              <Popup>
                <div style={{ fontSize: '0.9rem', minWidth: '150px' }}>
                  <strong>Tree: {m.treeNo}</strong><br/>
                  Girth: {m.girth}&quot;<br/>
                  Date: {m.date || (m.timestamp ? new Date(m.timestamp).toLocaleDateString() : 'Unknown')}<br/>
                  Status: {m.recommendationText || m.recommendationStatus || 'N/A'}<br/>
                  
                  {isAbnormal(m) && (
                    <div style={{ color: '#9c27b0', fontWeight: 'bold', marginTop: '4px' }}>
                      ⚠️ {adminMode ? (m.abnormalReason || 'Abnormal Reading') : 'Abnormal Reading'}
                    </div>
                  )}
                  
                  <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    GPS Accuracy: {m.gpsAccuracy ? `${m.gpsAccuracy}m` : 'N/A'}
                    {parseFloat(m.gpsAccuracy) > 30 && <span style={{ color: '#ff9800', display: 'block' }}>Low GPS confidence</span>}
                  </div>
                  
                  {(adminMode && m.googleMapLink) && (
                    <div style={{ marginTop: '8px' }}>
                      <a href={m.googleMapLink} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                        Open in Google Maps
                      </a>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

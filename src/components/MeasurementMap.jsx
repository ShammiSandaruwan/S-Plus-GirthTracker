import { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Target, AlertTriangle } from 'lucide-react';
import { getCurrentLocation, onLocationUpdate, offLocationUpdate } from '../services/location';

const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `<div style="width: 14px; height: 14px; background-color: #2196f3; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

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

function MapResizeObserver() {
  const map = useMap();
  useEffect(() => {
    if (!map || !map._container) return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map._container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function MeasurementMap({ 
  measurements = [], 
  filter = 'all', 
  showAccuracy = false, 
  height = '300px',
  adminMode = false 
}) {
  const [validUserLocation, setValidUserLocation] = useState(null);

  useEffect(() => {
    // Get initial location
    const loc = getCurrentLocation();
    if (loc && loc.latitude && loc.longitude) {
      setValidUserLocation(loc);
    }
    
    const handleLocation = (newLoc) => {
      if (newLoc && newLoc.latitude && newLoc.longitude) {
        setValidUserLocation(newLoc);
      }
    };

    onLocationUpdate(handleLocation);
    return () => offLocationUpdate(handleLocation);
  }, []);

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
    <>
      <div className="map-count-note">
        <span>{filter === 'all'
          ? `Showing ${gpsMeasurements.length} GPS points`
          : `Showing ${filteredMeasurements.length} of ${gpsMeasurements.length} GPS points`}
        </span>
        <span>Cluster numbers show grouped nearby trees. Zoom in or tap a cluster to expand.</span>
      </div>
      <div style={{ height, width: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden', zIndex: 1 }}>
      <MapContainer 
        center={defaultCenter} 
        zoom={16} 
        style={{ height: '100%', width: '100%' }}
        preferCanvas={true}
      >
        <MapResizeObserver />
        <FitBounds points={filteredMeasurements} />
        <MapControls points={filteredMeasurements} />
        <MapLegend />
        
        <LayersControl position="topright">
          <LayersControl.BaseLayer 
            name="OpenStreetMap" 
            checked={(() => {
              try { return localStorage.getItem('girth_tracker_map_layer') !== 'satellite'; } 
              catch { return true; }
            })()}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
              maxNativeZoom={18}
              maxZoom={21}
              eventHandlers={{
                add: () => {
                  try { localStorage.setItem('girth_tracker_map_layer', 'osm'); } catch (err) {}
                }
              }}
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer 
            name="Satellite (Esri)" 
            checked={(() => {
              try { return localStorage.getItem('girth_tracker_map_layer') === 'satellite'; } 
              catch { return false; }
            })()}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='Imagery &copy; Esri &mdash; Source: Esri'
              maxNativeZoom={18}
              maxZoom={21}
              eventHandlers={{
                add: () => {
                  try { localStorage.setItem('girth_tracker_map_layer', 'satellite'); } catch (err) {}
                }
              }}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* User Location Marker */}
        {validUserLocation && (
          <>
            <Marker
              position={[validUserLocation.latitude, validUserLocation.longitude]}
              icon={createUserLocationIcon()}
              zIndexOffset={1000}
            >
              <Popup>
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>My Location</strong><br/>
                  Accuracy: ±{validUserLocation.accuracy ? `${validUserLocation.accuracy.toFixed(1)}m` : 'N/A'}
                </div>
              </Popup>
            </Marker>

            {validUserLocation.accuracy && validUserLocation.accuracy > 0 && (
              <Circle
                center={[validUserLocation.latitude, validUserLocation.longitude]}
                radius={validUserLocation.accuracy}
                pathOptions={{
                  color: '#2196f3',
                  fillColor: '#2196f3',
                  weight: 1,
                  opacity: 0.4,
                  fillOpacity: 0.15
                }}
              />
            )}
          </>
        )}

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
          {filteredMeasurements.map((m, i) => {
            const mLat = parseFloat(m.latitude);
            const mLng = parseFloat(m.longitude);
            
            let distToTree = null;
            if (validUserLocation) {
              try {
                distToTree = L.latLng(validUserLocation.latitude, validUserLocation.longitude)
                  .distanceTo(L.latLng(mLat, mLng));
              } catch (err) { }
            }

            return (
              <Marker
                key={m.id || `${m.treeNo}-${i}`}
                position={[mLat, mLng]}
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
                    
                    {distToTree !== null && (
                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', fontSize: '0.8rem' }}>
                        <div><strong>Distance:</strong> {distToTree < 1000 ? `${distToTree.toFixed(1)} m` : `${(distToTree / 1000).toFixed(2)} km`}</div>
                        {validUserLocation?.accuracy && validUserLocation.accuracy > distToTree && (
                          <div style={{ color: '#ff9800', fontSize: '0.75rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <AlertTriangle size={12} /> Low GPS confidence
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Tree GPS Acc: {m.gpsAccuracy ? `${m.gpsAccuracy}m` : 'N/A'}
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
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
      </div>
    </>
  );
}

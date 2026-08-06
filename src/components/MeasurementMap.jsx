import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvents, Circle, LayersControl, ScaleControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Target, Search, Navigation, AlertTriangle } from 'lucide-react';

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

const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'user-location-marker-icon',
    html: `<div class="user-location-marker-container"><span class="user-location-pulse-dot"></span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

function getGpsQuality(accuracy) {
  const acc = parseFloat(accuracy);
  if (isNaN(acc) || acc <= 0) return null;
  if (acc < 5) return { status: 'Excellent', color: '#4caf50', bg: 'rgba(76, 175, 80, 0.15)', text: '< 5m' };
  if (acc <= 10) return { status: 'Good', color: '#2196f3', bg: 'rgba(33, 150, 243, 0.15)', text: `±${acc.toFixed(0)}m` };
  if (acc <= 20) return { status: 'Fair', color: '#ff9800', bg: 'rgba(255, 152, 0, 0.15)', text: `±${acc.toFixed(0)}m` };
  return { status: 'Poor', color: '#f44336', bg: 'rgba(244, 67, 54, 0.15)', text: `>${acc.toFixed(0)}m` };
}

function ZoomLevelHandler({ onZoomChange }) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    }
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function AutoFollowHandler({ userLocation, autoFollow, onPauseAutoFollow }) {
  const map = useMap();

  useMapEvents({
    dragstart: () => {
      if (autoFollow) {
        onPauseAutoFollow();
      }
    }
  });

  useEffect(() => {
    if (!autoFollow || !userLocation) return;
    const lat = parseFloat(userLocation.latitude);
    const lng = parseFloat(userLocation.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      map.panTo([lat, lng], { animate: true });
    }
  }, [map, autoFollow, userLocation]);

  return null;
}

function MapResizeObserver({ containerRef }) {
  const map = useMap();

  useEffect(() => {
    if (!containerRef?.current) return;

    const observer = new ResizeObserver(() => {
      try {
        map.invalidateSize();
      } catch (e) {
        console.debug('ResizeObserver invalidateSize suppressed:', e);
      }
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [map, containerRef]);

  return null;
}

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

function MapControls({ points, userLocation, autoFollow, onToggleAutoFollow }) {
  const map = useMap();

  const recenter = () => {
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      const uLat = parseFloat(userLocation.latitude);
      const uLng = parseFloat(userLocation.longitude);
      if (!isNaN(uLat) && !isNaN(uLng)) {
        map.setView([uLat, uLng], 18);
        return;
      }
    }

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

  const hasUserCoords = Boolean(
    userLocation && 
    userLocation.latitude && 
    userLocation.longitude && 
    !isNaN(parseFloat(userLocation.latitude)) && 
    !isNaN(parseFloat(userLocation.longitude))
  );

  return (
    <div className="map-top-overlay-controls">
      {hasUserCoords && (
        <button
          type="button"
          className={`map-overlay-btn ${autoFollow ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleAutoFollow(); }}
          title={autoFollow ? "Auto-Follow Enabled (Click to pause)" : "Click to enable Auto-Follow user position"}
        >
          <Navigation size={14} className={autoFollow ? 'pulse' : ''} /> {autoFollow ? 'Following' : 'Follow Me'}
        </button>
      )}

      <button 
        type="button" 
        className="map-overlay-btn" 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); recenter(); }}
        title="Re-center map on points or user location"
      >
        <Target size={14} /> Re-center
      </button>
    </div>
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

function SearchControl({ measurements, clusterGroupRef, markerRefs }) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [searchMsg, setSearchMsg] = useState({ text: '', type: '' });

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const targetQuery = query.trim().toLowerCase();
    const target = measurements.find(m => String(m.treeNo).trim().toLowerCase() === targetQuery);

    if (target) {
      setSearchMsg({ text: `Found Tree #${target.treeNo}`, type: 'success' });
      setTimeout(() => setSearchMsg({ text: '', type: '' }), 3000);

      const targetLat = parseFloat(target.latitude);
      const targetLng = parseFloat(target.longitude);
      const markerKey = target.id || target.treeNo;
      const markerInstance = markerRefs.current[markerKey];

      if (clusterGroupRef.current && markerInstance && typeof clusterGroupRef.current.zoomToShowLayer === 'function') {
        clusterGroupRef.current.zoomToShowLayer(markerInstance, () => {
          markerInstance.openPopup();
        });
      } else {
        map.setView([targetLat, targetLng], 19);
        if (markerInstance) {
          setTimeout(() => markerInstance.openPopup(), 200);
        }
      }
    } else {
      setSearchMsg({ text: `Tree #${query} not found`, type: 'error' });
      setTimeout(() => setSearchMsg({ text: '', type: '' }), 3500);
    }
  };

  return (
    <form className="map-search-form" onSubmit={handleSearch}>
      <input 
        type="text" 
        className="map-search-input" 
        placeholder="Tree No..." 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" className="btn-icon" style={{ padding: '0.2rem', width: 'auto', height: 'auto' }} title="Search tree">
        <Search size={14} />
      </button>
      {searchMsg.text && (
        <span style={{ 
          fontSize: '0.75rem', 
          color: searchMsg.type === 'error' ? '#f44336' : '#4caf50', 
          fontWeight: 600,
          marginLeft: '0.3rem' 
        }}>
          {searchMsg.text}
        </span>
      )}
    </form>
  );
}

export default function MeasurementMap({ 
  measurements = [], 
  filter = 'all', 
  showAccuracy = false, 
  height = '300px',
  adminMode = false,
  userLocation = null
}) {
  const containerRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const markerRefs = useRef({});

  const [currentZoom, setCurrentZoom] = useState(16);
  const [autoFollow, setAutoFollow] = useState(false);

  const handleZoomChange = useCallback((zoom) => {
    setCurrentZoom(zoom);
  }, []);

  const handlePauseAutoFollow = useCallback(() => {
    setAutoFollow(false);
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

  const validUserLocation = useMemo(() => {
    if (!userLocation) return null;
    const lat = parseFloat(userLocation.latitude);
    const lng = parseFloat(userLocation.longitude);
    const acc = parseFloat(userLocation.accuracy);
    if (isNaN(lat) || isNaN(lng)) return null;
    return {
      latitude: lat,
      longitude: lng,
      accuracy: !isNaN(acc) ? acc : null
    };
  }, [userLocation]);

  const gpsQuality = useMemo(() => {
    return validUserLocation ? getGpsQuality(validUserLocation.accuracy) : null;
  }, [validUserLocation]);

  if (gpsMeasurements.length === 0 && !validUserLocation) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
          No GPS-tagged measurements available.
        </p>
      </div>
    );
  }

  const defaultCenter = [
    parseFloat(filteredMeasurements[0]?.latitude || gpsMeasurements[0]?.latitude || validUserLocation?.latitude || 6.9271),
    parseFloat(filteredMeasurements[0]?.longitude || gpsMeasurements[0]?.longitude || validUserLocation?.longitude || 79.8612)
  ];

  return (
    <>
      <div className="map-header-bar">
        <div className="map-count-note" style={{ margin: 0 }}>
          <span>{filter === 'all'
            ? `Showing ${gpsMeasurements.length} GPS points`
            : `Showing ${filteredMeasurements.length} of ${gpsMeasurements.length} GPS points`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {gpsQuality && (
            <span className="gps-quality-badge" style={{ background: gpsQuality.bg, color: gpsQuality.color }}>
              GPS: {gpsQuality.status} ({gpsQuality.text})
            </span>
          )}
        </div>
      </div>

      <div ref={containerRef} style={{ height, width: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden', zIndex: 1 }}>
        <MapContainer 
          center={defaultCenter} 
          zoom={16} 
          style={{ height: '100%', width: '100%' }}
          preferCanvas={true}
        >
          <MapResizeObserver containerRef={containerRef} />
          <ZoomLevelHandler onZoomChange={handleZoomChange} />
          <AutoFollowHandler userLocation={validUserLocation} autoFollow={autoFollow} onPauseAutoFollow={handlePauseAutoFollow} />
          <FitBounds points={filteredMeasurements} />
          <MapControls 
            points={filteredMeasurements} 
            userLocation={validUserLocation}
            autoFollow={autoFollow}
            onToggleAutoFollow={() => setAutoFollow(prev => !prev)}
          />
          <MapLegend />

          <div style={{ position: 'absolute', top: '12px', left: '50px', zIndex: 1000 }}>
            <SearchControl 
              measurements={filteredMeasurements} 
              clusterGroupRef={clusterGroupRef} 
              markerRefs={markerRefs} 
            />
          </div>

          <ScaleControl position="bottomleft" imperial={false} metric={true} />

          <LayersControl position="topright">
            <LayersControl.BaseLayer 
              name="OpenStreetMap" 
              checked={(() => {
                try { return (localStorage.getItem('girth_tracker_map_layer') || 'osm') === 'osm'; } 
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
                    try { localStorage.setItem('girth_tracker_map_layer', 'osm'); } catch (err) { console.debug('LocalStorage write failed:', err); }
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
                attribution='Imagery &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                maxNativeZoom={18}
                maxZoom={21}
                eventHandlers={{
                  add: () => {
                    try { localStorage.setItem('girth_tracker_map_layer', 'satellite'); } catch (err) { console.debug('LocalStorage write failed:', err); }
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

          {/* GPS Accuracy Circles for Trees */}
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

          {/* Clustered Tree Markers */}
          <MarkerClusterGroup 
            ref={clusterGroupRef}
            chunkedLoading 
            maxClusterRadius={40}
            disableClusteringAtZoom={18}
            spiderfyOnMaxZoom={true}
          >
            {filteredMeasurements.map((m, i) => {
              const mLat = parseFloat(m.latitude);
              const mLng = parseFloat(m.longitude);
              const markerKey = m.id || `${m.treeNo}-${i}`;

              let distToTree = null;
              if (validUserLocation) {
                try {
                  distToTree = L.latLng(validUserLocation.latitude, validUserLocation.longitude)
                    .distanceTo(L.latLng(mLat, mLng));
                } catch (err) {
                  console.debug('Distance calculation failed:', err);
                }
              }

              return (
                <Marker
                  key={markerKey}
                  ref={(el) => {
                    if (el) markerRefs.current[m.id || m.treeNo] = el;
                  }}
                  position={[mLat, mLng]}
                  icon={createDivIcon(m)}
                >
                  {currentZoom >= 18 && (
                    <Tooltip permanent direction="top" offset={[0, -8]}>
                      Tree #{m.treeNo}
                    </Tooltip>
                  )}

                  <Popup>
                    <div style={{ fontSize: '0.9rem', minWidth: '170px' }}>
                      <strong>Tree: {m.treeNo}</strong><br/>
                      Girth: {m.girth}&quot;<br/>
                      Date: {m.date || (m.timestamp ? new Date(m.timestamp).toLocaleDateString() : 'Unknown')}<br/>
                      Status: {m.recommendationText || m.recommendationStatus || 'N/A'}<br/>
                      
                      {isAbnormal(m) && (
                        <div style={{ color: '#9c27b0', fontWeight: 'bold', marginTop: '4px' }}>
                          ⚠️ {adminMode ? (m.abnormalReason || 'Abnormal Reading') : 'Abnormal Reading'}
                        </div>
                      )}

                      {/* Distance to Tree Calculation */}
                      {distToTree !== null && (
                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', fontSize: '0.8rem' }}>
                          <div><strong>Distance:</strong> {distToTree < 1000 ? `${distToTree.toFixed(1)} m` : `${(distToTree / 1000).toFixed(2)} km`}</div>
                          <div><strong>GPS Accuracy:</strong> ±{validUserLocation?.accuracy ? `${validUserLocation.accuracy.toFixed(1)} m` : 'N/A'}</div>
                          {validUserLocation?.accuracy && validUserLocation.accuracy > distToTree && (
                            <div style={{ color: '#ff9800', fontSize: '0.75rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <AlertTriangle size={12} /> Low GPS confidence
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Tree GPS Acc: {m.gpsAccuracy ? `${m.gpsAccuracy}m` : 'N/A'}
                        {parseFloat(m.gpsAccuracy) > 30 && <span style={{ color: '#ff9800', display: 'block' }}>Low marker GPS confidence</span>}
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

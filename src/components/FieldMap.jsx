import { useState, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import MeasurementMap from './MeasurementMap';

export default function FieldMap({ measurements, userLocation }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); 
  const [showAccuracy, setShowAccuracy] = useState(false);

  // Filter measurements that have valid GPS coordinates
  const gpsMeasurements = useMemo(() => {
    return measurements.filter(m => m.latitude && m.longitude && !isNaN(m.latitude) && !isNaN(m.longitude));
  }, [measurements]);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <input 
                type="checkbox" 
                checked={showAccuracy} 
                onChange={(e) => setShowAccuracy(e.target.checked)} 
              />
              Show GPS Accuracy
            </label>
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

          <MeasurementMap 
            measurements={gpsMeasurements} 
            filter={filter} 
            showAccuracy={showAccuracy} 
            userLocation={userLocation}
            height="350px" 
            adminMode={false} 
          />
        </div>
      )}
    </div>
  );
}

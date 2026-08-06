import { useMemo } from 'react';
import { BarChart3, X } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { calculateFieldInsights } from '../services/analytics';
import FieldMap from './FieldMap';

export default function FieldInsightsModal({ settings, isOpen, onClose }) {
  const measurements = useLiveQuery(
    () => {
      if (!settings?.estate || !settings?.fieldNo) return [];
      if (settings.sessionId) {
        return db.measurements
          .where('sessionId')
          .equals(settings.sessionId)
          .toArray();
      }
      return db.measurements
        .where('[estate+fieldNo]')
        .equals([settings.estate, settings.fieldNo])
        .toArray();
    },
    [settings?.estate, settings?.fieldNo, settings?.sessionId]
  );

  const insights = useMemo(() => {
    if (!measurements || measurements.length === 0) return null;
    return calculateFieldInsights(measurements);
  }, [measurements]);

  if (!isOpen) return null;

  return (
    <div className="session-report-overlay" style={{ zIndex: 1000, position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
      <div className="glass-card session-report-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="session-report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={20} /> Field Insights
            </h2>
            <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
              {settings.estate} | Field No: {settings.fieldNo}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close"><X size={20} /></button>
        </div>

        {!insights ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <p className="text-muted">More measurements needed for field insights.</p>
          </div>
        ) : (
          <div className="field-insights-body">
            <div className="insights-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              <div className="insights-stat" style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div className="insights-stat-value" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{insights.total}</div>
                <div className="insights-stat-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Measured</div>
              </div>
              <div className="insights-stat" style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div className="insights-stat-value" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{insights.avg}&quot;</div>
                <div className="insights-stat-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg Girth</div>
              </div>
              <div className="insights-stat" style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div className="insights-stat-value" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{insights.min}&quot;</div>
                <div className="insights-stat-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Min</div>
              </div>
              <div className="insights-stat" style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div className="insights-stat-value" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{insights.max}&quot;</div>
                <div className="insights-stat-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Max</div>
              </div>
            </div>

            <div className="insights-status-row" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span className="insights-chip healthy" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '12px', background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', border: '1px solid rgba(76, 175, 80, 0.2)' }}>🌿 {insights.healthyCount || 0} Healthy</span>
              {insights.runtCount > 0 && (
                <span className="insights-chip runt" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '12px', background: 'rgba(255, 193, 7, 0.15)', color: '#ffc107', border: '1px solid rgba(255, 193, 7, 0.3)' }}>📉 {insights.runtCount} Runt</span>
              )}
              {insights.deadCount > 0 && (
                <span className="insights-chip dead" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>☠️ {insights.deadCount} Dead</span>
              )}
              {insights.damagedCount > 0 && (
                <span className="insights-chip damaged" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.3)' }}>🩹 {insights.damagedCount} Damaged</span>
              )}
              <span className="insights-chip tappable" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '12px', background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', border: '1px solid rgba(76, 175, 80, 0.2)' }}>🌴 {insights.tappableCount} Tappable</span>
              <span className="insights-chip approaching" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '12px', background: 'rgba(255, 152, 0, 0.1)', color: '#ff9800', border: '1px solid rgba(255, 152, 0, 0.2)' }}>🔶 {insights.approachingCount} Approaching</span>
            </div>

            {insights.distribution && insights.distribution.length > 0 && (
              <div className="insights-chart" style={{ marginBottom: '1rem' }}>
                <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Distribution</div>
                {insights.distribution.map((bucket, i) => (
                  <div key={i} className="chart-bar-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span className="chart-bar-label" style={{ width: '40px', fontSize: '0.75rem', textAlign: 'right' }}>{bucket.label}</span>
                    <div className="chart-bar-track" style={{ flex: 1, height: '12px', background: 'var(--bg-secondary)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div
                        className="chart-bar-fill"
                        style={{ width: `${Math.max(bucket.pct, 2)}%`, height: '100%', background: 'var(--accent-primary)' }}
                      />
                    </div>
                    <span className="chart-bar-count" style={{ width: '24px', fontSize: '0.75rem' }}>{bucket.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <FieldMap 
          measurements={measurements || []} 
          userLocation={
            settings?.lastKnownLatitude && settings?.lastKnownLongitude ? {
              latitude: settings.lastKnownLatitude,
              longitude: settings.lastKnownLongitude,
              accuracy: settings.lastKnownGpsAccuracy
            } : null
          }
        />
      </div>
    </div>
  );
}

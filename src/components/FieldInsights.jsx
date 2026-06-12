import { useState, useMemo } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { calculateFieldInsights } from '../services/analytics';

/**
 * FieldInsights component — collapsible card showing session analytics.
 */
export default function FieldInsights({ settings }) {
  const [expanded, setExpanded] = useState(false);

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

  if (!insights) {
    return (
      <div className="glass-card field-insights-card">
        <button className="field-insights-toggle" onClick={() => setExpanded(!expanded)}>
          <span><BarChart3 size={16} /> Field Insights</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {expanded && (
          <p className="text-muted" style={{ textAlign: 'center', padding: '1rem 0', fontSize: '0.85rem' }}>
            More measurements needed for field insights.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card field-insights-card">
      <button className="field-insights-toggle" onClick={() => setExpanded(!expanded)}>
        <span><BarChart3 size={16} /> Field Insights</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>{insights.total} trees</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div className="field-insights-body">
          <div className="insights-stat-grid">
            <div className="insights-stat">
              <div className="insights-stat-value">{insights.total}</div>
              <div className="insights-stat-label">Measured</div>
            </div>
            <div className="insights-stat">
              <div className="insights-stat-value">{insights.avg}&quot;</div>
              <div className="insights-stat-label">Avg Girth</div>
            </div>
            <div className="insights-stat">
              <div className="insights-stat-value">{insights.min}&quot;</div>
              <div className="insights-stat-label">Min</div>
            </div>
            <div className="insights-stat">
              <div className="insights-stat-value">{insights.max}&quot;</div>
              <div className="insights-stat-label">Max</div>
            </div>
          </div>

          <div className="insights-status-row">
            <span className="insights-chip tappable">🌴 {insights.tappableCount} Tappable</span>
            <span className="insights-chip approaching">🔶 {insights.approachingCount} Approaching</span>
            {insights.abnormalCount > 0 && (
              <span className="insights-chip abnormal">⚠️ {insights.abnormalCount} Abnormal</span>
            )}
          </div>

          {insights.distribution && insights.distribution.length > 0 && (
            <div className="insights-chart">
              <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Distribution</div>
              {insights.distribution.map((bucket, i) => (
                <div key={i} className="chart-bar-row">
                  <span className="chart-bar-label">{bucket.label}</span>
                  <div className="chart-bar-track">
                    <div
                      className="chart-bar-fill"
                      style={{ width: `${Math.max(bucket.pct, 2)}%` }}
                    />
                  </div>
                  <span className="chart-bar-count">{bucket.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

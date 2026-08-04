import { useState, useEffect, useCallback } from 'react';
import { BarChart3, X, RefreshCw, AlertTriangle, Activity, Database, CheckCircle2 } from 'lucide-react';

export default function FieldDrilldown({ token, field, onClose, onAuthError }) {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    if (!field?.fieldId || !token) return;
    setLoading(true);
    setError('');
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'field_tree_report', { field_id: field.fieldId });
      setReportData(data);
    } catch (err) {
      if (err.message && err.message.includes('Invalid or expired')) {
        onAuthError(err.message);
      } else {
        setError("Couldn't load field details, try again");
      }
    } finally {
      setLoading(false);
    }
  }, [field, token, onAuthError]);

  useEffect(() => {
    let ignore = false;
    const fetchReport = async () => {
      if (!field?.fieldId || !token) return;
      setLoading(true);
      setError('');
      try {
        const { adminCRUD } = await import('../services/supabaseSync');
        const data = await adminCRUD(token, 'field_tree_report', { field_id: field.fieldId });
        if (!ignore) {
          setReportData(data);
        }
      } catch (err) {
        if (!ignore) {
          if (err.message && err.message.includes('Invalid or expired')) {
            onAuthError(err.message);
          } else {
            setError("Couldn't load field details, try again");
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    fetchReport();
    return () => {
      ignore = true;
    };
  }, [field, token, onAuthError]);

  if (!field) return null;

  const renderArrayLimit = (arr) => {
    if (!arr || arr.length === 0) return <span style={{ color: 'var(--text-muted)' }}>None</span>;
    const limit = 50;
    const displayed = arr.slice(0, limit);
    const extra = arr.length - limit;

    return (
      <span>
        {displayed.join(', ')}
        {extra > 0 && <strong style={{ marginLeft: '0.4rem', color: 'var(--accent-primary)' }}>+{extra} more</strong>}
      </span>
    );
  };

  const girthBands = [
    { label: '< 4"', key: 'lessThan4' },
    { label: '4" - 7.9"', key: 'band4to7_9' },
    { label: '8" - 9.9"', key: 'band8to9_9' },
    { label: '10" - 11.9"', key: 'band10to11_9' },
    { label: '12" - 13.9"', key: 'band12to13_9' },
    { label: '14" - 15.9"', key: 'band14to15_9' },
    { label: '16" - 17.9"', key: 'band16to17_9' },
    { label: '18" - 19.9"', key: 'band18to19_9' },
    { label: '20"+', key: 'over20' },
  ];

  return (
    <div
      className="glass-card field-drilldown-panel"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        width: 'min(420px, 100vw)',
        overflowY: 'auto',
        zIndex: 1000,
        padding: '1.5rem',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        borderRadius: 0,
        borderLeft: '1px solid var(--border-color)',
        background: 'var(--bg-card, rgba(20, 24, 33, 0.95))',
        backdropFilter: 'blur(12px)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={20} color="var(--accent-primary)" /> Field Detail Drilldown
          </h3>
          <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
            {field.estateName || '-'} / {field.divisionName || '-'} — <strong style={{ color: 'var(--text-color)' }}>{field.fieldCode}</strong>
          </div>
        </div>
        <button
          className="btn-icon"
          onClick={onClose}
          title="Close Panel"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-primary)', padding: '0.5rem 0' }}>
          <RefreshCw className="pulse" size={16} /> Loading field details...
        </div>
      )}

      {error ? (
        <div style={{ padding: '1rem', background: 'rgba(244, 67, 54, 0.1)', borderRadius: '8px', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
          <div style={{ color: '#f44336', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={16} /> {error}
          </div>
          <button
            className="btn btn-secondary"
            onClick={loadReport}
            style={{ width: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : reportData ? (
        <>
          {/* Section 1: Field Information */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={14} /> Field Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div>
                <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Estate</span>
                <strong>{field.estateName || '-'}</strong>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Division</span>
                <strong>{field.divisionName || '-'}</strong>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Field Code</span>
                <strong>{field.fieldCode || '-'}</strong>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Extent</span>
                <strong>{field.extentHa ? `${field.extentHa} Ha` : '-'}</strong>
              </div>
            </div>
          </div>

          {/* Section 2: Data Quality */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={14} /> Data Quality
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                  Missing Tree Numbers ({reportData.gapCount || 0}):
                </div>
                <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.2))', padding: '0.5rem', borderRadius: '6px', maxHeight: '90px', overflowY: 'auto', wordBreak: 'break-word' }}>
                  {renderArrayLimit(reportData.missingTreeNumbers)}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                  Duplicate Trees ({reportData.duplicateCount || 0}):
                </div>
                <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.2))', padding: '0.5rem', borderRadius: '6px', maxHeight: '90px', overflowY: 'auto', wordBreak: 'break-word' }}>
                  {renderArrayLimit(reportData.duplicateTrees)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Tree Health */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={14} /> Tree Health
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.2)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4caf50' }}>{reportData.healthStats?.healthy || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Healthy</div>
              </div>
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(255, 193, 7, 0.15)', border: '1px solid rgba(255, 193, 7, 0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffc107' }}>{reportData.healthStats?.runt || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Runt</div>
              </div>
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444' }}>{reportData.healthStats?.dead || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dead</div>
              </div>
              <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ec4899' }}>{reportData.healthStats?.damaged || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Damaged</div>
              </div>
            </div>
          </div>

          {/* Section 4: Girth Distribution */}
          <div>
            <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart3 size={14} /> Girth Distribution (Inches)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {girthBands.map(b => {
                const count = reportData.girthDist?.[b.key] || 0;
                return (
                  <div key={b.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '0.2rem 0.4rem', borderRadius: '4px', background: 'var(--bg-secondary, rgba(0,0,0,0.15))' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{b.label}</span>
                    <strong style={{ fontWeight: 600 }}>{count}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

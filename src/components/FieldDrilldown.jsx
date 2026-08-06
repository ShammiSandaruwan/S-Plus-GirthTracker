import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, X, RefreshCw, AlertTriangle, Activity, Database, CheckCircle2 } from 'lucide-react';

export default function FieldDrilldown({ token, field, measurements, onClose, onAuthError }) {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedCondition, setSelectedCondition] = useState(null);

  const matchingMeasurements = useMemo(() => {
    if (!field || !measurements || measurements.length === 0) return [];
    const fCode = (field.fieldCode || '').toLowerCase().trim();
    const eName = (field.estateName || '').toLowerCase().trim();
    const dName = (field.divisionName || '').toLowerCase().trim();

    return measurements.filter(m => {
      const mField = (m.fieldNo || '').toLowerCase().trim();
      const mEstate = (m.estate || '').toLowerCase().trim();
      const mDiv = (m.division || '').toLowerCase().trim();
      const fMatch = !fCode || mField === fCode;
      const eMatch = !eName || mEstate === eName || eName.includes(mEstate) || mEstate.includes(eName);
      const dMatch = !dName || mDiv === dName || dName.includes(mDiv) || mDiv.includes(dName);
      return fMatch && eMatch && dMatch;
    });
  }, [field, measurements]);

  const clientFallback = useMemo(() => {
    if (matchingMeasurements.length === 0) return null;

    const rows = [...matchingMeasurements].sort((a, b) => (a.treeNo ?? 0) - (b.treeNo ?? 0));
    const treeCounts = {};
    rows.forEach(r => {
      if (r.treeNo != null) treeCounts[r.treeNo] = (treeCounts[r.treeNo] || 0) + 1;
    });

    const uniqueTreeNumbers = Object.keys(treeCounts).map(Number).sort((a, b) => a - b);
    const duplicates = Object.keys(treeCounts).filter(k => treeCounts[Number(k)] > 1).map(Number);

    const missing = [];
    if (uniqueTreeNumbers.length > 0) {
      const min = uniqueTreeNumbers[0];
      const max = uniqueTreeNumbers[uniqueTreeNumbers.length - 1];
      const present = new Set(uniqueTreeNumbers);
      for (let n = min; n <= max; n++) {
        if (!present.has(n)) missing.push(n);
      }
    }

    const healthStats = { healthy: 0, runt: 0, dead: 0, damaged: 0 };
    rows.forEach(r => {
      const cond = (r.treeCondition || 'healthy').toLowerCase();
      if (cond === 'runt') healthStats.runt++;
      else if (cond === 'dead') healthStats.dead++;
      else if (cond === 'damaged' || cond === 'animal_attack') healthStats.damaged++;
      else healthStats.healthy++;
    });

    const girthDist = {
      lessThan4: 0, band4to7_9: 0, band8to9_9: 0, band10to11_9: 0,
      band12to13_9: 0, band14to15_9: 0, band16to17_9: 0, band18to19_9: 0, over20: 0
    };
    rows.forEach(r => {
      const g = parseFloat(r.girth);
      if (isNaN(g)) return;
      if (g < 4) girthDist.lessThan4++;
      else if (g < 8) girthDist.band4to7_9++;
      else if (g < 10) girthDist.band8to9_9++;
      else if (g < 12) girthDist.band10to11_9++;
      else if (g < 14) girthDist.band12to13_9++;
      else if (g < 16) girthDist.band14to15_9++;
      else if (g < 18) girthDist.band16to17_9++;
      else if (g < 20) girthDist.band18to19_9++;
      else girthDist.over20++;
    });

    return {
      missingTreeNumbers: missing,
      gapCount: missing.length,
      duplicateTrees: duplicates,
      duplicateCount: duplicates.length,
      healthStats,
      girthDist,
      treeRows: matchingMeasurements,
      totalRecords: matchingMeasurements.length
    };
  }, [matchingMeasurements]);

  useEffect(() => {
    let ignore = false;
    const fetchReport = async () => {
      if (!field || !token) return;
      setLoading(true);
      setError('');
      try {
        const { adminCRUD } = await import('../services/supabaseSync');
        const data = await adminCRUD(token, 'field_tree_report', {
          field_id: field.id || field.fieldId,
          estate: field.estateName,
          division: field.divisionName,
          fieldNo: field.fieldCode
        });
        if (!ignore) {
          setReportData(data);
        }
      } catch (err) {
        if (!ignore) {
          if (err.message && err.message.includes('Invalid or expired')) {
            onAuthError(err.message);
          } else if (!clientFallback) {
            setError("Couldn't load field details from server.");
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    
    fetchReport();
    return () => { ignore = true; };
  }, [field, token, onAuthError, clientFallback]);

  if (!field) return null;

  const activeData = reportData || clientFallback;

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
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        className="glass-card field-drilldown-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card, rgba(20, 24, 33, 0.98))',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={20} color="var(--accent-primary)" /> Field Details
            </h3>
            <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              {field.estateName || '-'} / {field.divisionName || '-'} — <strong style={{ color: 'var(--text-color)' }}>Field {field.fieldCode}</strong>
            </div>
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Close Modal"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              color: 'var(--text-color)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading && !activeData && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--accent-primary)', padding: '2rem 0' }}>
            <RefreshCw className="pulse" size={20} /> Loading field details...
          </div>
        )}

        {error && !activeData ? (
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
        ) : activeData ? (
          <>
            {/* Section 1: Field Information */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Database size={14} /> Field Information
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
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
                {activeData.totalRecords != null && (
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Total Records</span>
                    <strong style={{ color: 'var(--accent-primary)' }}>{activeData.totalRecords} trees</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Data Quality */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={14} /> Data Quality
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                    Missing Tree Numbers ({activeData.gapCount || 0}):
                  </div>
                  <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.2))', padding: '0.5rem', borderRadius: '6px', maxHeight: '90px', overflowY: 'auto', wordBreak: 'break-word' }}>
                    {renderArrayLimit(activeData.missingTreeNumbers)}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                    Duplicate Trees ({activeData.duplicateCount || 0}):
                  </div>
                  <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.2))', padding: '0.5rem', borderRadius: '6px', maxHeight: '90px', overflowY: 'auto', wordBreak: 'break-word' }}>
                    {renderArrayLimit(activeData.duplicateTrees)}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Tree Health */}
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Activity size={14} /> Tree Health
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4caf50' }}>{activeData.healthStats?.healthy || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Healthy</div>
                </div>
                <div 
                  onClick={() => setSelectedCondition('runt')}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(255, 193, 7, 0.15)', border: '1px solid rgba(255, 193, 7, 0.3)', textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffc107' }}>{activeData.healthStats?.runt || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Runt</div>
                </div>
                <div 
                  onClick={() => setSelectedCondition('dead')}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444' }}>{activeData.healthStats?.dead || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dead</div>
                </div>
                <div 
                  onClick={() => setSelectedCondition('damaged')}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)', textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ec4899' }}>{activeData.healthStats?.damaged || 0}</div>
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
                  const count = activeData.girthDist?.[b.key] || 0;
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

      {/* Condition Trees Modal */}
      {selectedCondition && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-main)', color: 'var(--text-main)', width: '100%', maxWidth: '400px', maxHeight: '80vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', textTransform: 'capitalize' }}>{selectedCondition} Trees</h3>
              <button onClick={() => setSelectedCondition(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1rem', overflowY: 'auto' }}>
              {(() => {
                const filtered = (activeData.treeRows || []).filter(m => {
                  const cond = (m.treeCondition || 'healthy').toLowerCase();
                  if (selectedCondition === 'damaged') return cond === 'damaged' || cond === 'animal_attack';
                  return cond === selectedCondition;
                });
                
                if (filtered.length === 0) return <div style={{ color: 'var(--text-muted)' }}>No {selectedCondition} trees found.</div>;
                
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tree No</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem' }}>{m.treeNo ?? '-'}</td>
                          <td style={{ padding: '0.5rem' }}>{m.reason || m.conditionNote || m.abnormalReason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

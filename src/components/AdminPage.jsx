import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Lock, Unlock, Map as MapIcon, RefreshCw, LogOut, Database, AlertTriangle, Smartphone, QrCode, ShieldOff, Shield, Download, BarChart3, CheckCircle2, XCircle, Clock, User, Trash2, Users } from 'lucide-react';
import QRCode from 'qrcode';
import 'leaflet/dist/leaflet.css';

import { fetchAdminMeasurements, triggerAdminExport } from '../services/supabaseSync';
import { supabase } from '../services/supabaseClient';

function getStatus(m) {
  return String(m.recommendationText || '').toLowerCase();
}

function isAbnormal(m) {
  return m.abnormalFlag === true || m.abnormalFlag === 1 || m.abnormalFlag === 'Yes' || m.abnormalFlag === 'true';
}

import MeasurementMap from './MeasurementMap';
import AdminConfigTab from './AdminConfigTab';
import FieldDrilldown from './FieldDrilldown';
import UsersTab from './UsersTab';
import { Settings2 } from 'lucide-react';


function AdminMap({ measurements, filter, mapRef, onSelectMeasurement }) {
  const [showAccuracy, setShowAccuracy] = useState(true);

  return (
    <div className="glass-card admin-map-card" ref={mapRef}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapIcon size={18} /> GPS Field Map
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <input 
            type="checkbox" 
            checked={showAccuracy} 
            onChange={(e) => setShowAccuracy(e.target.checked)} 
          />
          Show GPS Accuracy
        </label>
      </div>
      <div className="admin-map-container">
        <MeasurementMap 
          measurements={measurements} 
          filter={filter} 
          showAccuracy={showAccuracy} 
          height="100%" 
          adminMode={true} 
          onSelectMeasurement={onSelectMeasurement}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Summary Tab (Overview)
// ----------------------------------------------------
function SummaryTab({ token, onAuthError, onSelectField }) {

  const [summary, setSummary] = useState(null);
  const [fieldDetails, setFieldDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterEstateId, setFilterEstateId] = useState('');
  const [filterDivisionId, setFilterDivisionId] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'get_summary', {
        estate_id: filterEstateId || undefined,
        division_id: filterDivisionId || undefined,
      });
      if (data.success) {
        setSummary(data.summary);
        const sortedFields = (data.field_details || []).sort((a, b) => {
          if (!a.last_recorded) return 1;
          if (!b.last_recorded) return -1;
          return new Date(b.last_recorded) - new Date(a.last_recorded);
        });
        setFieldDetails(sortedFields);
      } else {
        onAuthError(data.error);
      }
    } catch (err) {
      if (err.message && err.message.includes('Invalid or expired')) {
        onAuthError(err.message);
      } else {
        setError('Failed to load summary: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, onAuthError, filterEstateId, filterDivisionId]);

  useEffect(() => {
    const run = async () => {
      await loadSummary();
    };
    run();
  }, [loadSummary]);

  const handleEstateFilter = (val) => {
    setFilterEstateId(val);
    setFilterDivisionId('');
  };

  const formatDate = (val) => {
    if (!val) return '-';
    try { return new Date(val).toLocaleDateString(); } catch { return String(val); }
  };

  const estates = summary?.estates || [];
  const divisions = (summary?.divisions || []).filter(d => !filterEstateId || d.estate_id === filterEstateId);

  return (
    <>
      {error && (
        <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Metric Cards */}
      {loading && !summary ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <RefreshCw className="pulse" size={24} />
          <div className="text-muted" style={{ marginTop: '0.5rem' }}>Loading summary...</div>
        </div>
      ) : summary ? (
        <>
          <div className="admin-summary-grid">
            <div className="admin-summary-card">
              <div className="admin-summary-icon" style={{ background: 'rgba(33, 150, 243, 0.12)' }}><Database size={20} color="#2196f3" /></div>
              <div className="admin-summary-value">{summary.total_records.toLocaleString()}</div>
              <div className="admin-summary-label">Total Records</div>
            </div>
            <div className="admin-summary-card">
              <div className="admin-summary-icon" style={{ background: 'rgba(76, 175, 80, 0.12)' }}><CheckCircle2 size={20} color="#4caf50" /></div>
              <div className="admin-summary-value">{summary.fields_with_records}</div>
              <div className="admin-summary-label">Fields with Records</div>
            </div>
            <div className="admin-summary-card">
              <div className="admin-summary-icon" style={{ background: 'rgba(255, 152, 0, 0.12)' }}><AlertTriangle size={20} color="#ff9800" /></div>
              <div className="admin-summary-value">{summary.fields_without_records}</div>
              <div className="admin-summary-label">Fields without Records</div>
            </div>
            <div className="admin-summary-card">
              <div className="admin-summary-icon" style={{ background: 'rgba(156, 39, 176, 0.12)' }}><BarChart3 size={20} color="#9c27b0" /></div>
              <div className="admin-summary-value">{summary.total_fields}</div>
              <div className="admin-summary-label">Total Fields</div>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Field Record Matrix</h4>
              <button className="btn btn-secondary" onClick={loadSummary} disabled={loading} style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                {loading ? <RefreshCw className="pulse" size={14} /> : <RefreshCw size={14} />} Refresh
              </button>
            </div>
            <div className="input-row" style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
                <select value={filterEstateId} onChange={(e) => handleEstateFilter(e.target.value)} style={{ fontSize: '0.85rem' }}>
                  <option value="">All Estates</option>
                  {estates.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
                <select value={filterDivisionId} onChange={(e) => setFilterDivisionId(e.target.value)} disabled={!filterEstateId} style={{ fontSize: '0.85rem' }}>
                  <option value="">All Divisions</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {/* Field Details - responsive cards on mobile, table on desktop */}
            {fieldDetails.length === 0 ? (
              <div className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>No fields found.</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="admin-table-desktop">
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Estate</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Division</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Field</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Extent</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>SPH</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Total Recorded</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Last Tree #</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Last Recorded</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldDetails.map((f, i) => {
                          const isClickable = Boolean(f.field_id && onSelectField);
                          const extentVal = parseFloat(f.extent);
                          const sphVal = (extentVal && extentVal > 0 && f.total) ? Math.round(f.total / extentVal) : (extentVal && extentVal > 0 ? 0 : '-');
                          return (
                            <tr
                              key={f.field_id || i}
                              onClick={() => {
                                if (isClickable) {
                                  onSelectField({
                                    fieldId: f.field_id,
                                    fieldCode: f.field_code,
                                    divisionName: f.division_name,
                                    estateName: f.estate_name,
                                    extentHa: f.extent
                                  });
                                }
                              }}
                              style={{
                                borderBottom: '1px solid var(--border-color)',
                                cursor: isClickable ? 'pointer' : 'default',
                                transition: 'background 0.2s'
                              }}
                            >
                              <td style={{ padding: '0.4rem 0.5rem' }}>{f.estate_name}</td>
                              <td style={{ padding: '0.4rem 0.5rem' }}>{f.division_name}</td>
                              <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>{f.field_code}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                {f.completed_at ? (
                                  <span style={{ fontSize: '0.65rem', background: 'rgba(76, 175, 80, 0.12)', color: '#4caf50', padding: '0.15rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'inline-block' }}>
                                    Completed
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.65rem', background: 'rgba(255, 152, 0, 0.12)', color: '#ff9800', padding: '0.15rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'inline-block' }}>
                                    On Going
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{f.extent || '-'}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{sphVal}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{f.total}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{f.last_tree_no}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.78rem' }}>{formatDate(f.last_recorded)}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                {isClickable ? (
                                  <span style={{ color: 'var(--accent-primary)', fontSize: '0.78rem', fontWeight: 600 }}>
                                    View Details →
                                  </span>
                                ) : (
                                  <span className="text-muted" style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                                    -
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile cards */}
                <div className="admin-table-mobile">
                  {fieldDetails.map((f, i) => {
                    const isClickable = Boolean(f.field_id && onSelectField);
                    const extentVal = parseFloat(f.extent);
                    const sphVal = (extentVal && extentVal > 0 && f.total) ? Math.round(f.total / extentVal) : (extentVal && extentVal > 0 ? 0 : '-');
                    return (
                      <div
                        key={f.field_id || i}
                        className="admin-field-card"
                        onClick={() => {
                          if (isClickable) {
                            onSelectField({
                              fieldId: f.field_id,
                              fieldCode: f.field_code,
                              divisionName: f.division_name,
                              estateName: f.estate_name,
                              extentHa: f.extent
                            });
                          }
                        }}
                        style={{ cursor: isClickable ? 'pointer' : 'default' }}
                      >
                        <div className="admin-field-card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700 }}>{f.field_code}</span>
                            {f.completed_at ? (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(76, 175, 80, 0.12)', color: '#4caf50', padding: '0.15rem 0.35rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                Completed
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(255, 152, 0, 0.12)', color: '#ff9800', padding: '0.15rem 0.35rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                On Going
                              </span>
                            )}
                          </div>
                          <span className="admin-field-card-badge" style={{ background: 'rgba(76,175,80,0.15)', color: '#4caf50' }}>
                            {f.total} trees
                          </span>
                        </div>
                        <div className="admin-field-card-meta">{f.estate_name} / {f.division_name}</div>
                        <div className="admin-field-card-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Extent: <span style={{ color: 'var(--text-color)' }}>{f.extent || '-'}</span></div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>SPH: <span style={{ color: 'var(--text-color)', fontWeight: 600 }}>{sphVal}</span></div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Last Tree: <span style={{ color: 'var(--text-color)' }}>{f.last_tree_no}</span></div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Last Rec: <span style={{ color: 'var(--text-color)' }}>{formatDate(f.last_recorded)}</span></div>
                        </div>
                        {isClickable && (
                          <div style={{ marginTop: '0.5rem', textAlign: 'right', fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                            View Details →
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </>
            )}
          </div>
        </>
      ) : (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="text-muted">No summary data available.</div>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------
// Pending Requests Section (inside DevicesTab)
// ----------------------------------------------------
function PendingRequestsSection({ token, myRole, onAuthError }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const canManageDevices = myRole === 'superadmin';

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'list_pending_requests');
      if (data.success) {
        setRequests(data.requests || []);
      } else {
        onAuthError(data.error);
      }
    } catch (err) {
      if (err.message && err.message.includes('Invalid or expired')) {
        onAuthError(err.message);
      } else {
        setError('Failed to load pending requests.');
      }
    } finally {
      setLoading(false);
    }
  }, [token, onAuthError]);

  useEffect(() => {
    const run = async () => {
      await loadRequests();
    };
    run();
  }, [loadRequests]);

  const handleAction = async (requestId, action) => {
    const actionLabel = action === 'approve' ? 'approve' : 'deny';
    if (!confirm(`Are you sure you want to ${actionLabel} this device request?`)) return;

    setActioning(requestId + ':' + action);
    setError('');
    setSuccessMsg('');
    try {
      const { adminApproveDevice: approveDeviceFn } = await import('../services/supabaseSync');
      const result = await approveDeviceFn(token, requestId, action);
      if (result.success) {
        setSuccessMsg(`Device request ${actionLabel}d successfully.`);
        setRequests(prev => prev.filter(r => r.request_id !== requestId));
      } else {
        setError(result.error || `Failed to ${actionLabel} device.`);
      }
    } catch (err) {
      if (err.message && err.message.includes('Invalid or expired')) {
        onAuthError(err.message);
      } else {
        setError(`Failed to ${actionLabel}: ${err.message}`);
      }
    } finally {
      setActioning(null);
    }
  };

  const formatDate = (val) => {
    if (!val) return '-';
    try { return new Date(val).toLocaleString(); } catch { return String(val); }
  };

  return (
    <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="#ff9800" /> Pending Requests ({requests.length})
        </h3>
        <button className="btn btn-secondary" onClick={loadRequests} disabled={loading} style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
          {loading ? <RefreshCw className="pulse" size={14} /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      {error && (
        <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '0.75rem' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="warning-banner" style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', borderColor: '#4caf50', marginBottom: '0.75rem' }}>
          <CheckCircle2 size={14} /> {successMsg}
        </div>
      )}

      {loading && requests.length === 0 ? (
        <div className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>Loading pending requests...</div>
      ) : requests.length === 0 ? (
        <div className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>No pending requests.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="admin-table-desktop">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Operator</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Estate</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Device</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Location</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Requested</th>
                    {canManageDevices && <th style={{ padding: '0.5rem', textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r, i) => (
                    <tr key={r.request_id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem' }}>{r.operator_name || '-'}</td>
                      <td style={{ padding: '0.5rem' }}>{r.estate_code || '-'}</td>
                      <td style={{ padding: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>{(r.device_id_hash || '').substring(0, 12)}...</td>
                      <td style={{ padding: '0.5rem' }}>
                        {r.google_map_link ? (
                          <a href={r.google_map_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)' }}>View Map</a>
                        ) : r.latitude ? (
                          <span style={{ fontSize: '0.78rem' }}>{Number(r.latitude).toFixed(4)}, {Number(r.longitude).toFixed(4)}</span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: '0.78rem' }}>{formatDate(r.requested_at)}</td>
                      {canManageDevices && (
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                            <button
                              className="btn"
                              onClick={() => handleAction(r.request_id, 'approve')}
                              disabled={!!actioning}
                              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--success)', color: '#fff', minHeight: '36px' }}
                            >
                              {actioning === r.request_id + ':approve' ? <RefreshCw className="pulse" size={12} /> : <CheckCircle2 size={12} />} Approve
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => handleAction(r.request_id, 'deny')}
                              disabled={!!actioning}
                              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem', minHeight: '36px' }}
                            >
                              {actioning === r.request_id + ':deny' ? <RefreshCw className="pulse" size={12} /> : <XCircle size={12} />} Deny
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="admin-table-mobile">
            {requests.map((r, i) => (
              <div key={r.request_id || i} className="admin-field-card">
                <div className="admin-field-card-header">
                  <span style={{ fontWeight: 700 }}><User size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />{r.operator_name || 'Unknown'}</span>
                  <span className="admin-field-card-badge" style={{ background: 'rgba(255,152,0,0.15)', color: '#ff9800' }}>Pending</span>
                </div>
                <div className="admin-field-card-meta">
                  Estate: {r.estate_code || '-'} | Requested: {formatDate(r.requested_at)}
                </div>
                <div className="admin-field-card-meta" style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>
                  Device: {(r.device_id_hash || '').substring(0, 16)}...
                </div>
                {r.google_map_link && (
                  <div style={{ marginTop: '0.3rem' }}>
                    <a href={r.google_map_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)' }}>View Location</a>
                  </div>
                )}
                {canManageDevices && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn"
                      onClick={() => handleAction(r.request_id, 'approve')}
                      disabled={!!actioning}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', background: 'var(--success)', color: '#fff', minHeight: '44px' }}
                    >
                      {actioning === r.request_id + ':approve' ? <RefreshCw className="pulse" size={14} /> : <CheckCircle2 size={14} />} Approve
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleAction(r.request_id, 'deny')}
                      disabled={!!actioning}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', minHeight: '44px' }}
                    >
                      {actioning === r.request_id + ':deny' ? <RefreshCw className="pulse" size={14} /> : <XCircle size={14} />} Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------
// Device Management Tab
// ----------------------------------------------------
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function getDeviceStatus(lastSeenAt) {
  if (!lastSeenAt) return 'unknown';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff <= ONLINE_THRESHOLD_MS ? 'online' : 'offline';
}

function StatusBadge({ status }) {
  const config = {
    online:  { color: '#4caf50', bg: 'rgba(76, 175, 80, 0.15)',  label: 'Online' },
    offline: { color: '#9e9e9e', bg: 'rgba(158, 158, 158, 0.12)', label: 'Offline' },
    unknown: { color: '#ff9800', bg: 'rgba(255, 152, 0, 0.15)',  label: 'Unknown' },
  };
  const c = config[status] || config.unknown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.15rem 0.5rem', borderRadius: '999px',
      background: c.bg, color: c.color, fontSize: '0.75rem', fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: c.color,
        display: 'inline-block',
        boxShadow: status === 'online' ? `0 0 6px ${c.color}` : 'none',
        animation: status === 'online' ? 'pulse-glow 2s ease-in-out infinite' : 'none',
      }} />
      {c.label}
    </span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'Just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DevicesTab({ token, myRole, onAuthError }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const autoRefreshRef = useRef(null);

  const canManageDevices = myRole === 'superadmin';

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'list_devices', { cacheBust: Date.now() });
      if (data.success) {
        const mappedDevices = (data.devices || []).map(d => ({
           deviceIdHash: d.device_id_hash,
           estate: d.estate_code,
           operatorName: d.operator_name,
           approvedAt: d.approved_at,
           lastSeenAt: d.last_seen_at,
           lastSyncAt: d.last_sync_at,
           revoked: d.revoked
        }));
        setDevices(mappedDevices);
      } else {
        onAuthError(data.error);
      }
    } catch {
      setError('Failed to load devices.');
    } finally {
      setLoading(false);
    }
  }, [token, onAuthError]);

  useEffect(() => {
    const run = async () => {
      await fetchDevices();
    };
    run();
    // Auto-refresh every 30 seconds
    autoRefreshRef.current = setInterval(fetchDevices, 30000);
    return () => clearInterval(autoRefreshRef.current);
  }, [fetchDevices]);

  const loadDevices = () => {
    fetchDevices();
  };

  const revokeDevice = async (deviceIdHash) => {
    if (!confirm('Revoke access for this device? It will no longer be able to sync data.')) return;
    setRevoking(deviceIdHash);
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'revoke_device', { deviceIdHash });
      if (data.success) {
        loadDevices();
      } else {
        setError(data.error || 'Failed to revoke device.');
      }
    } catch {
      setError('Network error revoking device.');
    } finally {
      setRevoking(null);
    }
  };

  const deleteDevice = async (deviceIdHash) => {
    if (!confirm('Are you sure you want to permanently delete this revoked device entry?')) return;
    setDeleting(deviceIdHash);
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'delete_device', { deviceIdHash });
      if (data.success) {
        loadDevices();
      } else {
        setError(data.error || 'Failed to delete device.');
      }
    } catch {
      setError('Network error deleting device.');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (val) => {
    if (!val) return '-';
    try { return new Date(val).toLocaleString(); } catch { return String(val); }
  };

  const activeDevices = devices.filter(d => d.revoked !== true && d.revoked !== 'true');
  const revokedDevices = devices.filter(d => d.revoked === true || d.revoked === 'true');

  // Add status to each active device and sort (online first, then by most recently seen)
  const devicesWithStatus = activeDevices.map(d => ({
    ...d,
    status: getDeviceStatus(d.lastSeenAt),
  })).sort((a, b) => {
    const statusOrder = { online: 0, unknown: 1, offline: 2 };
    const orderDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
    if (orderDiff !== 0) return orderDiff;
    // Within same status group, sort by most recently seen
    const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    return bTime - aTime;
  });

  // Apply status filter
  const filteredDevices = statusFilter === 'all'
    ? devicesWithStatus
    : devicesWithStatus.filter(d => d.status === statusFilter);

  const onlineCount = devicesWithStatus.filter(d => d.status === 'online').length;
  const offlineCount = devicesWithStatus.filter(d => d.status === 'offline').length;
  const unknownCount = devicesWithStatus.filter(d => d.status === 'unknown').length;

  const filterBtnStyle = (active) => ({
    width: 'auto', padding: '0.25rem 0.6rem', fontSize: '0.78rem',
    borderRadius: 'var(--radius-md)',
    background: active ? 'var(--accent-primary)' : 'var(--element-bg)',
    color: active ? '#fff' : 'var(--text-muted)',
    border: active ? 'none' : '1px solid var(--border-color)',
    cursor: 'pointer', fontWeight: active ? 600 : 400,
    transition: 'all 0.2s ease',
  });

  return (
    <>
      {error && (
        <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Online Status Summary */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Smartphone size={18} color="var(--accent-primary)" /> Device Status
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-refresh: 30s</span>
            <button className="btn btn-secondary" onClick={loadDevices} disabled={loading} style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
              {loading ? <RefreshCw className="pulse" size={14} /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
        </div>

        {/* Status summary badges */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#4caf50', boxShadow: '0 0 6px #4caf50' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4caf50' }}>{onlineCount}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Online</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(158, 158, 158, 0.08)', border: '1px solid rgba(158, 158, 158, 0.2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#9e9e9e' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#9e9e9e' }}>{offlineCount}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Offline</span>
          </div>
          {unknownCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(255, 152, 0, 0.08)', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff9800' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ff9800' }}>{unknownCount}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Unknown</span>
            </div>
          )}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button style={filterBtnStyle(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>
            All ({devicesWithStatus.length})
          </button>
          <button style={filterBtnStyle(statusFilter === 'online')} onClick={() => setStatusFilter('online')}>
            🟢 Online ({onlineCount})
          </button>
          <button style={filterBtnStyle(statusFilter === 'offline')} onClick={() => setStatusFilter('offline')}>
            ⚫ Offline ({offlineCount})
          </button>
          {unknownCount > 0 && (
            <button style={filterBtnStyle(statusFilter === 'unknown')} onClick={() => setStatusFilter('unknown')}>
              🟡 Unknown ({unknownCount})
            </button>
          )}
        </div>
      </div>

      {/* Active Devices Table */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} color="#4caf50" /> Active Devices ({activeDevices.length})
          </h3>
          {canManageDevices && (
            <div style={{display: 'flex', gap: '0.5rem'}}>
              {/* Temporarily disabled: no need for now
              <button className="btn btn-secondary" onClick={async () => {
                if(!confirm('Migrate devices from GAS?')) return;
                setLoading(true);
                const { adminCRUD } = await import('../services/supabaseSync');
                const res = await adminCRUD(token, 'migrate_devices', { adminToken: token });
                if (res.success) {
                   alert(`Migration complete.\nInserted: ${res.report.inserted}\nSkipped: ${res.report.skipped}\nConflicts: ${res.report.conflicts.length}\nErrors: ${res.report.errors.length}`);
                   loadDevices();
                } else {
                   alert('Migration failed: ' + res.error);
                }
                setLoading(false);
              }} disabled={loading} style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                Migrate GAS Devices
              </button>
              */}
            </div>
          )}
        </div>

        {loading && devices.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>Loading devices...</div>
        ) : filteredDevices.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>
            {statusFilter !== 'all' ? `No ${statusFilter} devices.` : 'No active devices.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Operator</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Estate</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Device ID</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Last Seen</th>
                  {canManageDevices && <th style={{ padding: '0.5rem', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((d, i) => (
                  <tr key={d.deviceIdHash || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <StatusBadge status={d.status} />
                    </td>
                    <td style={{ padding: '0.5rem', fontWeight: 500 }}>{d.operatorName || '-'}</td>
                    <td style={{ padding: '0.5rem' }}>{d.estate || '-'}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {(d.deviceIdHash || '').substring(0, 12)}...
                    </td>
                    <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                      <div>{timeAgo(d.lastSeenAt)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(d.lastSeenAt)}</div>
                    </td>
                    {canManageDevices && (
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button
                          className="btn btn-danger"
                          onClick={() => revokeDevice(d.deviceIdHash)}
                          disabled={revoking === d.deviceIdHash}
                          style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          {revoking === d.deviceIdHash ? <RefreshCw className="pulse" size={12} /> : <ShieldOff size={12} />}
                          {revoking === d.deviceIdHash ? '' : ' Revoke'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {revokedDevices.length > 0 && (
        <div className="glass-card" style={{ padding: '1rem', opacity: 0.7 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <ShieldOff size={16} color="#f44336" /> Revoked ({revokedDevices.length})
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Operator</th>
                  <th style={{ padding: '0.4rem' }}>Estate</th>
                  <th style={{ padding: '0.4rem' }}>Status</th>
                  {canManageDevices && <th style={{ padding: '0.4rem', textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {revokedDevices.map((d, i) => (
                  <tr key={d.deviceIdHash || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.4rem' }}>{d.operatorName || '-'}</td>
                    <td style={{ padding: '0.4rem' }}>{d.estate || '-'}</td>
                    <td style={{ padding: '0.4rem', color: '#f44336' }}>Revoked</td>
                    {canManageDevices && (
                      <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                        <button
                          className="btn btn-danger"
                          onClick={() => deleteDevice(d.deviceIdHash)}
                          disabled={deleting === d.deviceIdHash}
                          style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          {deleting === d.deviceIdHash ? <RefreshCw className="pulse" size={12} /> : <Trash2 size={12} />}
                          {deleting === d.deviceIdHash ? '' : ' Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------
// QR Code Generator Tab
// ----------------------------------------------------
function QRCodesTab({ estates, divisions, fields }) {
  const canvasRef = useRef(null);
  const [qrEstateId, setQrEstateId] = useState('');
  const [qrDivisionId, setQrDivisionId] = useState('');
  const [qrFieldId, setQrFieldId] = useState('');
  const [qrExtent, setQrExtent] = useState('');
  const [qrStartTree, setQrStartTree] = useState('1');
  const [qrUrl, setQrUrl] = useState('');

  const activeEstates = estates.filter(e => e.active);
  const activeDivisions = divisions.filter(d => d.active && d.estate_id === qrEstateId);
  const activeFields = fields.filter(f => f.active && f.division_id === qrDivisionId);

  const handleEstateChange = (val) => {
    setQrEstateId(val);
    setQrDivisionId('');
    setQrFieldId('');
    setQrExtent('');
  };

  const handleDivisionChange = (val) => {
    setQrDivisionId(val);
    setQrFieldId('');
    setQrExtent('');
  };

  const handleFieldChange = (val) => {
    setQrFieldId(val);
    const f = fields.find(x => x.id === val);
    if (f) setQrExtent(f.extent_ha || '');
    else setQrExtent('');
  };



  const doGenerateQR = useCallback(async () => {
    if (!qrEstateId || !qrFieldId) {
      setQrUrl('');
      return;
    }
    const base = window.location.origin;
    const params = new URLSearchParams();
    params.set('estate_id', qrEstateId);
    if (qrDivisionId) params.set('division_id', qrDivisionId);
    params.set('field_id', qrFieldId);
    if (qrExtent) params.set('extent', qrExtent);
    if (qrStartTree && qrStartTree !== '1') params.set('tree', qrStartTree);

    const url = `${base}/?${params.toString()}`;
    setQrUrl(url);

    if (canvasRef.current) {
      try {
        const tempCanvas = document.createElement('canvas');
        await QRCode.toCanvas(tempCanvas, url, {
          width: 220,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });

        const ctx = canvasRef.current.getContext('2d');
        const qrSize = 220;
        const topTextHeight = 30;
        const bottomTextHeight = 30;

        canvasRef.current.width = qrSize;
        canvasRef.current.height = qrSize + topTextHeight + bottomTextHeight;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        ctx.drawImage(tempCanvas, 0, topTextHeight);

        const estate = estates.find(e => e.id === qrEstateId)?.name || '';
        const division = divisions.find(d => d.id === qrDivisionId)?.name || '';
        const field = fields.find(f => f.id === qrFieldId);
        const displayName = field ? field.field_code : '';
        const extent = qrExtent || 'N/A';

        const topText = division ? `${estate} - ${division}` : estate;
        const bottomText = `${displayName} - ${extent}`;

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(topText, qrSize / 2, topTextHeight / 2);
        ctx.fillText(bottomText, qrSize / 2, qrSize + topTextHeight + (bottomTextHeight / 2));
      } catch (err) {
        console.error(err);
      }
    }
  }, [qrEstateId, qrDivisionId, qrFieldId, qrExtent, qrStartTree, estates, divisions, fields]);

  useEffect(() => {
    const run = async () => {
      await doGenerateQR();
    };
    run();
  }, [doGenerateQR]);

  const downloadQR = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    const f = fields.find(x => x.id === qrFieldId);
    link.download = `QR_${f ? f.field_code : 'Field'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <QrCode size={18} /> Generate Field QR Code
      </h3>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Field workers scan this QR to pre-fill their setup screen instantly. Only active fields are shown.
      </p>

      <div className="input-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 180px' }}>
          <label>Estate *</label>
          <select value={qrEstateId} onChange={(e) => handleEstateChange(e.target.value)}>
            <option value="">Select Estate...</option>
            {activeEstates.map(est => <option key={est.id} value={est.id}>{est.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: '1 1 120px' }}>
          <label>Division</label>
          <select value={qrDivisionId} onChange={(e) => handleDivisionChange(e.target.value)} disabled={!qrEstateId}>
            <option value="">Select Division...</option>
            {activeDivisions.map(div => <option key={div.id} value={div.id}>{div.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: '1 1 100px' }}>
          <label>Field No *</label>
          <select value={qrFieldId} onChange={(e) => handleFieldChange(e.target.value)} disabled={!qrDivisionId}>
            <option value="">Select Field...</option>
            {activeFields.map(f => <option key={f.id} value={f.id}>{f.field_code}</option>)}
          </select>
        </div>
      </div>
      <div className="input-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '0.5rem' }}>
        <div className="form-group" style={{ flex: '1 1 120px' }}>
          <label>Extent (Ha)</label>
          <input type="number" step="0.01" placeholder="Optional" value={qrExtent} onChange={(e) => setQrExtent(e.target.value)} readOnly />
        </div>
        <div className="form-group" style={{ flex: '1 1 120px' }}>
          <label>Start Tree</label>
          <input type="number" min="1" value={qrStartTree} onChange={(e) => setQrStartTree(e.target.value)} />
        </div>
      </div>

      {qrEstateId && qrFieldId && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <canvas ref={canvasRef} style={{ borderRadius: '8px', border: '1px solid var(--border-color)' }} />
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem', wordBreak: 'break-all' }}>
            {qrUrl}
          </div>
          <button className="btn btn-secondary" onClick={downloadQR} style={{ width: 'auto', padding: '0.4rem 1rem', marginTop: '0.75rem' }}>
            <Download size={16} /> Download PNG
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// Abnormal Trees Modal
// ----------------------------------------------------
function AbnormalTreesModal({ measurements, estates, divisions, fields, onClose }) {
  const [search, setSearch] = useState('');

  const abnormalMeasurements = useMemo(() => {
    const isAbn = (m) =>
      m.abnormalFlag === true || m.abnormalFlag === 1 ||
      m.abnormalFlag === 'Yes' || m.abnormalFlag === 'true';
    return measurements.filter(m => isAbn(m));
  }, [measurements]);

  // Enrich each abnormal measurement with resolved Estate, Division, Field, Extent, YOP
  const enrichedRows = useMemo(() => {
    return abnormalMeasurements.map(m => {
      // Try to resolve field from field_id or fieldId
      const fId = m.field_id || m.fieldId;
      const matchedField = fId ? fields.find(f => f.id === fId) : null;

      // Resolve estate/division from matched field, or from measurement string fields
      let estateName = m.estate || '-';
      let divisionName = m.division || '-';
      let fieldNo = m.fieldNo || '-';
      let extent = m.extent != null ? m.extent : '-';
      let yop = '-';

      if (matchedField) {
        fieldNo = matchedField.field_code || fieldNo;
        extent = matchedField.extent_ha != null ? matchedField.extent_ha : extent;
        const yopRaw = matchedField.yop;
        if (yopRaw !== null && yopRaw !== undefined && yopRaw !== '' && !isNaN(Number(yopRaw))) {
          yop = Number(yopRaw);
        }

        const matchedDiv = divisions.find(d => d.id === matchedField.division_id);
        if (matchedDiv) divisionName = matchedDiv.name || divisionName;

        const matchedEstate = estates.find(e => e.id === matchedField.estate_id);
        if (matchedEstate) estateName = matchedEstate.name || estateName;
      }

      const dateStr = m.date || (m.timestamp ? new Date(m.timestamp).toLocaleDateString() : '-');
      const girth = m.girth != null ? `${m.girth}"` : '-';
      const reason = m.abnormalReason || (m.treeCondition === 'runt' ? 'Runt' : 'Abnormal Reading');

      return {
        id: m.id,
        estate: estateName,
        division: divisionName,
        fieldNo,
        extent,
        yop,
        treeNo: m.treeNo ?? '-',
        girth,
        reason,
        date: dateStr,
      };
    });
  }, [abnormalMeasurements, estates, divisions, fields]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return enrichedRows;
    const q = search.toLowerCase().trim();
    return enrichedRows.filter(r =>
      String(r.estate).toLowerCase().includes(q) ||
      String(r.division).toLowerCase().includes(q) ||
      String(r.fieldNo).toLowerCase().includes(q) ||
      String(r.treeNo).toLowerCase().includes(q)
    );
  }, [enrichedRows, search]);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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
        className="glass-card abnormal-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-card, rgba(20, 24, 33, 0.98))',
          animation: 'abnormalModalIn 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={20} color="#9c27b0" /> Abnormal Trees
            </h3>
            <div className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {enrichedRows.length} abnormal {enrichedRows.length === 1 ? 'tree' : 'trees'} identified
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
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
              transition: 'background 0.2s',
              fontSize: '1.1rem',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            type="text"
            placeholder="Search by estate, division, field or tree no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary, rgba(0,0,0,0.2))',
              color: 'var(--text-color)',
              outline: 'none'
            }}
          />
        </div>

        {/* Scrollable Table */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {filteredRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {search ? 'No abnormal trees match your search.' : 'No abnormal trees found.'}
            </div>
          ) : (
            <table className="abnormal-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 2, background: 'rgba(156, 39, 176, 0.15)' }}>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'left', whiteSpace: 'nowrap' }}>Estate</th>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'left', whiteSpace: 'nowrap' }}>Divi</th>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'left', whiteSpace: 'nowrap' }}>Field No</th>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'right', whiteSpace: 'nowrap' }}>Extent</th>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'center', whiteSpace: 'nowrap' }}>YOP</th>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'center', whiteSpace: 'nowrap' }}>Tree No</th>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'right', whiteSpace: 'nowrap' }}>Girth</th>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'left', whiteSpace: 'nowrap' }}>Reason</th>
                  <th style={{ padding: '0.5rem', border: '1px solid rgba(156, 39, 176, 0.3)', textAlign: 'center', whiteSpace: 'nowrap' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, idx) => (
                  <tr key={r.id || idx} className="abnormal-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{r.estate}</td>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{r.division}</td>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.fieldNo}</td>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.extent}</td>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>{r.yop}</td>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center', fontWeight: 600, color: '#9c27b0' }}>{r.treeNo}</td>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 600 }}>{r.girth}</td>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.reason}</td>
                    <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        {filteredRows.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Showing {filteredRows.length} of {enrichedRows.length} abnormal trees</span>
            {search && <span style={{ color: 'var(--accent-primary)', cursor: 'pointer' }} onClick={() => setSearch('')}>Clear search</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Main Admin Page
// ----------------------------------------------------
export default function AdminPage() {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [authInitialized, setAuthInitialized] = useState(false);

  // RBAC state
  const [myRole, setMyRole] = useState(null);
  const [myCanInviteUsers, setMyCanInviteUsers] = useState(false);
  const [myEstateIds, setMyEstateIds] = useState([]);
  const [superAdmins, setSuperAdmins] = useState([]);

  const VALID_TABS = ['overview', 'measurements', 'devices', 'config', 'qrcodes', 'users'];

  const [activeTab, setActiveTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return VALID_TABS.includes(requested) ? requested : 'overview';
  });
  const [estates, setEstates] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [fields, setFields] = useState([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [selectedEstateId, setSelectedEstateId] = useState('');
  const [divisionFilterId, setDivisionFilterId] = useState('');
  const [fieldNoFilterId, setFieldNoFilterId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [measurements, setMeasurements] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedFieldForDrilldown, setSelectedFieldForDrilldown] = useState(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState(null);
  const mapRef = useRef(null);
  const latestMeasurementRequestRef = useRef(0);

  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [showAbnormalModal, setShowAbnormalModal] = useState(false);
  const [fieldsWithCensusIds, setFieldsWithCensusIds] = useState(null);

  const selectedEstateCode = useMemo(() => {
    if (!selectedEstateId) return null;
    return estates.find((estate) => estate.id === selectedEstateId)?.code || null;
  }, [selectedEstateId, estates]);

  const selectedDivisionCode = useMemo(() => {
    if (!divisionFilterId) return null;
    return divisions.find((div) => div.id === divisionFilterId)?.code || null;
  }, [divisionFilterId, divisions]);
  
  const selectedFieldCode = useMemo(() => {
    if (!fieldNoFilterId) return null;
    return fields.find((f) => f.id === fieldNoFilterId)?.field_code || null;
  }, [fieldNoFilterId, fields]);

  const mapMeasurements = useMemo(() => {
    return (measurements || []).filter((measurement) => {
      if (selectedEstateCode && measurement.estate !== selectedEstateCode) return false;
      if (selectedDivisionCode && measurement.division !== selectedDivisionCode) return false;
      if (selectedFieldCode && measurement.fieldNo !== selectedFieldCode) return false;
      return true;
    });
  }, [measurements, selectedEstateCode, selectedDivisionCode, selectedFieldCode]);

  useEffect(() => {
    const selectedStillVisible = selectedMeasurement &&
      mapMeasurements.some((m) => m.id === selectedMeasurement.id);
    if (selectedMeasurement && !selectedStillVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMeasurement(null);
    }
  }, [mapMeasurements, selectedMeasurement]);

  const censusSummaryData = useMemo(() => {
    if (!measurements || measurements.length === 0) {
      return { rows: [], totals: null };
    }

    // Group measurements by field_id or fallback key
    const groupsMap = new Map();

    measurements.forEach((m) => {
      const fId = m.fieldId || m.field_id;
      const key = fId || `${m.estate}|${m.division}|${m.fieldNo}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, { fieldId: fId, measurements: [] });
      }
      groupsMap.get(key).measurements.push(m);
    });

    const rows = [];

    groupsMap.forEach(({ fieldId, measurements: gList }) => {
      if (gList.length === 0) return;

      const firstM = gList[0];
      // Lookup field metadata from fields array
      const matchedField = fields.find((f) => f.id === fieldId) || null;
      const matchedDivision = matchedField
        ? divisions.find((d) => d.id === matchedField.division_id)
        : null;
      const matchedEstate = matchedField
        ? estates.find((e) => e.id === matchedField.estate_id)
        : null;

      const estateName = matchedEstate?.name || matchedField?.estates?.name || firstM.estate || '-';
      const divisionName = matchedDivision?.name || matchedField?.divisions?.name || firstM.division || '-';
      const fieldNo = matchedField?.field_code || firstM.fieldNo || '-';

      const extentVal = matchedField?.extent_ha != null
        ? parseFloat(matchedField.extent_ha)
        : (firstM.extent != null ? parseFloat(firstM.extent) : 0);
      const extent = isNaN(extentVal) ? 0 : extentVal;

      const yopRaw = matchedField?.yop;
      const yop = (yopRaw !== null && yopRaw !== undefined && yopRaw !== '' && !isNaN(Number(yopRaw)))
        ? Number(yopRaw)
        : null;

      // Latest measurement date
      let maxDateObj = null;
      gList.forEach((m) => {
        if (m.date) {
          const d = new Date(m.date);
          if (!isNaN(d.getTime())) {
            if (!maxDateObj || d > maxDateObj) {
              maxDateObj = d;
            }
          }
        }
      });

      const censusDateStr = maxDateObj
        ? maxDateObj.toISOString().slice(0, 10)
        : '-';

      const censusYear = maxDateObj
        ? maxDateObj.getFullYear()
        : new Date().getFullYear();

      const upkeepYear = yop !== null ? String(censusYear - yop) : '';

      // Count unique tree numbers for Total Plants
      const uniqueTrees = new Set();
      const uniqueSphTrees = new Set();
      let sphListCount = 0;

      gList.forEach((m) => {
        const isDeadOrDamaged = ['dead', 'damaged', 'animal_attack'].includes(m.treeCondition);
        if (m.treeNo != null && m.treeNo !== '') {
          uniqueTrees.add(m.treeNo);
          if (!isDeadOrDamaged) {
            uniqueSphTrees.add(m.treeNo);
          }
        } else {
          if (!isDeadOrDamaged) {
            sphListCount++;
          }
        }
      });
      const totalPlants = uniqueTrees.size > 0 ? uniqueTrees.size : gList.length;
      const sphPlants = uniqueTrees.size > 0 ? uniqueSphTrees.size : sphListCount;

      // Girth distribution bands
      let lessThan4 = 0;
      let band4to7_9 = 0;
      let band8to9_9 = 0;
      let band10to11_9 = 0;
      let band12to13_9 = 0;
      let band14to15_9 = 0;
      let band16to17_9 = 0;
      let band18to19_9 = 0;
      let over20 = 0;

      gList.forEach((m) => {
        const g = parseFloat(m.girth);
        if (isNaN(g)) return;
        if (g < 4) lessThan4++;
        else if (g < 8) band4to7_9++;
        else if (g < 10) band8to9_9++;
        else if (g < 12) band10to11_9++;
        else if (g < 14) band12to13_9++;
        else if (g < 16) band14to15_9++;
        else if (g < 18) band16to17_9++;
        else if (g < 20) band18to19_9++;
        else over20++;
      });

      const sph = extent > 0 ? Math.round(sphPlants / extent) : 0;
      const above20Pct = totalPlants > 0 ? Math.round((over20 / totalPlants) * 100) : 0;

      rows.push({
        fieldId,
        estateName,
        divisionName,
        fieldNo,
        extent,
        yop,
        upkeepYear,
        censusDate: censusDateStr,
        lessThan4,
        band4to7_9,
        band8to9_9,
        band10to11_9,
        band12to13_9,
        band14to15_9,
        band16to17_9,
        band18to19_9,
        over20,
        totalPlants,
        sphPlants,
        sph,
        above20Pct,
        targetField: {
          fieldId,
          estateName,
          divisionName,
          fieldCode: fieldNo
        }
      });
    });

    // Order rows by Estate Name -> Division -> Field Number
    rows.sort((a, b) => {
      const eCmp = a.estateName.localeCompare(b.estateName);
      if (eCmp !== 0) return eCmp;
      const dCmp = a.divisionName.localeCompare(b.divisionName);
      if (dCmp !== 0) return dCmp;
      return a.fieldNo.localeCompare(b.fieldNo, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Totals row calculation
    const totals = {
      extent: rows.reduce((acc, r) => acc + r.extent, 0),
      lessThan4: rows.reduce((acc, r) => acc + r.lessThan4, 0),
      band4to7_9: rows.reduce((acc, r) => acc + r.band4to7_9, 0),
      band8to9_9: rows.reduce((acc, r) => acc + r.band8to9_9, 0),
      band10to11_9: rows.reduce((acc, r) => acc + r.band10to11_9, 0),
      band12to13_9: rows.reduce((acc, r) => acc + r.band12to13_9, 0),
      band14to15_9: rows.reduce((acc, r) => acc + r.band14to15_9, 0),
      band16to17_9: rows.reduce((acc, r) => acc + r.band16to17_9, 0),
      band18to19_9: rows.reduce((acc, r) => acc + r.band18to19_9, 0),
      over20: rows.reduce((acc, r) => acc + r.over20, 0),
      totalPlants: rows.reduce((acc, r) => acc + r.totalPlants, 0),
      sphPlants: rows.reduce((acc, r) => acc + r.sphPlants, 0)
    };

    totals.sph = totals.extent > 0 ? Math.round(totals.sphPlants / totals.extent) : 0;
    totals.above20Pct = totals.totalPlants > 0 ? Math.round((totals.over20 / totals.totalPlants) * 100) : 0;

    return { rows, totals };
  }, [measurements, fields, estates, divisions]);

  const handleDownloadGirthCensusExcel = async () => {
    if (!censusSummaryData || censusSummaryData.rows.length === 0) return;
    setDownloadingExcel(true);
    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Girth Census Summary');

      const headers = [
        'Estate Name', 'Division', 'Field No', 'Extent', 'YOP',
        'Up keep Year (1st/2nd)', 'Census Completed Date',
        'Less than 4"', '4" - 7.9"', '8" - 9.9"', '10" - 11.9"',
        '12" - 13.9"', '14" - 15.9"', '16" - 17.9"', '18" - 19.9"',
        '20" or more', 'Total Plants', 'SPH', 'Above 20" Tree %'
      ];

      // Title row
      const titleRow = worksheet.addRow(['Girth Census Summary Report']);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FF1F497D' } };
      worksheet.addRow([]);

      // Header row
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF8EA9DB' }
        };
        cell.font = { bold: true, color: { argb: 'FF000000' }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      // Data rows
      censusSummaryData.rows.forEach((r) => {
        const row = worksheet.addRow([
          r.estateName,
          r.divisionName,
          r.fieldNo,
          r.extent,
          r.yop !== null ? r.yop : '-',
          r.upkeepYear !== '' ? Number(r.upkeepYear) : '',
          r.censusDate,
          r.lessThan4,
          r.band4to7_9,
          r.band8to9_9,
          r.band10to11_9,
          r.band12to13_9,
          r.band14to15_9,
          r.band16to17_9,
          r.band18to19_9,
          r.over20,
          r.totalPlants,
          r.sph,
          r.above20Pct / 100
        ]);

        row.height = 20;
        row.eachCell((cell, colIndex) => {
          cell.font = { size: 10 };
          if (colIndex === 4) cell.numFmt = '0.00';
          if (colIndex >= 8 && colIndex <= 18) cell.numFmt = '#,##0';
          if (colIndex === 19) cell.numFmt = '0%';

          cell.alignment = {
            vertical: 'middle',
            horizontal: colIndex <= 3 || colIndex === 7 ? 'left' : 'center'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
          };
        });
      });

      // Totals row (Bold text, cell borders, NO background fill)
      const t = censusSummaryData.totals;
      const totalRow = worksheet.addRow([
        'Total',
        '',
        '',
        t.extent,
        '',
        '',
        '',
        t.lessThan4,
        t.band4to7_9,
        t.band8to9_9,
        t.band10to11_9,
        t.band12to13_9,
        t.band14to15_9,
        t.band16to17_9,
        t.band18to19_9,
        t.over20,
        t.totalPlants,
        t.sph,
        t.above20Pct / 100
      ]);

      totalRow.height = 22;
      totalRow.eachCell((cell, colIndex) => {
        cell.font = { bold: true, size: 10 };
        if (colIndex === 4) cell.numFmt = '0.00';
        if (colIndex >= 8 && colIndex <= 18) cell.numFmt = '#,##0';
        if (colIndex === 19) cell.numFmt = '0%';

        cell.alignment = {
          vertical: 'middle',
          horizontal: colIndex <= 3 || colIndex === 7 ? 'left' : 'center'
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      // Column widths
      worksheet.columns.forEach((col, i) => {
        const titleLen = headers[i] ? headers[i].length : 10;
        col.width = Math.max(titleLen + 3, 11);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Girth_Census_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel export error:', err);
      alert('Failed to generate Excel file: ' + err.message);
    } finally {
      setDownloadingExcel(false);
    }
  };



  useEffect(() => {
    document.body.classList.add('admin-route');
    document.documentElement.classList.add('admin-route');

    return () => {
      document.body.classList.remove('admin-route');
      document.documentElement.classList.remove('admin-route');
    };
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setToken(session.access_token);
      }
      setAuthInitialized(true);
    };
    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setToken(null);
        setConfigLoaded(false);
        setMeasurements([]);
      } else if (session) {
        setToken(session.access_token);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { adminCRUD } = await import('../services/supabaseSync');
        const [estRes, divRes, fldRes] = await Promise.all([
          adminCRUD(token, 'list_estates', { includeInactive: true }),
          adminCRUD(token, 'list_divisions', { includeInactive: true }),
          adminCRUD(token, 'list_fields', { includeInactive: true })
        ]);
        
        if (estRes.success && divRes.success && fldRes.success) {
          setEstates(estRes.estates || []);
          setDivisions(divRes.divisions || []);
          setFields(fldRes.fields || []);
          setConfigLoaded(true);

          // Fetch census field IDs for Measurements Tab dropdown filtering
          try {
            const summaryRes = await adminCRUD(token, 'get_summary', {});
            if (summaryRes.success && summaryRes.fields_with_census_ids) {
              setFieldsWithCensusIds(new Set(summaryRes.fields_with_census_ids));
            }
          } catch {
            // Non-critical: if this fails, show all fields (no filtering)
          }
        } else {
          setError('Failed to load full configuration. Session may have expired.');
          await supabase.auth.signOut();
        }
      } catch (err) {
        setError(`Failed to fetch config: ${err.message}`);
      }
    };

    if (token && !configLoaded) {
      fetchConfig();
    }
  }, [token, configLoaded]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState(null, '', url);
  }, [activeTab]);

  const handleEstateChange = (val) => {
    setSelectedEstateId(val);
    setDivisionFilterId('');
    setFieldNoFilterId('');
    setSelectedMeasurement(null);
  };

  const handleDivisionChange = (val) => {
    setDivisionFilterId(val);
    setFieldNoFilterId('');
    setSelectedMeasurement(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      if (data.session) {
        setToken(data.session.access_token);
      }
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setToken(null);
    setMeasurements([]);
    setConfigLoaded(false);
  };

  const handleAuthError = useCallback(async (msg) => {
    setError(msg || 'Session expired. Please log in again.');
    await supabase.auth.signOut();
  }, []);

  // Fetch role once after login/session-restore
  useEffect(() => {
    const fetchWhoAmI = async () => {
      try {
        const { adminCRUD } = await import('../services/supabaseSync');
        const data = await adminCRUD(token, 'whoami', {});
        setMyRole(data.role);
        setMyCanInviteUsers(data.canInviteUsers === true);
        setMyEstateIds(data.estateIds || []);
        setSuperAdmins(data.superAdmins || []);
      } catch (err) {
        if (err.message && err.message.includes('Invalid or expired')) {
          handleAuthError(err.message);
        } else {
          setError('Failed to determine your access level. Please refresh or contact your SuperAdmin.');
        }
      }
    };
    if (token && !myRole) fetchWhoAmI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, myRole]);

  // Re-validate active tab when role resolves
  useEffect(() => {
    if (!myRole) return;
    const permittedTabs = myRole === 'superadmin'
      ? VALID_TABS
      : ['overview', 'measurements', 'devices', 'qrcodes'];
    if (!permittedTabs.includes(activeTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRole]);

  const loadData = async () => {
    setLoadingData(true);
    setError('');
    
    const requestId = ++latestMeasurementRequestRef.current;

    try {
      const data = await fetchAdminMeasurements(token, {
        estate_id: selectedEstateId,
        division_id: divisionFilterId,
        field_id: fieldNoFilterId,
        dateFrom,
        dateTo,
        status: statusFilter
      });

      if (requestId !== latestMeasurementRequestRef.current) {
        return;
      }

      if (data.success) {
        setMeasurements(data.measurements || []);
      } else {
        handleAuthError(data.error);
      }
    } catch (err) {
      if (requestId !== latestMeasurementRequestRef.current) {
        return;
      }
      if (err.message.includes('Invalid or expired')) {
        handleAuthError(err.message);
      } else {
        setError(`Failed to load measurements: ${err.message}`);
      }
    } finally {
      if (requestId === latestMeasurementRequestRef.current) {
        setLoadingData(false);
      }
    }
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!selectedEstateId || !fieldNoFilterId) {
      setError('You must select an Estate and a Field No to export.');
      return;
    }
    
    const est = estates.find(e => e.id === selectedEstateId);
    const fld = fields.find(f => f.id === fieldNoFilterId);
    const div = divisions.find(d => d.id === divisionFilterId);

    if (!window.confirm(`Export data for Field ${fld?.field_code} in Estate ${est?.name} to its mapped Google Sheet? New rows will be added after existing data.`)) {
      return;
    }

    const exportRequestId = `EXP-REQ-${crypto.randomUUID()}`;

    setExporting(true);
    setError('');
    setSuccessMessage('');
    try {
      const result = await triggerAdminExport(token, {
        estate_id: selectedEstateId,
        estate: est?.name || est?.code,
        division_id: divisionFilterId,
        division: div?.name || div?.code,
        field_id: fieldNoFilterId,
        fieldNo: fld?.field_code,
        dateFrom,
        dateTo,
        export_request_id: exportRequestId
      });
      
      if (result.success) {
        const msg = result.message || `Export successful! ${result.exportedCount || result.rowCount || 0} records exported to Google Sheets.`;
        setSuccessMessage(msg);
        alert(msg);
        // Reload to show exportedAt tags
        await loadData();
      }
    } catch (err) {
      if (err.message.includes('Invalid or expired')) {
        handleAuthError(err.message);
      } else {
        setError(`Export failed: ${err.message}`);
      }
    } finally {
      setExporting(false);
    }
  };

  if (!authInitialized) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!token) {
    return (
      <div className="admin-login-page">
        <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
          <Lock size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
          <h1 style={{ margin: '0 0 0.5rem 0' }}>GirthTracker Admin</h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>Restricted access - Sign in to continue</p>
          
          {error && (
            <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '1rem' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <input
                type="email"
                placeholder="Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                style={{ textAlign: 'center', fontSize: '1rem' }}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ textAlign: 'center', fontSize: '1rem' }}
                required
              />
            </div>
            <button type="submit" className="btn" disabled={verifying} style={{ marginTop: '1rem', minHeight: '44px' }}>
              {verifying ? <RefreshCw className="pulse" size={20} /> : <Unlock size={20} />}
              {verifying ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard calculations
  const totalLoaded = measurements.length;
  const gpsTagged = measurements.filter(m => m.latitude && m.longitude).length;
  const tappable = measurements.filter(m => getStatus(m).includes('tappable')).length;
  const approaching = measurements.filter(m => getStatus(m).includes('approaching')).length;
  const below = measurements.filter(m => getStatus(m).includes('not ready') || getStatus(m).includes('below')).length;
  const abnormal = measurements.filter(m => isAbnormal(m)).length;



  const ALL_TABS = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'measurements', label: 'Measurements', icon: <Database size={16} /> },
    { id: 'devices', label: 'Devices', icon: <Smartphone size={16} /> },
    { id: 'config', label: 'Configuration', icon: <Settings2 size={16} /> },
    { id: 'qrcodes', label: 'QR Codes', icon: <QrCode size={16} /> },
    { id: 'users', label: 'Users', icon: <Users size={16} /> },
  ];

  const tabs = myRole === 'superadmin'
    ? ALL_TABS
    : ALL_TABS.filter(t => ['overview', 'measurements', 'devices', 'qrcodes'].includes(t.id));

  return (
    <div className="admin-page">
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'clamp(1rem, 4vw, 1.25rem)' }}>
          <Database size={24} color="var(--accent-primary)" /> Admin Dashboard
        </h2>
        <button className="btn btn-secondary" onClick={handleLogout} style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem', minHeight: '36px' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {error && (
        <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {successMessage && (
        <div className="warning-banner" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#2e7d32', borderColor: '#4caf50', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={16} color="#2e7d32" /> {successMessage}
          </span>
          <button onClick={() => setSuccessMessage('')} style={{ background: 'none', border: 'none', color: '#2e7d32', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* Tab Navigation - scrollable on mobile */}
      <div className="admin-tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab-btn ${activeTab === tab.id ? 'admin-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} <span className="admin-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Empty-scope warning for Admin/Manager with no assigned estates */}
      {myRole && myRole !== 'superadmin' && myEstateIds.length === 0 && (
        <div className="warning-banner" style={{background: 'rgba(245, 158, 11, 0.15)', borderColor: 'var(--accent-pending)', color: 'var(--accent-pending)' }}>
          <AlertTriangle size={16} /> No estates are assigned to your account yet. Contact your SuperAdmin.
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <SummaryTab token={token} onAuthError={handleAuthError} onSelectField={setSelectedFieldForDrilldown} />
      )}


      {/* Measurements Tab */}
      {activeTab === 'measurements' && (
        <>
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div className="input-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label>Estate</label>
                <select value={selectedEstateId} onChange={(e) => handleEstateChange(e.target.value)}>
                  <option value="">All Estates</option>
                  {estates.map(est => <option key={est.id} value={est.id}>{est.name} {!est.active && '(Inactive)'}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 120px' }}>
                <label>Division</label>
                <select value={divisionFilterId} onChange={(e) => handleDivisionChange(e.target.value)} disabled={!selectedEstateId}>
                  <option value="">All Divisions</option>
                  {divisions.filter(d => d.estate_id === selectedEstateId).map(div => (
                    <option key={div.id} value={div.id}>{div.name} {!div.active && '(Inactive)'}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 120px' }}>
                <label>Field No</label>
                <select value={fieldNoFilterId} onChange={(e) => setFieldNoFilterId(e.target.value)} disabled={!divisionFilterId}>
                  <option value="">All Fields</option>
                  {fields.filter(f => f.division_id === divisionFilterId && (!fieldsWithCensusIds || fieldsWithCensusIds.has(f.id))).map(fld => (
                    <option key={fld.id} value={fld.id}>{fld.field_code} {!fld.active && '(Inactive)'}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 150px' }}>
                <label>Status Filter</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="tappable">Tappable</option>
                  <option value="approaching">Approaching</option>
                  <option value="below">Below Threshold</option>
                  <option value="abnormal">Abnormal Only</option>
                </select>
              </div>
            </div>
            <div className="input-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '1rem' }}>
              <div className="form-group" style={{ flex: '1 1 150px' }}>
                <label>Date From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: '1 1 150px' }}>
                <label>Date To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <button className="btn" onClick={loadData} disabled={loadingData} style={{ flex: '0 0 auto', width: 'auto', marginBottom: '0.3rem' }}>
                {loadingData ? <RefreshCw className="pulse" size={20} /> : <Database size={20} />}
                {loadingData ? 'Loading...' : 'Load Data'}
              </button>
              <button 
                className="btn" 
                onClick={handleExport} 
                disabled={exporting || !selectedEstateId || !fieldNoFilterId} 
                style={{ 
                  flex: '0 0 auto', 
                  width: 'auto', 
                  marginBottom: '0.3rem', 
                  marginLeft: '0.5rem', 
                  background: (!selectedEstateId || !fieldNoFilterId) ? undefined : 'var(--success)', 
                  color: (!selectedEstateId || !fieldNoFilterId) ? undefined : '#fff' 
                }}
              >
                {exporting ? <RefreshCw className="pulse" size={20} /> : <Download size={20} />}
                {exporting ? 'Exporting...' : 'Export Field to Sheet'}
              </button>
              {measurements.length > 0 && (
                <button className="btn btn-secondary" onClick={() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style={{ flex: '0 0 auto', width: 'auto', marginBottom: '0.3rem', marginLeft: '0.5rem' }}>
                  View Map
                </button>
              )}
            </div>
          </div>

          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <div className="stat-box">
              <div className="text-muted">Total Loaded</div>
              <div className="stat-value">{totalLoaded}</div>
            </div>
            <div className="stat-box">
              <div className="text-muted">GPS Tagged</div>
              <div className="stat-value">{gpsTagged}</div>
            </div>
            <div className="stat-box">
              <div className="text-muted" style={{ color: '#4caf50' }}>Tappable</div>
              <div className="stat-value" style={{ color: '#4caf50' }}>{tappable}</div>
            </div>
            <div className="stat-box">
              <div className="text-muted" style={{ color: '#ff9800' }}>Approaching</div>
              <div className="stat-value" style={{ color: '#ff9800' }}>{approaching}</div>
            </div>
            <div className="stat-box">
              <div className="text-muted" style={{ color: '#f44336' }}>Below</div>
              <div className="stat-value" style={{ color: '#f44336' }}>{below}</div>
            </div>
            <div
              className="stat-box stat-box-clickable"
              onClick={() => abnormal > 0 && setShowAbnormalModal(true)}
              title={abnormal > 0 ? 'Click to view abnormal trees' : 'No abnormal trees'}
              style={{ cursor: abnormal > 0 ? 'pointer' : 'default', position: 'relative' }}
            >
              <div className="text-muted" style={{ color: '#9c27b0' }}>Abnormal</div>
              <div className="stat-value" style={{ color: '#9c27b0' }}>{abnormal}</div>
              {abnormal > 0 && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Tap to view</div>
              )}
            </div>
          </div>

          {/* Girth Census Summary */}
          {censusSummaryData.rows.length > 0 && (
            <div className="glass-card" style={{ padding: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart3 size={16} /> Girth Census Summary ({censusSummaryData.rows.length} {censusSummaryData.rows.length === 1 ? 'Field' : 'Fields'})
                </h4>
                <button
                  className="btn"
                  onClick={handleDownloadGirthCensusExcel}
                  disabled={downloadingExcel}
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: '#2e7d32', color: '#fff' }}
                >
                  {downloadingExcel ? <RefreshCw className="pulse" size={14} /> : <Download size={14} />}
                  {downloadingExcel ? ' Preparing Excel...' : ' Download Summary Excel (.xlsx)'}
                </button>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, zIndex: 2, background: '#8ea9db', color: '#000' }}>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'left', whiteSpace: 'nowrap' }}>Estate Name</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'left', whiteSpace: 'nowrap' }}>Division</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'left', whiteSpace: 'nowrap' }}>Field No</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>Extent</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'center', whiteSpace: 'nowrap' }}>YOP</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'center', whiteSpace: 'nowrap' }}>Up keep Year (1st/2nd)</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'center', whiteSpace: 'nowrap' }}>Census Completed Date</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>Less than 4"</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>4" - 7.9"</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>8" - 9.9"</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>10" - 11.9"</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>12" - 13.9"</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>14" - 15.9"</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>16" - 17.9"</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>18" - 19.9"</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>20" or more</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>Total Plants</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>SPH</th>
                      <th style={{ padding: '0.5rem', border: '1px solid #7092be', textAlign: 'right', whiteSpace: 'nowrap' }}>Above 20" Tree %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {censusSummaryData.rows.map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{r.estateName}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{r.divisionName}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.fieldNo}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.extent || '-'}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>{r.yop !== null ? r.yop : '-'}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>{r.upkeepYear || '-'}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center', whiteSpace: 'nowrap' }}>{r.censusDate}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.lessThan4 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.band4to7_9 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.band8to9_9 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.band10to11_9 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.band12to13_9 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.band14to15_9 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.band16to17_9 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.band18to19_9 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.over20 || ''}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 600 }}>{r.totalPlants}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right' }}>{r.sph}</td>
                        <td style={{ padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 600 }}>{r.above20Pct}%</td>
                      </tr>
                    ))}
                    {/* Totals row - Bold text & borders, NO fill */}
                    {censusSummaryData.totals && (
                      <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--text-main)', borderBottom: '2px solid var(--text-main)' }}>
                        <td colSpan={3} style={{ padding: '0.5rem', textAlign: 'left' }}>Total</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.extent ? censusSummaryData.totals.extent.toFixed(2) : '0'}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.lessThan4 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.band4to7_9 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.band8to9_9 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.band10to11_9 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.band12to13_9 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.band14to15_9 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.band16to17_9 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.band18to19_9 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.over20 || ''}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.totalPlants}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.sph}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{censusSummaryData.totals.above20Pct}%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <AdminMap measurements={mapMeasurements} filter={statusFilter} mapRef={mapRef} />
        </>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <>
          {myRole !== 'superadmin' && (
            <div className="warning-banner" style={{ background: 'rgba(23, 118, 210, 0.1)', color: '#1776d2', borderColor: '#1776d2', marginBottom: '1rem' }}>
              <AlertTriangle size={16} /> Contact {superAdmins.length > 0 ? superAdmins.map(n => `Mr.${n}`).join(' or ') : 'your SuperAdmin'} for device approval.
            </div>
          )}
          <PendingRequestsSection token={token} myRole={myRole} onAuthError={handleAuthError} />
          <DevicesTab token={token} myRole={myRole} onAuthError={handleAuthError} />
        </>
      )}
      
      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <AdminConfigTab token={token} />
      )}

      {/* QR Codes Tab */}
      {activeTab === 'qrcodes' && (
        <QRCodesTab estates={estates} divisions={divisions} fields={fields} />
      )}

      {/* Users Tab (SuperAdmin only - double-gated) */}
      {activeTab === 'users' && myRole === 'superadmin' && (
        <UsersTab token={token} canInviteUsers={myCanInviteUsers} onAuthError={handleAuthError} />
      )}

      {/* Detail Drilldown Panel */}
      {selectedFieldForDrilldown && (
        <FieldDrilldown
          token={token}
          field={selectedFieldForDrilldown}
          measurements={measurements}
          onClose={() => setSelectedFieldForDrilldown(null)}
          onAuthError={handleAuthError}
        />
      )}

      {/* Abnormal Trees Modal */}
      {showAbnormalModal && (
        <AbnormalTreesModal
          measurements={measurements}
          estates={estates}
          divisions={divisions}
          fields={fields}
          onClose={() => setShowAbnormalModal(false)}
        />
      )}


    </div>
  );
}

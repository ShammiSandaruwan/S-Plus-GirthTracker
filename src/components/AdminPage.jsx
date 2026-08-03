import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Unlock, Map as MapIcon, RefreshCw, LogOut, Database, AlertTriangle, Smartphone, QrCode, ShieldOff, Shield, Download, BarChart3, CheckCircle2, XCircle, Clock, User } from 'lucide-react';
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
import { Settings2 } from 'lucide-react';

function AdminMap({ measurements, filter, mapRef }) {
  const [showAccuracy, setShowAccuracy] = useState(false);

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
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Summary Tab (Overview)
// ----------------------------------------------------
function SummaryTab({ token, onAuthError }) {
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
        setFieldDetails(data.field_details || []);
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
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Extent</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Recorded</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Last Tree #</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Last Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldDetails.map((f, i) => (
                          <tr key={f.field_id || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.4rem 0.5rem' }}>{f.estate_name}</td>
                            <td style={{ padding: '0.4rem 0.5rem' }}>{f.division_name}</td>
                            <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>{f.field_code}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{f.extent || '-'}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{f.total}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{f.last_tree_no}</td>
                            <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.78rem' }}>{formatDate(f.last_recorded)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile cards */}
                <div className="admin-table-mobile">
                  {fieldDetails.map((f, i) => (
                    <div key={f.field_id || i} className="admin-field-card">
                      <div className="admin-field-card-header">
                        <span style={{ fontWeight: 700 }}>{f.field_code}</span>
                        <span className="admin-field-card-badge" style={{ background: 'rgba(76,175,80,0.15)', color: '#4caf50' }}>
                          {f.total} trees
                        </span>
                      </div>
                      <div className="admin-field-card-meta">{f.estate_name} / {f.division_name}</div>
                      <div className="admin-field-card-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Extent: <span style={{ color: 'var(--text-color)' }}>{f.extent || '-'}</span></div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Last Tree: <span style={{ color: 'var(--text-color)' }}>{f.last_tree_no}</span></div>
                        <div className="text-muted" style={{ fontSize: '0.75rem', gridColumn: 'span 2' }}>Last Rec: <span style={{ color: 'var(--text-color)' }}>{formatDate(f.last_recorded)}</span></div>
                      </div>
                    </div>
                  ))}
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
function PendingRequestsSection({ token, onAuthError }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Actions</th>
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
function DevicesTab({ token, onAuthError }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [error, setError] = useState('');

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'list_devices', { cacheBust: Date.now() });
      if (data.success) {
        // Map snake_case to camelCase
        const mappedDevices = (data.devices || []).map(d => ({
           deviceIdHash: d.device_id_hash,
           estate: d.estate_code,
           operatorName: d.operator_name,
           approvedAt: d.approved_at,
           lastSeenAt: d.last_seen_at,
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

  const formatDate = (val) => {
    if (!val) return '-';
    try { return new Date(val).toLocaleString(); } catch { return String(val); }
  };

  const activeDevices = devices.filter(d => d.revoked !== true && d.revoked !== 'true');
  const revokedDevices = devices.filter(d => d.revoked === true || d.revoked === 'true');

  return (
    <>
      {error && (
        <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} color="#4caf50" /> Active Devices ({activeDevices.length})
          </h3>
          <div style={{display: 'flex', gap: '0.5rem'}}>
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
            <button className="btn btn-secondary" onClick={loadDevices} disabled={loading} style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
              {loading ? <RefreshCw className="pulse" size={14} /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
        </div>

        {loading && devices.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>Loading devices...</div>
        ) : activeDevices.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>No active devices.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Operator</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Estate</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Approved</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Last Seen</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeDevices.map((d, i) => (
                  <tr key={d.deviceIdHash || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem' }}>{d.operatorName || '-'}</td>
                    <td style={{ padding: '0.5rem' }}>{d.estate || '-'}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{formatDate(d.approvedAt)}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{formatDate(d.lastSeenAt)}</td>
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
              <tbody>
                {revokedDevices.map((d, i) => (
                  <tr key={d.deviceIdHash || i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.4rem' }}>{d.operatorName || '-'}</td>
                    <td style={{ padding: '0.4rem' }}>{d.estate || '-'}</td>
                    <td style={{ padding: '0.4rem', color: '#f44336' }}>Revoked</td>
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

  const [activeTab, setActiveTab] = useState('overview');
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
  const mapRef = useRef(null);

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

  const handleEstateChange = (val) => {
    setSelectedEstateId(val);
    setDivisionFilterId('');
    setFieldNoFilterId('');
  };

  const handleDivisionChange = (val) => {
    setDivisionFilterId(val);
    setFieldNoFilterId('');
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

  const loadData = async () => {
    setLoadingData(true);
    setError('');
    try {
      const data = await fetchAdminMeasurements(token, {
        estate_id: selectedEstateId,
        division_id: divisionFilterId,
        field_id: fieldNoFilterId,
        dateFrom,
        dateTo,
        status: statusFilter
      });
      if (data.success) {
        setMeasurements(data.measurements || []);
      } else {
        handleAuthError(data.error);
      }
    } catch (err) {
      if (err.message.includes('Invalid or expired')) {
        handleAuthError(err.message);
      } else {
        setError(`Failed to load measurements: ${err.message}`);
      }
    } finally {
      setLoadingData(false);
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'measurements', label: 'Measurements', icon: <Database size={16} /> },
    { id: 'devices', label: 'Devices', icon: <Smartphone size={16} /> },
    { id: 'config', label: 'Configuration', icon: <Settings2 size={16} /> },
    { id: 'qrcodes', label: 'QR Codes', icon: <QrCode size={16} /> },
  ];

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

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <SummaryTab token={token} onAuthError={handleAuthError} />
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
                  {fields.filter(f => f.division_id === divisionFilterId).map(fld => (
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
            <div className="stat-box">
              <div className="text-muted" style={{ color: '#9c27b0' }}>Abnormal</div>
              <div className="stat-value" style={{ color: '#9c27b0' }}>{abnormal}</div>
            </div>
          </div>

          <AdminMap measurements={measurements} filter={statusFilter} mapRef={mapRef} />
        </>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <>
          <PendingRequestsSection token={token} onAuthError={handleAuthError} />
          <DevicesTab token={token} onAuthError={handleAuthError} />
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
    </div>
  );
}

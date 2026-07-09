import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Unlock, Map as MapIcon, RefreshCw, LogOut, Database, AlertTriangle, Smartphone, QrCode, ShieldOff, Shield, Download } from 'lucide-react';
import QRCode from 'qrcode';
import 'leaflet/dist/leaflet.css';

const GAS_URL = import.meta.env.VITE_GAS_URL || '';

function getStatus(m) {
  return String(m.recommendationText || '').toLowerCase();
}

function isAbnormal(m) {
  return m.abnormalFlag === true || m.abnormalFlag === 1 || m.abnormalFlag === 'Yes' || m.abnormalFlag === 'true';
}

import MeasurementMap from './MeasurementMap';

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
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'admin_list_devices', adminSessionToken: token }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices || []);
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
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'admin_revoke_device', adminSessionToken: token, deviceIdHash }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const data = await res.json();
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
    if (!val) return '—';
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} color="#4caf50" /> Active Devices ({activeDevices.length})
          </h3>
          <button className="btn btn-secondary" onClick={loadDevices} disabled={loading} style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
            {loading ? <RefreshCw className="pulse" size={14} /> : <RefreshCw size={14} />} Refresh
          </button>
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
                    <td style={{ padding: '0.5rem' }}>{d.operatorName || '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{d.estate || '—'}</td>
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
                    <td style={{ padding: '0.4rem' }}>{d.operatorName || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{d.estate || '—'}</td>
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
function QRCodesTab({ estates }) {
  const canvasRef = useRef(null);
  const [qrEstate, setQrEstate] = useState(estates[0] || '');
  const [qrDivision, setQrDivision] = useState('');
  const [qrField, setQrField] = useState('');
  const [qrExtent, setQrExtent] = useState('');
  const [qrStartTree, setQrStartTree] = useState('1');
  const [qrUrl, setQrUrl] = useState('');

  const doGenerateQR = useCallback(async () => {
    if (!qrEstate || !qrField) {
      setQrUrl('');
      return;
    }
    const base = window.location.origin;
    const params = new URLSearchParams();
    params.set('estate', qrEstate);
    if (qrDivision) params.set('division', qrDivision);
    params.set('field', qrField);
    if (qrExtent) params.set('extent', qrExtent);
    if (qrStartTree && qrStartTree !== '1') params.set('tree', qrStartTree);

    const url = `${base}/?${params.toString()}`;
    setQrUrl(url);

    if (canvasRef.current) {
      try {
        await QRCode.toCanvas(canvasRef.current, url, {
          width: 220,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } catch {
        // QR generation failed silently
      }
    }
  }, [qrEstate, qrDivision, qrField, qrExtent, qrStartTree]);

  useEffect(() => {
    const run = async () => {
      await doGenerateQR();
    };
    run();
  }, [doGenerateQR]);

  const downloadQR = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `QR_${qrEstate}_${qrField}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <QrCode size={18} /> Generate Field QR Code
      </h3>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Field workers scan this QR to pre-fill their setup screen instantly.
      </p>

      <div className="input-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 180px' }}>
          <label>Estate *</label>
          <select value={qrEstate} onChange={(e) => setQrEstate(e.target.value)}>
            <option value="">Select Estate...</option>
            {estates.map(est => <option key={est} value={est}>{est}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: '1 1 120px' }}>
          <label>Division</label>
          <input type="text" placeholder="Optional" value={qrDivision} onChange={(e) => setQrDivision(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: '1 1 100px' }}>
          <label>Field No *</label>
          <input type="text" placeholder="e.g. F01" value={qrField} onChange={(e) => setQrField(e.target.value)} required />
        </div>
      </div>
      <div className="input-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '0.5rem' }}>
        <div className="form-group" style={{ flex: '1 1 120px' }}>
          <label>Extent (Ha)</label>
          <input type="number" step="0.01" placeholder="Optional" value={qrExtent} onChange={(e) => setQrExtent(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: '1 1 120px' }}>
          <label>Start Tree</label>
          <input type="number" min="1" value={qrStartTree} onChange={(e) => setQrStartTree(e.target.value)} />
        </div>
      </div>

      {qrEstate && qrField && (
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
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_session_token') || null);
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('measurements');
  const [estates, setEstates] = useState([]);
  const [selectedEstate, setSelectedEstate] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [fieldNoFilter, setFieldNoFilter] = useState('');
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
    const fetchEstates = async () => {
      try {
        const res = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'admin_list_estates', adminSessionToken: token }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        });
        const data = await res.json();
        if (data.success) {
          setEstates(data.estates || []);
          if (data.estates && data.estates.length > 0) {
            setSelectedEstate(data.estates[0]);
          }
        } else {
          setError(data.error || 'Session expired. Please log in again.');
          sessionStorage.removeItem('admin_session_token');
          setToken(null);
          setMeasurements([]);
          setTotpCode('');
        }
      } catch {
        setError('Failed to fetch estates.');
      }
    };

    if (token && estates.length === 0) {
      fetchEstates();
    }
  }, [token, estates.length]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'admin_verify_totp', code: totpCode }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.adminSessionToken);
        sessionStorage.setItem('admin_session_token', data.adminSessionToken);
      } else {
        setError(data.error || 'Verification failed.');
      }
    } catch {
      setError('Network error. Could not verify.');
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_session_token');
    setToken(null);
    setMeasurements([]);
    setTotpCode('');
  };

  const handleAuthError = useCallback((msg) => {
    setError(msg || 'Session expired. Please log in again.');
    handleLogout();
  }, []);

  const loadData = async () => {
    if (!selectedEstate) return;
    setLoadingData(true);
    setError('');
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'admin_fetch_measurements',
          adminSessionToken: token,
          estate: selectedEstate,
          division: divisionFilter,
          fieldNo: fieldNoFilter,
          dateFrom,
          dateTo,
          status: statusFilter
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const data = await res.json();
      if (data.success) {
        setMeasurements(data.measurements || []);
      } else {
        handleAuthError(data.error);
      }
    } catch {
      setError('Failed to load measurements.');
    } finally {
      setLoadingData(false);
    }
  };

  if (!token) {
    return (
      <div className="admin-login-page">
        <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', textAlign: 'center' }}>
          <Lock size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
          <h1 style={{ margin: '0 0 0.5rem 0' }}>GirthTracker Admin</h1>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>Restricted access</p>
          
          {error && (
            <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '1rem' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleVerify}>
            <div className="form-group">
              <input
                type="text"
                placeholder="6-digit Authenticator Code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                maxLength={6}
                pattern="\d*"
                style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2rem' }}
                required
              />
            </div>
            <button type="submit" className="btn" disabled={verifying} style={{ marginTop: '1rem' }}>
              {verifying ? <RefreshCw className="pulse" size={20} /> : <Unlock size={20} />}
              {verifying ? 'Verifying...' : 'Verify'}
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
    { id: 'measurements', label: 'Measurements', icon: <Database size={16} /> },
    { id: 'devices', label: 'Devices', icon: <Smartphone size={16} /> },
    { id: 'qrcodes', label: 'QR Codes', icon: <QrCode size={16} /> },
  ];

  return (
    <div className="admin-page">
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={24} color="var(--accent-primary)" /> Admin Dashboard
        </h2>
        <button className="btn btn-secondary" onClick={handleLogout} style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      {error && (
        <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '1rem' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--bg-card)', borderRadius: '8px', padding: '0.25rem', border: '1px solid var(--glass-border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? '' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, padding: '0.5rem 0.3rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', borderRadius: '6px' }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Measurements Tab */}
      {activeTab === 'measurements' && (
        <>
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div className="input-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 200px' }}>
                <label>Estate</label>
                <select value={selectedEstate} onChange={(e) => setSelectedEstate(e.target.value)}>
                  <option value="">Select Estate...</option>
                  {estates.map(est => <option key={est} value={est}>{est}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: '1 1 120px' }}>
                <label>Division</label>
                <input type="text" placeholder="Optional" value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: '1 1 120px' }}>
                <label>Field No</label>
                <input type="text" placeholder="Optional" value={fieldNoFilter} onChange={(e) => setFieldNoFilter(e.target.value)} />
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
              <button className="btn" onClick={loadData} disabled={loadingData || !selectedEstate} style={{ flex: '0 0 auto', width: 'auto', marginBottom: '0.3rem' }}>
                {loadingData ? <RefreshCw className="pulse" size={20} /> : <Database size={20} />}
                {loadingData ? 'Loading...' : 'Load Data'}
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
        <DevicesTab token={token} onAuthError={handleAuthError} />
      )}

      {/* QR Codes Tab */}
      {activeTab === 'qrcodes' && (
        <QRCodesTab estates={estates} />
      )}
    </div>
  );
}

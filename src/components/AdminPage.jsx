import { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, Map as MapIcon, RefreshCw, LogOut, Database, AlertTriangle } from 'lucide-react';
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

export default function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_session_token') || null);
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

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

  const handleAuthError = (msg) => {
    setError(msg || 'Session expired. Please log in again.');
    handleLogout();
  };

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
    </div>
  );
}

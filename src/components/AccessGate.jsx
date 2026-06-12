import { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, MapPin, Loader, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  getOrCreateDeviceId,
  getLocalAccessStatus,
  saveAccessStatus,
  requestAccess,
  checkAccessStatus,
  isTokenExpired,
} from '../services/accessControl';
import { captureGPS, getLocationStatusText } from '../services/location';

const ESTATES = import.meta.env.VITE_ESTATES
  ?.split(',')
  .map(s => s.trim())
  .filter(Boolean) || [];

const REQUIRE_GPS = String(import.meta.env.VITE_REQUIRE_GPS_FOR_APPROVAL).trim().toLowerCase() === 'true';

/**
 * AccessGate component — shown before the normal app when access approval is required.
 * States: loading, not_requested, requesting, pending, approved, denied, error, offline_blocked
 */
export default function AccessGate({ onApproved }) {
  const [state, setState] = useState('loading');
  const [estate, setEstate] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [requestTime, setRequestTime] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [telegramWarning, setTelegramWarning] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const checkingRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const captureLocation = async () => {
    setLocationStatus('capturing');
    const result = await captureGPS();
    setLocation(result);
    setLocationStatus(result.status);
  };

  useEffect(() => {
    const init = async () => {
      const id = await getOrCreateDeviceId();
      setDeviceId(id);

      const local = await getLocalAccessStatus();

      if (local.accessStatus === 'approved' && local.deviceToken) {
        if (!isTokenExpired(local.expiresAt)) {
          onApproved({
            estate: local.estate,
            operatorName: local.operatorName,
            deviceToken: local.deviceToken,
            deviceId: id,
          });
          return;
        }
        await saveAccessStatus({ accessStatus: null, deviceToken: null });
      }

      if (local.accessStatus === 'pending' && local.requestId) {
        setEstate(local.estate || '');
        setOperatorName(local.operatorName || '');
        setRequestId(local.requestId);
        setState('pending');
        return;
      }

      if (local.accessStatus === 'denied') {
        setEstate(local.estate || '');
        setOperatorName(local.operatorName || '');
        setState('denied');
        return;
      }

      setState('not_requested');
      captureLocation();
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!estate || !operatorName.trim()) return;

    if (REQUIRE_GPS && (!location || location.status !== 'captured')) {
      setErrorMessage('GPS location is required for access approval. Please enable location services and retry.');
      return;
    }

    if (!isOnline) {
      setState('offline_blocked');
      return;
    }

    setState('requesting');
    setErrorMessage('');
    setTelegramWarning('');

    try {
      const result = await requestAccess({
        estate,
        operatorName: operatorName.trim(),
        deviceId,
        location,
      });

      if (result.success) {
        const rid = result.requestId;
        setRequestId(rid);
        setRequestTime(new Date().toISOString());

        await saveAccessStatus({
          accessStatus: 'pending',
          requestId: rid,
          estate,
          operatorName: operatorName.trim(),
        });

        if (result.telegramStatus === 'failed') {
          setTelegramWarning('Request saved, but admin Telegram notification failed. Please contact administrator.');
        }

        setState('pending');
      } else {
        setErrorMessage(result.error || 'Failed to submit access request.');
        setState('error');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error. Please check your connection.');
      setState('error');
    }
  };

  const handleCheckStatus = useCallback(async () => {
    if (!requestId || !deviceId) return;

    if (!isOnline) {
      setErrorMessage('Internet connection is required to check approval status.');
      return;
    }

    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setErrorMessage('');

    try {
      const result = await checkAccessStatus(requestId, deviceId);

      if (result.success) {
        if (result.status === 'approved') {
          await saveAccessStatus({
            accessStatus: 'approved',
            deviceToken: result.deviceToken,
            estate: result.estate || estate,
            operatorName: result.operatorName || operatorName,
            approvedAt: result.approvedAt,
            expiresAt: result.expiresAt,
          });
          onApproved({
            estate: result.estate || estate,
            operatorName: result.operatorName || operatorName,
            deviceToken: result.deviceToken,
            deviceId,
          });
          return;
        }
        if (result.status === 'denied') {
          await saveAccessStatus({ accessStatus: 'denied' });
          setState('denied');
          return;
        }
        // still pending
      } else {
        setErrorMessage(result.error || 'Failed to check status.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error.');
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [requestId, deviceId, isOnline, estate, operatorName, onApproved]);

  useEffect(() => {
    if (state !== 'pending' || !isOnline || !requestId || !deviceId) return;

    const interval = setInterval(() => {
      handleCheckStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [state, isOnline, requestId, deviceId, handleCheckStatus]);

  const handleRetry = () => {
    setState('not_requested');
    setErrorMessage('');
    setTelegramWarning('');
  };

  if (ESTATES.length === 0) {
    return (
      <div className="app-container access-gate-container">
        <div className="glass-card access-gate-card">
          <AlertTriangle size={36} color="var(--accent-danger)" />
          <h1 className="access-gate-title">Configuration Error</h1>
          <p className="access-gate-message">Estate list is not configured. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="app-container access-gate-container">
        <div className="glass-card access-gate-card">
          <Loader size={24} className="pulse" />
          <div>Checking access status...</div>
        </div>
      </div>
    );
  }

  if (state === 'offline_blocked') {
    return (
      <div className="app-container access-gate-container">
        <div className="glass-card access-gate-card">
          <AlertTriangle size={36} color="var(--accent-pending)" />
          <h1 className="access-gate-title">No Internet Connection</h1>
          <p className="access-gate-message">
            Internet connection is required for first-time access approval. Please connect to the internet and try again.
          </p>
          <button className="btn" onClick={() => { if (navigator.onLine) setState('not_requested'); }} style={{ marginTop: '1rem' }}>
            <RefreshCw size={18} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="app-container access-gate-container">
        <div className="glass-card access-gate-card">
          <div className="access-gate-icon-wrap pending-icon">
            <Loader size={28} className="pulse" />
          </div>
          <h1 className="access-gate-title">Approval Request Sent</h1>
          <p className="access-gate-message">
            Your access request has been sent for admin approval. You can continue after approval.
          </p>

          <div className="access-gate-details">
            <div className="detail-row"><span>Estate</span><span>{estate}</span></div>
            <div className="detail-row"><span>Operator Name</span><span>{operatorName}</span></div>
            {requestTime && (
              <div className="detail-row"><span>Request Sent</span><span>{new Date(requestTime).toLocaleString()}</span></div>
            )}
          </div>

          {telegramWarning && (
            <div className="warning-banner" style={{ marginTop: '1rem' }}>
              <AlertTriangle size={16} /> {telegramWarning}
            </div>
          )}

          {errorMessage && (
            <div className="warning-banner" style={{ marginTop: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }}>
              <AlertTriangle size={16} /> {errorMessage}
            </div>
          )}

          <button className="btn" onClick={handleCheckStatus} disabled={checking} style={{ marginTop: '1rem' }}>
            {checking ? <><Loader size={18} className="pulse" /> Checking...</> : <><RefreshCw size={18} /> Check Approval Status</>}
          </button>
        </div>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="app-container access-gate-container">
        <div className="glass-card access-gate-card">
          <div className="access-gate-icon-wrap denied-icon">
            <XCircle size={28} />
          </div>
          <h1 className="access-gate-title">Access Denied</h1>
          <p className="access-gate-message">
            Your access request has been denied. Please contact your administrator for further assistance.
          </p>
          <button className="btn" onClick={handleRetry} style={{ marginTop: '1rem' }}>
            <RefreshCw size={18} /> Send Request Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container access-gate-container">
      <div className="glass-card access-gate-card">
        <div className="access-gate-icon-wrap">
          <Shield size={28} />
        </div>
        <h1 className="access-gate-title">Access Approval Required</h1>
        <p className="access-gate-message">
          Access approval is required due to security reasons. Please select your estate and enter the operator name to request approval.
        </p>

        {(state === 'error' && errorMessage) && (
          <div className="warning-banner" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)' }}>
            <AlertTriangle size={16} /> {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Estate</label>
            <select required value={estate} onChange={(e) => setEstate(e.target.value)}>
              <option value="">Select Estate...</option>
              {ESTATES.map(est => <option key={est} value={est}>{est}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Operator Name</label>
            <input
              type="text"
              required
              placeholder="Enter operator name"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
            />
          </div>

          <div className="location-status-chip">
            <MapPin size={14} />
            <span>
              {locationStatus === 'capturing'
                ? 'Capturing location...'
                : getLocationStatusText(locationStatus || 'unavailable')}
            </span>
            {locationStatus !== 'captured' && locationStatus !== 'capturing' && (
              <button type="button" className="btn-link" onClick={captureLocation}>
                Retry Location
              </button>
            )}
          </div>

          <button
            type="submit"
            className="btn"
            disabled={state === 'requesting'}
            style={{ marginTop: '1rem' }}
          >
            {state === 'requesting'
              ? <><Loader size={18} className="pulse" /> Sending Request...</>
              : <><Shield size={18} /> Request Access Approval</>}
          </button>
        </form>
      </div>
    </div>
  );
}

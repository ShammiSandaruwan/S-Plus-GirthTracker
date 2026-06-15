import { useState, useEffect, useCallback, useRef } from 'react';
import { Bluetooth, Save, Settings2, Activity, Wifi, WifiOff, CloudUpload, RefreshCw, Download, Undo, Minus, Plus, FileSpreadsheet, Edit3, AlertTriangle, FileText, BarChart3, X } from 'lucide-react';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { parseCaliperBuffer, calculateGirth, escCsv, filterDisplayBuffer, MIN_READING, MAX_READING } from './utils';
import AccessGate from './components/AccessGate';
import SessionReport from './components/SessionReport';
import FieldInsightsModal from './components/FieldInsightsModal';
import { startBackgroundGPS, stopBackgroundGPS, getLastKnownLocation } from './services/location';
import { girthToCm, getRecommendation } from './services/recommendation';
import { checkAbnormal } from './services/analytics';
import AdminPage from './components/AdminPage';
import './index.css';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.2.0';
const GAS_URL = import.meta.env.VITE_GAS_URL || '';

const isEnvFlagEnabled = (value) => String(value).trim().toLowerCase() === 'true';
const IS_MAINTENANCE_MODE = isEnvFlagEnabled(import.meta.env.VITE_MAINTENANCE_MODE);
const IS_DISABLED_MODE = isEnvFlagEnabled(import.meta.env.VITE_DISABLED_MODE);
const REQUIRE_ACCESS_APPROVAL = isEnvFlagEnabled(import.meta.env.VITE_REQUIRE_ACCESS_APPROVAL);
const ENABLE_SESSION_REPORTS = isEnvFlagEnabled(import.meta.env.VITE_ENABLE_SESSION_REPORTS);
const SHOW_FIELD_INSIGHTS_BUTTON = isEnvFlagEnabled(import.meta.env.VITE_SHOW_FIELD_INSIGHTS_BUTTON);

function shouldOpenInsightsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('gt_insights') === '1';
}
const ENABLE_GPS_TAGGING = isEnvFlagEnabled(import.meta.env.VITE_ENABLE_GPS_TAGGING);

let audioCtx = null;
function playBeep(type = 'success') {
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.1);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.25);
    }
  } catch (e) {
    console.debug('Audio error:', e);
  }
}

// Parse estate list from environment
const ESTATES = import.meta.env.VITE_ESTATES
  ?.split(',')
  .map(s => s.trim())
  .filter(Boolean) || [];

function App() {
  const [accessApproved, setAccessApproved] = useState(!REQUIRE_ACCESS_APPROVAL);
  const [approvedData, setApprovedData] = useState(null);

  if (window.location.pathname === '/mod') {
    return <AdminPage />;
  }

  if (IS_DISABLED_MODE) {
    return (
      <ModeNotice
        title="Access Disabled"
        message="App access has been disabled due to security reasons. Please contact your administrator before using GirthTracker again."
        variant="danger"
      />
    );
  }

  if (IS_MAINTENANCE_MODE) {
    return (
      <ModeNotice
        title="Maintenance Mode"
        message="GirthTracker is temporarily unavailable while maintenance is in progress. Please try again later."
      />
    );
  }

  if (REQUIRE_ACCESS_APPROVAL && !accessApproved) {
    return (
      <AccessGate onApproved={(data) => {
        setApprovedData(data);
        setAccessApproved(true);
      }} />
    );
  }

  return <TrackerApp approvedData={approvedData} />;
}

function ModeNotice({ title, message, variant = 'warning' }) {
  const isDanger = variant === 'danger';

  return (
    <div className="app-container mode-notice-container">
      <div className={`glass-card mode-notice-card ${isDanger ? 'mode-notice-danger' : ''}`}>
        <AlertTriangle size={36} color={isDanger ? 'var(--accent-danger)' : 'var(--accent-pending)'} />
        <h1 className="mode-notice-title">{title}</h1>
        <p className="mode-notice-message">{message}</p>
      </div>
    </div>
  );
}

function TrackerApp({ approvedData }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [settings, setSettings] = useState({
    estate: '',
    division: '',
    fieldNo: '',
    extent: '',
    treeNo: 1,
    operatorName: '',
    deviceId: '',
    deviceToken: '',
    sessionId: '',
    sessionStartedAt: null,
    lastKnownLatitude: null,
    lastKnownLongitude: null,
    lastKnownGpsAccuracy: null,
    lastKnownGoogleMapLink: null,
    audioConfirmationEnabled: true,
  });
  
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  
  const bufferRef = useRef('');
  const [displayBuffer, setDisplayBuffer] = useState('');

  const [manualEntry, setManualEntry] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [undoConfirm, setUndoConfirm] = useState(false);
  const [refreshConfirm, setRefreshConfirm] = useState(false);
  const [setupConfirm, setSetupConfirm] = useState(false);
  const [rangeError, setRangeError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [authError, setAuthError] = useState('');
  const [abnormalWarning, setAbnormalWarning] = useState('');
  const [showSessionReport, setShowSessionReport] = useState(false);
  const [showFieldInsights, setShowFieldInsights] = useState(() => shouldOpenInsightsFromUrl());
  const [showNewFieldWizard, setShowNewFieldWizard] = useState(false);
  const [newFieldData, setNewFieldData] = useState({ division: '', fieldNo: '', extent: '', treeNo: 1 });

  const openNewFieldWizard = () => {
    setNewFieldData({
      division: settings.division || '',
      fieldNo: '',
      extent: '',
      treeNo: 1,
    });
    setShowNewFieldWizard(true);
  };

  const closeFieldInsights = () => {
    setShowFieldInsights(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('gt_insights');
    window.history.replaceState({}, '', url.toString());
  };

  useEffect(() => {
    const loadSettings = async () => {
      let stored = await db.settings.get(1);
      
      // Merge with approved data if it exists
      if (approvedData) {
        stored = { ...stored, ...approvedData };
        await db.settings.put({ id: 1, ...stored });
      }

      if (stored) {
        if (stored.audioConfirmationEnabled === undefined) {
          stored.audioConfirmationEnabled = true;
        }
        setSettings(stored);
        if (stored.estate && stored.division && stored.fieldNo && stored.operatorName) {
           // We keep setup incomplete if we want the user to confirm field/division every time, 
           // but let's restore it if sessionId is present and recent. For simplicity, let's just 
           // require them to hit "Save & Start" again to generate a new session ID if they refresh,
           // OR if there is an active session, skip it.
           if (stored.sessionId) {
              setIsSetupComplete(true);
           }
        }
      }
      setIsLoading(false);
    };
    loadSettings();
  }, [approvedData]);

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

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Screen wake lock
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isSetupComplete) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.warn('Wake lock request failed:', err);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wakeLock?.release();
    };
  }, [isSetupComplete]);

  // Background GPS
  useEffect(() => {
    if (isSetupComplete && ENABLE_GPS_TAGGING) {
      startBackgroundGPS((location) => {
        setSettings(prev => {
          const updated = {
            ...prev,
            lastKnownLatitude: location.latitude,
            lastKnownLongitude: location.longitude,
            lastKnownGpsAccuracy: location.accuracy,
            lastKnownGoogleMapLink: location.googleMapLink
          };
          db.settings.put({ id: 1, ...updated });
          return updated;
        });
      });
      return () => stopBackgroundGPS();
    }
  }, [isSetupComplete]);

  const syncPending = useCallback(async () => {
    if (!isOnline || isSyncingRef.current || authError) return;
    if (!GAS_URL || GAS_URL.includes('YOUR_SCRIPT_ID')) return;
    
    isSyncingRef.current = true;
    setSyncing(true);

    const pending = await db.measurements.where('syncStatus').equals('pending').toArray();
    if (pending.length === 0) {
      isSyncingRef.current = false;
      setSyncing(false);
      return;
    }

    try {
      // Chunking by 500
      const batchSize = 500;
      const batches = [];
      for (let i = 0; i < pending.length; i += batchSize) {
        batches.push(pending.slice(i, i + batchSize));
      }

      for (const batch of batches) {
         const currentSettings = settingsRef.current;
         const payload = {
           action: "sync_measurements",
           deviceId: currentSettings.deviceId,
           deviceToken: currentSettings.deviceToken,
           estate: currentSettings.estate,
           operatorName: currentSettings.operatorName,
           measurements: batch
         };
         
         const response = await fetch(GAS_URL, {
           method: 'POST',
           body: JSON.stringify(payload),
           headers: { 'Content-Type': 'text/plain;charset=utf-8' },
         });
         
         const result = await response.json();
         if (result.success) {
           const syncedIds = result.syncedIds || batch.map(b => b.id);
           if (syncedIds.length > 0) {
             await db.measurements.where('id').anyOf(syncedIds).modify({ syncStatus: 'synced' });
           }
           
           if (result.failed && result.failed.length > 0) {
             const failedIds = result.failed.map(f => f.localId);
             await db.measurements.where('id').anyOf(failedIds).modify({ syncStatus: 'failed' });
           }
           
           setSyncError('');
           setAuthError('');
         } else {
           if (result.errorType === 'auth_failed' || result.errorType === 'subscription_expired') {
             setAuthError(result.error || 'Access approval required.');
             // Stop further batches
             break;
           } else {
             const ids = batch.map(p => p.id);
             await db.measurements.where('id').anyOf(ids).modify({ syncStatus: 'failed' });
             setSyncError(`Sync error: ${result.error || 'Unknown server error'}`);
           }
         }
      }
    } catch (error) {
      setSyncError(`Network error: ${error.message || 'Connection lost'}. Will retry automatically.`);
    } finally {
      isSyncingRef.current = false;
      setSyncing(false);
    }
  }, [isOnline, authError]);

  useEffect(() => {
    if (isOnline) {
      const timeout = setTimeout(() => {
        syncPending().catch(console.error);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, syncPending]);

  const pendingCountForSync = useLiveQuery(
    () => db.measurements.where('syncStatus').equals('pending').count(),
    []
  ) || 0;

  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && pendingCountForSync > 0) syncPending().catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, [isOnline, pendingCountForSync, syncPending]);

  const saveMeasurement = useCallback(async (caliperReading) => {
    if (isNaN(caliperReading) || caliperReading <= 0) return;
    
    if (caliperReading < MIN_READING || caliperReading > MAX_READING) {
      if (currentSettings.audioConfirmationEnabled) playBeep('error');
      setRangeError(`Reading ${caliperReading}" outside valid range (${MIN_READING}–${MAX_READING}"). Ignored.`);
      setTimeout(() => setRangeError(''), 3000);
      return;
    }
    
    const currentSettings = settingsRef.current;
    const girth = calculateGirth(caliperReading);
    const girthCm = girthToCm(girth);
    const recommendation = getRecommendation(girthCm);

    // Get current session girths for abnormal check
    let sessionGirths = [];
    if (currentSettings.sessionId) {
       const sessionMeasurements = await db.measurements.where('sessionId').equals(currentSettings.sessionId).toArray();
       sessionGirths = sessionMeasurements.map(m => parseFloat(m.girth));
    }
    
    const { abnormalFlag, abnormalReason } = checkAbnormal(girth, sessionGirths);
    if (abnormalFlag) {
       setAbnormalWarning(`Abnormal reading: ${abnormalReason}`);
       setTimeout(() => setAbnormalWarning(''), 5000);
    }

    const loc = ENABLE_GPS_TAGGING ? getLastKnownLocation() : { latitude: null, longitude: null, accuracy: null, status: 'unavailable', googleMapLink: null };

    const newMeasurement = {
      estate: currentSettings.estate,
      division: currentSettings.division,
      fieldNo: currentSettings.fieldNo,
      extent: parseFloat(currentSettings.extent),
      treeNo: parseInt(currentSettings.treeNo),
      operatorName: currentSettings.operatorName,
      sessionId: currentSettings.sessionId,
      caliperReading,
      girth,
      girthCm,
      recommendationStatus: recommendation.status,
      recommendationText: recommendation.text,
      abnormalFlag,
      abnormalReason,
      latitude: loc.latitude,
      longitude: loc.longitude,
      gpsAccuracy: loc.accuracy,
      gpsStatus: loc.status,
      googleMapLink: loc.googleMapLink,
      timestamp: new Date().toISOString(),
      syncStatus: 'pending'
    };

    await db.measurements.add(newMeasurement);
    
    if ('vibrate' in navigator) navigator.vibrate([100]);
    if (currentSettings.audioConfirmationEnabled) playBeep('success');
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 300);

    const nextTreeNo = parseInt(currentSettings.treeNo) + 1;
    const newSettings = { ...currentSettings, treeNo: nextTreeNo };
    setSettings(newSettings);
    
    await db.settings.put({id: 1, ...newSettings});

    if (navigator.onLine && !authError) {
      syncPending().catch(console.error);
    }
  }, [syncPending, authError]);

  useEffect(() => {
    if (!isSetupComplete) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.key === 'Enter' || e.key === '\r') {
        const value = parseCaliperBuffer(bufferRef.current);
        if (value !== null) saveMeasurement(value);
        bufferRef.current = '';
        setDisplayBuffer('');
      } else if (/^[0-9.,]$/.test(e.key) || /^[A-Za-z\s]$/.test(e.key)) {
        bufferRef.current += e.key;
        setDisplayBuffer(filterDisplayBuffer(bufferRef.current));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSetupComplete, saveMeasurement]);

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    if (settings.audioConfirmationEnabled && !audioCtx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtx = new AudioContext();
          if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        }
      } catch (err) {
        console.debug('Audio initialization blocked:', err);
      }
    }
    const sessionId = `${settings.estate}-${settings.division}-${settings.fieldNo}-${Date.now()}`;
    const sessionStartedAt = new Date().toISOString();
    const newSettings = { ...settings, sessionId, sessionStartedAt };
    setSettings(newSettings);
    await db.settings.put({id: 1, ...newSettings});
    setIsSetupComplete(true);
    
    if (ENABLE_GPS_TAGGING) {
       startBackgroundGPS();
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleUndo = async () => {
    if (!undoConfirm) {
      setUndoConfirm(true);
      setTimeout(() => setUndoConfirm(false), 4000);
      return;
    }

    const currentSettings = settingsRef.current;
    let lastMeasurement;
    if (currentSettings.sessionId) {
      lastMeasurement = await db.measurements
        .where('sessionId')
        .equals(currentSettings.sessionId)
        .last();
    } else {
      lastMeasurement = await db.measurements.orderBy('id').last();
    }
    
    if (!lastMeasurement) {
      setUndoConfirm(false);
      return;
    }

    await db.measurements.delete(lastMeasurement.id);
    const newTreeNo = lastMeasurement.treeNo;
    const newSettings = { ...currentSettings, treeNo: newTreeNo };
    setSettings(newSettings);
    await db.settings.put({id: 1, ...newSettings});
    setUndoConfirm(false);
  };

  const adjustTreeNo = async (delta) => {
    const newTreeNo = Math.max(1, parseInt(settingsRef.current.treeNo) + delta);
    const newSettings = { ...settingsRef.current, treeNo: newTreeNo };
    setSettings(newSettings);
    await db.settings.put({id: 1, ...newSettings});
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const value = parseCaliperBuffer(manualEntry);

    if (value !== null) {
      saveMeasurement(value);
      setManualEntry('');
    }
  };

  const handleExportCSV = async () => {
    const all = await db.measurements.toArray();
    if (all.length === 0) {
      alert("No data to export");
      return;
    }
    const headers = "id,estate,division,fieldNo,extent,treeNo,operatorName,sessionId,caliperReading,girth,girthCm,recommendationStatus,abnormalFlag,latitude,longitude,timestamp,syncStatus\n";
    const rows = all.map(m =>
      [m.id, escCsv(m.estate), escCsv(m.division), escCsv(m.fieldNo), m.extent, m.treeNo, escCsv(m.operatorName), escCsv(m.sessionId), m.caliperReading, m.girth, m.girthCm, escCsv(m.recommendationStatus), m.abnormalFlag, m.latitude, m.longitude, escCsv(m.timestamp), m.syncStatus].join(',')
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GirthTracker_Export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };
  
  const forceRefresh = () => {
    if (!refreshConfirm) {
      setRefreshConfirm(true);
      setTimeout(() => setRefreshConfirm(false), 4000);
      return;
    }
    window.location.reload();
  };

  const recentMeasurements = useLiveQuery(
    () => {
      if (!settings.sessionId) return db.measurements.orderBy('id').reverse().limit(5).toArray();
      return db.measurements
        .where('sessionId')
        .equals(settings.sessionId)
        .reverse()
        .limit(5)
        .toArray();
    },
    [settings.sessionId]
  );
  
  const pendingCount = useLiveQuery(
    () => {
      if (!settings.sessionId) return db.measurements.where('syncStatus').equals('pending').count();
      return db.measurements
        .where('sessionId')
        .equals(settings.sessionId)
        .filter(m => m.syncStatus === 'pending')
        .count();
    },
    [settings.sessionId]
  ) || 0;

  const syncedCount = useLiveQuery(
    () => {
      if (!settings.sessionId) return db.measurements.where('syncStatus').equals('synced').count();
      return db.measurements
        .where('sessionId')
        .equals(settings.sessionId)
        .filter(m => m.syncStatus === 'synced')
        .count();
    },
    [settings.sessionId]
  ) || 0;

  const failedCount = useLiveQuery(
    () => {
      if (!settings.sessionId) return db.measurements.where('syncStatus').equals('failed').count();
      return db.measurements
        .where('sessionId')
        .equals(settings.sessionId)
        .filter(m => m.syncStatus === 'failed')
        .count();
    },
    [settings.sessionId]
  ) || 0;

  const retryFailed = useCallback(async () => {
    const current = settingsRef.current;
    if (current.sessionId) {
      await db.measurements
        .where('sessionId')
        .equals(current.sessionId)
        .filter(m => m.syncStatus === 'failed')
        .modify({ syncStatus: 'pending' });
    } else {
      await db.measurements.where('syncStatus').equals('failed').modify({ syncStatus: 'pending' });
    }
    setSyncError('');
    syncPending().catch(console.error);
  }, [syncPending]);

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="glass-card" style={{textAlign: 'center', padding: '2rem'}}>
          <RefreshCw size={24} className="pulse" style={{marginBottom: '1rem'}} />
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isSetupComplete) {
    return (
      <div className="app-container">
        <div className="glass-card">
          <div className="app-header">
            <h1 className="app-title"><Settings2 size={24} color="var(--accent-primary)" /> Estate Setup</h1>
          </div>
          
          <form onSubmit={handleSetupSubmit}>
            <div className="form-group">
              <label>Operator Name</label>
              <input 
                type="text" 
                required 
                placeholder="Enter your name"
                value={settings.operatorName}
                onChange={e => setSettings({...settings, operatorName: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Estate</label>
              {ESTATES.length > 0 ? (
                <select
                  required
                  value={settings.estate}
                  onChange={e => setSettings({...settings, estate: e.target.value})}
                >
                  <option value="">Select Estate...</option>
                  {ESTATES.map(est => <option key={est} value={est}>{est}</option>)}
                </select>
              ) : (
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Sample Estate"
                  value={settings.estate}
                  onChange={e => setSettings({...settings, estate: e.target.value})}
                />
              )}
            </div>
            <div className="form-group">
              <label>Division</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Sample Divi"
                value={settings.division}
                onChange={e => setSettings({...settings, division: e.target.value})}
              />
            </div>
            <div className="input-row">
              <div className="form-group">
                <label>Field No</label>
                <input 
                  type="text" 
                  required 
                  value={settings.fieldNo}
                  onChange={e => setSettings({...settings, fieldNo: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Extent (Ha)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  value={settings.extent}
                  onChange={e => setSettings({...settings, extent: e.target.value})}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Starting Tree Number</label>
              <input 
                type="number" 
                required 
                min="1"
                value={settings.treeNo}
                onChange={e => setSettings({...settings, treeNo: e.target.value})}
              />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--element-bg)', borderRadius: 'var(--radius-md)' }}>
              <label style={{ margin: 0, fontWeight: 600 }}>Sound Confirmation</label>
              <button 
                type="button"
                className={`btn ${settings.audioConfirmationEnabled ? 'btn-secondary' : 'btn-danger'}`}
                style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.9rem', minWidth: '80px' }}
                onClick={() => {
                  const newSettings = { ...settings, audioConfirmationEnabled: !settings.audioConfirmationEnabled };
                  setSettings(newSettings);
                  db.settings.put({ id: 1, ...newSettings });
                }}
              >
                {settings.audioConfirmationEnabled ? 'On' : 'Off'}
              </button>
            </div>
            <button type="submit" className="btn" style={{marginTop: '1rem'}}>
              <Save size={20} /> Save & Start Measuring
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${successFlash ? 'flash-success' : ''}`}>
      <div className="glass-card" style={{padding: '1rem 1.5rem', marginBottom: '1rem'}}>
        <div className="app-header" style={{marginBottom: 0, paddingBottom: 0, borderBottom: 'none'}}>
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <h1 className="app-title" style={{marginBottom: '0.2rem', fontSize: '1.4rem'}}>
              <Activity size={24} color="var(--accent-primary)" /> GirthTracker
            </h1>
            <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>
              {settings.estate} | F: {settings.fieldNo}
            </div>
          </div>
          <div className="connection-status">
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick} 
                className="btn" 
                style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto', marginRight: '0.5rem'}}
              >
                <Download size={14} /> <span className="header-action-label">Install</span>
              </button>
            )}
            {isOnline ? (
              <><span className="status-dot online"></span> <Wifi size={14} /> <span className="header-action-label">Online</span></>
            ) : (
              <><span className="status-dot offline"></span> <WifiOff size={14} /> <span className="header-action-label">Offline</span></>
            )}
            <button 
              onClick={forceRefresh}
              className={`btn ${refreshConfirm ? 'btn-danger' : 'btn-secondary'}`}
              style={{padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto', marginLeft: '0.5rem'}}
              title="Force App Update"
            >
              <RefreshCw size={14} /> <span className="header-action-label">{refreshConfirm ? 'Sure?' : 'Update'}</span>
            </button>
          </div>
        </div>
      </div>

      {(!GAS_URL || GAS_URL.includes('YOUR_SCRIPT_ID')) && (
        <div className="warning-banner">
          <AlertTriangle size={16} /> Google Apps Script URL not configured. Sync is disabled.
        </div>
      )}

      {authError && (
         <div className="warning-banner" style={{background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)'}}>
           <AlertTriangle size={16} /> {authError} Measurements are saved locally but cannot sync.
         </div>
      )}

      {rangeError && (
        <div className="warning-banner" style={{background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)'}}>
          <AlertTriangle size={16} /> {rangeError}
        </div>
      )}

      {abnormalWarning && (
         <div className="warning-banner" style={{background: 'rgba(245, 158, 11, 0.15)', borderColor: 'var(--accent-pending)', color: 'var(--accent-pending)'}}>
           <AlertTriangle size={16} /> {abnormalWarning}
         </div>
      )}

      {syncError && (
        <div className="warning-banner" style={{background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)', cursor: 'pointer'}} onClick={retryFailed}>
          <AlertTriangle size={16} /> {syncError} — Tap to retry
        </div>
      )}

      <div className="glass-card">
        <div className="bluetooth-indicator">
          <Bluetooth size={18} className="pulse" />
          Ready for Caliper Input
        </div>
        
        <div className="big-display">
          <div className="text-muted">Current Tree</div>
          <div className="tree-adjust-container">
            <button className="btn-icon" onClick={() => adjustTreeNo(-1)}><Minus size={20} /></button>
            <div className="big-number">#{settings.treeNo}</div>
            <button className="btn-icon" onClick={() => adjustTreeNo(1)}><Plus size={20} /></button>
          </div>
          
          {displayBuffer && (
            <div style={{marginTop: '1rem', color: 'var(--accent-pending)', fontSize: '1.2rem'}}>
              Receiving: {displayBuffer}...
            </div>
          )}
        </div>
        
        <div style={{display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap'}}>
          <button
            className="btn btn-secondary"
            onClick={openNewFieldWizard}
            style={{flex: '1 1 100%', fontSize: '0.9rem'}}
          >
             <Plus size={16} /> Start New Field
          </button>
          <button
            className={`btn ${setupConfirm ? 'btn-danger-solid' : 'btn-secondary'}`}
            onClick={() => {
              if (!setupConfirm) {
                setSetupConfirm(true);
                setTimeout(() => setSetupConfirm(false), 4000);
                return;
              }
              setSetupConfirm(false);
              stopBackgroundGPS();
              setIsSetupComplete(false);
            }}
            style={{flex: 1, fontSize: '0.9rem'}}
          >
            <Settings2 size={16} /> {setupConfirm ? 'Confirm?' : 'Setup'}
          </button>
          <button
            className={`btn ${undoConfirm ? 'btn-danger-solid' : 'btn-danger'}`}
            onClick={handleUndo}
            style={{flex: 1, fontSize: '0.9rem'}}
            disabled={!recentMeasurements || recentMeasurements.length === 0}
          >
            <Undo size={16} /> {undoConfirm ? 'Confirm Undo?' : 'Undo Last'}
          </button>
        </div>

        {/* Manual Fallback */}
        <form onSubmit={handleManualSubmit} className="manual-entry-form">
          <label className="text-muted" style={{fontSize: '0.8rem'}}><Edit3 size={14} style={{display: 'inline', verticalAlign: 'text-bottom'}}/> Manual Entry</label>
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <input 
              type="number" 
              step="0.01" 
              placeholder="Caliper Reading" 
              value={manualEntry}
              onChange={(e) => setManualEntry(e.target.value)}
              style={{flex: 1}}
            />
            <button type="submit" className="btn" style={{width: 'auto', padding: '0 1rem'}}>Save</button>
          </div>
        </form>
      </div>



      <div className="stat-grid">
        <div className="stat-box" onClick={syncPending} style={{cursor: isOnline && !authError ? 'pointer' : 'default'}}>
          <div className="text-muted" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem'}}>
            {syncing ? <RefreshCw size={14} className="pulse" /> : <CloudUpload size={14} />} Pending
          </div>
          <div className="stat-value pending">{pendingCount}</div>
          {pendingCount > 0 && isOnline && !syncing && !authError && <div style={{fontSize: '0.7rem', color: 'var(--accent-primary)', marginTop: '0.2rem'}}>Tap to Sync</div>}
        </div>
        <div className="stat-box">
          <div className="text-muted">Synced</div>
          <div className="stat-value">{syncedCount}</div>
        </div>
        {failedCount > 0 && (
          <div className="stat-box" onClick={retryFailed} style={{cursor: 'pointer', gridColumn: '1 / -1'}}>
            <div className="text-muted" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem'}}>
              <AlertTriangle size={14} /> Failed
            </div>
            <div className="stat-value" style={{color: 'var(--accent-danger)'}}>{failedCount}</div>
            <div style={{fontSize: '0.7rem', color: 'var(--accent-danger)', marginTop: '0.2rem'}}>Tap to Retry</div>
          </div>
        )}
      </div>

      <div className="glass-card recent-measurements-card">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
          <h2>Recent</h2>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {SHOW_FIELD_INSIGHTS_BUTTON && (
              <button className="btn btn-secondary" onClick={() => setShowFieldInsights(true)} style={{padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto'}}>
                <BarChart3 size={14} /> Insights
              </button>
            )}
            {ENABLE_SESSION_REPORTS && (
              <button className="btn btn-secondary" onClick={() => setShowSessionReport(true)} style={{padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto'}}>
                <FileText size={14} /> Report
              </button>
            )}
            <button className="btn btn-secondary" onClick={handleExportCSV} style={{padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto'}}>
              <FileSpreadsheet size={14} /> CSV
            </button>
          </div>
        </div>
        
        {recentMeasurements && recentMeasurements.length > 0 ? (
          <div className="measurement-list-container">
            <div className="measurement-list">
              {recentMeasurements.map((m) => (
                <div key={m.id} className={`measurement-item ${m.syncStatus}`}>
                  <div className="measurement-details">
                    <span className="measurement-main">Tree #{m.treeNo} - {m.girth} in</span>
                    <span className="measurement-sub">Caliper: {m.caliperReading} in | Field: {m.fieldNo}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                    <span className={`badge ${m.syncStatus}`}>{m.syncStatus}</span>
                    {m.recommendationStatus && m.recommendationStatus !== 'not_ready' && (
                       <span className={`badge ${m.recommendationStatus === 'tappable' ? 'synced' : 'pending'}`}>
                          {m.recommendationStatus === 'tappable' ? 'Tappable' : 'Approaching'}
                       </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-muted" style={{textAlign: 'center', padding: '1rem 0'}}>
            No measurements yet.
          </div>
        )}
      </div>

      <div className="app-version">v{APP_VERSION}</div>

      {showNewFieldWizard && (
        <div className="session-report-overlay">
          <div className="glass-card session-report-card start-new-field-modal">
            <div className="session-report-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>Start New Field</h2>
              <button className="btn-icon" onClick={() => setShowNewFieldWizard(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {pendingCount > 0 && (
                <div className="warning-banner" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-pending)', borderColor: 'var(--accent-pending)', marginBottom: '1rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} /> 
                  <span>You have {pendingCount} unsynced measurements. They will not be lost.</span>
                </div>
              )}

              <form onSubmit={async (e) => {
                e.preventDefault();
                const sessionId = `${settings.estate}-${newFieldData.division}-${newFieldData.fieldNo}-${Date.now()}`;
                const sessionStartedAt = new Date().toISOString();
                const newSettings = { 
                  ...settings, 
                  division: newFieldData.division,
                  fieldNo: newFieldData.fieldNo,
                  extent: newFieldData.extent,
                  treeNo: newFieldData.treeNo,
                  sessionId, 
                  sessionStartedAt 
                };
                setSettings(newSettings);
                await db.settings.put({ id: 1, ...newSettings });
                setShowNewFieldWizard(false);
              }}>
                <div className="form-group">
                  <label>Division</label>
                  <input required type="text" value={newFieldData.division} onChange={e => setNewFieldData({...newFieldData, division: e.target.value})} />
                </div>
                <div className="input-row new-field-grid">
                  <div className="form-group">
                    <label>Field No</label>
                    <input required type="text" value={newFieldData.fieldNo} onChange={e => setNewFieldData({...newFieldData, fieldNo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Extent (Ha)</label>
                    <input required type="number" step="0.01" value={newFieldData.extent} onChange={e => setNewFieldData({...newFieldData, extent: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Starting Tree Number</label>
                  <input required type="number" min="1" value={newFieldData.treeNo} onChange={e => setNewFieldData({...newFieldData, treeNo: e.target.value})} />
                </div>
                
                <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowNewFieldWizard(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn" style={{ flex: 1 }}><Plus size={16} /> Start</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showSessionReport && (
        <SessionReport settings={settings} onClose={() => setShowSessionReport(false)} />
      )}
      {showFieldInsights && (
        <FieldInsightsModal settings={settings} isOpen={showFieldInsights} onClose={closeFieldInsights} />
      )}
    </div>
  );
}

export default App;

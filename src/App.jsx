import { useState, useEffect, useCallback, useRef } from 'react';
import { Bluetooth, Save, Settings2, Activity, Wifi, WifiOff, CloudUpload, RefreshCw, Download, Undo, Minus, Plus, FileSpreadsheet, Edit3, AlertTriangle } from 'lucide-react';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import './index.css';

const GAS_URL = import.meta.env.VITE_GAS_URL || '';
const GAS_SECRET = import.meta.env.VITE_GAS_SECRET || '';

const isEnvFlagEnabled = (value) => String(value).trim().toLowerCase() === 'true';
const IS_MAINTENANCE_MODE = isEnvFlagEnabled(import.meta.env.VITE_MAINTENANCE_MODE);
const IS_DISABLED_MODE = isEnvFlagEnabled(import.meta.env.VITE_DISABLED_MODE);

// Caliper reading validation range (inches)
const MIN_READING = 0.5;
const MAX_READING = 30;

// Parse estate list from environment
const ESTATES = import.meta.env.VITE_ESTATES
  ?.split(',')
  .map(s => s.trim())
  .filter(Boolean) || [];

function App() {
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

  return <TrackerApp />;
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

function TrackerApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [settings, setSettings] = useState({
    estate: '',
    division: '',
    fieldNo: '',
    extent: '',
    treeNo: 1,
  });
  
  // Use Refs for values that change rapidly to avoid closure bugs in event listeners
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

  useEffect(() => {
    const loadSettings = async () => {
      const stored = await db.settings.toCollection().first();
      if (stored) {
        setSettings(stored);
        setIsSetupComplete(true);
      }
      setIsLoading(false);
    };
    loadSettings();
  }, []);

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

  // Screen wake lock with visibility change re-acquisition
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

  const syncPending = useCallback(async () => {
    if (!isOnline || isSyncingRef.current) return;
    if (!GAS_URL || GAS_URL.includes('YOUR_SCRIPT_ID')) return;
    
    // Set guard before any await to prevent race condition
    isSyncingRef.current = true;
    setSyncing(true);

    const pending = await db.measurements.where('syncStatus').equals('pending').toArray();
    if (pending.length === 0) {
      isSyncingRef.current = false;
      setSyncing(false);
      return;
    }
    try {
      // Embed secret in the POST body, not the URL, to avoid Google server log leakage
      const body = GAS_SECRET
        ? { secret: GAS_SECRET, measurements: pending }
        : pending;
      const payload = JSON.stringify(body);
      
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = await response.json();
      if (result.success) {
        const ids = pending.map(p => p.id);
        await db.measurements.where('id').anyOf(ids).modify({ syncStatus: 'synced' });
        setSyncError('');
      } else {
        // Server-confirmed rejection — mark as failed
        const ids = pending.map(p => p.id);
        await db.measurements.where('id').anyOf(ids).modify({ syncStatus: 'failed' });
        setSyncError(`Sync rejected: ${result.error || 'Unknown server error'}`);
      }
    } catch (error) {
      // Transient network error — leave as pending for auto-retry
      setSyncError(`Network error: ${error.message || 'Connection lost'}. Will retry automatically.`);
    } finally {
      isSyncingRef.current = false;
      setSyncing(false);
    }
  }, [isOnline]);

  // Sync when coming online
  useEffect(() => {
    if (isOnline) {
      const timeout = setTimeout(() => {
        syncPending().catch(console.error);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, syncPending]);

  // Periodic Sync Retry
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
    
    // Range validation
    if (caliperReading < MIN_READING || caliperReading > MAX_READING) {
      setRangeError(`Reading ${caliperReading}" outside valid range (${MIN_READING}–${MAX_READING}"). Ignored.`);
      setTimeout(() => setRangeError(''), 3000);
      return;
    }
    
    const currentSettings = settingsRef.current;
    
    const girth = parseFloat((caliperReading * Math.PI).toFixed(2));
    
    const newMeasurement = {
      estate: currentSettings.estate,
      division: currentSettings.division,
      fieldNo: currentSettings.fieldNo,
      extent: parseFloat(currentSettings.extent),
      treeNo: parseInt(currentSettings.treeNo),
      caliperReading,
      girth,
      timestamp: new Date().toISOString(),
      syncStatus: 'pending'
    };

    await db.measurements.add(newMeasurement);
    
    if ('vibrate' in navigator) navigator.vibrate([100]);
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 300);

    const nextTreeNo = parseInt(currentSettings.treeNo) + 1;
    const newSettings = { ...currentSettings, treeNo: nextTreeNo };
    setSettings(newSettings);
    
    await db.settings.put({id: 1, ...newSettings});

    if (navigator.onLine) {
      syncPending().catch(console.error);
    }
  }, [syncPending]);

  useEffect(() => {
    if (!isSetupComplete) return;

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.key === 'Enter' || e.key === '\r') {
        const raw = bufferRef.current.trim().replace(/,/g, '.').replace(/[^\d.]/g, '');
        let value = parseFloat(raw);

        if (value > 1000) {
          value = value / 10000;
        }

        if (!isNaN(value) && value > 0) {
          saveMeasurement(value);
        }
        
        bufferRef.current = '';
        setDisplayBuffer('');
        
      } else if (/^[0-9.,]$/.test(e.key) || /^[A-Za-z\s]$/.test(e.key)) {
        bufferRef.current += e.key;
        // Only show numeric portion in display
        setDisplayBuffer(bufferRef.current.replace(/[^\d.]/g, ''));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSetupComplete, saveMeasurement]);

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    await db.settings.put({id: 1, ...settings});
    setIsSetupComplete(true);
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
    // First tap: show confirmation, no DB query needed
    if (!undoConfirm) {
      setUndoConfirm(true);
      setTimeout(() => setUndoConfirm(false), 4000);
      return;
    }

    // Second tap (confirmed): query and delete
    const currentSettings = settingsRef.current;
    let lastMeasurement;
    if (currentSettings.estate && currentSettings.fieldNo) {
      lastMeasurement = await db.measurements
        .where('[estate+fieldNo]')
        .equals([currentSettings.estate, currentSettings.fieldNo])
        .last();
    } else {
      lastMeasurement = await db.measurements.orderBy('id').last();
    }
    if (!lastMeasurement) {
      setUndoConfirm(false);
      return;
    }

    await db.measurements.delete(lastMeasurement.id);
    // Restore to the deleted measurement's own tree number
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
    const raw = manualEntry.trim().replace(/,/g, '.').replace(/[^\d.]/g, '');
    let value = parseFloat(raw);
    
    if (value > 1000) {
      value = value / 10000;
    }

    if (!isNaN(value) && value > 0) {
      saveMeasurement(value);
      setManualEntry('');
    }
  };

  const escCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;

  const handleExportCSV = async () => {
    const all = await db.measurements.toArray();
    if (all.length === 0) {
      alert("No data to export");
      return;
    }
    const headers = "id,estate,division,fieldNo,extent,treeNo,caliperReading,girth,timestamp,syncStatus\n";
    const rows = all.map(m =>
      [m.id, escCsv(m.estate), escCsv(m.division), escCsv(m.fieldNo), m.extent, m.treeNo, m.caliperReading, m.girth, escCsv(m.timestamp), m.syncStatus].join(',')
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

  // Filter recent measurements by current estate + field
  const recentMeasurements = useLiveQuery(
    () => {
      if (!settings.estate || !settings.fieldNo) {
        return db.measurements.orderBy('id').reverse().limit(5).toArray();
      }
      return db.measurements
        .where('[estate+fieldNo]')
        .equals([settings.estate, settings.fieldNo])
        .reverse()
        .limit(5)
        .toArray();
    },
    [settings.estate, settings.fieldNo]
  );
  
  // Filter pending count by current field
  const pendingCount = useLiveQuery(
    () => {
      if (!settings.estate || !settings.fieldNo) {
        return db.measurements.where('syncStatus').equals('pending').count();
      }
      return db.measurements
        .where('[estate+fieldNo]')
        .equals([settings.estate, settings.fieldNo])
        .filter(m => m.syncStatus === 'pending')
        .count();
    },
    [settings.estate, settings.fieldNo]
  ) || 0;

  // Filter synced count by current field
  const syncedCount = useLiveQuery(
    () => {
      if (!settings.estate || !settings.fieldNo) {
        return db.measurements.where('syncStatus').equals('synced').count();
      }
      return db.measurements
        .where('[estate+fieldNo]')
        .equals([settings.estate, settings.fieldNo])
        .filter(m => m.syncStatus === 'synced')
        .count();
    },
    [settings.estate, settings.fieldNo]
  ) || 0;

  // Track failed uploads for visibility
  const failedCount = useLiveQuery(
    () => {
      if (!settings.estate || !settings.fieldNo) {
        return db.measurements.where('syncStatus').equals('failed').count();
      }
      return db.measurements
        .where('[estate+fieldNo]')
        .equals([settings.estate, settings.fieldNo])
        .filter(m => m.syncStatus === 'failed')
        .count();
    },
    [settings.estate, settings.fieldNo]
  ) || 0;

  // Retry failed measurements — scoped to current field
  const retryFailed = useCallback(async () => {
    const current = settingsRef.current;
    if (current.estate && current.fieldNo) {
      await db.measurements
        .where('[estate+fieldNo]')
        .equals([current.estate, current.fieldNo])
        .filter(m => m.syncStatus === 'failed')
        .modify({ syncStatus: 'pending' });
    } else {
      await db.measurements.where('syncStatus').equals('failed').modify({ syncStatus: 'pending' });
    }
    setSyncError('');
    syncPending().catch(console.error);
  }, [syncPending]);

  // Loading screen prevents flash of setup for returning users
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
              {settings.estate} | {settings.division} | F: {settings.fieldNo}
            </div>
          </div>
          <div className="connection-status">
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick} 
                className="btn" 
                style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto', marginRight: '0.5rem'}}
              >
                <Download size={14} /> Install
              </button>
            )}
            {isOnline ? (
              <><span className="status-dot online"></span> <Wifi size={14} /> Online</>
            ) : (
              <><span className="status-dot offline"></span> <WifiOff size={14} /> Offline</>
            )}
            <button 
              onClick={forceRefresh}
              className={`btn ${refreshConfirm ? 'btn-danger' : 'btn-secondary'}`}
              style={{padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto', marginLeft: '0.5rem'}}
              title="Force App Update"
            >
              <RefreshCw size={14} /> {refreshConfirm ? 'Sure?' : 'Update'}
            </button>
          </div>
        </div>
      </div>

      {(!GAS_URL || GAS_URL.includes('YOUR_SCRIPT_ID')) && (
        <div className="warning-banner">
          <AlertTriangle size={16} /> Google Apps Script URL not configured. Sync is disabled.
        </div>
      )}

      {rangeError && (
        <div className="warning-banner" style={{background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--accent-danger)', color: 'var(--accent-danger)'}}>
          <AlertTriangle size={16} /> {rangeError}
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
        
        <div style={{display: 'flex', gap: '0.5rem', marginTop: '1.5rem'}}>
          <button
            className={`btn ${setupConfirm ? 'btn-danger-solid' : 'btn-secondary'}`}
            onClick={() => {
              if (!setupConfirm) {
                setSetupConfirm(true);
                setTimeout(() => setSetupConfirm(false), 4000);
                return;
              }
              setSetupConfirm(false);
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
        <div className="stat-box" onClick={syncPending} style={{cursor: isOnline ? 'pointer' : 'default'}}>
          <div className="text-muted" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem'}}>
            {syncing ? <RefreshCw size={14} className="pulse" /> : <CloudUpload size={14} />} Pending
          </div>
          <div className="stat-value pending">{pendingCount}</div>
          {pendingCount > 0 && isOnline && !syncing && <div style={{fontSize: '0.7rem', color: 'var(--accent-primary)', marginTop: '0.2rem'}}>Tap to Sync</div>}
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
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto'}}>
            <FileSpreadsheet size={16} /> CSV
          </button>
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
                  <span className={`badge ${m.syncStatus}`}>{m.syncStatus}</span>
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
    </div>
  );
}

export default App;

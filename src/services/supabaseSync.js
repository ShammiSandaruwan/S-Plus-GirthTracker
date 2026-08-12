import { SUPABASE_FUNCTIONS_URL } from './supabaseClient';
import { db } from '../db';

export async function syncToSupabase(pendingMeasurements, deviceId, deviceToken, estate, operatorName) {
  const url = `${SUPABASE_FUNCTIONS_URL}/sync-measurements`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      'x-device-token': deviceToken,
    },
    body: JSON.stringify({
      estate,
      operatorName,
      measurements: pendingMeasurements
    })
  });

  const result = await response.json();
  if (!response.ok) {
    const err = new Error(result.error || result.message || 'Failed to sync with Supabase');
    err.errorCode = result.errorCode || result.errorType || (response.status === 401 || response.status === 403 ? 'AUTH_FAILED' : 'SYNC_ERROR');
    throw err;
  }

  return result; // { success: true, syncedIds: [...], errors: [...] }
}

export async function undoFromSupabase(measurement, deviceId, deviceToken, operatorName) {
  const url = `${SUPABASE_FUNCTIONS_URL}/undo-measurement`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      'x-device-token': deviceToken,
    },
    body: JSON.stringify({
      estate: measurement.estate,
      division: measurement.division,
      fieldNo: measurement.fieldNo,
      extent: measurement.extent,
      treeNo: measurement.treeNo,
      operatorName
    })
  });

  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('auth_failed');
    }
    throw new Error(result.error || result.message || 'Failed to undo measurement from Supabase');
  }

  return result;
}

export async function checkDuplicateInDexie(fieldId, estate, division, fieldNo, extent, treeNo) {
  // Check dexie for local duplicate
  if (fieldId) {
    const duplicates = await db.measurements
      .where('[fieldId+treeNo]')
      .equals([fieldId, parseInt(treeNo)])
      .toArray();
    if (duplicates.length > 0) return duplicates[0];
  }
  
  // Legacy fallback if fieldId is not present
  const duplicates = await db.measurements
    .where('[estate+division+fieldNo+extent+treeNo]')
    .equals([estate, division, fieldNo, parseFloat(extent), parseInt(treeNo)])
    .toArray();
    
  return duplicates.length > 0 ? duplicates[0] : null;
}

export async function fetchAdminMeasurements(adminToken, filters) {
  const url = `${SUPABASE_FUNCTIONS_URL}/admin-fetch`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-admin-token': adminToken,
      },
      body: JSON.stringify(filters)
    });
  } catch (err) {
    throw new Error(err.message || 'Network request failed', { cause: err });
  }

  let result;
  try {
    result = await response.json();
  } catch (parseErr) {
    throw new Error(`Server returned HTTP ${response.status}`, { cause: parseErr });
  }

  if (!response.ok) {
    throw new Error(result.error || result.message || 'Failed to fetch admin measurements');
  }

  return result; // { success: true, measurements: [...] }
}

export async function triggerAdminExport(adminToken, filters) {
  const url = `${SUPABASE_FUNCTIONS_URL}/export-field`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'x-admin-token': adminToken,
      },
      body: JSON.stringify(filters)
    });
  } catch (err) {
    throw new Error(err.message || 'Network request failed', { cause: err });
  }

  let result;
  try {
    result = await response.json();
  } catch (parseErr) {
    throw new Error(`Server returned HTTP ${response.status}`, { cause: parseErr });
  }

  if (!response.ok) {
    throw new Error(result.error || result.message || 'Failed to trigger export');
  }

  return result;
}

// ----------------------------------------------------
// Auth & Config Functions (Phase 1.5)
// ----------------------------------------------------

export async function requestAccessViaSupabase(payload) {
  const url = `${SUPABASE_FUNCTIONS_URL}/request-access`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to request access');
  return result;
}

export async function checkAccessViaSupabase(requestId, deviceId) {
  const url = `${SUPABASE_FUNCTIONS_URL}/check-access?t=${Date.now()}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
      body: JSON.stringify({ requestId, deviceId, cacheBust: Date.now() })
    });
    const result = await response.json();
    if (!response.ok && !result.errorType) {
      const err = new Error(result.error || 'Failed to check access status');
      err.isNetworkError = false;
      throw err;
    }
    return result;
  } catch (err) {
    if (!err.errorType && (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('network'))) {
      return { success: false, isNetworkError: true, error: err.message };
    }
    throw err;
  }
}


export async function fetchFieldConfig(currentVersion = 0) {
  const url = `${SUPABASE_FUNCTIONS_URL}/fetch-config`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configVersion: currentVersion })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to fetch config');
  return result;
}

export async function adminCRUD(adminToken, action, payload = {}) {
  const url = `${SUPABASE_FUNCTIONS_URL}/admin-config`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json();
  if (!response.ok) {
    let errMsg = result.error || result.message || `Admin CRUD failed for action: ${action}`;
    if (result.details) errMsg += ` | Details: ${JSON.stringify(result.details)}`;
    if (result.uid) errMsg += ` | UID: ${result.uid}`;
    throw new Error(errMsg);
  }
  return result;
}

export async function adminApproveDevice(adminToken, requestId, action) {
  const url = `${SUPABASE_FUNCTIONS_URL}/approve-device`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action, requestId })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || 'Approval action failed');
  return result;
}

export async function deviceHeartbeat(deviceId, deviceToken) {
  try {
    const url = `${SUPABASE_FUNCTIONS_URL}/device-heartbeat`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
        'x-device-token': deviceToken,
      },
      body: JSON.stringify({ t: Date.now() })
    });
  } catch {
    // Heartbeat failures are non-critical - silently ignore
  }
}

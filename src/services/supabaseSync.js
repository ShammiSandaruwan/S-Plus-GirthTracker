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
    throw new Error(result.error || 'Failed to sync with Supabase');
  }

  return result; // { success: true, syncedIds: [...] }
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
    throw new Error(result.error || 'Failed to undo measurement from Supabase');
  }

  return result;
}

export async function checkDuplicateInDexie(estate, division, fieldNo, extent, treeNo) {
  // Check dexie for local duplicate
  const duplicates = await db.measurements
    .where('[estate+division+fieldNo+extent+treeNo]')
    .equals([estate, division, fieldNo, parseFloat(extent), parseInt(treeNo)])
    .toArray();
    
  return duplicates.length > 0 ? duplicates[0] : null;
}

export async function fetchAdminMeasurements(adminToken, filters) {
  const url = `${SUPABASE_FUNCTIONS_URL}/admin-fetch`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
    },
    body: JSON.stringify(filters)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || result.message || 'Failed to fetch admin measurements');
  }

  return result; // { success: true, measurements: [...] }
}

export async function triggerAdminExport(adminToken, filters) {
  const url = `${SUPABASE_FUNCTIONS_URL}/export-field`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
    },
    body: JSON.stringify(filters)
  });

  const result = await response.json();
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
  const url = `${SUPABASE_FUNCTIONS_URL}/check-access`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, deviceId })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to check access status');
  return result;
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
      'x-admin-token': adminToken,
    },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || `Admin CRUD failed for action: ${action}`);
  return result;
}

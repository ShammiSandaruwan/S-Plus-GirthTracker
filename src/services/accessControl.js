/**
 * Access Control Service
 * Handles device ID generation, access request, approval status check,
 * and token validation against Google Apps Script backend.
 */

import { db } from '../db';
import { requestAccessViaSupabase, checkAccessViaSupabase } from './supabaseSync';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.1.0';

/**
 * Generate or retrieve a stable device ID.
 */
export async function getOrCreateDeviceId() {
  const stored = await db.settings.get(1);
  if (stored?.deviceId) return stored.deviceId;

  const deviceId = crypto.randomUUID();
  await db.settings.put({ id: 1, ...stored, deviceId });
  return deviceId;
}

/**
 * Get current access status from local DB.
 */
export async function getLocalAccessStatus() {
  const stored = await db.settings.get(1);
  return {
    accessStatus: stored?.accessStatus || null,
    requestId: stored?.requestId || null,
    deviceToken: stored?.deviceToken || null,
    estate: stored?.estate || '',
    operatorName: stored?.operatorName || '',
    approvedAt: stored?.approvedAt || null,
    expiresAt: stored?.expiresAt || null,
    deviceId: stored?.deviceId || null,
  };
}

/**
 * Save access-related fields to local settings.
 */
export async function saveAccessStatus(fields) {
  const stored = (await db.settings.get(1)) || { id: 1 };
  await db.settings.put({ ...stored, ...fields });
}

/**
 * Send access request to Google Apps Script backend.
 */
export async function requestAccess({ estate, operatorName, deviceId, location }) {
  const payload = {
    estate,
    operatorName,
    deviceId,
    location: location || {
      latitude: null,
      longitude: null,
      accuracy: null,
      capturedAt: null,
      status: 'unavailable',
      googleMapLink: null,
    },
    userAgent: navigator.userAgent,
    appVersion: APP_VERSION,
  };

  return await requestAccessViaSupabase(payload);
}

/**
 * Check approval status with backend.
 */
export async function checkAccessStatus(requestId, deviceId) {
  return await checkAccessViaSupabase(requestId, deviceId);
}

/**
 * Check if a device token has expired.
 */
export function isTokenExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

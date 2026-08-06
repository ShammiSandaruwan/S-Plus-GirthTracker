/**
 * GPS Location Service
 * Handles background GPS capture, refresh, and Google Maps link generation.
 */

const GPS_REFRESH_INTERVAL = Math.max(
  30,
  parseInt(import.meta.env.VITE_GPS_REFRESH_INTERVAL_SECONDS || '180', 10) || 180
) * 1000;

let watchId = null;
let refreshTimer = null;
let lastPosition = null;
const locationListeners = new Set();

/**
 * Build a standardized location result object.
 */
function buildLocationResult(coords, status) {
  if (!coords) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      capturedAt: null,
      status: status || 'unavailable',
      googleMapLink: null,
    };
  }
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    capturedAt: new Date().toISOString(),
    status: status || 'captured',
    googleMapLink: `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`,
  };
}

/**
 * Capture GPS position once. Returns a location result object.
 */
export function captureGPS(timeoutMs = 15000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(buildLocationResult(null, 'unsupported'));
      return;
    }

    const timer = setTimeout(() => {
      resolve(buildLocationResult(null, 'timeout'));
    }, timeoutMs + 1000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        lastPosition = pos.coords;
        resolve(buildLocationResult(pos.coords, 'captured'));
      },
      (err) => {
        clearTimeout(timer);
        let status = 'unavailable';
        if (err.code === 1) status = 'denied';
        else if (err.code === 3) status = 'timeout';
        resolve(buildLocationResult(null, status));
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Start background GPS refresh. Captures at configured intervals.
 * Returns a function to get the latest known location at any time.
 */
export function startBackgroundGPS(onUpdate) {
  stopBackgroundGPS();

  const doCapture = async () => {
    const result = await captureGPS();
    if (result.status === 'captured') {
      onUpdate?.(result);
      locationListeners.forEach(fn => fn(result));
    }
  };

  doCapture();
  refreshTimer = setInterval(doCapture, GPS_REFRESH_INTERVAL);
}

/**
 * Subscribe to location updates
 */
export function onLocationUpdate(fn) {
  locationListeners.add(fn);
}

/**
 * Unsubscribe from location updates
 */
export function offLocationUpdate(fn) {
  locationListeners.delete(fn);
}

/**
 * Get the current location synchronously if available
 */
export function getCurrentLocation() {
  if (!lastPosition) return null;
  return buildLocationResult(lastPosition, 'captured');
}

/**
 * Stop background GPS refresh.
 */
export function stopBackgroundGPS() {
  if (watchId !== null) {
    navigator.geolocation?.clearWatch(watchId);
    watchId = null;
  }
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Get the last known position as a location result.
 */
export function getLastKnownLocation() {
  if (!lastPosition) return buildLocationResult(null, 'unavailable');
  return buildLocationResult(lastPosition, 'captured');
}

/**
 * Format a location status for display.
 */
export function getLocationStatusText(status) {
  switch (status) {
    case 'captured': return 'Location captured';
    case 'denied': return 'Location permission denied';
    case 'timeout': return 'Location timeout';
    case 'unsupported': return 'Location unavailable';
    default: return 'Location unavailable';
  }
}

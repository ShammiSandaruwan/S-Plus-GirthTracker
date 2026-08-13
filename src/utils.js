/**
 * Core measurement utilities for the Girth Tracker app.
 * Extracted as pure functions for testability.
 */

// Caliper reading validation range (inches)
export const MIN_READING = 0;
export const MAX_READING = 30;

export const DEAD_REASON_PRESETS = [
  'Uprooted / fallen',
  'Wind damage',
  'Fire damage',
  'Disease',
  'Severe trunk / root damage',
  'Drought / water stress',
  'Other'
];

export const DAMAGED_REASON_PRESETS = [
  'Animal damage',
  'Porcupine damage',
  'Wind damage',
  'Fire damage',
  'Trunk / bark damage',
  'Other'
];

/**
 * Parse raw caliper buffer string into a numeric reading.
 * Handles comma-as-decimal, non-numeric chars, and calipers that
 * send large integers without a decimal point (e.g. 16385 → 1.6385).
 *
 * @param {string} raw - Raw buffer string from caliper HID input
 * @returns {number|null} Parsed caliper reading in inches, or null if invalid
 */
export function parseCaliperBuffer(raw) {
  const cleaned = raw.trim().replace(/,/g, '.').replace(/[^\d.-]/g, '');
  let value = parseFloat(cleaned);

  if (isNaN(value) || value <= 0) return null;

  // Fallback: if the caliper sent no decimal point at all
  // (e.g. 16385 instead of 1.6385), and the value is abnormally large
  if (value > 1000) {
    value = value / 10000;
  }

  return value;
}

/**
 * Calculate tree girth from a caliper (diameter) reading.
 * Girth = diameter × π, rounded to 2 decimal places.
 *
 * @param {number} caliperReading - Diameter reading in inches
 * @returns {number} Girth in inches, rounded to 2 decimal places
 */
export function calculateGirth(caliperReading) {
  return parseFloat((caliperReading * Math.PI).toFixed(2));
}

/**
 * Validate that a caliper reading falls within the acceptable range.
 *
 * @param {number} reading - Caliper reading in inches
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateReading(reading) {
  if (isNaN(reading) || reading <= 0) {
    return { valid: false, reason: 'Reading must be a positive number' };
  }
  if (reading < MIN_READING) {
    return { valid: false, reason: `Reading ${reading}" is below minimum (${MIN_READING}")` };
  }
  if (reading > MAX_READING) {
    return { valid: false, reason: `Reading ${reading}" exceeds maximum (${MAX_READING}")` };
  }
  return { valid: true };
}

/**
 * Escape a value for safe CSV output.
 * Wraps in double quotes and escapes inner double quotes per RFC 4180.
 *
 * @param {*} val - Value to escape
 * @returns {string} CSV-safe escaped string
 */
export function escCsv(val) {
  return `"${String(val).replace(/"/g, '""')}"`;
}

/**
 * Filter display buffer to show only numeric characters and decimal points.
 * Used to clean Bluetooth HID input that may include unit characters.
 *
 * @param {string} buffer - Raw input buffer
 * @returns {string} Numeric-only display string
 */
export function filterDisplayBuffer(buffer) {
  return buffer.replace(/[^\d.]/g, '');
}

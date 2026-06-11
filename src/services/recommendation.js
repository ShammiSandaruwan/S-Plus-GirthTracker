/**
 * Tapping Recommendation Service
 * Classifies tree girth into tappable, approaching, or not_ready.
 */

const DEFAULT_TAPPABLE_CM = 50;
const DEFAULT_MARGIN_CM = 5;

function getThreshold() {
  const val = parseFloat(import.meta.env.VITE_TAPPABLE_GIRTH_CM);
  return isNaN(val) || val <= 0 ? DEFAULT_TAPPABLE_CM : val;
}

function getMargin() {
  const val = parseFloat(import.meta.env.VITE_APPROACHING_MARGIN_CM);
  return isNaN(val) || val < 0 ? DEFAULT_MARGIN_CM : val;
}

/**
 * Calculate girth in centimeters from girth in inches.
 */
export function girthToCm(girthInches) {
  if (isNaN(girthInches) || girthInches <= 0) return 0;
  return parseFloat((girthInches * 2.54).toFixed(2));
}

/**
 * Get tapping recommendation for a given girth in cm.
 */
export function getRecommendation(girthCm) {
  if (isNaN(girthCm) || girthCm <= 0) {
    return { status: '', text: '' };
  }

  const threshold = getThreshold();
  const margin = getMargin();

  if (girthCm >= threshold) {
    return { status: 'tappable', text: 'Tappable' };
  }
  if (girthCm >= threshold - margin) {
    return { status: 'approaching', text: 'Approaching tapping size' };
  }
  return { status: 'not_ready', text: 'Below tapping size' };
}

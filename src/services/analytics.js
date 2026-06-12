/**
 * Abnormal Reading Analytics Service
 * Detects suspicious readings using z-score analysis.
 */

const DEFAULT_Z_SCORE = 2;

function getZThreshold() {
  const val = parseFloat(import.meta.env.VITE_ABNORMAL_Z_SCORE);
  return isNaN(val) || val <= 0 ? DEFAULT_Z_SCORE : val;
}

/**
 * Calculate mean and standard deviation from an array of numbers.
 */
function calcStats(values) {
  if (!values || values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Check if a girth reading is abnormal based on session data.
 * Returns { abnormalFlag: boolean, abnormalReason: string }
 */
export function checkAbnormal(girthInches, sessionGirths) {
  try {
    if (isNaN(girthInches) || girthInches <= 0) {
      return { abnormalFlag: false, abnormalReason: '' };
    }

    const validGirths = (sessionGirths || []).filter(g => !isNaN(g) && g > 0);

    if (validGirths.length < 10) {
      if (girthInches < 2 || girthInches > 80) {
        return {
          abnormalFlag: true,
          abnormalReason: 'Extreme reading detected.',
        };
      }
      return { abnormalFlag: false, abnormalReason: '' };
    }

    const { mean, stdDev } = calcStats(validGirths);

    if (stdDev === 0) {
      if (Math.abs(girthInches - mean) > 0.01) {
        return {
          abnormalFlag: true,
          abnormalReason: 'Differs from uniform session readings.',
        };
      }
      return { abnormalFlag: false, abnormalReason: '' };
    }

    const zScore = Math.abs((girthInches - mean) / stdDev);
    const threshold = getZThreshold();

    if (zScore > threshold) {
      if (girthInches > mean) {
        return {
          abnormalFlag: true,
          abnormalReason: 'Much higher than current session average.',
        };
      }
      return {
        abnormalFlag: true,
        abnormalReason: 'Much lower than current session average.',
      };
    }

    return { abnormalFlag: false, abnormalReason: '' };
  } catch {
    return { abnormalFlag: false, abnormalReason: '' };
  }
}

/**
 * Calculate field insights from an array of measurements.
 */
export function calculateFieldInsights(measurements) {
  if (!measurements || measurements.length === 0) return null;

  const validGirths = measurements
    .map(m => parseFloat(m.girth))
    .filter(g => !isNaN(g) && g > 0);

  const validGirthsCm = measurements
    .map(m => parseFloat(m.girthCm))
    .filter(g => !isNaN(g) && g > 0);

  if (validGirths.length === 0) return null;

  const total = validGirths.length;
  const sum = validGirths.reduce((s, v) => s + v, 0);
  const avg = parseFloat((sum / total).toFixed(2));
  const min = parseFloat(Math.min(...validGirths).toFixed(2));
  const max = parseFloat(Math.max(...validGirths).toFixed(2));

  const tappableCount = measurements.filter(m => m.recommendationStatus === 'tappable').length;
  const approachingCount = measurements.filter(m => m.recommendationStatus === 'approaching').length;
  const notReadyCount = measurements.filter(m => m.recommendationStatus === 'not_ready').length;
  const abnormalCount = measurements.filter(m => m.abnormalFlag).length;
  const pendingSync = measurements.filter(m => m.syncStatus === 'pending').length;
  const syncedSync = measurements.filter(m => m.syncStatus === 'synced').length;

  const distribution = buildDistribution(validGirthsCm.length > 0 ? validGirthsCm : validGirths);

  return {
    total,
    avg,
    min,
    max,
    tappableCount,
    approachingCount,
    notReadyCount,
    abnormalCount,
    pendingSync,
    syncedSync,
    distribution,
  };
}

/**
 * Build a simple distribution for bar chart rendering.
 */
function buildDistribution(values) {
  if (!values || values.length < 3) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return [{ label: `${min.toFixed(0)}`, count: values.length, pct: 100 }];

  const bucketCount = Math.min(6, Math.max(3, Math.floor(values.length / 3)));
  const step = range / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    min: min + i * step,
    max: min + (i + 1) * step,
    count: 0,
  }));

  values.forEach(v => {
    let idx = Math.floor((v - min) / step);
    if (idx >= bucketCount) idx = bucketCount - 1;
    buckets[idx].count++;
  });

  const maxCount = Math.max(...buckets.map(b => b.count));

  return buckets.map(b => ({
    label: `${b.min.toFixed(0)}–${b.max.toFixed(0)}`,
    count: b.count,
    pct: maxCount > 0 ? Math.round((b.count / maxCount) * 100) : 0,
  }));
}

/**
 * Session Report Service
 * Generates field session reports and handles sharing/export.
 */

/**
 * Generate a session report summary object from measurements.
 */
export function generateSessionReport({ estate, division, fieldNo, extent, operatorName, sessionId, sessionStartedAt, sessionLocation, measurements }) {
  const total = measurements.length;
  const girths = measurements.map(m => parseFloat(m.girth)).filter(g => !isNaN(g) && g > 0);
  const girthsCm = measurements.map(m => parseFloat(m.girthCm)).filter(g => !isNaN(g) && g > 0);

  const avg = girths.length > 0 ? parseFloat((girths.reduce((s, v) => s + v, 0) / girths.length).toFixed(2)) : 0;
  const min = girths.length > 0 ? parseFloat(Math.min(...girths).toFixed(2)) : 0;
  const max = girths.length > 0 ? parseFloat(Math.max(...girths).toFixed(2)) : 0;

  const avgCm = girthsCm.length > 0 ? parseFloat((girthsCm.reduce((s, v) => s + v, 0) / girthsCm.length).toFixed(2)) : 0;

  const tappable = measurements.filter(m => m.recommendationStatus === 'tappable').length;
  const approaching = measurements.filter(m => m.recommendationStatus === 'approaching').length;
  const belowThreshold = measurements.filter(m => m.recommendationStatus === 'not_ready').length;
  const abnormalCount = measurements.filter(m => m.abnormalFlag).length;
  const pendingSync = measurements.filter(m => m.syncStatus === 'pending').length;
  const synced = measurements.filter(m => m.syncStatus === 'synced').length;

  return {
    estate,
    division,
    fieldNo,
    extent,
    operatorName,
    sessionId,
    sessionStartedAt,
    reportGeneratedAt: new Date().toISOString(),
    sessionLocation,
    total,
    avg,
    avgCm,
    min,
    max,
    tappable,
    approaching,
    belowThreshold,
    abnormalCount,
    pendingSync,
    synced,
  };
}

/**
 * Format a report into a shareable text summary.
 */
export function formatReportText(report) {
  const lines = [
    '📊 GirthTracker Field Session Report',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `Estate: ${report.estate}`,
    `Division: ${report.division}`,
    `Field No: ${report.fieldNo}`,
    `Extent: ${report.extent} Ha`,
    `Operator: ${report.operatorName}`,
    '',
    `Session: ${report.sessionId || 'N/A'}`,
    `Started: ${report.sessionStartedAt ? new Date(report.sessionStartedAt).toLocaleString() : 'N/A'}`,
    `Report: ${new Date(report.reportGeneratedAt).toLocaleString()}`,
    '',
    '📏 Measurements',
    `Total: ${report.total}`,
    `Avg Girth: ${report.avg}" / ${report.avgCm} cm`,
    `Min: ${report.min}" | Max: ${report.max}"`,
    '',
    '🌴 Tapping Status',
    `Tappable: ${report.tappable}`,
    `Approaching: ${report.approaching}`,
    `Below threshold: ${report.belowThreshold}`,
    '',
    `⚠️ Abnormal: ${report.abnormalCount}`,
    '',
    '☁️ Sync Status',
    `Pending: ${report.pendingSync} | Synced: ${report.synced}`,
  ];

  if (report.sessionLocation) {
    lines.push('', `📍 Location: ${report.sessionLocation}`);
  }

  lines.push('', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

/**
 * Share report using native share, WhatsApp, clipboard, or text download fallback.
 */
export async function shareReport(reportText) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'GirthTracker Session Report', text: reportText });
      return { method: 'native', success: true };
    } catch (err) {
      if (err.name === 'AbortError') return { method: 'native', success: true, cancelled: true };
    }
  }

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(reportText);
      return { method: 'clipboard', success: true };
    } catch {
      /* fall through */
    }
  }

  try {
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GirthTracker_Report_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    return { method: 'download', success: true };
  } catch {
    return { method: 'none', success: false };
  }
}

/**
 * Share via WhatsApp.
 */
export function shareViaWhatsApp(reportText) {
  const encoded = encodeURIComponent(reportText);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

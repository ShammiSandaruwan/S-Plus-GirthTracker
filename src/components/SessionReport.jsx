import { useState, useMemo } from 'react';
import { FileText, X } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa6';
import { db } from '../db';
import { generateSessionReport, formatReportText, shareViaWhatsApp } from '../services/reports';

/**
 * SessionReport component - generates and shares field session reports.
 */
export default function SessionReport({ settings, onClose }) {
  const [report, setReport] = useState(null);
  const [reportText, setReportText] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareResult, setShareResult] = useState('');

  const canGenerate = useMemo(() => settings?.estate && settings?.fieldNo, [settings]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setShareResult('');

    try {
      let measurements;
      if (settings.sessionId) {
        measurements = await db.measurements
          .where('sessionId')
          .equals(settings.sessionId)
          .toArray();
      } else {
        measurements = await db.measurements
          .where('[estate+fieldNo]')
          .equals([settings.estate, settings.fieldNo])
          .toArray();
      }

      if (measurements.length === 0) {
        setReport(null);
        setReportText('');
        setShareResult('no_data');
        setLoading(false);
        return;
      }

      const r = generateSessionReport({
        estate: settings.estate,
        division: settings.division,
        fieldNo: settings.fieldNo,
        extent: settings.extent,
        operatorName: settings.operatorName || '',
        sessionId: settings.sessionId || '',
        sessionStartedAt: settings.sessionStartedAt || null,
        sessionLocation: settings.lastKnownGoogleMapLink || null,
        measurements,
      });

      const text = formatReportText(r);
      setReport(r);
      setReportText(text);
    } catch {
      setShareResult('error');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    if (!reportText) return;
    shareViaWhatsApp(reportText);
  };

  return (
    <div className="session-report-overlay">
      <div className="glass-card session-report-card">
        <div className="session-report-header">
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}><FileText size={18} style={{ verticalAlign: 'text-bottom' }} /> Session Report</h2>
          <button className="btn-icon" onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        {!report && !loading && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p className="text-muted" style={{ marginBottom: '1rem' }}>
              Generate a summary report for the current field session.
            </p>
            <button className="btn" onClick={handleGenerate} disabled={!canGenerate}>
              <FileText size={18} /> Generate Report
            </button>
            {shareResult === 'no_data' && (
              <p className="text-muted" style={{ marginTop: '1rem', color: 'var(--accent-pending)' }}>
                No measurements in this session yet.
              </p>
            )}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }} className="text-muted">
            Generating report...
          </div>
        )}

        {report && (
          <>
            <div className="report-summary">
              <div className="report-stat-grid">
                <div className="report-stat">
                  <div className="report-stat-value">{report.total}</div>
                  <div className="report-stat-label">Total</div>
                </div>
                <div className="report-stat">
                  <div className="report-stat-value">{report.avg}&quot;</div>
                  <div className="report-stat-label">Avg Girth</div>
                </div>
                <div className="report-stat">
                  <div className="report-stat-value">{report.tappable}</div>
                  <div className="report-stat-label">Tappable</div>
                </div>
                <div className="report-stat">
                  <div className="report-stat-value">{report.abnormalCount}</div>
                  <div className="report-stat-label">Abnormal</div>
                </div>
              </div>
            </div>

            <div className="report-share-actions">
              <button className="btn" onClick={handleWhatsApp} style={{ width: '100%' }}>
                <FaWhatsapp size={18} /> WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

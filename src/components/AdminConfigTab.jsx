import { useState, useEffect } from 'react';
import { Database, RefreshCw, Save } from 'lucide-react';
import { adminCRUD } from '../services/supabaseSync';

export default function AdminConfigTab({ token }) {
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState('');
  
  const [estates, setEstates] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [newMapping, setNewMapping] = useState({ estateId: '', spreadsheetId: '', tabName: '' });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const estRes = await adminCRUD(token, 'list_estates');
        if (estRes.success) setEstates(estRes.estates || []);
        
        const mapRes = await adminCRUD(token, 'list_sheet_mappings');
        if (mapRes.success) setMappings(mapRes.mappings || []);
      } catch (err) {
        setMessage('Error loading config data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token]);

  const handleSaveMapping = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminCRUD(token, 'upsert_sheet_mapping', { ...newMapping, active: true });
      if (res.success) {
        setMessage('Mapping saved successfully.');
        const mapRes = await adminCRUD(token, 'list_sheet_mappings');
        if (mapRes.success) setMappings(mapRes.mappings || []);
        setNewMapping({ estateId: '', spreadsheetId: '', tabName: '' });
      } else {
        setMessage('Failed to save mapping: ' + res.error);
      }
    } catch (err) {
      setMessage('Error saving mapping: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleBackfill = async () => {
    if (!confirm('Run field backfill? This will assign field_id to measurements that have null field_id.')) return;
    setBackfilling(true);
    setMessage('');
    try {
      const res = await adminCRUD(token, 'backfill_fields');
      if (res.success) {
        let msg = `Backfill complete.\nMatched: ${res.matched}\nUnmatched: ${res.unmatched.length}\n`;
        if (res.unmatched.length > 0) {
           msg += 'Unmatched fields:\n' + res.unmatched.map(u => `${u.estate} - ${u.division} - ${u.field_no} (${u.count})`).join('\n');
        }
        setMessage(msg);
      } else {
        setMessage('Backfill failed: ' + res.error);
      }
    } catch (err) {
      setMessage('Error running backfill: ' + err.message);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Database size={18} color="var(--accent-primary)" /> Config & Backfill
      </h3>
      
      {message && (
        <div className="warning-banner" style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', borderColor: '#4caf50', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Field ID Backfill</h4>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Assigns field_id to legacy measurements based on estate, division, and field_no.
          </p>
          <button className="btn" onClick={handleBackfill} disabled={backfilling} style={{ width: 'auto' }}>
            {backfilling ? <RefreshCw className="pulse" size={16} /> : <Database size={16} />} 
            {backfilling ? ' Running...' : ' Run Backfill'}
          </button>
        </div>

        <div style={{ flex: '1 1 300px', padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Sheet Mappings</h4>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Manage Google Sheet export destinations per estate.
          </p>
          
          {mappings.length > 0 && (
            <div style={{ marginBottom: '1rem', background: 'var(--element-bg)', borderRadius: '6px', padding: '0.5rem' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.3rem' }}>Estate</th>
                    <th style={{ padding: '0.3rem' }}>Sheet ID</th>
                    <th style={{ padding: '0.3rem' }}>Tab Name</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.3rem' }}>{m.estates?.name || m.estate_id}</td>
                      <td style={{ padding: '0.3rem', wordBreak: 'break-all' }}>{m.spreadsheet_id}</td>
                      <td style={{ padding: '0.3rem' }}>{m.tab_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={handleSaveMapping} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <select required value={newMapping.estateId} onChange={e => setNewMapping({...newMapping, estateId: e.target.value})} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--element-bg)', color: 'var(--text-main)' }}>
              <option value="">Select Estate...</option>
              {estates.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input required type="text" placeholder="Spreadsheet ID" value={newMapping.spreadsheetId} onChange={e => setNewMapping({...newMapping, spreadsheetId: e.target.value})} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--element-bg)', color: 'var(--text-main)' }} />
            <input type="text" placeholder="Tab Name (Optional)" value={newMapping.tabName} onChange={e => setNewMapping({...newMapping, tabName: e.target.value})} style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--element-bg)', color: 'var(--text-main)' }} />
            <button type="submit" className="btn btn-secondary" disabled={loading} style={{ width: 'auto', padding: '0.4rem' }}>
              {loading ? <RefreshCw className="pulse" size={14} /> : <Save size={14} />} Save Mapping
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

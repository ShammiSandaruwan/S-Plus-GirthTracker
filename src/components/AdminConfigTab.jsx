import { useState, useEffect } from 'react';
import { Database, RefreshCw, Save, CheckCircle, XCircle, Plus, Edit2 } from 'lucide-react';
import { adminCRUD } from '../services/supabaseSync';

function ToggleActive({ active, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', width: 'auto', fontSize: '0.75rem' }}>
      {active ? <><CheckCircle size={12} color="#4caf50" /> Active</> : <><XCircle size={12} color="#f44336" /> Inactive</>}
    </button>
  );
}

export default function AdminConfigTab({ token }) {
  const [activeSubTab, setActiveSubTab] = useState('estates');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [estates, setEstates] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [fields, setFields] = useState([]);
  const [mappings, setMappings] = useState([]);

  // Selection states for cascading
  const [selectedEstateId, setSelectedEstateId] = useState('');
  const [selectedDivisionId, setSelectedDivisionId] = useState('');

  // Editing states
  const [editingEstate, setEditingEstate] = useState(null);
  const [editingDivision, setEditingDivision] = useState(null);
  const [editingField, setEditingField] = useState(null);

  const [newMapping, setNewMapping] = useState({ estateId: '', spreadsheetId: '', tabName: '' });
  const [backfilling, setBackfilling] = useState(false);

  const loadEstates = async () => {
    setLoading(true);
    try {
      const res = await adminCRUD(token, 'list_estates', { includeInactive: true });
      if (res.success) setEstates(res.estates || []);
    } catch (err) { setMessage('Error loading estates: ' + err.message); }
    finally { setLoading(false); }
  };

  const loadMappings = async () => {
    try {
      const res = await adminCRUD(token, 'list_sheet_mappings');
      if (res.success) setMappings(res.mappings || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEstates();
    loadMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadDivisions = async (estateId) => {
    setLoading(true);
    try {
      const res = await adminCRUD(token, 'list_divisions', { estateId, includeInactive: true });
      if (res.success) setDivisions(res.divisions || []);
    } catch (err) { setMessage('Error loading divisions: ' + err.message); }
    finally { setLoading(false); }
  };

  const loadFields = async (divisionId) => {
    setLoading(true);
    try {
      const res = await adminCRUD(token, 'list_fields', { divisionId, includeInactive: true });
      if (res.success) setFields(res.fields || []);
    } catch (err) { setMessage('Error loading fields: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleEstateChange = (val) => {
    setSelectedEstateId(val);
    setSelectedDivisionId('');
    setFields([]);
    if (val) loadDivisions(val);
    else setDivisions([]);
  };

  const handleDivisionChange = (val) => {
    setSelectedDivisionId(val);
    if (val) loadFields(val);
    else setFields([]);
  };



  // --- ESTATES ---
  const handleSaveEstate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isNew = !editingEstate.id;
      const action = isNew ? 'create_estate' : 'update_estate';
      const res = await adminCRUD(token, action, editingEstate);
      if (res.success) {
        setMessage(`Estate ${isNew ? 'created' : 'updated'} successfully.`);
        setEditingEstate(null);
        loadEstates();
      } else setMessage(res.error);
    } catch (err) { setMessage(err.message); }
    finally { setLoading(false); }
  };

  // --- DIVISIONS ---
  const handleSaveDivision = async (e) => {
    e.preventDefault();
    if (!selectedEstateId) return setMessage('Select an estate first.');
    setLoading(true);
    try {
      const isNew = !editingDivision.id;
      const action = isNew ? 'create_division' : 'update_division';
      const payload = { ...editingDivision, estateId: selectedEstateId };
      const res = await adminCRUD(token, action, payload);
      if (res.success) {
        setMessage(`Division ${isNew ? 'created' : 'updated'} successfully.`);
        setEditingDivision(null);
        loadDivisions(selectedEstateId);
      } else setMessage(res.error);
    } catch (err) { setMessage(err.message); }
    finally { setLoading(false); }
  };

  // --- FIELDS ---
  const handleSaveField = async (e) => {
    e.preventDefault();
    if (!selectedEstateId || !selectedDivisionId) return setMessage('Select estate and division first.');
    setLoading(true);
    try {
      const isNew = !editingField.id;
      const action = isNew ? 'create_field' : 'update_field';
      
      if (!isNew && editingField.original_extent_ha !== undefined && editingField.extent_ha !== editingField.original_extent_ha) {
        if (!window.confirm('You are changing the extent of an existing field. This will be audited. Are you sure?')) {
          setLoading(false);
          return;
        }
      }

      const payload = { 
        ...editingField, 
        estateId: selectedEstateId, 
        divisionId: selectedDivisionId,
        fieldCode: editingField.field_code || editingField.fieldCode,
        extentHa: editingField.extent_ha || editingField.extentHa,
        displayName: editingField.display_name || editingField.displayName 
      };
      const res = await adminCRUD(token, action, payload);
      if (res.success) {
        setMessage(`Field ${isNew ? 'created' : 'updated'} successfully.`);
        setEditingField(null);
        loadFields(selectedDivisionId);
      } else setMessage(res.error);
    } catch (err) { setMessage(err.message); }
    finally { setLoading(false); }
  };

  // --- MAPPINGS ---
  const handleSaveMapping = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminCRUD(token, 'upsert_sheet_mapping', { ...newMapping, active: true });
      if (res.success) {
        setMessage('Mapping saved successfully.');
        loadMappings();
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
    if (!window.confirm('Run field backfill? This will assign field_id to measurements that have null field_id.')) return;
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
        <Database size={18} color="var(--accent-primary)" /> Configuration Management
      </h3>
      
      {message && (
        <div className="warning-banner" style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', borderColor: '#4caf50', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {['estates', 'divisions', 'fields', 'mappings'].map(tab => (
          <button key={tab} className={`btn ${activeSubTab === tab ? '' : 'btn-secondary'}`} onClick={() => setActiveSubTab(tab)} style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeSubTab === 'estates' && (
        <div>
          <button className="btn btn-secondary" style={{ width: 'auto', marginBottom: '1rem' }} onClick={() => setEditingEstate({ code: '', name: '', active: true })}>
            <Plus size={16} /> Add Estate
          </button>

          {editingEstate && (
            <form onSubmit={handleSaveEstate} className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--element-bg)' }}>
              <div className="input-row">
                <input required placeholder="Estate Code" value={editingEstate.code} onChange={e => setEditingEstate({...editingEstate, code: e.target.value})} />
                <input required placeholder="Estate Name" value={editingEstate.name} onChange={e => setEditingEstate({...editingEstate, name: e.target.value})} />
                <ToggleActive active={editingEstate.active} onToggle={() => setEditingEstate({...editingEstate, active: !editingEstate.active})} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn" disabled={loading} style={{ width: 'auto' }}>Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingEstate(null)} style={{ width: 'auto' }}>Cancel</button>
              </div>
            </form>
          )}

          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}><th>Code</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {estates.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.4rem' }}>{e.code}</td>
                  <td style={{ padding: '0.4rem' }}>{e.name}</td>
                  <td style={{ padding: '0.4rem' }}>{e.active ? 'Active' : 'Inactive'}</td>
                  <td style={{ padding: '0.4rem' }}>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.2rem' }} onClick={() => setEditingEstate({...e})}>
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'divisions' && (
        <div>
          <select value={selectedEstateId} onChange={e => handleEstateChange(e.target.value)} style={{ padding: '0.5rem', marginBottom: '1rem', width: '100%', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
            <option value="">-- Select Estate --</option>
            {estates.map(e => <option key={e.id} value={e.id}>{e.name} {e.active ? '' : '(Inactive)'}</option>)}
          </select>

          {selectedEstateId && (
            <>
              <button className="btn btn-secondary" style={{ width: 'auto', marginBottom: '1rem' }} onClick={() => setEditingDivision({ code: '', name: '', active: true })}>
                <Plus size={16} /> Add Division
              </button>

              {editingDivision && (
                <form onSubmit={handleSaveDivision} className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--element-bg)' }}>
                  <div className="input-row">
                    <input required placeholder="Division Code" value={editingDivision.code} onChange={e => setEditingDivision({...editingDivision, code: e.target.value})} />
                    <input required placeholder="Division Name" value={editingDivision.name} onChange={e => setEditingDivision({...editingDivision, name: e.target.value})} />
                    <ToggleActive active={editingDivision.active} onToggle={() => setEditingDivision({...editingDivision, active: !editingDivision.active})} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn" disabled={loading} style={{ width: 'auto' }}>Save</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingDivision(null)} style={{ width: 'auto' }}>Cancel</button>
                  </div>
                </form>
              )}

              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}><th>Code</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {divisions.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.4rem' }}>{d.code}</td>
                      <td style={{ padding: '0.4rem' }}>{d.name}</td>
                      <td style={{ padding: '0.4rem' }}>{d.active ? 'Active' : 'Inactive'}</td>
                      <td style={{ padding: '0.4rem' }}>
                        <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.2rem' }} onClick={() => setEditingDivision({...d})}>
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {activeSubTab === 'fields' && (
        <div>
          <div className="input-row" style={{ marginBottom: '1rem' }}>
            <select value={selectedEstateId} onChange={e => handleEstateChange(e.target.value)} style={{ padding: '0.5rem', flex: 1, border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
              <option value="">-- Select Estate --</option>
              {estates.map(e => <option key={e.id} value={e.id}>{e.name} {e.active ? '' : '(Inactive)'}</option>)}
            </select>
            <select value={selectedDivisionId} onChange={e => handleDivisionChange(e.target.value)} style={{ padding: '0.5rem', flex: 1, border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--bg-card)', color: 'var(--text-main)' }} disabled={!selectedEstateId}>
              <option value="">-- Select Division --</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name} {d.active ? '' : '(Inactive)'}</option>)}
            </select>
          </div>

          {selectedDivisionId && (
            <>
              <button className="btn btn-secondary" style={{ width: 'auto', marginBottom: '1rem' }} onClick={() => setEditingField({ field_code: '', display_name: '', extent_ha: '', active: true })}>
                <Plus size={16} /> Add Field
              </button>

              {editingField && (
                <form onSubmit={handleSaveField} className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', background: 'var(--element-bg)' }}>
                  <div className="input-row">
                    <input required placeholder="Field Code" value={editingField.field_code} onChange={e => setEditingField({...editingField, field_code: e.target.value})} />
                    <input placeholder="Display Name" value={editingField.display_name} onChange={e => setEditingField({...editingField, display_name: e.target.value})} />
                    <input required type="number" step="0.01" min="0.01" placeholder="Extent (Ha)" value={editingField.extent_ha} onChange={e => setEditingField({...editingField, extent_ha: e.target.value})} />
                    <ToggleActive active={editingField.active} onToggle={() => setEditingField({...editingField, active: !editingField.active})} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn" disabled={loading} style={{ width: 'auto' }}>Save</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingField(null)} style={{ width: 'auto' }}>Cancel</button>
                  </div>
                </form>
              )}

              <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}><th>Code</th><th>Name</th><th>Extent (Ha)</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {fields.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.4rem' }}>{f.field_code}</td>
                      <td style={{ padding: '0.4rem' }}>{f.display_name || '—'}</td>
                      <td style={{ padding: '0.4rem' }}>{f.extent_ha}</td>
                      <td style={{ padding: '0.4rem' }}>{f.active ? 'Active' : 'Inactive'}</td>
                      <td style={{ padding: '0.4rem' }}>
                        <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.2rem' }} onClick={() => setEditingField({...f, original_extent_ha: f.extent_ha})}>
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {activeSubTab === 'mappings' && (
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
      )}
    </div>
  );
}

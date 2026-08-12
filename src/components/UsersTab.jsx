import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Plus, Edit2, User, Shield } from 'lucide-react';

const ROLE_BADGE = {
  superadmin: { label: 'SuperAdmin', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  admin:      { label: 'Admin',      color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  manager:    { label: 'Manager',    color: '#9e9e9e', bg: 'rgba(158, 158, 158, 0.12)' },
};

function RoleBadge({ role }) {
  const c = ROLE_BADGE[role] || ROLE_BADGE.manager;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.15rem 0.5rem', borderRadius: '999px',
      background: c.bg, color: c.color, fontSize: '0.75rem', fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <Shield size={11} /> {c.label}
    </span>
  );
}

function EstateAssignmentBadges({ assignments }) {
  if (!assignments || assignments.length === 0) {
    return <span className="text-muted" style={{ fontSize: '0.78rem', fontStyle: 'italic' }}>None</span>;
  }

  const now = new Date();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
      {assignments.map((a, i) => {
        const name = a.estates?.name || a.estates?.code || 'Unknown';
        const isExpired = a.expires_at && new Date(a.expires_at) <= now;
        const expiringSoon = a.expires_at && !isExpired && (new Date(a.expires_at) - now) < 7 * 24 * 60 * 60 * 1000;

        let badgeStyle = {
          display: 'inline-block',
          padding: '0.1rem 0.4rem',
          borderRadius: '4px',
          fontSize: '0.72rem',
          fontWeight: 500,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-color)',
        };

        if (isExpired) {
          badgeStyle = { ...badgeStyle, textDecoration: 'line-through', opacity: 0.5, color: 'var(--text-muted)' };
        } else if (expiringSoon) {
          badgeStyle = { ...badgeStyle, borderColor: '#f59e0b', color: '#f59e0b' };
        }

        const expiryLabel = a.expires_at
          ? (isExpired ? `Expired ${formatShortDate(a.expires_at)}` : `Until ${formatShortDate(a.expires_at)}`)
          : null;

        return (
          <span key={a.estate_id || i} style={badgeStyle} title={expiryLabel || 'Permanent'}>
            {name}
            {expiryLabel && <span style={{ fontSize: '0.65rem', marginLeft: '0.2rem', opacity: 0.8 }}> ({expiryLabel})</span>}
          </span>
        );
      })}
    </div>
  );
}

function formatShortDate(val) {
  if (!val) return '-';
  try {
    return new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(val);
  }
}

export default function UsersTab({ token, onAuthError }) {
  const [users, setUsers] = useState([]);
  const [estates, setEstates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false); // 'invite' | 'edit' | false
  const [editingUser, setEditingUser] = useState(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('manager');
  const [formActive, setFormActive] = useState(true);
  const [formAssignments, setFormAssignments] = useState([]); // [{ estateId, expiresAt }]
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'list_admin_users', {});
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      if (err.message && err.message.includes('Invalid or expired')) {
        onAuthError(err.message);
      } else {
        setError('Failed to load users: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, onAuthError]);

  const loadEstates = useCallback(async () => {
    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const data = await adminCRUD(token, 'list_estates', { includeInactive: false });
      if (data.success) {
        setEstates(data.estates || []);
      }
    } catch {
      // Non-critical - form will just lack estate options
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
    loadEstates();
  }, [loadUsers, loadEstates]);

  const openInviteModal = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormName('');
    setFormRole('manager');
    setFormActive(true);
    setFormAssignments([]);
    setFormError('');
    setShowModal('invite');
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormName(user.name || '');
    setFormRole(user.role);
    setFormActive(user.active);
    setFormAssignments(
      (user.admin_user_estates || []).map(a => ({
        estateId: a.estate_id,
        expiresAt: a.expires_at || '',
      }))
    );
    setFormError('');
    setShowModal('edit');
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormError('');
  };

  // Estate assignment helpers
  const addEstateAssignment = () => {
    setFormAssignments(prev => [...prev, { estateId: '', expiresAt: '' }]);
  };

  const removeEstateAssignment = (idx) => {
    setFormAssignments(prev => prev.filter((_, i) => i !== idx));
  };

  const updateEstateAssignment = (idx, field, value) => {
    setFormAssignments(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  // Client-side validation
  const validateForm = () => {
    if (showModal === 'invite' && !formEmail) return 'Email is required';
    if (!formRole) return 'Role is required';

    if (formRole === 'superadmin') return null; // no estate assignments needed

    const validAssignments = formAssignments.filter(a => a.estateId);
    if (formRole === 'manager' && validAssignments.length !== 1) {
      return 'Managers must be assigned exactly one estate';
    }
    if (formRole === 'admin' && validAssignments.length === 0) {
      return 'Admins must be assigned at least one estate';
    }

    const now = new Date();
    const hasPastExpiry = validAssignments.find(a => a.expiresAt && new Date(a.expiresAt) <= now);
    if (hasPastExpiry) return 'Expiry dates must be in the future';

    const estateIdSet = new Set();
    for (const a of validAssignments) {
      if (estateIdSet.has(a.estateId)) return 'Duplicate estate assignment';
      estateIdSet.add(a.estateId);
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const { adminCRUD } = await import('../services/supabaseSync');
      const validAssignments = formAssignments
        .filter(a => a.estateId)
        .map(a => ({ estateId: a.estateId, expiresAt: a.expiresAt || null }));

      if (showModal === 'invite') {
        await adminCRUD(token, 'invite_admin_user', {
          email: formEmail.trim(),
          name: formName.trim() || null,
          role: formRole,
          estateAssignments: formRole === 'superadmin' ? [] : validAssignments,
        });
        setSuccess(`Invite sent to ${formEmail.trim()}`);
      } else {
        await adminCRUD(token, 'update_admin_user', {
          id: editingUser.id,
          role: formRole,
          active: formActive,
          estateAssignments: formRole === 'superadmin' ? [] : validAssignments,
        });
        setSuccess(`User ${editingUser.email} updated`);
      }

      closeModal();
      await loadUsers();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      if (err.message && err.message.includes('Invalid or expired')) {
        onAuthError(err.message);
      } else {
        // Parse specific error types for inline display
        const msg = err.message || 'Unknown error';
        setFormError(msg);
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Determine if email error (409)
  const isEmailError = formError && (formError.includes('already exists') || formError.includes('already registered'));
  const isDeliveryError = formError && formError.includes('Failed to send invite');
  const isPermissionError = formError && formError.includes('Forbidden');

  // Available estates not yet assigned in form
  const availableEstates = useMemo(() => {
    const assignedIds = new Set(formAssignments.map(a => a.estateId));
    return estates.filter(e => !assignedIds.has(e.id));
  }, [estates, formAssignments]);

  // Max estates for the role
  const maxEstates = formRole === 'manager' ? 1 : Infinity;
  const canAddMore = formRole !== 'superadmin' && formAssignments.length < maxEstates && availableEstates.length > 0;

  return (
    <>
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} /> User Management ({users.length})
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={loadUsers} disabled={loading} style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
              {loading ? <RefreshCw className="pulse" size={14} /> : <RefreshCw size={14} />} Refresh
            </button>
            <button className="btn" onClick={openInviteModal} style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
              <Plus size={14} /> Invite User
            </button>
          </div>
        </div>

        {error && (
          <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '0.75rem' }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {success && (
          <div className="warning-banner" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#2e7d32', borderColor: '#4caf50', marginBottom: '0.75rem' }}>
            <CheckCircle2 size={14} /> {success}
          </div>
        )}

        {loading && users.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>No admin users found.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="admin-table-desktop">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Email</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Role</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Estates</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Created</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: u.active ? 1 : 0.5 }}>
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500 }}>{u.email}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{u.name || '-'}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}><RoleBadge role={u.role} /></td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          {u.role === 'superadmin'
                            ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f59e0b' }}>All</span>
                            : <EstateAssignmentBadges assignments={u.admin_user_estates} />
                          }
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                          {u.active
                            ? <span style={{ color: '#4caf50', fontSize: '0.78rem', fontWeight: 600 }}><CheckCircle2 size={12} style={{ verticalAlign: 'middle' }} /> Active</span>
                            : <span style={{ color: '#f44336', fontSize: '0.78rem', fontWeight: 600 }}><XCircle size={12} style={{ verticalAlign: 'middle' }} /> Inactive</span>
                          }
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatShortDate(u.created_at)}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => openEditModal(u)}
                            style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="admin-table-mobile">
              {users.map((u) => (
                <div key={u.id} className="admin-field-card" style={{ opacity: u.active ? 1 : 0.55 }}>
                  <div className="admin-field-card-header">
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <User size={14} /> {u.email}
                    </span>
                    <RoleBadge role={u.role} />
                  </div>
                  {u.name && (
                    <div className="admin-field-card-meta">Name: {u.name}</div>
                  )}
                  <div className="admin-field-card-meta">
                    Status: {u.active ? 'Active' : 'Inactive'} | Created: {formatShortDate(u.created_at)}
                  </div>
                  <div style={{ marginTop: '0.3rem', marginBottom: '0.4rem' }}>
                    {u.role === 'superadmin'
                      ? <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f59e0b' }}>All Estates</span>
                      : <EstateAssignmentBadges assignments={u.admin_user_estates} />
                    }
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => openEditModal(u)}
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', marginTop: '0.3rem' }}
                  >
                    <Edit2 size={14} /> Edit User
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Invite / Edit Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%', maxWidth: '520px', maxHeight: '90vh',
              overflow: 'auto', padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {showModal === 'invite' ? <><Plus size={18} /> Invite User</> : <><Edit2 size={18} /> Edit User</>}
              </h3>
              <button
                onClick={closeModal}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
                  color: 'var(--text-color)', cursor: 'pointer', width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', fontWeight: 'bold'
                }}
              >✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Email {showModal === 'invite' && '*'}</label>
                {showModal === 'invite' ? (
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => { setFormEmail(e.target.value); if (isEmailError) setFormError(''); }}
                    placeholder="user@example.com"
                    required
                    style={{ fontSize: '0.9rem' }}
                  />
                ) : (
                  <input type="email" value={formEmail} readOnly disabled style={{ fontSize: '0.9rem', opacity: 0.6 }} />
                )}
                {isEmailError && (
                  <div style={{ color: '#f44336', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                    <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> {formError}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Optional display name"
                  style={{ fontSize: '0.9rem' }}
                />
              </div>

              {/* Role */}
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Role *</label>
                <select
                  value={formRole}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    setFormRole(newRole);
                    // Reset assignments when switching to superadmin or constraining to 1 for manager
                    if (newRole === 'superadmin') {
                      setFormAssignments([]);
                    } else if (newRole === 'manager' && formAssignments.length > 1) {
                      setFormAssignments([formAssignments[0]]);
                    } else if (newRole !== 'superadmin' && formAssignments.length === 0) {
                      setFormAssignments([{ estateId: '', expiresAt: '' }]);
                    }
                  }}
                  style={{ fontSize: '0.9rem' }}
                >
                  <option value="superadmin">SuperAdmin - All estates, full access</option>
                  <option value="admin">Admin - Multiple estates, view-only</option>
                  <option value="manager">Manager - Single estate, view-only</option>
                </select>
              </div>

              {/* Active toggle (edit mode only) */}
              {showModal === 'edit' && (
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    Account Active
                  </label>
                  {!formActive && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Inactive users cannot access the dashboard. Their session is rejected on next request.
                    </div>
                  )}
                </div>
              )}

              {/* Estate Assignments (hidden for superadmin) */}
              {formRole !== 'superadmin' && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                    Estate Assignments *
                    <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      {formRole === 'manager' ? '(exactly 1)' : '(1 or more)'}
                    </span>
                  </label>

                  {formAssignments.map((a, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: '1 1 180px', marginBottom: 0 }}>
                        {idx === 0 && <label style={{ fontSize: '0.78rem' }}>Estate</label>}
                        <select
                          value={a.estateId}
                          onChange={(e) => updateEstateAssignment(idx, 'estateId', e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        >
                          <option value="">Select estate...</option>
                          {estates.map(est => {
                            // Show this estate if it's the currently selected one, or if it's not assigned elsewhere
                            const isCurrentSelection = est.id === a.estateId;
                            const isAssignedElsewhere = formAssignments.some((other, otherIdx) => otherIdx !== idx && other.estateId === est.id);
                            if (!isCurrentSelection && isAssignedElsewhere) return null;
                            return <option key={est.id} value={est.id}>{est.name}</option>;
                          })}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: '1 1 160px', marginBottom: 0 }}>
                        {idx === 0 && <label style={{ fontSize: '0.78rem' }}>Expires (optional)</label>}
                        <input
                          type="datetime-local"
                          value={a.expiresAt ? a.expiresAt.slice(0, 16) : ''}
                          onChange={(e) => updateEstateAssignment(idx, 'expiresAt', e.target.value ? new Date(e.target.value).toISOString() : '')}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEstateAssignment(idx)}
                        style={{
                          background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)',
                          borderRadius: '6px', color: '#f44336', cursor: 'pointer',
                          padding: '0.35rem 0.5rem', fontSize: '0.78rem', minHeight: '36px',
                        }}
                        title="Remove"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  ))}

                  {canAddMore && (
                    <button
                      type="button"
                      onClick={addEstateAssignment}
                      className="btn btn-secondary"
                      style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.78rem', marginTop: '0.3rem' }}
                    >
                      <Plus size={12} /> Add Estate
                    </button>
                  )}
                </div>
              )}

              {/* Error display */}
              {isDeliveryError && (
                <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                  <AlertTriangle size={14} /> The invite email could not be sent. This is usually an operational issue (e.g. SMTP not configured). The user was not created.
                </div>
              )}
              {isPermissionError && (
                <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                  <AlertTriangle size={14} /> Permission denied. Only SuperAdmins can manage users.
                </div>
              )}
              {formError && !isEmailError && !isDeliveryError && !isPermissionError && (
                <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                  <AlertTriangle size={14} /> {formError}
                </div>
              )}

              {/* Submit */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  className="btn"
                  disabled={formSubmitting}
                  style={{ flex: 1, minHeight: '44px' }}
                >
                  {formSubmitting
                    ? <><RefreshCw className="pulse" size={16} /> {showModal === 'invite' ? 'Sending Invite...' : 'Saving...'}</>
                    : <><CheckCircle2 size={16} /> {showModal === 'invite' ? 'Send Invite' : 'Save Changes'}</>
                  }
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  style={{ width: 'auto', padding: '0.4rem 1rem' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

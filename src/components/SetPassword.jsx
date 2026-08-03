import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Lock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let authListener;

    const initAuth = async () => {
      // Supabase automatically parses the URL hash (#access_token=...) and establishes a session.
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        setSession(currentSession);
        setCheckingSession(false);
      }

      // Listen for changes in case the hash is processed slightly after mount
      const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (newSession) {
          setSession(newSession);
          setCheckingSession(false);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setCheckingSession(false);
        }
      });
      authListener = data;
      
      // If we still don't have a session after 2 seconds, stop checking
      setTimeout(() => {
        setCheckingSession(false);
      }, 2000);
    };

    initAuth();

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/mod';
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="admin-login-page">
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="pulse" size={32} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
          <p>Verifying invite link...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-login-page">
        <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
          <AlertTriangle size={48} color="#f44336" style={{ marginBottom: '1rem' }} />
          <h1 style={{ margin: '0 0 0.5rem 0' }}>Invalid Link</h1>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>
            This invite link is invalid or has expired. Please request a new invite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-page">
      <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '2rem', textAlign: 'center' }}>
        <Lock size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
        <h1 style={{ margin: '0 0 0.5rem 0' }}>Set Your Password</h1>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>
          Welcome! Please set a password for your admin account.
        </p>

        {error && (
          <div className="warning-banner" style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#f44336', borderColor: '#f44336', marginBottom: '1rem' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="warning-banner" style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', borderColor: '#4caf50', marginBottom: '1rem' }}>
            <CheckCircle2 size={16} /> Password updated successfully! Redirecting...
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                style={{ textAlign: 'center', fontSize: '1rem' }}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                style={{ textAlign: 'center', fontSize: '1rem' }}
                required
              />
            </div>
            <button type="submit" className="btn" disabled={loading} style={{ minHeight: '44px' }}>
              {loading ? <RefreshCw className="pulse" size={20} /> : <CheckCircle2 size={20} />}
              {loading ? 'Saving...' : 'Set Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

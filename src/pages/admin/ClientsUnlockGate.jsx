import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { api } from '../../api/client';
import PasswordField from '../../components/PasswordField';

/**
 * Opens the Clients module the way the admin chose in Settings -> Admin Security:
 * a separate Secondary Password, or a code emailed to them (Two-Factor).
 */
export default function ClientsUnlockGate() {
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [method, setMethod] = useState('secondary');
  const [secondarySet, setSecondarySet] = useState(true);
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const check = () => {
    setChecking(true);
    api('/admin/clients/unlock-status')
      .then((d) => {
        setUnlocked(!!d.unlocked);
        setMethod(d.method === '2fa' ? '2fa' : 'secondary');
        setSecondarySet(d.secondary_password_set !== false);
      })
      .catch(() => setUnlocked(false))
      .finally(() => setChecking(false));
  };

  useEffect(() => { check(); }, []);

  const sendOtp = async () => {
    setBusy(true);
    setErr('');
    try {
      const d = await api('/admin/clients/unlock/otp', { method: 'POST', body: {} });
      setSentTo(d.email || '');
      setDevOtp(d._dev_otp ?? null);
      setOtp('');
    } catch (ex) {
      setErr(ex.message || 'Could not send the code');
    } finally {
      setBusy(false);
    }
  };

  const unlock = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/admin/clients/unlock', { method: 'POST', body: method === '2fa' ? { otp } : { password } });
      setPassword('');
      setOtp('');
      setUnlocked(true);
    } catch (ex) {
      setErr(ex.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <p>Verifying access…</p>;

  if (!unlocked) {
    return (
      <div className="bp-card" style={{ maxWidth: 440 }}>
        <h2 style={{ marginTop: 0 }}>Clients Access</h2>

        {method === '2fa' ? (
          <>
            <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>
              A verification code will be emailed to you before the Clients list opens.
            </p>
            {!sentTo ? (
              <button type="button" className="bp-btn bp-btn-primary" onClick={sendOtp} disabled={busy}>
                {busy ? 'Sending…' : 'Send verification code'}
              </button>
            ) : (
              <form onSubmit={unlock} className="bp-form" style={{ display: 'grid', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13 }}>Enter the 6-digit code sent to <strong>{sentTo}</strong> (valid for 5 minutes).</p>
                <input
                  className="bp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="------"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ letterSpacing: 8, textAlign: 'center', fontSize: 20, fontWeight: 700 }}
                  required
                  autoFocus
                />
                {devOtp && <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>Dev mode code: <strong>{devOtp}</strong></p>}
                <button type="submit" className="bp-btn bp-btn-primary" disabled={busy || otp.length !== 6}>
                  {busy ? 'Verifying…' : 'Unlock Clients'}
                </button>
                <button type="button" className="bp-btn bp-btn-outline" onClick={sendOtp} disabled={busy}>Resend code</button>
              </form>
            )}
          </>
        ) : !secondarySet ? (
          <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>
            No secondary password has been set yet. Set one under{' '}
            <Link to="/admin/settings" style={{ fontWeight: 600 }}>Settings → Admin Security</Link>, then come back here.
          </p>
        ) : (
          <>
            <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>
              Enter your secondary password to view and manage client records.
            </p>
            <form onSubmit={unlock} className="bp-form" style={{ display: 'grid', gap: 12 }}>
              <PasswordField
                label="Secondary Password"
                className="bp-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="off"
              />
              <button type="submit" className="bp-btn bp-btn-primary" disabled={busy}>
                {busy ? 'Verifying…' : 'Unlock Clients'}
              </button>
            </form>
          </>
        )}

        {err && <p style={{ color: 'var(--bp-red)', margin: '12px 0 0' }}>{err}</p>}
      </div>
    );
  }

  return <Outlet />;
}

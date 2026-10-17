import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { api } from '../../api/client';
import PasswordField from '../../components/PasswordField';
import { OTP_RESEND_SECONDS, useCountdown } from '../../hooks/useCountdown';

const CSS = `
.cua-wrap { display: flex; justify-content: center; padding: 36px 12px 52px; background: radial-gradient(600px 240px at 50% 0%, rgba(29,95,224,0.08), transparent 70%); }
.cua-card { position: relative; width: 100%; max-width: 440px; background: #fff; border: 1px solid #e3eaf5; border-radius: 16px; padding: 36px 34px 24px; text-align: center; overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 24px 48px -24px rgba(15,42,95,0.28); }
.cua-card::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: linear-gradient(90deg, #0f2a5f, #2f6fe8 55%, #0f2a5f); }
.cua-badge { width: 60px; height: 60px; border-radius: 16px; margin: 0 auto 18px; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, #1d4fb8, #0f2a5f); box-shadow: 0 12px 22px -10px rgba(15,42,95,0.7), inset 0 1px 0 rgba(255,255,255,0.18); }
.cua-badge svg { stroke: #fff; width: 26px; height: 26px; }
.cua-badge svg circle { fill: #fff; }
.cua-title { margin: 0 0 6px; font-size: 22px; font-weight: 800; color: #0f2a5f; letter-spacing: -0.2px; }
.cua-sub { margin: 0 auto 26px; max-width: 330px; font-size: 13.5px; line-height: 1.6; color: #64748b; }
.cua-card form { text-align: left; }
.cua-card label { font-size: 12.5px; font-weight: 700; color: #334155; letter-spacing: .1px; }
.cua-card .bp-input { height: 46px; border-radius: 10px; border: 1.5px solid #d3deef; background: #f8fbff; font-size: 14.5px; transition: border-color .15s, box-shadow .15s, background .15s; }
.cua-card .bp-input:focus { background: #fff; border-color: #1d5fe0; box-shadow: 0 0 0 4px rgba(29,95,224,0.13); outline: none; }
.cua-card .bp-btn-primary { height: 46px; border-radius: 10px; border: none; font-size: 14.5px; font-weight: 700; letter-spacing: .2px; background: linear-gradient(135deg, #1d5fe0, #0f2a5f); box-shadow: 0 12px 22px -12px rgba(15,42,95,0.85); transition: transform .15s, box-shadow .15s, filter .15s; width: 100%; }
.cua-card .bp-btn-primary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); box-shadow: 0 16px 26px -12px rgba(15,42,95,0.9); }
.cua-card .bp-btn-primary:disabled { opacity: .6; }
.cua-card .bp-btn-outline { height: 42px; border-radius: 10px; width: 100%; font-weight: 600; }
.cua-card p[style] { text-align: center; }
.cua-err { margin: 14px 0 0; padding: 10px 14px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 13px; font-weight: 600; text-align: left; }
.cua-foot { margin-top: 22px; padding-top: 14px; border-top: 1px solid #eef2f7; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: #94a3b8; }
@media (max-width: 480px) { .cua-card { padding: 30px 20px 20px; } .cua-title { font-size: 20px; } }
`;

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
  const resend = useCountdown();

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
      resend.start(OTP_RESEND_SECONDS);
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
      const m = String(ex.message || '');
      setErr(/unauthenticated/i.test(m)
        ? 'Your login session has expired. Please log in again, then unlock Clients.'
        : (m || 'Unlock failed'));
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <p>Verifying access…</p>;

  if (!unlocked) {
    return (
      <div className="cua-wrap">
        <style>{CSS}</style>
        <div className="cua-card">
        <div className="cua-badge" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><circle cx="12" cy="16" r="1.3" /></svg>
        </div>
        <h2 className="cua-title">Clients Access</h2>
        <p className="cua-sub">Client records are protected. Please verify your identity to continue.</p>

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
                <button type="button" className="bp-btn bp-btn-outline" onClick={sendOtp} disabled={busy || resend.left > 0}>{resend.left > 0 ? `Resend code (${resend.label})` : 'Resend code'}</button>
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

        {err && (
          <p className="cua-err">
            {err}
            {/session has expired/i.test(err) && (<> <Link to="/login" style={{ color: '#b91c1c', fontWeight: 800, textDecoration: 'underline' }}>Go to Login</Link></>)}
          </p>
        )}
        <div className="cua-foot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          Access remains unlocked for your current session only.
        </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

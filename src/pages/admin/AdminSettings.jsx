import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminSettings() {
  const [loginMethod, setLoginMethod] = useState('password');
  const [clientVerify, setClientVerify] = useState('secondary');
  const [secNotice, setSecNotice] = useState(null); // { type, text } for the two radio groups

  // The chosen methods are real settings (saved on the server), not just screen state.
  useEffect(() => {
    api('/admin/settings/security')
      .then((d) => {
        setLoginMethod(d.login_method === '2fa' ? '2fa' : 'password');
        setClientVerify(d.clients_verify === '2fa' ? '2fa' : 'secondary');
      })
      .catch(() => { });
  }, []);

  const saveMethod = async (patch, apply, successText) => {
    setSecNotice(null);
    try {
      await api('/admin/settings/security', { method: 'PUT', body: patch });
      apply();
      setSecNotice({ type: 'success', text: successText });
    } catch (ex) {
      setSecNotice({ type: 'error', text: ex.message || 'Could not save the setting.' });
    }
  };

  // Admin password change
  const [aPwd, setAPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [aPwdState, setAPwdState] = useState({ busy: false, msg: '', err: '' });

  // Secondary password (client module access)
  const [sPwd, setSPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [sPwdState, setSPwdState] = useState({ busy: false, msg: '', err: '' });

  const changeAdminPwd = async (e) => {
    e.preventDefault();
    if (aPwd.newPwd !== aPwd.confirm) {
      return setAPwdState({ busy: false, msg: '', err: 'Passwords do not match.' });
    }
    setAPwdState({ busy: true, msg: '', err: '' });
    try {
      const res = await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: aPwd.current, password: aPwd.newPwd, password_confirmation: aPwd.confirm },
      });
      setAPwdState({ busy: false, msg: res.message || 'Password updated successfully.', err: '' });
      setAPwd({ current: '', newPwd: '', confirm: '' });
    } catch (ex) {
      setAPwdState({ busy: false, msg: '', err: ex.message || 'Password update failed.' });
    }
  };

  const changeSecondaryPwd = async (e) => {
    e.preventDefault();
    if (sPwd.newPwd !== sPwd.confirm) {
      return setSPwdState({ busy: false, msg: '', err: 'Passwords do not match.' });
    }
    setSPwdState({ busy: true, msg: '', err: '' });
    try {
      const res = await api('/admin/settings/secondary-password', {
        method: 'POST',
        body: { current_password: sPwd.current, password: sPwd.newPwd, password_confirmation: sPwd.confirm },
      });
      setSPwdState({ busy: false, msg: res.message || 'Secondary password updated successfully.', err: '' });
      setSPwd({ current: '', newPwd: '', confirm: '' });
    } catch (ex) {
      setSPwdState({ busy: false, msg: '', err: ex.message || 'Secondary password update failed.' });
    }
  };

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 40px', color: '#1e293b' }}>

      {secNotice && (
        <div style={{
          marginBottom: 12, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: secNotice.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${secNotice.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: secNotice.type === 'success' ? '#166534' : '#b91c1c',
        }}>
          {secNotice.type === 'success' ? '✓ ' : '✕ '}{secNotice.text}
        </div>
      )}

      {/* Top Breadcrumbs */}
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#64748b', cursor: 'pointer' }}>&lt; Settings</span>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <span style={{ color: '#1d4ed8', fontWeight: 600 }}>Admin Security</span>
      </div>

      {/* Header with rounded lock square */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 46,
          height: 46,
          borderRadius: 10,
          background: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1d4ed8',
          flexShrink: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
            Admin Security
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
            Manage your admin login security and client module access settings.
          </p>
        </div>
      </div>

      {/* ── Section 1: Admin Login Security ─────────────────────────── */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 22,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
      }}>
        {/* Banner */}
        <div style={{
          background: '#0052cc',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
              1. Admin Login Security
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255, 255, 255, 0.88)', marginTop: 2 }}>
              Select how you want to login to the Admin Portal.
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '20px 22px',
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: 28,
        }}>
          {/* Left: Login Method */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', marginBottom: 12 }}>
              Login Method
            </div>

            <RadioOption
              selected={loginMethod === 'password'}
              onSelect={() => saveMethod({ login_method: 'password' }, () => setLoginMethod('password'), 'Admin login now uses password only.')}
              title="Only Password"
              desc="Login using username/email and password only."
            />

            <RadioOption
              selected={loginMethod === '2fa'}
              onSelect={() => saveMethod({ login_method: '2fa' }, () => setLoginMethod('2fa'), 'Admin login now needs your password and an emailed code.')}
              title="Two-Factor Authentication (Email OTP)"
              desc="Login using password and OTP sent to your registered email."
            />
          </div>

          {/* Right: Change Admin Password */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              Change Admin Password
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3, marginBottom: 14 }}>
              Set or change your admin login password.
            </div>

            <form onSubmit={changeAdminPwd}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <PwdInput
                  label="Current Password"
                  value={aPwd.current}
                  onChange={e => setAPwd(v => ({ ...v, current: e.target.value }))}
                  required
                />
                <PwdInput
                  label="New Password"
                  value={aPwd.newPwd}
                  onChange={e => setAPwd(v => ({ ...v, newPwd: e.target.value }))}
                  required
                />
                <PwdInput
                  label="Confirm New Password"
                  value={aPwd.confirm}
                  onChange={e => setAPwd(v => ({ ...v, confirm: e.target.value }))}
                  required
                />
              </div>

              {/* Bottom row: Info banner on left + Update Password button on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 14 }}>
                <InfoHint text="Password must be at least 8 characters with a combination of letters, numbers and special characters." />

                <button
                  type="submit"
                  disabled={aPwdState.busy}
                  style={{
                    padding: '9px 22px',
                    background: '#1d4ed8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: aPwdState.busy ? 'not-allowed' : 'pointer',
                    opacity: aPwdState.busy ? 0.7 : 1,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {aPwdState.busy ? 'Updating...' : 'Update Password'}
                </button>
              </div>

              {aPwdState.msg && (
                <div style={{ marginTop: 10, color: '#16a34a', fontSize: 12.5, fontWeight: 600 }}>
                  ✓ {aPwdState.msg}
                </div>
              )}
              {aPwdState.err && (
                <div style={{ marginTop: 10, color: '#dc2626', fontSize: 12.5, fontWeight: 600 }}>
                  ✕ {aPwdState.err}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* ── Section 2: Client Module Access Verification ───────────── */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
      }}>
        {/* Banner */}
        <div style={{
          background: '#0052cc',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
              2. Client Module Access Verification
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255, 255, 255, 0.88)', marginTop: 2 }}>
              Before opening the Clients menu, a verification step will be required.
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '20px 22px',
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: 28,
        }}>
          {/* Left: Verification Method */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', marginBottom: 12 }}>
              Verification Method
            </div>

            <RadioOption
              selected={clientVerify === 'secondary'}
              onSelect={() => saveMethod({ clients_verify: 'secondary' }, () => setClientVerify('secondary'), 'The Clients list will ask for your secondary password.')}
              title="Secondary Password"
              desc="Enter a separate password to access the Client List."
            />

            <RadioOption
              selected={clientVerify === '2fa'}
              onSelect={() => saveMethod({ clients_verify: '2fa' }, () => setClientVerify('2fa'), 'The Clients list will ask for a code emailed to you.')}
              title="Two-Factor Authentication (Email OTP)"
              desc="Receive an OTP on your registered email to access the Client List."
            />
          </div>

          {/* Right: Set / Change Secondary Password */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
              Set / Change Secondary Password
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3, marginBottom: 14 }}>
              Create or update the secondary password for Client module access.
            </div>

            <form onSubmit={changeSecondaryPwd}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <PwdInput
                  label="Current Password"
                  value={sPwd.current}
                  onChange={e => setSPwd(v => ({ ...v, current: e.target.value }))}
                  required
                />
                <PwdInput
                  label="New Password"
                  value={sPwd.newPwd}
                  onChange={e => setSPwd(v => ({ ...v, newPwd: e.target.value }))}
                  required
                />
                <PwdInput
                  label="Confirm New Password"
                  value={sPwd.confirm}
                  onChange={e => setSPwd(v => ({ ...v, confirm: e.target.value }))}
                  required
                />
              </div>

              {/* Bottom row: Info banner on left + Update Password button on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 14 }}>
                <InfoHint text="Password must be at least 8 characters with a combination of letters, numbers and special characters." />

                <button
                  type="submit"
                  disabled={sPwdState.busy}
                  style={{
                    padding: '9px 22px',
                    background: '#1d4ed8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: sPwdState.busy ? 'not-allowed' : 'pointer',
                    opacity: sPwdState.busy ? 0.7 : 1,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {sPwdState.busy ? 'Updating...' : 'Update Password'}
                </button>
              </div>

              {sPwdState.msg && (
                <div style={{ marginTop: 10, color: '#16a34a', fontSize: 12.5, fontWeight: 600 }}>
                  ✓ {sPwdState.msg}
                </div>
              )}
              {sPwdState.err && (
                <div style={{ marginTop: 10, color: '#dc2626', fontSize: 12.5, fontWeight: 600 }}>
                  ✕ {sPwdState.err}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

    </div>
  );
}

function EyeIcon({ show }) {
  return show ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PwdInput({ label, value, onChange, required }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required={required}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1.5px solid #bfdbfe',
            borderRadius: 8,
            padding: '8px 36px 8px 12px',
            fontSize: 13,
            outline: 'none',
            color: '#0f172a',
            background: '#fff',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <EyeIcon show={show} />
        </button>
      </div>
    </div>
  );
}

function RadioOption({ selected, onSelect, title, desc }) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        border: `1.5px solid ${selected ? '#93c5fd' : '#e2e8f0'}`,
        borderRadius: 8,
        cursor: 'pointer',
        background: selected ? '#eff6ff' : '#fff',
        marginBottom: 10,
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: `2px solid ${selected ? '#1d4ed8' : '#cbd5e1'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
        background: '#fff',
      }}>
        {selected && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1d4ed8' }} />
        )}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function InfoHint({ text }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      background: '#eff6ff',
      borderRadius: 8,
      padding: '8px 14px',
      flex: 1,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#1d4ed8" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1.2" fill="#fff" />
      </svg>
      <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 500 }}>
        {text}
      </span>
    </div>
  );
}

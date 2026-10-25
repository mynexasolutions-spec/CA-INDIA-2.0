import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PasswordField from './PasswordField';

const RESEND_COOLDOWN_SECONDS = 30;

function Icon({ children, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const IconMail = (p) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
    <path d="m3.5 5.8 6.5 5 6.5-5" />
  </Icon>
);

const IconLock = (p) => (
  <Icon {...p}>
    <rect x="4" y="9" width="12" height="8" rx="1.5" />
    <path d="M6.5 9V6.3a3.5 3.5 0 0 1 7 0V9" />
  </Icon>
);

const IconShieldCheck = (p) => (
  <Icon {...p}>
    <path d="M10 2.5 16 5v5c0 4.2-2.8 6.7-6 8-3.2-1.3-6-3.8-6-8V5l6-2.5Z" />
    <path d="M7.3 9.7 9.2 11.6l3.5-4" />
  </Icon>
);

const IconCheckCircle = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="m6.8 10 2.2 2.2 4.2-4.4" />
  </Icon>
);

const IconClose = (p) => (
  <Icon {...p}>
    <path d="m5 5 10 10M15 5 5 15" />
  </Icon>
);

const REQUIREMENTS = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'One number', test: (v) => /[0-9]/.test(v) },
  { key: 'special', label: 'One special character', test: (v) => /[^a-zA-Z0-9]/.test(v) },
];

const STEP_TITLES = {
  email: 'Forgot Password',
  otp: 'Verify OTP',
  password: 'Set New Password',
  success: 'Password Reset',
};

const initialState = {
  step: 'email',
  email: '',
  otp: '',
  resetToken: '',
  password: '',
  confirmPassword: '',
  error: '',
  info: '',
  busy: false,
  cooldown: 0,
};

export default function ForgotPasswordModal({ open, onClose }) {
  const [s, setS] = useState(initialState);
  const patch = (next) => setS((prev) => ({ ...prev, ...next }));

  useEffect(() => {
    if (open) setS(initialState);
  }, [open]);

  useEffect(() => {
    if (s.cooldown <= 0) return undefined;
    const id = setTimeout(() => patch({ cooldown: s.cooldown - 1 }), 1000);
    return () => clearTimeout(id);
  }, [s.cooldown]);

  if (!open) return null;

  const requestOtp = async (isResend) => {
    patch({ busy: true, error: '' });
    try {
      await api('/auth/otp/request', { method: 'POST', body: { email: s.email } });
      patch({
        busy: false,
        step: 'otp',
        otp: '',
        cooldown: RESEND_COOLDOWN_SECONDS,
        info: isResend
          ? 'A new verification OTP has been sent to your registered email address.'
          : 'A verification OTP has been sent to your registered email address.',
        error: '',
      });
    } catch (err) {
      patch({ busy: false, error: err.message || 'Could not send OTP. Please try again.' });
    }
  };

  const onSendOtp = (e) => {
    e.preventDefault();
    if (!s.email) return;
    requestOtp(false);
  };

  const onResend = () => {
    if (s.cooldown > 0 || s.busy) return;
    requestOtp(true);
  };

  const onVerifyOtp = async (e) => {
    e.preventDefault();
    patch({ busy: true, error: '' });
    try {
      const res = await api('/auth/otp/verify', { method: 'POST', body: { email: s.email, otp: s.otp } });
      patch({ busy: false, step: 'password', resetToken: res.reset_token, error: '', info: '' });
    } catch (err) {
      patch({ busy: false, error: err.message || 'The OTP you entered is incorrect.' });
    }
  };

  const requirementsMet = REQUIREMENTS.every((r) => r.test(s.password));
  const passwordsMatch = s.password && s.password === s.confirmPassword;

  const onResetPassword = async (e) => {
    e.preventDefault();
    if (!requirementsMet || !passwordsMatch) return;
    patch({ busy: true, error: '' });
    try {
      await api('/auth/otp/reset-password', {
        method: 'POST',
        body: {
          email: s.email,
          reset_token: s.resetToken,
          password: s.password,
          password_confirmation: s.confirmPassword,
        },
      });
      patch({ busy: false, step: 'success', error: '' });
    } catch (err) {
      patch({ busy: false, error: err.message || 'Could not reset your password. Please try again.' });
    }
  };

  const stepIndex = { email: 1, otp: 2, password: 3, success: 4 }[s.step];
  const StepIcon = { email: IconLock, otp: IconShieldCheck, password: IconLock, success: IconCheckCircle }[s.step];

  return (
    <div className="fpm-backdrop" role="presentation" onClick={onClose}>
      <div className="fpm-card" role="dialog" aria-modal="true" aria-label="Forgot password" onClick={(e) => e.stopPropagation()}>
        <div className="fpm-head">
          <div className="fpm-head-main">
            <span className="fpm-badge" aria-hidden="true"><StepIcon size={22} /></span>
            <div>
              <p className="fpm-eyebrow">{s.step !== 'success' ? `Step ${stepIndex} of 3` : 'All done'}</p>
              <h3>{STEP_TITLES[s.step]}</h3>
            </div>
          </div>
          <button type="button" className="fpm-close" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="fpm-body">
          {s.step === 'email' && (
            <form onSubmit={onSendOtp}>
              <p className="fpm-lead">Enter your registered email address and we&apos;ll send you a one-time verification code.</p>
              <label className="fpm-field">
                <span>Email Address</span>
                <div className="fpm-input-wrap">
                  <span className="fpm-input-icon" aria-hidden="true"><IconMail /></span>
                  <input
                    type="email"
                    className="form-control"
                    required
                    autoFocus
                    placeholder="you@example.com"
                    value={s.email}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </div>
              </label>
              {s.error && <p className="fpm-error" role="alert">{s.error}</p>}
              <button type="submit" className="btn btn-navy fpm-submit" disabled={s.busy}>
                {s.busy ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          )}

          {s.step === 'otp' && (
            <form onSubmit={onVerifyOtp}>
              <div className="fpm-info">
                <IconShieldCheck size={18} />
                <div>
                  <p>{s.info || 'A verification OTP has been sent to your registered email address.'}</p>
                  <span>This code is valid for 10 minutes.</span>
                </div>
              </div>
              <label className="fpm-field">
                <span>Enter OTP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="form-control fpm-otp-input"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="6-digit code"
                  value={s.otp}
                  onChange={(e) => patch({ otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                />
              </label>
              {s.error && <p className="fpm-error" role="alert">{s.error}</p>}
              <button type="submit" className="btn btn-navy fpm-submit" disabled={s.busy || s.otp.length !== 6}>
                {s.busy ? 'Verifying…' : 'Verify OTP'}
              </button>
              <p className="fpm-resend">
                Didn&apos;t receive the code?{' '}
                <button type="button" onClick={onResend} disabled={s.cooldown > 0 || s.busy}>
                  {s.cooldown > 0 ? `Resend OTP in 0:${String(s.cooldown).padStart(2, '0')}` : 'Resend OTP'}
                </button>
              </p>
            </form>
          )}

          {s.step === 'password' && (
            <form onSubmit={onResetPassword}>
              <p className="fpm-lead">Choose a new password for your account.</p>
              <PasswordField
                label="New Password"
                required
                value={s.password}
                onChange={(e) => patch({ password: e.target.value })}
                autoComplete="new-password"
                placeholder="Enter new password"
                icon={<IconLock size={16} />}
              />
              <ul className="fpm-requirements">
                {REQUIREMENTS.map((r) => {
                  const met = r.test(s.password);
                  return (
                    <li key={r.key} className={met ? 'is-met' : ''}>
                      <IconCheckCircle size={14} /> {r.label}
                    </li>
                  );
                })}
              </ul>
              <div style={{ marginTop: 14 }}>
                <PasswordField
                  label="Confirm New Password"
                  required
                  value={s.confirmPassword}
                  onChange={(e) => patch({ confirmPassword: e.target.value })}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  icon={<IconLock size={16} />}
                />
              </div>
              {s.confirmPassword && !passwordsMatch && (
                <p className="fpm-error" role="alert">Passwords do not match.</p>
              )}
              {s.error && <p className="fpm-error" role="alert">{s.error}</p>}
              <button type="submit" className="btn btn-navy fpm-submit" disabled={s.busy || !requirementsMet || !passwordsMatch}>
                {s.busy ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}

          {s.step === 'success' && (
            <div className="fpm-success">
              <span className="fpm-success-icon" aria-hidden="true"><IconCheckCircle size={30} /></span>
              <p className="fpm-lead" style={{ textAlign: 'center' }}>
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <button type="button" className="btn btn-gold fpm-submit" onClick={onClose}>
                Back to Account Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

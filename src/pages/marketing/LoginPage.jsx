import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import ForgotPasswordModal from '../../components/ForgotPasswordModal';
import PasswordField from '../../components/PasswordField';
import Seo from '../../components/seo/Seo';
import { OTP_RESEND_SECONDS, useCountdown } from '../../hooks/useCountdown';

function Icon({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const IconInvoice = (p) => (
  <Icon {...p}>
    <path d="M5 2.5h7l3 3v12a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-14a.5.5 0 0 1 .5-.5Z" />
    <path d="M12 2.5V5.5a.5.5 0 0 0 .5.5H15.5" />
    <path d="M7 10.5h6M7 13h6M7 8h3" />
  </Icon>
);

const IconChart = (p) => (
  <Icon {...p}>
    <path d="M3 17V3" />
    <path d="M3 17h14" />
    <rect x="5.5" y="11" width="2.4" height="6" rx="0.4" />
    <rect x="10" y="7.5" width="2.4" height="9.5" rx="0.4" />
    <rect x="14.5" y="4" width="2.4" height="13" rx="0.4" />
  </Icon>
);

const IconDownload = (p) => (
  <Icon {...p}>
    <path d="M14.5 12.5v2a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5v-2" />
    <path d="M10 2.5v9.5" />
    <path d="M6.8 9.3 10 12.5l3.2-3.2" />
  </Icon>
);

const IconClipboard = (p) => (
  <Icon {...p}>
    <path d="M7 3.5h6a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
    <path d="M8 3a2 2 0 0 1 4 0" />
    <path d="M7.3 10 9 11.7l3.7-3.7" />
  </Icon>
);

const IconShield = (p) => (
  <Icon {...p}>
    <path d="M10 2.5 16 5v5c0 4.2-2.8 6.7-6 8-3.2-1.3-6-3.8-6-8V5l6-2.5Z" />
    <path d="M7.3 9.7 9.2 11.6l3.5-4" />
  </Icon>
);

const IconUser = (p) => (
  <Icon {...p}>
    <circle cx="10" cy="7" r="3.2" />
    <path d="M3.8 17c.9-3.2 3.4-5 6.2-5s5.3 1.8 6.2 5" />
  </Icon>
);

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

const IconHeadset = (p) => (
  <Icon {...p}>
    <path d="M3.5 11v-1a6.5 6.5 0 0 1 13 0v1" />
    <rect x="2.5" y="11" width="3" height="4.5" rx="1" />
    <rect x="14.5" y="11" width="3" height="4.5" rx="1" />
    <path d="M16 15.5v.5a2.5 2.5 0 0 1-2.5 2.5H11" />
  </Icon>
);

const gstFeatures = [
  {
    icon: IconInvoice,
    title: 'View & Manage GST Invoices & Billing',
    text: 'Create, view and manage all your GST invoices and billing in one place.',
  },
  {
    icon: IconChart,
    title: 'Check GST Summaries Period-wise',
    text: 'Get a clear overview of your GST summary with period-wise insights.',
  },
  {
    icon: IconDownload,
    title: 'Download Detailed Reports',
    text: 'Download accurate and detailed reports anytime, in just a click.',
  },
  {
    icon: IconClipboard,
    title: 'Track GST Return Filing Status',
    text: 'Stay updated with the real-time status of your GST return filings.',
  },
];

export default function LoginPage() {
  const { login, verifyLoginOtp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(() => (
    searchParams.get('timeout') === '1' ? 'Your session expired due to inactivity. Please sign in again.' : ''
  ));
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [twoFactor, setTwoFactor] = useState(null); // { challenge, email, devOtp } while the emailed code is awaited
  const [otp, setOtp] = useState('');
  const resend = useCountdown();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const result = await login(email, password, null, remember);
      if (result?.twoFactor) {
        setTwoFactor(result);
        setOtp('');
        resend.start(OTP_RESEND_SECONDS);
        return;
      }
      if (['super_admin', 'admin', 'staff'].includes(result.role)) navigate('/admin');
      else navigate('/portal');
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const onVerifyOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await verifyLoginOtp(twoFactor.challenge, otp, remember);
      navigate(['super_admin', 'admin', 'staff'].includes(u.role) ? '/admin' : '/portal');
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const onResendOtp = async () => {
    if (resend.left > 0) return;
    setError('');
    setInfo('');
    try {
      const r = await api('/auth/login/resend-otp', { method: 'POST', body: { challenge: twoFactor.challenge } });
      setTwoFactor((t) => ({ ...t, devOtp: r._dev_otp ?? null }));
      setInfo('A new code has been sent to your email.');
      resend.start(OTP_RESEND_SECONDS);
    } catch (err) {
      setError(err.message || 'Could not resend the code');
    }
  };

  if (!loading && user) {
    const destination = ['super_admin', 'admin', 'staff'].includes(user.role) ? '/admin' : '/portal';
    return <Navigate to={destination} replace />;
  }

  return (
    <>
      <Seo
        title="Login | A B KHAN & ASSOCIATES"
        path="/login"
      />
      <section className="login-page">
        <div className="login-page__shell">
          <div className="login-page__hero">
            <div className="login-page__hero-bg" aria-hidden="true">
              <img src="/assets/compliance.png" alt="" />
            </div>
            <div className="login-page__hero-content">
              <h1 className="login-page__hero-title">
                Your Business.
                <br />
                Your Compliance.
                <br />
                <span>One Secure Portal.</span>
              </h1>
              <p className="login-page__hero-lead">
                Access your GST Invoices, Billing, GST Summaries, Period-wise Reports, and Return Filing Status
                &mdash; all in one secure portal.
              </p>
              <span className="login-page__hero-badge">Sign in securely to:</span>
              <ul className="login-page__feature-list">
                {gstFeatures.map((feature) => (
                  <li key={feature.title}>
                    <span className="login-page__feature-icon"><feature.icon /></span>
                    <div>
                      <strong>{feature.title}</strong>
                      <p>{feature.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="login-page__trust">
                <span className="login-page__trust-icon"><IconShield /></span>
                <div>
                  <strong>Safe. Secure. Reliable.</strong>
                  <p>Your data is protected with enterprise-grade security.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="login-page__card">
            <span className="login-page__card-badge" aria-hidden="true"><IconUser size={26} /></span>
            <p className="login-page__card-eyebrow">Account Login</p>
            <p className="login-page__card-welcome">Welcome Back!</p>
            <p className="login-page__copy">
              Sign in securely to access your Billing Dashboard, Invoices, and Financial Summaries.
            </p>
            {twoFactor ? (
              <form onSubmit={onVerifyOtp} className="login-page__form">
                <p className="login-page__copy" style={{ marginTop: 0 }}>
                  Two-factor verification. Enter the 6-digit code we emailed to <strong>{twoFactor.email}</strong>. It is valid for 5 minutes.
                </p>
                <label className="login-page__field">
                  <span>Verification Code</span>
                  <input
                    className="form-control"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ letterSpacing: 8, textAlign: 'center', fontSize: 20, fontWeight: 700 }}
                  />
                </label>
                {twoFactor.devOtp && <p className="login-page__info">Dev mode code: <strong>{twoFactor.devOtp}</strong></p>}
                {error && <p className="login-page__error" role="alert">{error}</p>}
                {info && <p className="login-page__info">{info}</p>}
                <button type="submit" className="btn btn-navy login-page__submit" disabled={busy || otp.length !== 6}>
                  <IconLock size={16} />
                  {busy ? 'Please wait…' : 'Verify & Sign In'}
                </button>
                <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13 }}>
                  <button type="button" className="btn-link" onClick={onResendOtp} disabled={resend.left > 0} style={{ background: 'none', border: 'none', color: resend.left > 0 ? '#94a3b8' : '#1d4ed8', cursor: resend.left > 0 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>{resend.left > 0 ? `Resend code (${resend.label})` : 'Resend code'}</button>
                  {' · '}
                  <button type="button" onClick={() => { setTwoFactor(null); setOtp(''); setError(''); setInfo(''); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>Back</button>
                </p>
              </form>
            ) : (
            <form onSubmit={onSubmit} className="login-page__form">
              <label className="login-page__field">
                <span>Email Address / User ID</span>
                <div className="login-page__input-wrap">
                  <span className="login-page__input-icon" aria-hidden="true"><IconMail /></span>
                  <input
                    className="form-control"
                    type="text"
                    required
                    placeholder="Enter your email or User ID"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </label>
              <PasswordField
                label="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                icon={<IconLock size={17} />}
              />
              <label className="login-page__remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>Remember me</span>
              </label>
              {error && <p className="login-page__error" role="alert">{error}</p>}
              {info && <p className="login-page__info">{info}</p>}
              <button type="submit" className="btn btn-navy login-page__submit" disabled={busy}>
                <IconLock size={16} />
                {busy ? 'Please wait…' : 'Sign In'}
              </button>
            </form>
            )}
            <div className="login-page__divider"><span>or</span></div>
            <div className="login-page__support-row">
              <button type="button" onClick={() => setForgotOpen(true)}>
                <IconLock size={16} />
                Forgot Password?
              </button>
              <span className="login-page__support-sep" aria-hidden="true" />
              <Link to="/contact">
                <IconHeadset size={16} />
                <span>Need Help?<br />Contact Support</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </>
  );
}

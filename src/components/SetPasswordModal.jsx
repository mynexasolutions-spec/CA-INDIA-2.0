import { useEffect, useState } from 'react';
import { api } from '../api/client';

function generateSecurePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + numbers + special;

  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += special[Math.floor(Math.random() * special.length)];

  for (let i = 4; i < 12; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
}

export default function SetPasswordModal({ isOpen, onClose, onSuccess, clientId, clientName }) {
  const [mode, setMode] = useState('generate'); // 'generate' | 'custom'
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const initial = generateSecurePassword();
      setPassword(initial);
      setMode('generate');
      setCopied(false);
      setError('');
      setShowPassword(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const next = generateSecurePassword();
    setPassword(next);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api(`/admin/clients/${clientId}/password`, {
        method: 'POST',
        body: { password },
      });
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          animation: 'fadeInScale 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--bp-navy, #0a3d82)' }}>
              Set / Reset Client Password
            </h3>
            {clientName && (
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                For {clientName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#64748b',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {/* Mode Switcher */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="radio"
                name="pwdMode"
                checked={mode === 'generate'}
                onChange={() => {
                  setMode('generate');
                  if (!password) handleGenerate();
                }}
              />
              Generate Random Password
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="radio"
                name="pwdMode"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
              />
              Type Custom Password
            </label>
          </div>

          {mode === 'generate' ? (
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '1px',
                    color: 'var(--bp-navy, #0a3d82)',
                    userSelect: 'all',
                  }}
                >
                  {password}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: copied ? '#16a34a' : 'var(--bp-blue, #2563eb)',
                      color: '#ffffff',
                      border: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: '#ffffff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                New Password (minimum 8 characters) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="bp-input"
                  required
                  minLength={8}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  style={{ paddingRight: 60 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          {/* Warning Notice per Spec */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: 12,
              lineHeight: 1.45,
              marginBottom: 20,
            }}
          >
            <strong>Security Notice:</strong> Passwords are never stored readable and cannot be retrieved later. Copy this password now and share it securely with the client.
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="bp-btn bp-btn-outline"
              disabled={loading}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bp-btn bp-btn-primary"
              disabled={loading || !password || password.length < 8}
              style={{ background: 'var(--bp-blue, #2563eb)' }}
            >
              {loading ? 'Setting Password…' : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

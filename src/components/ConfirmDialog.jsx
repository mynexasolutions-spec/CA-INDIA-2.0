import { useEffect } from 'react';

const TONES = {
  danger: { ring: '#fde8e8', icon: '#dc2626', btn: 'linear-gradient(135deg,#ef4444,#dc2626)', glow: 'rgba(220,38,38,0.7)' },
  primary: { ring: '#e3edfc', icon: '#1d5fe0', btn: 'linear-gradient(135deg,#2f6fe8,#1d56d6)', glow: 'rgba(29,95,224,0.7)' },
};

/** Styled replacement for window.confirm(). Esc / backdrop click cancels, Enter confirms. */
export default function ConfirmDialog({
  open, title, message, detail, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', busy = false, onConfirm, onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.();
      if (e.key === 'Enter' && !busy) onConfirm?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;
  const t = TONES[tone] || TONES.danger;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel?.(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="cd-title"
        style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 18, padding: '26px 26px 22px', textAlign: 'center', boxShadow: '0 30px 70px -20px rgba(15,42,95,0.5)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: t.ring, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={t.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {tone === 'danger'
              ? (<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>)
              : (<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>)}
          </svg>
        </div>
        <h3 id="cd-title" style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: '#0f172a' }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.55 }}>{message}</p>
        {detail && (
          <div style={{ marginTop: 14, textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>
            {detail}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
          <button type="button" disabled={busy} onClick={onCancel}
            style={{ flex: 1, height: 44, borderRadius: 11, border: '1.5px solid #dbe3ef', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {cancelLabel}
          </button>
          <button type="button" disabled={busy} onClick={onConfirm} autoFocus
            style={{ flex: 1, height: 44, borderRadius: 11, border: 'none', background: t.btn, color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, boxShadow: `0 12px 22px -10px ${t.glow}` }}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

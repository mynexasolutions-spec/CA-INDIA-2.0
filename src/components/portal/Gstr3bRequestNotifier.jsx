import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

/**
 * "New GSTR-3B Request Received" popup. Shown once per request that the Admin initiated and
 * that is waiting for the client; the "N New Request" badge stays on the GSTR-3B page.
 */
const SEEN_KEY = 'gstr3b_request_popup_seen';

const readSeen = () => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
};
const markSeen = (id) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), id])].slice(-200))); } catch { /* storage unavailable */ }
};

export default function Gstr3bRequestNotifier() {
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);

  const check = useCallback(() => {
    api('/client/gstr3b/requests')
      .then((d) => {
        const seen = readSeen();
        const fresh = (d.requests || []).find((r) => r.awaiting_client && !seen.includes(r.id));
        setRequest((cur) => cur ?? fresh ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [check]);

  if (!request) return null;

  const label = request.return_label || 'GSTR-3B';
  const dismiss = () => { markSeen(request.id); setRequest(null); };
  const view = () => {
    markSeen(request.id);
    setRequest(null);
    navigate(`${request.return_type === 'CMP08' ? '/portal/cmp-08' : '/portal/gstr-3b'}?request=${request.id}`);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="bp-card" role="dialog" aria-modal="true" aria-label={`New ${label} Request Received`} style={{ width: 440, maxWidth: '100%', padding: 26, textAlign: 'center' }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: 'var(--bp-navy)' }}>New {label} Request Received</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--bp-muted)' }}>
          Your {label} request for <strong>{request.period_label}</strong> has been initiated by your administrator.
          Please review the request and take the required action.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button type="button" className="bp-btn bp-btn-outline" onClick={dismiss}>Later</button>
          <button type="button" className="bp-btn bp-btn-primary" onClick={view}>View Request</button>
        </div>
      </div>
    </div>
  );
}

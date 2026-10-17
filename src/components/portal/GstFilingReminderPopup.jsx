import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api, getAuthToken } from '../../api/client';

// ─── return-type visual config ───────────────────────────────────────────────

const DocSvg = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);

const RETURN_CFG = {
  'GSTR-1':  { color: '#dc2626', iconBg: '#fde8e8', subtitle: 'Details of Outward Supplies' },
  'GSTR-3B': { color: '#2563eb', iconBg: '#e0ebff', subtitle: 'Summary Return' },
  'CMP-08':  { color: '#16a34a', iconBg: '#dcf5e4', subtitle: 'Composition Return' },
};

const STATUS_CFG = {
  due_soon: { label: 'Due Soon', color: '#dc2626', bg: '#fde8e8' },
  upcoming: { label: 'Upcoming', color: '#b45309', bg: '#fdf0cf' },
  overdue:  { label: 'Overdue',  color: '#991b1b', bg: '#fbd0d0' },
};

// ─── sub-components ───────────────────────────────────────────────────────────

function DueDateCell({ daysLeft, dateStr }) {
  const red = daysLeft <= 7;
  const color = red ? '#dc2626' : '#475569';
  const label =
    daysLeft < 0 ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} overdue` :
    daysLeft === 0 ? 'Due today' :
    `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;

  return (
    <div>
      <div style={{ fontWeight: 800, color, fontSize: 13 }}>{dateStr}</div>
      <div style={{ fontSize: 11.5, color, marginTop: 2 }}>({label})</div>
    </div>
  );
}

function GstCalendarArt() {
  return (
    <div style={{ position: 'relative', width: 78, height: 70, flexShrink: 0 }}>
      <svg width="70" height="68" viewBox="0 0 70 68" fill="none">
        <rect x="3" y="9" width="62" height="56" rx="9" fill="#eaf2ff" stroke="#1d5fe0" strokeWidth="2.5" />
        <rect x="3" y="9" width="62" height="16" rx="9" fill="#1d5fe0" />
        <rect x="3" y="18" width="62" height="7" fill="#1d5fe0" />
        <rect x="17" y="3" width="5" height="13" rx="2.5" fill="#0f2a5f" />
        <rect x="46" y="3" width="5" height="13" rx="2.5" fill="#0f2a5f" />
        <text x="34" y="52" textAnchor="middle" fontSize="19" fontWeight="800" fill="#0f2a5f" fontFamily="Inter, system-ui, sans-serif">GST</text>
      </svg>
      <div style={{ position: 'absolute', right: 0, bottom: 2, width: 26, height: 26, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
      </div>
    </div>
  );
}

function GstBadgeArt() {
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <div style={{ width: 38, height: 42, border: '2px solid #0f2a5f', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#0f2a5f', background: '#fff' }}>GST</div>
      <div style={{ position: 'absolute', right: -4, bottom: -2, width: 20, height: 20, borderRadius: '50%', background: '#16a34a', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </div>
    </div>
  );
}

// ─── main popup ───────────────────────────────────────────────────────────────

/**
 * GST Filing Reminder — shown on every login while any applicable return still has no filing
 * request. Closing it (X / Remind me later) only hides it for this login; the session key is
 * tied to the login token, so a new login shows it again until the request is submitted.
 */
export default function GstFilingReminderPopup() {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const navigate = useNavigate();
  const [reminders, setReminders] = useState(null);
  const [remindLater, setRemindLater] = useState(false);

  const loginKey = (getAuthToken() || '').slice(-16);
  const sessionKey = `gst_reminder_shown_${profile?.id}_${loginKey}`;

  useEffect(() => {
    if (!profile?.has_gst || profile?.gst_compliance_enabled === false) return;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
    } catch (_) { /* private mode */ }

    api('/client/gst-filing/reminders')
      .then((d) => setReminders(d.reminders || []))
      .catch(() => {});
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    try { sessionStorage.setItem(sessionKey, '1'); } catch (_) {}
    setReminders([]);
  }, [sessionKey]);

  const go = useCallback((url) => {
    dismiss();
    navigate(url || '/portal/gst-filing');
  }, [dismiss, navigate]);

  if (!reminders || reminders.length === 0) return null;

  return (
    <div
      className="gfr-overlay"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.6)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <style>{`
        @media (max-width: 900px) {
          .gfr-overlay { padding: 10px !important; align-items: flex-end !important; }
          .gfr-table, .gfr-table tbody, .gfr-table tr, .gfr-table td { display: block; width: 100%; }
          .gfr-table { border: 0 !important; }
          .gfr-table thead { display: none; }
          .gfr-table tr { border: 1px solid #d9e5f6; border-radius: 12px; margin-bottom: 12px; padding: 4px 0; background: #fff; }
          .gfr-table td { display: flex !important; justify-content: space-between; align-items: center; gap: 12px; text-align: right !important; padding: 8px 14px !important; }
          .gfr-table td::before { content: attr(data-label); font-size: 11.5px; font-weight: 700; color: #64748b; text-align: left; }
          .gfr-table td:last-child { border-top: 1px dashed #e3ebf6; }
          .gfr-table td:last-child button { width: 100%; justify-content: center; }
          .gfr-scroll { padding: 0 14px 4px !important; }
          .gfr-foot { padding: 12px 14px 16px !important; margin-top: 8px !important; }
          .gfr-foot > div:last-child { width: 100%; }
          .gfr-foot > div:last-child > button { width: 100%; justify-content: center; }
        }
      `}</style>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 880,
        boxShadow: '0 25px 60px -10px rgba(0,0,0,0.4)',
        overflow: 'hidden', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close reminder"
          style={{ position: 'absolute', top: 12, right: 14, width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {/* ── Header ── */}
        <div style={{ padding: '26px 32px 18px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <GstCalendarArt />
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#0f2a5f', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              GST Filing{' '}
              <span style={{ color: '#dc2626', borderBottom: '3px solid #dc2626', paddingBottom: 1 }}>Reminder</span>
            </div>
            <div style={{ color: '#475569', fontSize: 12.5, marginTop: 8 }}>
              Stay Compliant&nbsp;&nbsp;|&nbsp;&nbsp;Avoid Penalties&nbsp;&nbsp;|&nbsp;&nbsp;Focus on Your Business
            </div>
          </div>
          <div style={{
            background: '#fdeeee', border: '1px solid #f5c2c2', borderRadius: 10, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10, color: '#b91c1c', fontSize: 12.5, fontWeight: 600, maxWidth: 250, marginRight: 24,
          }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 14 }}>!</span>
            <span>Your GST return(s) are due. Please submit your filing request.</span>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="gfr-scroll" style={{ overflowY: 'auto', flex: 1, padding: '0 28px 8px' }}>
          <table className="gfr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #d9e5f6', borderRadius: 10 }}>
            <thead>
              <tr style={{ background: '#e8f0fb' }}>
                {['Return Type', 'Return Period', 'Filing Frequency', 'Due Date', 'Status', 'Action'].map((h) => (
                  <th key={h} style={{ padding: '11px 12px', color: '#0f2a5f', fontWeight: 800, textAlign: 'center', fontSize: 12.5, whiteSpace: 'nowrap', borderBottom: '1px solid #d9e5f6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => {
                const cfg  = RETURN_CFG[r.return_type] || RETURN_CFG['GSTR-1'];
                const sCfg = STATUS_CFG[r.status] || STATUS_CFG.upcoming;
                return (
                  <tr key={`${r.return_type}-${r.period_code}`} style={{ background: '#fff', borderBottom: '1px solid #e3ebf6' }}>
                    <td data-label="Return Type" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.iconBg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <DocSvg />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>{r.return_type}</div>
                          <div style={{ fontSize: 10.5, color: '#64748b', maxWidth: 110 }}>{cfg.subtitle}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Return Period" style={{ padding: '12px 10px', fontWeight: 500, color: '#1e293b', textAlign: 'center' }}>{r.period_label}</td>
                    <td data-label="Filing Frequency" style={{ padding: '12px 10px', color: '#1d4ed8', fontWeight: 800, textAlign: 'center' }}>{r.filing_frequency}</td>
                    <td data-label="Due Date" style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <DueDateCell daysLeft={r.days_left} dateStr={r.due_date} />
                    </td>
                    <td data-label="Status" style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 8, background: sCfg.bg, color: sCfg.color, fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap' }}>{sCfg.label}</span>
                    </td>
                    <td data-label="Action" style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => go(r.filing_url)}
                        style={{ background: '#1d5fe0', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', boxShadow: '0 6px 14px -6px rgba(29,95,224,0.7)' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                        Submit Filing Request
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div className="gfr-foot" style={{ padding: '16px 28px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', flexShrink: 0, marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <GstBadgeArt />
            <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: 14, lineHeight: 1.3 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>Timely Compliance</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f2a5f' }}>Stronger Business</div>
              <div style={{ width: 64, height: 3, borderRadius: 2, background: '#16a34a', marginTop: 3 }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={remindLater}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
                onChange={(e) => { setRemindLater(e.target.checked); if (e.target.checked) dismiss(); }}
              />
              <span>
                <span style={{ display: 'block', fontSize: 13, color: '#1e293b', fontWeight: 500 }}>Remind me later</span>
                <span style={{ display: 'block', fontSize: 10.5, color: '#64748b' }}>(It will appear again on next login)</span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => go('/portal/gst-filing')}
              style={{ background: '#1d5fe0', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 20px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 18px -8px rgba(29,95,224,0.8)' }}
            >
              Go to GST Filing Confirmation
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

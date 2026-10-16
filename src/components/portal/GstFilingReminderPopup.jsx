import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';

// ─── return-type visual config ───────────────────────────────────────────────

const RETURN_CFG = {
  'GSTR-1': {
    color: '#dc2626', iconBg: '#fee2e2',
    subtitle: 'Outward Supplies Return',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  'GSTR-3B': {
    color: '#2563eb', iconBg: '#dbeafe',
    subtitle: 'Summary Return',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  'CMP-08': {
    color: '#16a34a', iconBg: '#dcfce7',
    subtitle: 'Composition Statement',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
};

const STATUS_CFG = {
  due_soon: { label: 'Due Soon',  color: '#dc2626', bg: '#fee2e2' },
  upcoming: { label: 'Upcoming',  color: '#d97706', bg: '#fef3c7' },
  overdue:  { label: 'Overdue',   color: '#7f1d1d', bg: '#fecaca' },
};

// ─── sub-components ───────────────────────────────────────────────────────────

function DueDateCell({ daysLeft, dateStr }) {
  const red = daysLeft <= 7;
  const color = red ? '#dc2626' : '#d97706';
  const label =
    daysLeft < 0 ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} overdue` :
    daysLeft === 0 ? 'Due today' :
    `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;

  return (
    <div>
      <div style={{ fontWeight: 700, color, fontSize: 13 }}>{dateStr}</div>
      <div style={{ fontSize: 11, color, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── main popup ───────────────────────────────────────────────────────────────

export default function GstFilingReminderPopup() {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const navigate = useNavigate();
  const [reminders, setReminders] = useState(null);

  const sessionKey = `gst_reminder_shown_${profile?.id}`;

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

  const goToFiling = useCallback(() => {
    dismiss();
    navigate('/portal/gst-filing');
  }, [dismiss, navigate]);

  if (!reminders || reminders.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.6)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Modal card */}
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 860,
        boxShadow: '0 25px 60px -10px rgba(0,0,0,0.4)',
        overflow: 'hidden', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)',
          padding: '20px 24px 16px', position: 'relative', flexShrink: 0,
        }}>
          {/* X close */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close reminder"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)', border: 'none',
              cursor: 'pointer', color: '#fff', fontSize: 18, lineHeight: '26px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 300,
            }}
          >×</button>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>
                GST Filing <span style={{ color: '#fbbf24' }}>Reminder</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 }}>
                Stay Compliant&nbsp;&nbsp;|&nbsp;&nbsp;Avoid Penalties&nbsp;&nbsp;|&nbsp;&nbsp;Focus on Your Business
              </div>
            </div>
          </div>

          {/* Alert bar */}
          <div style={{
            background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.38)',
            borderRadius: 8, padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#fecaca', fontSize: 13,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Your GST return(s) are due. Please submit your filing request to avoid late fees and penalties.
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['Return Type', 'Return Period', 'Filing Frequency', 'Due Date', 'Status', 'Action'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px', color: '#fff', fontWeight: 700,
                    textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reminders.map((r, i) => {
                const cfg  = RETURN_CFG[r.return_type]  || RETURN_CFG['GSTR-1'];
                const sCfg = STATUS_CFG[r.status] || STATUS_CFG.upcoming;
                return (
                  <tr key={i} style={{
                    background: i % 2 === 0 ? '#fff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}>
                    {/* Return Type */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8,
                          background: cfg.iconBg, color: cfg.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {cfg.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: cfg.color, fontSize: 13 }}>{r.return_type}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{cfg.subtitle}</div>
                        </div>
                      </div>
                    </td>

                    {/* Period */}
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                      {r.period_label}
                    </td>

                    {/* Frequency */}
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{r.filing_frequency}</td>

                    {/* Due Date */}
                    <td style={{ padding: '12px 14px' }}>
                      <DueDateCell daysLeft={r.days_left} dateStr={r.due_date} />
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        background: sCfg.bg, color: sCfg.color,
                        fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap',
                      }}>{sCfg.label}</span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        type="button"
                        onClick={goToFiling}
                        style={{
                          background: '#1d4ed8', color: '#fff', border: 'none',
                          borderRadius: 7, padding: '7px 11px',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
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
        <div style={{
          borderTop: '1px solid #e2e8f0', padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#f8fafc', gap: 12, flexWrap: 'wrap', flexShrink: 0,
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span style={{ fontWeight: 500 }}>Timely Compliance = Stronger Business</span>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#475569', userSelect: 'none' }}>
              <input
                type="checkbox"
                style={{ cursor: 'pointer' }}
                onChange={(e) => { if (e.target.checked) dismiss(); }}
              />
              Remind me later
            </label>
            <button
              type="button"
              onClick={goToFiling}
              style={{
                background: '#1d4ed8', color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px 16px',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Go to GST Filing Confirmation
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

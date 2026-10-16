import { useCallback, useState } from 'react';
import { api } from '../../api/client';

/**
 * Admin-side request flow for a return (CMP-08 here; GSTR-3B has the same behaviour inline):
 *   Initiate Request -> confirmation popup -> "Pending Client Action" (Initiated By: Admin)
 *   Reject           -> only for a request the client submitted, reason mandatory
 *   View Request     -> read-only details
 *
 * Returns the state plus ready-made JSX (`statusBar`, `modals`) and the flags the page's
 * bottom action bar needs.
 */

const OPEN = ['pending_client', 'submitted', 'accepted'];

const TONE = {
  pending_client: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', pill: '#fef3c7' },
  submitted: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', pill: '#dbeafe' },
  accepted: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', pill: '#dcfce7' },
  completed: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', pill: '#dcfce7' },
  rejected: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', pill: '#fee2e2' },
};

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 };
const dialog = (w) => ({ background: '#fff', borderRadius: 12, width: w, maxWidth: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' });
const closeX = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20 };
const labelSt = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };
const inputSt = { width: '100%', padding: '9px 12px', border: '1.5px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1e293b', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
const btnOutline = { padding: '8px 20px', background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' };
const btnBlue = { padding: '8px 24px', background: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' };

export function useReturnRequest({ baseUrl, returnLabel, clientName, periodLabel }) {
  const [req, setReq] = useState(null);
  const [initOpen, setInitOpen] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [initErr, setInitErr] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectErr, setRejectErr] = useState('');
  const [viewOpen, setViewOpen] = useState(false);

  const reload = useCallback(
    () => api(`${baseUrl}/request`).then((d) => setReq(d?.request ?? null)).catch(() => setReq(null)),
    [baseUrl]
  );

  const submitInitiate = async () => {
    setInitErr('');
    setInitiating(true);
    try {
      const res = await api(`${baseUrl}/request`, { method: 'POST', body: {} });
      setReq(res.request);
      setInitOpen(false);
    } catch (e) {
      setInitErr(e.message || 'Failed to initiate request.');
    } finally {
      setInitiating(false);
    }
  };

  const submitReject = async () => {
    if (!reason.trim()) {
      setRejectErr('Please provide a reason for rejecting this request.');
      return;
    }
    setRejecting(true);
    setRejectErr('');
    try {
      const res = await api(`${baseUrl}/request/reject`, { method: 'POST', body: { reason: reason.trim() } });
      setReq(res.request);
      setRejectOpen(false);
      setReason('');
    } catch (e) {
      setRejectErr(e.message || 'Failed to reject the request.');
    } finally {
      setRejecting(false);
    }
  };

  const hasOpen = OPEN.includes(req?.status);
  const canReject = !!req?.awaiting_admin;
  const openLabel = { pending_client: 'Request Pending', submitted: 'Request Submitted', accepted: 'Accepted' }[req?.status];
  const openMessage = req?.status === 'pending_client'
    ? `A ${returnLabel} request is already pending with the client.`
    : 'A request for this tax period is already in progress.';

  const statusBar = req ? (() => {
    const tone = TONE[req.status] ?? TONE.submitted;
    return (
      <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 8, padding: '10px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: tone.color }}>Request Status: {req.status_label}</span>
          <span style={{ color: '#64748b' }}>Initiated By: <b>{req.initiated_by_name}</b></span>
          <span style={{ color: '#64748b' }}>Request Date: {req.created_at}</span>
          {req.rejection_reason && <span style={{ color: '#b91c1c' }}>Reason: {req.rejection_reason}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ padding: '3px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: tone.pill, color: tone.color }}>{req.status_label}</span>
          <button type="button" onClick={() => setViewOpen(true)} style={{ height: 30, padding: '0 14px', background: '#fff', border: '1.5px solid #1d4ed8', borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: '#1d4ed8', cursor: 'pointer' }}>
            View Request
          </button>
        </div>
      </div>
    );
  })() : null;

  const modals = (
    <>
      {initOpen && (
        <div style={overlay}>
          <div style={dialog(460)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>Initiate {returnLabel} Request?</h3>
              <button type="button" onClick={() => { setInitOpen(false); setInitErr(''); }} style={closeX}>✕</button>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
              You are about to initiate a {returnLabel} request for <b>{clientName}</b> – <b>{periodLabel}</b>.<br />
              The request will be sent to the client for review and action.
            </div>
            {initErr && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{initErr}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setInitOpen(false); setInitErr(''); }} style={btnOutline}>Cancel</button>
              <button type="button" onClick={submitInitiate} disabled={initiating} style={btnBlue}>{initiating ? 'Initiating...' : 'Initiate Request'}</button>
            </div>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div style={overlay}>
          <div style={dialog(460)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>Reject {returnLabel} Request?</h3>
              <button type="button" onClick={() => setRejectOpen(false)} style={closeX}>✕</button>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b', lineHeight: 1.6 }}>
              You are rejecting the {returnLabel} request submitted by <b>{clientName}</b> for <b>{periodLabel}</b>. The client will see the reason.
            </div>
            <label style={labelSt}>Reason <span style={{ color: '#dc2626' }}>*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Enter reason" style={{ ...inputSt, marginBottom: 14, resize: 'vertical' }} />
            {rejectErr && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 7, marginBottom: 12 }}>{rejectErr}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setRejectOpen(false)} style={btnOutline}>Cancel</button>
              <button type="button" onClick={submitReject} disabled={rejecting} style={{ ...btnBlue, background: '#dc2626' }}>{rejecting ? 'Rejecting...' : 'Reject Request'}</button>
            </div>
          </div>
        </div>
      )}

      {viewOpen && req && (
        <div style={overlay}>
          <div style={dialog(440)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 17, color: '#1e3a8a' }}>{returnLabel} Request</h3>
              <button type="button" onClick={() => setViewOpen(false)} style={closeX}>✕</button>
            </div>
            <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Client Name', req.client_name ?? clientName],
                  ['Tax Period', req.period_label ?? periodLabel],
                  ['Request Status', req.status_label],
                  ['Initiated By', req.initiated_by_name],
                  ['Request Date', req.created_at],
                  ...(req.rejection_reason ? [['Rejection Reason', req.rejection_reason]] : []),
                ].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 0', color: '#64748b', width: 150 }}>{k}</td>
                    <td style={{ padding: '9px 0', color: '#0f172a', fontWeight: 600 }}>{v || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" onClick={() => setViewOpen(false)} style={btnBlue}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return {
    req,
    reload,
    hasOpen,
    canReject,
    openLabel,
    openMessage,
    openInitiate: () => { setInitErr(''); setInitOpen(true); },
    openReject: () => { setRejectErr(''); setReason(''); setRejectOpen(true); },
    statusBar,
    modals,
  };
}

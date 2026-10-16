import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';

/**
 * GSTR-3B requests for the logged-in client — the Admin-initiated ones that wait for
 * Accept / Reject, and the ones the client raised themselves.
 *
 * Accept / Reject appear ONLY on a request that has actually been received (awaiting the
 * client). With no request there is nothing to highlight, and the panel stays hidden.
 */

const TONE = {
  pending_client: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  submitted: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  accepted: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  completed: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
  rejected: { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
};

function StatusPill({ status, label }) {
  const t = TONE[status] ?? TONE.submitted;
  return (
    <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
      {label}
    </span>
  );
}

function RejectModal({ request, onClose, onDone }) {
  const returnLabel = request.return_label || 'GSTR-3B';
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!reason.trim()) {
      setErr('Please provide a reason for rejecting this request.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await api(`/client/gstr3b/requests/${request.id}/reject`, { method: 'POST', body: { reason: reason.trim() } });
      onDone();
    } catch (e) {
      setErr(e.message || 'Could not reject the request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="bp-card" style={{ width: 440, maxWidth: '100%', padding: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--bp-navy)' }}>Reject {returnLabel} Request?</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--bp-muted)' }}>
          Please provide a reason for rejecting this request ({request.period_label}).
        </p>
        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--bp-navy)', marginBottom: 5 }}>
          Reason <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <textarea
          className="bp-input"
          rows={3}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason"
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          autoFocus
        />
        {err && <p className="bp-alert bp-alert-error" style={{ margin: '10px 0 0' }}>{err}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button type="button" className="bp-btn bp-btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button"
            className="bp-btn"
            onClick={submit}
            disabled={saving}
            style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
          >
            {saving ? 'Rejecting…' : 'Reject Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Gstr3bRequestsPanel({ returnType = 'GSTR3B' }) {
  const returnLabel = returnType === 'CMP08' ? 'CMP-08' : 'GSTR-3B';
  const [searchParams] = useSearchParams();
  const highlightId = Number(searchParams.get('request')) || null;

  const [data, setData] = useState({ requests: [], pending_count: 0 });
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    return api(`/client/gstr3b/requests?return_type=${returnType}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [returnType]);

  useEffect(() => { load(); }, [load]);

  const accept = async (r) => {
    setBusyId(r.id);
    setErr('');
    try {
      await api(`/client/gstr3b/requests/${r.id}/accept`, { method: 'POST', body: {} });
      await load();
    } catch (e) {
      setErr(e.message || 'Could not accept the request.');
    } finally {
      setBusyId(null);
    }
  };

  if (!loaded || data.requests.length === 0) return null;

  return (
    <div className="bp-card no-print" id="gstr3b-requests" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--bp-border, #e2e8f0)' }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--bp-navy)' }}>{returnLabel} Requests</span>
        {data.pending_count > 0 && (
          <span style={{ background: '#dc2626', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
            {data.pending_count} New Request{data.pending_count > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {err && <p className="bp-alert bp-alert-error" style={{ margin: '10px 18px 0' }}>{err}</p>}
      <div className="bp-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="bp-table">
          <thead>
            <tr>
              <th>Tax Period</th>
              <th>Request Status</th>
              <th>Initiated By</th>
              <th>Request Date</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.requests.map((r) => (
              <tr key={r.id} style={r.id === highlightId ? { background: '#eff6ff' } : undefined}>
                <td style={{ fontWeight: 600 }}>{r.period_label}</td>
                <td>
                  <StatusPill status={r.status} label={r.status_label} />
                  {r.rejection_reason && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>Reason: {r.rejection_reason}</div>
                  )}
                </td>
                <td style={{ fontWeight: 600 }}>{r.initiated_by_name}</td>
                <td>{r.created_at}</td>
                <td style={{ textAlign: 'center' }}>
                  {r.awaiting_client ? (
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      <button
                        type="button"
                        className="bp-btn bp-btn-primary"
                        style={{ height: 32, padding: '0 14px' }}
                        disabled={busyId === r.id}
                        onClick={() => accept(r)}
                      >
                        {busyId === r.id ? 'Accepting…' : 'Accept Request'}
                      </button>
                      <button
                        type="button"
                        className="bp-btn"
                        style={{ height: 32, padding: '0 14px', background: '#fff', color: '#dc2626', border: '1.5px solid #dc2626' }}
                        disabled={busyId === r.id}
                        onClick={() => setRejecting(r)}
                      >
                        Reject Request
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rejecting && (
        <RejectModal
          request={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => { setRejecting(null); load(); }}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

const TEXT_LABELS = {
  bank_name: 'Bank Name',
  bank_branch: 'Branch',
  account_holder_name: 'Account Holder',
  bank_account: 'Account Number',
  bank_ifsc: 'IFSC',
  swift_code: 'SWIFT',
  account_type: 'Account Type',
  upi_id: 'UPI ID',
  signatory_name: 'Signatory Name',
  invoice_prefix: 'Tax Invoice/Bill of Supply Prefix',
  bill_of_supply_prefix: 'Bill of Supply Prefix',
  credit_note_prefix: 'Credit Note Prefix',
  debit_note_prefix: 'Debit Note Prefix',
  quotation_prefix: 'Quotation Prefix',
  terms_conditions: 'Terms & Conditions',
};

const ASSET_KEYS = [
  ['logo_path', 'Logo'],
  ['signature_path', 'Signature'],
  ['seal_path', 'Seal'],
  ['qr_code_path', 'QR Code'],
];

function storageUrl(path) {
  return path ? `/storage/${path}` : null;
}

function StatusBadge({ status }) {
  const cls = status === 'approved' ? 'bp-badge-paid' : status === 'rejected' ? 'bp-badge-cancelled' : 'bp-badge-partial';
  return <span className={`bp-badge ${cls}`}>{status}</span>;
}

export function AdminChangeRequestList() {
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ status });
    if (q) qs.set('q', q);
    api(`/admin/change-requests?${qs}`)
      .then((d) => setRows(d.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status]);

  return (
    <div>
      <div className="bp-toolbar" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Pending Approval</h2>
          <p style={{ color: 'var(--bp-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Business profile / billing settings change requests from the Client Portal.
          </p>
        </div>
        <select className="bp-input" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <input className="bp-input" style={{ maxWidth: 220 }} placeholder="Search client" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="bp-btn bp-btn-primary" onClick={load}>Apply</button>
      </div>
      <div className="bp-card" style={{ overflowX: 'auto' }}>
        {loading ? <p>Loading…</p> : (
          <table className="bp-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Submitted</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td>{r.client_profile?.business_name || r.client_profile?.client_name || '—'}</td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td><Link className="bp-btn bp-btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} to={`/admin/pending-approval/${r.id}`}>Review</Link></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5}>No change requests</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function AdminChangeRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api(`/admin/change-requests/${id}`)
      .then((d) => {
        setData(d);
        setNote(d.admin_note || '');
      })
      .catch((e) => setErr(e.message));
  };

  useEffect(() => { load(); }, [id]);

  if (err && !data) return <p style={{ color: 'var(--bp-red)' }}>{err}</p>;
  if (!data) return <p>Loading…</p>;

  const approved = data.approved || { text: {} };
  const proposed = data.proposed || { text: {}, staged: {} };
  const pending = data.status === 'pending';

  const act = async (action) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await api(`/admin/change-requests/${id}/${action}`, {
        method: 'POST',
        body: { admin_note: note || null },
      });
      setMsg(res.message);
      setData(res.request);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="bp-toolbar" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, flex: 1 }}>
          Pending Approval #{data.id}{' '}
          <StatusBadge status={data.status} />
        </h2>
        <button type="button" className="bp-btn bp-btn-outline" onClick={() => navigate('/admin/pending-approval')}>Back to list</button>
      </div>

      <div className="bp-card" style={{ marginBottom: 14 }}>
        <p style={{ margin: 0 }}>
          <strong>{data.client?.business_name || data.client?.client_name}</strong>
          {data.client?.client_code ? ` · ${data.client.client_code}` : ''}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
          Submitted {data.created_at ? new Date(data.created_at).toLocaleString('en-IN') : '—'}
          {data.submitter ? ` by ${data.submitter.name}` : ''}
        </p>
      </div>

      <div className="bp-split">
        <div className="bp-card">
          <h3 style={{ marginTop: 0 }}>Approved (live on invoices)</h3>
          {ASSET_KEYS.map(([key, label]) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <strong className="bp-field-title">{label}</strong>
              {approved[key] ? (
                <div><a href={storageUrl(approved[key])} target="_blank" rel="noreferrer"><img src={storageUrl(approved[key])} alt={label} style={{ maxHeight: 72, marginTop: 4 }} /></a></div>
              ) : <div style={{ color: 'var(--bp-muted)', fontSize: 12 }}>None</div>}
            </div>
          ))}
          {Object.entries(TEXT_LABELS).map(([k, label]) => (
            <div key={k} className="bp-gst-row" style={{ fontSize: 13 }}>
              <span>{label}</span>
              <strong style={{ textAlign: 'right', maxWidth: '55%' }}>{approved.text?.[k] || '—'}</strong>
            </div>
          ))}
          {data.section === 'layout' && approved.layout && (
            <div className="bp-gst-row" style={{ fontSize: 13 }}>
              <span>Layout &amp; Colour</span>
              <strong style={{ textAlign: 'right' }}>Layout {approved.layout.layout_id} · {String(approved.layout.colour_scheme).replace(/_/g, ' ')}</strong>
            </div>
          )}
        </div>

        <div className="bp-card">
          <h3 style={{ marginTop: 0 }}>Proposed</h3>
          {ASSET_KEYS.map(([key, label]) => {
            const staged = proposed.staged?.[key];
            const path = staged || proposed[key];
            return (
              <div key={key} style={{ marginBottom: 10 }}>
                <strong className="bp-field-title">{label}{staged ? ' (new upload)' : ''}</strong>
                {path ? (
                  <div><a href={storageUrl(path)} target="_blank" rel="noreferrer"><img src={storageUrl(path)} alt={label} style={{ maxHeight: 72, marginTop: 4 }} /></a></div>
                ) : <div style={{ color: 'var(--bp-muted)', fontSize: 12 }}>None</div>}
              </div>
            );
          })}
          {Object.entries(TEXT_LABELS).map(([k, label]) => {
            const a = approved.text?.[k] || '';
            const p = proposed.text?.[k] || '';
            const changed = a !== p;
            return (
              <div key={k} className="bp-gst-row" style={{ fontSize: 13, background: changed ? '#fff8e6' : undefined }}>
                <span>{label}</span>
                <strong style={{ textAlign: 'right', maxWidth: '55%' }}>{p || '—'}</strong>
              </div>
            );
          })}
          {data.section === 'layout' && proposed.layout && (
            <div className="bp-gst-row" style={{ fontSize: 13, background: '#fff8e6' }}>
              <span>Layout &amp; Colour</span>
              <strong style={{ textAlign: 'right' }}>Layout {proposed.layout.layout_id} · {String(proposed.layout.colour_scheme).replace(/_/g, ' ')}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="bp-card" style={{ marginTop: 14 }}>
        <label>
          <strong className="bp-field-title">Admin note</strong>
          <textarea className="bp-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={!pending} />
        </label>
        {pending && (
          <div className="bp-toolbar" style={{ marginTop: 12 }}>
            <button type="button" className="bp-btn bp-btn-green" disabled={busy} onClick={() => act('approve')}>Approve &amp; Update Master</button>
            <button type="button" className="bp-btn bp-btn-danger" disabled={busy} onClick={() => act('reject')}>Reject</button>
          </div>
        )}
        {msg && <p style={{ color: 'var(--bp-green)' }}>{msg}</p>}
        {err && <p style={{ color: 'var(--bp-red)' }}>{err}</p>}
      </div>
    </div>
  );
}

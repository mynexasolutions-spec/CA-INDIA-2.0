import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

const RESEND_COOLDOWN = 60; // seconds before 'Resend OTP' is enabled (OTP itself stays valid for 5 minutes)

const inp = { border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };

/* ── Deletion flow modal (4 steps) ─────────────────────────────── */
function DeletionModal({ companies, onClose }) {
  const [step, setStep] = useState(1); // 1=confirm name, 2=otp, 3=success
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [timer, setTimer] = useState(RESEND_COOLDOWN);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const timerRef = useRef(null);
  const devOtp = useRef(null);

  const bulk = companies.length > 1;
  const nameOf = (c) => c.business_name ?? c.client_name ?? '';
  const expectedName = bulk ? 'DELETE' : nameOf(companies[0]);
  const body = () => (bulk
    ? { client_profile_ids: companies.map((c) => c.id), confirm_text: name }
    : { client_profile_id: companies[0].id, confirm_name: name });

  const startTimer = () => {
    setTimer(RESEND_COOLDOWN);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; }), 1000);
  };

  const fmtTimer = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const proceed = async () => {
    if (name.trim() !== expectedName.trim()) {
      return setErr(bulk ? 'Type DELETE exactly to confirm.' : 'Company name does not match. Please type the exact name.');
    }
    setBusy(true); setErr('');
    try {
      const res = await api('/admin/company-deletion/request-otp', { method: 'POST', body: body() });
      setToken(res.token);
      setSentTo(res.sent_to);
      devOtp.current = res._dev_otp;
      startTimer();
      setStep(2);
    } catch (ex) {
      setErr(ex.message || 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true); setErr('');
    try {
      await api('/admin/company-deletion/verify-and-delete', {
        method: 'POST', body: { token, otp },
      });
      clearInterval(timerRef.current);
      setStep(3);
    } catch (ex) {
      setErr(ex.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    setBusy(true); setErr('');
    try {
      // A fresh code for the same deletion (the earlier code stops working).
      const res = await api('/admin/company-deletion/resend-otp', { method: 'POST', body: { token } });
      devOtp.current = res._dev_otp;
      setOtp('');
      startTimer();
    } catch (ex) {
      setErr(ex.message || 'Resend failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 420, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

        {step === 1 && (
          <>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete Company
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 18, display: 'flex', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div style={{ fontSize: 13, color: '#dc2626' }}>
                  This action will permanently delete {bulk ? `the ${companies.length} selected companies` : 'the selected company'} from the system. It cannot be undone.
                </div>
              </div>

              {bulk && (
                <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13, color: '#334155', maxHeight: 110, overflowY: 'auto' }}>
                  {companies.map((c) => <li key={c.id}>{nameOf(c)}</li>)}
                </ul>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 6 }}>
                  {bulk ? 'Type DELETE to confirm' : 'Company Name'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder={bulk ? 'DELETE' : 'Enter company name'} style={inp} />
              </div>
              {name && name.trim() !== expectedName.trim() && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{bulk ? 'Please type DELETE exactly to confirm.' : 'Please enter the exact company name to confirm.'} This action cannot be undone.</span>
                </div>
              )}
              {err && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{err}</div>}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={proceed} disabled={busy || !name} style={{ padding: '9px 22px', background: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Sending OTP…' : 'Proceed for Deletion'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1e3a5f' }}>Verify OTP</div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ padding: '22px' }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: '#374151', marginBottom: 6 }}>We have sent a 6-digit OTP to your registered email address.</div>
                <div style={{ fontWeight: 700, color: '#1e3a5f' }}>{sentTo}</div>
                {devOtp.current && (
                  <div style={{ marginTop: 8, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#92400e' }}>
                    Dev mode OTP: <strong>{devOtp.current}</strong>
                  </div>
                )}
              </div>

              {/* OTP boxes */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <input key={i} type="text" maxLength={1} value={otp[i] ?? ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/, '');
                      const arr = otp.split('');
                      arr[i] = v;
                      setOtp(arr.join(''));
                      if (v && e.target.nextElementSibling) e.target.nextElementSibling.focus();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !otp[i] && e.target.previousElementSibling) e.target.previousElementSibling.focus();
                    }}
                    style={{ width: 46, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 800, border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none', color: '#1e3a5f' }} />
                ))}
              </div>

              <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                OTP is valid for 5 minutes.
              </div>
              <div style={{ textAlign: 'center', fontSize: 13, marginBottom: 16 }}>
                Didn't receive OTP?{' '}
                {timer > 0 ? (
                  <span style={{ color: '#94a3b8' }}>Resend OTP ({fmtTimer(timer)})</span>
                ) : (
                  <button onClick={resendOtp} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Resend OTP</button>
                )}
              </div>
              {err && <div style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{err}</div>}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={onClose} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={verify} disabled={busy || otp.length < 6}
                style={{ padding: '9px 22px', background: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', opacity: (busy || otp.length < 6) ? 0.6 : 1 }}>
                {busy ? 'Verifying…' : 'Verify & Delete'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div style={{ padding: '40px 30px', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => onClose(true)} aria-label="Close" style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>✕</button>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1e3a5f', marginBottom: 10 }}>Company Deleted Successfully</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              {bulk
                ? <>{companies.length} companies have been permanently deleted from the system and moved to Deletion History.</>
                : <>The company "<strong>{expectedName}</strong>" has been permanently deleted from the system and moved to Deletion History.</>}
            </div>
            <button onClick={() => onClose(true)} style={{ marginTop: 24, padding: '10px 32px', background: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Deletion History section ───────────────────────────────────── */
function DeletionHistory() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  const load = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: 10 });
    if (search) params.set('search', search);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api(`/admin/company-deletion/history?${params}`)
      .then(d => { setRows(d.data ?? []); setTotal(d.total ?? 0); setLastPage(d.last_page ?? 1); setPage(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const perPage = 10;

  return (
    <div className="cd-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginTop: 28 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a5f' }}>Deletion History</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>View the list of all deleted companies. Deleted companies cannot be restored.</span>
        </div>
      </div>

      {/* History filters */}
      <div className="cd-filter cd-hfilter" style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(1)}
            placeholder="Search in deletion history..." style={{ ...inp, paddingLeft: 28 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>From Date</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: 140 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>To Date</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, width: 140 }} />
        </div>
        <button onClick={() => load(1)} style={{ padding: '8px 18px', background: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Search</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {['Sr. No.', 'Company Name', 'GSTIN', 'PAN', 'Date of Deletion', 'Deleted By', 'Reason', 'Remarks'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#1e3a5f', fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading...</td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No deletion history found.</td></tr>}
          {rows.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 14px', color: '#64748b' }}>{(page - 1) * perPage + i + 1}</td>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{r.company_name}</td>
              <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>{r.gstin ?? '—'}</td>
              <td style={{ padding: '10px 14px', color: '#374151' }}>{r.pan ?? '—'}</td>
              <td style={{ padding: '10px 14px', color: '#374151' }}>{fmtDate(r.deleted_at_time)}</td>
              <td style={{ padding: '10px 14px', color: '#374151' }}>{r.deleted_by_name ?? '—'}</td>
              <td style={{ padding: '10px 14px', color: '#374151' }}>{r.reason ?? '—'}</td>
              <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{r.remarks ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {total > 0 && (
        <div className="cd-bottom" style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</span>
          <div className="cfg-pager" style={{ display: 'flex', gap: 6 }}>
            <PgBtn disabled={page <= 1} onClick={() => load(page - 1)}>‹</PgBtn>
            {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
              <PgBtn key={p} active={p === page} onClick={() => load(p)}>{p}</PgBtn>
            ))}
            <PgBtn disabled={page >= lastPage} onClick={() => load(page + 1)}>›</PgBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function AdminCompanyDeletion() {
  const [summary, setSummary] = useState({ total_deleted: 0, deleted_this_fy: 0, deleted_this_month: 0, pending_deletion: 0 });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [delModal, setDelModal] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadSummary = () => {
    api('/admin/company-deletion/summary').then(setSummary).catch(console.error);
  };

  const load = (p = 1, f = {}) => {
    const q = { search, status, from: fromDate, to: toDate, ...f };
    setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: 10 });
    if (q.search) params.set('search', q.search);
    if (q.status !== 'all') params.set('status', q.status);
    if (q.from) params.set('from', q.from);
    if (q.to) params.set('to', q.to);
    api(`/admin/company-deletion/clients?${params}`)
      .then(d => { setRows(d.data ?? []); setTotal(d.total ?? 0); setLastPage(d.last_page ?? 1); setPage(p); setSelected(new Set()); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSummary(); load(1); }, []);

  const toggleRow = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const deletable = rows;
  const toggleAll = (e) => setSelected(e.target.checked ? new Set(deletable.map(r => r.id)) : new Set());

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const perPage = 10;

  const fyLabel = (() => {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    return m >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
  })();

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '0 0 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, color: '#64748b' }}>
          <span>Settings</span><span>›</span>
          <span style={{ color: '#2563eb', fontWeight: 600 }}>Company Deletion</span>
        </div>
        <div className="cd-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f' }}>Company Deletion</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 3, maxWidth: 600 }}>
              Permanently delete inactive companies from the system. Deleted companies are moved to deletion history and cannot be restored.
            </div>
          </div>
          <button onClick={() => setShowHistory(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            View Deletion History ({summary.total_deleted})
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="cd-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Deleted Companies\n(Till Date)', value: summary.total_deleted, bg: '#fef2f2', color: '#dc2626', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg> },
          { label: `Deleted This Financial Year\n(${fyLabel})`, value: summary.deleted_this_fy, bg: '#eff6ff', color: '#2563eb', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
          { label: `Deleted This Month\n(${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })})`, value: summary.deleted_this_month, bg: '#f0fdf4', color: '#16a34a', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
          { label: 'Pending Deletion\n(Awaiting OTP)', value: summary.pending_deletion, bg: '#fff7ed', color: '#ea580c', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
        ].map(card => (
          <div className="ss-card cd-card-stat" key={card.label} style={{ background: card.bg, borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.05)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="ss-ic" style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a5f', lineHeight: 1.1 }}>{card.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="cd-filter" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(1)}
            placeholder="Search by company name, GSTIN or PAN..." style={{ ...inp, paddingLeft: 28 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Last Activity From</label>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); load(1, { from: e.target.value }); }} style={{ ...inp, width: 150 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Last Activity To</label>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); load(1, { to: e.target.value }); }} style={{ ...inp, width: 150 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</label>
          <select value={status} onChange={e => { setStatus(e.target.value); load(1, { status: e.target.value }); }} style={{ ...inp, width: 120 }}>
            <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main table */}
      <div className="cd-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '11px 14px' }}><input type="checkbox" onChange={toggleAll} checked={deletable.length > 0 && deletable.every(r => selected.has(r.id))} disabled={deletable.length === 0} title="Select all companies on this page" /></th>
              {['Sr. No.', 'Company Name', 'GSTIN', 'PAN', 'Status', 'Created On', 'Last Activity', 'Action'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: '#1e3a5f', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No companies found.</td></tr>}
            {rows.map((r, i) => {
              const isSelected = selected.has(r.id);
              const active = r.is_active !== false;
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#f0f7ff' : 'transparent' }}>
                  <td style={{ padding: '11px 14px' }}><input type="checkbox" checked={isSelected} onChange={() => toggleRow(r.id)} style={{ accentColor: '#2563eb' }} /></td>
                  <td style={{ padding: '11px 14px', color: '#64748b' }}>{(page - 1) * perPage + i + 1}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1e293b' }}>{r.business_name ?? r.client_name}</td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>{r.gstin ?? '—'}</td>
                  <td style={{ padding: '11px 14px', color: '#374151' }}>{r.pan ?? '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: active ? '#dcfce7' : '#fee2e2', color: active ? '#15803d' : '#b91c1c' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#15803d' : '#b91c1c' }} />
                      {active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: 12 }}>{fmtDate(r.last_activity)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <button onClick={() => setDelModal([r])}
                      title="Delete this company"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 7, fontSize: 12.5, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Bottom bar */}
        <div className="cd-bottom" style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{selected.size} company(ies) selected</span>
            {selected.size > 0 && (
              <button onClick={() => setDelModal(rows.filter(r => selected.has(r.id)))} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 7, fontSize: 12.5, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                Delete Selected ({selected.size})
              </button>
            )}
          </div>
          {total > 0 && (
            <div className="cfg-pager" style={{ display: 'flex', gap: 6 }}>
              <PgBtn disabled={page <= 1} onClick={() => load(page - 1)}>‹</PgBtn>
              {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
                <PgBtn key={p} active={p === page} onClick={() => load(p)}>{p}</PgBtn>
              ))}
              <PgBtn disabled={page >= lastPage} onClick={() => load(page + 1)}>›</PgBtn>
            </div>
          )}
        </div>
      </div>

      {/* Deletion History */}
      {showHistory && <DeletionHistory />}

      {/* Deletion modal */}
      {delModal && (
        <DeletionModal companies={delModal} onClose={ok => { setDelModal(null); if (ok) { loadSummary(); load(page); } }} />
      )}
    </div>
  );
}

const PgBtn = ({ children, active, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} style={{
    minWidth: 34, height: 34, border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`, borderRadius: 7,
    background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#374151',
    fontSize: 13, fontWeight: active ? 700 : 400, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, padding: '0 8px',
  }}>{children}</button>
);

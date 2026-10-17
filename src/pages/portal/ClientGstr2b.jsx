import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useClientPortal } from '../../components/portal/ClientPortalContext';
import { LoadingBlock } from '../../components/Spinner';
import { buildFyOptions } from '../billing/billingUtils';

function money(n) {
  return `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }) {
  const live = status === 'available';
  return (
    <span style={{
      display: 'inline-block', minWidth: 92, padding: '4px 14px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
      background: live ? '#d9f3e3' : '#e8edf5', color: live ? '#15803d' : '#64748b', textAlign: 'center',
    }}>
      {live ? 'Available' : 'Upcoming'}
    </span>
  );
}

function InfoRow({ k, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '116px 10px 1fr', alignItems: 'center', fontSize: 12.5, lineHeight: 1.9, marginBottom: 5 }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>{k}</span>
      <span style={{ color: '#94a3b8' }}>:</span>
      <span style={{ color: '#0f2a5f', fontWeight: 700 }}>{children}</span>
    </div>
  );
}
const Pill = ({ bg, fg, children }) => (
  <span style={{ display: 'inline-block', padding: '2px 12px', borderRadius: 999, background: bg, color: fg, fontSize: 11.5, fontWeight: 800 }}>{children}</span>
);

const EyeIc = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-08" -> "Aug 2026"; quarter keys are shown through the label the server sends. */
function periodText(key, label) {
  if (label) return label;
  const m = /^(\d{4})-(\d{2})$/.exec(key || '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : key || '—';
}

export default function ClientGstr2b() {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const navigate = useNavigate();
  const portal = useClientPortal();

  const fyOptions = buildFyOptions();
  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFy = `${currentFyStart}-${String(currentFyStart + 1).slice(-2)}`;
  const fy = portal?.fy || fyOptions[0] || defaultFy;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    setErr('');
    api(`/client/gstr2b/periods?financial_year=${fy}`)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [fy]);

  const periods = data?.periods || [];
  const last = data?.last_gstr2b;
  const nextUpcoming = periods.find((p) => p.status === 'upcoming');
  const freq = data?.profile?.filing_frequency === 'quarterly' ? 'Quarterly' : 'Monthly';
  const regType = data?.profile?.registration_type || 'Regular';

  const card = { background: '#fff', border: '1px solid #e3ebf6', borderRadius: 16, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: '0 10px 24px -22px rgba(15,42,95,.6)' };
  const ico = (path) => (
    <span style={{ width: 40, height: 40, borderRadius: 12, background: '#e6eeff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
    </span>
  );
  const infoDot = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#2563eb" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="2.2" strokeLinecap="round" /><line x1="12" y1="7.5" x2="12.01" y2="7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <Link to="/portal" style={{ color: '#2563eb', textDecoration: 'none' }}>Home</Link><span>›</span>
        <span>GST Compliance</span><span>›</span><span style={{ color: '#1e293b' }}>GSTR-2B</span>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f2a5f', letterSpacing: '-0.01em' }}>
          GSTR-2B – Inward Supplies <span style={{ fontWeight: 600 }}>(ITC Statement)</span>
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>View GSTR-2B status and ITC details for each tax period. Download, reconcile and review your inward supplies.</p>
      </div>

      <div className="cl-info3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={card}>
          {ico(<><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 21v-4h6v4M9 7h.01M9 11h.01M15 7h.01M15 11h.01" /></>)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#0f2a5f', marginBottom: 4 }}>Client Details</div>
            <InfoRow k="Client Name">{profile?.business_name || data?.profile?.business_name || '—'}</InfoRow>
            <InfoRow k="GSTIN">{profile?.gstin || data?.profile?.gstin || '—'}</InfoRow>
            <InfoRow k="Registration Type"><Pill bg="#dcfce7" fg="#15803d">{regType}</Pill></InfoRow>
            <InfoRow k="Filing Frequency"><Pill bg="#dbeafe" fg="#1d4ed8">{freq}</Pill></InfoRow>
          </div>
        </div>

        <div style={card}>
          {ico(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#0f2a5f', marginBottom: 4 }}>Last GSTR-2B Available</div>
            <InfoRow k="Tax Period">{last ? periodText(last.period, last.label) : '—'}</InfoRow>
            <InfoRow k="Available On">{last?.available_on || '—'}</InfoRow>
            <InfoRow k="Total ITC">{last ? money(last.total_itc) : '—'}</InfoRow>
          </div>
        </div>

        <div style={card}>
          {ico(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#0f2a5f', marginBottom: 4 }}>Upcoming GSTR-2B</div>
            <InfoRow k="Tax Period">{nextUpcoming ? periodText(nextUpcoming.period, nextUpcoming.label) : '—'}</InfoRow>
            <InfoRow k="Expected On">{nextUpcoming?.expected_on || '—'}</InfoRow>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eaf3ff', border: '1px solid #cfe2ff', borderRadius: 12, padding: '12px 18px', marginBottom: 18, fontSize: 13, color: '#1e3a8a' }}>
        {infoDot}
        <span>GSTR-2B is an auto-drafted ITC statement generated by GSTN. The data is made available on or before the 14th of the succeeding month.</span>
      </div>

      <div className="il-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f2a5f' }}>Filing Periods (FY {fy})</h3>
        </div>
        {loading ? (
          <div style={{ padding: 28 }}><LoadingBlock /></div>
        ) : err ? (
          <p className="bp-alert bp-alert-error" style={{ margin: '0 20px 16px' }}>{err}</p>
        ) : (
          <div style={{ overflowX: 'auto', padding: '0 20px 6px' }}>
            <table className="bp-table bd-table fp-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  {['Tax Period', 'Available On', 'Status', 'Total ITC (₹)', 'Action'].map((h) => (
                    <th key={h} style={{ background: '#0f3a8a', color: '#fff' }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const live = p.status === 'available';
                  return (
                    <tr key={p.period}>
                      <td style={{ fontWeight: 800, color: live ? '#0f2a5f' : '#475569', whiteSpace: 'nowrap' }}>{periodText(p.period, p.label)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: live ? '#334155' : '#94a3b8' }}>{live ? p.available_on : (p.expected_on || '—')}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td style={{ fontWeight: 700, color: live && p.total_itc > 0 ? '#0f2a5f' : '#94a3b8' }}>
                        {live ? Number(p.total_itc || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          disabled={!live}
                          onClick={() => live && navigate(`/portal/gstr-2b/${p.period}`)}
                          style={{
                            height: 34, padding: '0 18px', borderRadius: 9, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                            fontWeight: 700, fontSize: 12.5, cursor: live ? 'pointer' : 'not-allowed',
                            background: live ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : '#d5dce8',
                            color: live ? '#fff' : '#8a97ad',
                            boxShadow: live ? '0 8px 14px -8px rgba(29,78,216,.8)' : 'none',
                          }}
                        >
                          <EyeIc /> View GSTR-2B
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!periods.length && (
                  <tr><td colSpan={5} style={{ padding: '40px 16px', color: '#94a3b8' }}>No periods found for {fy}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ margin: '14px 20px 18px', padding: '11px 16px', background: '#eaf3ff', border: '1px solid #cfe2ff', borderRadius: 12, fontSize: 12.5, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 10 }}>
          {infoDot}
          All dates are in format: DD MMM YYYY <span style={{ opacity: 0.4 }}>|</span> Future months are shown for your reference.
        </div>
      </div>
    </div>
  );
}

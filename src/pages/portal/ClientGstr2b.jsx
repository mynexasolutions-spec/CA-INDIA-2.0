import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { LoadingBlock } from '../../components/Spinner';
import { buildFyOptions } from '../billing/billingUtils';

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }) {
  if (status === 'available') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
        background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
        Available
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
      Upcoming
    </span>
  );
}

export default function ClientGstr2b() {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const navigate = useNavigate();

  const fyOptions = buildFyOptions();
  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFy = `${currentFyStart}-${String(currentFyStart + 1).slice(-2)}`;

  const [fy, setFy] = useState(defaultFy);
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
  const lastGstr2b = data?.last_gstr2b;
  const nextUpcoming = periods.find((p) => p.status === 'upcoming');

  const infoCards = [
    {
      title: 'Client Details',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
      color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
      rows: [
        { label: 'Business Name', value: profile?.business_name || '—' },
        { label: 'GSTIN', value: profile?.gstin || '—' },
        { label: 'Filing Frequency', value: data?.profile?.filing_frequency ? (data.profile.filing_frequency === 'quarterly' ? 'Quarterly' : 'Monthly') : '—' },
      ],
    },
    {
      title: 'Last GSTR-2B Available',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0',
      rows: lastGstr2b ? [
        { label: 'Tax Period', value: lastGstr2b.period },
        { label: 'Available On', value: lastGstr2b.available_on },
      ] : [
        { label: 'Status', value: 'No GSTR-2B filed yet' },
      ],
    },
    {
      title: 'Upcoming GSTR-2B',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      color: '#d97706', bg: '#fffbeb', border: '#fde68a',
      rows: nextUpcoming ? [
        { label: 'Next Period', value: nextUpcoming.label },
        { label: 'Status', value: 'Awaiting from GST Portal' },
      ] : [
        { label: 'Status', value: 'All periods available' },
      ],
    },
  ];

  return (
    <div>
      <div className="bp-toolbar no-print" style={{ marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--bp-navy)' }}>GSTR-2B</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
            View auto-populated ITC data from the GST portal.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--bp-navy)', whiteSpace: 'nowrap' }}>Financial Year</label>
          <select
            className="bp-select"
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            style={{ height: 38, minWidth: 110 }}
          >
            {fyOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {infoCards.map((card) => (
          <div key={card.title} style={{
            background: card.bg, border: `1.5px solid ${card.border}`, borderRadius: 12, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                width: 36, height: 36, borderRadius: 8, background: '#fff',
                border: `1px solid ${card.border}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: card.color, flexShrink: 0,
              }}>
                {card.icon}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: card.color }}>{card.title}</span>
            </div>
            {card.rows.map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{row.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Filing Periods Table */}
      <div className="bp-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--bp-navy)' }}>Filing Periods – {fy}</span>
        </div>

        {loading ? (
          <div style={{ padding: 32 }}><LoadingBlock /></div>
        ) : err ? (
          <p className="bp-alert bp-alert-error" style={{ margin: 16 }}>{err}</p>
        ) : (
          <div className="bp-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="bp-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Tax Period</th>
                  <th>Available On</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total ITC (₹)</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={p.period}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ fontWeight: 700, color: 'var(--bp-navy)' }}>{p.label}</td>
                    <td style={{ color: p.available_on ? '#374151' : '#94a3b8' }}>
                      {p.available_on || '—'}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: p.total_itc > 0 ? '#15803d' : '#94a3b8' }}>
                      {p.status === 'available' ? money(p.total_itc) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {p.status === 'available' ? (
                        <button
                          type="button"
                          className="bp-btn bp-btn-primary"
                          style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 6 }}
                          onClick={() => navigate(`/portal/gstr-2b/${p.period}`)}
                        >
                          View GSTR-2B
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Not yet available</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!periods.length && (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--bp-muted)' }}>
                      No periods found for {fy}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{
        marginTop: 14, background: '#f0f7ff', border: '1px solid #dbeafe',
        borderRadius: 8, padding: '10px 14px', color: '#1e40af', fontSize: 13,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="7.5"/><path d="M10 9.2v4.3M10 6.7v.01"/>
        </svg>
        GSTR-2B data is auto-populated from the GST portal by your CA/tax professional. Contact your CA for any discrepancies.
      </div>
    </div>
  );
}

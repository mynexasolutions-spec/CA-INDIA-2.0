import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';

const RETURN_LABELS = { GSTR1: 'GSTR-1', GSTR3B: 'GSTR-3B', CMP08: 'CMP-08' };

export default function AdminGstr1Detail({ returnType = 'GSTR1' }) {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const label = RETURN_LABELS[returnType] ?? 'GSTR-1';

  useEffect(() => {
    setLoading(true);
    api(`/admin/gst-returns/${clientId}/periods?return_type=${returnType}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId, returnType]);

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: 15, fontWeight: 500 }}>
        Loading GSTR-1 details...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#dc2626', fontSize: 15 }}>
        Error: {error}
      </div>
    );
  }

  if (!data || !data.client) return null;

  const { client, last_filed, upcoming_due_dates = {}, fy = '2026-27', periods = [] } = data;
  const listTab = returnType === 'GSTR1' ? 'gstr-1' : returnType === 'GSTR3B' ? 'gstr-3b' : 'cmp-08';
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

  const clientCode = client.client_code || `CL-${String(client.id).padStart(3, '0')}`;
  const isRegular = (client.dealer_type || '').toLowerCase() === 'regular';
  const filingFreqDisplay = client.filing_frequency_label || cap(client.filing_frequency || 'monthly');

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: '0 0 40px' }}>
      {/* Breadcrumb */}
      <div className="gst-crumbs" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13 }}>
        <Link to="/admin/gst-returns" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
          GST Compliance
        </Link>
        <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>&gt;</span>
        <Link to={`/admin/gst-returns?tab=${listTab}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
          {label}
        </Link>
        <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>&gt;</span>
        <span style={{ color: '#2563eb', fontWeight: 600 }}>{client.business_name || client.client_name}</span>
      </div>

      {/* Page Header */}
      <div className="gst-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1e3a8a', lineHeight: 1.2 }}>
            {label} – Outward Supplies
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: 13.5, color: '#475569', fontWeight: 400 }}>
            View filing status, due dates and manage {label} for this client. Billing documents will be automatically fetched for the selected period.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 18px',
            background: '#fff',
            border: '1.5px solid #2563eb',
            borderRadius: 8,
            fontSize: 13.5,
            fontWeight: 600,
            color: '#2563eb',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background .15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M10 2v8l3-3 3 3V2" />
          </svg>
          User Guide
        </button>
      </div>

      {/* 3 Info Cards */}
      <div className="gst-info3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0,
          marginBottom: 16,
          border: '1.5px solid #bfdbfe',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {/* Card 1: Client Info */}
        <div style={{ padding: '16px 20px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                <path d="M6 12H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                <path d="M10 6h4" />
                <path d="M10 10h4" />
                <path d="M10 14h4" />
                <path d="M10 18h4" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14.5,
                  color: '#0f172a',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {client.business_name || client.client_name}
              </span>
            </div>
            <span
              style={{
                padding: '2px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: client.is_active ? '#dcfce7' : '#fee2e2',
                color: client.is_active ? '#16a34a' : '#dc2626',
                flexShrink: 0,
              }}
            >
              {client.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={lblCell}>Client ID</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>{clientCode}</td>
              </tr>
              <tr>
                <td style={lblCell}>GSTIN</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>{client.gstin || '—'}</td>
              </tr>
              <tr>
                <td style={lblCell}>Registration Type</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: isRegular ? '#dcfce7' : '#dbeafe',
                      color: isRegular ? '#16a34a' : '#1d4ed8',
                    }}
                  >
                    {cap(client.dealer_type)}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={lblCell}>Filing Frequency</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: '#dbeafe',
                      color: '#1d4ed8',
                    }}
                  >
                    {filingFreqDisplay}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Card 2: Last Filed */}
        <div style={{ padding: '16px 20px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14.5, color: '#1e3a8a' }}>Last {label} Filed</span>
          </div>

          {last_filed ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={lblCell}>Return Period</td>
                  <td style={colonCell}>:</td>
                  <td style={valCell}>{last_filed.tax_period}</td>
                </tr>
                <tr>
                  <td style={lblCell}>Filed On</td>
                  <td style={colonCell}>:</td>
                  <td style={valCell}>{last_filed.filed_on || '—'}</td>
                </tr>
                <tr>
                  <td style={lblCell}>ARN</td>
                  <td style={colonCell}>:</td>
                  <td style={valCell}>{last_filed.arn || '—'}</td>
                </tr>
                <tr>
                  <td style={lblCell}>Status</td>
                  <td style={colonCell}>:</td>
                  <td style={valCell}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 14px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#dcfce7',
                        color: '#16a34a',
                      }}
                    >
                      Filed
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 13, paddingTop: 10 }}>No returns filed yet.</div>
          )}
        </div>

        {/* Card 3: Upcoming Due Dates */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14.5, color: '#1e3a8a' }}>Upcoming Due Dates</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={lblCell}>Current Due Date</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>{upcoming_due_dates.current || '—'}</td>
              </tr>
              <tr>
                <td style={lblCell}>Next Due Date</td>
                <td style={colonCell}>:</td>
                <td style={valCell}>{upcoming_due_dates.next || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: '#1e40af',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" fill="#2563eb" />
          <line x1="12" y1="10.5" x2="12" y2="16.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="12" cy="7.2" r="1.3" fill="#fff" />
        </svg>
        <span>
          Your GST registration is <strong>{cap(client.dealer_type)}</strong> and the filing frequency is{' '}
          <strong>{filingFreqDisplay}</strong>. Your billing documents will be automatically fetched when you proceed with filing.
        </span>
      </div>

      {/* Table Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e3a8a' }}>
          Filing Periods (FY {fy})
        </h2>
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            background: '#fff',
            border: '1.5px solid #93c5fd',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: '#2563eb',
            cursor: 'pointer',
            transition: 'all .15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.background = '#eff6ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#93c5fd';
            e.currentTarget.style.background = '#fff';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
          </svg>
          View Compliance Calendar
        </button>
      </div>

      {/* Filing Periods Table */}
      <div className="gst-periods" style={{ border: '1.5px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: '#0e3a6c' }}>
              <th style={thStyle('#', 55)}>#</th>
              <th style={thStyle('Tax Period', 130)}>Tax Period</th>
              <th style={thStyle('Due Date', 140)}>Due Date</th>
              <th style={thStyle('Status', 140)}>Status</th>
              <th style={thStyle('Filed On', 140)}>Filed On</th>
              <th style={thStyle('ARN', 170)}>ARN</th>
              <th style={{ ...thStyle('Action', 140), borderRight: 'none' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: 14 }}>
                  No filing periods found for FY {fy}.
                </td>
              </tr>
            ) : (
              periods.map((p, idx) => {
                const isPending = p.status === 'pending';
                const isFiled = p.status === 'filed';
                const isUpcoming = p.status === 'upcoming';

                return (
                  <tr
                    key={p.period}
                    style={{ borderBottom: '1px solid #e2e8f0', transition: 'background .15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    {/* 1. # */}
                    <td style={tdCell('center', 600, '#1e293b')}>
                      {idx + 1}
                    </td>

                    {/* 2. Tax Period */}
                    <td style={tdCell('center', 700, '#1e293b')}>
                      {p.label}
                    </td>

                    {/* 3. Due Date */}
                    <td style={tdCell('center', 500, '#1e293b')}>
                      {p.due_date}
                    </td>

                    {/* 4. Status Badge */}
                    <td style={{ ...tdCell('center'), padding: '10px 14px' }}>
                      {isFiled && (
                        <span style={statusBadgeStyle('#dcfce7', '#16a34a')}>
                          Filed
                        </span>
                      )}
                      {isPending && (
                        <span style={statusBadgeStyle('#ffedd5', '#ea580c')}>
                          Pending
                        </span>
                      )}
                      {isUpcoming && (
                        <span style={statusBadgeStyle('#eff6ff', '#0284c7')}>
                          Upcoming
                        </span>
                      )}
                    </td>

                    {/* 5. Filed On */}
                    <td style={tdCell('center', 500, p.filed_on ? '#1e293b' : '#94a3b8')}>
                      {p.filed_on || '—'}
                    </td>

                    {/* 6. ARN */}
                    <td style={tdCell('center', 500, p.arn ? '#1e293b' : '#94a3b8')}>
                      {p.arn || '—'}
                    </td>

                    {/* 7. Action Button */}
                    <td style={{ ...tdCell('center'), borderRight: 'none' }}>
                      {isFiled && (
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/gst-returns/${listTab}/${clientId}/review/${p.period}`)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '5px 22px',
                            background: '#fff',
                            border: '1.5px solid #3b82f6',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#2563eb',
                            cursor: 'pointer',
                            transition: 'all .15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#eff6ff';
                            e.currentTarget.style.borderColor = '#1d4ed8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.borderColor = '#3b82f6';
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          View
                        </button>
                      )}

                      {isPending && (
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/gst-returns/${listTab}/${clientId}/review/${p.period}`)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '6px 22px',
                            background: '#1d4ed8',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#fff',
                            cursor: 'pointer',
                            transition: 'background .15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                          Review
                        </button>
                      )}

                      {isUpcoming && <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer Note */}
        <div
          style={{
            padding: '10px 18px',
            background: '#f0f7ff',
            borderTop: '1px solid #bfdbfe',
            fontSize: 12.5,
            color: '#334155',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" fill="#2563eb" />
            <line x1="12" y1="10.5" x2="12" y2="16.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="12" cy="7.2" r="1.3" fill="#fff" />
          </svg>
          All dates are in format: DD/MM/YYYY &nbsp;|&nbsp; Future months are shown for your reference.
        </div>
      </div>

      {/* User Guide Modal */}
      {showGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowGuide(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 500,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  <path d="M10 2v8l3-3 3 3V2" />
                </svg>
                <h3 style={{ margin: 0, fontSize: 17, color: '#1e3a8a', fontWeight: 700 }}>GSTR-1 Outward Supplies Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, margin: '0 0 14px' }}>
              GSTR-1 is a monthly or quarterly return that summarizes all outward supplies (sales) made by a Regular taxpayer.
            </p>
            <ul style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, paddingLeft: 20, margin: '0 0 16px' }}>
              <li><strong>Due Date:</strong> 11th of the succeeding month for monthly filers.</li>
              <li><strong>Review:</strong> Click <strong>Review</strong> on any pending period to verify B2B invoices and sales summaries fetched from billing.</li>
              <li><strong>Filed Status:</strong> Completed filings display ARN and submission date, with full audit trail.</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                style={{
                  padding: '8px 22px',
                  background: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Calendar Modal */}
      {showCalendar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowCalendar(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 560,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: '#1e3a8a', fontWeight: 700 }}>
                GST Compliance Calendar (FY {fy})
              </h3>
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', margin: '0 0 14px' }}>
              Standard statutory due dates for GST returns:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#1e3a8a' }}>Return Type</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#1e3a8a' }}>Frequency</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#1e3a8a' }}>Standard Due Date</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>GSTR-1</td>
                  <td style={{ padding: '8px 12px' }}>Monthly</td>
                  <td style={{ padding: '8px 12px' }}>11th of succeeding month</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>GSTR-1 (IFF)</td>
                  <td style={{ padding: '8px 12px' }}>QRMP (Quarterly)</td>
                  <td style={{ padding: '8px 12px' }}>13th of succeeding month</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>GSTR-3B</td>
                  <td style={{ padding: '8px 12px' }}>Monthly</td>
                  <td style={{ padding: '8px 12px' }}>20th of succeeding month</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>CMP-08</td>
                  <td style={{ padding: '8px 12px' }}>Quarterly</td>
                  <td style={{ padding: '8px 12px' }}>18th of month following quarter</td>
                </tr>
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                style={{
                  padding: '8px 22px',
                  background: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers & Styles ──────────────────────────────────────────────────────────
const lblCell = {
  padding: '4px 0',
  color: '#475569',
  whiteSpace: 'nowrap',
  paddingRight: 6,
  verticalAlign: 'middle',
  fontWeight: 500,
};

const colonCell = {
  padding: '4px 6px',
  color: '#64748b',
  verticalAlign: 'middle',
};

const valCell = {
  padding: '4px 0',
  color: '#1e293b',
  verticalAlign: 'middle',
  fontWeight: 500,
};

const thStyle = (title, width) => ({
  padding: '12px 14px',
  textAlign: 'center',
  fontWeight: 700,
  color: '#ffffff',
  fontSize: 13.5,
  whiteSpace: 'nowrap',
  width,
  borderRight: '1px solid rgba(255, 255, 255, 0.15)',
});

const tdCell = (align = 'center', fontWeight = 500, color = '#1e293b') => ({
  padding: '11px 14px',
  textAlign: align,
  fontWeight,
  color,
  fontSize: 13.5,
  borderRight: '1px solid #e2e8f0',
  verticalAlign: 'middle',
});

const statusBadgeStyle = (bg, color) => ({
  display: 'inline-block',
  padding: '4px 18px',
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 600,
  background: bg,
  color,
  minWidth: 84,
  textAlign: 'center',
});

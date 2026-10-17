import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function AdminGstr3bDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    api(`/admin/clients/${clientId}/gstr3b/periods`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', color: '#94a3b8', textAlign: 'center', fontSize: 14, fontFamily: "'Inter', system-ui, sans-serif" }}>
        Loading client details...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 14, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <p style={{ color: '#64748b', marginBottom: 12 }}>Client details could not be loaded.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            api(`/admin/clients/${clientId}/gstr3b/periods`)
              .then(setData)
              .catch(console.error)
              .finally(() => setLoading(false));
          }}
          style={{
            padding: '8px 20px',
            background: '#1d4ed8',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const client = data?.client || {};
  const last_filed = data?.last_filed || null;
  const upcoming_due_dates = data?.upcoming_due_dates || {};
  const fy = data?.fy || '2026-27';
  const periods = data?.periods || [];
  const freqLabel = client?.filing_frequency === 'quarterly' ? 'Quarterly' : 'Monthly';
  const typeLabel = client?.dealer_type === 'composition' ? 'Composition' : 'Regular';

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: '0 0 40px' }}>
      {/* Header */}
      <div className="gst-head gst-head-list" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
            GSTR-3B – Client Details (Admin Portal)
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#2563eb', fontWeight: 400 }}>
            View, verify and manage GSTR-3B for the selected client.
          </p>
        </div>
        <div className="gst-crumbs gst-crumbs-right" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, paddingTop: 4 }}>
          <Link to="/admin/gst-returns?tab=gstr-3b" style={{ color: '#2563eb', textDecoration: 'none' }}>
            GST Compliance
          </Link>
          <span style={{ color: '#93c5fd', fontSize: 12 }}>&gt;</span>
          <Link to="/admin/gst-returns?tab=gstr-3b" style={{ color: '#2563eb', textDecoration: 'none' }}>
            GSTR-3B
          </Link>
          <span style={{ color: '#93c5fd', fontSize: 12 }}>&gt;</span>
          <span style={{ color: '#2563eb' }}>Client Details</span>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="gst-info3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        {/* Card 1: Client Info */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '16px 20px',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <path d="M9 22v-4h6v4" />
              <path d="M8 6h.01" />
              <path d="M16 6h.01" />
              <path d="M12 6h.01" />
              <path d="M12 10h.01" />
              <path d="M12 14h.01" />
              <path d="M16 10h.01" />
              <path d="M16 14h.01" />
              <path d="M8 10h.01" />
              <path d="M8 14h.01" />
            </svg>
          </div>
          <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {client.business_name || client.client_name || 'Client'}
              </span>
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: '#dcfce7',
                  color: '#15803d',
                }}
              >
                Active
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#475569', minWidth: 125, fontWeight: 500 }}>Client ID</span>
                <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                <span style={{ color: '#1e293b', fontWeight: 600 }}>
                  {client.client_code || `CL-${String(client.id).padStart(3, '0')}`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#475569', minWidth: 125, fontWeight: 500 }}>GSTIN</span>
                <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                <span style={{ color: '#1e293b', fontWeight: 600 }}>{client.gstin || '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#475569', minWidth: 125, fontWeight: 500 }}>Registration Type</span>
                <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                <span
                  style={{
                    padding: '1px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#dcfce7',
                    color: '#15803d',
                  }}
                >
                  {typeLabel}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#475569', minWidth: 125, fontWeight: 500 }}>Filing Frequency</span>
                <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                <span
                  style={{
                    padding: '1px 10px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#e0f2fe',
                    color: '#1d4ed8',
                  }}
                >
                  {freqLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Last GSTR-3B Filed */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '16px 20px',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 8 }}>
              Last GSTR-3B Filed
            </div>
            {last_filed ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: '#475569', minWidth: 105, fontWeight: 500 }}>Return Period</span>
                  <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                  <span style={{ color: '#1e293b', fontWeight: 600 }}>{last_filed.tax_period}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: '#475569', minWidth: 105, fontWeight: 500 }}>Filed On</span>
                  <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>{last_filed.filed_on || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: '#475569', minWidth: 105, fontWeight: 500 }}>ARN</span>
                  <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                  <span style={{ color: '#1e293b', fontWeight: 500 }}>{last_filed.arn || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: '#475569', minWidth: 105, fontWeight: 500 }}>Status</span>
                  <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                  <span
                    style={{
                      padding: '1px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      background: '#dcfce7',
                      color: '#15803d',
                    }}
                  >
                    {last_filed.status || 'Filed'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>No returns filed yet.</div>
            )}
          </div>
        </div>

        {/* Card 3: Upcoming Due Dates */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '16px 20px',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e3a8a', marginBottom: 8 }}>
              Upcoming Due Dates
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#475569', minWidth: 120, fontWeight: 500 }}>Current Due Date</span>
                <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                <span style={{ color: '#1e293b', fontWeight: 600 }}>
                  {upcoming_due_dates?.current || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#475569', minWidth: 120, fontWeight: 500 }}>Next Due Date</span>
                <span style={{ color: '#1e293b', marginRight: 8, fontWeight: 500 }}>:</span>
                <span style={{ color: '#1e293b', fontWeight: 600 }}>
                  {upcoming_due_dates?.next || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Strip */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
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
          Your GST registration is <strong style={{ color: '#1e3a8a' }}>{typeLabel}</strong> and the filing frequency is <strong style={{ color: '#1e3a8a' }}>{freqLabel}</strong>. Your billing documents will be automatically fetched when you proceed with filing.
        </span>
      </div>

      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e3a8a' }}>
          Filing Periods (FY {fy})
        </h2>
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: '#fff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#1d4ed8',
            cursor: 'pointer',
            transition: 'all .15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#eff6ff';
            e.currentTarget.style.borderColor = '#1d4ed8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.borderColor = '#bfdbfe';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          View Compliance Calendar
        </button>
      </div>

      {/* Table */}
      <div className="gst-periods" style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: '#0b3b6f', borderBottom: '1.5px solid #bfdbfe' }}>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 13, width: 50 }}>#</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 13, width: 140 }}>Tax Period</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 13, width: 150 }}>Due Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 13, width: 130 }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 13, width: 150 }}>Filed On</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 13, width: 180 }}>ARN</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 13, width: 140 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p, idx) => {
              const isFiled = p.status === 'filed';
              const isPending = p.status === 'pending';

              return (
                <tr
                  key={p.period}
                  style={{ borderBottom: '1px solid #e2e8f0', transition: 'background .15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#1e293b', fontSize: 13.5, fontWeight: 700 }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#1e3a8a', fontSize: 13.5, fontWeight: 700 }}>
                    {p.label}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#334155', fontSize: 13.5, fontWeight: 500 }}>
                    {p.due_date}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 18px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: isFiled ? '#dcfce7' : isPending ? '#fef3c7' : '#f1f5f9',
                        color: isFiled ? '#15803d' : isPending ? '#d97706' : '#64748b',
                      }}
                    >
                      {isFiled ? 'Filed' : isPending ? 'Pending' : 'Upcoming'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#334155', fontSize: 13.5, fontWeight: 500 }}>
                    {p.filed_on || '–'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#334155', fontSize: 13, fontWeight: 500 }}>
                    {p.arn || '–'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {isFiled ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/gst-returns/gstr-3b/${clientId}/review/${p.period}`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          width: 120,
                          height: 32,
                          background: '#fff',
                          border: '1.5px solid #bfdbfe',
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#1d4ed8',
                          cursor: 'pointer',
                          transition: 'all .15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#1d4ed8';
                          e.currentTarget.style.background = '#eff6ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#bfdbfe';
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        View
                      </button>
                    ) : isPending ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/gst-returns/gstr-3b/${clientId}/review/${p.period}`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          width: 120,
                          height: 32,
                          background: '#1d4ed8',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#fff',
                          cursor: 'pointer',
                          transition: 'background .15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        Review
                      </button>
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          width: 120,
                          height: 32,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: '#cbd5e1',
                          cursor: 'default',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        –
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Info Strip */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
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
          All dates are in format: DD/MM/YYYY
        </span>
        <span style={{ color: '#93c5fd', margin: '0 4px' }}>|</span>
        <span>
          Future months are shown for your reference.
        </span>
      </div>

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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
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

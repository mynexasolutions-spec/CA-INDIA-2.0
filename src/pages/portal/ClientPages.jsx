import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import PasswordField from '../../components/PasswordField';
import { LoadingBlock } from '../../components/Spinner';
import { useClientPortal } from '../../components/portal/PortalShell';
import { billingMode } from '../billing/billingProfile';
import { currentFyLabel, currentFyRange, fyDateRange, fyQuarterOptions, money } from '../billing/billingUtils';
import { ComplianceStatus, DashCard, SalesBarChart, shortMoney } from './ClientDashboardWidgets';

const card = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,.08)',
};

const PROFILE_ICON_PROPS = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
function BuildingIcon() {
  return (
    <svg {...PROFILE_ICON_PROPS}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 21v-4h6v4M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg {...PROFILE_ICON_PROPS}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}
function HashIcon() {
  return (
    <svg {...PROFILE_ICON_PROPS}>
      <path d="M5 9h14M5 15h14M10 4l-3 16M17 4l-3 16" />
    </svg>
  );
}
function IdCardIcon() {
  return (
    <svg {...PROFILE_ICON_PROPS}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11.5" r="1.8" />
      <path d="M6 16c.5-1.5 1.7-2 2.5-2s2 .5 2.5 2M14 9h5M14 13h5M14 17h3" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg {...PROFILE_ICON_PROPS}>
      <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg {...PROFILE_ICON_PROPS}>
      <path d="M4 5c0 8.3 6.7 15 15 15l3-4.5-6-2-1.5 2A12.8 12.8 0 0 1 8.5 9.5L10.5 8l-2-6L4 5Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg {...PROFILE_ICON_PROPS}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 6.5 12 13l8-6.5" />
    </svg>
  );
}

const PROFILE_FIELDS = [
  ['business_name', 'Legal Entity / Company Name', BuildingIcon],
  ['client_name', 'Proprietor / Authorized Signatory', PersonIcon],
  ['gstin', 'GSTN', HashIcon],
  ['pan', 'PAN', IdCardIcon],
  ['address', 'Registered Address', PinIcon],
  ['city', 'City', PinIcon],
  ['pincode', 'Pincode', PinIcon],
  ['state_code', 'State Code', PinIcon],
  ['phone', 'Contact Number', PhoneIcon],
  ['email', 'Email', MailIcon],
];

/** GST configuration → dashboard label, per the Client Portal Master Developer Guide. */
function gstConfigLabel(profile) {
  const mode = billingMode(profile);
  if (mode === 'retail') return 'Non-GST';
  if (mode === 'composition') return 'Composition Scheme';
  return profile?.gst_filing_frequency === 'quarterly' ? 'Regular (Quarterly)' : 'Regular (Monthly)';
}

/** "(Monthly)" / "(Quarterly)" suffix for Regular-dealer card titles — the spec's condition
 * is Registration Type = Regular AND Return Frequency, not registration type alone.
 * Retail (no GST returns at all) clients don't carry this label. */
function freqSuffix(profile) {
  if (billingMode(profile) !== 'regular') return '';
  return profile?.gst_filing_frequency === 'quarterly' ? '(Quarterly)' : '(Monthly)';
}

/** e.g. freqTitle('Billing Overview', profile) -> "Billing Overview (Quarterly)", or just
 * "Billing Overview" when the suffix doesn't apply (Composition / Retail clients). */
function freqTitle(base, profile) {
  return `${base} ${freqSuffix(profile)}`.trim();
}

/** GST Reconciliation / GST Summary use CMP-08 terminology for Composition dealers,
 * Monthly/Quarterly for Regular dealers — reflects the actual return type being tracked. */
function returnTitle(base, profile) {
  const mode = billingMode(profile);
  const suffix = mode === 'composition' ? '(CMP-08)' : freqSuffix(profile);
  return `${base} ${suffix}`.trim();
}

/** Sales Overview's chart groups by whatever cadence the numbers are actually bucketed at:
 * Quarterly for Composition (its compliance cycle is quarterly by law) and Regular-Quarterly
 * dealers, Monthly for everyone else. */
function chartFreqTitle(base, profile) {
  const mode = billingMode(profile);
  if (mode === 'composition') return `${base} (Quarterly)`;
  if (mode !== 'regular') return base;
  return `${base} ${profile?.gst_filing_frequency === 'quarterly' ? '(Quarterly)' : '(Monthly)'}`;
}

function StatTile({ label, count, value, color, bg, icon, sub }) {
  const valueLen = String(value).length;
  const valueFontSize = valueLen > 13 ? 14 : valueLen > 10 ? 16 : 18;
  return (
    <div className="bp-stat-tile" style={{ background: bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${color}22`, minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12 }}>
      {icon && (
        <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: valueFontSize, fontWeight: 850, color, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{value}</span>
          {count != null && (
            <span style={{ background: '#fff', color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1px solid ${color}33`, whiteSpace: 'nowrap' }}>
              {count} {count === 1 ? 'Doc' : 'Docs'}
            </span>
          )}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--bp-muted)', fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

function ViewLink({ to, children }) {
  return (
    <Link to={to} style={{ fontSize: 12, fontWeight: 700, color: 'var(--bp-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 'auto', paddingTop: 14 }}>
      {children} <ArrowRightIcon />
    </Link>
  );
}

/* ── Dashboard section icons ──────────────────────────────────── */
const ICON_24 = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'white', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
function ReconciliationIcon() {
  return (
    <svg {...ICON_24}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" /><polyline points="21 3 21 9 15 9" />
    </svg>
  );
}
function GstSummaryIcon() {
  return (
    <svg {...ICON_24}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <path d="M9 17v-3M12 17v-6M15 17v-2" />
    </svg>
  );
}
function BillingOverviewIcon() {
  return (
    <svg {...ICON_24}>
      <rect x="4" y="3" width="14" height="18" rx="2" /><line x1="8" y1="8" x2="14" y2="8" /><line x1="8" y1="12" x2="14" y2="12" /><line x1="8" y1="16" x2="11" y2="16" />
    </svg>
  );
}
function SalesOverviewIcon() {
  return (
    <svg {...ICON_24}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function ComplianceIcon() {
  return (
    <svg {...ICON_24}>
      <path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
function WorkspaceIcon() {
  return (
    <svg {...ICON_24}>
      <rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function WsInvoiceIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function WsSupplyIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function WsDebitIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function WsCreditIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

/* ── Billing Overview tile icons ─────────────────────────────────── */
const TILE_ICON = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'white', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
function TiTotalDocs()     { return <svg {...TILE_ICON}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>; }
function TiTaxInv()        { return <svg {...TILE_ICON}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>; }
function TiBillSupply()    { return <svg {...TILE_ICON}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>; }
function TiDebitNote()     { return <svg {...TILE_ICON}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>; }
function TiCreditNote()    { return <svg {...TILE_ICON}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>; }
function TiCancelled()     { return <svg {...TILE_ICON}><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>; }
function TiQuotation()     { return <svg {...TILE_ICON}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function TiChallan()       { return <svg {...TILE_ICON}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>; }

function dealerBadgeLabel(profile) {
  const mode = billingMode(profile);
  if (mode === 'retail') return 'Dealer – Non-GST';
  if (mode === 'composition') return 'Dealer – Composition';
  return 'Dealer – Regular';
}

export function ClientDashboard() {
  const { user } = useAuth();
  const profile = user?.client_profile;
  const mode = billingMode(profile);
  const hasGst = Boolean(profile?.has_gst);
  const gstComplianceEnabled = profile?.gst_compliance_enabled !== false;
  const isComposition = mode === 'composition';
  // Composition dealers also carry gst_filing_frequency='quarterly' by convention (their CMP-08
  // cycle is quarterly), but the Quarter-selector UI on GST Summary is a Regular-dealer feature
  // per the spec's Quarterly-dashboard table — Composition's GST Summary stays plain From/To.
  const isQuarterly = mode === 'regular' && profile?.gst_filing_frequency === 'quarterly';

  // Financial Year + Refresh Data are global controls, owned by ClientPortalLayout and rendered
  // in the shared topbar (visible on every portal page) — this page reads fy/range from context
  // and registers its own load() below so the global Refresh Data button actually refreshes it.
  const { fy, range, registerRefresh } = useClientPortal();
  const quarterOptions = fyQuarterOptions(fy);

  const [data, setData] = useState(null);
  const [billing, setBilling] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const fyRef = useRef(fy);
  fyRef.current = fy;

  // GST Summary carries its own adjustable period filter, independent of the FY selector above —
  // it resets to the full FY (or, for Quarterly dealers, the quarter containing today) whenever
  // the FY changes, but can be narrowed to any custom range via the From/To inputs.
  const [gstFrom, setGstFrom] = useState(range.from);
  const [gstTo, setGstTo] = useState(range.to);
  const [gstSummary, setGstSummary] = useState(null);
  const [periodSummary, setPeriodSummary] = useState(null); // Billing Overview, scoped to the selected quarter
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const opts = fyQuarterOptions(currentFyLabel());
    return opts.find((q) => today >= q.from && today <= q.to)?.value || 'Q1';
  });

  const [compositionSummary, setCompositionSummary] = useState(null);

  const loadGstSummary = useCallback((from, to) => {
    const qs = new URLSearchParams({ from, to });
    api(`/billing/dashboard?${qs}`).then((d) => {
      setGstSummary(d.gst_dashboard);
      setPeriodSummary(d.summary);
      setCompositionSummary(d.composition_dashboard);
    }).catch(console.error);
  }, []);

  const selectQuarter = useCallback((quarterValue, fyLabel) => {
    setSelectedQuarter(quarterValue);
    const opt = fyQuarterOptions(fyLabel).find((q) => q.value === quarterValue);
    if (opt) {
      setGstFrom(opt.from);
      setGstTo(opt.to);
      loadGstSummary(opt.from, opt.to);
    }
  }, [loadGstSummary]);

  const load = useCallback(() => {
    const r = fyDateRange(fyRef.current) || currentFyRange();
    const qs = new URLSearchParams({ from: r.from, to: r.to });
    return Promise.all([
      api('/client/dashboard').then(setData),
      api(`/billing/dashboard?${qs}`).then(setBilling),
      hasGst && gstComplianceEnabled
        ? api(`/client/gst-compliance?financial_year=${fyRef.current}`).then(setCompliance)
        : Promise.resolve(setCompliance(null)),
    ]).catch(console.error);
  }, [hasGst, gstComplianceEnabled]);

  useEffect(() => {
    load();
    const refreshInterval = window.setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  // Let the shared topbar's "Refresh Data" button actually refresh this page while it's mounted.
  useEffect(() => registerRefresh(load), [registerRefresh, load]);

  useEffect(() => {
    if (isQuarterly) {
      // FY changed — re-pick the quarter containing today if this is the current FY, else Q1.
      const today = new Date().toISOString().slice(0, 10);
      const opts = fyQuarterOptions(fy);
      const next = opts.find((q) => today >= q.from && today <= q.to)?.value || 'Q1';
      selectQuarter(next, fy);
    } else {
      // FY changed — snap the GST Summary filter back to the full FY and reload it.
      setGstFrom(range.from);
      setGstTo(range.to);
      loadGstSummary(range.from, range.to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy]);

  if (!data || !billing) return <LoadingBlock label="Loading dashboard…" size={26} minHeight={300} />;

  const gst = billing.gst_dashboard;
  const matchTotal = (gst?.matched_invoices || 0) + (gst?.unmatched_invoices || 0);
  const matchRate = matchTotal ? ((gst.matched_invoices / matchTotal) * 100).toFixed(2) : '0.00';
  const s = billing.summary || {};
  const gstSummaryData = gstSummary || gst;
  // Quarterly dealers' Billing Overview reflects the selected quarter, not the whole FY.
  const billingOverviewData = isQuarterly ? (periodSummary || s) : s;

  const composition = billing.composition_dashboard;
  const compositionData = compositionSummary || composition;
  const compMatchTotal = (composition?.matched_invoices || 0) + (composition?.unmatched_invoices || 0);
  const compMatchRate = compMatchTotal ? ((composition.matched_invoices / compMatchTotal) * 100).toFixed(2) : '0.00';

  const d = billingOverviewData;
  const totalDocs = (d.tax_invoices ?? 0) + (d.bill_of_supply ?? 0) + (d.debit_notes ?? 0) + (d.credit_notes ?? 0) + (d.cancelled_invoices ?? 0) + (d.quotations ?? 0) + (d.delivery_challans ?? 0);

  const GstSummaryCard = ({ summaryData }) => (
    <DashCard title={returnTitle('GST Summary', profile)} icon={<GstSummaryIcon />} iconColor="#0f766e">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {isQuarterly && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--bp-text)' }}>
            Quarter
            <select className="bp-select" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700 }} value={selectedQuarter} onChange={(e) => selectQuarter(e.target.value, fy)}>
              {quarterOptions.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
          </label>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--bp-text)' }}>
          From <input type="date" className="bp-input" style={{ padding: '4px 8px', fontSize: 11, maxWidth: 130 }} value={gstFrom} onChange={(e) => setGstFrom(e.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--bp-text)' }}>
          To <input type="date" className="bp-input" style={{ padding: '4px 8px', fontSize: 11, maxWidth: 130 }} value={gstTo} onChange={(e) => setGstTo(e.target.value)} />
        </label>
        <button type="button" className="bp-btn bp-btn-primary" style={{ padding: '5px 14px', fontSize: 11 }} onClick={() => loadGstSummary(gstFrom, gstTo)}>Apply</button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--bp-muted)', fontWeight: 600, marginBottom: 16 }}>Period: {gstFrom?.split('-').reverse().join('/')} – {gstTo?.split('-').reverse().join('/')}</div>
      {isComposition ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <StatTile label="Turnover" value={money(compositionData?.turnover)} color="#2563eb" bg="rgba(37,99,235,0.08)" />
          <StatTile label="Tax Payable" value={money(compositionData?.tax_payable)} color="#be123c" bg="rgba(190,18,60,0.08)" />
          <StatTile label="Tax Paid" value={money(compositionData?.tax_paid)} color="#15803d" bg="rgba(21,128,61,0.08)" />
          <StatTile label="ITC Available" value={money(compositionData?.itc_available)} color="#6b8499" bg="rgba(107,132,153,0.08)" />
        </div>
      ) : (
        <div className="bp-stat-grid-2" style={{ gap: 12 }}>
          <StatTile label="Output GST" value={money(summaryData?.output_gst)} color="#2563eb" bg="rgba(37,99,235,0.08)" />
          <StatTile label="Input GST (ITC)" value={money(summaryData?.eligible_itc)} color="#0f766e" bg="rgba(15,118,110,0.08)" />
          <StatTile label="GST Payable" value={money(summaryData?.gst_payable)} color="#be123c" bg="rgba(190,18,60,0.08)" />
          <StatTile label="Excess ITC Available" value={money(summaryData?.excess_itc)} color="#15803d" bg="rgba(21,128,61,0.08)" />
        </div>
      )}
    </DashCard>
  );

  const GstReconCard = () => (
    <DashCard title={returnTitle('GST Reconciliation', profile)} icon={<ReconciliationIcon />} iconColor="#2563eb">
      <div className="bp-stat-grid-2" style={{ gap: 12 }}>
        {isComposition ? <>
          <StatTile label="CMP-08 Filed" value={composition?.total_gstr2b_invoices} color="#2563eb" bg="rgba(37,99,235,0.08)" />
          <StatTile label="CMP-08 Matched" value={composition?.matched_invoices} color="#15803d" bg="rgba(21,128,61,0.08)" />
          <StatTile label="CMP-08 Unmatched" value={composition?.unmatched_invoices} color="#c2410c" bg="rgba(194,65,12,0.08)" />
          <StatTile label="Match Rate" value={`${compMatchRate}%`} color="#3730a3" bg="rgba(55,48,163,0.08)" />
        </> : <>
          <StatTile label="GSTR-2B Invoices" value={gst.total_gstr2b_invoices} color="#2563eb" bg="rgba(37,99,235,0.08)" />
          <StatTile label="Matched" value={gst.matched_invoices} color="#15803d" bg="rgba(21,128,61,0.08)" />
          <StatTile label="Unmatched" value={gst.unmatched_invoices} color="#c2410c" bg="rgba(194,65,12,0.08)" />
          <StatTile label="Match Rate" value={`${matchRate}%`} color="#3730a3" bg="rgba(55,48,163,0.08)" />
        </>}
      </div>
      <ViewLink to="/portal/gstr-2b">View Reconciliation Details</ViewLink>
    </DashCard>
  );

  const hasGstCards = (mode === 'regular' && gst) || (isComposition && composition);
  const ROW = { display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', marginBottom: 20, alignItems: 'stretch' };

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* Welcome banner */}
      <div style={{ background: 'linear-gradient(135deg, var(--bp-navy) 0%, #1a365d 100%)', borderRadius: 16, padding: '24px 32px', color: '#fff', marginBottom: 24, boxShadow: '0 8px 24px rgba(13, 31, 60, 0.12)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-5%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />
        <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: -18, right: 6, opacity: 0.08, pointerEvents: 'none' }}>
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <h1 style={{ marginTop: 0, fontSize: 24, color: '#fff', fontWeight: 800, marginBottom: 4, position: 'relative', zIndex: 1 }}>
          Welcome back, {data.profile?.business_name}{' '}
          <span style={{ color: '#90cdf4', fontWeight: 700 }}>[{dealerBadgeLabel(profile)}]</span>
        </h1>
        <p style={{ color: '#cbd5e1', fontSize: 13, marginTop: 8, maxWidth: 650, lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
          Your dashboard provides a clear overview of key business insights, GST compliance, invoices and financial activity for the current Financial Year {fy}.
        </p>
      </div>

      {/* ROW 1: Sales Overview | GST Summary */}
      <div style={ROW}>
        <DashCard title={chartFreqTitle('Sales Overview', profile)} icon={<SalesOverviewIcon />} iconColor="#7c3aed"
          badge={<span style={{ fontSize: 11, color: 'var(--bp-muted)', fontWeight: 600 }}>({fy === currentFyLabel() ? 'Current FY' : fy})</span>}>
          <SalesBarChart data={billing.monthly_trend} />
          <ViewLink to="/portal/reports/gst-summary">View Detailed Report</ViewLink>
        </DashCard>
        {hasGstCards && <GstSummaryCard summaryData={isComposition ? compositionData : gstSummaryData} />}
      </div>

      {/* ROW 2: GST Reconciliation | Billing Workspace */}
      <div style={ROW}>
        {hasGstCards && <GstReconCard />}
        <DashCard title="Billing Workspace" icon={<WorkspaceIcon />} iconColor="#0a3d82">
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: 'var(--bp-muted)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              Create, manage and track your billing documents.
            </p>
            <div style={{ flex: 1, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gridAutoRows: '1fr' }}>
              {[
                { to: '/portal/billing/invoices/new', label: 'Tax Invoice', desc: 'Create & manage tax invoices', color: '#2563eb', Icon: WsInvoiceIcon, show: mode !== 'composition' },
                { to: '/portal/billing/bill-of-supply/new', label: 'Bill of Supply', desc: 'Create & manage bills of supply', color: '#0f766e', Icon: WsSupplyIcon, show: mode !== 'retail' },
                { to: '/portal/billing/debit-notes/new', label: 'Debit Note', desc: 'Create debit notes', color: '#d97706', Icon: WsDebitIcon, show: mode === 'regular' },
                { to: '/portal/billing/credit-notes/new', label: 'Credit Note', desc: 'Create & manage credit notes', color: '#059669', Icon: WsCreditIcon, show: mode !== 'retail' },
              ].filter((a) => a.show).map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="bp-workspace-link"
                  style={{
                    textDecoration: 'none',
                    border: `1px solid ${a.color}22`,
                    borderLeft: `5px solid ${a.color}`,
                    borderRadius: 14,
                    padding: '16px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: `linear-gradient(135deg, ${a.color}08 0%, #ffffff 100%)`,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.01)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 10px 24px ${a.color}28`;
                    e.currentTarget.style.background = `linear-gradient(135deg, ${a.color}15 0%, #ffffff 100%)`;
                    e.currentTarget.style.borderColor = `${a.color}55`;
                    const chevron = e.currentTarget.querySelector('.chevron-icon');
                    if (chevron) chevron.style.transform = 'translateX(4px) scale(1.1)';
                    const iconBox = e.currentTarget.querySelector('.icon-box');
                    if (iconBox) {
                      iconBox.style.transform = 'rotate(-8deg) scale(1.1)';
                      iconBox.style.background = `${a.color}22`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.01)';
                    e.currentTarget.style.background = `linear-gradient(135deg, ${a.color}08 0%, #ffffff 100%)`;
                    e.currentTarget.style.borderColor = `${a.color}22`;
                    const chevron = e.currentTarget.querySelector('.chevron-icon');
                    if (chevron) chevron.style.transform = 'none';
                    const iconBox = e.currentTarget.querySelector('.icon-box');
                    if (iconBox) {
                      iconBox.style.transform = 'none';
                      iconBox.style.background = `${a.color}12`;
                    }
                  }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <span
                      className="icon-box"
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: `${a.color}12`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <a.Icon color={a.color} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: a.color }}>
                        {a.label}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--bp-muted)', marginTop: 3, lineHeight: 1.4 }}>{a.desc}</div>
                    </div>
                  </div>
                  <svg
                    className="chevron-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={a.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition: 'transform 0.2s ease', marginLeft: 8, flexShrink: 0 }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ))}
            </div>
            <Link
              to="/portal/billing"
              className="bp-btn bp-btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 24px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                width: 'fit-content',
                alignSelf: 'flex-start',
                boxSizing: 'border-box',
                background: 'linear-gradient(135deg, var(--bp-navy) 0%, #1e5aab 100%)',
                boxShadow: '0 4px 15px rgba(10, 61, 130, 0.25)',
                border: 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                textDecoration: 'none',
                color: '#ffffff'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(10, 61, 130, 0.35)';
                e.currentTarget.style.filter = 'brightness(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(10, 61, 130, 0.25)';
                e.currentTarget.style.filter = 'none';
              }}
            >
              Open Billing Workspace
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </DashCard>
      </div>

      {/* ROW 3: Compliance Status | Billing Overview */}
      <div style={ROW}>
        {hasGst && (
          <DashCard title="Compliance Status" icon={<ComplianceIcon />} iconColor="#ea580c">
            <ComplianceStatus compliance={compliance} financialYear={fy} locked={!gstComplianceEnabled} />
            <ViewLink to="/portal/gst-returns">View Full Compliance Report</ViewLink>
          </DashCard>
        )}

        <DashCard
          title={freqTitle('Billing Overview', profile)}
          icon={<BillingOverviewIcon />}
          iconColor="#16a34a"
          badge={isQuarterly ? <span style={{ fontSize: 11, color: 'var(--bp-muted)', fontWeight: 600 }}>({quarterOptions.find((q) => q.value === selectedQuarter)?.label || selectedQuarter})</span> : null}
        >
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <StatTile label="Total Documents" value={totalDocs} sub="Documents" color="#4f46e5" bg="rgba(79,70,229,0.08)" icon={<TiTotalDocs />} />
            <StatTile label="Tax Invoices" count={d.tax_invoices ?? 0} value={shortMoney(d.tax_invoices_value)} color="#2563eb" bg="rgba(37,99,235,0.08)" icon={<TiTaxInv />} />
            <StatTile label="Bill of Supply" count={d.bill_of_supply ?? 0} value={shortMoney(d.bill_of_supply_value)} color="#0f766e" bg="rgba(15,118,110,0.08)" icon={<TiBillSupply />} />
            <StatTile label="Debit Notes" count={d.debit_notes ?? 0} value={shortMoney(d.debit_notes_value)} color="#d97706" bg="rgba(217,119,6,0.08)" icon={<TiDebitNote />} />
            <StatTile label="Credit Notes" count={d.credit_notes ?? 0} value={shortMoney(d.credit_notes_value)} color="#dc2626" bg="rgba(220,38,38,0.08)" icon={<TiCreditNote />} />
            <StatTile label="Cancelled Invoices" count={d.cancelled_invoices ?? 0} value="—" color="#94a3b8" bg="rgba(148,163,184,0.08)" icon={<TiCancelled />} />
            <StatTile label="Quotations" count={d.quotations ?? 0} value={shortMoney(d.quotations_value)} color="#ea580c" bg="rgba(234,88,12,0.08)" icon={<TiQuotation />} />
            <StatTile label="Delivery Challan" count={d.delivery_challans ?? 0} value={shortMoney(d.delivery_challans_value)} color="#0d9488" bg="rgba(13,148,136,0.08)" icon={<TiChallan />} />
          </div>
          <ViewLink to="/portal/billing">View All Documents</ViewLink>
        </DashCard>
      </div>
    </div>
  );
}

export function ClientProfile() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api('/client/profile').then((d) => {
      const u = d.user;
      const p = u.client_profile || {};
      setProfile({
        business_name: p.business_name || '',
        client_name: p.client_name || u.name || '',
        gstin: p.gstin || '—',
        pan: p.pan || '—',
        address: p.address || '',
        city: p.city || '',
        pincode: p.pincode || '',
        state_code: [p.state_code, p.state].filter(Boolean).join(' - ') || '',
        phone: u.phone || p.mobile || '—',
        email: p.email || u.email || '—',
      });
    });
  }, []);

  if (!profile) return <LoadingBlock />;
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--bp-muted)', marginBottom: 12, fontWeight: 600 }}>
        <Link to="/portal" style={{ color: 'var(--bp-blue)', textDecoration: 'none' }}>Client Portal</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        Profile
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <span style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="1" />
            <path d="M9 21v-4h6v4M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01" />
          </svg>
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--bp-navy)' }}>Business Profile</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
            View your registered business information.
          </p>
        </div>
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%',
        background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
        borderRadius: 14, padding: '8px 16px 8px 10px', marginBottom: 20,
        fontSize: 13, fontWeight: 600, boxShadow: '0 1px 3px rgba(37,99,235,0.08)',
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', background: '#2563eb', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="16" x2="12" y2="11" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </span>
        <span>This information is view-only and cannot be edited.</span>
      </div>

      <div className="bp-dash-card" style={{ ...card, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(37,99,235,0.35)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 21v-4h6v4M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01" />
            </svg>
          </span>
          Business Information
        </h2>
        <div className="bp-profile-grid" style={{ display: 'grid', gap: '18px 28px', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {PROFILE_FIELDS.map(([key, label, Icon]) => {
            const val = profile[key] || '—';
            const valFontSize = val.length > 28 ? 12.5 : val.length > 20 ? 13 : 14;
            return (
              <div key={key} className="bp-stat-tile" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.1)', borderRadius: 12, padding: '12px 14px', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: '#fff', color: '#2563eb', border: '1px solid rgba(37,99,235,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--bp-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: valFontSize, fontWeight: 700, color: 'var(--bp-text)', wordBreak: 'break-word' }}>{val}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LockIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function ShieldIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" />
    </svg>
  );
}

const PASSWORD_TIPS = [
  'Use at least 8 characters.',
  'Include uppercase (A-Z) and lowercase (a-z).',
  'Include at least one number (0-9).',
  'Include at least one special character (! @ # $ % etc.).',
  'Avoid using easily guessable information.',
];

export function ClientResetPassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    setPwdBusy(true);
    setPwdErr('');
    setSuccess(false);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: {
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: newPasswordConfirm,
        },
      });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (ex) {
      setPwdErr(ex.message || 'Password update failed');
    } finally {
      setPwdBusy(false);
    }
  };

  const canSubmit = currentPassword && newPassword.length >= 8 && newPasswordConfirm.length >= 8;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 12, color: 'var(--bp-muted)', marginBottom: 12, fontWeight: 600 }}>
        <Link to="/portal" style={{ color: 'var(--bp-blue)', textDecoration: 'none' }}>Client Portal</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        Change Password
      </div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: 'var(--bp-navy)' }}>Change Password</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bp-muted)' }}>
          Update your account password to keep your account secure.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(280px, 1.3fr) minmax(220px, 1fr)', alignItems: 'start' }}>
        <div style={card}>
          <h2 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <LockIcon /> Change Your Password
          </h2>
          <form onSubmit={changePassword} style={{ display: 'grid', gap: 16 }}>
            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your current password"
              icon={<LockIcon size={15} />}
            />
            <div>
              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Enter your new password"
                icon={<LockIcon size={15} />}
              />
              <span style={{ display: 'block', fontSize: 11, color: 'var(--bp-muted)', marginTop: 6, lineHeight: 1.5 }}>
                Password must be at least 8 characters long with uppercase, lowercase, number and special character.
              </span>
            </div>
            <PasswordField
              label="Confirm New Password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              icon={<LockIcon size={15} />}
            />

            {pwdErr && <p className="bp-alert bp-alert-error" style={{ margin: 0 }}>{pwdErr}</p>}

            <button
              type="submit"
              className="bp-btn bp-btn-primary"
              disabled={pwdBusy || !canSubmit}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {pwdBusy ? 'Updating…' : (<><LockIcon size={14} /> Change Password</>)}
            </button>
          </form>
        </div>

        <div style={{ ...card, background: '#eef4fc', border: '1px solid #d7e6f7' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: 'var(--bp-navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldIcon /> Password Security Tips
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {PASSWORD_TIPS.map((tip) => (
              <li key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--bp-text)', lineHeight: 1.4 }}>
                <span style={{ color: '#15803d', flexShrink: 0, fontWeight: 800 }}>✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {success && (
        <div style={{ marginTop: 20, background: '#eafaf0', border: '1px solid #bfe6d1', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
          <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, fontWeight: 800 }}>✓</span>
          <div>
            <div style={{ fontWeight: 800, color: '#15803d', fontSize: 14 }}>Password Changed Successfully!</div>
            <div style={{ fontSize: 12.5, color: 'var(--bp-muted)', marginTop: 2 }}>
              Your password has been updated successfully. You can now login with your new password.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(false)}
            aria-label="Dismiss"
            style={{ position: 'absolute', top: 12, right: 16, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--bp-muted)', fontSize: 16 }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export function ClientDocuments() {
  return null;
}

export function ClientCompliance() {
  return null;
}

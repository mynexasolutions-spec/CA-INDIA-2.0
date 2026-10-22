export const GST_RATES = [0, 1, 5, 6, 12, 18, 28, 40];

/** Delivery Challan spec — Reason for Transportation dropdown options. */
export const REASON_FOR_TRANSPORT_OPTIONS = [
  { value: 'job_work', label: 'Job Work' },
  { value: 'repair', label: 'Repair' },
  { value: 'returnable_goods', label: 'Returnable Goods' },
  { value: 'branch_transfer', label: 'Branch Transfer' },
  { value: 'other', label: 'Other - Specify' },
];

export function reasonForTransportLabel(value) {
  return REASON_FOR_TRANSPORT_OPTIONS.find((o) => o.value === value)?.label || value || '—';
}

export function normalizeGstRate(rate) {
  const n = Number(rate);
  return GST_RATES.includes(n) ? n : 18;
}

export function documentDateLabel(docType) {
  if (docType === 'tax_invoice') return 'Tax Invoice Date';
  if (docType === 'debit_note') return 'Debit Note Date';
  if (docType === 'credit_note') return 'Credit Note Date';
  if (docType === 'bill_of_supply') return 'Bill of Supply Date';
  if (docType === 'quotation') return 'Quotation Date';
  if (docType === 'delivery_challan') return 'Delivery Challan Date';
  if (docType === 'amendment') return 'Amendment Date';
  return 'Document Date';
}

/** Inclusive YYYY-MM-DD date range check. */
export function isDateInRange(dateStr, from = '', to = '') {
  const d = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  if (from && d < String(from).slice(0, 10)) return false;
  if (to && d > String(to).slice(0, 10)) return false;
  return true;
}

/** Filter documents by From / To date (and optional FY bounds already reflected in from/to).
 * Listing/filtering/GST-period counting spec — driven by Date of Creation (created_at),
 * not the document's back-dated Document Date. */
export function filterDocsByPeriod(docs, { from = '', to = '' } = {}) {
  if (!Array.isArray(docs)) return [];
  if (!from && !to) return docs;
  return docs.filter((doc) => isDateInRange(doc.created_at, from, to));
}

/** Today's date as YYYY-MM-DD in the user's LOCAL timezone (toISOString() is UTC and shows yesterday in IST before 5:30 am). */
export function localISODate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// "Number of Decimal Places" is configured per document type (Admin → Clients → Configuration, 2–6).
// A screen showing one document (Create / View) sets it for that document type via
// setMoneyDecimals(); lists and reports that mix document types stay at 2.
let moneyDecimals = 2;

/** Decimal places the client's profile configures for a document type (2 when unset). */
export function decimalsForDoc(profile, docType) {
  const row = (profile?.document_settings || []).find((s) => s.document_type === docType);
  const v = Number(row?.decimal_places);
  return Number.isInteger(v) && v >= 2 && v <= 6 ? v : 2;
}

export function setMoneyDecimals(n) {
  const v = Number(n);
  moneyDecimals = Number.isInteger(v) && v >= 2 && v <= 6 ? v : 2;
}

export function getMoneyDecimals() {
  return moneyDecimals;
}

/** Always the configured decimals (HSN/SAC and GST figures must show the exact paise, e.g. 35,520.20). */
export function moneyFixed(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: moneyDecimals, maximumFractionDigits: moneyDecimals })}`;
}

export function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: moneyDecimals })}`;
}

export const CURRENCIES = [
  { code: 'INR', label: 'INR - Indian Rupee' },
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
  { code: 'AED', label: 'AED - UAE Dirham' },
];

/** Billing date standard — DD/MM/YYYY, e.g. 15/08/2026. Accepts 'YYYY-MM-DD...' or Date. */
export function formatDMY(value) {
  if (!value) return '—';
  const s = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** DD/MM/YYYY, hh:mm AM/PM (12-hour, uppercase meridiem) — for "Created" timestamp columns. */
export function formatDMYTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const h = d.getHours();
  const time = `${String(h % 12 || 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  return `${formatDMY(d)}, ${time}`;
}

/** Billing Module lower bound — the module starts at FY 2026-27; no earlier FY may ever
 * be shown or selected in any Billing dashboard/selector/filter. */
export const MIN_BILLING_FY_START_YEAR = 2026;

/** Indian FY labels e.g. 2026-27 (Apr–Mar), never earlier than MIN_BILLING_FY_START_YEAR. */
export function buildFyOptions(count = 6) {
  const now = new Date();
  const rawStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const startYear = Math.max(rawStartYear, MIN_BILLING_FY_START_YEAR);
  const span = Math.min(count, startYear - MIN_BILLING_FY_START_YEAR + 1);
  const options = [];
  for (let i = 0; i < span; i += 1) {
    const y1 = startYear - i;
    options.push(`${y1}-${String(y1 + 1).slice(-2)}`);
  }
  return options;
}

/** Current Indian FY start year (April–March), clamped to MIN_BILLING_FY_START_YEAR. */
export function currentFyStartYear(date = new Date()) {
  const y1 = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return Math.max(y1, MIN_BILLING_FY_START_YEAR);
}

/** e.g. 2025-26 */
export function currentFyLabel(date = new Date()) {
  const y1 = currentFyStartYear(date);
  return `${y1}-${String(y1 + 1).slice(-2)}`;
}

/** Current FY date range (1 Apr → 31 Mar). */
export function currentFyRange(date = new Date()) {
  const y1 = currentFyStartYear(date);
  return {
    from: `${y1}-04-01`,
    to: `${y1 + 1}-03-31`,
    fy: currentFyLabel(date),
  };
}

export function fyDateRange(fy) {
  const [y1] = String(fy).split('-');
  const year = parseInt(y1, 10);
  if (!year) return null;
  return {
    from: `${year}-04-01`,
    to: `${year + 1}-03-31`,
  };
}

/** The four Indian GST quarters (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar) for a given FY label
 * (e.g. "2026-27"), each with its own date range — computed from the FY, never hardcoded. */
export function fyQuarterOptions(fy) {
  const [y1] = String(fy).split('-');
  const year = parseInt(y1, 10);
  if (!year) return [];
  const defs = [
    { q: 1, label: 'Q1 (Apr - Jun)', from: `${year}-04-01`, to: `${year}-06-30` },
    { q: 2, label: 'Q2 (Jul - Sep)', from: `${year}-07-01`, to: `${year}-09-30` },
    { q: 3, label: 'Q3 (Oct - Dec)', from: `${year}-10-01`, to: `${year}-12-31` },
    { q: 4, label: 'Q4 (Jan - Mar)', from: `${year + 1}-01-01`, to: `${year + 1}-03-31` },
  ];
  return defs.map((d) => ({ ...d, value: `Q${d.q}` }));
}

/** Same four quarters as fyQuarterOptions(), but with the FY's start year folded into
 * `value` (e.g. "2026-Q1") — the actual tax_period shape stored/filtered on everywhere
 * a quarterly-cadence return (GSTR-1 QRMP, GSTR-2B, GSTR-3B, CMP-08) is tracked. */
export function fyQuarterPeriodOptions(fy) {
  const [y1] = String(fy).split('-');
  return fyQuarterOptions(fy).map((q) => ({ ...q, value: `${y1}-${q.value}` }));
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM' -> 'Month YYYY'. */
export function monthLabel(period) {
  const [y, m] = String(period).split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Formats either shape a tax_period can take: 'YYYY-MM' (a monthly-cadence return) or
 * 'YYYY-Qn' (a quarterly-cadence one) -> a human label. Lets a table that mixes clients
 * on different filing frequencies render whichever shape a given row actually has. */
export function periodLabel(period) {
  // Bare "YYYY" — GSTR-4's Annual period (the FY start year itself).
  if (/^\d{4}$/.test(String(period || ''))) {
    const y1 = parseInt(period, 10);
    return `FY ${y1}-${String(y1 + 1).slice(-2)}`;
  }
  const [year, rest] = String(period || '').split('-');
  if (!year || !rest) return period || '—';
  if (/^Q[1-4]$/.test(rest)) {
    const fyLabel = `${year}-${String(parseInt(year, 10) + 1).slice(-2)}`;
    const q = fyQuarterOptions(fyLabel).find((o) => o.value === rest);
    return q ? `${q.label} FY${fyLabel}` : `${rest} ${year}`;
  }
  return monthLabel(period);
}

/** The 12 calendar months of an Indian FY (Apr y1 -> Mar y1+1) as { value: 'YYYY-MM', label }. */
export function fyMonthOptions(fy) {
  const [y1] = String(fy).split('-');
  const year = parseInt(y1, 10);
  if (!year) return [];
  const options = [];
  for (let m = 4; m <= 15; m += 1) {
    const month = m > 12 ? m - 12 : m;
    const y = m > 12 ? year + 1 : year;
    const value = `${y}-${String(month).padStart(2, '0')}`;
    options.push({ value, label: monthLabel(value) });
  }
  return options;
}

export function monthDateRange(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

export function billingDocPath(type, id) {
  const base = {
    tax_invoice: '/portal/billing/invoices',
    debit_note: '/portal/billing/debit-notes',
    credit_note: '/portal/billing/credit-notes',
    bill_of_supply: '/portal/billing/bill-of-supply',
    quotation: '/portal/billing/quotation',
    delivery_challan: '/portal/billing/delivery-challan',
    amendment: '/portal/amendments',
  }[type] || '/portal/billing/invoices';
  return `${base}/${id}`;
}

export function billingDocEditPath(type, id) {
  const base = {
    tax_invoice: '/portal/billing/invoices',
    bill_of_supply: '/portal/billing/bill-of-supply',
    quotation: '/portal/billing/quotation',
    debit_note: '/portal/billing/debit-notes',
    credit_note: '/portal/billing/credit-notes',
    delivery_challan: '/portal/billing/delivery-challan',
    amendment: '/portal/amendments',
  }[type];
  return base ? `${base}/${id}/edit` : null;
}

export function createButtonLabel(type, profile = null) {
  if (profile && !profile.has_gst && type === 'tax_invoice') {
    return '+ Create Invoice';
  }
  return {
    quotation: '+ Create Quotation',
    tax_invoice: '+ Create Tax Invoice',
    bill_of_supply: '+ Create Bill of Supply',
    debit_note: '+ Create Debit Note',
    credit_note: '+ Create Credit Note',
    delivery_challan: '+ Create Delivery Challan',
    amendment: '+ Create Amendment',
  }[type] || '+ Create';
}

export function docTypeLabel(type) {
  const key = String(type || '').toLowerCase();
  return {
    tax_invoice: 'Tax Invoice',
    bill_of_supply: 'Bill of Supply',
    debit_note: 'Debit Note',
    credit_note: 'Credit Note',
    quotation: 'Quotation',
    delivery_challan: 'Delivery Challan',
    amendment: 'Amendment',
    invoice: 'Invoice',
  }[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function paymentStatusLabel(status) {
  if (status === 'paid') return 'Paid';
  if (status === 'partial') return 'Partial';
  if (status === 'draft') return 'Draft';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'issued' || status === 'unpaid') return 'Unpaid';
  return status || '—';
}

export function paymentStatusBadge(status) {
  if (status === 'paid') return 'bp-badge-paid';
  if (status === 'partial') return 'bp-badge-partial';
  if (status === 'draft') return 'bp-badge-draft';
  if (status === 'cancelled') return 'bp-badge-cancelled';
  if (status === 'issued' || status === 'unpaid') return 'bp-badge-unpaid';
  return `bp-badge-${status || 'draft'}`;
}

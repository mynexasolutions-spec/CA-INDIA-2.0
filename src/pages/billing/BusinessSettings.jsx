import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import { currentFyLabel } from './billingUtils';

const ASSETS = [
  { field: 'logo',      pathKey: 'logo_path',       label: 'Business Logo',       recSize: '300 × 300 px' },
  { field: 'signature', pathKey: 'signature_path',   label: 'Authorized Signature', recSize: '300 × 100 px' },
  { field: 'seal',      pathKey: 'seal_path',        label: 'Company Seal',         recSize: '300 × 300 px' },
];

// Paired so a natural 2-col grid lands exactly like the approved layout — Account Number ends
// up alone on the last row since this list has an odd length.
const ACCOUNT_TYPES = ['Current', 'Savings', 'Cash Credit', 'Overdraft', 'Other (Specify)'];

const PREFIX_FIELDS = [
  ['invoice_prefix',        'Tax Invoice Prefix',       'INV'],
  ['bill_of_supply_prefix', 'Bill of Supply Prefix',    'BOS'],
  ['credit_note_prefix',    'Credit Note Prefix',       'CN'],
  ['debit_note_prefix',     'Debit Note Prefix',        'DN'],
  ['quotation_prefix',      'Quotation Prefix',         'QT'],
  ['delivery_challan_prefix','Delivery Challan Prefix', 'DC'],
];

/** Which Settings tab each editable field belongs to — mirrors the backend's
 * ClientChangeRequest::FIELD_SECTIONS. The backend re-enforces this itself; this copy is only
 * for building each tab's own submit payload, not a security boundary. */
const BANK_KEYS = ['bank_ifsc', 'bank_name', 'bank_branch', 'account_holder_name', 'bank_account', 'account_type', 'upi_id'];

const FIELD_SECTION = {
  bank_name: 'bank', bank_branch: 'bank', account_holder_name: 'bank', bank_account: 'bank',
  bank_ifsc: 'bank', swift_code: 'bank', account_type: 'bank', upi_id: 'bank',
  signatory_name: 'invoice_settings', terms_conditions: 'invoice_settings',
  invoice_prefix: 'numbering', bill_of_supply_prefix: 'numbering', credit_note_prefix: 'numbering',
  debit_note_prefix: 'numbering', quotation_prefix: 'numbering', delivery_challan_prefix: 'numbering',
};

const SECTION_FIELDS = {
  bank: BANK_KEYS,
  invoice_settings: ['signatory_name', 'terms_conditions'],
  branding_text: ['signatory_name', 'terms_conditions'],
  numbering: PREFIX_FIELDS.map(([k]) => k),
};

const SECTION_LABELS = {
  branding: 'Invoice Branding',
  bank: 'Bank Details',
  invoice_settings: 'Invoice Settings',
  numbering: 'Document Numbering & Prefix',
};


function fyPrefixDefaultsFull() {
  const fy = currentFyLabel();
  return {
    invoice_prefix: `INV/${fy}/`,
    bill_of_supply_prefix: `BOS/${fy}/`,
    credit_note_prefix: `CN/${fy}/`,
    debit_note_prefix: `DN/${fy}/`,
    quotation_prefix: `QT/${fy}/`,
    delivery_challan_prefix: `DC/${fy}/`,
  };
}

function emptyForm() {
  return {
    bank_ifsc: '', bank_name: '', bank_branch: '',
    account_holder_name: '', bank_account: '', account_type: '', upi_id: '',
    signatory_name: '', terms_conditions: '',
    ...fyPrefixDefaultsFull(),
    logo_path: '', signature_path: '', seal_path: '',
  };
}

/** Merge the live approved values with whatever each section's own pending request (if any)
 * proposes — a pending request in one tab never affects another tab's draft. */
function mergeDraft(approved, sections) {
  const base = emptyForm();
  const text = approved?.text || {};
  Object.keys(base).forEach((k) => {
    if (k.endsWith('_path')) {
      base[k] = sections?.branding?.pending?.[k] || approved?.[k] || '';
    } else {
      const section = FIELD_SECTION[k];
      const pendingPayload = sections?.[section]?.pending?.payload;
      base[k] = pendingPayload && Object.prototype.hasOwnProperty.call(pendingPayload, k) ? pendingPayload[k] : (text[k] ?? '');
    }
  });
  return base;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${min} ${ampm}`;
}

const ICON_PROPS = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
function ImageIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 15l-5-5-9 9" />
    </svg>
  );
}
function BankIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v9M9 10v9M15 10v9M19 10v9" />
      <path d="M3 21h18" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}
function HashIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 9h14M5 15h14M10 4l-3 16M17 4l-3 16" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
    </svg>
  );
}

/* ── Layout / Color constants ───────────────────────────────────── */
const LAYOUTS = [
  { id: 1, name: 'Layout 1', recommended: true,  desc: 'Clean and professional layout with a top header and structured table format. Suitable for most businesses.' },
  { id: 2, name: 'Layout 2', recommended: false, desc: 'Modern layout with a side accent and highlighted sections. Ideal for modern and elegant look.' },
  { id: 3, name: 'Layout 3', recommended: false, desc: 'Minimal and clean layout with a classic design. Best for simple and professional invoices.' },
  { id: 4, name: 'Layout 4', recommended: false, desc: 'Elegant and professional layout with a clean header and modern styling. Suitable for business invoices with better readability.' },
];

const COLORS = [
  { id: 'slate_blue',    label: 'Slate Blue',    hex: '#2563eb' },
  { id: 'charcoal_grey', label: 'Charcoal Grey', hex: '#374151' },
  { id: 'dusty_plum',    label: 'Dusty Plum',    hex: '#7c3aed' },
  { id: 'mocha_brown',   label: 'Mocha Brown',   hex: '#92400e' },
  { id: 'deep_teal',     label: 'Deep Teal',     hex: '#0d9488' },
  { id: 'antique_gold',  label: 'Antique Gold',  hex: '#d97706' },
];

/* ── Shared invoice sub-components (rendered at 680px, then scaled) ── */
function InvTable({ c, rows }) {
  const thS = { background: c, color: '#fff', fontSize: 9, padding: '5px 4px', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' };
  const tdS = { fontSize: 8, padding: '4px 4px', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          {[['SN',28],['PARTICULARS',null],['HSN',46],['UOM',36],['QTY',36],['RATE',50],['DISC%',40],['TAXABLE VALUE',70],['CGST%',40],['AMT',50],['SGST%',40],['AMT',50],['TOTAL',60]].map(([h,w],i) => (
            <th key={i} style={{ ...thS, width: w || undefined }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
            {r.map((v, j) => <td key={j} style={tdS}>{v}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InvBankTax({ c }) {
  const lbl = { fontSize: 8, color: '#64748b', marginBottom: 2 };
  const val = { fontSize: 8, color: '#1e293b', marginBottom: 4 };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderTop: `2px solid ${c}` }}>
      <div style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>
        <div style={{ fontWeight: 700, fontSize: 9, color: c, marginBottom: 6, textTransform: 'uppercase' }}>Bank Details</div>
        {[['Bank Name', 'HDFC Bank Limited'], ['A/C No.', '1234567890123456'], ['IFSC Code', 'HDFC0001234'], ['Branch', 'Nariman Point, Mumbai']].map(([l, v]) => (
          <div key={l}><div style={lbl}>{l}</div><div style={val}>{v}</div></div>
        ))}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontWeight: 700, fontSize: 9, color: c, marginBottom: 6, textTransform: 'uppercase' }}>Tax Summary</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8 }}>
          <thead><tr style={{ background: '#f1f5f9' }}>{['Tax%','Taxable Amt','CGST Amt','SGST Amt','Total Tax'].map(h => <th key={h} style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700, color: '#374151', fontSize: 8 }}>{h}</th>)}</tr></thead>
          <tbody>
            {[['18%','1,72,000','15,480','15,480','30,960'],['5%','28,000','700','700','1,400']].map((r,i)=>(
              <tr key={i}>{r.map((v,j)=><td key={j} style={{ padding:'2px 4px', textAlign:'right', borderBottom:'1px solid #f1f5f9' }}>{v}</td>)}</tr>
            ))}
            <tr style={{ fontWeight:700, background: '#f8fafc' }}>
              {['Total','2,00,000','16,180','16,180','32,360'].map((v,j)=><td key={j} style={{ padding:'3px 4px', textAlign:'right', color: c }}>{v}</td>)}
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <div style={{ display: 'inline-block', background: c, color: '#fff', padding: '5px 14px', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>Total Amount (₹): 2,32,360</div>
        </div>
      </div>
    </div>
  );
}

function InvTandC({ c }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e2e8f0', marginTop: 4 }}>
      <div style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', fontSize: 8, color: '#64748b' }}>
        <div style={{ fontWeight: 700, fontSize: 9, color: '#1e293b', marginBottom: 4 }}>Terms &amp; Conditions</div>
        <ol style={{ margin: 0, paddingLeft: 14, lineHeight: 1.8 }}>
          <li>Payment is expected within 7 days from the invoice date.</li>
          <li>Goods once sold will not be taken back or exchanged.</li>
          <li>Interest @ 2% per month will be charged if payment is delayed.</li>
        </ol>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ width: 60, height: 60, border: `1px dashed ${c}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, fontSize: 7, color: '#94a3b8' }}>SEAL</div>
        <div style={{ borderTop: `1px solid ${c}`, width: '80%', textAlign: 'center', paddingTop: 4 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: '#1e293b' }}>Authorized Signatory</div>
          <div style={{ fontSize: 7, color: '#64748b' }}>DEMO COMPANY PVT. LTD.</div>
        </div>
      </div>
    </div>
  );
}

/* ── Full-detail invoice preview rendered at 680px (scaled down in card) ── */
function InvoiceFullPreview({ layoutId, color }) {
  const c = color || '#2563eb';
  const base = { fontFamily: 'Arial, sans-serif', fontSize: 9, color: '#1e293b', background: '#fff', width: 680 };
  const rows = [
    ['1','Sample Product','94050090','Nos','486','380','','1,84,680','9','16,621','9','16,621','2,17,922'],
    ['2','Installation & Services','998314','Job','1','15,320','','15,320','9','1,379','9','1,379','18,078'],
  ];

  if (layoutId === 1) return (
    <div style={base}>
      {/* Color header band */}
      <div style={{ background: c, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>D</span>
          </div>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: 0.3 }}>DEMO COMPANY PVT. LTD.</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 8, marginTop: 2, lineHeight: 1.7 }}>
            No. 301, Ruby Business Park, Plot No. 282, Sector 23, Nerul<br/>
            Navi Mumbai · 400706, Maharashtra · India<br/>
            Mobile: 9876543210 · GSTIN: 27QWERT1234Q122 · PAN: AABCD1234E<br/>
            Email: info@democompany.in · www.democompany.in
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, letterSpacing: 1, marginBottom: 8 }}>TAX INVOICE</div>
          <table style={{ fontSize: 8, color: 'rgba(255,255,255,0.9)', marginLeft: 'auto' }}>
            <tbody>
              {[['Invoice No.:', '01-04-2026'],['Invoice Date:', '01 Apr 2026'],['Reverse Charge:', 'No'],['Financial Year:', '2026-27'],['State:', 'Maharashtra'],['State Code (Sale):','27']].map(([l,v])=>(
                <tr key={l}><td style={{ paddingRight: 8, paddingBottom: 2 }}>{l}</td><td style={{ fontWeight: 700 }}>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Bill To / Ship To */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `2px solid ${c}` }}>
        {[['DETAILS OF RECEIVER (BILL TO)','DETAILS OF CONSIGNEE (SHIP TO)']].flat().map(title => (
          <div key={title} style={{ padding: '8px 14px', borderRight: title.includes('BILL') ? '1px solid #e2e8f0' : 'none' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c, marginBottom: 5, textTransform: 'uppercase', borderBottom: `1px solid ${c}`, paddingBottom: 3 }}>{title}</div>
            <div style={{ fontSize: 9, fontWeight: 700 }}>DEMO COMPANY PVT. LTD.</div>
            <div style={{ fontSize: 8, color: '#374151', lineHeight: 1.7 }}>
              Office No. 101, Ruby Business Park, Plot No. 282, Sector 23, Turbhe<br/>
              Navi Mumbai · 400705, Maharashtra<br/>
              GSTIN: 27MNOP5678R1Z8 · PAN: AABCE5678G<br/>
              Place of Supply: Maharashtra
            </div>
          </div>
        ))}
      </div>
      {/* Items table */}
      <div style={{ padding: '6px 0' }}><InvTable c={c} rows={rows} /></div>
      {/* Amount in words */}
      <div style={{ padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 8 }}>
        <span style={{ fontWeight: 700 }}>Amount in Words: </span>
        <span>Rupees Two Lakh Thirty-Two Thousand Three Hundred Sixty Only</span>
        <span style={{ float: 'right', fontWeight: 700, color: c }}>CGST (9%): ₹16,180 &nbsp;|&nbsp; SGST (9%): ₹16,180 &nbsp;|&nbsp; Total Tax: ₹32,360</span>
      </div>
      <InvBankTax c={c} />
      <InvTandC c={c} />
    </div>
  );

  if (layoutId === 2) return (
    <div style={base}>
      {/* Header: bold company name + colored TAX INVOICE badge */}
      <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${c}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>D</span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, color: '#1e293b', letterSpacing: 0.2 }}>DEMO COMPANY PVT. LTD.</div>
            <div style={{ fontSize: 8, color: '#64748b', lineHeight: 1.7, marginTop: 3 }}>
              No. 301, Ruby Business Park, Sector 23, Nerul, Navi Mumbai · 400706<br/>
              Mobile: 9876543210 · GSTIN: 27QWERT1234Q122 · PAN: AABCD1234E
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ background: c, color: '#fff', fontWeight: 900, fontSize: 14, padding: '5px 16px', borderRadius: 6, marginBottom: 8 }}>Tax Invoice</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 10px', fontSize: 8, justifyContent: 'end' }}>
            {[['Invoice No.','30-09-2026'],['Invoice Date','30 Sep 2026'],['State','Maharashtra (27)'],['Reverse Charge','No']].map(([l,v])=>(
              <><span key={l} style={{ color: '#64748b' }}>{l}:</span><span key={v} style={{ fontWeight: 700 }}>{v}</span></>
            ))}
          </div>
        </div>
      </div>
      {/* Highlighted bill-to boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '10px 14px', background: '#f8fafc', borderBottom: `1px solid ${c}` }}>
        {['BILL TO','SHIP TO'].map(t => (
          <div key={t} style={{ border: `1.5px solid ${c}`, borderRadius: 6, padding: '8px 12px', background: '#fff' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c, marginBottom: 5 }}>{t}</div>
            <div style={{ fontSize: 9, fontWeight: 700 }}>DEMO COMPANY PVT. LTD.</div>
            <div style={{ fontSize: 8, color: '#374151', lineHeight: 1.7 }}>
              Office No. 101, Ruby Business Park, Turbhe, Navi Mumbai<br/>
              GSTIN: 27MNOP5678R1Z8 · Place of Supply: Maharashtra
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 0' }}><InvTable c={c} rows={rows} /></div>
      <div style={{ padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 8 }}>
        <span style={{ fontWeight: 700 }}>Amount in Words: </span>Rupees Two Lakh Thirty-Two Thousand Three Hundred Sixty Only
      </div>
      <InvBankTax c={c} />
      <InvTandC c={c} />
    </div>
  );

  if (layoutId === 3) return (
    <div style={base}>
      {/* Header: Logo box left, company right, TAX INVOICE top-right */}
      <div style={{ padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'flex-start', borderBottom: `2px solid ${c}` }}>
        <div style={{ width: 80, height: 60, border: '1px dashed #cbd5e1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5 }}>LOGO<br/>HERE</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#1e293b' }}>DEMO COMPANY PVT. LTD.</div>
          <div style={{ fontSize: 8, color: '#64748b', lineHeight: 1.7, marginTop: 2 }}>
            No. 301, Ruby Business Park, Sector 23, Nerul, Navi Mumbai · 400706<br/>
            GSTIN: 27QWERT1234Q122 · PAN: AABCD1234E · Mobile: 9876543210
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: c, marginBottom: 8 }}>TAX INVOICE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 8px', fontSize: 8, justifyContent: 'end' }}>
            {[['Invoice No.','27-143'],['Invoice Date','15-04-2026'],['Supply State','Maharashtra (27)']].map(([l,v])=>(
              <><span key={l} style={{ color:'#64748b' }}>{l}:</span><span key={v} style={{ fontWeight:700 }}>{v}</span></>
            ))}
          </div>
        </div>
      </div>
      {/* Bill To / Ship To plain */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${c}` }}>
        {['BILL TO','SHIP TO'].map(t => (
          <div key={t} style={{ padding: '8px 14px', borderRight: t==='BILL TO'?'1px solid #e2e8f0':'none' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c, marginBottom: 5 }}>{t}</div>
            <div style={{ fontSize: 9, fontWeight: 700 }}>DEMO COMPANY PVT. LTD.</div>
            <div style={{ fontSize: 8, color: '#374151', lineHeight: 1.7 }}>
              Office No. 101, Turbhe, Navi Mumbai<br/>
              GSTIN: 27MNOP5678R1Z8
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 0' }}><InvTable c={c} rows={rows} /></div>
      <div style={{ padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 8 }}>
        <span style={{ fontWeight: 700 }}>Amount in Words: </span>Rupees Two Lakh Thirty-Two Thousand Three Hundred Sixty Only
      </div>
      <InvBankTax c={c} />
      <InvTandC c={c} />
    </div>
  );

  // Layout 4
  return (
    <div style={base}>
      {/* Compact top header with circle logo */}
      <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${c}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>D</span>
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: '#1e293b' }}>DEMO COMPANY PVT. LTD.</div>
            <div style={{ fontSize: 8, color: '#64748b' }}>GSTIN: 27QWERT1234Q122 · Navi Mumbai · 400706</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: c }}>TAX INVOICE</div>
          <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>INV-0001 &nbsp;|&nbsp; 01 Apr 2026</div>
        </div>
      </div>
      {/* Sub-header strip */}
      <div style={{ background: `${c}18`, padding: '5px 18px', display: 'flex', justifyContent: 'space-between', fontSize: 8, borderBottom: `1px solid ${c}40` }}>
        {[['Invoice Date','01-04-2026'],['Due Date','01-04-2026'],['Place of Supply','Maharashtra (27)'],['Reverse Charge','No']].map(([l,v])=>(
          <div key={l}><span style={{ color:'#64748b' }}>{l}: </span><strong>{v}</strong></div>
        ))}
      </div>
      {/* Bill To / Ship To with bottom-border accent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid #e2e8f0` }}>
        {['BILL TO','SHIP TO'].map(t => (
          <div key={t} style={{ padding: '8px 14px', borderRight: t==='BILL TO'?'1px solid #e2e8f0':'none', borderBottom: `2px solid ${t==='BILL TO'?c:'transparent'}` }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c, borderBottom: `1px solid ${c}`, paddingBottom: 3, marginBottom: 5 }}>{t}</div>
            <div style={{ fontSize: 9, fontWeight: 700 }}>DEMO COMPANY PVT. LTD.</div>
            <div style={{ fontSize: 8, color: '#374151', lineHeight: 1.7 }}>
              Sector 22, Nerul, Navi Mumbai · 400706<br/>
              GSTIN: 27MNOP5678R1Z8
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 0' }}><InvTable c={c} rows={rows} /></div>
      <div style={{ padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 8 }}>
        <span style={{ fontWeight: 700 }}>Amount in Words: </span>Rupees Two Lakh Thirty-Two Thousand Three Hundred Sixty Only
      </div>
      <InvBankTax c={c} />
      <InvTandC c={c} />
    </div>
  );
}

/* ── Full-size preview modal ────────────────────────────────────── */
function LayoutPreviewModal({ layout, color, onClose }) {
  const c = color?.hex || '#2563eb';
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:14, width:760, maxWidth:'95vw', maxHeight:'92vh', overflow:'auto', boxShadow:'0 24px 80px rgba(0,0,0,0.35)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:'16px 22px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
          <div style={{ fontWeight:800, fontSize:16, color:'#1e3a5f' }}>{layout.name} Preview — <span style={{ color:c }}>{color?.label}</span></div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:22, lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ border:`2px solid ${c}`, borderRadius:10, overflow:'hidden' }}>
            <InvoiceFullPreview layoutId={layout.id} color={c} />
          </div>
          <p style={{ fontSize:13, color:'#64748b', marginTop:14, textAlign:'center' }}>
            This preview shows how your invoice will look with <strong>{layout.name}</strong> and <strong style={{ color:c }}>{color?.label}</strong> color theme.
          </p>
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'flex-end', position:'sticky', bottom:0, background:'#fff' }}>
          <button onClick={onClose} style={{ padding:'9px 24px', background:'#2563eb', border:'none', borderRadius:8, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer' }}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}

/* ── Layouts tab ─────────────────────────────────────────────────── */
function LayoutsTab({ sections }) {
  const [selectedLayout, setSelectedLayout] = useState(1);
  const [selectedColor,  setSelectedColor]  = useState('slate_blue');
  const [preview,        setPreview]        = useState(null);
  const [busy,           setBusy]           = useState(false);
  const [msg,            setMsg]            = useState('');
  const [err,            setErr]            = useState('');

  const colorObj = COLORS.find(c => c.id === selectedColor) || COLORS[0];

  const submit = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await api('/client/change-requests', { method:'POST', body:{ section:'layout', layout_id: selectedLayout, color: selectedColor } });
      setMsg('Layout request submitted successfully.');
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="bp-card">
      <h3 style={{ marginTop:0, marginBottom:4, color:'var(--bp-navy)' }}>Layouts</h3>
      <p className="bp-section-desc" style={{ marginBottom:20 }}>
        Choose your invoice layout and color that will be used for your documents. You can preview the layout before submitting for approval.
      </p>

      {msg && <p className="bp-alert bp-alert-success">{msg}</p>}
      {err && <p className="bp-alert bp-alert-error">{err}</p>}

      {/* 4-column layout cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {LAYOUTS.map(layout => {
          const active = selectedLayout === layout.id;
          return (
            <div key={layout.id} onClick={() => setSelectedLayout(layout.id)}
              style={{ border:`2px solid ${active?'#2563eb':'#e2e8f0'}`, borderRadius:12, overflow:'hidden', cursor:'pointer', background: active?'#f0f7ff':'#fff', transition:'border-color 0.15s', display:'flex', flexDirection:'column' }}>

              {/* Card header: radio + name + badge */}
              <div style={{ padding:'10px 12px 6px', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${active?'#2563eb':'#cbd5e1'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {active && <div style={{ width:9, height:9, borderRadius:'50%', background:'#2563eb' }} />}
                </div>
                <span style={{ fontWeight:700, fontSize:13, color:'#1e293b' }}>{layout.name}</span>
                {layout.recommended && (
                  <span style={{ fontSize:9, fontWeight:700, color:'#2563eb', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'2px 7px', marginLeft:'auto' }}>Recommended</span>
                )}
              </div>

              {/* Description */}
              <p style={{ fontSize:10.5, color:'#64748b', margin:'0 12px 8px', lineHeight:1.5, minHeight:44 }}>{layout.desc}</p>

              {/* Scaled invoice thumbnail */}
              <div style={{ margin:'0 10px 10px', border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden', background:'#fff', height:210, position:'relative', flexShrink:0 }}>
                <div style={{ position:'absolute', top:0, left:0, transform:'scale(0.29)', transformOrigin:'top left', width:'344%' }}>
                  <InvoiceFullPreview layoutId={layout.id} color={colorObj.hex} />
                </div>
              </div>

              {/* Color picker */}
              <div style={{ padding:'0 12px 8px' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:7 }}>
                  Choose Color <span style={{ fontWeight:400, color:'#64748b' }}>(Default: {colorObj.label})</span>
                </div>
                {/* Swatches row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:4, marginBottom:4 }}>
                  {COLORS.map(col => (
                    <div key={col.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}
                      onClick={e => { e.stopPropagation(); setSelectedColor(col.id); }}>
                      <div style={{ width:22, height:22, borderRadius:'50%', background:col.hex, border: selectedColor===col.id?`2.5px solid #1e3a5f`:'2.5px solid transparent', outline: selectedColor===col.id?`2px solid ${col.hex}`:'none', outlineOffset:1, transition:'all 0.1s', flexShrink:0 }} />
                      <span style={{ fontSize:8, color: selectedColor===col.id?'#2563eb':'#94a3b8', fontWeight: selectedColor===col.id?700:400, textAlign:'center', lineHeight:1.2, wordBreak:'break-word' }}>{col.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview button */}
              <div style={{ padding:'0 10px 12px', marginTop:'auto' }}>
                <button onClick={e => { e.stopPropagation(); setPreview(layout); }}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 0', border:'1.5px solid #e2e8f0', borderRadius:8, background:'#fff', fontSize:12, fontWeight:600, color:'#374151', cursor:'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Preview Layout
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Important Information */}
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'14px 18px', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#2563eb"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2"/></svg>
          <strong style={{ fontSize:13, color:'#1d4ed8' }}>Important Information</strong>
        </div>
        <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:'#1d4ed8', lineHeight:1.8 }}>
          <li>You can preview the layout and color before submitting for approval.</li>
          <li>The selected layout will be used for all invoices, bills of supply, credit notes, debit notes, quotations and delivery challans.</li>
          <li>Changes will be applied only after administrator approval.</li>
        </ul>
      </div>

      <ApprovalFooter data={sections?.layout} busy={busy} dirty onSubmit={submit} />

      {preview && <LayoutPreviewModal layout={preview} color={colorObj} onClose={() => setPreview(null)} />}
    </div>
  );
}

const TABS = [
  { key: 'branding', label: 'Invoice Branding', Icon: ImageIcon },
  { key: 'bank', label: 'Bank Details', Icon: BankIcon },
  { key: 'numbering', label: 'Document Numbering & Prefix', Icon: HashIcon },
  { key: 'layouts', label: 'Layouts', Icon: LayoutIcon },
];

function AssetUploadBox({ field, label, recSize, path, approvedPath, onUpload }) {
  const inputRef = useRef(null);
  const isImage = path && /\.(png|jpe?g|gif|webp|svg)$/i.test(path);

  return (
    <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}>
      <strong className="bp-field-title" style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{label}</strong>

      {/* Preview box */}
      <div style={{
        width: '100%', height: 130, border: '1.5px solid #e2e8f0', borderRadius: 10,
        background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', marginBottom: 10, boxSizing: 'border-box',
      }}>
        {isImage
          ? <img src={`/storage/${path}`} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 6 }} />
          : <span style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 8 }}>No file uploaded</span>
        }
      </div>

      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && onUpload(field, e.target.files[0])} />

      {/* Upload / Replace button */}
      <button type="button" onClick={() => inputRef.current?.click()}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 14px', border: '1.5px solid #2563eb', borderRadius: 7, background: '#fff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 6 }}>
        <UploadIcon /> Upload / Replace
      </button>

      {/* View Current */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        {path
          ? <a href={`/storage/${path}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>View Current</a>
          : <span style={{ fontSize: 12, color: '#94a3b8' }}>No file on record</span>
        }
      </div>

      {/* Recommended size */}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
        Recommended size: {recSize}<br />( PNG, JPG, JPEG )
      </div>

      {approvedPath && path !== approvedPath && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, textAlign: 'center' }}>
          Pending admin approval
        </div>
      )}
    </div>
  );
}

function ApprovalStatus({ data }) {
  if (!data) return null;
  const { pending, last_reviewed } = data;
  const row = (text, badgeClass, badgeText) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span style={{ fontSize: 12.5, color: '#374151' }}>{text}</span>
      <span className={`bp-badge ${badgeClass}`}>{badgeText}</span>
    </div>
  );
  if (pending) return row(`Submitted ${formatDateTime(pending.created_at)}`, 'bp-badge-partial', 'Pending Approval');
  if (last_reviewed?.status === 'approved') return row(`Last request approved on ${formatDateTime(last_reviewed.reviewed_at)}`, 'bp-badge-paid', 'Approved');
  if (last_reviewed?.status === 'rejected') return row(`Last request rejected on ${formatDateTime(last_reviewed.reviewed_at)}${last_reviewed.admin_note ? ` — ${last_reviewed.admin_note}` : ''}`, 'bp-badge-cancelled', 'Rejected');
  return null;
}

/** Bottom bar: approval status left, Submit button right */
function ApprovalFooter({ data, busy, dirty, onSubmit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--bp-border)', flexWrap: 'wrap', gap: 10 }}>
      <ApprovalStatus data={data} />
      <button type="button" onClick={onSubmit} disabled={busy || !dirty}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 22px', background: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: (busy || !dirty) ? 'not-allowed' : 'pointer', opacity: (busy || !dirty) ? 0.65 : 1, whiteSpace: 'nowrap' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
        {busy ? 'Submitting…' : 'Submit for Approval'}
      </button>
    </div>
  );
}

export default function BusinessSettings() {
  const [approved, setApproved] = useState(null);
  const [sections, setSections] = useState(null);
  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [activeTab, setActiveTab] = useState('branding');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscErr,     setIfscErr]     = useState('');

  const load = () => {
    api('/client/change-requests/current')
      .then((d) => {
        setApproved(d.approved);
        setSections(d.sections);
        const merged = mergeDraft(d.approved, d.sections);
        setForm(merged);
        setBaseline(merged);
      })
      .catch((e) => setErr(e.message));
  };

  useEffect(() => { load(); }, []);

  if (!form) return <LoadingBlock />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // A section's own submit button only lights up once one of its fields has actually
  // been edited — never lets a client re-fire an approval request with no real change.
  const isSectionDirty = (section) =>
    !!baseline && (SECTION_FIELDS[section] || []).some((k) => (form[k] ?? '') !== (baseline[k] ?? ''));

  const upload = async (field, file) => {
    setErr('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append(field, file);
      await api(`/client/change-requests/assets/${field}`, { method: 'POST', body: fd });
      load();
      setMsg(`${field.replace('_', ' ')} staged for approval.`);
    } catch (e) {
      setErr(e.message);
    }
  };

  const isBrandingDirty = SECTION_FIELDS.invoice_settings.some((k) => (form[k] ?? '') !== (baseline[k] ?? ''));

  const fetchIfsc = async (code) => {
    if (code.length !== 11) return;
    setIfscLoading(true); setIfscErr('');
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${code}`);
      if (!res.ok) throw new Error('Invalid IFSC or not found.');
      const d = await res.json();
      setForm(f => ({ ...f, bank_name: d.BANK || '', bank_branch: d.BRANCH || '' }));
    } catch (e) { setIfscErr(e.message || 'Invalid IFSC.'); }
    finally { setIfscLoading(false); }
  };

  const submitWithPopup = async (section, successMsg) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = { section };
      SECTION_FIELDS[section].forEach((k) => { body[k] = form[k] ?? ''; });
      await api('/client/change-requests', { method: 'POST', body });
      load(); setMsg(successMsg);
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  const submitBranding = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = { section: 'invoice_settings' };
      SECTION_FIELDS.invoice_settings.forEach((k) => { body[k] = form[k] ?? ''; });
      await api('/client/change-requests', { method: 'POST', body });
      load();
      setMsg('Invoice Branding request submitted successfully.');
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="bp-section-wrap">
      <div style={{ fontSize: 12, color: 'var(--bp-muted)', fontWeight: 600 }}>
        <Link to="/portal" style={{ color: 'var(--bp-blue)', textDecoration: 'none' }}>Client Portal</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        <span>Settings</span>
        {activeTab !== 'branding' && (
          <><span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
          <span style={{ color: 'var(--bp-blue)' }}>{TABS.find(t => t.key === activeTab)?.label}</span></>
        )}
      </div>

      <div className="bp-section-head">
        <div>
          <div className="bp-section-kicker">Settings</div>
          <p className="bp-section-desc">Manage your billing and invoice preferences.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 16px', maxWidth: 340 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
            Changes require administrator approval before they appear on invoices.
          </span>
        </div>
      </div>

      <nav className="bp-uline-tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} type="button"
            className={`bp-uline-tab${activeTab === key ? ' active' : ''}`}
            onClick={() => setActiveTab(key)}>
            <Icon /> {label}
          </button>
        ))}
      </nav>

      {msg && <p className="bp-alert bp-alert-success">{msg}</p>}
      {err && <p className="bp-alert bp-alert-error">{err}</p>}

      {/* ── Invoice Branding Tab ─────────────────────────────── */}
      {activeTab === 'branding' && (
        <div className="bp-card">
          <h3 style={{ marginTop: 0, marginBottom: 4, color: 'var(--bp-navy)' }}>A. Invoice Branding</h3>
          <p className="bp-section-desc" style={{ marginBottom: 20 }}>
            Customize your invoice appearance by uploading your business branding and setting invoice signatory details, terms &amp; conditions, and other information that will appear on your invoices.
          </p>

          {/* Assets row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            {ASSETS.map(({ field, pathKey, label, recSize }) => (
              <AssetUploadBox key={field} field={field} label={label} recSize={recSize}
                path={form[pathKey]} approvedPath={approved?.[pathKey]} onUpload={upload} />
            ))}
          </div>

          {/* Signatory Name + Terms */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
            <label>
              <strong className="bp-field-title">Signatory Name</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bp-muted)" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>
                <input className="bp-input" style={{ flex: 1 }} value={form.signatory_name || ''}
                  onChange={(e) => set('signatory_name', e.target.value)}
                  placeholder="Enter the name of the person authorized to sign the invoice." />
              </div>
              <p style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 4, marginBottom: 0 }}>Enter the name of the person authorized to sign the invoice.</p>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              <strong className="bp-field-title">Terms &amp; Conditions</strong>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bp-muted)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 4 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                <textarea className="bp-input" rows={5} style={{ flex: 1, resize: 'vertical' }}
                  value={form.terms_conditions || ''}
                  onChange={(e) => set('terms_conditions', e.target.value)}
                  placeholder="Enter the Terms & Conditions that should appear on the invoice." />
              </div>
            </label>
          </div>

          <ApprovalFooter
            data={sections?.invoice_settings ?? sections?.branding}
            busy={busy} dirty={isBrandingDirty} onSubmit={submitBranding} />
        </div>
      )}

      {/* ── Bank Details Tab ─────────────────────────────────── */}
      {activeTab === 'bank' && (
        <div className="bp-card">
          <h3 style={{ marginTop: 0, marginBottom: 4, color: 'var(--bp-navy)' }}>Bank Details</h3>
          <p className="bp-section-desc" style={{ marginBottom: 20 }}>Manage and maintain the business bank account details that will be used for transactions and displayed on invoices.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
            {/* IFSC Code */}
            <label>
              <strong className="bp-field-title">IFSC Code</strong>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input className="bp-input" style={{ flex: 1 }} value={form.bank_ifsc || ''}
                  onChange={(e) => { set('bank_ifsc', e.target.value.toUpperCase()); setIfscErr(''); }}
                  onBlur={(e) => fetchIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234" maxLength={11} />
                {ifscLoading && <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--bp-muted)' }}>Fetching…</span>}
              </div>
              {ifscErr && <p style={{ fontSize: 11, color: '#dc2626', marginTop: 4, marginBottom: 0 }}>{ifscErr}</p>}
            </label>

            {/* Bank Name — read-only */}
            <label>
              <strong className="bp-field-title">Bank Name</strong>
              <input className="bp-input" style={{ marginTop: 6, background: '#f8fafc', color: '#64748b' }}
                value={form.bank_name || ''} readOnly placeholder="Auto-populated from IFSC" />
            </label>

            {/* Branch — read-only */}
            <label>
              <strong className="bp-field-title">Branch</strong>
              <input className="bp-input" style={{ marginTop: 6, background: '#f8fafc', color: '#64748b' }}
                value={form.bank_branch || ''} readOnly placeholder="Auto-populated from IFSC" />
            </label>

            {/* Account Holder Name */}
            <label>
              <strong className="bp-field-title">Account Holder Name</strong>
              <input className="bp-input" style={{ marginTop: 6 }} value={form.account_holder_name || ''}
                onChange={(e) => set('account_holder_name', e.target.value)}
                placeholder="Name on bank account" />
            </label>

            {/* Account Number */}
            <label>
              <strong className="bp-field-title">Account Number</strong>
              <input className="bp-input" style={{ marginTop: 6 }} value={form.bank_account || ''}
                onChange={(e) => set('bank_account', e.target.value.replace(/\D/, ''))}
                placeholder="Enter account number" />
            </label>

            {/* Account Type */}
            <label>
              <strong className="bp-field-title">Account Type</strong>
              <select className="bp-input" style={{ marginTop: 6 }} value={form.account_type || ''}
                onChange={(e) => set('account_type', e.target.value)}>
                <option value="">Select account type</option>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            {/* UPI ID */}
            <label>
              <strong className="bp-field-title">UPI ID <span style={{ fontWeight: 400, color: 'var(--bp-muted)', fontSize: 11 }}>(Optional)</span></strong>
              <input className="bp-input" style={{ marginTop: 6 }} value={form.upi_id || ''}
                onChange={(e) => set('upi_id', e.target.value)} placeholder="e.g. business@upi" />
            </label>
          </div>

          <ApprovalFooter
            data={sections?.bank}
            busy={busy}
            dirty={isSectionDirty('bank')}
            onSubmit={() => submitWithPopup('bank', 'Bank Details request submitted successfully.')} />
        </div>
      )}

      {/* ── Document Numbering Tab ───────────────────────────── */}
      {activeTab === 'numbering' && (
        <div className="bp-card">
          <h3 style={{ marginTop: 0, marginBottom: 4, color: 'var(--bp-navy)' }}>Document Numbering &amp; Prefix Configuration</h3>
          <p className="bp-section-desc" style={{ marginBottom: 20 }}>Configure prefixes for your documents. Numbering will be automatically generated by the system.</p>

          {/* 2-column grid — each cell: [Label] [Input] [Sample badge] [i] in one row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 32px', marginBottom: 20 }}>
            {PREFIX_FIELDS.map(([k, label, short]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10, alignItems: 'center' }}>
                <strong style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>{label}</strong>
                <input className="bp-input" value={form[k] || ''}
                  onChange={(e) => set(k, e.target.value)} placeholder={short}
                  style={{ width: '100%', boxSizing: 'border-box' }} />
                <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                  Sample: {short}-0001
                </span>
                <span title="Auto-sequential numbering" style={{ color: 'var(--bp-muted)', cursor: 'help', display: 'inline-flex' }}><InfoIcon /></span>
              </div>
            ))}
          </div>

          {/* Important Information box */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 18px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#2563eb"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2"/><line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2"/></svg>
              <strong style={{ fontSize: 13, color: '#1d4ed8' }}>Important Information</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#1d4ed8', lineHeight: 1.8 }}>
              <li>Document numbers will be automatically generated based on the configured prefix and sequence.</li>
              <li>You only need to enter the prefix. The system will maintain the numbering automatically.</li>
              <li>Numbering will continue sequentially for each document type.</li>
              <li>Duplicate document numbers will not be allowed.</li>
            </ul>
          </div>

          <ApprovalFooter
            data={sections?.numbering}
            busy={busy}
            dirty={isSectionDirty('numbering')}
            onSubmit={() => submitWithPopup('numbering', 'Document Numbering & Prefix request submitted successfully.')} />
        </div>
      )}

      {/* ── Layouts Tab ─────────────────────────────────────── */}
      {activeTab === 'layouts' && <LayoutsTab sections={sections} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Link to="/portal/settings/history" className="bp-btn bp-btn-outline"
          style={{ height: 40, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          View Request History
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </Link>
      </div>
    </div>
  );
}

const SECTION_BADGE = {
  pending: ['bp-badge-partial', 'Pending Approval'],
  approved: ['bp-badge-paid', 'Approved'],
  rejected: ['bp-badge-cancelled', 'Rejected'],
};

export function ChangeRequestHistory() {
  const [data, setData] = useState(null);
  const [section, setSection] = useState('');

  const load = (sec) => {
    const qs = sec ? `?section=${sec}` : '';
    api(`/client/change-requests/history${qs}`).then(setData).catch(console.error);
  };

  useEffect(() => { load(section); }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bp-section-wrap">
      <div style={{ fontSize: 12, color: 'var(--bp-muted)', fontWeight: 600 }}>
        <Link to="/portal" style={{ color: 'var(--bp-blue)', textDecoration: 'none' }}>Client Portal</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        <Link to="/portal/settings" style={{ color: 'var(--bp-blue)', textDecoration: 'none' }}>Settings</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        Request History
      </div>

      <div className="bp-section-head">
        <div>
          <div className="bp-section-kicker">Request History</div>
          <p className="bp-section-desc">Every settings change you've submitted, and its approval status.</p>
        </div>
      </div>

      <div className="bp-toolbar" style={{ marginBottom: 0 }}>
        <select className="bp-select" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All Sections</option>
          {Object.entries(SECTION_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {!data ? <LoadingBlock /> : (
        <table className="bp-table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Reviewed</th>
              <th>Admin Note</th>
            </tr>
          </thead>
          <tbody>
            {data.data.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--bp-muted)', padding: 20 }}>No requests yet.</td></tr>
            ) : data.data.map((req) => {
              const [badgeClass, badgeText] = SECTION_BADGE[req.status] || SECTION_BADGE.pending;
              return (
                <tr key={req.id}>
                  <td>{SECTION_LABELS[req.section] || req.section || '—'}</td>
                  <td>{formatDateTime(req.created_at)}</td>
                  <td><span className={`bp-badge ${badgeClass}`}>{badgeText}</span></td>
                  <td>{req.reviewed_at ? formatDateTime(req.reviewed_at) : '—'}</td>
                  <td>{req.admin_note || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

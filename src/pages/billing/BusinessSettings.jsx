import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { LoadingBlock } from '../../components/Spinner';
import { currentFyLabel, formatDMYTime } from './billingUtils';
import { prefetchLayoutPreview } from '../../components/LayoutPreview';
import SharedLayoutPreviewModal from '../../components/LayoutPreviewModal';
import layout1Img from '../../assets/layout-previews/layout-1.png';
import layout2Img from '../../assets/layout-previews/layout-2.png';
import layout3Img from '../../assets/layout-previews/layout-3.png';

const ASSETS = [
  { field: 'logo',      pathKey: 'logo_path',       label: 'Business Logo',       recSize: '300 × 300 px' },
  { field: 'signature', pathKey: 'signature_path',   label: 'Authorized Signature', recSize: '300 × 100 px' },
  { field: 'seal',      pathKey: 'seal_path',        label: 'Company Seal',         recSize: '300 × 300 px' },
];

// Paired so a natural 2-col grid lands exactly like the approved layout — Account Number ends
// up alone on the last row since this list has an odd length.
const ACCOUNT_TYPES = ['Current', 'Savings', 'Cash Credit', 'Overdraft', 'Other (Specify)'];

// [doc key, label, default prefix, default separator] — same keys the backend's
// DocumentNumberingSettings uses. The numbering TYPE (auto / manual) is admin-only, so it is
// intentionally not part of this form.
const NUMBERING_DOCS = [
  ['invoice',          'Tax Invoice',      'INV', '-'],
  ['bill_of_supply',   'Bill of Supply',   'BOS', '/'],
  ['credit_note',      'Credit Note',      'CN',  '-'],
  ['debit_note',       'Debit Note',       'DN',  '/'],
  ['quotation',        'Quotation',        'QT',  '-'],
  ['delivery_challan', 'Delivery Challan', 'DC',  '/'],
];
const NUMBERING_PROPS = ['prefix', 'separator', 'next_number', 'prefix_position', 'status'];
const NUMBERING_FIELDS = NUMBERING_DOCS.flatMap(([k]) => NUMBERING_PROPS.map((p) => `${k}_${p}`));

/** Mirrors the backend's InvoiceService::formatDocNumber so the preview matches what gets generated. */
function formatDocNumber(cfg, offset = 0) {
  const prefix = (cfg.prefix || '').trim() || 'DOC';
  const sep = cfg.separator || '-';
  const raw = String(cfg.next_number || '01');
  const padded = String((parseInt(raw, 10) || 1) + offset).padStart(Math.max(2, raw.length), '0');
  if (cfg.prefix_position === 'last') {
    return /^[/-]/.test(prefix) ? padded + prefix : padded + sep + prefix;
  }
  return /[/-]$/.test(prefix) ? prefix + padded : prefix + sep + padded;
}

/** Which Settings tab each editable field belongs to — mirrors the backend's
 * ClientChangeRequest::FIELD_SECTIONS. The backend re-enforces this itself; this copy is only
 * for building each tab's own submit payload, not a security boundary. */
const BANK_KEYS = ['bank_ifsc', 'bank_name', 'bank_branch', 'account_holder_name', 'bank_account', 'account_type', 'upi_id'];

const FIELD_SECTION = {
  bank_name: 'bank', bank_branch: 'bank', account_holder_name: 'bank', bank_account: 'bank',
  bank_ifsc: 'bank', swift_code: 'bank', account_type: 'bank', upi_id: 'bank',
  signatory_name: 'branding', terms_conditions: 'branding',
  ...Object.fromEntries(NUMBERING_FIELDS.map((k) => [k, 'numbering'])),
};

const SECTION_FIELDS = {
  bank: BANK_KEYS,
  branding: ['signatory_name', 'terms_conditions'],
  numbering: NUMBERING_FIELDS,
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
    ...Object.fromEntries(NUMBERING_FIELDS.map((k) => [k, ''])),
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
      base[k] = sections?.branding?.draft?.[k] || sections?.branding?.pending?.[k] || approved?.[k] || '';
    } else {
      const section = FIELD_SECTION[k];
      const pendingPayload = sections?.[section]?.pending?.payload;
      base[k] = pendingPayload && Object.prototype.hasOwnProperty.call(pendingPayload, k) ? pendingPayload[k] : (text[k] ?? '');
    }
  });
  return base;
}

function formatDateTime(iso) {
  return iso ? formatDMYTime(iso).replace('—', '') : '';
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
  { id: 2, name: 'Layout 2', recommended: false, desc: 'Modern layout with a prominent company header and structured sections. Ideal for modern and elegant look.' },
  { id: 3, name: 'Layout 3', recommended: false, desc: 'Minimal and clean layout with a classic design. Best for simple and professional invoices.' },
];

const COLORS = [
  { id: 'simple',      label: 'Simple',      hex: '#111111' },
  { id: 'royal_blue',  label: 'Royal Blue',  hex: '#1d40af' },
  { id: 'deep_teal',   label: 'Deep Teal',   hex: '#036070' },
  { id: 'mocha_brown', label: 'Mocha Brown', hex: '#793312' },
  { id: 'dusty_plum',  label: 'Dusty Plum',  hex: '#8c2f5f' },
];

// Colours retired from the picker still resolve on documents that already use them; show the closest offered one.
const LEGACY_COLOUR = { slate_blue: 'simple', charcoal_grey: 'simple', antique_gold: 'simple' };
const normaliseColour = (id) => (COLORS.some((c) => c.id === id) ? id : (LEGACY_COLOUR[id] || 'simple'));
// A client that was on the retired Layout 4 sees (and can move off) Layout 1.
const normaliseLayout = (id) => (LAYOUTS.some((l) => l.id === Number(id)) ? Number(id) : 1);

/* ── Layouts tab ─────────────────────────────────────────────────── */
const LAYOUT_IMAGES = { 1: layout1Img, 2: layout2Img, 3: layout3Img };

// One real-renderer thumbnail per layout x colour, so picking a colour recolours every card instantly.
const COLOUR_THUMBS = import.meta.glob('../../assets/layout-previews/colours/*.jpg', { eager: true, query: '?url', import: 'default' });
const layoutThumb = (layoutId, colourId) => COLOUR_THUMBS[`../../assets/layout-previews/colours/layout-${layoutId}-${colourId}.jpg`] || LAYOUT_IMAGES[layoutId];

/** Real-renderer preview (the same renderer the admin sees) for the client's own profile. */
function clientLayoutPreviewUrl(layoutId, colourScheme) {
  return `/api/client/layout-preview?layout_id=${layoutId}&colour_scheme=${colourScheme}`;
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Larger preview of the selected layout + colour — the shared modal the admin portal uses too. */
function LayoutPreviewModal({ layout, color, onClose }) {
  return (
    <SharedLayoutPreviewModal
      title={layout.name}
      chipColor={color.hex}
      chipLabel={color.label}
      subtitle="This is how your documents will look once the layout is approved."
      previewUrl={clientLayoutPreviewUrl(layout.id, color.id)}
      fallbackSrc={LAYOUT_IMAGES[layout.id]}
      alt={`${layout.name} preview`}
      onClose={onClose}
    />
  );
}

function LayoutsTab({ approved, sections, onSubmitted }) {
  const approvedLayout = normaliseLayout(approved?.layout_id || 1);
  const approvedColour = normaliseColour(approved?.colour_scheme || 'simple');
  const pendingPayload = sections?.layout?.pending?.payload;
  // What the client is currently proposing: the open request if there is one, else the approved design.
  const baseLayout = pendingPayload?.layout_id ? normaliseLayout(pendingPayload.layout_id) : approvedLayout;
  const baseColour = pendingPayload?.colour_scheme ? normaliseColour(pendingPayload.colour_scheme) : approvedColour;

  const [selectedLayout, setSelectedLayout] = useState(baseLayout);
  const [selectedColor, setSelectedColor] = useState(baseColour);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Re-sync when the server data arrives / changes (after a submit).
  useEffect(() => { setSelectedLayout(baseLayout); setSelectedColor(baseColour); }, [baseLayout, baseColour]);

  // Warm the previews in the background (the server needs ~1.5 s per PDF): the selected layout first, then the
  // others a moment apart, so "Preview Layout" opens instantly instead of after a wait.
  useEffect(() => {
    const order = [selectedLayout, ...LAYOUTS.map((l) => l.id).filter((id) => id !== selectedLayout)];
    const timers = order.map((id, i) => window.setTimeout(() => prefetchLayoutPreview(clientLayoutPreviewUrl(id, selectedColor)), 200 + i * 700));
    return () => timers.forEach(window.clearTimeout);
  }, [selectedLayout, selectedColor]);

  const colorObj = COLORS.find((c) => c.id === selectedColor) || COLORS[0];
  const dirty = selectedLayout !== baseLayout || selectedColor !== baseColour;

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await api('/client/change-requests', { method: 'POST', body: { section: 'layout', layout_id: selectedLayout, colour_scheme: selectedColor } });
      onSubmitted('Layout request submitted successfully.');
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="bp-card">
      <h3 style={{ marginTop: 0, marginBottom: 4, color: '#0f2a5f', fontSize: 18, fontWeight: 800 }}>Layouts</h3>
      <p className="bp-section-desc" style={{ marginBottom: 20 }}>
        Select the document type and customize its layout and colour. Use a common layout for Tax Invoice, Bill of Supply, Debit Note &amp; Credit Note, or choose separate layouts for Quotation and Delivery Challan. Preview the selection before submitting it for administrator approval.
      </p>

      {err && <p className="bp-alert bp-alert-error">{err}</p>}

      <div className="ly-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
        {LAYOUTS.map((layout) => {
          const active = selectedLayout === layout.id;
          return (
            <div key={layout.id} className={`ly-card${active ? ' is-active' : ''}`} onClick={() => setSelectedLayout(layout.id)}
              style={{ border: `2px solid ${active ? '#2563eb' : '#e2e8f0'}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', background: active ? '#f5f9ff' : '#fff', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: active ? '0 10px 24px -14px rgba(37,99,235,0.55)' : 'none', display: 'flex', flexDirection: 'column' }}>

              {/* radio + name + badges */}
              <div style={{ padding: '14px 14px 6px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${active ? '#2563eb' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {active && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }} />}
                </span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#0f2a5f' }}>{layout.name}</span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 5 }}>
                  {approvedLayout === layout.id && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#15803d', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 10, padding: '2px 8px' }}>Current</span>
                  )}
                  {layout.recommended && (
                    <span style={{ fontSize: 9.5, fontWeight: 800, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '2px 8px' }}>Recommended</span>
                  )}
                </span>
              </div>

              <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 14px 10px', lineHeight: 1.5, minHeight: 52 }}>{layout.desc}</p>

              {/* the same invoice design thumbnails the admin sees */}
              <div className="ly-thumb" style={{ margin: '0 12px 12px', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <img src={layoutThumb(layout.id, selectedColor)} alt={`${layout.name} design`} loading="lazy"
                  style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>

              {/* colours */}
              <div style={{ padding: '0 14px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f2a5f', marginBottom: 8 }}>
                  Choose Color <span style={{ fontWeight: 500, color: '#64748b' }}>(Default: {approvedColour === colorObj.id ? colorObj.label : (COLORS.find((c) => c.id === approvedColour)?.label || 'Simple')})</span>
                </div>
                <div className="ly-swatches" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                  {COLORS.map((col) => {
                    const on = selectedColor === col.id;
                    return (
                      <button key={col.id} type="button" onClick={(e) => { e.stopPropagation(); setSelectedColor(col.id); }} title={col.label}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: col.hex, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${col.hex}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'box-shadow 0.12s' }}>
                          {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>}
                        </span>
                        <span style={{ fontSize: 9, color: on ? '#2563eb' : '#94a3b8', fontWeight: on ? 800 : 500, textAlign: 'center', lineHeight: 1.2 }}>{col.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '0 14px 14px', marginTop: 'auto' }}>
                <button type="button" className="ly-prev" onClick={(e) => { e.stopPropagation(); setSelectedLayout(layout.id); setPreview(layout); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', border: '1px solid #bfdbfe', borderRadius: 9, background: '#fff', fontSize: 12.5, fontWeight: 700, color: '#2563eb', cursor: 'pointer' }}>
                  <EyeIcon /> Preview Layout
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ly-info" style={{ background: '#eaf3ff', border: '1px solid #cfe2ff', borderRadius: 10, padding: '16px 20px', marginBottom: 8, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="11" x2="12" y2="17" /><line x1="12" y1="7" x2="12.01" y2="7" /></svg>
        </span>
        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block', fontSize: 13.5, color: '#1d4ed8', marginBottom: 6 }}>Important Information</strong>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.75 }}>
            <li>You can preview the layout and color before submitting for approval.</li>
            <li>The selected layout and color will be used for all invoices, bills of supply, credit notes, debit notes, quotations and delivery challans.</li>
            <li>Changes will be applied only after administrator approval. Until then your current layout stays active.</li>
          </ul>
        </div>
      </div>

      <ApprovalFooter data={sections?.layout} busy={busy} dirty={dirty} onSubmit={submit} />

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

function AssetUploadBox({ field, label, recSize, path, approvedPath, submitted, onUpload }) {
  const inputRef = useRef(null);
  const isImage = path && /\.(png|jpe?g|gif|webp|svg)$/i.test(path);

  return (
    <div className="bs-asset" style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}>
      <strong className="bp-field-title" style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 800, color: '#0f2a5f' }}>{label}</strong>

      {/* Preview box */}
      <div className="bs-asset-prev" style={{
        width: '100%', height: 140, border: '1px solid #dfe7f2', borderRadius: 10,
        background: '#f6f9fd', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', marginBottom: 10, boxSizing: 'border-box',
      }}>
        {isImage
          ? <img src={`/storage/${path}`} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: 6 }} />
          : <span style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 8 }}>No file uploaded</span>
        }
      </div>

      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && onUpload(field, e.target.files[0])} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Upload / Replace button */}
        <button type="button" className="bs-asset-btn" onClick={() => inputRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 22px', border: '1px solid #bfdbfe', borderRadius: 8, background: '#fff', color: '#2563eb', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 10, boxShadow: '0 1px 2px rgba(37,99,235,0.08)' }}>
          <UploadIcon /> Upload / Replace
        </button>

        {/* View Current */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {path
            ? <a href={`/storage/${path}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>View Current</a>
            : <span style={{ fontSize: 12, color: '#94a3b8' }}>No file on record</span>
          }
        </div>

        {/* Recommended size */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
          Recommended size: {recSize}<br />( PNG, JPG, JPEG )
        </div>
      </div>

      {approvedPath && path !== approvedPath && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, textAlign: 'center' }}>
          {submitted ? 'Pending admin approval' : 'Not submitted yet'}
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
    <div className="bs-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--bp-border)', flexWrap: 'wrap', gap: 10 }}>
      <ApprovalStatus data={data} />
      <button type="button" className="bs-submit" onClick={onSubmit} disabled={busy || !dirty}
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
  const [popup, setPopup] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscErr,     setIfscErr]     = useState('');
  const [ifscOk,      setIfscOk]      = useState('');
  const [numErrors,   setNumErrors]   = useState({}); // server-side errors keyed by "<doc>_<prop>"
  const [sampleDoc,   setSampleDoc]   = useState('invoice'); // document shown in the Format Preview panel

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

  if (!form) return <LoadingBlock minHeight="70vh" />;

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
      setMsg(`${field.replace('_', ' ')} uploaded. Click "Submit for Approval" to send all your branding changes together.`);
    } catch (e) {
      setErr(e.message);
    }
  };

  // Changed text, or files staged (uploaded but not yet submitted)
  const hasStagedFiles = ASSETS.some(({ pathKey }) => !!sections?.branding?.draft?.[pathKey]);
  const isBrandingDirty = hasStagedFiles || SECTION_FIELDS.branding.some((k) => (form[k] ?? '') !== (baseline[k] ?? ''));

  const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const fetchIfsc = async (code) => {
    setIfscOk('');
    if (code.length !== 11) {
      setIfscErr('Please enter a valid 11-character IFSC code.');
      return;
    }
    if (!IFSC_RE.test(code)) {
      setForm((f) => ({ ...f, bank_name: '', bank_branch: '' }));
      setIfscErr('Invalid IFSC Code. Please enter a valid IFSC Code.');
      return;
    }
    setIfscLoading(true); setIfscErr('');
    // Ignore a response that arrives after the user has already edited the IFSC again.
    const stillCurrent = (f) => f.bank_ifsc === code;
    try {
      const d = await api(`/client/lookup/ifsc/${code}`);
      const bank = d?.bank_name || d?.bank || '';
      const branch = d?.branch || d?.bank_branch || '';
      if (!d?.success || !bank) throw new Error('Invalid IFSC Code. Please enter a valid IFSC Code.');
      setForm((f) => (stillCurrent(f) ? { ...f, bank_name: bank, bank_branch: branch } : f));
      setIfscOk(`Verified: ${bank}${branch ? ` (${branch})` : ''}`);
    } catch (e) {
      // Never keep (or invent) bank / branch details for an IFSC that could not be verified.
      setForm((f) => (stillCurrent(f) ? { ...f, bank_name: '', bank_branch: '' } : f));
      setIfscErr(e.message || 'Invalid IFSC Code. Please enter a valid IFSC Code.');
    }
    finally { setIfscLoading(false); }
  };

  const validateBank = () => {
    const ifsc = (form.bank_ifsc || '').trim();
    const acct = (form.bank_account || '').trim();
    const type = form.account_type || '';
    if (!IFSC_RE.test(ifsc)) return 'Enter a valid IFSC code (e.g. HDFC0001234).';
    if (!form.bank_name || !form.bank_branch) return 'Bank Name and Branch could not be fetched for this IFSC code.';
    if (!(form.account_holder_name || '').trim()) return 'Account Holder Name is required.';
    if (!/^\d{9,18}$/.test(acct)) return 'Account Number must be 9 to 18 digits.';
    if (!type) return 'Please select the Account Type.';
    if (type === 'Other (Specify)') return 'Please specify the Account Type.';
    const upi = (form.upi_id || '').trim();
    if (upi && !/^[\w.-]{2,}@[A-Za-z]{2,}$/.test(upi)) return 'Enter a valid UPI ID (e.g. business@upi).';
    return '';
  };

  const submitWithPopup = async (section, successMsg) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = { section };
      SECTION_FIELDS[section].forEach((k) => { body[k] = form[k] ?? ''; });
      await api('/client/change-requests', { method: 'POST', body });
      load(); setPopup(successMsg);
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  const numCfg = (key) => {
    const cfg = Object.fromEntries(NUMBERING_PROPS.map((p) => [p, form[`${key}_${p}`] ?? '']));
    if (!cfg.separator) cfg.separator = NUMBERING_DOCS.find(([k]) => k === key)?.[3] || '-';
    return cfg;
  };
  const setNum = (key, prop, value) => {
    set(`${key}_${prop}`, value);
    if (numErrors[`${key}_${prop}`]) setNumErrors((e) => ({ ...e, [`${key}_${prop}`]: undefined }));
  };

  const validateNumbering = () => {
    const errors = {};
    NUMBERING_DOCS.forEach(([key, label]) => {
      const c = numCfg(key);
      if (!String(c.prefix).trim()) errors[`${key}_prefix`] = `${label}: prefix is required.`;
      if (!['-', '/'].includes(c.separator)) errors[`${key}_separator`] = `${label}: separator must be - or /.`;
      if (!/^\d{1,9}$/.test(String(c.next_number)) || Number(c.next_number) < 1) errors[`${key}_next_number`] = `${label}: next number must be a positive number.`;
    });
    setNumErrors(errors);
    return Object.values(errors)[0] || '';
  };

  const submitNumbering = async () => {
    const problem = validateNumbering();
    if (problem) { setMsg(''); setErr(problem); return; }
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = { section: 'numbering' };
      SECTION_FIELDS.numbering.forEach((k) => { body[k] = form[k] ?? ''; });
      await api('/client/change-requests', { method: 'POST', body });
      load();
      setPopup('Document Numbering & Prefix request submitted successfully.');
    } catch (ex) {
      const fieldErrors = ex.data?.errors;
      if (fieldErrors) setNumErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      setErr(ex.message);
    } finally { setBusy(false); }
  };

  const submitBranding = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = { section: 'branding' };
      SECTION_FIELDS.branding.forEach((k) => { body[k] = form[k] ?? ''; });
      await api('/client/change-requests', { method: 'POST', body });
      load();
      setPopup('Invoice Branding request submitted successfully.');
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="bp-section-wrap">
      <div style={{ fontSize: 12, color: 'var(--bp-muted)', fontWeight: 600 }}>
        <Link to="/portal" style={{ color: 'var(--bp-blue)', textDecoration: 'none' }}>Client Portal</Link>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        <span>Settings</span>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>›</span>
        <span style={{ color: '#0f172a', fontWeight: 700 }}>{TABS.find(t => t.key === activeTab)?.label}</span>
      </div>

      <div className="bp-section-head">
        <div>
          <div className="bp-section-kicker">Settings</div>
          <p className="bp-section-desc">Manage your billing and invoice preferences.</p>
        </div>
        <div className="bs-warn" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 16px', maxWidth: 340 }}>
          <svg width="16" height="16" viewBox="0 1 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9.5" x2="12" y2="13.5"/><line x1="12" y1="17.2" x2="12.01" y2="17.2"/></svg>
          <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>
            Changes require administrator approval before they appear on invoices.
          </span>
        </div>
      </div>

      <nav className="bp-uline-tabs">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} type="button"
            className={`bp-uline-tab${activeTab === key ? ' active' : ''}`}
            onClick={(e) => { setActiveTab(key); e.currentTarget.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }}>
            <Icon /> {label}
          </button>
        ))}
      </nav>

      {msg && <p className="bp-alert bp-alert-success">{msg}</p>}
      {err && <p className="bp-alert bp-alert-error">{err}</p>}

      {popup && (
        <div className="bp-modal-backdrop" role="presentation" onClick={() => setPopup('')}>
          <div className="bp-modal" role="dialog" aria-modal="true" aria-label="Request submitted" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="bp-modal-title" style={{ marginBottom: 6 }}>{popup}</p>
            <p className="bp-modal-text" style={{ marginBottom: 18 }}>It is now waiting for administrator approval. Your current invoices keep using the approved details until then.</p>
            <button type="button" className="bp-btn bp-btn-primary" style={{ minWidth: 120 }} onClick={() => setPopup('')} autoFocus>OK</button>
          </div>
        </div>
      )}

      {/* ── Invoice Branding Tab ─────────────────────────────── */}
      {activeTab === 'branding' && (
        <div className="bp-card">
          <h3 style={{ marginTop: 0, marginBottom: 4, color: '#0f2a5f', fontSize: 18, fontWeight: 800 }}>A. Invoice Branding</h3>
          <p className="bp-section-desc" style={{ marginBottom: 20 }}>
            Customize your invoice appearance by uploading your business branding and setting invoice signatory details, terms &amp; conditions, and other information that will appear on your invoices.
          </p>

          {/* Assets row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
            {ASSETS.map(({ field, pathKey, label, recSize }) => (
              <AssetUploadBox key={field} field={field} label={label} recSize={recSize}
                path={form[pathKey]} approvedPath={approved?.[pathKey]} submitted={!!sections?.branding?.pending} onUpload={upload} />
            ))}
          </div>

          {/* Signatory Name + Terms */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28, marginBottom: 8, alignItems: 'start' }}>
            <label>
              <strong className="bp-field-title" style={{ color: '#0f2a5f', fontWeight: 800 }}>Signatory Name</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#2563eb" stroke="#2563eb" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>
                <input className="bp-input" style={{ flex: 1 }} value={form.signatory_name || ''}
                  onChange={(e) => set('signatory_name', e.target.value)}
                  placeholder="Enter the name of the person authorized to sign the invoice." />
              </div>
              <p style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 4, marginBottom: 0 }}>Enter the name of the person authorized to sign the invoice.</p>
            </label>
            <label>
              <strong className="bp-field-title" style={{ color: '#0f2a5f', fontWeight: 800 }}>Terms &amp; Conditions</strong>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" style={{ flexShrink: 0, marginTop: 6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                <textarea className="bp-input" rows={4} style={{ flex: 1, resize: 'vertical' }}
                  value={form.terms_conditions || ''}
                  onChange={(e) => set('terms_conditions', e.target.value)}
                  placeholder="Enter the Terms & Conditions that should appear on the invoice." />
              </div>
            </label>
          </div>

          <ApprovalFooter
            data={sections?.branding}
            busy={busy} dirty={isBrandingDirty} onSubmit={submitBranding} />
        </div>
      )}

      {/* ── Bank Details Tab ─────────────────────────────────── */}
      {activeTab === 'bank' && (
        <div className="bp-card">
          {/* Header */}
          <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: '1.5px solid #e8f0fe' }}>
            <h3 style={{ margin: 0, color: '#0f2a5f', fontSize: 18, fontWeight: 800 }}>Bank Details</h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>Manage and maintain the business bank account details that will be used for transactions and displayed on invoices.</p>
          </div>

          {/* IFSC Auto-Verification Block */}
          <style>{`
            @keyframes ifsc-slide-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes ifsc-pop { 0% { opacity: 0; transform: scale(0.75); } 60% { transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
            @keyframes ifsc-success-in { 0% { opacity: 0; transform: translateY(4px) scale(0.95); } 60% { transform: translateY(-1px) scale(1.02); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes ifsc-err-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-5px); } 40%,80% { transform: translateX(5px); } }
            @keyframes ifsc-spin { to { transform: rotate(360deg); } }
            @keyframes ifsc-field-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
          <div style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #eff6ff 100%)', border: '1.5px solid #bfdbfe', borderRadius: 14, padding: '16px 18px 18px', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#dbeafe" stroke="#2563eb"/></svg>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1d4ed8', letterSpacing: 0.6, textTransform: 'uppercase' }}>IFSC Auto-Verification</span>
              <span style={{ marginLeft: 4, fontSize: 11, color: '#3b82f6', fontWeight: 500 }}>— Bank Name &amp; Branch are auto-filled</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
              {/* IFSC Code */}
              <label>
                <strong className="bp-field-title">IFSC Code</strong>
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <input className="bp-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36, background: '#fff', transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s', ...(ifscErr ? { borderColor: '#dc2626', background: '#fff8f8', boxShadow: '0 0 0 3px rgba(220,38,38,0.1)' } : ifscOk ? { borderColor: '#86efac', boxShadow: '0 0 0 3px rgba(22,163,74,0.1)' } : {}) }}
                    value={form.bank_ifsc || ''}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                      setForm((f) => ({ ...f, bank_ifsc: v, ...(v.length !== 11 ? { bank_name: '', bank_branch: '' } : {}) }));
                      setIfscErr(''); setIfscOk('');
                      if (v.length === 11) fetchIfsc(v);
                    }}
                    placeholder="e.g. HDFC0001234" maxLength={11} />
                  <button type="button" aria-label="Verify IFSC" title="Verify IFSC"
                    disabled={ifscLoading || (form.bank_ifsc || '').length !== 11}
                    onClick={() => fetchIfsc((form.bank_ifsc || '').toUpperCase())}
                    style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: '0 4px', cursor: ifscLoading ? 'wait' : 'pointer', color: '#3b82f6', transition: 'color 0.2s' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={ifscLoading ? { animation: 'ifsc-spin 0.8s linear infinite' } : {}}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  </button>
                </div>
                {ifscLoading && <p style={{ fontSize: 11.5, color: '#3b82f6', marginTop: 4, marginBottom: 0, fontWeight: 600, animation: 'ifsc-slide-up 0.25s ease' }}>Verifying…</p>}
                {ifscOk && (
                  <p key={ifscOk} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#14532d', fontWeight: 700, marginTop: 6, marginBottom: 0, background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', borderRadius: 8, padding: '6px 10px', animation: 'ifsc-success-in 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" /></svg>
                    {ifscOk}
                  </p>
                )}
                {ifscErr && (
                  <p key={ifscErr} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#991b1b', fontWeight: 600, marginTop: 6, marginBottom: 0, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '6px 10px', animation: 'ifsc-err-shake 0.4s ease' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#dc2626" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><rect x="11" y="6" width="2" height="7" fill="#fff" /><rect x="11" y="15" width="2" height="2.4" fill="#fff" /></svg>
                    {ifscErr}
                  </p>
                )}
              </label>

              {/* Bank Name — read-only, auto-fetched */}
              <label>
                <strong className="bp-field-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Bank Name
                  {ifscOk && <span key="bn-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '2px 8px', animation: 'ifsc-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Auto Fetched
                  </span>}
                </strong>
                <div key={form.bank_name} style={{ position: 'relative', marginTop: 6, animation: form.bank_name ? 'ifsc-field-in 0.35s ease' : 'none' }}>
                  <input className="bp-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 34, background: 'linear-gradient(135deg, #eff6ff, #f0f7ff)', color: '#1e40af', fontWeight: 600, cursor: 'not-allowed', border: '1.5px solid #bfdbfe', transition: 'border-color 0.3s, box-shadow 0.3s', ...(ifscOk ? { boxShadow: '0 0 0 3px rgba(22,163,74,0.08)' } : {}) }}
                    value={form.bank_name || ''} readOnly tabIndex={-1} placeholder="—" />
                  <span style={{ position: 'absolute', right: 11, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  </span>
                </div>
              </label>

              {/* Branch — read-only, auto-fetched */}
              <label>
                <strong className="bp-field-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Branch
                  {ifscOk && <span key="br-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '2px 8px', animation: 'ifsc-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.07s both' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Auto Fetched
                  </span>}
                </strong>
                <div key={form.bank_branch} style={{ position: 'relative', marginTop: 6, animation: form.bank_branch ? 'ifsc-field-in 0.35s ease 0.07s both' : 'none' }}>
                  <input className="bp-input" style={{ width: '100%', boxSizing: 'border-box', paddingRight: 34, background: 'linear-gradient(135deg, #eff6ff, #f0f7ff)', color: '#1e40af', fontWeight: 600, cursor: 'not-allowed', border: '1.5px solid #bfdbfe', transition: 'border-color 0.3s, box-shadow 0.3s', ...(ifscOk ? { boxShadow: '0 0 0 3px rgba(22,163,74,0.08)' } : {}) }}
                    value={form.bank_branch || ''} readOnly tabIndex={-1} placeholder="—" />
                  <span style={{ position: 'absolute', right: 11, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Account Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 8 }}>
            {/* Account Number */}
            <label>
              <strong className="bp-field-title">Account Number</strong>
              <input className="bp-input" style={{ marginTop: 6 }} value={form.bank_account || ''}
                onChange={(e) => set('bank_account', e.target.value.replace(/\D/g, '').slice(0, 18))}
                inputMode="numeric" placeholder="Enter account number (9 to 18 digits)" />
            </label>

            {/* Account Holder Name */}
            <label>
              <strong className="bp-field-title">Account Holder Name</strong>
              <input className="bp-input" style={{ marginTop: 6 }} value={form.account_holder_name || ''}
                onChange={(e) => set('account_holder_name', e.target.value)}
                placeholder="Name on bank account" />
            </label>

            {/* Account Type */}
            <label>
              <strong className="bp-field-title">Account Type</strong>
              <select className="bp-input" style={{ marginTop: 6 }}
                value={(form.account_type || '').startsWith('Other') ? 'Other (Specify)' : (form.account_type || '')}
                onChange={(e) => set('account_type', e.target.value)}>
                <option value="">Select account type</option>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {(form.account_type || '').startsWith('Other') && (
                <input className="bp-input" style={{ marginTop: 8 }} maxLength={30} placeholder="Specify account type"
                  value={(form.account_type || '').startsWith('Other - ') ? form.account_type.slice(8) : ''}
                  onChange={(e) => set('account_type', e.target.value ? `Other - ${e.target.value}` : 'Other (Specify)')} />
              )}
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
            onSubmit={() => {
              const problem = validateBank();
              if (problem) { setMsg(''); setErr(problem); return; }
              submitWithPopup('bank', 'Bank Details request submitted successfully.');
            }} />
        </div>
      )}

      {/* ── Document Numbering Tab ───────────────────────────── */}
      {activeTab === 'numbering' && (
        <div className="bp-card">
          <h3 style={{ marginTop: 0, marginBottom: 4, color: '#0f2a5f', fontSize: 18, fontWeight: 800 }}>Document Numbering &amp; Prefix Configuration</h3>
          <p className="bp-section-desc" style={{ marginBottom: 0 }}>Configure prefixes for your documents. Numbering will be automatically generated by the system.</p>

          <div className="dn-layout">
            <div className="dn-table-wrap">
              <table className="dn-table">
                <thead>
                  <tr>
                    <th>Document Type</th>
                    <th>Prefix</th>
                    <th>Separator</th>
                    <th>Next Number</th>
                    <th>Prefix Position</th>
                    <th>Number Format (Preview)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {NUMBERING_DOCS.map(([key, label, defPrefix, defSep]) => {
                    const c = numCfg(key);
                    const active = c.status !== 'inactive';
                    const fieldErr = (prop) => numErrors[`${key}_${prop}`];
                    return (
                      <tr key={key} className={sampleDoc === key ? 'dn-row-selected' : ''}>
                        <td className="dn-type">{label}</td>
                        <td data-label="Prefix">
                          <input className={`bp-input dn-input${fieldErr('prefix') ? ' dn-invalid' : ''}`} value={c.prefix} maxLength={20}
                            aria-label={`${label} prefix`} placeholder={defPrefix}
                            onChange={(e) => setNum(key, 'prefix', e.target.value)} />
                        </td>
                        <td data-label="Separator">
                          <input className={`bp-input dn-input dn-sep${fieldErr('separator') ? ' dn-invalid' : ''}`}
                            value={form[`${key}_separator`] ?? ''} maxLength={1}
                            aria-label={`${label} separator`} placeholder={defSep}
                            onChange={(e) => setNum(key, 'separator', e.target.value.replace(/[^-/]/g, '').slice(-1))}
                            onBlur={() => { if (!form[`${key}_separator`]) setNum(key, 'separator', defSep); }} />
                        </td>
                        <td data-label="Next Number">
                          <input className={`bp-input dn-input dn-next${fieldErr('next_number') ? ' dn-invalid' : ''}`} value={c.next_number} maxLength={9}
                            inputMode="numeric" aria-label={`${label} next number`} placeholder="01"
                            onChange={(e) => setNum(key, 'next_number', e.target.value.replace(/\D/g, ''))} />
                        </td>
                        <td data-label="Prefix Position">
                          <div className="dn-radios">
                            {[['first', 'Prefix First'], ['last', 'Prefix Last']].map(([val, text]) => (
                              <label key={val} className={c.prefix_position === val || (!c.prefix_position && val === 'first') ? 'on' : ''}>
                                <input type="radio" name={`dn-pos-${key}`}
                                  checked={(c.prefix_position || 'first') === val}
                                  onChange={() => setNum(key, 'prefix_position', val)} />
                                {text}
                              </label>
                            ))}
                          </div>
                        </td>
                        <td data-label="Number Format"><span className="dn-preview">{formatDocNumber(c)}</span></td>
                        <td data-label="Status">
                          <button type="button" role="switch" aria-checked={active} aria-label={`${label} status`}
                            className={`dn-switch${active ? ' on' : ''}`}
                            onClick={() => setNum(key, 'status', active ? 'inactive' : 'active')}>
                            <span />
                          </button>
                        </td>
                        <td data-label="Actions">
                          <button type="button" className="dn-sample-btn" onClick={() => setSampleDoc(key)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            View Sample
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {Object.values(numErrors).some(Boolean) && (
                <ul className="dn-errors">
                  {Object.values(numErrors).filter(Boolean).map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
            </div>

            <aside className="dn-panel">
              <h4>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                Format Preview
              </h4>
              <label className="dn-panel-label">Document Type</label>
              <select className="bp-input" value={sampleDoc} onChange={(e) => setSampleDoc(e.target.value)}>
                {NUMBERING_DOCS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <div className="dn-panel-card">
                <small>{NUMBERING_DOCS.find(([k]) => k === sampleDoc)?.[1].toUpperCase()}</small>
                <strong>{formatDocNumber(numCfg(sampleDoc))}</strong>
                <span>Next number will be</span>
                <em>{formatDocNumber(numCfg(sampleDoc), 1)}</em>
              </div>
            </aside>
          </div>

          {/* Important Information box */}
          <div className="ly-info dn-info" style={{ background: '#eaf3ff', border: '1px solid #cfe2ff', borderRadius: 10, padding: '16px 20px', marginBottom: 8, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="12" y1="11" x2="12" y2="17" /><line x1="12" y1="7" x2="12.01" y2="7" /></svg>
            </span>
            <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 13.5, color: '#1d4ed8', marginBottom: 6 }}>Important Information</strong>
            <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', fontSize: 12.5, color: '#1e3a8a', lineHeight: 1.75 }}>
              <li>Document numbers will be automatically generated based on the configured prefix and sequence.</li>
              <li>You only need to enter the prefix. The system will maintain the numbering automatically.</li>
              <li>The prefix position will determine whether the prefix appears before or after the number.</li>
              <li>Numbering will continue sequentially for each document type.</li>
              <li>Duplicate document numbers will not be allowed.</li>
              {NUMBERING_DOCS.filter(([k]) => approved?.numbering_types?.[k] === 'manual').length > 0 && (
                <li>
                  Manual numbering is enabled for {NUMBERING_DOCS.filter(([k]) => approved?.numbering_types?.[k] === 'manual').map(([, l]) => l).join(', ')}
                  {' '}— you enter the document number while creating the document.
                </li>
              )}
            </ul>
            </div>
          </div>

          <ApprovalFooter
            data={sections?.numbering}
            busy={busy}
            dirty={isSectionDirty('numbering')}
            onSubmit={submitNumbering} />
        </div>
      )}

      {/* ── Layouts Tab ─────────────────────────────────────── */}
      {activeTab === 'layouts' && <LayoutsTab approved={approved} sections={sections} onSubmitted={(m) => { load(); setPopup(m); }} />}

      <div className="bs-hist" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Link to="/portal/settings/history" className="bp-btn bp-btn-outline"
          style={{ height: 40, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          View Request History
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
    <div className="bp-section-wrap rh-page">
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

      <div className="bp-toolbar rh-tools" style={{ marginBottom: 0 }}>
        <select className="bp-select" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All Sections</option>
          {Object.entries(SECTION_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {!data ? <LoadingBlock /> : (
        <div className="rh-card">
        <table className="bp-table rh-table">
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
        </div>
      )}
    </div>
  );
}

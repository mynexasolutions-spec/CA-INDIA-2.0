import React from 'react';

/**
 * SVG Icon helper props matching Admin Billing mockup.
 */
const ICON_BASE_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function TaxInvoiceIcon(props) {
  return React.createElement(
    'svg',
    { ...ICON_BASE_PROPS, ...props },
    React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
    React.createElement('polyline', { points: '14 2 14 8 20 8' }),
    React.createElement('line', { x1: '16', y1: '13', x2: '8', y2: '13' }),
    React.createElement('line', { x1: '16', y1: '17', x2: '8', y2: '17' }),
    React.createElement('polyline', { points: '10 9 9 9 8 9' })
  );
}

export function BillOfSupplyIcon(props) {
  return React.createElement(
    'svg',
    { ...ICON_BASE_PROPS, ...props },
    React.createElement('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }),
    React.createElement('line', { x1: '8', y1: '9', x2: '16', y2: '9' }),
    React.createElement('line', { x1: '8', y1: '13', x2: '16', y2: '13' }),
    React.createElement('line', { x1: '8', y1: '17', x2: '13', y2: '17' })
  );
}

export function DebitNoteIcon(props) {
  return React.createElement(
    'svg',
    { ...ICON_BASE_PROPS, ...props },
    React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
    React.createElement('polyline', { points: '14 2 14 8 20 8' }),
    React.createElement('line', { x1: '12', y1: '12', x2: '12', y2: '18' }),
    React.createElement('line', { x1: '9', y1: '15', x2: '15', y2: '15' })
  );
}

export function CreditNoteIcon(props) {
  return React.createElement(
    'svg',
    { ...ICON_BASE_PROPS, ...props },
    React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
    React.createElement('polyline', { points: '14 2 14 8 20 8' }),
    React.createElement('line', { x1: '9', y1: '15', x2: '15', y2: '15' })
  );
}

export function QuotationIcon(props) {
  return React.createElement(
    'svg',
    { ...ICON_BASE_PROPS, ...props },
    React.createElement('path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }),
    React.createElement('rect', { x: '8', y: '2', width: '8', height: '4', rx: '1', ry: '1' }),
    React.createElement('path', { d: 'M9 12h6' }),
    React.createElement('path', { d: 'M9 16h6' })
  );
}

export function DeliveryChallanIcon(props) {
  return React.createElement(
    'svg',
    { ...ICON_BASE_PROPS, ...props },
    React.createElement('rect', { x: '1', y: '3', width: '15', height: '13', rx: '1' }),
    React.createElement('polygon', { points: '16 8 20 8 23 11 23 16 16 16 16 8' }),
    React.createElement('circle', { cx: '5.5', cy: '18.5', r: '2.5' }),
    React.createElement('circle', { cx: '18.5', cy: '18.5', r: '2.5' })
  );
}

/**
 * 6 Commercial document types in exact PDF Mockup p31 order.
 * ONE unique color per type:
 * - Tax Invoice: Blue (#2563eb)
 * - Bill of Supply: Green (#10b981)
 * - Debit Note: Orange (#f97316)
 * - Credit Note: Red (#ef4444)
 * - Quotation: Purple (#8b5cf6)
 * - Delivery Challan: Cyan (#06b6d4)
 */
export const BILLING_DOC_TYPES = [
  {
    key: 'tax_invoice',
    slug: 'tax-invoice',
    label: 'Tax Invoice',
    pluralLabel: 'Tax Invoices',
    shortLabel: 'Invoice',
    shortPlural: 'Invoices',
    numberLabel: 'Invoice No.',
    dateLabel: 'Invoice Date',
    statusLabel: 'Invoice Status',
    searchPlaceholder: 'Search by Invoice No. / Customer Name / GSTIN...',
    subtitle: 'View and manage all tax invoices for this client.',
    color: '#2563eb',
    bg: '#eff6ff',
    borderColor: '#dbeafe',
    iconBg: '#2563eb',
    countColor: '#0f172a',
    Icon: TaxInvoiceIcon,
  },
  {
    key: 'bill_of_supply',
    slug: 'bill-of-supply',
    label: 'Bill of Supply',
    pluralLabel: 'Bills of Supply',
    shortLabel: 'Bill',
    shortPlural: 'Bills',
    numberLabel: 'Bill No.',
    dateLabel: 'Bill Date',
    statusLabel: 'Bill Status',
    searchPlaceholder: 'Search by Bill No. / Customer Name / GSTIN...',
    subtitle: 'View and manage all bills of supply for this client.',
    color: '#10b981',
    bg: '#ecfdf5',
    borderColor: '#d1fae5',
    iconBg: '#10b981',
    countColor: '#059669',
    Icon: BillOfSupplyIcon,
  },
  {
    key: 'debit_note',
    slug: 'debit-note',
    label: 'Debit Note',
    pluralLabel: 'Debit Notes',
    shortLabel: 'Debit Note',
    shortPlural: 'Debit Notes',
    numberLabel: 'Debit Note No.',
    dateLabel: 'Debit Note Date',
    statusLabel: 'Debit Note Status',
    searchPlaceholder: 'Search by Debit Note No. / Customer Name / GSTIN...',
    subtitle: 'View and manage all debit notes for this client.',
    color: '#f97316',
    bg: '#fff7ed',
    borderColor: '#ffedd5',
    iconBg: '#f97316',
    countColor: '#0f172a',
    Icon: DebitNoteIcon,
  },
  {
    key: 'credit_note',
    slug: 'credit-note',
    label: 'Credit Note',
    pluralLabel: 'Credit Notes',
    shortLabel: 'Credit Note',
    shortPlural: 'Credit Notes',
    numberLabel: 'Credit Note No.',
    dateLabel: 'Credit Note Date',
    statusLabel: 'Credit Note Status',
    searchPlaceholder: 'Search by Credit Note No. / Customer Name / GSTIN...',
    subtitle: 'View and manage all credit notes for this client.',
    color: '#ef4444',
    bg: '#fef2f2',
    borderColor: '#fee2e2',
    iconBg: '#ef4444',
    countColor: '#0f172a',
    Icon: CreditNoteIcon,
  },
  {
    key: 'quotation',
    slug: 'quotation',
    label: 'Quotation',
    pluralLabel: 'Quotations',
    shortLabel: 'Quotation',
    shortPlural: 'Quotations',
    numberLabel: 'Quotation No.',
    dateLabel: 'Quotation Date',
    statusLabel: 'Quotation Status',
    searchPlaceholder: 'Search by Quotation No. / Customer Name / GSTIN...',
    subtitle: 'View and manage all quotations for this client.',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    borderColor: '#ede9fe',
    iconBg: '#8b5cf6',
    countColor: '#0f172a',
    Icon: QuotationIcon,
  },
  {
    key: 'delivery_challan',
    slug: 'delivery-challan',
    label: 'Delivery Challan',
    pluralLabel: 'Delivery Challans',
    shortLabel: 'Challan',
    shortPlural: 'Challans',
    numberLabel: 'Challan No.',
    dateLabel: 'Challan Date',
    statusLabel: 'Challan Status',
    searchPlaceholder: 'Search by Challan No. / Customer Name / GSTIN...',
    subtitle: 'View and manage all delivery challans for this client.',
    color: '#06b6d4',
    bg: '#ecfeff',
    borderColor: '#cffafe',
    iconBg: '#06b6d4',
    countColor: '#0f172a',
    Icon: DeliveryChallanIcon,
  },
];

export const DOC_TYPE_KEYS = BILLING_DOC_TYPES.map((t) => t.key);
export const DOC_TYPE_SLUGS = BILLING_DOC_TYPES.map((t) => t.slug);

export const DOC_TYPE_BY_KEY = BILLING_DOC_TYPES.reduce((acc, t) => {
  acc[t.key] = t;
  return acc;
}, {});

export const DOC_TYPE_BY_SLUG = BILLING_DOC_TYPES.reduce((acc, t) => {
  acc[t.slug] = t;
  return acc;
}, {});

/**
 * Resolve document type configuration by key or slug (supports singular, plural, key, or slug).
 */
export function getDocTypeConfig(keyOrSlug) {
  if (!keyOrSlug) return null;
  const raw = String(keyOrSlug).toLowerCase().trim();
  if (DOC_TYPE_BY_KEY[raw]) return DOC_TYPE_BY_KEY[raw];
  if (DOC_TYPE_BY_SLUG[raw]) return DOC_TYPE_BY_SLUG[raw];

  const normalizedSlug = raw.replace(/_/g, '-');
  const normalizedKey = raw.replace(/-/g, '_');

  if (DOC_TYPE_BY_SLUG[normalizedSlug]) return DOC_TYPE_BY_SLUG[normalizedSlug];
  if (DOC_TYPE_BY_KEY[normalizedKey]) return DOC_TYPE_BY_KEY[normalizedKey];

  // Plural mappings e.g. tax-invoices -> tax-invoice, bills-of-supply -> bill-of-supply
  const pluralMap = {
    'tax-invoices': 'tax-invoice',
    'tax_invoices': 'tax_invoice',
    'bills-of-supply': 'bill-of-supply',
    'bills_of_supply': 'bill_of_supply',
    'debit-notes': 'debit-note',
    'debit_notes': 'debit_note',
    'credit-notes': 'credit-note',
    'credit_notes': 'credit_note',
    'quotations': 'quotation',
    'delivery-challans': 'delivery-challan',
    'delivery_challans': 'delivery_challan',
  };

  const alias = pluralMap[raw] || pluralMap[normalizedSlug] || pluralMap[normalizedKey];
  if (alias) {
    return DOC_TYPE_BY_SLUG[alias] || DOC_TYPE_BY_KEY[alias] || null;
  }

  return null;
}

/**
 * Shared helper to compute user-facing disabled reasons for document actions:
 * 'edit', 'delete', 'cancel', 'edit_creation_date'.
 * Returns empty string '' if the action is enabled.
 */
export function getDocumentActionDisabledReason(action, docData, docTypeParam = null) {
  if (!docData) return '';

  const doc = docData.document || docData;
  const flags = docData.flags || {};
  const gst = docData.gst || {};
  const docTypeKey = docTypeParam || doc.type || 'tax_invoice';

  const isDeleted = doc.status === 'deleted' || Boolean(doc.deleted_at);
  const isCancelled = doc.status === 'cancelled';
  const isConverted = Boolean(doc.converted_document_id);
  const isActive = ['issued', 'paid', 'partial'].includes(doc.status);
  const isFiled = gst.status === 'Filed' || Boolean(flags.is_locked);
  const isAttached = Boolean(flags.is_attached);
  const isReferenced = Boolean(flags.is_referenced);
  const refDoc = flags.referencing_document;

  const refMsg = refDoc
    ? `This document has a ${refDoc.type === 'credit_note' ? 'Credit Note' : refDoc.type === 'debit_note' ? 'Debit Note' : refDoc.type === 'amendment' ? 'Amendment' : 'document'} (${refDoc.number}) issued against it — delete those first.`
    : 'This document has a Credit Note, Debit Note, or Amendment issued against it — delete those first.';

  if (action === 'edit') {
    if (isDeleted) return 'Deleted documents cannot be edited.';
    if (docTypeKey !== 'tax_invoice') return 'Only Tax Invoices can be edited.';
    if (isConverted) return 'Converted quotations cannot be edited.';
    if (isCancelled) return 'Cancelled documents cannot be edited.';
    if (!isActive) return 'Only active documents can be edited.';
    if (isFiled) return "GST Return for this document's period has already been filed. This document cannot be edited.";
    if (isAttached) return 'This document is attached to a GST Filing Request and cannot be edited.';
    if (isReferenced) return refMsg;
    if (flags.can_edit === false) return 'This document cannot be edited.';
    return '';
  }

  if (action === 'delete') {
    if (isDeleted) return 'This document is already deleted.';
    if (!isActive && !isCancelled) return 'Only active or cancelled documents can be deleted.';
    if (isFiled) return "GST Return for this document's period has already been filed. This document cannot be deleted.";
    if (isAttached) return 'This document is attached to a GST Filing Request and cannot be deleted.';
    if (isReferenced) return refMsg;
    if (flags.can_delete === false) return 'This document cannot be deleted.';
    return '';
  }

  if (action === 'cancel') {
    if (isDeleted) return 'Deleted documents cannot be cancelled.';
    if (isConverted) return 'A converted quotation cannot be cancelled.';
    if (isCancelled) return 'This document is already cancelled.';
    if (!isActive) return 'Only active documents can be cancelled.';
    if (isFiled) return "GST Return for this document's period has already been filed. This document cannot be cancelled.";
    if (flags.can_cancel === false) return 'This document cannot be cancelled.';
    return '';
  }

  if (action === 'edit_creation_date' || action === 'editDate') {
    if (isDeleted) return 'Deleted documents cannot have their creation date edited.';
    if (isConverted) return 'Converted quotations cannot have their creation date edited.';
    if (isCancelled) return 'Cancelled documents cannot have their creation date edited.';
    if (!isActive) return 'Only active documents can have their creation date edited.';
    if (isFiled) return "GST Return for this document's period has already been filed. Creation date cannot be edited.";
    if (flags.can_edit_creation_date === false) return 'Creation date cannot be edited.';
    return '';
  }

  return '';
}


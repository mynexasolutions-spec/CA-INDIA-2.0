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
 * Resolve document type configuration by key or slug.
 */
export function getDocTypeConfig(keyOrSlug) {
  if (!keyOrSlug) return null;
  return DOC_TYPE_BY_KEY[keyOrSlug] || DOC_TYPE_BY_SLUG[keyOrSlug] || null;
}

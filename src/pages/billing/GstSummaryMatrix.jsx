import { moneyFixed as money } from './billingUtils';
import { billingMode } from './billingProfile';

export const GST_MATRIX_ROWS = [
  ['taxable_value', 'Total Taxable Value'],
  ['cgst', 'CGST Amount'],
  ['sgst', 'SGST / UTGST Amount'],
  ['igst', 'IGST Amount'],
  ['total_invoice_value', 'Total Gross Value'],
];

/** Always 4 columns — structure stays the same for Regular and Composition. */
export const GST_MATRIX_COLS = [
  ['tax_invoice', 'Tax Invoices'],
  ['bill_of_supply', 'Bills of Supply'],
  ['debit_note', 'Debit Notes'],
  ['credit_note', 'Credit Notes'],
];

const EMPTY_BUCKET = {
  taxable_value: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  total_invoice_value: 0,
};

function emptyBucket() {
  return { ...EMPTY_BUCKET };
}

/**
 * Display logic by GST dealer type:
 * - Regular: Tax Invoices, Debit Notes, Credit Notes = actual; Bill of Supply = ₹0
 * - Composition: Bill of Supply, Credit Notes = actual; Tax Invoices, Debit Notes = ₹0
 * - Retail / unknown: show actuals for all columns present
 */
export function applyDealerGstMatrix(matrix, profile) {
  const m = {
    tax_invoice: { ...emptyBucket(), ...(matrix?.tax_invoice || {}) },
    bill_of_supply: { ...emptyBucket(), ...(matrix?.bill_of_supply || {}) },
    debit_note: { ...emptyBucket(), ...(matrix?.debit_note || {}) },
    credit_note: { ...emptyBucket(), ...(matrix?.credit_note || {}) },
  };

  const mode = billingMode(profile);
  if (mode === 'regular') {
    m.bill_of_supply = emptyBucket();
  } else if (mode === 'composition') {
    m.tax_invoice = emptyBucket();
    m.debit_note = emptyBucket();
  }

  return m;
}

/** Normalize API payload into 4-column matrix. */
export function resolveGstMatrix(payload, profile = null) {
  const data = payload?.data ?? payload ?? {};
  let raw = null;

  if (data.matrix && typeof data.matrix === 'object') raw = data.matrix;
  else if (data.gst_matrix && typeof data.gst_matrix === 'object') raw = data.gst_matrix;
  else if (data.tax_invoice || data.bill_of_supply || data.debit_note || data.credit_note) {
    raw = {
      tax_invoice: data.tax_invoice || {},
      bill_of_supply: data.bill_of_supply || {},
      debit_note: data.debit_note || {},
      credit_note: data.credit_note || {},
    };
  } else {
    // Legacy flat summary → tax invoice column only
    raw = {
      tax_invoice: {
        taxable_value: data.taxable ?? data.taxable_value ?? 0,
        cgst: data.cgst ?? 0,
        sgst: data.sgst ?? 0,
        igst: data.igst ?? 0,
        total_invoice_value: data.total ?? data.total_invoice_value ?? 0,
      },
      bill_of_supply: {},
      debit_note: {},
      credit_note: {},
    };
  }

  return applyDealerGstMatrix(raw, profile);
}

export default function GstSummaryMatrix({ matrix, title = 'GST Summary', profile = null }) {
  const m = profile ? applyDealerGstMatrix(matrix, profile) : {
    tax_invoice: { ...emptyBucket(), ...(matrix?.tax_invoice || {}) },
    bill_of_supply: { ...emptyBucket(), ...(matrix?.bill_of_supply || {}) },
    debit_note: { ...emptyBucket(), ...(matrix?.debit_note || {}) },
    credit_note: { ...emptyBucket(), ...(matrix?.credit_note || {}) },
  };

  return (
    <div>
      {title ? <h3 style={{ marginTop: 0, color: 'var(--bp-navy)' }}>{title}</h3> : null}
      <div style={{ overflowX: 'auto' }}>
        <table className="bp-table bp-gst-matrix">
          <thead>
            <tr>
              <th />
              {GST_MATRIX_COLS.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GST_MATRIX_ROWS.map(([key, label]) => (
              <tr key={key}>
                <td><strong>{label}</strong></td>
                {GST_MATRIX_COLS.map(([colKey]) => (
                  <td key={colKey}>{money(m[colKey]?.[key] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

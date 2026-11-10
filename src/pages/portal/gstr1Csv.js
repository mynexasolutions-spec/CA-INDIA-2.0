import { stateNameByCode } from '../../data/indianStates';
import { uqcLabel } from './gstUqc';
import { B2CL_THRESHOLD, buildItems, docValue, group, posCode, r2, usableDocs } from './gstr1Json';

/**
 * "Predefined CSV" exports — the exact CSV templates of the GST offline tool, so each file can be
 * imported there as-is (no BOM, CRLF line endings, dd-mmm-yy dates, "27-Maharashtra" places of supply).
 *
 *   B2B tab → "b2b,sez,de.csv" (tax invoices)   +  "cdnr.csv"  (credit / debit notes)
 *   B2C tab → "b2cs.csv"                        +  "b2cl.csv" / "cdnur.csv" (inter-state > ₹2.5 lakh)
 *   Summary → "hsn.csv"
 *
 * One row per document per GST rate. Files with no rows are not produced (except the tab's main file).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The offline tool's own spelling for the states whose name differs from our master list.
const TOOL_STATE_NAMES = {
  '01': 'Jammu & Kashmir',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '28': 'Andhra Pradesh(Old)',
  '35': 'Andaman & Nicobar Islands',
  '37': 'Andhra Pradesh',
};

/** 2026-10-31 → 31-Oct-26 (same as the template: day without padding). */
function csvDate(d) {
  const [y, m, day] = String(d || '').slice(0, 10).split('-');
  const mi = Number(m) - 1;
  return y && MONTHS[mi] && day ? `${Number(day)}-${MONTHS[mi]}-${y.slice(2)}` : '';
}
const csvPos = (code) => (code ? `${code}-${TOOL_STATE_NAMES[code] || stateNameByCode(code)}` : '');
const amt = (n) => String(r2(n));

/** Free text typed by users must not be able to run as a spreadsheet formula when the CSV is opened in Excel. */
const safeText = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; };

const cell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(headers, rows) {
  return `${[headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

const H_B2B = ['GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Applicable % of Tax Rate', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount'];
const H_CDNR = ['GSTIN/UIN of Recipient', 'Receiver Name', 'Note Number', 'Note Date', 'Note Type', 'Place Of Supply', 'Reverse Charge', 'Note Supply Type', 'Note Value', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount'];
const H_B2CS = ['Type', 'Place Of Supply', 'Rate', 'Applicable % of Tax Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'];
const H_B2CL = ['Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN', 'Sale from Bonded WH'];
const H_CDNUR = ['UR Type', 'Note Number', 'Note Date', 'Note Type', 'Place Of Supply', 'Note Value', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount'];
const H_HSN = ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount', 'Rate'];

/** @returns {{ filename: string, content: string }[]} the CSV files to download for this tab. */
export function buildGstr1PredefinedCsvs({ gstType, docs, stateCode }) {
  const usable = usableDocs(docs);
  const files = [];

  if (gstType === 'b2b') {
    const inv = [];
    const notes = [];
    usable.forEach((d) => {
      const ctin = d.customer?.gstin;
      if (!ctin) return;
      const pos = csvPos(posCode(d, stateCode));
      const rchrg = d.is_reverse_charge ? 'Y' : 'N';
      const name = safeText(d.customer?.name);
      buildItems(d).forEach(({ itm_det: it }) => {
        if (d.type === 'tax_invoice') {
          inv.push([ctin, name, d.number, csvDate(d.document_date), amt(docValue(d)), pos, rchrg, '', 'Regular B2B', '', it.rt, amt(it.txval), '']);
        } else {
          notes.push([ctin, name, d.number, csvDate(d.document_date), d.type === 'credit_note' ? 'C' : 'D', pos, rchrg, 'Regular B2B', amt(docValue(d)), '', it.rt, amt(it.txval), '']);
        }
      });
    });
    files.push({ filename: 'b2b,sez,de.csv', content: toCsv(H_B2B, inv) });
    if (notes.length) files.push({ filename: 'cdnr.csv', content: toCsv(H_CDNR, notes) });
    return files;
  }

  // B2C
  const b2cs = new Map();
  const b2cl = [];
  const cdnur = [];
  usable.forEach((d) => {
    const pos = posCode(d, stateCode);
    const large = Boolean(d.is_inter_state) && docValue(d) > B2CL_THRESHOLD;
    buildItems(d).forEach(({ itm_det: it }) => {
      if (large && d.type === 'tax_invoice') {
        b2cl.push([d.number, csvDate(d.document_date), amt(docValue(d)), csvPos(pos), '', it.rt, amt(it.txval), '', '', '']);
      } else if (large) {
        cdnur.push(['B2CL', d.number, csvDate(d.document_date), d.type === 'credit_note' ? 'C' : 'D', csvPos(pos), amt(docValue(d)), '', it.rt, amt(it.txval), '']);
      } else {
        // Small B2C supplies are reported state + rate wise; credit notes reduce the figures.
        const row = group(b2cs, `${pos}|${it.rt}`, () => ({ pos, rt: it.rt, tx: 0 }));
        row.tx += (d.type === 'credit_note' ? -1 : 1) * it.txval;
      }
    });
  });
  files.push({
    filename: 'b2cs.csv',
    content: toCsv(H_B2CS, [...b2cs.values()].map((r) => ['OE', csvPos(r.pos), r.rt, '', amt(r.tx), '', ''])),
  });
  if (b2cl.length) files.push({ filename: 'b2cl.csv', content: toCsv(H_B2CL, b2cl) });
  if (cdnur.length) files.push({ filename: 'cdnur.csv', content: toCsv(H_CDNUR, cdnur) });
  return files;
}

/* ── HSN summary (hsn.csv) ─────────────────────────────────────── */
export function buildHsnCsv(hsnSummary) {
  const rows = (hsnSummary || []).map((r) => [
    r.hsn_sac, safeText(String(r.description || '').slice(0, 30)), uqcLabel(r.uqc || r.unit),
    Number(r.qty || 0).toFixed(2), Number(r.total || 0).toFixed(2), Number(r.taxable_value ?? r.taxable ?? 0).toFixed(2),
    Number(r.igst || 0).toFixed(2), Number(r.cgst || 0).toFixed(2), Number(r.sgst || 0).toFixed(2), '0.00', r2(Number(r.gst_rate || 0)),
  ]);
  return { filename: 'hsn.csv', content: toCsv(H_HSN, rows) };
}

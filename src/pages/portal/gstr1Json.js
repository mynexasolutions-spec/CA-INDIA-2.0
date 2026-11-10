import { stateCodeByName } from '../../data/indianStates';
import { uqcCode } from './gstUqc';

/**
 * Builds the GSTR-1 JSON in the format produced by the GST offline tool
 * ("returns_<DDMMYYYY>_R1_<GSTIN>_offline.json"), so it can be uploaded to the GST portal as-is.
 *
 *   B2B tab  → b2b  (tax invoices)  +  cdnr  (credit / debit notes to registered parties)
 *   B2C tab  → b2cs (state + rate wise summary, credit notes netted off)
 *              b2cl (inter-state invoices above ₹2.5 lakh)  +  cdnur (notes against those)
 *
 * Bill of Supply is not part of these tables (it is reported in the nil / exempt table) and drafts are skipped.
 */

const VERSION = 'GST3.2.4';
const B2CL_LIMIT = 250000;

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(v || 0);

export function fmtDate(d) {
  const s = String(d || '').slice(0, 10); // YYYY-MM-DD
  const [y, m, day] = s.split('-');
  return y && m && day ? `${day}-${m}-${y}` : '';
}

export function posCode(doc, fallback) {
  const pos = String(doc.place_of_supply || '').trim();
  if (/^\d{2}/.test(pos)) return pos.slice(0, 2);
  // Exact name first, so "Andhra Pradesh (New)" resolves to 37 and not to the old state's code 28.
  return stateCodeByName(pos) || stateCodeByName(pos.replace(/\s*\(new\)$/i, '')) || String(fallback || '').padStart(2, '0');
}

/** Items of one document, one entry per GST rate — the offline tool's `itms` array. */
export function buildItems(doc) {
  const inter = Boolean(doc.is_inter_state);
  const byRate = new Map();
  const add = (rate, tx, igst, cgst, sgst) => {
    const cur = byRate.get(rate) || { tx: 0, i: 0, c: 0, s: 0 };
    cur.tx += tx; cur.i += igst; cur.c += cgst; cur.s += sgst;
    byRate.set(rate, cur);
  };

  const lines = doc.line_items || [];
  if (lines.length) {
    lines.forEach((l) => add(r2(num(l.gst_rate)), num(l.taxable_amount), num(l.igst_amount), num(l.cgst_amount), num(l.sgst_amount)));
  } else {
    // Defensive fallback: derive a single rate from the document totals.
    const tx = num(doc.taxable_amount);
    const tax = num(doc.igst_amount) + num(doc.cgst_amount) + num(doc.sgst_amount);
    add(tx ? r2((tax / tx) * 100) : 0, tx, num(doc.igst_amount), num(doc.cgst_amount), num(doc.sgst_amount));
  }

  return [...byRate.entries()].map(([rt, v]) => ({
    // The offline tool numbers each rate line as rate×100+1 (18% → 1801, 5% → 501).
    num: Math.round(rt * 100) + 1,
    itm_det: inter
      ? { txval: r2(v.tx), rt, iamt: r2(v.i), csamt: 0 }
      : { txval: r2(v.tx), rt, camt: r2(v.c), samt: r2(v.s), csamt: 0 },
  }));
}

export const docValue = (d) => r2(num(d.grand_total) || num(d.total_amount));
export const group = (map, key, make) => { if (!map.has(key)) map.set(key, make()); return map.get(key); };
export const B2CL_THRESHOLD = B2CL_LIMIT;
export { r2 };

/** Documents that belong in the GSTR-1 tables (bill of supply, quotations etc. and drafts are left out). */
export const usableDocs = (docs) => (docs || []).filter((d) => ['tax_invoice', 'debit_note', 'credit_note'].includes(d.type) && d.status !== 'draft' && d.status !== 'cancelled');

export function buildGstr1OfflineJson({ gstin, period, gstType, docs, stateCode }) {
  const [y, m] = period.split('-');
  const out = { gstin: gstin || '', fp: `${m}${y}`, version: VERSION, hash: 'hash' };

  const usable = usableDocs(docs);

  if (gstType === 'b2b') {
    const b2b = new Map();
    const cdnr = new Map();
    usable.forEach((d) => {
      const ctin = d.customer?.gstin;
      if (!ctin) return;
      const common = { val: docValue(d), pos: posCode(d, stateCode), rchrg: d.is_reverse_charge ? 'Y' : 'N', inv_typ: 'R', itms: buildItems(d) };
      if (d.type === 'tax_invoice') {
        group(b2b, ctin, () => ({ ctin, inv: [] })).inv.push({ inum: String(d.number), idt: fmtDate(d.document_date), ...common });
      } else {
        group(cdnr, ctin, () => ({ ctin, nt: [] })).nt.push({ ntty: d.type === 'credit_note' ? 'C' : 'D', nt_num: String(d.number), nt_dt: fmtDate(d.document_date), ...common });
      }
    });
    if (b2b.size) out.b2b = [...b2b.values()];
    if (cdnr.size) out.cdnr = [...cdnr.values()];
    return out;
  }

  // B2C
  const b2cs = new Map();
  const b2cl = new Map();
  const cdnur = [];
  usable.forEach((d) => {
    const pos = posCode(d, stateCode);
    const inter = Boolean(d.is_inter_state);
    const itms = buildItems(d);
    const large = inter && docValue(d) > B2CL_LIMIT;

    if (large && d.type === 'tax_invoice') {
      group(b2cl, pos, () => ({ pos, inv: [] })).inv.push({ inum: String(d.number), idt: fmtDate(d.document_date), val: docValue(d), itms });
    } else if (large) {
      cdnur.push({ typ: 'B2CL', ntty: d.type === 'credit_note' ? 'C' : 'D', nt_num: String(d.number), nt_dt: fmtDate(d.document_date), val: docValue(d), pos, itms });
    } else {
      // Small B2C supplies are reported state + rate wise; credit notes reduce the figures.
      const sign = d.type === 'credit_note' ? -1 : 1;
      itms.forEach(({ itm_det: it }) => {
        const row = group(b2cs, `${pos}|${inter}|${it.rt}`, () => ({
          sply_ty: inter ? 'INTER' : 'INTRA', rt: it.rt, typ: 'OE', pos, txval: 0, ...(inter ? { iamt: 0 } : { camt: 0, samt: 0 }), csamt: 0,
        }));
        row.txval = r2(row.txval + sign * it.txval);
        if (inter) row.iamt = r2(row.iamt + sign * it.iamt);
        else { row.camt = r2(row.camt + sign * it.camt); row.samt = r2(row.samt + sign * it.samt); }
      });
    }
  });
  if (b2cs.size) out.b2cs = [...b2cs.values()];
  if (b2cl.size) out.b2cl = [...b2cl.values()];
  if (cdnur.length) out.cdnur = cdnur;
  return out;
}

/**
 * HSN summary (Summary tab) in the same offline-tool file layout: gstin / fp / version / hash + hsn{hsn_b2b, hsn_b2c}.
 * Row shape follows the HSN sample from the GST JSON export (num, hsn_sc, txval, iamt, camt, samt, csamt, desc, user_desc, uqc, qty, rt).
 */
export function buildHsnOfflineJson({ gstin, period, hsnB2b, hsnB2c }) {
  const [y, m] = period.split('-');
  const rows = (list) => (list || []).map((r, i) => ({
    num: i + 1,
    hsn_sc: String(r.hsn_sac || ''),
    txval: r2(num(r.taxable_value)),
    iamt: r2(num(r.igst)),
    camt: r2(num(r.cgst)),
    samt: r2(num(r.sgst)),
    csamt: 0,
    desc: '',
    user_desc: String(r.description || ''),
    uqc: uqcCode(r.uqc),
    qty: r2(num(r.qty)),
    rt: r2(num(r.gst_rate)),
  }));
  const hsn = {};
  const b2b = rows(hsnB2b);
  const b2c = rows(hsnB2c);
  if (b2b.length) hsn.hsn_b2b = b2b;
  if (b2c.length) hsn.hsn_b2c = b2c;
  return { gstin: gstin || '', fp: `${m}${y}`, version: VERSION, hash: 'hash', hsn };
}

/** returns_<DDMMYYYY of today>_R1_<GSTIN>_offline.json — same naming as the GST offline tool. */
export function gstr1OfflineFileName(gstin) {
  const t = new Date();
  const ddmmyyyy = `${String(t.getDate()).padStart(2, '0')}${String(t.getMonth() + 1).padStart(2, '0')}${t.getFullYear()}`;
  return `returns_${ddmmyyyy}_R1_${gstin || 'GSTIN'}_offline.json`;
}

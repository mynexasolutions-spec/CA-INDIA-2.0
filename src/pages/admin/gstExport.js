/**
 * Shared download helper for the GSTR-1 review exports (HSN/SAC summary, B2B and
 * B2C document lists).
 *
 * columns: [{ header: 'Taxable Value', key: 'taxable' }, ...]
 * fmt:     'excel' (real .xlsx) | 'csv' | 'json'
 */

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportRows({ rows, columns, fmt, name, sheetName = 'Sheet1' }) {
  if (fmt === 'json') {
    const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? null])));
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${name}.json`);
    return;
  }

  if (fmt === 'csv') {
    const lines = [
      columns.map((c) => csvCell(c.header)).join(','),
      ...rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(',')),
    ];
    // BOM so Excel opens UTF-8 (₹, accented names) correctly.
    downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
    return;
  }

  if (fmt === 'excel') {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header), ...rows.map((r) => columns.map((c) => r[c.key] ?? ''))]);
    ws['!cols'] = columns.map((c) => ({ wch: Math.max(c.header.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${name}.xlsx`);
  }
}

/** Column sets used by the three exports. */
export const HSN_COLUMNS = [
  { header: 'Code Type', key: 'code_type' },
  { header: 'HSN/SAC Code', key: 'hsn_sac' },
  { header: 'Description', key: 'description' },
  { header: 'GST (%)', key: 'gst_rate' },
  { header: 'QTY', key: 'qty' },
  { header: 'UQC', key: 'uqc' },
  { header: 'Taxable Value', key: 'taxable' },
  { header: 'IGST', key: 'igst' },
  { header: 'CGST', key: 'cgst' },
  { header: 'SGST', key: 'sgst' },
];

export const documentColumns = (showGstin) => [
  { header: 'Sr. No.', key: 'sr' },
  { header: 'Invoice Number', key: 'number' },
  { header: 'Invoice Date', key: 'document_date' },
  { header: 'Party Name', key: 'party_name' },
  ...(showGstin ? [{ header: 'GSTIN', key: 'gstin' }] : []),
  { header: 'Place of Supply', key: 'place_of_supply' },
  { header: 'GST (%)', key: 'gst_rate' },
  { header: 'Taxable Value', key: 'taxable' },
  { header: 'IGST', key: 'igst' },
  { header: 'CGST', key: 'cgst' },
  { header: 'SGST', key: 'sgst' },
  { header: 'Total Value', key: 'total' },
];

export const STATE_COLUMNS = [
  { header: 'Sr. No.', key: 'sr' },
  { header: 'Place of Supply', key: 'state' },
  { header: 'GST (%)', key: 'gst_rate' },
  { header: 'No. of Documents', key: 'doc_count' },
  { header: 'Taxable Value', key: 'taxable' },
  { header: 'IGST', key: 'igst' },
  { header: 'CGST', key: 'cgst' },
  { header: 'SGST', key: 'sgst' },
  { header: 'Total Value', key: 'total' },
];

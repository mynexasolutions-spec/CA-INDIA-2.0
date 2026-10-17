import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../../api/client';
import { buildFyOptions, currentFyLabel, fyMonthOptions, fyQuarterPeriodOptions, periodLabel } from '../billing/billingUtils';

const PREVIEWABLE_EXT = ['xls', 'xlsx', 'csv'];

/** Reads a spreadsheet file in the browser and returns its first sheet as a plain
 * array-of-rows grid, so it can be rendered exactly as the uploaded file looks —
 * no server round-trip needed just to preview what was picked. */
function readSheetAsGrid(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
        resolve(grid);
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** Header keywords (from the standard GST portal GSTR-2B B2B export layout) used to map
 * whatever columns the uploaded sheet actually has onto our invoice fields — best-effort,
 * since GSTN doesn't publish a fixed column order and clients may re-export/reorder. */
const INVOICE_HEADER_MAP = [
  ['supplier_gstin', /gst\s*i?n/i],
  ['supplier_name', /(trade|legal).*name|supplier\s*name|\bname\b/i],
  ['invoice_number', /invoice\s*(no\.?|number|num)/i],
  ['invoice_date', /invoice\s*date/i],
  ['invoice_value', /invoice\s*value/i],
  ['taxable_value', /taxable\s*value/i],
  ['igst', /integrated\s*tax|igst/i],
  ['cgst', /central\s*tax|cgst/i],
  ['sgst', /state\s*\/?\s*ut\s*tax|sgst/i],
  ['cess', /cess/i],
  ['itc_eligibility', /itc\s*availab|eligib/i],
  ['itc_reason', /reason/i],
];

function parseAmount(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseGridDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    // Excel serial date (1900 date system, UTC).
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function normalizeEligibilityValue(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['y', 'yes', 'true', '1', 'eligible'].includes(s)) return 'eligible';
  if (['n', 'no', 'false', '0', 'ineligible', 'blocked'].includes(s)) return 'ineligible';
  return null;
}

/** Finds the header row inside a raw grid by looking for a row that mentions both
 * "GSTIN" and "invoice" — real GSTR-2B exports have a few title/summary rows above it. */
function findInvoiceHeaderRow(grid) {
  const limit = Math.min(grid.length, 20);
  for (let ri = 0; ri < limit; ri++) {
    const row = grid[ri].map((c) => String(c || '').toLowerCase());
    if (row.some((c) => /gst\s*i?n/.test(c)) && row.some((c) => c.includes('invoice'))) {
      return ri;
    }
  }
  return -1;
}

/** Maps a raw spreadsheet grid onto our invoice-row shape, ready to post to the
 * bulk-import endpoint. Returns [] if this doesn't look like a B2B invoice sheet at all. */
function mapGridToInvoiceRows(grid) {
  const headerIdx = findInvoiceHeaderRow(grid);
  if (headerIdx === -1) return [];

  const headers = grid[headerIdx].map((h) => String(h || ''));
  const colFor = {};
  headers.forEach((h, ci) => {
    INVOICE_HEADER_MAP.forEach(([field, re]) => {
      if (colFor[field] === undefined && re.test(h)) colFor[field] = ci;
    });
  });
  if (colFor.supplier_gstin === undefined && colFor.invoice_number === undefined) return [];

  const get = (row, field) => (colFor[field] !== undefined ? row[colFor[field]] : undefined);
  const rows = [];
  for (let ri = headerIdx + 1; ri < grid.length; ri++) {
    const row = grid[ri];
    const gstin = get(row, 'supplier_gstin');
    const invNum = get(row, 'invoice_number');
    if ((gstin === undefined || gstin === '') && (invNum === undefined || invNum === '')) continue;

    rows.push({
      supplier_gstin: gstin != null && gstin !== '' ? String(gstin).trim() : null,
      supplier_name: get(row, 'supplier_name') ? String(get(row, 'supplier_name')).trim() : null,
      invoice_number: invNum != null && invNum !== '' ? String(invNum).trim() : null,
      invoice_date: parseGridDate(get(row, 'invoice_date')),
      invoice_value: parseAmount(get(row, 'invoice_value')),
      taxable_value: parseAmount(get(row, 'taxable_value')),
      cgst: parseAmount(get(row, 'cgst')),
      sgst: parseAmount(get(row, 'sgst')),
      igst: parseAmount(get(row, 'igst')),
      cess: parseAmount(get(row, 'cess')),
      itc_eligibility: normalizeEligibilityValue(get(row, 'itc_eligibility')),
      itc_reason: get(row, 'itc_reason') ? String(get(row, 'itc_reason')) : null,
    });
  }
  return rows;
}

/** Renders a parsed spreadsheet grid (array-of-rows) as an HTML table — shared by the
 * pre-upload preview and the "View" preview of an already-saved statement. Styled
 * standalone (not the shared .bp-table class) so it doesn't affect any other table. */
function GridTable({ grid, dbInvoices = [] }) {
  if (!grid.length) return <p>This file has no rows to preview.</p>;

  const headers = grid[0] || [];
  const colFor = {};
  headers.forEach((h, ci) => {
    INVOICE_HEADER_MAP.forEach(([field, re]) => {
      if (colFor[field] === undefined && re.test(h)) colFor[field] = ci;
    });
  });

  return (
    <div
      style={{
        zoom: 0.9,
        overflowX: 'auto',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {grid[0].map((cell, ci) => (
              <th
                key={ci}
                style={{
                  position: 'sticky', top: 0,
                  background: 'var(--bp-navy, #0a3d82)', color: '#fff',
                  fontWeight: 700, fontSize: 12, letterSpacing: 0.2,
                  textAlign: 'center', whiteSpace: 'nowrap',
                  padding: '10px 14px',
                  borderRight: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {cell === '' || cell == null ? '—' : String(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.slice(1).map((row, ri) => (
            <tr
              key={ri}
              style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ri % 2 === 0 ? '#fff' : '#f8fafc'; }}
            >
              {grid[0].map((_, ci) => {
                let cellVal = row[ci] === '' || row[ci] == null ? '' : String(row[ci]);

                if (ci === colFor.itc_eligibility && dbInvoices.length > 0) {
                  const rowGstin = colFor.supplier_gstin !== undefined ? String(row[colFor.supplier_gstin] || '').trim().toLowerCase() : '';
                  const rowInvNum = colFor.invoice_number !== undefined ? String(row[colFor.invoice_number] || '').trim().toLowerCase() : '';
                  if (rowGstin && rowInvNum) {
                    const match = dbInvoices.find(
                      (inv) =>
                        String(inv.supplier_gstin || '').trim().toLowerCase() === rowGstin &&
                        String(inv.invoice_number || '').trim().toLowerCase() === rowInvNum
                    );
                    if (match) {
                      cellVal = match.itc_eligibility === 'eligible' ? 'Yes' : 'No';
                    }
                  }
                }

                return (
                  <td
                    key={ci}
                    style={{
                      padding: '8px 14px',
                      borderBottom: '1px solid #edf2f7',
                      borderRight: '1px solid #edf2f7',
                      color: '#1e293b',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}
                  >
                    {cellVal}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentQuarterValue(fy) {
  const d = new Date();
  const m = d.getMonth() + 1;
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 && m <= 12 ? 3 : 4;
  const [y1] = String(fy).split('-');
  return `${y1}-Q${q}`;
}

export default function AdminClientGstr2b() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fy, setFy] = useState(currentFyLabel());
  // GSTR-2B has no filing action of its own — it mirrors GSTR-3B's cycle 1:1
  // (BillingPolicy::gstr2bFrequency), and is always quarterly for Composition dealers.
  const gstr2bQuarterly = !!client && (
    client.dealer_type === 'composition' ||
    (client.gstr2b_filing_frequency ?? client.gst_filing_frequency) === 'quarterly'
  );
  const periodOptions = gstr2bQuarterly ? fyQuarterPeriodOptions(fy) : fyMonthOptions(fy);
  const [taxPeriod, setTaxPeriod] = useState('');
  const [file, setFile] = useState(null);
  const [previewGrid, setPreviewGrid] = useState(null);
  const [previewErr, setPreviewErr] = useState('');
  const [previewing, setPreviewing] = useState(false);

  const [viewRecord, setViewRecord] = useState(null);
  const [viewGrid, setViewGrid] = useState(null);
  const [viewErr, setViewErr] = useState('');
  const [viewLoading, setViewLoading] = useState(false);
  const [viewDbInvoices, setViewDbInvoices] = useState([]);

  const [invoicesRecord, setInvoicesRecord] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [invoicesErr, setInvoicesErr] = useState('');
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [savingInvoiceId, setSavingInvoiceId] = useState(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const replacePeriodRef = useRef(null);
  const replaceInputRef = useRef(null);

  const loadRecords = () => {
    setLoading(true);
    api(`/admin/clients/${id}/gstr2b`)
      .then((rows) => setRecords(rows || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api(`/admin/clients/${id}?directory=1`).then(setClient).catch((e) => setErr(e.message));
    loadRecords();
  }, [id]);

  // Picks a sensible default period once the client's actual GSTR-2B cadence is known
  // (client loads asynchronously, so this can't be resolved at useState-initializer
  // time) and whenever the FY or that cadence changes the available options.
  useEffect(() => {
    if (!periodOptions.length) return;
    if (periodOptions.some((o) => o.value === taxPeriod)) return;
    const cur = gstr2bQuarterly ? currentQuarterValue(fy) : currentMonthValue();
    setTaxPeriod(periodOptions.some((o) => o.value === cur) ? cur : periodOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodOptions, gstr2bQuarterly, fy]);

  const handleFyChange = (newFy) => {
    setFy(newFy);
    setTaxPeriod(''); // re-picked by the effect above once periodOptions recomputes for newFy
  };

  const doUpload = async (period, uploadFile) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('tax_period', period);
      fd.append('file', uploadFile);
      const record = await api(`/admin/clients/${id}/gstr2b`, { method: 'POST', body: fd });

      let invoiceNote = '';
      const ext = uploadFile.name.split('.').pop()?.toLowerCase();
      if (PREVIEWABLE_EXT.includes(ext) && record?.id) {
        try {
          const grid = await readSheetAsGrid(uploadFile);
          const rows = mapGridToInvoiceRows(grid);
          if (rows.length) {
            await api(`/admin/clients/${id}/gstr2b/${record.id}/invoices/bulk`, {
              method: 'POST',
              body: { invoices: rows },
            });
            invoiceNote = ` — ${rows.length} invoice line(s) parsed.`;
          }
        } catch {
          // Best-effort: the raw file is already saved regardless of whether we could
          // also map it into structured invoice rows.
        }
      }

      setMsg(`Saved GSTR-2B for ${periodLabel(period)}${invoiceNote}`);
      loadRecords();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (picked) => {
    setFile(picked);
    setPreviewGrid(null);
    setPreviewErr('');
    if (!picked) return;
    const ext = picked.name.split('.').pop()?.toLowerCase();
    if (!PREVIEWABLE_EXT.includes(ext)) return;
    setPreviewing(true);
    try {
      const grid = await readSheetAsGrid(picked);
      setPreviewGrid(grid);
    } catch (e) {
      setPreviewErr(e.message || 'Could not read this file for preview.');
    } finally {
      setPreviewing(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      ['Supplier GSTIN', 'Supplier Name', 'Invoice No.', 'Invoice Date', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total GST', 'ITC Availability', 'Match Status']
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'GSTR2B_Template.xlsx');
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      setErr('Choose a file to upload');
      return;
    }
    doUpload(taxPeriod, file);
  };

  /** GSTR-3B Filing Request reconciliation gate spec — lets the admin tell the system
   *  "there's nothing to reconcile" for a period instead of uploading a dummy file, so
   *  the client can raise the GSTR-3B request directly for it. */
  const handleMarkNoBills = async () => {
    if (!taxPeriod) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await api(`/admin/clients/${id}/gstr2b/no-bills`, { method: 'POST', body: { tax_period: taxPeriod } });
      setMsg(`Marked ${periodLabel(taxPeriod)} as "No Bills in GSTR-2B".`);
      setFile(null);
      setPreviewGrid(null);
      loadRecords();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const triggerReplace = (period) => {
    replacePeriodRef.current = period;
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChange = (e) => {
    const picked = e.target.files?.[0];
    const period = replacePeriodRef.current;
    e.target.value = '';
    if (!picked || !period) return;
    doUpload(period, picked);
  };

  const handleView = async (record) => {
    const url = `/storage/${record.file_path}`;
    const ext = record.file_name?.split('.').pop()?.toLowerCase();
    if (!PREVIEWABLE_EXT.includes(ext)) {
      window.open(url, '_blank', 'noreferrer');
      return;
    }
    setViewRecord(record);
    setViewGrid(null);
    setViewErr('');
    setViewLoading(true);
    try {
      const [grid, dbInvoices] = await Promise.all([
        fetch(url).then((res) => {
          if (!res.ok) throw new Error('Could not download the file');
          return res.blob().then(readSheetAsGrid);
        }),
        api(`/admin/clients/${id}/gstr2b/${record.id}/invoices`).catch(() => [])
      ]);
      setViewGrid(grid);
      setViewDbInvoices(dbInvoices || []);
    } catch (e) {
      setViewErr(e.message || 'Could not read this file for preview.');
    } finally {
      setViewLoading(false);
    }
  };

  const handleViewInvoices = async (record) => {
    setInvoicesRecord(record);
    setInvoices(null);
    setInvoicesErr('');
    setInvoicesLoading(true);
    try {
      const rows = await api(`/admin/clients/${id}/gstr2b/${record.id}/invoices`);
      setInvoices(rows || []);
    } catch (e) {
      setInvoicesErr(e.message || 'Could not load invoices for this statement.');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleParseFromFile = async (record) => {
    setInvoicesErr('');
    setInvoicesLoading(true);
    try {
      const res = await fetch(`/storage/${record.file_path}`);
      if (!res.ok) throw new Error('Could not download the file');
      const blob = await res.blob();
      const grid = await readSheetAsGrid(blob);
      const rows = mapGridToInvoiceRows(grid);
      if (!rows.length) {
        setInvoicesErr("Couldn't find a GSTIN/Invoice header row in this file to map — check its column layout.");
        return;
      }
      const saved = await api(`/admin/clients/${id}/gstr2b/${record.id}/invoices/bulk`, {
        method: 'POST',
        body: { invoices: rows },
      });
      setInvoices(saved || []);
    } catch (e) {
      setInvoicesErr(e.message || 'Could not parse this file.');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleEligibilityChange = async (invoice, newValue) => {
    const prev = invoices;
    setSavingInvoiceId(invoice.id);
    const updateFn = (rows) => (rows || []).map((r) => (r.id === invoice.id ? { ...r, itc_eligibility: newValue } : r));
    setInvoices(updateFn);
    setViewDbInvoices(updateFn);
    try {
      await api(`/admin/clients/${id}/gstr2b/invoices/${invoice.id}/eligibility`, {
        method: 'PATCH',
        body: { itc_eligibility: newValue },
      });
    } catch (e) {
      setInvoices(prev);
      setInvoicesErr(e.message || 'Could not update ITC eligibility.');
    } finally {
      setSavingInvoiceId(null);
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Delete the GSTR-2B file for ${periodLabel(record.tax_period)}?`)) return;
    setErr('');
    setMsg('');
    try {
      await api(`/admin/clients/${id}/gstr2b/${record.id}`, { method: 'DELETE' });
      loadRecords();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div>
      <div className="bp-toolbar">
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>GSTR-2B</h2>
          <div style={{ fontSize: 12, color: 'var(--bp-muted)' }}>
            {client ? (
              <>{client.business_name || client.client_name} · {client.client_code}</>
            ) : 'Loading client…'}
          </div>
        </div>
        <Link className="bp-btn bp-btn-outline" to="/admin/gstr-2b">All Clients</Link>
      </div>

      <div className="bp-card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Upload GSTR-2B</h3>
          <button
            type="button"
            className="bp-btn"
            style={{
              height: 36,
              fontSize: 12,
              padding: '0 16px',
              background: 'linear-gradient(135deg, #107c41 0%, #1f9a55 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              boxShadow: '0 4px 10px rgba(16, 124, 65, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={downloadTemplate}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1.5px)';
              e.currentTarget.style.boxShadow = '0 6px 14px rgba(16, 124, 65, 0.35)';
              e.currentTarget.style.filter = 'brightness(1.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 10px rgba(16, 124, 65, 0.25)';
              e.currentTarget.style.filter = 'none';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Predefined Format
          </button>
        </div>
        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
          <label>
            Financial Year
            <select className="bp-select" value={fy} onChange={(e) => handleFyChange(e.target.value)}>
              {buildFyOptions().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label>
            Tax Period
            <select className="bp-select" value={taxPeriod} onChange={(e) => setTaxPeriod(e.target.value)}>
              {periodOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label>
            GSTR-2B File
            <input
              className="bp-file-input"
              type="file"
              accept=".pdf,.xls,.xlsx,.json,.csv"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
          </label>
          <button type="submit" className="bp-btn bp-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Upload & Save'}
          </button>
          <button type="button" className="bp-btn bp-btn-outline" disabled={busy || !taxPeriod} onClick={handleMarkNoBills}>
            Mark "No Bills in GSTR-2B"
          </button>
        </form>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--bp-muted)' }}>
          No purchases for {taxPeriod ? periodLabel(taxPeriod) : 'the selected period'}? Use "Mark No Bills" instead of
          uploading a file — the client can then raise a GSTR-3B filing request for it directly, without reconciliation.
        </p>
        {msg && <p className="bp-alert bp-alert-success" style={{ marginTop: 12 }}>{msg}</p>}
        {err && <p className="bp-alert bp-alert-error" style={{ marginTop: 12 }}>{err}</p>}
      </div>

      {file && (
        <div className="bp-card" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>Preview — {file.name}</h3>
          {previewing && <p>Reading file…</p>}
          {previewErr && <p className="bp-alert bp-alert-error">{previewErr}</p>}
          {!previewing && !previewErr && previewGrid && <GridTable grid={previewGrid} />}
          {!previewing && !previewErr && !previewGrid && (
            <p style={{ color: 'var(--bp-muted)' }}>Preview isn't available for this file type — it will still be saved as-is.</p>
          )}
        </div>
      )}

      {viewRecord && (
        <div className="bp-card" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Viewing — {viewRecord.file_name}</h3>
            <button type="button" className="bp-btn bp-btn-outline" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setViewRecord(null)}>
              Close
            </button>
          </div>
          {viewLoading && <p>Loading…</p>}
          {viewErr && <p className="bp-alert bp-alert-error">{viewErr}</p>}
          {!viewLoading && !viewErr && viewGrid && <GridTable grid={viewGrid} dbInvoices={viewDbInvoices} />}
        </div>
      )}

      {invoicesRecord && (
        <div className="bp-card" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h3 style={{ margin: 0 }}>Invoices — {periodLabel(invoicesRecord.tax_period)}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--bp-muted)' }}>
                Override ITC eligibility per invoice line if the parsed statement got it wrong.
              </p>
            </div>
            <button type="button" className="bp-btn bp-btn-outline" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setInvoicesRecord(null)}>
              Close
            </button>
          </div>
          {invoicesLoading && <p>Loading…</p>}
          {invoicesErr && <p className="bp-alert bp-alert-error">{invoicesErr}</p>}
          {!invoicesLoading && invoices && (
            invoices.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="bp-table bp-table-center">
                  <thead>
                    <tr>
                      <th>Supplier GSTIN</th>
                      <th>Supplier Name</th>
                      <th>Invoice No.</th>
                      <th>Invoice Date</th>
                      <th>Total GST (₹)</th>
                      <th>ITC Eligibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.supplier_gstin || '—'}</td>
                        <td>{inv.supplier_name || '—'}</td>
                        <td>{inv.invoice_number || '—'}</td>
                        <td>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : '—'}</td>
                        <td>{Number(inv.total_gst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>
                          <select
                            className="bp-select"
                            value={inv.itc_eligibility || 'eligible'}
                            disabled={savingInvoiceId === inv.id}
                            onChange={(e) => handleEligibilityChange(inv, e.target.value)}
                          >
                            <option value="eligible">Eligible</option>
                            <option value="ineligible">Not Eligible</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--bp-muted)', marginTop: 0 }}>
                  No structured invoice lines for this statement yet.
                  {PREVIEWABLE_EXT.includes(invoicesRecord.file_name?.split('.').pop()?.toLowerCase())
                    ? ' This looks like a spreadsheet — try parsing it below.'
                    : ' Only JSON, Excel or CSV GSTR-2B files can be parsed into invoice lines.'}
                </p>
                {PREVIEWABLE_EXT.includes(invoicesRecord.file_name?.split('.').pop()?.toLowerCase()) && (
                  <button
                    type="button"
                    className="bp-btn bp-btn-primary"
                    onClick={() => handleParseFromFile(invoicesRecord)}
                  >
                    Parse Invoices from Uploaded File
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}

      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf,.xls,.xlsx,.json,.csv"
        style={{ display: 'none' }}
        onChange={handleReplaceFileChange}
      />

      <div className="bp-card" style={{ marginTop: 14, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Uploaded Statements</h3>
        {loading ? <p>Loading…</p> : (
          <table className="bp-table bp-table-center">
            <thead>
              <tr>
                <th>Financial Year</th>
                <th>Tax Period</th>
                <th>File</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.financial_year}</td>
                  <td>{periodLabel(r.tax_period)}</td>
                  <td>
                    {r.no_bills ? (
                      <span className="bp-badge" style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>No Bills in GSTR-2B</span>
                    ) : (r.file_name || '—')}
                  </td>
                  <td>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}
                    {r.uploader?.name ? ` · ${r.uploader.name}` : ''}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {!r.no_bills && (
                      <>
                        <button
                          type="button"
                          className="bp-btn bp-btn-outline"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => handleView(r)}
                        >
                          View
                        </button>
                        {' · '}
                        <button
                          type="button"
                          className="bp-btn bp-btn-outline"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => handleViewInvoices(r)}
                        >
                          Invoices
                        </button>
                        {' · '}
                      </>
                    )}
                    <button
                      type="button"
                      className="bp-btn bp-btn-outline"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      disabled={busy}
                      onClick={() => triggerReplace(r.tax_period)}
                    >
                      {r.no_bills ? 'Upload File Instead' : 'Replace'}
                    </button>
                    {' '}
                    <button
                      type="button"
                      className="bp-btn bp-btn-danger"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => handleDelete(r)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={5}>No GSTR-2B statements uploaded yet</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

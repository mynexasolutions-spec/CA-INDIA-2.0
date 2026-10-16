import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

const norm = (v) => String(v ?? '').toLowerCase().replace(/\(%\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/* ── Tab Icons matching reference ──────────────────────────────── */
const HsnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="4" width="2" height="16" rx="0.5" />
    <rect x="5.5" y="4" width="1" height="16" />
    <rect x="8" y="4" width="2.5" height="16" rx="0.5" />
    <rect x="12" y="4" width="1" height="16" />
    <rect x="14.5" y="4" width="2" height="16" rx="0.5" />
    <rect x="18" y="4" width="1" height="16" />
    <rect x="20.5" y="4" width="1.5" height="16" rx="0.5" />
  </svg>
);

const SacIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const GstIcon = () => (
  <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>%</span>
);

const UqcIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const TdsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <text x="11" y="17" fontSize="8" fontWeight="900" fill="currentColor" stroke="none" textAnchor="middle">₹</text>
  </svg>
);

const TcsIcon = () => (
  <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>₹</span>
);

/* ── Tab Definitions ───────────────────────────────────────────── */
const TABS = [
  {
    key: 'hsn',
    label: 'HSN Code Master',
    icon: HsnIcon,
    endpoint: '/admin/master-config/hsn',
    addLabel: 'Add HSN Code',
    searchPlaceholder: 'Search HSN code or description...',
    columns: ['HSN Code', 'Description'],
    fields: [
      { name: 'code', label: 'HSN Code', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'text', required: true },
    ],
    getRow: r => [r.code, r.description],
    subtitle: 'Manage HSN codes for Goods. These codes will be used in invoices and GST reports.',
  },
  {
    key: 'sac',
    label: 'SAC Code Master',
    icon: SacIcon,
    endpoint: '/admin/master-config/sac',
    addLabel: 'Add SAC Code',
    searchPlaceholder: 'Search SAC code or description...',
    columns: ['SAC Code', 'Description'],
    fields: [
      { name: 'code', label: 'SAC Code', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'text', required: true },
    ],
    getRow: r => [r.code, r.description],
    subtitle: 'Manage SAC codes for Services. These codes will be used in invoices and GST reports.',
  },
  {
    key: 'gst-rate',
    label: 'GST Rate Master',
    icon: GstIcon,
    endpoint: '/admin/master-config/gst-rate',
    addLabel: 'Add GST Rate',
    searchPlaceholder: 'Search GST rate...',
    columns: ['GST Rate'],
    fields: [
      { name: 'rate', label: 'GST Rate (%)', type: 'number', required: true, step: '0.001', min: '0', max: '100' },
    ],
    getRow: r => [`${r.rate}%`],
    subtitle: 'Manage GST rate master data. These rates will be used in invoices and GST reports.',
  },
  {
    key: 'uqc',
    label: 'UQC Master',
    icon: UqcIcon,
    endpoint: '/admin/master-config/uqc',
    addLabel: 'Add UQC',
    searchPlaceholder: 'Search UQC code or description...',
    columns: ['UQC Code', 'Description'],
    fields: [
      { name: 'code', label: 'UQC Code', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'text' },
    ],
    getRow: r => [r.code, r.description],
    subtitle: 'Manage Unit Quantity Codes (UQC) for goods and services. These codes will be used in invoices and GST reports.',
  },
  {
    key: 'tds',
    label: 'TDS Rate Master',
    icon: TdsIcon,
    endpoint: '/admin/master-config/tds',
    addLabel: 'Add TDS Rate',
    searchPlaceholder: 'Search Section, Description or Rate...',
    columns: ['Section', 'TDS Rate', 'Description'],
    fields: [
      { name: 'code', label: 'Section', type: 'text', required: true },
      { name: 'rate', label: 'TDS Rate (%)', type: 'number', required: true, step: '0.01', min: '0', max: '100' },
      { name: 'description', label: 'Description', type: 'text', required: true },
    ],
    getRow: r => [r.code, `${r.rate}%`, r.description],
    subtitle: 'Manage TDS rate master data. These rates will be used in invoices and TDS reports.',
  },
  {
    key: 'tcs',
    label: 'TCS Rate Master',
    icon: TcsIcon,
    endpoint: '/admin/master-config/tcs',
    addLabel: 'Add TCS Rate',
    searchPlaceholder: 'Search Section, Description or Rate...',
    columns: ['Section', 'TCS Rate', 'Description'],
    fields: [
      { name: 'code', label: 'Section', type: 'text', required: true },
      { name: 'rate', label: 'TCS Rate (%)', type: 'number', required: true, step: '0.01', min: '0', max: '100' },
      { name: 'description', label: 'Description', type: 'text', required: true },
    ],
    getRow: r => [r.code, `${r.rate}%`, r.description],
    subtitle: 'Manage TCS rate master data. These rates will be used in invoices and TDS reports.',
  },
];

function formatUpdatedDateTime(dateString) {
  if (!dateString) return { date: '—', time: '' };
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return { date: dateString, time: '' };
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
}

function getPaginationItems(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }
  if (current >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', current - 1, current, current + 1, '...', totalPages];
}

export default function AdminConfiguration() {
  const [activeTab, setActiveTab] = useState('hsn');
  const tab = TABS.find(t => t.key === activeTab) || TABS[0];

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", padding: '4px 0 40px', color: '#1e293b' }}>

      {/* Breadcrumb matching reference screenshot */}
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#64748b', cursor: 'pointer' }}>&lt; Configuration</span>
        <span style={{ color: '#94a3b8' }}>&gt;</span>
        <span style={{ color: '#1d4ed8', fontWeight: 600 }}>{tab.label}</span>
      </div>

      {/* Main Page Title & Subtitle */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
          Configuration
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Manage master data for HSN, SAC, GST Rates, UQC, TDS Rates and TCS Rates.
        </p>
      </div>

      {/* Tab Bar matching reference */}
      <div style={{
        display: 'flex',
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        {TABS.map((t, index) => {
          const Icon = t.icon;
          const active = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1,
                padding: '12px 10px',
                border: 'none',
                borderRight: index < TABS.length - 1 ? '1.5px solid #bfdbfe' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                background: active ? '#1d4ed8' : '#fff',
                color: active ? '#fff' : '#0f172a',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              <Icon />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Master Table Card */}
      <MasterTable key={activeTab} tab={tab} />
    </div>
  );
}

function MasterTable({ tab }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('all');

  const [modal, setModal] = useState(null); // null | { mode:'add'|'edit', record?:{} }
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [formData, setFormData] = useState({});

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const [notice, setNotice] = useState(null); // { type: 'success'|'error', text, details? }
  const [busy, setBusy] = useState(false);

  const load = (p = 1, q = appliedSearch, s = appliedStatus) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: 8 });
    if (q) params.set('search', q);
    if (s && s !== 'all') params.set('status', s);
    api(`${tab.endpoint}?${params}`)
      .then(d => {
        setRows(d.data ?? []);
        setTotal(d.total ?? 0);
        setLastPage(d.last_page ?? 1);
        setPage(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, '', 'all');
  }, [tab.endpoint]);

  // Close menu on click outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = () => {
    setAppliedSearch(search);
    setAppliedStatus(status);
    load(1, search, status);
  };

  const doReset = () => {
    setSearch('');
    setStatus('all');
    setAppliedSearch('');
    setAppliedStatus('all');
    load(1, '', 'all');
  };

  const openAdd = () => {
    const initial = {};
    tab.fields.forEach(f => { initial[f.name] = ''; });
    initial.is_active = true;
    setFormData(initial);
    setSaveErr('');
    setModal({ mode: 'add' });
  };

  const openEdit = (record) => {
    const initial = {};
    tab.fields.forEach(f => { initial[f.name] = record[f.name] ?? ''; });
    initial.is_active = record.is_active !== false;
    setFormData(initial);
    setSaveErr('');
    setModal({ mode: 'edit', record });
    setOpenMenuId(null);
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Are you sure you want to delete this record?`)) return;
    setOpenMenuId(null);
    try {
      await api(`${tab.endpoint}/${record.id}`, { method: 'DELETE' });
      load(page, appliedSearch, appliedStatus);
    } catch (e) {
      setNotice({ type: 'error', text: e.message || 'Delete failed' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr('');
    const body = { ...formData };
    tab.fields.forEach(f => {
      if (f.type === 'number') body[f.name] = Number(body[f.name]);
    });
    try {
      if (modal.mode === 'edit') {
        await api(`${tab.endpoint}/${modal.record.id}`, { method: 'PUT', body });
      } else {
        await api(tab.endpoint, { method: 'POST', body });
      }
      setModal(null);
      load(page, appliedSearch, appliedStatus);
    } catch (ex) {
      setSaveErr(ex.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  // Export every record that matches the current search / status filter as a real .xlsx file
  // (not just the page on screen).
  const handleExport = async () => {
    setNotice(null);
    setBusy(true);
    try {
      const params = new URLSearchParams({ page: 1, per_page: 5000 });
      if (appliedSearch) params.set('search', appliedSearch);
      if (appliedStatus && appliedStatus !== 'all') params.set('status', appliedStatus);
      const d = await api(`${tab.endpoint}?${params}`);
      const all = d.data ?? [];
      if (!all.length) {
        setNotice({ type: 'error', text: 'There are no records to export.' });
        return;
      }
      const XLSX = await import('xlsx');
      const header = ['Sr. No.', ...tab.columns, 'Status', 'Updated On'];
      const body = all.map((r, idx) => [idx + 1, ...tab.getRow(r), r.is_active !== false ? 'Active' : 'Inactive', r.updated_at ? String(r.updated_at).replace('T', ' ').slice(0, 16) : '']);
      const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
      ws['!cols'] = header.map((h) => ({ wch: Math.max(String(h).length + 2, h === 'Description' ? 50 : 16) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tab.label.slice(0, 31));
      XLSX.writeFile(wb, `${tab.key}_master_export.xlsx`);
    } catch (e) {
      setNotice({ type: 'error', text: e.message || 'Export failed' });
    } finally {
      setBusy(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Reads an .xlsx / .xls / .csv sheet (first sheet, header row 1) and imports it. Columns are matched by
  // their names — the same ones Export writes, so an exported file can be edited and imported back.
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNotice(null);
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!raw.length) throw new Error('The file has no data rows.');

      const alias = {};
      tab.fields.forEach((f) => { alias[norm(f.name)] = f.name; alias[norm(f.label)] = f.name; });
      if (tab.columns.length === tab.fields.length) tab.columns.forEach((c, i) => { alias[norm(c)] = tab.fields[i].name; });
      alias.status = 'status';
      alias['gst rate'] = 'rate';

      const rows = raw.map((r) => {
        const out = {};
        Object.entries(r).forEach(([h, v]) => { const k = alias[norm(h)]; if (k) out[k] = typeof v === 'string' ? v.trim() : v; });
        return out;
      });
      const wanted = tab.fields.filter((f) => f.required).map((f) => f.name);
      if (!rows.some((r) => wanted.every((n) => r[n] !== undefined))) {
        throw new Error(`Column headings not recognised. Expected: ${tab.columns.join(', ')} (and optionally Status).`);
      }

      const res = await api(`/admin/master-config/${tab.key}/import`, { method: 'POST', body: { rows } });
      setNotice({
        type: res.failed ? 'error' : 'success',
        text: `Import finished: ${res.created} added, ${res.updated} updated${res.failed ? `, ${res.failed} row(s) skipped` : ''}.`,
        details: (res.errors || []).map((x) => `Row ${x.row}: ${x.message}`),
      });
      load(1, appliedSearch, appliedStatus);
    } catch (ex) {
      setNotice({ type: 'error', text: ex.message || 'Import failed' });
    } finally {
      setBusy(false);
    }
  };

  const perPage = 8;
  const fromRow = total > 0 ? (page - 1) * perPage + 1 : 0;
  const toRow = Math.min(page * perPage, total);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div style={{
        background: '#fff',
        border: '1.5px solid #bfdbfe',
        borderRadius: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        overflow: 'hidden',
      }}>

        {/* Card Header matching screenshot */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1.5px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}>
          {/* Left Title and Subtitle with Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1d4ed8',
              flexShrink: 0,
            }}>
              {(() => {
                const Icon = tab.icon;
                return <Icon />;
              })()}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>
                {tab.label}
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                {tab.subtitle}
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Import Excel */}
            <button
              type="button"
              onClick={handleImportClick}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import Excel
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Excel
            </button>

            {/* Add Record Button */}
            <button
              type="button"
              onClick={openAdd}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {tab.addLabel}
            </button>
          </div>
        </div>

        {notice && (
          <div style={{
            margin: '12px 20px 0', padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: notice.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${notice.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: notice.type === 'success' ? '#166534' : '#b91c1c',
            display: 'flex', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontWeight: 600 }}>{notice.text}</div>
              {notice.details?.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12 }}>
                  {notice.details.slice(0, 8).map((d) => <li key={d}>{d}</li>)}
                  {notice.details.length > 8 && <li>…and {notice.details.length - 8} more</li>}
                </ul>
              )}
            </div>
            <button type="button" onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Filter Strip matching screenshot */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1.5px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: 340 }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder={tab.searchPlaceholder}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px 8px 34px',
                border: '1.5px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                color: '#0f172a',
                background: '#fff',
              }}
            />
          </div>

          {/* Status Dropdown */}
          <div style={{ position: 'relative', width: 140 }}>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 30px 8px 12px',
                border: '1.5px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                color: '#0f172a',
                background: '#fff',
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Action buttons on right */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={doReset}
              style={{
                padding: '8px 20px',
                background: '#fff',
                border: '1.5px solid #bfdbfe',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={doSearch}
              style={{
                padding: '8px 24px',
                background: '#1d4ed8',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </div>
        </div>

        {/* Master Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 80 }}>
                  Sr. No.
                </th>
                {tab.columns.map((col, idx) => (
                  <th
                    key={col}
                    style={{
                      padding: '12px 18px',
                      textAlign: 'left',
                      fontWeight: 700,
                      color: '#0f172a',
                      fontSize: 12.5,
                      width: idx === 0 ? 140 : 'auto',
                    }}
                  >
                    {col}
                  </th>
                ))}
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 120 }}>
                  Status
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 160 }}>
                  Updated On
                </th>
                <th style={{ padding: '12px 18px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontSize: 12.5, width: 90 }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={tab.columns.length + 4} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    Loading data...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={tab.columns.length + 4} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    No records found.
                  </td>
                </tr>
              )}

              {!loading && rows.map((r, i) => {
                const cells = tab.getRow(r);
                const active = r.is_active !== false;
                const { date, time } = formatUpdatedDateTime(r.updated_at);
                const isMenuOpen = openMenuId === r.id;

                return (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fcfdfe'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Sr. No. */}
                    <td style={{ padding: '14px 18px', color: '#475569', fontWeight: 500 }}>
                      {(page - 1) * perPage + i + 1}
                    </td>

                    {/* Columns (Code, Description, etc.) */}
                    {cells.map((c, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: '14px 18px',
                          color: ci === 0 ? '#0f172a' : '#334155',
                          fontWeight: ci === 0 ? 700 : 400,
                          fontSize: 13,
                        }}
                      >
                        {c || '—'}
                      </td>
                    ))}

                    {/* Status Badge */}
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        background: active ? '#dcfce7' : '#fee2e2',
                        color: active ? '#16a34a' : '#dc2626',
                      }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: active ? '#16a34a' : '#dc2626',
                          display: 'inline-block',
                        }} />
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Updated On */}
                    <td style={{ padding: '14px 18px', fontSize: 12.5, lineHeight: 1.35 }}>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{date}</div>
                      {time && <div style={{ color: '#64748b', fontSize: 11.5 }}>{time}</div>}
                    </td>

                    {/* Action Button & Dropdown */}
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (openMenuId === r.id) {
                            setOpenMenuId(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const menuHeight = 110;
                          const top = spaceBelow < menuHeight ? (rect.top - menuHeight) : (rect.bottom + 4);
                          setMenuPos({ top, right: Math.max(16, window.innerWidth - rect.right) });
                          setOpenMenuId(r.id);
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          border: '1.5px solid #e2e8f0',
                          borderRadius: 7,
                          background: isMenuOpen ? '#eff6ff' : '#fff',
                          borderColor: isMenuOpen ? '#bfdbfe' : '#e2e8f0',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isMenuOpen ? '#1d4ed8' : '#475569',
                          fontSize: 18,
                          fontWeight: 700,
                          lineHeight: 1,
                          outline: 'none',
                        }}
                      >
                        ···
                      </button>

                      {isMenuOpen && (
                        <div
                          ref={menuRef}
                          style={{
                            position: 'fixed',
                            top: menuPos.top,
                            right: menuPos.right,
                            background: '#fff',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            zIndex: 9999,
                            minWidth: 130,
                            overflow: 'hidden',
                          }}
                        >
                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              background: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#2563eb',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              borderTop: '1px solid #f1f5f9',
                              background: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#dc2626',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with record counter and pagination matching screenshot */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1.5px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>
            Showing {fromRow} to {toRow} of {total} records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Prev button */}
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => load(page - 1, appliedSearch, appliedStatus)}
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                background: '#fff',
                color: page <= 1 ? '#94a3b8' : '#0f172a',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
              title="Previous Page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>

            {/* Windowed Page Numbers */}
            {getPaginationItems(page, lastPage).map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{
                      minWidth: 24,
                      height: 34,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    …
                  </span>
                );
              }
              const active = p === page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => load(p, appliedSearch, appliedStatus)}
                  style={{
                    minWidth: 34,
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1.5px solid ${active ? '#1d4ed8' : '#bfdbfe'}`,
                    borderRadius: 7,
                    background: active ? '#1d4ed8' : '#fff',
                    color: active ? '#fff' : '#0f172a',
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    padding: '0 8px',
                  }}
                >
                  {p}
                </button>
              );
            })}

            {/* Next button */}
            <button
              type="button"
              disabled={page >= lastPage}
              onClick={() => load(page + 1, appliedSearch, appliedStatus)}
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #bfdbfe',
                borderRadius: 7,
                background: '#fff',
                color: page >= lastPage ? '#94a3b8' : '#0f172a',
                cursor: page >= lastPage ? 'not-allowed' : 'pointer',
              }}
              title="Next Page"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>

      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 14,
            width: 480,
            maxWidth: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            border: '1.5px solid #bfdbfe',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 22px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                {modal.mode === 'edit' ? `Edit ${tab.label.replace(' Master', '')}` : tab.addLabel}
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave}>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {tab.fields.map(f => (
                  <div key={f.name}>
                    <label style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}>
                      {f.label}{f.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                    </label>
                    <input
                      type={f.type ?? 'text'}
                      step={f.step}
                      min={f.min}
                      max={f.max}
                      required={f.required}
                      value={formData[f.name] ?? ''}
                      onChange={e => setFormData(d => ({ ...d, [f.name]: e.target.value }))}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: 8,
                        fontSize: 13,
                        outline: 'none',
                        color: '#0f172a',
                      }}
                    />
                  </div>
                ))}

                {/* Status Toggle */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#475569',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}>
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData(d => ({ ...d, is_active: !d.is_active }))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: '1.5px solid',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderColor: formData.is_active ? '#16a34a' : '#dc2626',
                      background: formData.is_active ? '#dcfce7' : '#fee2e2',
                      color: formData.is_active ? '#16a34a' : '#dc2626',
                    }}
                  >
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: formData.is_active ? '#16a34a' : '#dc2626',
                      display: 'inline-block',
                    }} />
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {saveErr && (
                  <div style={{
                    color: '#dc2626',
                    fontSize: 12.5,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    padding: '9px 12px',
                  }}>
                    {saveErr}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 22px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                background: '#f8fafc',
              }}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  style={{
                    padding: '8px 18px',
                    background: '#fff',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px',
                    background: '#1d4ed8',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : (modal.mode === 'edit' ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

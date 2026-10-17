import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';

const TAB_CONFIG = {
  'gstr-1': {
    title: 'GSTR-1 – Select Client',
    subtitle: 'Select a Regular type client to view and manage GSTR-1 details.',
    defaultDealerType: 'regular',
    infoMsg: 'Only Regular type clients are listed here. Composition type clients (CMP-08) are not shown in this list.',
    detailPath: (id) => `/admin/gst-returns/gstr-1/${id}`,
  },
  'gstr-3b': {
    title: 'GSTR-3B – Client List (Admin Portal)',
    subtitle: 'Select a client to view, verify and manage GSTR-3B.',
    defaultDealerType: 'regular',
    listLayout: true,
    showInfoStrip: true,
    breadcrumbTitle: 'GSTR-3B',
    infoMsg: 'Only Regular type clients are listed here. Composition type clients (CMP-08) are not shown in this list.',
    detailPath: (id) => `/admin/gst-returns/gstr-3b/${id}`,
  },
  'cmp-08': {
    title: 'CMP-08 – Select Client',
    subtitle: 'Select a Composition type client to view and manage CMP-08 details.',
    defaultDealerType: 'composition',
    infoMsg: 'Only Composition type clients are listed here. Regular type clients are not shown in this list.',
    detailPath: (id) => `/admin/gst-returns/cmp-08/${id}`,
  },
  'gstr-2b': {
    title: 'GSTR-2B – Client List',
    subtitle: 'Select a client to view and manage GSTR-2B details.',
    defaultDealerType: 'all',
    listLayout: true,
    showInfoStrip: false,
    breadcrumbTitle: 'GSTR-2B',
    infoMsg: 'Select a client to view their GSTR-2B uploaded documents and ITC reconciliation.',
    detailPath: (id) => `/admin/gst-returns/gstr-2b/${id}`,
  },
};

export default function AdminGstReturns() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = searchParams.get('tab') || 'gstr-1';
  const config = TAB_CONFIG[tab] || TAB_CONFIG['gstr-1'];

  const [clients, setClients] = useState({ data: [], total: 0, current_page: 1, last_page: 1, per_page: 10 });
  const [loading, setLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [search, setSearch] = useState('');
  const [regType, setRegType] = useState(config.defaultDealerType);
  const [filingFreq, setFilingFreq] = useState('all');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState({ search: '', regType: config.defaultDealerType, filingFreq: 'all', status: 'active' });

  useEffect(() => {
    if (tab === 'cmp-08') {
      navigate('/admin/cmp08', { replace: true });
      return;
    }
    setSearch('');
    setRegType(config.defaultDealerType);
    setFilingFreq('all');
    setStatus('active');
    setApplied({ search: '', regType: config.defaultDealerType, filingFreq: 'all', status: 'active' });
    setPage(1);
  }, [tab, navigate, config.defaultDealerType]);

  const fetchClients = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, per_page: 10, gst_status: 'registered', directory: '1' });
      if (applied.regType && applied.regType !== 'all') params.append('dealer_type', applied.regType);
      if (applied.filingFreq && applied.filingFreq !== 'all') params.append('gst_filing_frequency', applied.filingFreq);
      if (applied.status && applied.status !== 'all') params.append('status', applied.status);
      if (applied.search) params.append('q', applied.search);

      const res = await api(`/admin/clients?${params.toString()}`);
      setClients(res || { data: [], total: 0, current_page: 1, last_page: 1, per_page: 10 });
    } catch (e) {
      console.error(e);
      setClients({ data: [], total: 0, current_page: 1, last_page: 1, per_page: 10 });
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    fetchClients(page);
  }, [fetchClients, page]);

  const handleSearch = () => {
    setApplied({ search, regType, filingFreq, status });
    setPage(1);
  };

  const handleReset = () => {
    setSearch('');
    setRegType(config.defaultDealerType);
    setFilingFreq('all');
    setStatus('active');
    setApplied({ search: '', regType: config.defaultDealerType, filingFreq: 'all', status: 'active' });
    setPage(1);
  };

  // gst_filing_frequency is the GSTR-3B cycle. GSTR-1 stays monthly for everyone, so a
  // quarterly 3B cycle on a Regular client is shown as "Monthly (QRMP)" on the GSTR-1 list,
  // while the 3B / 2B lists show the cycle itself.
  const getFilingFreq = (c) => {
    const quarterly = (c.gst_filing_frequency || '').toLowerCase() === 'quarterly' || !!c.is_qrmp;
    if (config.listLayout) return quarterly ? 'Quarterly' : 'Monthly';
    return quarterly && (c.dealer_type || 'regular').toLowerCase() !== 'composition' ? 'Monthly (QRMP)' : 'Monthly';
  };

  const totalClients = clients.total ?? (clients.data ? clients.data.length : 0);
  const perPage = clients.per_page || 10;
  const currentPage = clients.current_page || page || 1;
  const lastPage = Math.max(1, clients.last_page || Math.ceil(totalClients / perPage) || 1);

  const from = totalClients === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, totalClients);

  const pageNums = Array.from({ length: lastPage }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === lastPage || Math.abs(p - currentPage) <= 1)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);

  const breadcrumbLabel = { 'gstr-1': 'GSTR-1', 'gstr-3b': 'GSTR-3B', 'cmp-08': 'CMP-08', 'gstr-2b': 'GSTR-2B' };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif", padding: '0 0 40px' }}>
      {/* Breadcrumb for non-list layout */}
      {!config.listLayout && (
        <div className="gst-crumbs" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13 }}>
          <Link to="/admin/gst-returns" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
            GST Compliance
          </Link>
          <span style={{ color: '#2563eb', fontWeight: 600, fontSize: 13 }}>&gt;</span>
          <span style={{ color: '#2563eb', fontWeight: 500 }}>{breadcrumbLabel[tab] ?? tab.toUpperCase()}</span>
        </div>
      )}

      {/* Page Header */}
      <div className={config.listLayout ? 'gst-head gst-head-list' : 'gst-head'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
            {config.title}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#2563eb', fontWeight: 400 }}>
            {String(config.subtitle || '').replace(/-/g, '‑')}
          </p>
        </div>
        {config.listLayout ? (
          <div className="gst-crumbs gst-crumbs-right" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, paddingTop: 4 }}>
            <Link to="/admin/gst-returns" style={{ color: '#2563eb', textDecoration: 'none' }}>
              GST Compliance
            </Link>
            <span style={{ color: '#93c5fd', fontSize: 12 }}>&gt;</span>
            <span style={{ color: '#2563eb' }}>{config.breadcrumbTitle || breadcrumbLabel[tab] || tab.toUpperCase()}</span>
            <span style={{ color: '#93c5fd', fontSize: 12 }}>&gt;</span>
            <span style={{ color: '#2563eb' }}>Client List</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 18px',
              background: '#fff',
              border: '1.5px solid #2563eb',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              color: '#2563eb',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background .15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
              <path d="M10 2v8l3-3 3 3V2" />
            </svg>
            User Guide
          </button>
        )}
      </div>

      {/* Search + Filters Row (list layout) */}
      {config.listLayout && (
        <div
          className="gst-filter"
          style={{
            background: '#fff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 280px', minWidth: 240, position: 'relative' }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by Client Name / Client ID / GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 38,
                padding: '0 12px 0 36px',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
                background: '#fff',
              }}
            />
          </div>
          <LabeledSelect
            label="Registration Type"
            value={regType}
            onChange={setRegType}
            width={150}
            options={
              tab === 'gstr-3b' || tab === 'gstr-1'
                ? [['regular', 'Regular'], ['all', 'All']]
                : [['all', 'All'], ['regular', 'Regular'], ['composition', 'Composition']]
            }
          />
          <LabeledSelect
            label="Filing Frequency"
            value={filingFreq}
            onChange={setFilingFreq}
            width={150}
            options={[['all', 'All'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly']]}
          />
          <LabeledSelect
            label="Status"
            value={status}
            onChange={setStatus}
            width={130}
            options={[['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']]}
          />
          <button
            type="button"
            onClick={handleSearch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 24px',
              background: '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              height: 38,
              transition: 'background .15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 20px',
              background: '#fff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              borderRadius: 6,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              height: 38,
              transition: 'all .15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
            </svg>
            Reset
          </button>
        </div>
      )}

      {/* Search + Filters Row (standard layout) */}
      {!config.listLayout && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ flex: '1 1 300px', minWidth: 260, position: 'relative' }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by Client Name / Client ID / GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 44,
                padding: '0 12px 0 36px',
                border: '1.5px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 13,
                color: '#1e293b',
                outline: 'none',
                background: '#fff',
              }}
            />
          </div>

          {/* Registration Type Dropdown */}
          <div
            style={{
              flex: '0 0 160px',
              height: 44,
              boxSizing: 'border-box',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              background: '#fff',
              padding: '4px 10px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#2563eb', lineHeight: 1.1, pointerEvents: 'none' }}>
              Registration Type
            </span>
            <select
              value={regType}
              onChange={(e) => setRegType(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                fontWeight: 500,
                color: '#1e293b',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                appearance: 'none',
                width: '100%',
                paddingRight: 18,
                lineHeight: 1.2,
              }}
            >
              <option value="regular">Regular</option>
              <option value="composition">Composition</option>
              <option value="all">All</option>
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              style={{ position: 'absolute', right: 10, top: '55%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Filing Frequency Dropdown */}
          <div
            style={{
              flex: '0 0 160px',
              height: 44,
              boxSizing: 'border-box',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              background: '#fff',
              padding: '4px 10px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#2563eb', lineHeight: 1.1, pointerEvents: 'none' }}>
              Filing Frequency
            </span>
            <select
              value={filingFreq}
              onChange={(e) => setFilingFreq(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                fontWeight: 500,
                color: '#1e293b',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                appearance: 'none',
                width: '100%',
                paddingRight: 18,
                lineHeight: 1.2,
              }}
            >
              <option value="all">All</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Monthly (QRMP)</option>
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              style={{ position: 'absolute', right: 10, top: '55%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Status Dropdown */}
          <div
            style={{
              flex: '0 0 135px',
              height: 44,
              boxSizing: 'border-box',
              border: '1.5px solid #cbd5e1',
              borderRadius: 8,
              background: '#fff',
              padding: '4px 10px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#2563eb', lineHeight: 1.1, pointerEvents: 'none' }}>
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                fontWeight: 500,
                color: '#1e293b',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                appearance: 'none',
                width: '100%',
                paddingRight: 18,
                lineHeight: 1.2,
              }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              style={{ position: 'absolute', right: 10, top: '55%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Search Button */}
          <button
            type="button"
            onClick={handleSearch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 24px',
              background: '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              height: 44,
              transition: 'background .15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#1e40af')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#1d4ed8')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 20px',
              background: '#fff',
              color: '#2563eb',
              border: '1.5px solid #2563eb',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              height: 44,
              transition: 'all .15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
            </svg>
            Reset
          </button>
        </div>
      )}

      {/* Info Bar */}
      {(config.showInfoStrip || !config.listLayout) && config.infoMsg && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#1e40af', fontWeight: 500 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" fill="#2563eb" />
              <line x1="12" y1="10.5" x2="12" y2="16.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="12" cy="7.2" r="1.3" fill="#fff" />
            </svg>
            <span>{config.infoMsg}</span>
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1e3a8a', whiteSpace: 'nowrap', marginLeft: 24 }}>
            Total Clients: {totalClients}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="gst-table-card" style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: '#eaf3fd', borderBottom: '1.5px solid #bfdbfe' }}>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1d4ed8', fontSize: 13.5, width: 50 }}>#</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1d4ed8', fontSize: 13.5, width: 110 }}>Client ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1d4ed8', fontSize: 13.5 }}>Client Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1d4ed8', fontSize: 13.5, width: 190 }}>GSTIN</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1d4ed8', fontSize: 13.5, width: 170 }}>Filing Frequency</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1d4ed8', fontSize: 13.5, width: 130 }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1d4ed8', fontSize: 13.5, width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: 14 }}>
                  Loading clients...
                </td>
              </tr>
            ) : clients.data.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: 14 }}>
                  No clients found.
                </td>
              </tr>
            ) : (
              clients.data.map((client, idx) => {
                const isActive = client.is_active ?? client.user?.is_active ?? true;
                const clientId = client.client_code || `CL-${String(client.id).padStart(3, '0')}`;
                return (
                  <tr
                    key={client.id || idx}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background .15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#1e3a8a', fontSize: 13.5, fontWeight: 700 }}>
                      {from + idx}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#1d4ed8', fontSize: 13.5, fontWeight: 600 }}>
                      {clientId}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#1e3a8a', fontSize: 13.5, fontWeight: 600 }}>
                      {client.business_name || client.client_name}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#1e3a8a', fontSize: 13.5, fontWeight: 500 }}>
                      {client.gstin || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: config.listLayout ? '#1d4ed8' : '#1e293b', fontSize: 13.5, fontWeight: 500 }}>
                      {getFilingFreq(client)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 18px',
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: isActive ? '#dcfce7' : '#fee2e2',
                          color: isActive ? '#15803d' : '#dc2626',
                        }}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => navigate(config.detailPath(client.id))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '5px 18px',
                          background: '#fff',
                          border: '1.5px solid #bfdbfe',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1d4ed8',
                          cursor: 'pointer',
                          transition: 'all .15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#1d4ed8';
                          e.currentTarget.style.background = '#eff6ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#bfdbfe';
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          padding: '0 4px',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e3a8a' }}>
          Showing {from} to {to} of {totalClients} clients
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <PgBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </PgBtn>
          {pageNums.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} style={{ padding: '0 6px', color: '#94a3b8', fontSize: 13 }}>
                …
              </span>
            ) : (
              <PgBtn key={p} onClick={() => setPage(p)} active={currentPage === p}>
                {p}
              </PgBtn>
            )
          )}
          <PgBtn onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={currentPage >= lastPage}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </PgBtn>
        </div>
      </div>

      {/* User Guide Modal */}
      {showGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowGuide(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 500,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  <path d="M10 2v8l3-3 3 3V2" />
                </svg>
                <h3 style={{ margin: 0, fontSize: 17, color: '#1e3a8a', fontWeight: 700 }}>GSTR-1 Client Selection Guide</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5, margin: '0 0 14px' }}>
              Select a client to manage their GSTR-1 filings, upload B2B/B2C invoices, and perform monthly reconciliation.
            </p>
            <ul style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, paddingLeft: 20, margin: '0 0 16px' }}>
              <li><strong>Registration Type:</strong> Only Regular scheme clients are displayed for GSTR-1.</li>
              <li><strong>Filing Frequency:</strong> Filter between Monthly and QRMP (Monthly IFF) clients.</li>
              <li><strong>Action:</strong> Click <strong>Open</strong> to view monthly periods, invoice tables, and summary.</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                style={{
                  padding: '8px 22px',
                  background: '#1d4ed8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const LabeledSelect = ({ label, value, onChange, options, width = 150 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1e3a8a' }}>{label}</span>
    <div style={{ position: 'relative', width, height: 38, border: '1px solid #bfdbfe', borderRadius: 6, background: '#fff', boxSizing: 'border-box' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          appearance: 'none',
          padding: '0 30px 0 12px',
          fontSize: 13,
          fontWeight: 500,
          color: '#1e293b',
          cursor: 'pointer',
        }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="2.5"
        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  </div>
);

const PgBtn = ({ children, onClick, disabled, active }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      minWidth: 34,
      height: 34,
      padding: '0 8px',
      border: active ? 'none' : '1px solid #bfdbfe',
      borderRadius: 6,
      background: active ? '#1d4ed8' : disabled ? '#f8fafc' : '#fff',
      color: active ? '#fff' : disabled ? '#94a3b8' : '#1d4ed8',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 13.5,
      fontWeight: active ? 700 : 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all .15s ease',
    }}
  >
    {children}
  </button>
);

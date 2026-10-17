import { currentFyRange } from './billingUtils';

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="6" /><path d="m16 16-3.5-3.5" />
    </svg>
  );
}
function ApplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4Z" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 1 0-1.5 5.7" /><path d="M16 4v4h-4" />
    </svg>
  );
}

/**
 * Simplified filter bar for all billing document list pages.
 * Props:
 *   q / setQ             — free-text search
 *   docFrom / setDocFrom — Invoice/Document Date From
 *   docTo   / setDocTo   — Invoice/Document Date To
 *   from    / setFrom    — Creation Date From
 *   to      / setTo      — Creation Date To
 *   gstType / setGstType — B2B / B2C customer type (optional)
 *   showGstType          — show the Customer Type dropdown
 *   onApply / onClear
 */
export default function BillingDateFilters({
  q = '',          setQ,
  docFrom = '',    setDocFrom,
  docTo = '',      setDocTo,
  from = '',       setFrom,
  to = '',         setTo,
  gstType = '',    setGstType,
  showGstType = false,
  onApply,
  onClear,
  /* legacy props kept for backward compat — no-op */
  month, setMonth, fy, setFy, status, setStatus, docType, setDocType,
  showSearch = true, showDocType = false, profile = null,
  dateLabel = 'Invoice Date',
  searchHint = 'Search by invoice no., party name, GSTIN',
}) {
  const clearAll = () => {
    const next = currentFyRange();
    setQ?.('');
    setDocFrom?.(next.from);
    setDocTo?.(next.to);
    setFrom?.(next.from);
    setTo?.(next.to);
    setGstType?.('');
    onClear?.();
  };

  const F = { display: 'flex', flexDirection: 'column', gap: 4 };
  const LBL = { fontSize: 11.5, fontWeight: 700, color: '#475569' };
  const CTL = { height: 38, borderRadius: 10, border: '1px solid #d7e1ef', padding: '0 10px', fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box', width: '100%' };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', padding: '14px 16px', background: '#f8fbff', border: '1px solid #e3ebf6', borderRadius: 14, marginBottom: 16 }}>

      {/* Search */}
      {showSearch && (
        <div style={{ ...F, flex: '1 1 180px', minWidth: 160 }}>
          <span style={LBL}>Search</span>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}><SearchIcon /></span>
            <input
              style={{ ...CTL, paddingLeft: 32 }}
              placeholder={searchHint}
              value={q}
              onChange={(e) => setQ?.(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onApply?.()}
            />
          </div>
        </div>
      )}

      {/* Customer Type */}
      {showGstType && setGstType && (
        <div style={{ ...F, flex: '0 0 140px', minWidth: 120 }}>
          <span style={LBL}>Customer Type</span>
          <select style={CTL} value={gstType} onChange={(e) => setGstType?.(e.target.value)}>
            <option value="">All (B2B &amp; B2C)</option>
            <option value="b2b">B2B</option>
            <option value="b2c">B2C</option>
          </select>
        </div>
      )}

      {/* Invoice Date From */}
      {setDocFrom && (
        <div style={{ ...F, flex: '0 0 140px', minWidth: 120 }}>
          <span style={LBL}>{dateLabel} From</span>
          <input type="date" style={CTL} value={docFrom} onChange={(e) => setDocFrom?.(e.target.value)} />
        </div>
      )}

      {/* Invoice Date To */}
      {setDocTo && (
        <div style={{ ...F, flex: '0 0 140px', minWidth: 120 }}>
          <span style={LBL}>{dateLabel} To</span>
          <input type="date" style={CTL} value={docTo} onChange={(e) => setDocTo?.(e.target.value)} />
        </div>
      )}

      {/* Creation Date From */}
      {setFrom && (
        <div style={{ ...F, flex: '0 0 140px', minWidth: 120 }}>
          <span style={LBL}>Creation Date From</span>
          <input type="date" style={CTL} value={from} onChange={(e) => setFrom?.(e.target.value)} />
        </div>
      )}

      {/* Creation Date To */}
      {setTo && (
        <div style={{ ...F, flex: '0 0 140px', minWidth: 120 }}>
          <span style={LBL}>Creation Date To</span>
          <input type="date" style={CTL} value={to} onChange={(e) => setTo?.(e.target.value)} />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flex: '0 0 auto' }}>
        <button type="button" onClick={onApply}
          style={{ height: 38, padding: '0 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)', boxShadow: '0 8px 16px -8px rgba(29,78,216,.7)', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <ApplyIcon /> Apply
        </button>
        <button type="button" onClick={clearAll}
          style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid #d7e1ef', background: '#fff', color: '#475569', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <ResetIcon /> Reset
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { money } from '../billing/billingUtils';

/** Compact ₹ value for chart axis / bar labels (e.g. 12.4L, 3.2Cr). */
export function shortMoney(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return money(v);
}

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 16,
  padding: '20px 24px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
  border: '1px solid rgba(0,0,0,0.05)',
};

export function DashCard({ title, icon, iconColor = '#2563eb', badge, action, children, style }) {
  return (
    <section className="bp-dash-card" style={{ ...CARD_STYLE, height: '100%', display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--bp-navy)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && (
            <span style={{ width: 30, height: 30, borderRadius: 9, background: iconColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 6px ${iconColor}55` }}>
              {icon}
            </span>
          )}
          {title}
          {badge}
        </h3>
        {action}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </section>
  );
}

export function LiveBadge({ children = 'Live data · updates every 15s' }) {
  return (
    <span style={{ fontSize: 10, background: '#e0e7ff', color: '#3730a3', padding: '3px 10px 3px 8px', borderRadius: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4f46e5', boxShadow: '0 0 0 3px rgba(79,70,229,0.25)', flexShrink: 0 }} />
      {children}
    </span>
  );
}

const CHART_W = 720;
const CHART_H = 220;

/** Bold value box shown above a bar on hover, positioned by % so it tracks the
 * bar regardless of the SVG's actual rendered pixel size (viewBox scales uniformly). */
function ChartTooltip({ hover }) {
  if (!hover) return null;
  const leftPct = (hover.x / CHART_W) * 100;
  const topPct = (hover.topY / CHART_H) * 100;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: 'translate(-50%, calc(-100% - 10px))',
        background: '#fff',
        border: `1px solid ${hover.color}33`,
        borderRadius: 10,
        padding: '8px 12px',
        boxShadow: '0 8px 20px rgba(13, 31, 60, 0.18)',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 5,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--bp-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {hover.label} · {hover.seriesLabel}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: hover.color, lineHeight: 1.3 }}>
        {money(hover.value)}
      </div>
    </div>
  );
}

/** Monthly / quarterly Net Taxable Value + Net GST Amount trend line, pure inline SVG (no
 * chart library), with a custom bold tooltip that appears immediately on hover instead of the
 * browser's slow-to-appear native SVG <title> tooltip. "Net" = Tax Invoice + Bill of Supply +
 * Debit Note − Credit Note, computed server-side. */
export function SalesBarChart({ data }) {
  const rows = Array.isArray(data) ? data : [];
  const [hover, setHover] = useState(null);
  if (!rows.length) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 12px 8px' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <p style={{ color: 'var(--bp-muted)', fontSize: 13, margin: 0 }}>No billing activity yet for this period.</p>
      </div>
    );
  }

  // Net figures can dip below zero in a period where credit notes outweigh sales — the line
  // still plots that dip, but the baseline (0) stays pinned to the chart's bottom edge rather
  // than the axis re-centering, so every other period stays readable at a glance.
  const max = Math.max(1, ...rows.map((r) => Math.max(r.taxable_value || 0, r.gst_amount || 0)));
  const padLeft = 8;
  const padTop = 34; // headroom so the topmost point's tooltip never needs to render above the chart
  const padBottom = 8; // month labels now render as HTML below the SVG, not as SVG <text>
  const chartH = CHART_H - padBottom;
  const groupW = (CHART_W - padLeft) / rows.length;
  const plotH = chartH - padTop;

  const showTip = (x, topY, label, seriesLabel, value, color) =>
    setHover({ x, topY, label, seriesLabel, value, color });

  const pointX = (i) => padLeft + i * groupW + groupW / 2;
  const pointY = (v) => chartH - (Math.max(v || 0, 0) / max) * plotH;

  const series = [
    { key: 'taxable_value', label: 'Net Taxable Value', color: '#2563eb' },
    { key: 'gst_amount', label: 'Net GST Amount', color: '#15803d' },
  ];

  return (
    // The tooltip lives in this outer, non-scrolling wrapper (not the overflow-x:auto one below) —
    // `overflow-x: auto` implicitly forces `overflow-y` to clip too, which was hiding the tooltip
    // whenever a point (like the tallest Net Taxable Value point) reached near the top of the chart.
    <div style={{ position: 'relative' }}>
      <ChartTooltip hover={hover} />
      {/* Plain HTML div for the leave handler — SVG elements can miss mouseleave when the
          cursor exits fast across a child shape's edge; a wrapping HTML div doesn't have that quirk. */}
      <div style={{ overflowX: 'auto' }} onMouseLeave={() => setHover(null)}>
        <div style={{ minWidth: 560 }}>
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img"
            aria-label="Monthly sales overview"
          >
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={padLeft} x2={CHART_W} y1={chartH - plotH * f} y2={chartH - plotH * f} stroke="#eef2f7" strokeWidth="1" />
            ))}
            {series.map(({ key, label, color }) => (
              <polyline
                key={key}
                points={rows.map((r, i) => `${pointX(i)},${pointY(r[key])}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {rows.map((r, i) => (
              <g key={r.period}>
                {series.map(({ key, label, color }) => (
                  <circle
                    key={key}
                    cx={pointX(i)}
                    cy={pointY(r[key])}
                    r="4.5"
                    fill="#fff"
                    stroke={color}
                    strokeWidth="2.5"
                    onMouseEnter={() => showTip(pointX(i), pointY(r[key]), r.label, label, r[key], color)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </g>
            ))}
          </svg>
          {/* Month labels as plain HTML, not SVG <text> — an SVG scales its whole coordinate
              system (viewBox) to fit the card, which was quietly shrinking "10px" text below its
              true rendered size whenever the card was narrower than the chart's 720-unit viewBox.
              HTML text has no such scaling, so this renders at the exact same size as the
              GSTR-1 / GSTR-3B period labels below. */}
          <div style={{ display: 'flex', marginTop: 4 }}>
            {rows.map((r) => (
              <span key={r.period} style={{ flex: '1 0 0', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#000' }}>
                {r.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--bp-muted)' }}>
        {series.map(({ key, label, color }) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** filed = actually filed. pending = past due date and still not filed (overdue).
 * upcoming = due date hasn't arrived yet — not late, just not due. */
const STATUS_STYLE = {
  filed: { bg: '#dcfce7', fg: '#15803d', icon: '✓', text: 'Filed' },
  pending: { bg: '#fef3c7', fg: '#b45309', icon: '!', text: 'Pending' },
  upcoming: { bg: '#e2e8f0', fg: '#475569', icon: '•', text: 'Upcoming' },
};

function shortDueDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

const STATUS_ICON = {
  filed: <polyline points="20 6 9 17 4 12" />,
  pending: <><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  upcoming: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
};

function PeriodCard({ period }) {
  const s = STATUS_STYLE[period.status] || STATUS_STYLE.upcoming;
  const key = STATUS_STYLE[period.status] ? period.status : 'upcoming';
  const due = period.due_date ? shortDueDate(period.due_date) : '';
  return (
    <div
      className="bp-period-card"
      title={due ? `${period.label} — ${s.text}, due ${due}` : `${period.label} — ${s.text}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        flexShrink: 0, flex: '1 0 88px', minWidth: 88, padding: '12px 6px 10px', scrollSnapAlign: 'start',
        background: s.bg, borderRadius: 12, border: `1px solid ${s.fg}2e`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 16px -10px ${s.fg}`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{ fontSize: 12, color: 'var(--bp-navy)', fontWeight: 800, whiteSpace: 'nowrap' }}>{period.label}</span>
      <span style={{
        width: 30, height: 30, borderRadius: '50%', background: '#fff', color: s.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${s.fg}44`, flexShrink: 0, boxShadow: `0 4px 10px -6px ${s.fg}`,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{STATUS_ICON[key]}</svg>
      </span>
      <span style={{ fontSize: 10, color: s.fg, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.text}</span>
      {due && <span style={{ fontSize: 9.5, color: 'var(--bp-muted)', fontWeight: 600, textAlign: 'center', lineHeight: 1.3, whiteSpace: 'nowrap' }}>Due {due.replace(/ \d{4}$/, '')}</span>}
    </div>
  );
}

/** One GSTR-1 / GSTR-3B / CMP-08 row: every period of the year as a tile (no scrolling),
 * with its due date, plus an X/Total filed count and a progress bar. */
function ComplianceRow({ label, row }) {
  if (!row) return null;
  const allFiled = row.total > 0 && row.filed_count === row.total;
  const pct = row.total > 0 ? Math.round((row.filed_count / row.total) * 100) : 0;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--bp-navy)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
          background: allFiled ? '#dcfce7' : '#eff6ff', color: allFiled ? '#15803d' : '#2563eb',
        }}>
          {row.filed_count}/{row.total} filed
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: '#e8eef6', overflow: 'hidden', marginBottom: 12 }} aria-hidden="true">
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: allFiled ? '#16a34a' : 'linear-gradient(90deg,#2563eb,#60a5fa)', transition: 'width 0.4s ease' }} />
      </div>
      <div className="bp-compliance-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 2px 8px', scrollSnapType: 'x proximity' }}>
        {row.periods.map((p) => <PeriodCard key={p.period} period={p} />)}
      </div>
    </div>
  );
}

export function ComplianceStatus({ compliance, financialYear, locked = false }) {
  if (locked) {
    return (
      <p style={{ color: 'var(--bp-muted)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
        GST Compliance isn't included in your current subscription. See "View Full Compliance Report" below for details.
      </p>
    );
  }
  if (!compliance) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ height: 14, borderRadius: 6, background: '#f1f5f9', width: i === 0 ? '40%' : '100%' }} />
        ))}
        <p style={{ color: 'var(--bp-muted)', fontSize: 13, margin: '4px 0 0' }}>Loading compliance status…</p>
      </div>
    );
  }
  // GSTR-1 and GSTR-3B are tracked on independent cycles (QRMP allows monthly GSTR-1 via IFF
  // alongside quarterly GSTR-3B) — each row's label reflects only its own frequency.
  const cycleLabel = (f) => (f === 'quarterly' ? 'Quarterly' : 'Monthly');
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginBottom: 12, fontWeight: 600 }}>
        Financial Year {financialYear}
      </div>
      {compliance.cmp08 ? (
        // Composition dealers file CMP-08, not GSTR-1/GSTR-3B — a single row, always quarterly.
        <ComplianceRow label="CMP-08 (Quarterly)" row={compliance.cmp08} />
      ) : (
        <>
          <ComplianceRow
            label={`GSTR-1 (${
              compliance.gstr1_frequency === 'quarterly'
                ? 'Quarterly'
                : (compliance.gstr3b_frequency === 'quarterly' ? 'Monthly (QRMP)' : 'Monthly')
            })`}
            row={compliance.gstr1}
          />
          <ComplianceRow label={`GSTR-3B (${cycleLabel(compliance.gstr3b_frequency)})`} row={compliance.gstr3b} />
        </>
      )}
    </div>
  );
}

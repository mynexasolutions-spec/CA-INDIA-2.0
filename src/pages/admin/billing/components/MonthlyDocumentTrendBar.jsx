import { useMemo, useState } from 'react';
import { BILLING_DOC_TYPES } from '../billingConstants';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthLabel(monthKey, fallbackLabel) {
  if (typeof monthKey === 'string' && monthKey.includes('-')) {
    const [yearStr, monthStr] = monthKey.split('-');
    const mNum = parseInt(monthStr, 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${MONTH_NAMES[mNum - 1]} ${yearStr}`;
    }
  }
  return fallbackLabel || monthKey;
}

function getNiceMax(val) {
  if (val <= 0) return 10;
  if (val <= 5) return 5;
  if (val <= 10) return 10;
  if (val <= 20) return 20;
  if (val <= 30) return 30;
  if (val <= 50) return 50;
  if (val <= 100) return 100;
  const power = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / power) * power;
}

export default function MonthlyDocumentTrendBar({ monthlyTrend = [] }) {
  const [tooltip, setTooltip] = useState(null);

  // Compute maximum individual bar count across all 12 months & 6 types
  const { maxVal, isAllZero, monthsData } = useMemo(() => {
    let max = 0;
    const formatted = (monthlyTrend || []).map((m) => {
      const monthLabel = formatMonthLabel(m.month, m.label);
      const typeCounts = {};
      BILLING_DOC_TYPES.forEach((t) => {
        const count = Number(m.types?.[t.key] ?? m[t.key] ?? 0);
        typeCounts[t.key] = count;
        if (count > max) max = count;
      });
      return {
        ...m,
        formattedLabel: monthLabel,
        typeCounts,
      };
    });

    return {
      maxVal: max,
      isAllZero: max === 0,
      monthsData: formatted,
    };
  }, [monthlyTrend]);

  // Chart layout metrics
  const chartWidth = 780;
  const chartHeight = 250;
  const marginTop = 20;
  const marginBottom = 45;
  const marginLeft = 38;
  const marginRight = 16;

  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  const niceMax = getNiceMax(maxVal);
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((niceMax / tickCount) * i));

  const monthCount = monthsData.length || 12;
  const groupWidth = plotWidth / Math.max(monthCount, 1);
  const barWidth = 6;
  const barGap = 1.5;
  const totalBarsWidth = BILLING_DOC_TYPES.length * barWidth + (BILLING_DOC_TYPES.length - 1) * barGap;
  const groupOffset = (groupWidth - totalBarsWidth) / 2;

  return (
    <div style={{ width: '100%' }}>
      {/* Scrollable Container on narrow screens */}
      <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
        <div style={{ minWidth: 720, position: 'relative' }}>
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ display: 'block', overflow: 'visible' }}
          >
            {/* Horizontal Gridlines & Y-axis Ticks */}
            {yTicks.map((tickVal) => {
              const y = marginTop + plotHeight - (tickVal / niceMax) * plotHeight;
              return (
                <g key={tickVal}>
                  <line
                    x1={marginLeft}
                    y1={y}
                    x2={chartWidth - marginRight}
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth={1}
                  />
                  <text
                    x={marginLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize={11}
                    fill="#94a3b8"
                    fontWeight={500}
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {/* X-axis Baseline */}
            <line
              x1={marginLeft}
              y1={marginTop + plotHeight}
              x2={chartWidth - marginRight}
              y2={marginTop + plotHeight}
              stroke="#cbd5e1"
              strokeWidth={1}
            />

            {/* All-Zero State Notice inside chart */}
            {isAllZero && (
              <text
                x={marginLeft + plotWidth / 2}
                y={marginTop + plotHeight / 2}
                textAnchor="middle"
                fontSize={13}
                fill="#94a3b8"
                fontWeight={600}
              >
                No document activity in this financial year
              </text>
            )}

            {/* Month Grouped Bars & Month Labels */}
            {monthsData.map((monthItem, mIdx) => {
              const groupX = marginLeft + mIdx * groupWidth;
              const centerX = groupX + groupWidth / 2;

              return (
                <g key={monthItem.month || mIdx}>
                  {/* Month X-axis Label (e.g. Apr 2026) */}
                  <text
                    x={centerX}
                    y={marginTop + plotHeight + 20}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#64748b"
                    fontWeight={500}
                  >
                    {monthItem.formattedLabel}
                  </text>

                  {/* 6 Grouped Bars */}
                  {!isAllZero &&
                    BILLING_DOC_TYPES.map((typeDef, tIdx) => {
                      const count = monthItem.typeCounts[typeDef.key] || 0;
                      const barX = groupX + groupOffset + tIdx * (barWidth + barGap);
                      const barH = count > 0 ? Math.max((count / niceMax) * plotHeight, 3) : 0;
                      const barY = marginTop + plotHeight - barH;

                      return (
                        <rect
                          key={typeDef.key}
                          x={barX}
                          y={barY}
                          width={barWidth}
                          height={barH}
                          fill={typeDef.color}
                          rx={1.5}
                          style={{
                            cursor: count > 0 ? 'pointer' : 'default',
                            transition: 'opacity 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              month: monthItem.formattedLabel,
                              label: typeDef.pluralLabel,
                              count,
                              color: typeDef.color,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      );
                    })}
                </g>
              );
            })}
          </svg>

          {/* Floating Hover Tooltip */}
          {tooltip && (
            <div
              style={{
                position: 'fixed',
                left: tooltip.x,
                top: tooltip.y - 8,
                transform: 'translate(-50%, -100%)',
                background: '#0f172a',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                whiteSpace: 'nowrap',
                zIndex: 1000,
              }}
            >
              <div style={{ color: '#94a3b8', fontSize: 10.5, marginBottom: 2 }}>{tooltip.month}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: tooltip.color,
                  }}
                />
                <span>{tooltip.label}:</span>
                <span style={{ color: '#38bdf8' }}>{tooltip.count}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend below chart */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px solid #f1f5f9',
        }}
      >
        {BILLING_DOC_TYPES.map((typeDef) => (
          <div key={typeDef.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: typeDef.color,
              }}
            />
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
              {typeDef.pluralLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

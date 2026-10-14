import { useState } from 'react';
import { BILLING_DOC_TYPES } from '../billingConstants';

/**
 * Pure SVG Donut Chart showing document distribution by commercial type.
 * Segments and legend reflect the 6 types using colors from billingConstants.js.
 */
export default function DocumentDistributionDonut({ cards = {}, donut = [] }) {
  const [hoveredKey, setHoveredKey] = useState(null);

  // Normalize counts from either cards object or donut array
  const donutCounts = {};
  if (Array.isArray(donut) && donut.length > 0) {
    donut.forEach((item) => {
      donutCounts[item.type] = Number(item.count || 0);
    });
  } else {
    BILLING_DOC_TYPES.forEach((t) => {
      donutCounts[t.key] = Number(cards[t.key] || 0);
    });
  }

  const total = Number(cards.total ?? Object.values(donutCounts).reduce((a, b) => a + b, 0));

  // Circle dimensions
  const size = 200;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Build segments with offset
  let accumulatedPercent = 0;
  const segments = BILLING_DOC_TYPES.map((typeDef) => {
    const count = donutCounts[typeDef.key] || 0;
    const percent = total > 0 ? count / total : 0;
    const strokeDasharray = `${percent * circumference} ${circumference * (1 - percent)}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return {
      ...typeDef,
      count,
      percent: Math.round(percent * 100),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        flexWrap: 'wrap',
        minHeight: 220,
      }}
    >
      {/* SVG Donut Chart */}
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0 ? (
            /* Empty State: Grey Ring */
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
            />
          ) : (
            segments.map((seg) => {
              if (seg.count === 0) return null;
              const isHovered = hoveredKey === seg.key;
              return (
                <circle
                  key={seg.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{
                    transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                    cursor: 'pointer',
                    opacity: hoveredKey && !isHovered ? 0.6 : 1,
                  }}
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                />
              );
            })
          )}
        </svg>

        {/* Center Text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: 12,
          }}
        >
          {total === 0 ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#94a3b8' }}>0</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', lineHeight: 1.2, marginTop: 2 }}>
                No documents in this FY
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                {Number(total).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginTop: 2 }}>
                Documents
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200, flex: 1 }}>
        {segments.map((seg) => {
          const isHovered = hoveredKey === seg.key;
          return (
            <div
              key={seg.key}
              onMouseEnter={() => setHoveredKey(seg.key)}
              onMouseLeave={() => setHoveredKey(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: 6,
                background: isHovered ? '#f8fafc' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: seg.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    color: isHovered ? '#0f172a' : '#334155',
                    fontWeight: isHovered ? 700 : 500,
                  }}
                >
                  {seg.pluralLabel}
                </span>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: seg.count > 0 ? '#0f172a' : '#94a3b8',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {seg.count} {total > 0 && <span style={{ fontWeight: 500, color: '#64748b' }}>({seg.percent}%)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Site-wide date picker.
 *
 * Replaces the browser's native calendar popup for every <input type="date"> with one
 * consistent, themed calendar. The input stays the source of truth: choosing a day writes
 * YYYY-MM-DD to it and fires native `input` / `change` events, so React forms keep working
 * unchanged (min / max / disabled / readOnly are respected). Typing into the field still works.
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseIso = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  if (!m) return null;
  return { y: +m[1], m: +m[2] - 1, d: +m[3] };
};
const todayParts = () => {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
};

const isPickable = (el) =>
  el instanceof HTMLInputElement && (el.type === 'date' || el.type === 'month') && !el.disabled && !el.readOnly;
const parseYm = (v) => {
  const m = /^(\d{4})-(\d{2})$/.exec(v || '');
  return m ? { y: +m[1], m: +m[2] - 1, d: 1 } : null;
};

function setNativeValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export default function DatePickerEnhancer() {
  const [state, setState] = useState(null); // { el, y, m, view, yearBase, pos }
  const popRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = state;

  const close = useCallback(() => setState(null), []);

  const place = useCallback((el) => {
    const r = el.getBoundingClientRect();
    const W = 296;
    const H = 360;
    let left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
    let top = r.bottom + 6;
    if (top + H > window.innerHeight - 8 && r.top - H - 6 > 8) top = r.top - H - 6;
    return { left, top };
  }, []);

  const open = useCallback((el) => {
    const isMonth = el.type === 'month';
    const cur = (isMonth ? parseYm(el.value) : parseIso(el.value)) || todayParts();
    setState({ el, y: cur.y, m: cur.m, view: isMonth ? 'months' : 'days', yearBase: Math.floor(cur.y / 12) * 12, pos: place(el) });
  }, [place]);

  // open / close wiring
  useEffect(() => {
    const onClick = (e) => {
      const t = e.target;
      const cur = stateRef.current;
      if (cur && popRef.current?.contains(t)) return;
      const input = t instanceof Element ? t.closest('input[type="date"], input[type="month"]') : null;
      if (input && isPickable(input)) {
        e.preventDefault();
        if (cur && cur.el === input) return;
        open(input);
        return;
      }
      if (cur) close();
    };
    const onKey = (e) => {
      const cur = stateRef.current;
      if (!cur) return;
      if (e.key === 'Escape') { e.preventDefault(); const el = cur.el; close(); el.focus(); }
    };
    const onReflow = () => {
      const cur = stateRef.current;
      if (cur) setState({ ...cur, pos: place(cur.el) });
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, close, place]);

  useLayoutEffect(() => { if (state) popRef.current?.focus({ preventScroll: true }); }, [state?.el]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;
  const { el, y, m, view, yearBase, pos } = state;

  const isMonthInput = el.type === 'month';
  const parseVal = isMonthInput ? parseYm : parseIso;
  const min = parseVal(el.min);
  const max = parseVal(el.max);
  const selected = parseVal(el.value);
  const today = todayParts();
  const cmp = (a, b) => (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
  const blocked = (d) => (min && cmp(d, min) < 0) || (max && cmp(d, max) > 0);

  const choose = (d) => {
    if (blocked(d)) return;
    setNativeValue(el, toIso(d.y, d.m, d.d));
    close();
    el.focus();
  };
  const monthBlocked = (yy, mm) => (min && (yy - min.y || mm - min.m) < 0) || (max && (yy - max.y || mm - max.m) > 0);
  const chooseMonth = (mm) => {
    if (monthBlocked(y, mm)) return;
    setNativeValue(el, `${y}-${pad(mm + 1)}`);
    close();
    el.focus();
  };
  const clear = () => { if (!el.required) { setNativeValue(el, ''); } close(); el.focus(); };
  const goThisMonth = () => {
    if (!monthBlocked(today.y, today.m)) { setNativeValue(el, `${today.y}-${pad(today.m + 1)}`); close(); el.focus(); } else setState({ ...state, y: today.y, m: today.m });
  };
  const goToday = () => { if (!blocked(today)) choose(today); else setState({ ...state, y: today.y, m: today.m, view: 'days' }); };

  const shiftMonth = (delta) => {
    const nm = m + delta;
    setState({ ...state, y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 });
  };

  // 6 x 7 grid
  const first = new Date(y, m, 1).getDay();
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const dt = new Date(y, m, 1 - first + i);
    cells.push({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), out: dt.getMonth() !== m });
  }

  const onGridKey = (e) => {
    const base = selected || { y, m, d: 1 };
    const step = (days) => {
      const dt = new Date(base.y, base.m, base.d + days);
      setNativeValue(el, toIso(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      setState({ ...stateRef.current, y: dt.getFullYear(), m: dt.getMonth() });
    };
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-7); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); step(7); }
    else if (e.key === 'PageUp') { e.preventDefault(); shiftMonth(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); shiftMonth(1); }
    else if (e.key === 'Enter') { e.preventDefault(); close(); el.focus(); }
  };

  return (
    <div
      ref={popRef}
      className="dp-pop"
      role="dialog"
      aria-label={isMonthInput ? 'Choose month' : 'Choose date'}
      tabIndex={-1}
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onGridKey}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="dp-head">
        <button type="button" className="dp-nav" aria-label="Previous" onClick={() => (view === 'years' ? setState({ ...state, yearBase: yearBase - 12 }) : view === 'months' ? setState({ ...state, y: y - 1 }) : shiftMonth(-1))}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button type="button" className="dp-title" onClick={() => setState({ ...state, view: isMonthInput ? (view === 'months' ? 'years' : 'months') : (view === 'days' ? 'months' : view === 'months' ? 'years' : 'days'), yearBase: Math.floor(y / 12) * 12 })}>
          {view === 'years' ? `${yearBase} – ${yearBase + 11}` : view === 'months' ? y : `${MONTHS[m]} ${y}`}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <button type="button" className="dp-nav" aria-label="Next" onClick={() => (view === 'years' ? setState({ ...state, yearBase: yearBase + 12 }) : view === 'months' ? setState({ ...state, y: y + 1 }) : shiftMonth(1))}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      {view === 'days' && (
        <>
          <div className="dp-week">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="dp-grid">
            {cells.map((c) => {
              const isSel = selected && cmp(c, selected) === 0;
              const isToday = cmp(c, today) === 0;
              const off = blocked(c);
              return (
                <button
                  key={`${c.y}-${c.m}-${c.d}`}
                  type="button"
                  disabled={off}
                  className={`dp-day${c.out ? ' is-out' : ''}${isSel ? ' is-sel' : ''}${isToday ? ' is-today' : ''}`}
                  onClick={() => choose(c)}
                >
                  {c.d}
                </button>
              );
            })}
          </div>
        </>
      )}

      {view === 'months' && (
        <div className="dp-cells">
          {SHORT_MONTHS.map((name, i) => (
            <button key={name} type="button" disabled={isMonthInput && monthBlocked(y, i)} className={`dp-cell${isMonthInput ? (selected && selected.y === y && selected.m === i ? ' is-sel' : '') : (i === m ? ' is-sel' : '')}${y === today.y && i === today.m ? ' is-today' : ''}`} onClick={() => (isMonthInput ? chooseMonth(i) : setState({ ...state, m: i, view: 'days' }))}>{name}</button>
          ))}
        </div>
      )}

      {view === 'years' && (
        <div className="dp-cells">
          {Array.from({ length: 12 }, (_, i) => yearBase + i).map((yr) => (
            <button key={yr} type="button" className={`dp-cell${yr === y ? ' is-sel' : ''}${yr === today.y ? ' is-today' : ''}`} onClick={() => setState({ ...state, y: yr, view: 'months' })}>{yr}</button>
          ))}
        </div>
      )}

      <div className="dp-foot">
        <button type="button" className="dp-link" onClick={clear} disabled={el.required}>Clear</button>
        <button type="button" className="dp-link dp-today" onClick={isMonthInput ? goThisMonth : goToday}>{isMonthInput ? 'This month' : 'Today'}</button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Replaces the browser's native <select> popup with a styled listbox for every
 * single-choice <select> inside the admin shell (.bp-shell-admin).
 *
 * The <select> element stays the source of truth: choosing an option sets its
 * value and fires a bubbling `change` event, so existing React `onChange`
 * handlers (controlled or not) keep working without any per-page edits.
 */

const SHELL = '.bp-shell-admin';
const MAX_HEIGHT = 288;
const GAP = 6;

const setNativeValue = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

const isEnhanceable = (el) =>
  el instanceof HTMLSelectElement && !el.multiple && !(el.size > 1) && !el.disabled && !!el.closest(SHELL);

const readItems = (el) => {
  const items = [];
  Array.from(el.children).forEach((child) => {
    if (child.tagName === 'OPTGROUP') {
      items.push({ type: 'group', label: child.label });
      Array.from(child.children).forEach((o) => items.push(optionItem(o, child.disabled)));
    } else if (child.tagName === 'OPTION') {
      items.push(optionItem(child, false));
    }
  });
  return items;
};

const optionItem = (o, groupDisabled) => ({
  type: 'option',
  value: o.value,
  label: o.textContent,
  disabled: o.disabled || groupDisabled,
  hidden: o.hidden,
});

export default function AdminSelectEnhancer() {
  const [state, setState] = useState(null); // { el, items, rect, active }
  const [placement, setPlacement] = useState({ top: 0, left: 0, width: 0, up: false });
  const listRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = state;

  const close = useCallback(() => {
    const cur = stateRef.current;
    if (cur) cur.el.removeAttribute('data-ss-open');
    setState(null);
  }, []);

  const open = useCallback((el) => {
    const items = readItems(el);
    const selectedIdx = items.findIndex((it) => it.type === 'option' && it.value === el.value);
    const firstEnabled = items.findIndex((it) => it.type === 'option' && !it.disabled && !it.hidden);
    el.setAttribute('data-ss-open', '1');
    setState({ el, items, active: selectedIdx >= 0 ? selectedIdx : firstEnabled });
  }, []);

  const choose = useCallback(
    (idx) => {
      const cur = stateRef.current;
      if (!cur) return;
      const it = cur.items[idx];
      if (!it || it.type !== 'option' || it.disabled) return;
      const { el } = cur;
      close();
      if (el.value !== it.value) setNativeValue(el, it.value);
      el.focus();
    },
    [close]
  );

  const move = useCallback((dir) => {
    setState((cur) => {
      if (!cur) return cur;
      const { items } = cur;
      let i = cur.active;
      for (let n = 0; n < items.length; n += 1) {
        i = (i + dir + items.length) % items.length;
        if (items[i].type === 'option' && !items[i].disabled && !items[i].hidden) break;
      }
      return { ...cur, active: i };
    });
  }, []);

  // Open on mouse / keyboard, close on outside interaction.
  useEffect(() => {
    const onMouseDown = (e) => {
      const cur = stateRef.current;
      const target = e.target instanceof Element ? e.target : null;
      if (cur && target && listRef.current?.contains(target)) return; // click inside popup
      const sel = target?.closest('select');
      if (sel && isEnhanceable(sel)) {
        e.preventDefault(); // suppress native popup
        sel.focus();
        if (cur && cur.el === sel) close();
        else {
          if (cur) cur.el.removeAttribute('data-ss-open');
          open(sel);
        }
        return;
      }
      if (cur) close();
    };

    const onKeyDown = (e) => {
      const cur = stateRef.current;
      if (cur) {
        switch (e.key) {
          case 'ArrowDown': e.preventDefault(); move(1); break;
          case 'ArrowUp': e.preventDefault(); move(-1); break;
          case 'Home': e.preventDefault(); setState((s) => s && { ...s, active: s.items.findIndex((i) => i.type === 'option' && !i.disabled) }); break;
          case 'End': e.preventDefault(); setState((s) => s && { ...s, active: s.items.map((i, n) => (i.type === 'option' && !i.disabled ? n : -1)).filter((n) => n >= 0).pop() }); break;
          case 'Enter':
          case ' ': e.preventDefault(); choose(cur.active); break;
          case 'Escape': e.preventDefault(); close(); cur.el.focus(); break;
          case 'Tab': close(); break;
          default: break;
        }
        return;
      }
      const sel = e.target;
      if (isEnhanceable(sel) && [' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        open(sel);
      }
    };

    const onScrollOrResize = (e) => {
      if (e.type === 'scroll' && listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      if (stateRef.current) close();
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, close, move, choose]);

  // Position the popup under (or above) the select once it is measurable.
  useLayoutEffect(() => {
    if (!state) return;
    const r = state.el.getBoundingClientRect();
    const listH = Math.min(listRef.current?.scrollHeight ?? MAX_HEIGHT, MAX_HEIGHT);
    const spaceBelow = window.innerHeight - r.bottom - GAP - 8;
    const up = spaceBelow < listH && r.top > spaceBelow;
    setPlacement({
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 160) - 8)),
      top: up ? r.top - GAP : r.bottom + GAP,
      width: r.width,
      up,
      maxHeight: Math.max(120, Math.min(MAX_HEIGHT, (up ? r.top - GAP : spaceBelow) - 4)),
    });
  }, [state?.el, state?.items]);

  // Keep the active row visible while navigating with the keyboard.
  useEffect(() => {
    if (!state || !listRef.current) return;
    listRef.current.querySelector('[data-active="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [state?.active]);

  if (!state) return null;

  const { items, el, active } = state;
  const style = {
    left: placement.left,
    minWidth: Math.max(placement.width, 160),
    maxHeight: placement.maxHeight ?? MAX_HEIGHT,
    ...(placement.up ? { bottom: window.innerHeight - placement.top } : { top: placement.top }),
  };

  return createPortal(
    <div
      ref={listRef}
      className={`ss-list${placement.up ? ' ss-up' : ''}`}
      role="listbox"
      style={style}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        if (it.type === 'group') {
          return <div key={`g${i}`} className="ss-group">{it.label}</div>;
        }
        if (it.hidden) return null;
        const selected = it.value === el.value;
        return (
          <div
            key={`o${i}`}
            role="option"
            aria-selected={selected}
            aria-disabled={it.disabled || undefined}
            data-active={i === active ? '1' : undefined}
            className={`ss-opt${selected ? ' ss-selected' : ''}${i === active ? ' ss-active' : ''}${it.disabled ? ' ss-disabled' : ''}`}
            onMouseEnter={() => !it.disabled && setState((s) => s && { ...s, active: i })}
            onClick={() => choose(i)}
          >
            <span className="ss-label">{it.label || ' '}</span>
            {selected && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
}

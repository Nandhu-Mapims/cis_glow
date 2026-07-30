import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCommandPalette } from './CommandPaletteContext';
import { buildMenuHref, isMenuLinkActive } from '../utils/legacyRoutes';
import { normalizeMenuQuery, searchMenuItems } from '../utils/menuUtils';

const RECENT_KEY = 'cis_cmdk_recent_v1';
const RECENT_MAX = 6;

function readRecent() {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecent(item) {
  try {
    const prev = readRecent().filter((r) => r.id !== item.id);
    const next = [item, ...prev].slice(0, RECENT_MAX);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

/**
 * Global "jump to a screen" palette (Ctrl+K / Cmd+K). Searches the same menu
 * data TopNav/Sidebar already render — see utils/menuUtils.js.
 */
export default function CommandPalette({ menu = [] }) {
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const recent = useMemo(() => (open && !normalizeMenuQuery(query) ? readRecent() : []), [open, query]);
  const results = useMemo(() => searchMenuItems(menu, query, 30), [menu, query]);
  const visible = normalizeMenuQuery(query) ? results : recent;

  useEffect(() => {
    function onKeyDown(e) {
      const isCombo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCombo) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const go = (item) => {
    const href = buildMenuHref(item.link);
    writeRecent(item);
    setOpen(false);
    if (href) {
      navigate(href);
    } else {
      window.location.hash = `#legacy-${item.link}`;
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = visible[activeIndex];
      if (item) go(item);
    }
  };

  return (
    <div
      className="cis-cmdk-overlay"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="cis-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cis-cmdk-search">
          <i className="fa fa-search" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a screen… (e.g. exam batch, fee slips, student profile)"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search screens"
          />
          <kbd className="cis-cmdk-esc">Esc</kbd>
        </div>

        <div className="cis-cmdk-list" ref={listRef} role="listbox">
          {!normalizeMenuQuery(query) && !recent.length && (
            <div className="cis-cmdk-empty">Start typing to search every screen in the menu.</div>
          )}
          {normalizeMenuQuery(query) && !results.length && (
            <div className="cis-cmdk-empty">No screens match &ldquo;{query}&rdquo;.</div>
          )}
          {!normalizeMenuQuery(query) && recent.length > 0 && (
            <div className="cis-cmdk-group-label">Recently visited</div>
          )}
          {visible.map((item, idx) => {
            const active = isMenuLinkActive(item.link, pathname, search);
            return (
              <button
                key={item.id}
                type="button"
                data-idx={idx}
                className={`cis-cmdk-item${idx === activeIndex ? ' is-active' : ''}${active ? ' is-current' : ''}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => go(item)}
                role="option"
                aria-selected={idx === activeIndex}
              >
                <i className={item.categoryIcon || item.icon || 'fa fa-circle-o'} aria-hidden="true" />
                <span className="cis-cmdk-item-body">
                  <span className="cis-cmdk-item-label">{item.label}</span>
                  <span className="cis-cmdk-item-meta">{item.category}{item.group ? ` › ${item.group}` : ''}</span>
                </span>
                {active && <span className="cis-cmdk-item-current">Current</span>}
              </button>
            );
          })}
        </div>

        <div className="cis-cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

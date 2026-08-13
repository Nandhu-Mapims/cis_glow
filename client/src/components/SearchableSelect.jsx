import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './SearchableSelect.css';

function matchesSearch(label, query) {
  if (!query) return true;
  return label.toLowerCase().includes(query.toLowerCase());
}

/**
 * Single-select replacement for a native <select> — same value/onChange
 * contract, but with a search box that filters by substring anywhere in the
 * label (not just the browser's native "jump to the option starting with
 * the typed letter" behavior), for lists too long to scan by eye.
 *
 * The dropdown panel renders through a portal into document.body instead of
 * inline, positioned from the trigger's bounding rect. Several setup-screen
 * card wrappers use `overflow-x: auto` (for wide tables), which per the CSS
 * spec forces `overflow-y` to compute as `auto` too — that would clip an
 * inline-positioned panel instead of letting it float over the page.
 */
export default function SearchableSelect({
  options = [],
  groups = null,
  value = '',
  onChange,
  placeholder = '--Select One--',
  searchPlaceholder = 'Type to search...',
  disabled = false,
  id,
  clearable = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const flatOptions = useMemo(
    () => (groups ? groups.flatMap((g) => g.options) : options),
    [groups, options],
  );

  const optionByValue = useMemo(
    () => new Map(flatOptions.map((o) => [String(o.value), o])),
    [flatOptions],
  );
  const selected = value ? optionByValue.get(String(value)) : null;

  const q = query.trim();

  const filteredGroups = useMemo(() => {
    if (!groups) return null;
    return groups
      .map((g) => ({ ...g, options: g.options.filter((opt) => matchesSearch(opt.label, q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, q]);

  const filtered = useMemo(() => {
    if (groups) return filteredGroups?.flatMap((g) => g.options) || [];
    return options.filter((opt) => matchesSearch(opt.label, q));
  }, [groups, filteredGroups, options, q]);

  const updateRect = () => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    setRect({ top: r.bottom, left: r.left, width: r.width });
  };

  useLayoutEffect(() => {
    if (open) updateRect();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocDown = (e) => {
      const inTrigger = rootRef.current && rootRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inTrigger && !inPanel) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open]);

  const openPanel = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const pick = (opt) => {
    onChange(String(opt.value));
    setOpen(false);
    setQuery('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={`searchable-select${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className="searchable-select-trigger form-select"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <span className="searchable-select-summary">{selected ? selected.label : placeholder}</span>
      </button>
      {selected && clearable && !disabled ? (
        <button
          type="button"
          className="searchable-select-clear"
          onClick={clear}
          aria-label="Clear selection"
        >
          ×
        </button>
      ) : null}
      {open && !disabled && rect ? createPortal(
        <div
          ref={panelRef}
          className="searchable-select-panel"
          style={{ position: 'fixed', top: rect.top + 4, left: rect.left, width: Math.max(rect.width, 280) }}
        >
          <input
            ref={inputRef}
            type="search"
            className="form-control form-control-sm"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault();
                pick(filtered[0]);
              }
            }}
          />
          <div className="searchable-select-list" role="listbox">
            {filtered.length === 0 ? (
              <div className="p-3 text-muted small text-center">No matches found.</div>
            ) : groups ? (
              filteredGroups.map((group) => (
                <div key={group.label} className="searchable-select-group">
                  <div className="searchable-select-group-label">{group.label}</div>
                  {group.options.map((opt) => {
                    const isSelected = String(opt.value) === String(value);
                    return (
                      <button
                        key={String(opt.value)}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`searchable-select-item w-100 text-start border-0 px-3 py-2${isSelected ? ' searchable-select-item--selected' : ''}`}
                        onClick={() => pick(opt)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : filtered.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`searchable-select-item w-100 text-start border-0 px-3 py-2${isSelected ? ' searchable-select-item--selected' : ''}`}
                  onClick={() => pick(opt)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

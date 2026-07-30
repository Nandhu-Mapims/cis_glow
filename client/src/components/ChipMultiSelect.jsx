import { useMemo, useState } from 'react';
import './ChipMultiSelect.css';

function matchesSearch(label, query) {
  if (!query) return true;
  return label.toLowerCase().includes(query.toLowerCase());
}

/**
 * Checkbox-list replacement for native <select multiple> — same value/onChange
 * contract, but big enough to actually read and use. Supports the same
 * range-select gesture as a native multi-select (Shift+click extends the
 * selection from the last-clicked option through the clicked one) plus
 * Ctrl/Cmd+click and plain click, both of which toggle a single option (a
 * checkbox list reads as "click = toggle", not "click = replace selection"
 * the way a native <select> does).
 */
export default function ChipMultiSelect({
  options = [],
  value = [],
  onChange,
  max,
  disabled = false,
  searchPlaceholder = 'Search...',
  emptySelectionText = 'Nothing selected',
  emptySearchText = 'No matches found.',
  showSearch = true,
  showBulkActions = true,
  listHeight = 320,
  footer = null,
}) {
  const [query, setQuery] = useState('');
  const [lastIndex, setLastIndex] = useState(null);
  const selectedSet = useMemo(() => new Set(value.map(String)), [value]);
  const hasMax = Number.isFinite(max) && max > 0;
  const atMax = hasMax && value.length >= max;

  const optionByValue = useMemo(
    () => new Map(options.map((opt) => [String(opt.value), opt])),
    [options],
  );

  const filtered = useMemo(
    () => options.filter((opt) => matchesSearch(opt.label, query.trim())),
    [options, query],
  );

  const groups = useMemo(() => {
    const list = [];
    const byKey = new Map();
    filtered.forEach((opt, index) => {
      const key = opt.group || '';
      if (!byKey.has(key)) {
        const g = { key, label: opt.group || null, items: [] };
        byKey.set(key, g);
        list.push(g);
      }
      byKey.get(key).items.push({ opt, index });
    });
    return list;
  }, [filtered]);

  const applySelection = (nextSet) => {
    const next = Array.from(nextSet);
    onChange(hasMax ? next.slice(0, max) : next);
  };

  const toggleOne = (opt) => {
    const id = String(opt.value);
    const nextSet = new Set(selectedSet);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      if (atMax) return;
      nextSet.add(id);
    }
    applySelection(nextSet);
  };

  const selectRange = (fromIndex, toIndex) => {
    const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
    const nextSet = new Set(selectedSet);
    filtered.slice(start, end + 1).forEach((opt) => {
      if (!opt.disabled) nextSet.add(String(opt.value));
    });
    applySelection(nextSet);
  };

  const handleClick = (opt, index, e) => {
    if (disabled || opt.disabled) return;
    if (e.shiftKey && lastIndex !== null) {
      selectRange(lastIndex, index);
    } else {
      toggleOne(opt);
    }
    setLastIndex(index);
  };

  const remove = (id) => {
    if (disabled) return;
    onChange(value.filter((v) => String(v) !== id));
  };

  const selectAll = () => {
    if (disabled) return;
    const nextSet = new Set(selectedSet);
    filtered.forEach((opt) => { if (!opt.disabled) nextSet.add(String(opt.value)); });
    applySelection(nextSet);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const counterLabel = hasMax
    ? `${value.length}/${max} selected`
    : `${value.length} selected`;

  return (
    <div className={`chip-multi-select border rounded ${disabled ? 'opacity-75' : ''}`}>
      <div className="p-2 border-bottom bg-light rounded-top">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span className="small text-muted">{counterLabel}</span>
          {value.length > 0 ? (
            value.map((id) => {
              const opt = optionByValue.get(String(id));
              const label = opt?.label || id;
              return (
                <span key={id} className="badge rounded-pill text-bg-primary d-inline-flex align-items-center gap-1 py-2 px-3">
                  <span className="text-truncate" style={{ maxWidth: '220px' }} title={label}>{label}</span>
                  {!disabled ? (
                    <button
                      type="button"
                      className="btn-close btn-close-white ms-1"
                      style={{ fontSize: '0.55rem' }}
                      aria-label={`Remove ${label}`}
                      onClick={() => remove(id)}
                    />
                  ) : null}
                </span>
              );
            })
          ) : (
            <span className="small text-muted fst-italic">{emptySelectionText}</span>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          {showSearch ? (
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
            />
          ) : null}
          {showBulkActions && !hasMax ? (
            <div className="d-flex gap-1 text-nowrap">
              <button type="button" className="btn btn-sm btn-link p-0" disabled={disabled || !filtered.length} onClick={selectAll}>Select all</button>
              <span className="text-muted">·</span>
              <button type="button" className="btn btn-sm btn-link p-0" disabled={disabled || !value.length} onClick={clearAll}>Clear</button>
            </div>
          ) : null}
        </div>
        {!hasMax && filtered.length > 1 ? (
          <div className="chip-multi-select-hint small text-muted mt-1">Shift+click to select a range.</div>
        ) : null}
      </div>
      <div className="chip-multi-select-list" style={{ maxHeight: listHeight }} role="listbox" aria-multiselectable="true">
        {filtered.length === 0 ? (
          <div className="p-3 text-muted small text-center">{emptySearchText}</div>
        ) : groups.map((group) => (
          <div key={group.key || 'ungrouped'}>
            {group.label ? <div className="chip-multi-select-group-label">{group.label}</div> : null}
            {group.items.map(({ opt, index }) => {
              const id = String(opt.value);
              const isSelected = selectedSet.has(id);
              const isBlocked = opt.disabled && !isSelected;
              const cannotAdd = !isSelected && (atMax || isBlocked);
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={disabled || cannotAdd}
                  className={[
                    'chip-multi-select-item w-100 text-start border-0 px-3 py-2 d-flex align-items-center gap-2',
                    isSelected ? 'chip-multi-select-item--selected' : '',
                    isBlocked ? 'chip-multi-select-item--blocked' : '',
                  ].filter(Boolean).join(' ')}
                  style={opt.style}
                  onClick={(e) => handleClick(opt, index, e)}
                >
                  <input
                    type="checkbox"
                    className="form-check-input flex-shrink-0 ms-1 mt-0"
                    checked={isSelected}
                    disabled={disabled || cannotAdd}
                    readOnly
                    tabIndex={-1}
                  />
                  <span className={`flex-grow-1 mt-1 ${isBlocked ? 'text-muted' : ''}`}>
                    {opt.label}
                    {opt.note ? <span className="text-danger fw-semibold ms-1">{opt.note}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {footer ? (
        <div className="px-2 py-1 border-top bg-light rounded-bottom">{footer}</div>
      ) : null}
    </div>
  );
}

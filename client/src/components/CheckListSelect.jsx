import { useMemo, useState } from 'react';
import './CheckListSelect.css';

/**
 * Card-styled replacement for a native `<select multiple>` / `<select>` listbox
 * (grey OS-drawn box, ctrl/cmd-click to multi-pick). Same value/onChange
 * contract as the old MultiSelect: value and onChange always deal in an array
 * of string values, single-select just caps it at one entry.
 */
export default function CheckListSelect({
  options = [],
  groups = null,
  value = [],
  onChange,
  multiple = true,
  disabled = false,
  searchPlaceholder = 'Search...',
  emptyText = 'No options available.',
  'aria-labelledby': ariaLabelledBy,
}) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(value.map(String)), [value]);

  const flatOptions = useMemo(
    () => (groups ? groups.flatMap((g) => g.options) : options),
    [groups, options],
  );

  const q = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!groups) return null;
    return groups
      .map((g) => ({
        ...g,
        options: q ? g.options.filter((opt) => opt.label.toLowerCase().includes(q)) : g.options,
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, q]);

  const filtered = useMemo(() => {
    if (groups) return null;
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [groups, options, q]);

  const visibleOptions = groups ? (filteredGroups?.flatMap((g) => g.options) || []) : filtered;

  const toggle = (val) => {
    if (disabled) return;
    const key = String(val);
    if (multiple) {
      const next = new Set(selectedSet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange([...next]);
    } else {
      onChange(selectedSet.has(key) ? [] : [key]);
    }
  };

  const selectAll = () => onChange(visibleOptions.map((o) => String(o.value)));
  const clearAll = () => onChange([]);

  const renderRow = (opt) => {
    const isSelected = selectedSet.has(String(opt.value));
    return (
      <label
        key={String(opt.value)}
        className={`check-list-select-row${isSelected ? ' is-selected' : ''}`}
      >
        <input
          type={multiple ? 'checkbox' : 'radio'}
          checked={isSelected}
          disabled={disabled}
          onChange={() => toggle(opt.value)}
        />
        <span className="check-list-select-label">{opt.label}</span>
      </label>
    );
  };

  return (
    <div className={`check-list-select${disabled ? ' is-disabled' : ''}`}>
      <div className="check-list-select-toolbar">
        {flatOptions.length > 8 && (
          <input
            type="search"
            className="form-control form-control-sm check-list-select-search"
            placeholder={searchPlaceholder}
            value={query}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        <div className="check-list-select-meta">
          <span className="check-list-select-count">
            {value.length > 0 ? `${value.length} selected` : 'None selected'}
          </span>
          {multiple && !disabled && visibleOptions.length > 0 && (
            <span className="check-list-select-actions">
              <button type="button" onClick={selectAll}>Select all</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={clearAll}>Clear</button>
            </span>
          )}
        </div>
      </div>
      <div
        className="check-list-select-list"
        role={multiple ? 'listbox' : 'radiogroup'}
        aria-multiselectable={multiple || undefined}
        aria-labelledby={ariaLabelledBy}
      >
        {visibleOptions.length === 0 ? (
          <div className="check-list-select-empty">{emptyText}</div>
        ) : groups ? (
          filteredGroups.map((group) => (
            <div key={group.label} className="check-list-select-group">
              <div className="check-list-select-group-label">{group.label}</div>
              {group.options.map(renderRow)}
            </div>
          ))
        ) : (
          filtered.map(renderRow)
        )}
      </div>
    </div>
  );
}

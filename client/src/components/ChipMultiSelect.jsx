import { useMemo, useState } from 'react';
import './ChipMultiSelect.css';

function matchesSearch(label, query) {
  if (!query) return true;
  return label.toLowerCase().includes(query.toLowerCase());
}

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
  footer = null,
}) {
  const [query, setQuery] = useState('');
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

  const toggle = (opt) => {
    if (disabled || opt.disabled) return;
    const id = String(opt.value);
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => String(v) !== id));
      return;
    }
    if (atMax) return;
    const next = [...value, id];
    onChange(hasMax ? next.slice(0, max) : next);
  };

  const remove = (id) => {
    if (disabled) return;
    onChange(value.filter((v) => String(v) !== id));
  };

  const counterLabel = hasMax
    ? `${value.length}/${max} selected`
    : `${value.length} selected`;

  return (
    <div className={`chip-multi-select border rounded bg-white ${disabled ? 'opacity-75' : ''}`}>
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
      </div>
      <div className="chip-multi-select-list" role="listbox" aria-multiselectable="true">
        {filtered.length === 0 ? (
          <div className="p-3 text-muted small text-center">{emptySearchText}</div>
        ) : filtered.map((opt) => {
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
                'chip-multi-select-item w-100 text-start border-0 px-3 py-2',
                isSelected ? 'chip-multi-select-item--selected' : '',
                isBlocked ? 'chip-multi-select-item--blocked' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => toggle(opt)}
            >
              <span className="d-flex align-items-center justify-content-between gap-2">
                <span className={isBlocked ? 'text-muted' : ''}>
                  {opt.label}
                  {opt.note ? <span className="text-danger fw-semibold ms-1">{opt.note}</span> : null}
                </span>
                {isSelected ? <i className="fa fa-check text-primary" aria-hidden="true" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      {footer ? (
        <div className="px-2 py-1 border-top bg-light rounded-bottom">{footer}</div>
      ) : null}
    </div>
  );
}

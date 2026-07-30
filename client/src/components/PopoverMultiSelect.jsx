import { useEffect, useRef, useState } from 'react';
import ChipMultiSelect from './ChipMultiSelect';
import './PopoverMultiSelect.css';

/**
 * Compact trigger + floating panel wrapper around ChipMultiSelect — keeps
 * dense layouts (tables, repeated form rows) from being blown out by a
 * always-open checkbox list. The panel closes on outside click / Escape.
 */
export default function PopoverMultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = 'Select...',
  disabled = false,
  ...chipProps
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const optionByValue = new Map(options.map((o) => [String(o.value), o]));
  const labels = value.map((v) => optionByValue.get(String(v))?.label || v);
  const summary = labels.length === 0
    ? placeholder
    : labels.length <= 2
      ? labels.join(', ')
      : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;

  return (
    <div className={`popover-multi-select${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="popover-multi-select-trigger form-select form-select-sm"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={labels.join(', ')}
      >
        <span className="popover-multi-select-summary">{summary}</span>
      </button>
      {open && !disabled && (
        <div className="popover-multi-select-panel">
          <ChipMultiSelect
            options={options}
            value={value}
            onChange={onChange}
            listHeight={200}
            {...chipProps}
          />
        </div>
      )}
    </div>
  );
}

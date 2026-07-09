import { useEffect, useRef, useState } from 'react';

function useMenuPosition(open, anchorRef) {
  const [style, setStyle] = useState(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setStyle(null);
      return undefined;
    }

    const update = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const maxMenuHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, Math.min(maxMenuHeight, openUp ? spaceAbove - 8 : spaceBelow - 8));

      setStyle({
        position: 'fixed',
        left: rect.left,
        minWidth: rect.width,
        maxHeight,
        zIndex: 1060,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  return style;
}

export default function FeeMultiDropdown({
  value,
  options = [],
  groups = [],
  placeholder = '--Select--',
  disabled = false,
  minSelected = 0,
  className = '',
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuStyle = useMenuPosition(open, buttonRef);
  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const optionList = options.length
    ? options
    : groups.flatMap((group) => group.options || []);
  const menuGroups = groups.length
    ? groups
    : [{ label: '', options: optionList }];

  const labels = optionList
    .filter((o) => selected.includes(o.value))
    .map((o) => o.label);
  const display = labels.length ? labels.join(', ') : placeholder;

  const toggle = (optValue) => {
    const has = selected.includes(optValue);
    const next = has ? selected.filter((v) => v !== optValue) : [...selected, optValue];
    if (minSelected > 0 && next.length < minSelected) return;
    onChange(next);
  };

  const renderOption = (o) => (
    <label key={o.value} className="dropdown-item cis-fee-multi-dropdown-item">
      <input
        type="checkbox"
        className="form-check-input me-2 flex-shrink-0"
        checked={selected.includes(o.value)}
        onChange={() => toggle(o.value)}
      />
      <span className="cis-fee-multi-dropdown-item-label">{o.label}</span>
    </label>
  );

  return (
    <div
      ref={rootRef}
      className={`dropdown cis-fee-multi-dropdown${open ? ' show' : ''} ${className}`.trim()}
    >
      <button
        ref={buttonRef}
        type="button"
        className="form-select cis-fee-name-select text-start"
        disabled={disabled}
        title={display}
        aria-expanded={open}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <span className="cis-fee-name-select-label">{display}</span>
      </button>
      {open && !disabled && menuStyle ? (
        <div
          className="dropdown-menu show cis-fee-multi-dropdown-menu cis-fee-multi-dropdown-menu--fixed"
          style={menuStyle}
        >
          {menuGroups.map((group) => (
            <div key={group.label || 'default'} className="cis-fee-multi-dropdown-group">
              {group.label ? (
                <div className="cis-fee-multi-dropdown-group-label">{group.label}</div>
              ) : null}
              {(group.options || []).map(renderOption)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

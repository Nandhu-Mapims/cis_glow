import { useEffect, useRef } from 'react';
import { ensureLegacyDateTimePicker } from '../utils/legacyDateTimePickerLoader';

export default function LegacyDateInput({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  className = '',
  disabled = false,
}) {
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const readyRef = useRef(false);
  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    let active = true;
    let $input = null;

    const init = async () => {
      await ensureLegacyDateTimePicker();
      if (!active || !inputRef.current || !window.jQuery?.fn?.datetimepicker) return;

      $input = window.jQuery(inputRef.current);
      try { $input.datetimepicker('remove'); } catch { /* not yet initialized */ }

      $input.val(valueRef.current || '');
      $input.datetimepicker({
        format: 'dd-mm-yyyy',
        weekStart: 1,
        autoclose: true,
        todayHighlight: true,
        startView: 2,
        minView: 2,
        maxView: 4,
        forceParse: false,
      });

      $input.on('changeDate change', () => {
        onChangeRef.current(inputRef.current ? inputRef.current.value : '');
      });

      readyRef.current = true;
    };

    init().catch((err) => {
      console.error('Legacy date picker failed to load', err);
      if (inputRef.current) inputRef.current.value = valueRef.current || '';
    });

    return () => {
      active = false;
      readyRef.current = false;
      if ($input) {
        $input.off('changeDate change');
        try { $input.datetimepicker('remove'); } catch { /* already removed */ }
      }
    };
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (el.value === (value || '')) return;
    el.value = value || '';
    if (readyRef.current && window.jQuery) {
      try { window.jQuery(el).datetimepicker('update'); } catch { /* noop */ }
    }
  }, [value]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.disabled = disabled;
  }, [disabled]);

  const openPicker = () => {
    if (disabled || !inputRef.current || !window.jQuery) return;
    const $input = window.jQuery(inputRef.current);
    try { $input.datetimepicker('show'); } catch { inputRef.current.focus(); }
  };

  return (
    <div className="input-group">
      <input
        ref={inputRef}
        type="text"
        className={`form-control dtcalendar ${className}`.trim()}
        placeholder={placeholder}
        defaultValue={value || ''}
        disabled={disabled}
        autoComplete="off"
        maxLength={10}
      />
      <span
        className="input-group-text"
        role="button"
        tabIndex={-1}
        onClick={openPicker}
        style={{ cursor: disabled ? 'default' : 'pointer' }}
        aria-label="Open date picker"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          aria-hidden="true"
        >
          <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
          <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" />
          <line x1="4.5" y1="1" x2="4.5" y2="4" />
          <line x1="11.5" y1="1" x2="11.5" y2="4" />
        </svg>
      </span>
    </div>
  );
}

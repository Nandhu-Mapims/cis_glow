import { useEffect, useRef } from 'react';
import { ensureLegacyDateTimePicker } from '../utils/legacyDateTimePickerLoader';

const DATETIME_RE = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/;

export function parseLegacyDateTime(value) {
  const match = String(value || '').trim().match(DATETIME_RE);
  if (!match) return null;
  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

export function formatLegacyDateTime(parts) {
  const {
    day, month, year, hour, minute,
  } = parts;
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function LegacyDateTimeInput({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy HH:mm',
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
        format: 'dd-mm-yyyy hh:ii',
        weekStart: 1,
        autoclose: true,
        todayHighlight: true,
        startView: 2,
        minView: 0,
        forceParse: false,
      });

      $input.on('changeDate change', () => {
        onChangeRef.current(inputRef.current ? inputRef.current.value : '');
      });

      readyRef.current = true;
    };

    init().catch((err) => {
      console.error('Legacy date/time picker failed to load', err);
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
        maxLength={16}
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

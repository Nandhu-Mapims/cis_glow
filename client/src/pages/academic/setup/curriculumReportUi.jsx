import { formatLegacyDateTime } from '../../../components/LegacyDateTimeInput';

export function groupOptions(options) {
  const groups = new Map();
  for (const opt of options || []) {
    const g = opt.group || 'Courses';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(opt);
  }
  return [...groups.entries()];
}

export function CurriculumFilterRow({ label, children, hint }) {
  return (
    <div className="mb-3 row g-2 align-items-center">
      <label className="col-sm-2 col-form-label">{label}</label>
      <div className="col-sm-5">
        {children}
        {hint ? <div className="form-text">{hint}</div> : null}
      </div>
    </div>
  );
}

export function GroupedSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder = '--Select--',
}) {
  const grouped = groupOptions(options);
  return (
    <select
      className="form-select"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {grouped.map(([group, opts]) => (
        <optgroup key={group} label={group}>
          {opts.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function SemesterPills({ total, value, onChange, disabled, emptyMessage, loading }) {
  if (loading) {
    return <span className="text-muted small">Loading semester options…</span>;
  }
  if (!total) {
    return (
      <span className="text-muted small">
        {emptyMessage || 'No semester options found for this course.'}
      </span>
    );
  }
  return (
    <div className="curriculum-semester-pills">
      {Array.from({ length: total }, (_, i) => i + 1).map((yr) => {
        const active = String(value) === String(yr);
        return (
          <button
            key={yr}
            type="button"
            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
            disabled={disabled}
            onClick={() => onChange(String(yr))}
          >
            {yr}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, disabled }) {
  return (
    <div className="curriculum-segmented" role="group">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function legacyDateTimeFromDate(date) {
  return formatLegacyDateTime({
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  });
}

export function DateTimeQuickChips({ onSelect, disabled }) {
  const setNow = () => onSelect(legacyDateTimeFromDate(new Date()));

  const setTodayAt = (hour, minute) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    onSelect(legacyDateTimeFromDate(d));
  };

  return (
    <div className="curriculum-datetime-chips">
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={setNow}>
        Now
      </button>
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => setTodayAt(9, 0)}>
        Today 09:00
      </button>
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} onClick={() => setTodayAt(14, 0)}>
        Today 14:00
      </button>
    </div>
  );
}

export function CurriculumFilterCard({ children, action }) {
  return (
    <div className="card shadow-sm cis-filter-card curriculum-report-filters mb-3">
      <div className="card-header fw-semibold">Filters</div>
      <div className="card-body">
        {children}
        <div className="curriculum-report-actions d-flex justify-content-end pt-1">
          {action}
        </div>
      </div>
    </div>
  );
}

export function CurriculumReportEmptyState({ title, hint, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="curriculum-report-empty text-center py-4">
      <p className="mb-1 fw-semibold">{title}</p>
      {hint ? <p className="text-muted small mb-3">{hint}</p> : null}
      {onRetry ? (
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function CurriculumReportSkeleton() {
  return (
    <div className="academic-report-skeleton" aria-hidden="true">
      <table className="table table-bordered table-sm mb-0">
        <thead>
          <tr>
            {Array.from({ length: 6 }, (_, i) => <th key={i}>&nbsp;</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <tr key={i}>
              {Array.from({ length: 6 }, (__, j) => (
                <td key={j}><span className="academic-report-skeleton-cell" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function countReportRows(html) {
  if (!html) return 0;
  return Math.max(0, (html.match(/<tr/gi) || []).length - 1);
}

export function CurriculumSetupCard({ title, children, footer }) {
  return (
    <div className="card shadow-sm curriculum-setup-card mb-3">
      {title ? <div className="card-header fw-semibold">{title}</div> : null}
      <div className="card-body">{children}</div>
      {footer ? <div className="card-footer bg-transparent">{footer}</div> : null}
    </div>
  );
}

export function OptionPills({ options, value, onChange, disabled }) {
  return (
    <div className="curriculum-semester-pills">
      {(options || []).map((opt) => {
        const active = String(value) === String(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
            disabled={disabled}
            onClick={() => onChange(String(opt.value))}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

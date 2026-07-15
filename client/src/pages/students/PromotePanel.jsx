import { useEffect, useState } from 'react';

function emptyForm(selected) {
  return {
    from_a_year: selected?.fromAYear || '',
    to_a_year: selected?.toAYear || '',
    from_class: selected?.fromClass || '',
    to_class: selected?.toClass || '',
  };
}

function parseYearType(value) {
  const [year, type] = String(value || '').split('___');
  return { year, type: type || 'regular' };
}

export default function PromotePanel({ data, busy, onReload, onPromote }) {
  const [form, setForm] = useState(() => emptyForm(data?.selected));
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (data?.selected) setForm(emptyForm(data.selected));
    setRows(data?.promotion?.rows || []);
  }, [data]);

  const reload = async (next) => {
    await onReload(next);
  };

  const handleFromYear = async (value) => {
    const tail = String(value).slice(-4);
    const yr = Number(tail);
    const defaultTo = !Number.isNaN(yr) ? `${yr}-${yr + 1}` : '';
    const next = { from_a_year: value, to_a_year: defaultTo, from_class: '', to_class: '' };
    setForm(next);
    await reload(next);
  };

  const handleFromClass = async (value) => {
    const next = { ...form, from_class: value, to_class: value };
    setForm(next);
    await reload(next);
  };

  const handlePromote = async (e) => {
    e.preventDefault();
    const mappings = rows.map((row) => {
      const from = parseYearType(row.fromYear);
      const to = parseYearType(row.toYear);
      return {
        allow: row.allow,
        fromYear: from.year,
        fromType: from.type,
        toYear: to.year,
        toType: to.type,
        failList: row.failList,
      };
    });
    await onPromote({ ...form, mappings, Submit: 'Promote' });
  };

  const promotion = data?.promotion;
  const fromCourseOptions = (data?.promoteCourses || []).flatMap((c) => c.batchOptions || []);

  return (
    <form onSubmit={handlePromote}>
      <div className="row g-3 mb-3">
        <div className="col-md-2">
          <label className="form-label small text-muted mb-1">From academic</label>
          <select
            className="form-select"
            value={form.from_a_year}
            onChange={(e) => handleFromYear(e.target.value)}
            disabled={busy}
          >
            <option value="">Select</option>
            {(data?.academicYears || []).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {form.from_a_year && (
          <>
            <div className="col-md-2">
              <label className="form-label small text-muted mb-1">To academic</label>
              <select
                className="form-select"
                value={form.to_a_year}
                onChange={(e) => setForm((f) => ({ ...f, to_a_year: e.target.value }))}
                disabled={busy}
              >
                <option value="">Select</option>
                {(data?.toAcademicYears || data?.academicYears || []).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted mb-1">From course</label>
              <select
                className="form-select"
                value={form.from_class}
                onChange={(e) => handleFromClass(e.target.value)}
                disabled={busy}
              >
                <option value="">Select</option>
                {fromCourseOptions.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </>
        )}
        {form.from_class && promotion?.toCourseOptions?.length > 0 && (
          <div className="col-md-3">
            <label className="form-label small text-muted mb-1">To course</label>
            <select
              className="form-select"
              value={form.to_class}
              onChange={(e) => setForm((f) => ({ ...f, to_class: e.target.value }))}
              disabled={busy}
            >
              {promotion.toCourseOptions.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {form.from_class && !promotion?.rows?.length && (
        <p className="text-muted small">This course has no year steps to promote.</p>
      )}

      {promotion?.rows?.length > 0 && (
        <div className="table-responsive cis-dt-wrap mb-3">
          <table className="cis-dt-table table-sm align-middle">
            <thead>
              <tr>
                <th>Promote</th>
                <th>From year</th>
                <th>To year</th>
                <th>Fail list (register nos)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(row.allow)}
                      onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, allow: e.target.checked } : r)))}
                    />
                  </td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={row.fromYear}
                      onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, fromYear: e.target.value } : r)))}
                    >
                      {(promotion.yearOptions || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={row.toYear}
                      onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, toYear: e.target.value } : r)))}
                    >
                      {(promotion.yearOptions || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="form-control form-control-sm"
                      value={row.failList}
                      placeholder="comma-separated"
                      onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, failList: e.target.value } : r)))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form.from_class && promotion?.rows?.length > 0 && (
        <button type="submit" className="btn btn-primary" disabled={busy || !form.to_a_year}>
          Promote
        </button>
      )}
    </form>
  );
}

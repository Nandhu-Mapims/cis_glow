import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { toDateInputValue } from '../../../utils/dateInputs';
import { useExamSetupApi } from './useExamSetupApi';

function emptyRow() {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    examNameId: '',
    examInternal: true,
    examViva: true,
    examExternal: true,
    markOption: true,
    examStatus: false,
    sessionFn: '',
    sessionAn: '',
    fromDate: '',
    toDate: '',
    sessionTime: '',
  };
}

export default function TermExamSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('exam-setup');
  const [courseYearKey, setCourseYearKey] = useState('');
  const [rows, setRows] = useState([emptyRow()]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.courseYearKey) setCourseYearKey(data.courseYearKey);
    if (data?.rows) {
      setRows(data.rows.map((row) => ({ ...row, key: row.id ? `id-${row.id}` : `new-${row.examNameId}` })));
    }
  }, [data]);

  const onCourseYearChange = async (value) => {
    setCourseYearKey(value);
    await load({ course_name: value });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const selection = data?.selection;
    if (!selection) return;
    await save({
      action: 'update',
      courseName: selection.courseName,
      academicYear: selection.academicYear,
      academicType: selection.academicType,
      courseYearKey,
      rows: rows.map((row) => ({
        id: row.id,
        examNameId: row.examNameId,
        examInternal: row.examInternal,
        examViva: row.examViva,
        examExternal: row.examExternal,
        markOption: row.markOption,
        examStatus: row.examStatus,
        sessionFn: row.sessionFn,
        sessionAn: row.sessionAn,
        fromDate: row.fromDate,
        toDate: row.toDate,
        sessionTime: row.sessionTime,
      })),
    });
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <div className="mb-3 row g-2">
        <label className="col-sm-2 col-form-label">Course &amp; Academic year</label>
        <div className="col-sm-5">
          <select className="form-select" value={courseYearKey} onChange={(e) => onCourseYearChange(e.target.value)}>
            <option value="">--Select Course--</option>
            {(() => {
              const groups = new Map();
              for (const opt of data?.courseYearOptions || []) {
                const g = opt.group || 'Courses';
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g).push(opt);
              }
              return [...groups.entries()].map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
        </div>
      </div>

      {data?.selection ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle text-center">
              <thead className="table-secondary">
                <tr>
                  <th>#</th>
                  <th>Exam Name</th>
                  <th>Internal</th>
                  <th>Viva</th>
                  <th>Theory</th>
                  <th>Marks Config</th>
                  <th>FN Session</th>
                  <th>AN Session</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Time</th>
                  <th>Done</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td>{index + 1}</td>
                    <td>
                      <select className="form-select" value={row.examNameId} onChange={(e) => updateRow(index, { examNameId: e.target.value })}>
                        <option value="">--Select--</option>
                        {(data?.examNameOptions || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td><input type="checkbox" checked={row.examInternal} onChange={(e) => updateRow(index, { examInternal: e.target.checked })} /></td>
                    <td><input type="checkbox" checked={row.examViva} onChange={(e) => updateRow(index, { examViva: e.target.checked })} /></td>
                    <td><input type="checkbox" checked={row.examExternal} onChange={(e) => updateRow(index, { examExternal: e.target.checked })} /></td>
                    <td><input type="checkbox" checked={row.markOption} onChange={(e) => updateRow(index, { markOption: e.target.checked })} /></td>
                    <td><input className="form-control" value={row.sessionFn} onChange={(e) => updateRow(index, { sessionFn: e.target.value })} /></td>
                    <td><input className="form-control" value={row.sessionAn} onChange={(e) => updateRow(index, { sessionAn: e.target.value })} /></td>
                    <td><input type="date" className="form-control" value={toDateInputValue(row.fromDate)} onChange={(e) => updateRow(index, { fromDate: e.target.value })} /></td>
                    <td><input type="date" className="form-control" value={toDateInputValue(row.toDate)} onChange={(e) => updateRow(index, { toDate: e.target.value })} /></td>
                    <td><input className="form-control" value={row.sessionTime} onChange={(e) => updateRow(index, { sessionTime: e.target.value })} /></td>
                    <td><input type="checkbox" checked={row.examStatus} onChange={(e) => updateRow(index, { examStatus: e.target.checked })} /></td>
                    <td>{row.id ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-info" onClick={() => setRows((prev) => [...prev, emptyRow()])}>+</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}

      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete..."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          await save({ action: 'delete', id: deleteId, courseYearKey });
          setDeleteId(null);
        }}
        busy={busy}
      />
    </>
  );
}

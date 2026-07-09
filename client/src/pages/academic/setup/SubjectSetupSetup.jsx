import { useEffect, useState } from 'react';
import ChipMultiSelect from '../../../components/ChipMultiSelect';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { CourseYearSelector } from '../../exam/setup/ExamSelectors';
import { useAcademicSetupApi } from './useAcademicSetupApi';

const TT_SUFFIX = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function emptyRow(order = 1) {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    enabled: true,
    order,
    categoryId: '',
    subTypeId: '',
    subjectId: '',
    name: '',
    shortName: '',
    ttRows: [],
    markRows: [],
  };
}

function nextSuffix(rows, baseId) {
  const used = new Set(
    (rows || [])
      .map((row) => String(row.subjectId || '').slice(String(baseId || '').length))
      .filter(Boolean),
  );
  for (const letter of TT_SUFFIX) {
    if (!used.has(letter)) return letter;
  }
  return TT_SUFFIX[rows.length] || 'A';
}

function syncChildSubjectIds(baseId, ttRows, markRows) {
  const base = String(baseId || '');
  return {
    ttRows: (ttRows || []).map((row, index) => {
      const suffix = String(row.subjectId || '').slice(base.length) || TT_SUFFIX[index] || 'A';
      return { ...row, subjectId: `${base}${suffix}` };
    }),
    markRows: (markRows || []).map((row, index) => {
      const suffix = String(row.subjectId || '').slice(base.length) || TT_SUFFIX[index] || 'A';
      return { ...row, subjectId: `${base}${suffix}` };
    }),
  };
}

function NestedTable({ title, rows, columns, onChange, onAdd, onRemove }) {
  return (
    <div className="border rounded p-2 mb-2 bg-light">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>{title}</strong>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={onAdd}>+ Row</button>
      </div>
      {rows.length ? (
        <div className="table-responsive">
          <table className="table table-sm table-bordered mb-0">
            <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key || row.id || index}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row, index) : (
                        <input
                          className="form-control form-control-sm"
                          value={row[col.key] ?? ''}
                          onChange={(e) => onChange(index, { [col.key]: e.target.value })}
                        />
                      )}
                    </td>
                  ))}
                  <td><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onRemove(index)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-muted small mb-0">No rows yet.</p>}
    </div>
  );
}

export default function SubjectSetupSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('subject-setup');
  const [courseYearKey, setCourseYearKey] = useState('');
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.courseYearKey) setCourseYearKey(data.courseYearKey);
    if (data?.semester) setSemester(String(data.semester));
    if (data?.rows) {
      setRows(data.rows.map((row) => ({
        ...row,
        key: row.id ? `id-${row.id}` : `new-${row.order}`,
        ttRows: (row.ttRows || []).map((r, i) => ({ ...r, key: r.id || `tt-${i}` })),
        markRows: (row.markRows || []).map((r, i) => ({ ...r, key: r.id || `mk-${i}` })),
      })));
    }
  }, [data]);

  const reload = async (patch = {}) => {
    await load({
      course_name: patch.courseYearKey ?? courseYearKey,
      semester_name: patch.semester ?? semester,
    });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, ...patch };
      if (patch.subjectId !== undefined || patch.name !== undefined) {
        const synced = syncChildSubjectIds(next.subjectId, next.ttRows, next.markRows);
        next.ttRows = synced.ttRows;
        next.markRows = synced.markRows;
      }
      return next;
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!data?.scope) return;
    await save({
      action: 'update',
      courseYearKey,
      scope: data.scope,
      rows: rows.map(({ id, enabled, order, categoryId, subTypeId, subjectId, name, shortName, ttRows, markRows }) => ({
        id, enabled, order, categoryId, subTypeId, subjectId, name, shortName, ttRows, markRows,
      })),
    });
  };

  const selectOpts = (options) => (
    <>
      <option value="">--Select--</option>
      {(options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </>
  );

  const departmentOptions = data?.departmentOptions || [];

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <CourseYearSelector
        options={data?.courseYearOptions}
        value={courseYearKey}
        disabled={busy}
        onChange={async (value) => {
          setCourseYearKey(value);
          setSemester('');
          await reload({ courseYearKey: value, semester: '' });
        }}
      />

      {data?.selection ? (
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Year <span className="text-danger">*</span></label>
          <div className="col-sm-8">
            {Array.from({ length: data.totalSemester || 0 }, (_, i) => i + 1).map((yr) => (
              <label key={yr} className="me-3">
                <input
                  type="radio"
                  name="semester"
                  checked={String(semester) === String(yr)}
                  onChange={async () => {
                    setSemester(String(yr));
                    await reload({ semester: String(yr) });
                  }}
                /> {yr}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {data?.scope ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary">
                <tr>
                  <th>E</th><th>Order</th><th>Category</th><th>Basic</th><th>Subject Id</th><th>Subject Name</th><th>Short Name</th><th>Exam</th><th>Time Table</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td><input type="checkbox" checked={row.enabled} onChange={(e) => updateRow(index, { enabled: e.target.checked })} /></td>
                    <td><input className="form-control form-control-sm marks" value={row.order} onChange={(e) => updateRow(index, { order: e.target.value })} /></td>
                    <td><select className="form-select form-select-sm" value={row.categoryId} onChange={(e) => updateRow(index, { categoryId: e.target.value })}>{selectOpts(data.categoryOptions)}</select></td>
                    <td><select className="form-select form-select-sm" value={row.subTypeId} onChange={(e) => updateRow(index, { subTypeId: e.target.value })}>{selectOpts(data.subTypeOptions)}</select></td>
                    <td><input className="form-control form-control-sm" value={row.subjectId} onChange={(e) => updateRow(index, { subjectId: e.target.value })} /></td>
                    <td><input className="form-control form-control-sm" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} /></td>
                    <td><input className="form-control form-control-sm" value={row.shortName} onChange={(e) => updateRow(index, { shortName: e.target.value })} /></td>
                    <td>
                      <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => {
                        const key = `mk-${index}`;
                        if (expanded !== key && !row.markRows.length) {
                          updateRow(index, {
                            markRows: [{
                              key: `mk-seed-${Date.now()}`,
                              categoryId: '',
                              subjectId: `${row.subjectId || ''}A`,
                              name: '',
                              shortName: '',
                              departments: [],
                              internalMax: 0,
                              vivaMax: 0,
                              externalMax: 0,
                              passMark: '',
                              examRoom: '',
                            }],
                          });
                        }
                        setExpanded(expanded === key ? null : key);
                      }}
                      >Exam</button>
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => {
                        const key = `tt-${index}`;
                        if (expanded !== key && !row.ttRows.length) {
                          updateRow(index, {
                            ttRows: [{
                              key: `tt-seed-${Date.now()}`,
                              categoryId: '',
                              subjectId: `${row.subjectId || ''}A`,
                              name: '',
                              shortName: '',
                              departments: [],
                              roomNo: '',
                              batchSplit: false,
                            }],
                          });
                        }
                        setExpanded(expanded === key ? null : key);
                      }}
                      >Timetable</button>
                    </td>
                    <td>{row.id ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.map((row, index) => expanded === `tt-${index}` ? (
            <NestedTable
              key={`tt-panel-${row.key}`}
              title={`Time Table — ${row.subjectId || row.name || `row ${index + 1}`}`}
              rows={row.ttRows}
              columns={[
                { key: 'categoryId', label: 'Category', render: (r, i) => (
                  <select className="form-select form-select-sm" value={r.categoryId} onChange={(e) => {
                    const ttRows = [...row.ttRows];
                    ttRows[i] = { ...ttRows[i], categoryId: e.target.value };
                    updateRow(index, { ttRows });
                  }}>{selectOpts(data.ttCategoryOptions)}</select>
                ) },
                { key: 'subjectId', label: 'Subject Id', render: (r) => (
                  <input className="form-control form-control-sm" value={r.subjectId} readOnly />
                ) },
                { key: 'name', label: 'Subject Name' },
                { key: 'shortName', label: 'Short Name' },
                { key: 'departments', label: 'Department', render: (r, i) => (
                  <ChipMultiSelect
                    options={departmentOptions}
                    value={r.departments || []}
                    showSearch={false}
                    onChange={(departments) => {
                      const ttRows = [...row.ttRows];
                      ttRows[i] = { ...ttRows[i], departments };
                      updateRow(index, { ttRows });
                    }}
                  />
                ) },
                { key: 'roomNo', label: 'Room No.', render: (r, i) => (
                  <select className="form-select form-select-sm" value={r.roomNo} onChange={(e) => {
                    const ttRows = [...row.ttRows];
                    ttRows[i] = { ...ttRows[i], roomNo: e.target.value };
                    updateRow(index, { ttRows });
                  }}>
                    <option value="">--Sel--</option>
                    {(data.roomGroups || []).map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                ) },
                { key: 'batchSplit', label: 'Batch', render: (r, i) => (
                  <input type="checkbox" checked={!!r.batchSplit} onChange={(e) => {
                    const ttRows = [...row.ttRows];
                    ttRows[i] = { ...ttRows[i], batchSplit: e.target.checked };
                    updateRow(index, { ttRows });
                  }} />
                ) },
              ]}
              onChange={(i, patch) => {
                const ttRows = row.ttRows.map((r, ri) => (ri === i ? { ...r, ...patch } : r));
                updateRow(index, { ttRows });
              }}
              onAdd={() => {
                const suffix = nextSuffix(row.ttRows, row.subjectId);
                updateRow(index, {
                  ttRows: [...row.ttRows, {
                    key: `tt-new-${Date.now()}`,
                    categoryId: '',
                    subjectId: `${row.subjectId || ''}${suffix}`,
                    name: '',
                    shortName: '',
                    departments: [],
                    roomNo: '',
                    batchSplit: false,
                  }],
                });
              }}
              onRemove={(i) => updateRow(index, { ttRows: row.ttRows.filter((_, ri) => ri !== i) })}
            />
          ) : null)}

          {rows.map((row, index) => expanded === `mk-${index}` ? (
            <NestedTable
              key={`mk-panel-${row.key}`}
              title={`Marks — ${row.subjectId || row.name || `row ${index + 1}`}`}
              rows={row.markRows}
              columns={[
                { key: 'categoryId', label: 'Category', render: (r, i) => (
                  <select className="form-select form-select-sm" value={r.categoryId} onChange={(e) => {
                    const markRows = [...row.markRows];
                    markRows[i] = { ...markRows[i], categoryId: e.target.value };
                    updateRow(index, { markRows });
                  }}>{selectOpts(data.typeOptions)}</select>
                ) },
                { key: 'subjectId', label: 'Subject ID', render: (r) => (
                  <input className="form-control form-control-sm" value={r.subjectId} readOnly />
                ) },
                { key: 'name', label: 'Title' },
                { key: 'shortName', label: 'Short Name' },
                { key: 'departments', label: 'Department', render: (r, i) => (
                  <ChipMultiSelect
                    options={departmentOptions}
                    value={r.departments || []}
                    showSearch={false}
                    onChange={(departments) => {
                      const markRows = [...row.markRows];
                      markRows[i] = { ...markRows[i], departments };
                      updateRow(index, { markRows });
                    }}
                  />
                ) },
                { key: 'internalMax', label: 'I.Mark' },
                { key: 'vivaMax', label: 'V.Mark' },
                { key: 'externalMax', label: 'T.Mark' },
                { key: 'passMark', label: 'P.Mark' },
                { key: 'examRoom', label: 'Room No.', render: (r, i) => (
                  <select className="form-select form-select-sm" value={r.examRoom || ''} onChange={(e) => {
                    const markRows = [...row.markRows];
                    markRows[i] = { ...markRows[i], examRoom: e.target.value };
                    updateRow(index, { markRows });
                  }}>
                    <option value="">--Sel--</option>
                    {(data.roomGroups || []).map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                ) },
              ]}
              onChange={(i, patch) => {
                const markRows = row.markRows.map((r, ri) => (ri === i ? { ...r, ...patch } : r));
                updateRow(index, { markRows });
              }}
              onAdd={() => {
                const suffix = nextSuffix(row.markRows, row.subjectId);
                updateRow(index, {
                  markRows: [...row.markRows, {
                    key: `mk-new-${Date.now()}`,
                    categoryId: '',
                    subjectId: `${row.subjectId || ''}${suffix}`,
                    name: '',
                    shortName: '',
                    departments: [],
                    internalMax: 0,
                    vivaMax: 0,
                    externalMax: 0,
                    passMark: '',
                    examRoom: '',
                  }],
                });
              }}
              onRemove={(i) => updateRow(index, { markRows: row.markRows.filter((_, ri) => ri !== i) })}
            />
          ) : null)}

          <div className="d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-info" onClick={() => setRows((prev) => [...prev, emptyRow(prev.length + 1)])}>Add Subject</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}

      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete..."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          await save({ action: 'delete', id: deleteId, courseYearKey, semester });
          setDeleteId(null);
        }}
        busy={busy}
      />
    </>
  );
}

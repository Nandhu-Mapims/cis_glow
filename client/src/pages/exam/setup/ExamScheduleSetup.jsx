import { useEffect, useMemo, useState } from 'react';
import ChipMultiSelect from '../../../components/ChipMultiSelect';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useExamSetupApi } from './useExamSetupApi';
import './examScheduleSetup.css';

function groupExamOptions(options = []) {
  const groups = new Map();
  for (const opt of options) {
    const group = opt.group || 'Exams';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(opt);
  }
  return Array.from(groups.entries());
}

function toDateInputValue(displayDate) {
  const s = String(displayDate || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
}

function fromDateInputValue(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}-${m}-${y}`;
  }
  return s;
}

function FilterRow({ label, children, wide = false }) {
  return (
    <div className="row g-2 mb-3">
      <label className="col-sm-2 col-form-label">{label}</label>
      <div className={wide ? 'col-sm-10' : 'col-sm-5'}>{children}</div>
    </div>
  );
}

function SessionToggle({ value, onChange, disabled }) {
  const isAn = value === 'AN';
  return (
    <div className="exam-schedule-session-toggle" role="group" aria-label="Exam session">
      <button
        type="button"
        className={!isAn ? 'active' : ''}
        disabled={disabled}
        onClick={() => onChange('FN')}
      >
        FN
      </button>
      <button
        type="button"
        className={isAn ? 'active' : ''}
        disabled={disabled}
        onClick={() => onChange('AN')}
      >
        AN
      </button>
    </div>
  );
}

export default function ExamScheduleSetup() {
  const {
    data, busy, error, notice, clearNotice, load, save,
  } = useExamSetupApi('exam-schedule');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [rows, setRows] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.rows) setRows(data.rows);
  }, [data]);

  const examGroups = useMemo(() => groupExamOptions(data?.examOptions), [data?.examOptions]);

  const scheduledCount = useMemo(
    () => rows.filter((row) => String(row.examDate || '').trim()).length,
    [rows],
  );

  const reload = (patch) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    ...patch,
  });

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({ examSetupId: examId, courseKey, rows });
  };

  const showTable = Boolean(examId && courseKey && rows.length);
  const showEmptySubjects = Boolean(examId && courseKey && !busy && !rows.length);

  return (
    <div className="exam-schedule-root">
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={clearNotice} />

      <div className="card shadow-sm mb-3 exam-schedule-filters">
        <div className="card-body">
          <FilterRow label="Exam">
            <select
              className="form-select"
              value={examId}
              disabled={busy}
              onChange={async (e) => {
                const value = e.target.value;
                setExamId(value);
                setCourseKey('');
                setRows([]);
                await reload({ exam_name: value, course_name: '' });
              }}
            >
              <option value="">--Select Exam--</option>
              {examGroups.map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </FilterRow>

          {examId && (data?.courseGroups || []).map((group) => (
            <FilterRow key={group.courseId} label={group.degreeLabel} wide>
              <div className="exam-schedule-semester-options">
                {group.semesters.map((sem) => (
                  <label
                    key={sem.value}
                    className="exam-schedule-semester-option"
                  >
                    <input
                      type="radio"
                      name="course_semester"
                      value={sem.value}
                      checked={courseKey === sem.value}
                      disabled={busy}
                      onChange={async () => {
                        setCourseKey(sem.value);
                        await reload({ course_name: sem.value });
                      }}
                    />
                    <span>{sem.courseLabel || sem.label}</span>
                  </label>
                ))}
              </div>
            </FilterRow>
          ))}
        </div>
      </div>

      {busy && !rows.length && (
        <div className="text-muted small mb-3">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          Loading schedule…
        </div>
      )}

      {showEmptySubjects && (
        <div className="exam-schedule-empty mb-3">
          No subjects found for the selected exam and year.
        </div>
      )}

      {!examId && !busy && (
        <div className="exam-schedule-empty mb-3">
          Select an exam, then choose the course year to schedule subjects.
        </div>
      )}

      {showTable && (
        <form onSubmit={handleSave}>
          <div className="card shadow-sm exam-schedule-results">
            <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
              <div className="exam-schedule-summary">
                <span><strong>{rows.length}</strong> subjects</span>
                <span><strong>{scheduledCount}</strong> with exam date</span>
                {data?.ctx?.examNameLabel && (
                  <span>{data.ctx.examNameLabel}</span>
                )}
              </div>
              <button type="submit" className="btn btn-danger" disabled={busy}>
                {busy ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
            <div className="card-body p-0">
              <div className="exam-schedule-table-wrap">
                <table className="table table-bordered table-sm align-middle exam-schedule-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Subject</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Session</th>
                      <th>Batch</th>
                      <th>Invigilator</th>
                      {data?.ctx?.examInternal ? <th>I Max</th> : null}
                      {data?.ctx?.examViva ? <th>V Max</th> : null}
                      {data?.ctx?.examExternal ? <th>E Max</th> : null}
                      <th>Pass</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.subjectId}>
                        <td className="subject-code">{row.subjectId}</td>
                        <td className="subject-name">{row.subjectName}</td>
                        <td>{row.categoryName}</td>
                        <td>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={toDateInputValue(row.examDate)}
                            disabled={busy}
                            onChange={(e) => updateRow(index, { examDate: fromDateInputValue(e.target.value) })}
                          />
                        </td>
                        <td>
                          <SessionToggle
                            value={row.examSession}
                            disabled={busy}
                            onChange={(session) => updateRow(index, { examSession: session })}
                          />
                        </td>
                        <td>
                          <div className="exam-schedule-chip-select">
                            <ChipMultiSelect
                              options={data?.batchOptions || []}
                              value={row.batchNos || []}
                              onChange={(value) => updateRow(index, { batchNos: value })}
                              disabled={busy}
                              showSearch={(data?.batchOptions || []).length > 6}
                              searchPlaceholder="Search batch…"
                              emptySelectionText="Select batch"
                            />
                          </div>
                        </td>
                        <td>
                          <div className="exam-schedule-chip-select invigilator-select">
                            <ChipMultiSelect
                              options={data?.invigilatorOptions || []}
                              value={row.invigilators || []}
                              onChange={(value) => updateRow(index, { invigilators: value })}
                              disabled={busy}
                              showSearch
                              searchPlaceholder="Search staff…"
                              emptySelectionText="Select invigilator"
                            />
                          </div>
                        </td>
                        {data?.ctx?.examInternal ? (
                          <td>
                            <input
                              className="form-control form-control-sm exam-schedule-mark-input"
                              readOnly={row.marksReadonly}
                              value={row.internalMax}
                              onChange={(e) => updateRow(index, { internalMax: e.target.value })}
                            />
                          </td>
                        ) : null}
                        {data?.ctx?.examViva ? (
                          <td>
                            <input
                              className="form-control form-control-sm exam-schedule-mark-input"
                              readOnly={row.marksReadonly}
                              value={row.vivaMax}
                              onChange={(e) => updateRow(index, { vivaMax: e.target.value })}
                            />
                          </td>
                        ) : null}
                        {data?.ctx?.examExternal ? (
                          <td>
                            <input
                              className="form-control form-control-sm exam-schedule-mark-input"
                              readOnly={row.marksReadonly}
                              value={row.externalMax}
                              onChange={(e) => updateRow(index, { externalMax: e.target.value })}
                            />
                          </td>
                        ) : null}
                        <td>
                          <input
                            className="form-control form-control-sm exam-schedule-mark-input"
                            readOnly={row.marksReadonly}
                            value={row.passMark}
                            onChange={(e) => updateRow(index, { passMark: e.target.value })}
                          />
                        </td>
                        <td className="text-nowrap">
                          {row.scheduleId ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={busy}
                              onClick={() => setDeleteId(row.scheduleId)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </form>
      )}

      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete this schedule row?"
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          await save({
            action: 'delete',
            id: deleteId,
            reloadFields: { exam_name: examId, course_name: courseKey },
          });
          setDeleteId(null);
        }}
        busy={busy}
      />
    </div>
  );
}

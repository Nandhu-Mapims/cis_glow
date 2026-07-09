import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../api/client';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';
import { wireAllocationEditor } from './ttConfigEditorShared';
import './TtConfigSetup.css';

const TT_CONFIG_MORE_API = '/api/academic/tt-config/more';

function scopeToCourseYearKey(scope) {
  if (!scope) return '';
  return `${scope.courseId}___${scope.academicYear}___${scope.academicType}`;
}

export default function TtConfigSetup() {
  const { data, busy, error, notice, load } = useAcademicSetupApi('tt-config');
  const [courseYearKey, setCourseYearKey] = useState('');
  const [semester, setSemester] = useState('');
  const [localError, setLocalError] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const editorRef = useRef(null);
  const lastGridParamsRef = useRef(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.courseYearKey) setCourseYearKey(data.courseYearKey);
    if (data?.semester) setSemester(String(data.semester));
    if (data?.grid && data?.scope) {
      lastGridParamsRef.current = {
        course_name: data.courseYearKey || scopeToCourseYearKey(data.scope),
        semester_name: String(data.scope.semester),
      };
    }
  }, [data]);

  const gridLoadFields = (patch = {}) => {
    const scope = data?.scope;
    const saved = lastGridParamsRef.current;
    return {
      course_name: patch.courseYearKey
        ?? courseYearKey
        ?? saved?.course_name
        ?? scopeToCourseYearKey(scope),
      semester_name: patch.semester
        ?? semester
        ?? saved?.semester_name
        ?? (scope ? String(scope.semester) : ''),
      Submit: 'Go',
    };
  };

  const reloadFilters = (patch = {}) => load({
    course_name: patch.courseYearKey ?? courseYearKey,
    semester_name: patch.semester ?? semester,
  });

  const reloadGrid = (patch = {}) => load(gridLoadFields(patch));

  const handleGo = async (e) => {
    e.preventDefault();
    if (!courseYearKey) {
      setLocalError('Select course and academic year first.');
      return;
    }
    if (!semester) {
      setLocalError('Select year, then click Go.');
      return;
    }
    setLocalError('');
    await reloadGrid();
  };

  const openEditor = useCallback(async (cell) => {
    if (!data?.scope || cell.counter == null) return;
    setEditorBusy(true);
    setEditorOpen(true);
    try {
      const q = new URLSearchParams({
        flag: '2',
        pday: cell.day,
        pno: cell.periodNo,
        tcourse: String(data.scope.courseId),
        tayear: data.scope.academicYear,
        tcyear: String(data.scope.semester),
        tcacademic: data.scope.academicType,
        eopt: '',
        ptype: '',
        sgp: '',
      });
      const res = await api.get(`${TT_CONFIG_MORE_API}?${q.toString()}`);
      const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (parsed?.[0] === 1) setEditorHtml(parsed[1] || '');
      else setEditorHtml('<p class="text-danger p-3">Unable to load editor.</p>');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      setEditorHtml(`<p class="text-danger p-3">Unable to load editor. ${msg}</p>`);
    } finally {
      setEditorBusy(false);
    }
  }, [data?.scope]);

  const saveEditor = async () => {
    const form = editorRef.current?.querySelector('#tt-allocation-form');
    if (!form || !data?.scope) return;
    setEditorBusy(true);
    setLocalError('');
    try {
      const subjectSelect = form.querySelector('select[name="tsub_id[]"]');
      if (!subjectSelect?.value) {
        setLocalError('Select a subject before saving.');
        return;
      }
      const inputs = form.querySelectorAll('input, select, textarea');
      const params = new URLSearchParams();
      params.append('Save', 'Save');
      params.append('tt_course', String(data.scope.courseId));
      params.append('tt_ayear', data.scope.academicYear);
      params.append('tt_cyear', String(data.scope.semester));
      params.append('tt_cacademic', data.scope.academicType);
      inputs.forEach((el) => {
        if (!el.name || el.type === 'button') return;
        if (el.type === 'checkbox' && !el.checked) return;
        if (el.type === 'radio' && !el.checked) return;
        if (el.tagName === 'SELECT' && el.multiple) {
          [...el.selectedOptions].forEach((opt) => params.append(el.name, opt.value));
          return;
        }
        params.append(el.name, el.value);
      });
      const res = await api.post(TT_CONFIG_MORE_API, { body: params.toString() });
      const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (parsed?.[0] !== 1) {
        setLocalError('Unable to save timetable allocation. Check subject, staff, and dates.');
        return;
      }
      setEditorOpen(false);
      await load(gridLoadFields({
        courseYearKey: scopeToCourseYearKey(data.scope),
        semester: String(data.scope.semester),
      }));
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Unknown error';
      setLocalError(`Unable to save timetable allocation. ${msg}`);
    } finally {
      setEditorBusy(false);
    }
  };

  useEffect(() => {
    if (!editorOpen || editorBusy || !editorHtml) return undefined;
    return wireAllocationEditor(TT_CONFIG_MORE_API, editorRef.current);
  }, [editorOpen, editorBusy, editorHtml]);

  const showError = localError || error;

  return (
    <>
      <SetupAlerts notice={notice} error={showError} busy={busy} />
      <div className="mb-3 row g-2">
        <label className="col-sm-2 col-form-label">Course &amp; Academic year</label>
        <div className="col-sm-5">
          <select className="form-select" value={courseYearKey} onChange={async (e) => {
            const value = e.target.value;
            setCourseYearKey(value);
            setSemester('');
            setLocalError('');
            await reloadFilters({ courseYearKey: value, semester: '' });
          }}>
            <option value="">--Select Course--</option>
            {(data?.courseYearOptions || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {data?.selection ? (
        <>
          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Year</label>
            <div className="col-sm-8">
              {(data.totalSemester || 0) > 0 ? (
                Array.from({ length: data.totalSemester }, (_, i) => i + 1).map((yr) => (
                  <label key={yr} className="me-3">
                    <input
                      type="radio"
                      name="ttConfigYear"
                      checked={String(semester) === String(yr)}
                      onChange={() => {
                        setSemester(String(yr));
                        setLocalError('');
                      }}
                    />
                    {' '}
                    {yr}
                  </label>
                ))
              ) : (
                <span className="text-muted small">Loading year options…</span>
              )}
            </div>
          </div>
          <form className="mb-3" onSubmit={handleGo}>
            <button type="submit" className="btn btn-info" disabled={busy}>Go</button>
          </form>
        </>
      ) : null}

      {data?.loaded && !data?.grid && (
        <div className="alert alert-warning">No timetable grid found for this selection.</div>
      )}

      {data?.grid ? (
        <div className="table-responsive">
          <table className="table table-bordered align-middle tt-config-grid">
            <thead>
              <tr className="table-secondary">
                <th>Day / Time</th>
                {(data.grid.headers || []).map((h, i) => (
                  <th key={i} colSpan={h.colspan} className="text-center">{h.from} – {h.to}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.grid.rows || []).map((row) => (
                <tr key={row.day} className={row.shaded ? 'table-light' : ''}>
                  <td className="fw-semibold">{row.label}</td>
                  {row.cells.map((cell, ci) => (
                    <td
                      key={`${row.day}-${ci}`}
                      colSpan={cell.colspan}
                      rowSpan={cell.rowspan}
                      className={cell.isBreak ? 'text-center text-muted' : 'tt-config-cell'}
                      style={{ minHeight: 50, cursor: cell.isBreak ? 'default' : 'pointer', verticalAlign: 'top' }}
                      onClick={() => !cell.isBreak && openEditor(cell)}
                    >
                      {cell.isBreak ? 'Break' : (
                        <div dangerouslySetInnerHTML={{ __html: cell.summary || '<span class="text-muted small">Click to allocate</span>' }} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="modal fade show d-block tt-allocation-modal" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Timetable allocation</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditorOpen(false)} />
              </div>
              <div className="modal-body tt-allocation-body" ref={editorRef}>
                {editorBusy ? <p className="text-muted mb-0">Loading editor…</p> : (
                  <div className="tt-allocation-root" dangerouslySetInnerHTML={{ __html: editorHtml }} />
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditorOpen(false)}>Back</button>
                <button type="button" className="btn btn-danger" disabled={editorBusy} onClick={saveEditor}>Save</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

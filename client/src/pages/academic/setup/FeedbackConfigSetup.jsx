import { useEffect, useState } from 'react';
import LegacyDateTimeInput from '../../../components/LegacyDateTimeInput';
import { ensureLegacyDateTimePicker } from '../../../utils/legacyDateTimePickerLoader';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';
import { GroupedSelect } from './curriculumReportUi';

export default function FeedbackConfigSetup({ screen }) {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi(screen);
  const [feedbackId, setFeedbackId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [title, setTitle] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [subjectRows, setSubjectRows] = useState([]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    ensureLegacyDateTimePicker().catch(() => {});
  }, []);
  useEffect(() => {
    if (data?.feedbackId != null) setFeedbackId(String(data.feedbackId));
    if (data?.courseKey) setCourseKey(data.courseKey);
    else if (data?.feedback?.courseId) setCourseKey(data.feedback.courseId);
    if (data?.feedback) {
      setTitle(data.feedback.title || '');
      setFromDate(data.feedback.fromDate || '');
      setToDate(data.feedback.toDate || '');
    }
    if (data?.subjectRows) setSubjectRows(data.subjectRows);
  }, [data]);

  const onFeedbackChange = async (value) => {
    setFeedbackId(value);
    setCourseKey('');
    setFromDate('');
    setToDate('');
    setSubjectRows([]);
    const res = await load({ feedbackId: value, category: value, courseKey: '' });
    if (res?.feedback) {
      setTitle(res.feedback.title || '');
      setFromDate(res.feedback.fromDate || '');
      setToDate(res.feedback.toDate || '');
    }
    if (res?.courseKey) setCourseKey(res.courseKey);
    else if (res?.feedback?.courseId) setCourseKey(res.feedback.courseId);
    if (res?.subjectRows) setSubjectRows(res.subjectRows);
  };

  const onCourseChange = async (value) => {
    setCourseKey(value);
    const res = await load({
      feedbackId,
      category: feedbackId,
      courseKey: value,
      course_name: value,
    });
    if (res?.subjectRows) setSubjectRows(res.subjectRows);
    else setSubjectRows([]);
  };

  const toggleStaff = (rowIndex, staffId) => {
    setSubjectRows((prev) => prev.map((row, i) => {
      if (i !== rowIndex) return row;
      const selected = new Set(row.selectedStaff || []);
      if (selected.has(staffId)) selected.delete(staffId);
      else selected.add(staffId);
      return { ...row, selectedStaff: [...selected] };
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      feedbackId,
      category: feedbackId,
      courseKey,
      course_name: courseKey,
      title,
      feedback_title: title,
      fromDate,
      from_date: fromDate,
      toDate,
      to_date: toDate,
      subjectRows,
    });
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <div className="mb-3 row g-2">
        <label className="col-sm-2 col-form-label">Feedback</label>
        <div className="col-sm-4">
          <select className="form-select" value={feedbackId} onChange={(e) => onFeedbackChange(e.target.value)}>
            <option value="">--Select--</option>
            {(data?.feedbackOptions || []).map((opt) => <option key={opt.value || opt.id} value={opt.value || opt.id}>{opt.label || opt.title}</option>)}
          </select>
        </div>
      </div>
      {feedbackId ? (
        <form onSubmit={handleSave}>
          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Title</label>
            <div className="col-sm-4"><input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          </div>
          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Course</label>
            <div className="col-sm-6">
              <GroupedSelect
                options={data?.courseOptions}
                value={courseKey}
                disabled={busy}
                placeholder="--Course--"
                onChange={onCourseChange}
              />
            </div>
          </div>
          <div className="mb-3 row g-2 align-items-center">
            <label className="col-sm-2 col-form-label">From / To</label>
            <div className="col-sm-3">
              <LegacyDateTimeInput
                key={`from-${feedbackId}`}
                value={fromDate}
                disabled={busy}
                onChange={setFromDate}
              />
            </div>
            <div className="col-sm-3">
              <LegacyDateTimeInput
                key={`to-${feedbackId}`}
                value={toDate}
                disabled={busy}
                onChange={setToDate}
              />
            </div>
          </div>
          {courseKey && subjectRows.length ? (
            <table className="table table-bordered table-sm">
              <thead><tr><th>#</th><th>Type</th><th>Subject</th><th>Staff</th></tr></thead>
              <tbody>
                {subjectRows.map((row, i) => (
                  <tr key={row.subjectId}>
                    <td>{i + 1}</td>
                    <td>{row.type}</td>
                    <td>{row.subjectName}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        {(row.staffOptions || []).map((s) => (
                          <label key={s.value} className="small">
                            <input
                              type="checkbox"
                              checked={(row.selectedStaff || []).includes(s.value)}
                              onChange={() => toggleStaff(i, s.value)}
                            />
                            {' '}{s.label}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : courseKey ? (
            <p className="text-muted small">No subjects found for the selected course and year.</p>
          ) : null}
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </form>
      ) : null}
    </>
  );
}

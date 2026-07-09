import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

export default function CourseAddSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('course-add');
  const [form, setForm] = useState({
    courseTime: 'Full Time',
    courseName: 'U.G',
    degreeName: '',
    degreeShortName: '',
    departmentName: '',
    departmentShortName: '',
    departmentRef: '',
    yearOfStart: '',
    courseDuration: '',
    totalSemester: '',
    semesterPerYear: '',
    displayOrder: '',
  });

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.defaults) {
      setForm((prev) => ({ ...prev, ...data.defaults }));
    }
  }, [data]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await save(form);
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <form onSubmit={handleSubmit} className="row g-3">
        <div className="col-md-6">
          <label className="form-label">Course</label>
          <select className="form-select" value={form.courseName} onChange={(e) => setField('courseName', e.target.value)}>
            {(data?.courseNameOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Full Time / Part Time</label>
          <div>
            <label className="me-3"><input type="radio" checked={form.courseTime === 'Full Time'} onChange={() => setField('courseTime', 'Full Time')} /> Full Time</label>
            <label><input type="radio" checked={form.courseTime === 'Part Time'} onChange={() => setField('courseTime', 'Part Time')} /> Part Time</label>
          </div>
        </div>
        <div className="col-md-6"><label className="form-label">Degree</label><input className="form-control" required value={form.degreeName} onChange={(e) => setField('degreeName', e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label">Degree Short Name</label><input className="form-control" value={form.degreeShortName} onChange={(e) => setField('degreeShortName', e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label">Major</label><input className="form-control" required value={form.departmentName} onChange={(e) => setField('departmentName', e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label">Major Short Name</label><input className="form-control" required value={form.departmentShortName} onChange={(e) => setField('departmentShortName', e.target.value)} /></div>
        <div className="col-md-6">
          <label className="form-label">Department Name</label>
          <select className="form-select" value={form.departmentRef} onChange={(e) => setField('departmentRef', e.target.value)}>
            <option value="">--Select--</option>
            {(data?.departmentOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-3"><label className="form-label">Year of Start</label><input className="form-control" required value={form.yearOfStart} onChange={(e) => setField('yearOfStart', e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">Duration (years)</label><input className="form-control" required value={form.courseDuration} onChange={(e) => setField('courseDuration', e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">Total Semester</label><input className="form-control" required value={form.totalSemester} onChange={(e) => setField('totalSemester', e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">Semester Per Year</label><input className="form-control" required value={form.semesterPerYear} onChange={(e) => setField('semesterPerYear', e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">Display Order</label><input className="form-control" required value={form.displayOrder} onChange={(e) => setField('displayOrder', e.target.value)} /></div>
        <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Add Course</button></div>
      </form>
    </>
  );
}

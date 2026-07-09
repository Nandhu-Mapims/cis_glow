import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

function CourseEditForm({ data, busy, onBack, onSave, onDelete }) {
  const [form, setForm] = useState(data.course);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (data?.course) setForm(data.course);
  }, [data]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="text-end mb-3">
        <button type="button" className="btn btn-link" onClick={onBack}>Back to list</button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave({
            ...form,
            search: data.listContext?.search,
            page: data.listContext?.page,
          });
        }}
        className="row g-3"
      >
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
        <div className="col-12 d-flex justify-content-between">
          <button type="button" className="btn btn-warning" onClick={() => setShowDelete(true)}>Delete</button>
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>
      <ConfirmModal
        show={showDelete}
        message="Are you sure to delete..."
        onClose={() => setShowDelete(false)}
        onConfirm={async () => {
          await onDelete({
            action: 'delete',
            id: form.id,
            search: data.listContext?.search,
            page: data.listContext?.page,
          });
          setShowDelete(false);
          onBack();
        }}
        busy={busy}
      />
    </div>
  );
}

export default function CourseEditSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('course-edit');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (editingId) {
      load({ courseId: editingId, search, page });
    } else {
      load({ search, page });
    }
  }, [load, search, page, editingId]);

  const openCourse = (courseId) => {
    setEditingId(courseId);
  };

  const backToList = () => {
    setEditingId(null);
  };

  if (editingId && data?.mode === 'edit') {
    return (
      <>
        <SetupAlerts notice={notice} error={error} busy={busy} />
        <CourseEditForm data={data} busy={busy} onBack={backToList} onSave={save} onDelete={save} />
      </>
    );
  }

  const total = data?.total || 0;
  const limit = data?.limit || 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <form
        className="row g-2 mb-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPage(1);
          setEditingId(null);
        }}
      >
        <div className="col-md-6">
          <input className="form-control" placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-info" disabled={busy}>Search</button>
        </div>
        <div className="col-md-4 text-end text-muted small align-self-center">
          {total > 0 ? `Showing ${((page - 1) * limit) + 1} to ${Math.min(page * limit, total)} of ${total}` : 'Showing 0 entries'}
        </div>
      </form>

      <table className="table table-hover">
        <thead>
          <tr><th>Courses</th><th /></tr>
        </thead>
        <tbody>
          {(data?.courses || []).map((course) => (
            <tr key={course.id}>
              <td>{course.label}</td>
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => openCourse(course.id)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 ? (
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1 || busy} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="align-self-center small">Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages || busy} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      ) : null}
    </>
  );
}

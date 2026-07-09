import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import StudentPageShell, { STUDENT_BREADCRUMB_HUB } from './StudentPageShell';

const COURSE_TYPES = ['U.G', 'P.G'];

export default function StudentAdmission() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [degrees, setDegrees] = useState([]);
  const [form, setForm] = useState({
    courseName: 'U.G',
    academicYear: '',
    courseId: '',
    registerNo: '',
    rollNo: '',
    admissionNo: '',
    admissionDate: new Date().toISOString().slice(0, 10),
    studentTitle: '',
    studentName: '',
    studentInitial: '',
    gender: 'Male',
    dateOfBirth: '',
    fatherName: '',
    motherName: '',
    mobileNo: '',
    fatherMobile: '',
    personalEmail: '',
    bloodGroup: '',
    religion: '',
    community: '',
    caste: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        const year = settingsRes.data.ugAcademicYear || '';
        setForm((f) => ({ ...f, academicYear: year }));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.academicYear || !form.courseName) {
      setDegrees([]);
      return;
    }
    const loadDegrees = async () => {
      try {
        const res = await api.get('/api/students/admission/degrees', {
          params: { academicYear: form.academicYear, courseName: form.courseName },
        });
        setDegrees(res.data.options || []);
      } catch {
        setDegrees([]);
      }
    };
    loadDegrees();
  }, [form.academicYear, form.courseName]);

  const onCourseTypeChange = (courseName) => {
    const year = courseName === 'P.G'
      ? settings?.pgAcademicYear
      : settings?.ugAcademicYear;
    setForm((f) => ({ ...f, courseName, academicYear: year || f.academicYear, courseId: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post('/api/students', {
        ...form,
        rollNo: form.rollNo || form.registerNo,
      });
      navigate(`/students/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Admission failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudentPageShell
      settings={settings}
      menu={menu}
      loading={loading}
      dashboardTitle="New Student"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        STUDENT_BREADCRUMB_HUB,
        { label: 'New Profile' },
      ]}
      title="Student Admission"
      legacy="student_profile_add.php"
      actions={(
        <Link to="/students/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
      )}
      notice={error ? <div className="alert alert-danger mb-0">{error}</div> : null}
    >
      <form className="card cis-student-form-card" onSubmit={handleSubmit}>
        <div className="card-header">Admission Details</div>
        <div className="card-body row g-3">
          <div className="col-md-4">
            <label className="form-label">Course Type</label>
            <select
              className="form-select"
              value={form.courseName}
              onChange={(e) => onCourseTypeChange(e.target.value)}
            >
              {COURSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Academic Year</label>
            <input
              className="form-control"
              value={form.academicYear}
              onChange={(e) => setForm({ ...form, academicYear: e.target.value, courseId: '' })}
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Degree / Program</label>
            <select
              className="form-select"
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              required
            >
              <option value="">-- Select --</option>
              {degrees.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Register No</label>
            <input
              className="form-control"
              value={form.registerNo}
              onChange={(e) => setForm({ ...form, registerNo: e.target.value })}
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Roll No</label>
            <input
              className="form-control"
              value={form.rollNo}
              onChange={(e) => setForm({ ...form, rollNo: e.target.value })}
              placeholder="Same as register if blank"
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Admission No</label>
            <input
              className="form-control"
              value={form.admissionNo}
              onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Admission Date</label>
            <input
              type="date"
              className="form-control"
              value={form.admissionDate}
              onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Student Name</label>
            <input
              className="form-control"
              value={form.studentName}
              onChange={(e) => setForm({ ...form, studentName: e.target.value })}
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Initial</label>
            <input
              className="form-control"
              value={form.studentInitial}
              onChange={(e) => setForm({ ...form, studentInitial: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Gender</label>
            <select
              className="form-select"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Date of Birth</label>
            <input
              type="date"
              className="form-control"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Father Name</label>
            <input
              className="form-control"
              value={form.fatherName}
              onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Mother Name</label>
            <input
              className="form-control"
              value={form.motherName}
              onChange={(e) => setForm({ ...form, motherName: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Mobile</label>
            <input
              className="form-control"
              value={form.mobileNo}
              onChange={(e) => setForm({ ...form, mobileNo: e.target.value })}
            />
          </div>
        </div>
        <div className="card-footer d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Admission'}
          </button>
          <Link to="/students" className="btn btn-outline-secondary">Cancel</Link>
        </div>
      </form>
    </StudentPageShell>
  );
}

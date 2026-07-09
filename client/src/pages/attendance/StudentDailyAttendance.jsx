import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import '../students/StudentReport.css';

export default function StudentDailyAttendance() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [courseOptions, setCourseOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attCourse, setAttCourse] = useState('U.G___regular');
  const [entries, setEntries] = useState([]);
  const [sections, setSections] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes, filtersRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          api.get('/api/attendance/students/filters'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        setCourseOptions(filtersRes.data.courseOptions || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadSheet = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setMessage('');
    setSaveMessage('');
    try {
      const res = await api.post('/api/attendance/students/daily', {
        attendanceDate,
        attCourse,
      });
      setEntries(res.data.entries || []);
      setSections(res.data.sections || []);
      setMessage(res.data.message || res.data.error || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load attendance sheet');
      setEntries([]);
      setSections([]);
    } finally {
      setGenerating(false);
    }
  };

  const updatePresentList = (index, value) => {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, presentList: value } : entry)));
  };

  const saveAttendance = async () => {
    if (!entries.length) {
      setError('Load the attendance sheet before saving');
      return;
    }
    setSaving(true);
    setError(null);
    setSaveMessage('');
    try {
      const res = await api.put('/api/attendance/students/daily', {
        attendanceDate,
        entries,
      });
      setSaveMessage(res.data.message || 'Attendance updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save attendance');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/attendance">Attendance</Link></li>
          <li className="breadcrumb-item active">Student Daily</li>
        </ol>
      </nav>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Student Daily Attendance</h4>
        <Link to="/attendance" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-warning">{message}</div>}
      {saveMessage && <div className="alert alert-success">{saveMessage}</div>}

      <form className="card mb-3" onSubmit={loadSheet}>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={attendanceDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Course</label>
            <select className="form-select" value={attCourse} onChange={(e) => setAttCourse(e.target.value)}>
              {courseOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-danger" disabled={generating}>
              {generating ? 'Loading...' : 'Go'}
            </button>
          </div>
        </div>
      </form>

      {entries.length > 0 && (
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Edit absent roll numbers (comma-separated)</span>
            <button type="button" className="btn btn-success btn-sm" onClick={saveAttendance} disabled={saving}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
          <div className="card-body">
            <p className="text-danger small">Enter roll numbers separated by comma. Saved values are absentees for each period.</p>
            {sections.map((section) => {
              const sectionEntries = entries
                .map((entry, index) => ({ entry, index }))
                .filter(({ entry }) => String(entry.courseId) === String(section.courseId) && entry.currentYear === section.currentYear);
              if (!sectionEntries.length) return null;
              return (
                <div className="mb-4" key={`${section.courseId}-${section.currentYear}`}>
                  <h6 className="mb-2">
                    {section.yearLabel || section.currentYear}
                    {section.degreeName ? ` — ${section.degreeName}${section.departmentName || ''}` : ''}
                  </h6>
                  <div className="row g-3">
                    {sectionEntries.map(({ entry, index }) => (
                      <div className="col-md-4" key={`${entry.courseId}-${entry.period}-${index}`}>
                        <label className="form-label small">
                          {entry.periodLabel || `Period ${entry.period}`}
                          {entry.hasExistingRecord ? ' (saved)' : ''}
                        </label>
                        <textarea
                          className="form-control"
                          rows={4}
                          value={entry.presentList}
                          onChange={(e) => updatePresentList(index, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

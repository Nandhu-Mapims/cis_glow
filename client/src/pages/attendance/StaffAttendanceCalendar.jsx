import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import '../students/StudentReport.css';

export default function StaffAttendanceCalendar() {
  const [searchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [staffId, setStaffId] = useState(() => searchParams.get('staffId') || '');
  const [html, setHtml] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const fromUrl = searchParams.get('staffId');
    if (fromUrl && !loading && !html) {
      setStaffId(fromUrl);
      setGenerating(true);
      api.post('/api/attendance/staff/calendar', { staffId: fromUrl.trim() })
        .then((res) => setHtml(res.data.html || ''))
        .catch((err) => setError(err.response?.data?.message || 'Unable to load calendar'))
        .finally(() => setGenerating(false));
    }
  }, [loading, searchParams, html]);

  const loadCalendar = async (e) => {
    e?.preventDefault();
    if (!staffId.trim()) {
      setError('Staff ID is required');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post('/api/attendance/staff/calendar', { staffId: staffId.trim() });
      setHtml(res.data.html || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load calendar');
      setHtml('');
    } finally {
      setGenerating(false);
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
          <li className="breadcrumb-item active">Staff Calendar</li>
        </ol>
      </nav>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Staff Attendance Calendar</h4>
        <Link to="/attendance" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card mb-3" onSubmit={loadCalendar}>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Staff ID</label>
            <input className="form-control" value={staffId} onChange={(e) => setStaffId(e.target.value)} required />
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-danger" disabled={generating}>
              {generating ? 'Loading...' : 'Go'}
            </button>
          </div>
        </div>
      </form>

      {html && (
        <div
          className="card shadow-sm student-report-page"
          onClick={(e) => {
            const link = e.target.closest('a');
            if (!link || !link.href.includes('staff_id=')) return;
            e.preventDefault();
            const url = new URL(link.href, window.location.origin);
            const nextId = url.searchParams.get('staff_id');
            const m1 = url.searchParams.get('m1');
            const m2 = url.searchParams.get('m2');
            if (nextId) setStaffId(nextId);
            setGenerating(true);
            api.post('/api/attendance/staff/calendar', {
              staffId: nextId || staffId,
              fromDate: m1 || undefined,
              toDate: m2 || undefined,
            }).then((res) => {
              setHtml(res.data.html || '');
            }).catch((err) => {
              setError(err.response?.data?.message || 'Unable to load calendar');
            }).finally(() => setGenerating(false));
          }}
        >
          <div className="card-body student-report-preview" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </DashboardLayout>
  );
}

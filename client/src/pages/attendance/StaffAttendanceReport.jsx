import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import ReportPrintBar from '../../components/ReportPrintBar';
import DashboardLayout from '../../layouts/DashboardLayout';
import '../students/StudentReport.css';

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export default function StaffAttendanceReport() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [html, setHtml] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes, catRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          api.get('/api/attendance/staff/categories'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        setCategories(catRes.data.categories || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleCategory = (id) => {
    const key = String(id);
    setSelected((prev) => (prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]));
  };

  const generate = async (e) => {
    e.preventDefault();
    if (!selected.length) {
      setError('Select at least one category');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post('/api/attendance/staff/report', {
        categories: selected,
        fromDate: toDisplayDate(fromDate),
        toDate: toDisplayDate(toDate),
      });
      setHtml(res.data.html || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Report failed');
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
          <li className="breadcrumb-item active">Staff Report</li>
        </ol>
      </nav>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Staff Attendance Report</h4>
        <Link to="/attendance" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card mb-3" onSubmit={generate}>
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label">Categories</label>
            <div className="d-flex flex-wrap gap-2">
              {categories.map((cat) => (
                <label key={cat.id} className="btn btn-sm btn-outline-secondary">
                  <input
                    type="checkbox"
                    className="me-1"
                    checked={selected.includes(String(cat.id))}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <label className="form-label">From</label>
              <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">To</label>
              <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <button type="submit" className="btn btn-danger" disabled={generating}>
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </form>

      {html && (
        <>
          <ReportPrintBar html={html} />
          <div className="card shadow-sm student-report-page">
            <div className="card-body student-report-preview overflow-auto" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';

export default function AcademicCourseList() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ courses: [], total: 0, limit: 20 });

  const loadCourses = useCallback(async (nextSearch, nextPage) => {
    setBusy(true);
    try {
      const res = await api.get('/api/academic/courses', {
        params: { search: nextSearch, page: nextPage },
      });
      setData(res.data);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        await loadCourses('', 1);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadCourses]);

  const onSearch = async (event) => {
    event.preventDefault();
    setPage(1);
    await loadCourses(search, 1);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Courses' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/academic">Academic</Link></li>
          <li className="breadcrumb-item active">Courses</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <h3 className="dashboard-title mb-0">Course Directory</h3>
        <div className="d-flex gap-2">
          <Link to="/academic/setup/course-add" className="btn btn-primary btn-sm">Add course</Link>
          <Link to="/academic" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      <form className="row g-2 mb-3" onSubmit={onSearch}>
        <div className="col-sm-8 col-md-6">
          <input
            type="search"
            className="form-control"
            placeholder="Search course or degree name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-outline-primary" disabled={busy}>Search</button>
        </div>
      </form>

      {busy && <div className="text-muted small mb-2">Loading courses…</div>}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Course</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-muted">No courses found.</td>
                </tr>
              ) : (
                data.courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.label}</td>
                    <td className="text-end">
                      <Link
                        to={`/academic/courses/${course.id}/edit`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.total > data.limit && (
        <div className="d-flex justify-content-between align-items-center mt-3">
          <span className="text-muted small">
            Page {page} of {totalPages} ({data.total} courses)
          </span>
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page <= 1 || busy}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                loadCourses(search, next);
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page >= totalPages || busy}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                loadCourses(search, next);
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

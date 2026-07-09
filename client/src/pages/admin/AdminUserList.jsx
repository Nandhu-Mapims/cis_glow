import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';

export default function AdminUserList() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], total: 0, limit: 20 });

  const loadUsers = useCallback(async (nextSearch, nextPage) => {
    setBusy(true);
    try {
      const res = await api.get('/api/admin/users', {
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
        await loadUsers('', 1);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadUsers]);

  const onSearch = async (event) => {
    event.preventDefault();
    setPage(1);
    await loadUsers(search, 1);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Users' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/admin">Admin</Link></li>
          <li className="breadcrumb-item active">Users</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <h3 className="dashboard-title mb-0">User Directory</h3>
        <div className="d-flex gap-2">
          <Link to="/admin/setup/account-add" className="btn btn-primary btn-sm">Add user</Link>
          <Link to="/admin" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      <form className="row g-2 mb-3" onSubmit={onSearch}>
        <div className="col-sm-8 col-md-6">
          <input
            type="search"
            className="form-control"
            placeholder="Search member ID or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-outline-primary" disabled={busy}>Search</button>
        </div>
      </form>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Name</th>
                <th>Email</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted">No users found.</td>
                </tr>
              ) : (
                data.users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.memberId}</td>
                    <td>{user.memberName}</td>
                    <td>{user.email || '—'}</td>
                    <td className="text-end">
                      <Link
                        to={`/admin/users/${user.id}/edit`}
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
          <span className="text-muted small">Page {page} of {totalPages}</span>
          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page <= 1 || busy}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                loadUsers(search, next);
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
                loadUsers(search, next);
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

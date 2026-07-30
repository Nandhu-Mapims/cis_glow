import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Breadcrumbs, PageError, PageHeader, PageLoading } from '../../components/PageShell';
import DataTable from '../../components/DataTable';

const BREADCRUMBS = [
  { label: 'Home', to: '/dashboard' },
  { label: 'Admin', to: '/admin' },
  { label: 'Users' },
];

export default function AdminUserList() {
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState(null);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);

  const loadUsers = useCallback(async (nextSearch) => {
    setBusy(true);
    setListError(null);
    try {
      const res = await api.get('/api/admin/users', {
        params: { search: nextSearch, page: 1, limit: 100 },
      });
      setUsers(res.data.users || []);
    } catch (err) {
      setListError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await loadUsers('');
      } catch (err) {
        setPageError(err.response?.data?.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (event) => {
    event.preventDefault();
    loadUsers(search);
  };

  const columns = useMemo(() => [
    {
      key: 'memberId',
      header: 'Member ID',
      primary: true,
      sortable: true,
      searchField: true,
      width: '12rem',
      render: (row) => row.memberId || '—',
    },
    {
      key: 'memberName',
      header: 'Name',
      sortable: true,
      searchField: true,
      render: (row) => row.memberName || '—',
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      searchField: true,
      render: (row) => row.email || '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Link
          to={`/admin/users/${row.id}/edit`}
          className="btn btn-sm btn-outline-primary"
          onClick={(e) => e.stopPropagation()}
        >
          Edit
        </Link>
      ),
    },
  ], []);

  if (loading) {
    return <PageLoading message="Loading users…" />;
  }
  if (pageError) {
    return <PageError message={pageError} onRetry={() => window.location.reload()} />;
  }

  const emptyState = search
    ? {
      icon: 'fa fa-user-times',
      title: 'No users found',
      message: 'Nothing matched this search. Try a different member ID, name, or email.',
    }
    : {
      icon: 'fa fa-users',
      title: 'No users yet',
      message: 'Add a user account to get started.',
    };

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Users' }} menu={menu}>
      <div className="cis-page">
        <Breadcrumbs items={BREADCRUMBS} />
        <PageHeader
          title="User Directory"
          subtitle="Search and manage login accounts"
          actions={(
            <>
              <Link to="/admin" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
              <Link to="/admin/setup/account-add" className="btn btn-primary btn-sm">
                <i className="fa fa-plus me-1" aria-hidden="true" />
                Add User
              </Link>
            </>
          )}
        />

        <section className="cis-searchbar" aria-label="User search">
          <form className="cis-searchbar-field" onSubmit={onSearch}>
            <label className="cis-searchbar-label" htmlFor="user-q">Search</label>
            <div className="cis-searchbar-input-row">
              <input
                id="user-q"
                name="q"
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Member ID, name, or email"
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Searching…' : 'Search'}
              </button>
            </div>
            <p className="cis-searchbar-hint">Matches member ID, name, or email address.</p>
          </form>
        </section>

        <DataTable
          columns={columns}
          rows={users}
          getRowKey={(row) => row.id}
          loading={busy}
          error={listError}
          onRetry={() => loadUsers(search)}
          empty={emptyState}
          caption="User accounts"
          searchable={users.length > 8}
          searchPlaceholder="Filter these users by ID, name, or email…"
          pageSize={25}
          initialSort={{ key: 'memberId', dir: 'asc' }}
        />
      </div>
    </DashboardLayout>
  );
}

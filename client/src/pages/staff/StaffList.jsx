import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Breadcrumbs, PageError, PageHeader, PageLoading } from '../../components/PageShell';
import DataTable from '../../components/DataTable';

const BREADCRUMBS = [
  { label: 'Home', to: '/dashboard' },
  { label: 'Staff', to: '/staff/hub' },
  { label: 'Search' },
];

const MODES = [
  { key: 'name', icon: 'fa fa-user', label: 'Name' },
  { key: 'staff_id', icon: 'fa fa-id-badge', label: 'Staff ID' },
  { key: 'category', icon: 'fa fa-users', label: 'Category' },
];

export default function StaffList() {
  const navigate = useNavigate();
  const { settings, menu } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [staff, setStaff] = useState([]);
  const [searchError, setSearchError] = useState(null);

  const searchBy = searchParams.get('by') || 'name';
  const searchInput = searchParams.get('q') || '';
  const categoryValue = searchParams.get('category') || '';

  useEffect(() => {
    const load = async () => {
      try {
        const categoriesRes = await api.get('/api/staff/categories');
        setCategories(categoriesRes.data.categories || []);
      } catch (err) {
        setPageError(err.response?.data?.message || 'Failed to load staff search');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const runSearch = async (by, q) => {
    if (!q) {
      setStaff([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.get('/api/staff/search', { params: { by, q } });
      setStaff(res.data.staff || []);
      if (res.data.staff?.length === 1) {
        navigate(`/staff/${res.data.staff[0].id}`);
      }
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Search failed');
      setStaff([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (searchBy === 'category' && categoryValue) {
      runSearch('category', categoryValue);
    } else if (searchBy !== 'category' && searchInput) {
      runSearch(searchBy, searchInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleTextSearch = (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    setSearchParams(q ? { by: searchBy, q } : { by: searchBy });
    runSearch(searchBy, q);
  };

  const handleCategoryChange = (value) => {
    setSearchParams(value ? { by: 'category', category: value } : { by: 'category' });
    runSearch('category', value);
  };

  const setMode = (mode) => {
    if (mode === searchBy) return;
    setSearchParams(mode === 'category' ? { by: 'category', category: categoryValue } : { by: mode, q: searchInput });
  };

  const hasSearched = Boolean(searchInput || categoryValue);

  const columns = useMemo(() => [
    {
      key: 'staffId',
      header: 'Staff ID',
      primary: true,
      sortable: true,
      searchField: true,
      width: '9rem',
      render: (row) => row.staffId || '—',
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      searchField: true,
      render: (row) => row.name || '—',
    },
    {
      key: 'designation',
      header: 'Designation',
      sortable: true,
      searchField: true,
      render: (row) => row.designation || '—',
    },
    {
      key: 'jobCategory',
      header: 'Category',
      sortable: true,
      hideOnMobile: true,
      render: (row) => row.jobCategory || '—',
    },
    {
      key: 'resigned',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <span className={`badge ${row.resigned ? 'bg-secondary' : 'bg-success'}`}>
          {row.resigned ? 'Relieved' : 'Active'}
        </span>
      ),
    },
  ], []);

  if (loading) {
    return <PageLoading message="Loading staff search…" />;
  }
  if (pageError) {
    return <PageError message={pageError} onRetry={() => window.location.reload()} />;
  }

  const emptyState = hasSearched
    ? {
      icon: 'fa fa-user-times',
      title: 'No staff found',
      message: 'Nothing matched this search. Check the spelling, or pick a different category.',
    }
    : {
      icon: 'fa fa-search',
      title: 'Search for staff',
      message: 'Enter a name or staff ID, or choose a category above to list its staff.',
    };

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Staff Profile' }} menu={menu}>
      <div className="cis-page">
        <Breadcrumbs items={BREADCRUMBS} />
        <PageHeader
          title="Staff"
          subtitle="Find staff by name, staff ID, or category"
          actions={(
            <>
              <Link to="/staff/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
              <Link to="/staff/reports" className="btn btn-outline-primary btn-sm">Export Report</Link>
              <Link to="/staff/new" className="btn btn-primary btn-sm">
                <i className="fa fa-plus me-1" aria-hidden="true" />
                New Profile
              </Link>
            </>
          )}
        />

        <section className="cis-searchbar" aria-label="Staff search">
          <div className="cis-searchbar-modes" role="tablist" aria-label="Search by">
            {MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                role="tab"
                aria-selected={searchBy === mode.key}
                className={`cis-searchbar-mode${searchBy === mode.key ? ' is-active' : ''}`}
                onClick={() => setMode(mode.key)}
              >
                <i className={mode.icon} aria-hidden="true" />
                {mode.label}
              </button>
            ))}
          </div>

          {searchBy === 'category' ? (
            <div className="cis-searchbar-field">
              <label className="cis-searchbar-label" htmlFor="staff-category">Category</label>
              <select
                id="staff-category"
                className="form-select"
                value={categoryValue}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">Select a category…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                ))}
              </select>
              <p className="cis-searchbar-hint">Lists every active staff member in the selected category.</p>
            </div>
          ) : (
            <form className="cis-searchbar-field" onSubmit={handleTextSearch}>
              <label className="cis-searchbar-label" htmlFor="staff-q">
                {searchBy === 'staff_id' ? 'Staff ID' : 'Name'}
              </label>
              <div className="cis-searchbar-input-row">
                <input
                  id="staff-q"
                  name="q"
                  className="form-control"
                  defaultValue={searchInput}
                  placeholder={searchBy === 'staff_id' ? 'e.g. ST001, ST002' : 'Staff name'}
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
              <p className="cis-searchbar-hint">
                {searchBy === 'staff_id' ? 'Enter one staff ID, or several separated by commas.' : 'Matches name, initial, or staff ID.'}
              </p>
            </form>
          )}
        </section>

        <DataTable
          columns={columns}
          rows={staff}
          getRowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/staff/${row.id}`)}
          loading={searching}
          error={searchError}
          onRetry={() => runSearch(searchBy, searchBy === 'category' ? categoryValue : searchInput)}
          empty={emptyState}
          caption="Staff search results"
          searchable={staff.length > 8}
          searchPlaceholder="Filter these staff by name, ID, or designation…"
          pageSize={25}
          initialSort={{ key: 'name', dir: 'asc' }}
        />
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import {
  ListFilterCard,
  ListRadioOption,
  ListResultCard,
  ListResultsPanel,
  ListSearchPage,
} from '../../components/ListSearchPage';

export default function StaffList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState(null);

  const searchBy = searchParams.get('by') || 'name';
  const searchInput = searchParams.get('q') || '';
  const categoryValue = searchParams.get('category') || '';

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes, categoriesRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          api.get('/api/staff/categories'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
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
    setError(null);
    try {
      const res = await api.get('/api/staff/search', { params: { by, q } });
      setStaff(res.data.staff || []);
      if (res.data.staff?.length === 1) {
        navigate(`/staff/${res.data.staff[0].id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed');
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

  const handleSearch = (e) => {
    e.preventDefault();
    const form = e.target;
    const by = form.by.value;
    if (by === 'category') {
      const cat = form.category.value;
      setSearchParams(cat ? { by, category: cat } : { by });
      if (cat) runSearch('category', cat);
      return;
    }
    const q = form.q.value.trim();
    setSearchParams(q ? { by, q } : { by });
    runSearch(by, q);
  };

  const hasSearched = Boolean(searchInput || categoryValue);

  return (
    <ListSearchPage
      loading={loading}
      pageError={pageError && !settings ? pageError : null}
      onRetry={() => window.location.reload()}
      settings={settings}
      menu={menu}
      dashboardTitle="Staff"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Staff', to: '/staff/hub' }, { label: 'Search' }]}
      title="Staff Search"
      subtitle="Find staff by name, staff ID, or category"
      actions={(
        <>
          <Link to="/staff/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
          <Link to="/staff/reports" className="btn btn-outline-primary btn-sm">Export Report</Link>
          <Link to="/staff/new" className="btn btn-primary btn-sm">New Profile</Link>
        </>
      )}
      filter={(
        <ListFilterCard title="Search filter">
          <form onSubmit={handleSearch}>
            <div className="cis-list-radio-group">
              <ListRadioOption
                name="by"
                value="name"
                checked={searchBy === 'name'}
                onChange={() => setSearchParams({ by: 'name' })}
                label="Name"
              />
              <ListRadioOption
                name="by"
                value="staff_id"
                checked={searchBy === 'staff_id'}
                onChange={() => setSearchParams({ by: 'staff_id' })}
                label="Staff ID"
              />
              <ListRadioOption
                name="by"
                value="category"
                checked={searchBy === 'category'}
                onChange={() => setSearchParams({ by: 'category' })}
                label="Category"
              />
            </div>

            {searchBy === 'category' ? (
              <div className="mb-3">
                <label className="form-label" htmlFor="category">Category</label>
                <select id="category" name="category" className="form-select" defaultValue={categoryValue}>
                  <option value="">-- Select --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-3">
                <label className="form-label" htmlFor="staff-q">
                  {searchBy === 'staff_id' ? 'Staff ID (comma-separated)' : 'Name'}
                </label>
                <input
                  id="staff-q"
                  name="q"
                  className="form-control"
                  defaultValue={searchInput}
                  placeholder={searchBy === 'staff_id' ? 'e.g. ST001, ST002' : 'Staff name'}
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-search-full" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
        </ListFilterCard>
      )}
      results={(
        <ListResultsPanel
          title="Search results"
          count={staff.length}
          loading={searching}
          error={error}
          showEmpty={!searching && hasSearched && staff.length === 0}
          emptyMessage="No staff matched your search."
        >
          <div className="cis-list-grid">
            {staff.map((member) => (
              <ListResultCard
                key={member.id}
                to={`/staff/${member.id}`}
                primary={member.staffId}
                secondary={member.name}
                selected={member.selected}
                icon="fa fa-id-badge"
              />
            ))}
          </div>
        </ListResultsPanel>
      )}
    />
  );
}

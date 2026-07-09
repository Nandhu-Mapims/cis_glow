import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import {
  ListFilterCard,
  ListRadioOption,
  ListResultCard,
  ListResultsPanel,
  ListSearchPage,
} from '../../components/ListSearchPage';

export default function StudentList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState([]);
  const [searchError, setSearchError] = useState(null);

  const searchBy = searchParams.get('by') || 'roll';
  const searchInput = searchParams.get('q') || '';
  const batchValue = searchParams.get('batch') || '';

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes, coursesRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          api.get('/api/students/courses'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        setCourses(coursesRes.data.courses || []);
      } catch (err) {
        setPageError(err.response?.data?.message || 'Failed to load student search');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const runSearch = async (by, q) => {
    if (!q) {
      setStudents([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.get('/api/students/search', { params: { by, q } });
      setStudents(res.data.students || []);
      if (res.data.students?.length === 1) {
        navigate(`/students/${res.data.students[0].id}`);
      }
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Search failed');
      setStudents([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (searchBy === 'roll' && searchInput) {
      runSearch('roll', searchInput);
    } else if (searchBy === 'batch' && batchValue) {
      runSearch('batch', batchValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleRollSearch = (e) => {
    e.preventDefault();
    const q = e.target.roll.value.trim();
    setSearchParams({ by: 'roll', q });
    runSearch('roll', q);
  };

  const handleBatchChange = (value) => {
    setSearchParams({ by: 'batch', batch: value });
    runSearch('batch', value);
  };

  const hasSearched = Boolean(searchInput || batchValue);

  return (
    <ListSearchPage
      loading={loading}
      pageError={pageError && !settings ? pageError : null}
      onRetry={() => window.location.reload()}
      settings={settings}
      menu={menu}
      dashboardTitle="Student Profile"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Student', to: '/students/hub' }, { label: 'Edit Profile' }]}
      title="Student Profile — Search"
      subtitle="Find students by roll number or course batch"
      actions={(
        <>
          <Link to="/students/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
          <Link to="/students/reports" className="btn btn-outline-primary btn-sm">Export Report</Link>
          <Link to="/students/new" className="btn btn-primary btn-sm">New Profile</Link>
        </>
      )}
      filter={(
        <ListFilterCard title="Search filter">
          <div className="cis-list-radio-group">
            <ListRadioOption
              name="searchBy"
              value="roll"
              checked={searchBy === 'roll'}
              onChange={() => setSearchParams({ by: 'roll', q: searchInput })}
              label="Roll number"
            />
            <ListRadioOption
              name="searchBy"
              value="batch"
              checked={searchBy === 'batch'}
              onChange={() => setSearchParams({ by: 'batch', batch: batchValue })}
              label="Course / batch"
            />
          </div>

          {searchBy === 'roll' ? (
            <form onSubmit={handleRollSearch}>
              <label className="form-label" htmlFor="roll">Roll no (comma-separated)</label>
              <div className="input-group">
                <input
                  id="roll"
                  name="roll"
                  className="form-control"
                  defaultValue={searchInput}
                  placeholder="e.g. 2021UG001"
                />
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  Go
                </button>
              </div>
            </form>
          ) : (
            <div>
              <label className="form-label" htmlFor="batch">Course / batch</label>
              <select
                id="batch"
                className="form-select"
                value={batchValue}
                onChange={(e) => handleBatchChange(e.target.value)}
              >
                <option value="">-- Select --</option>
                {courses.map((course) => (
                  <optgroup key={course.id} label={`${course.courseName} | ${course.label}`}>
                    {course.batchOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
        </ListFilterCard>
      )}
      results={(
        <ListResultsPanel
          title="Search results"
          count={students.length}
          loading={searching}
          error={searchError}
          showEmpty={!searching && hasSearched && students.length === 0}
          emptyMessage="No students matched your search."
          footnote={user?.accessType ? `Logged in as ${user.memberName} (${user.memberId})` : null}
        >
          <div className="cis-list-grid">
            {students.map((student) => (
              <ListResultCard
                key={student.id}
                to={`/students/${student.id}`}
                primary={student.registerNo}
                secondary={student.name}
                selected={student.selected}
                icon="fa fa-graduation-cap"
              />
            ))}
          </div>
        </ListResultsPanel>
      )}
    />
  );
}

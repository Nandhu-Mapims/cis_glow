import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Breadcrumbs, PageError, PageHeader, PageLoading } from '../../components/PageShell';
import DataTable from '../../components/DataTable';
import SearchableSelect from '../../components/SearchableSelect';

const BREADCRUMBS = [
  { label: 'Home', to: '/dashboard' },
  { label: 'Student', to: '/students/hub' },
  { label: 'Edit Profile' },
];

export default function StudentList() {
  const { user } = useAuth();
  const { settings, menu } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const searchAbortRef = useRef(null);

  useEffect(() => () => searchAbortRef.current?.abort(), []);

  const searchBy = searchParams.get('by') || 'roll';
  const searchInput = searchParams.get('q') || '';
  const batchValue = searchParams.get('batch') || '';

  useEffect(() => {
    const load = async () => {
      try {
        const coursesRes = await api.get('/api/students/courses');
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
    // Cancel any still-in-flight search so a slow, stale response can't
    // overwrite the result of a newer one (e.g. rapid batch-dropdown changes).
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.get('/api/students/search', { params: { by, q }, signal: controller.signal });
      setStudents(res.data.students || []);
      if (res.data.students?.length === 1) {
        navigate(`/students/${res.data.students[0].id}`);
      }
    } catch (err) {
      if (axios.isCancel(err)) return;
      setSearchError(err.response?.data?.message || 'Search failed');
      setStudents([]);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
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

  const setMode = (mode) => {
    if (mode === searchBy) return;
    setSearchParams(mode === 'roll' ? { by: 'roll', q: searchInput } : { by: 'batch', batch: batchValue });
  };

  // courseId -> readable course label, for the results table Course column.
  const courseById = useMemo(() => {
    const map = new Map();
    courses.forEach((c) => map.set(String(c.id), c));
    return map;
  }, [courses]);

  const courseLabel = (courseId) => {
    const c = courseById.get(String(courseId));
    if (!c) return courseId ? `#${courseId}` : '—';
    const dept = c.departmentName && c.departmentName !== '-' ? ` · ${c.departmentName}` : '';
    return `${c.degreeName}${dept}`;
  };

  const hasSearched = Boolean(searchInput || batchValue);

  const columns = useMemo(() => [
    {
      key: 'registerNo',
      header: 'Register No',
      primary: true,
      numeric: true,
      sortable: true,
      searchField: true,
      width: '9rem',
      render: (row) => row.registerNo || '—',
    },
    {
      key: 'name',
      header: 'Student Name',
      sortable: true,
      searchField: true,
      render: (row) => row.name || '—',
    },
    {
      key: 'course',
      header: 'Course',
      sortable: true,
      sortValue: (row) => courseLabel(row.courseId),
      render: (row) => courseLabel(row.courseId),
    },
    {
      key: 'academicYear',
      header: 'Admission Year',
      numeric: true,
      sortable: true,
      render: (row) => row.academicYear || '—',
    },
    {
      key: 'admissionNo',
      header: 'Admission No',
      numeric: true,
      searchField: true,
      render: (row) => row.admissionNo || '—',
    },
  ], [courseById]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <PageLoading message="Loading student search…" />;
  }
  if (pageError) {
    return <PageError message={pageError} onRetry={() => window.location.reload()} />;
  }

  const emptyState = hasSearched
    ? {
      icon: 'fa fa-user-times',
      title: 'No students found',
      message: 'Nothing matched this search. Check the roll number, or pick a different course batch.',
    }
    : {
      icon: 'fa fa-search',
      title: 'Search for a student',
      message: 'Enter one or more roll numbers, or choose a course batch above to list its students.',
    };

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Student Profile' }} menu={menu}>
      <div className="cis-page">
        <Breadcrumbs items={BREADCRUMBS} />
        <PageHeader
          title="Students"
          subtitle="Find a student by roll number or course batch"
          actions={(
            <>
              <Link to="/students/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
              <Link to="/students/reports" className="btn btn-outline-primary btn-sm">Export Report</Link>
              <Link to="/students/new" className="btn btn-primary btn-sm">
                <i className="fa fa-plus me-1" aria-hidden="true" />
                New Profile
              </Link>
            </>
          )}
        />

        <section className="cis-searchbar" aria-label="Student search">
          <div className="cis-searchbar-modes" role="tablist" aria-label="Search by">
            <button
              type="button"
              role="tab"
              aria-selected={searchBy === 'roll'}
              className={`cis-searchbar-mode${searchBy === 'roll' ? ' is-active' : ''}`}
              onClick={() => setMode('roll')}
            >
              <i className="fa fa-hashtag" aria-hidden="true" />
              Roll number
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchBy === 'batch'}
              className={`cis-searchbar-mode${searchBy === 'batch' ? ' is-active' : ''}`}
              onClick={() => setMode('batch')}
            >
              <i className="fa fa-users" aria-hidden="true" />
              Course / batch
            </button>
          </div>

          {searchBy === 'roll' ? (
            <form className="cis-searchbar-field" onSubmit={handleRollSearch}>
              <label className="cis-searchbar-label" htmlFor="roll">Roll number</label>
              <div className="cis-searchbar-input-row">
                <input
                  id="roll"
                  name="roll"
                  className="form-control"
                  defaultValue={searchInput}
                  placeholder="e.g. 2021UG001, 2021UG002"
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
              <p className="cis-searchbar-hint">Enter one roll number, or several separated by commas.</p>
            </form>
          ) : (
            <div className="cis-searchbar-field">
              <label className="cis-searchbar-label" htmlFor="batch">Course / batch</label>
              <SearchableSelect
                id="batch"
                groups={courses.map((course) => ({
                  label: `${course.courseName} | ${course.label}`,
                  options: course.batchOptions,
                }))}
                value={batchValue}
                onChange={handleBatchChange}
                placeholder="Select a course batch…"
                searchPlaceholder="Search course / batch..."
              />
              <p className="cis-searchbar-hint">Lists every student admitted in the selected batch.</p>
            </div>
          )}
        </section>

        <DataTable
          columns={columns}
          rows={students}
          getRowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/students/${row.id}`)}
          loading={searching}
          error={searchError}
          onRetry={() => runSearch(searchBy, searchBy === 'roll' ? searchInput : batchValue)}
          empty={emptyState}
          caption="Student search results"
          searchable={students.length > 8}
          searchPlaceholder="Filter these students by name, roll or admission no…"
          pageSize={25}
          initialSort={{ key: 'name', dir: 'asc' }}
        />

        {user?.accessType && students.length > 0 && (
          <p className="cis-page-footnote">
            Signed in as
            {' '}
            {user.memberName}
            {' '}
            (
            {user.memberId}
            )
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}

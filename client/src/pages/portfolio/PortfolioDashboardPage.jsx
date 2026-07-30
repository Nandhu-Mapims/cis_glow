import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import { Breadcrumbs, PageHeader, PageLoading } from '../../components/PageShell';
import DashboardLayout from '../../layouts/DashboardLayout';

const COURSE_GROUP_ORDER = ['U.G', 'P.G'];

/** Group rows by courseName ('U.G' / 'P.G'), preserving row order within each group. */
function groupByCourseName(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.courseName || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const orderedKeys = [
    ...COURSE_GROUP_ORDER.filter((key) => groups.has(key)),
    ...[...groups.keys()].filter((key) => !COURSE_GROUP_ORDER.includes(key)),
  ];
  return orderedKeys.map((key) => ({ courseName: key, rows: groups.get(key) }));
}

function readFormYears(form) {
  return {
    ugYear: form.elements.ugYear?.value || '',
    pgYear: form.elements.pgYear?.value || '',
  };
}

export default function PortfolioDashboardPage() {
  const { settings, menu } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({ ugYear: '', pgYear: '' });
  const formRef = useRef(null);
  const requestIdRef = useRef(0);
  const didInitRef = useRef(false);

  const loadDashboard = useCallback(async (payload = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const dashRes = await api.post('/api/portfolio/dashboard/load', {
        fields: payload,
      });
      if (requestId !== requestIdRef.current) return;

      setData(dashRes.data);
      setFields({
        ugYear: dashRes.data.ugYear || '',
        pgYear: dashRes.data.pgYear || '',
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = err.response?.data?.message
        || (err.code === 'ECONNABORTED' ? 'Portfolio dashboard request timed out' : null)
        || (err.message?.includes('Network Error') ? 'Could not reach server — is the API running?' : null)
        || 'Unable to load portfolio dashboard';
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    loadDashboard();
  }, [loadDashboard]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextFields = readFormYears(e.currentTarget);
    setFields(nextFields);
    loadDashboard(nextFields);
  };

  const ugYearOptions = data?.ugYearOptions || [];
  const pgYearOptions = data?.pgYearOptions || [];

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Student Portfolio', to: '/portfolio' }, { label: 'Dashboard' }]} />
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <PageHeader title="Student Portfolio Dashboard" />
        <Link to="/portfolio" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => {
              const nextFields = formRef.current ? readFormYears(formRef.current) : fields;
              loadDashboard(nextFields);
            }}
          >
            Retry
          </button>
        </div>
      )}

      <form ref={formRef} className="row g-2 mb-4" onSubmit={handleSubmit}>
        <div className="col-md-4">
          <label className="form-label small text-muted mb-1" htmlFor="portfolio-ug-year">U.G academic year</label>
          <select
            id="portfolio-ug-year"
            name="ugYear"
            className="form-select"
            value={fields.ugYear}
            onChange={(e) => setFields((prev) => ({ ...prev, ugYear: e.target.value }))}
            disabled={!ugYearOptions.length}
          >
            {ugYearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label small text-muted mb-1" htmlFor="portfolio-pg-year">P.G academic year</label>
          <select
            id="portfolio-pg-year"
            name="pgYear"
            className="form-select"
            value={fields.pgYear}
            onChange={(e) => setFields((prev) => ({ ...prev, pgYear: e.target.value }))}
            disabled={!pgYearOptions.length}
          >
            {pgYearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4 d-flex align-items-end">
          <button className="btn btn-info" type="submit" disabled={loading || !ugYearOptions.length}>
            {loading ? 'Loading…' : 'Go'}
          </button>
        </div>
      </form>

      {loading && !data ? <PageLoading /> : null}

      {data ? (
        <div className="position-relative">
          {loading ? (
            <div className="portfolio-refresh-overlay">
              <div className="spinner-border" role="status" aria-hidden="true" style={{ color: 'var(--cis-primary)' }} />
              <span className="ms-2">Refreshing…</span>
            </div>
          ) : null}
          <div className={loading ? 'portfolio-refresh-content' : ''} aria-busy={loading}>
          {data.summary ? (
            <div className="row g-3 mb-4">
              {[
                ['Overall', data.summary.overall],
                ['Publications', data.summary.publications],
                ['Seminars', data.summary.seminars],
                ['Conference', data.summary.conferences],
                ['Workshops', data.summary.workshops],
              ].map(([label, value]) => (
                <div key={label} className="col-6 col-md-4 col-lg-2">
                  <div className="card text-center h-100">
                    <div className="card-body py-3">
                      <div className="fs-4 fw-semibold">{value}</div>
                    </div>
                    <div className="card-footer small text-white" style={{ background: 'var(--cis-primary)' }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <h5>Publications</h5>
          <div className="table-responsive mb-4">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>Course</th>
                  {(data.publicationTypes || []).map((t) => <th key={t}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {groupByCourseName(data.publicationRows || []).map((group) => (
                  <Fragment key={group.courseName}>
                    <tr className="table-secondary">
                      <th colSpan={(data.publicationTypes || []).length + 1}>{group.courseName}</th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={`${group.courseName}-${row.course}`}>
                        <td>{row.course}</td>
                        {(data.publicationTypes || []).map((t) => (
                          <td key={t} className="text-center">{row.counts?.[t] ?? 0}</td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <h5>Seminars / Conferences / Workshops</h5>
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Category</th>
                  <th>National</th>
                  <th>International</th>
                </tr>
              </thead>
              <tbody>
                {groupByCourseName(data.seminarRows || []).map((group) => (
                  <Fragment key={group.courseName}>
                    <tr className="table-secondary">
                      <th colSpan={4}>{group.courseName}</th>
                    </tr>
                    {group.rows.map((row, i) => (
                      <tr key={`${group.courseName}-${row.course}-${row.category}-${i}`}>
                        <td>{row.course}</td>
                        <td>{row.category}</td>
                        <td className="text-center">{row.national}</td>
                        <td className="text-center">{row.international}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

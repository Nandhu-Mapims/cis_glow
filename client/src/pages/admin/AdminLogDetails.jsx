import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import './AdminSetupPage.css';

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultDateRange() {
  const today = todayIso();
  const [y, m, d] = today.split('-');
  const legacy = `${d}-${m}-${y}`;
  return `${legacy} to ${legacy}`;
}

function isoToLegacyDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function legacyDateToIso(legacy) {
  const m = String(legacy || '').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function legacyRangeToIso(rangeStr) {
  const raw = String(rangeStr || '').trim();
  const [fromPart, toPart] = raw.split(' to ').map((s) => s.trim());
  return {
    from: legacyDateToIso(fromPart),
    to: legacyDateToIso(toPart || fromPart),
  };
}

function buildLegacyDateRange(dateFrom, dateTo) {
  const from = isoToLegacyDate(dateFrom);
  const to = isoToLegacyDate(dateTo || dateFrom);
  if (!from || !to) return defaultDateRange();
  return `${from} to ${to}`;
}

function filtersToFields(filters) {
  return {
    user_name: filters.user_name,
    from_date: buildLegacyDateRange(filters.date_from, filters.date_to),
    os_name: filters.os_name,
    ip_address: filters.ip_address,
    operation: filters.operation,
  };
}

function filtersFromResponse(apiFilters = {}) {
  const { from, to } = legacyRangeToIso(apiFilters.fromDate);
  const today = todayIso();
  return {
    user_name: apiFilters.userName || '',
    date_from: from || today,
    date_to: to || from || today,
    os_name: apiFilters.osName || '',
    ip_address: apiFilters.ipAddress || '',
    operation: apiFilters.operation || '',
  };
}

export default function AdminLogDetails() {
  const [searchParams] = useSearchParams();
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState({
    user_name: '',
    date_from: todayIso(),
    date_to: todayIso(),
    os_name: '',
    ip_address: '',
    operation: '',
  });
  const didInitRef = useRef(false);
  // Remembers the exact fields of the last load (search or default view) so
  // Prev/Next can re-request the same query at a different page.
  const lastFieldsRef = useRef({});

  const loadDetails = useCallback(async (fields = {}) => {
    const isSearch = fields.Submit === 'Search';
    if (isSearch) setHasSearched(true);
    lastFieldsRef.current = fields;

    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/admin/log-details', { fields });
      if (res.data.error) {
        setError(res.data.error);
        if (!isSearch) setData(null);
        return;
      }
      setData(res.data);
      if (res.data.searched) setHasSearched(true);
      if (isSearch && res.data.filters) {
        setFilters(filtersFromResponse(res.data.filters));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load log details');
      if (!isSearch) setData(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const init = async () => {
      try {
        const userFromUrl = searchParams.get('user') || '';
        const initialFields = userFromUrl
          ? { from_date: defaultDateRange(), user_name: userFromUrl, Submit: 'Search' }
          : {};
        if (userFromUrl) {
          setFilters((prev) => ({ ...prev, user_name: userFromUrl }));
          setHasSearched(true);
        }
        await loadDetails(initialFields);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadDetails, searchParams]);

  const onSearch = async (event) => {
    event.preventDefault();
    await loadDetails({ ...filtersToFields(filters), Submit: 'Search' });
  };

  const goToPage = async (page) => {
    await loadDetails({ ...lastFieldsRef.current, page });
  };

  const updateDateFrom = (value) => {
    setFilters((f) => {
      const next = { ...f, date_from: value };
      if (value && f.date_to && value > f.date_to) next.date_to = value;
      return next;
    });
  };

  const updateDateTo = (value) => {
    setFilters((f) => {
      const next = { ...f, date_to: value };
      if (value && f.date_from && value < f.date_from) next.date_from = value;
      return next;
    });
  };

  const printResults = () => {
    const el = document.getElementById('admin-log-details-results');
    if (!el) return;
    const win = window.open('', 'print_content', 'scrollbars=yes');
    win.document.open();
    win.document.write(`<html><head><link href="/legacy/css/bootstrap.min.css" rel="stylesheet"></head><body onload="window.print()">${el.innerHTML}</body></html>`);
    win.document.close();
  };

  const showResults = hasSearched || data?.searched;

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Log Details' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/admin">Admin</Link></li>
          <li className="breadcrumb-item active">Log Details</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Log Details</h3>
          <p className="text-muted small mb-0">Session login/activity trace</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={printResults} disabled={!showResults}>Print</button>
          <Link to="/admin/log-dashboard" className="btn btn-outline-primary btn-sm">Login dashboard</Link>
          <Link to="/admin" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Searching…</div>}

      <div className="row g-3">
        <div className="col-lg-3">
          <div className="card shadow-sm">
            <div className="card-body">
              <h4 className="h6">Search By</h4>
              <form onSubmit={onSearch} className="vstack gap-3">
                <div>
                  <label className="form-label" htmlFor="user_name">User</label>
                  <select
                    id="user_name"
                    className="form-select form-select-sm"
                    value={filters.user_name}
                    onChange={(e) => setFilters((f) => ({ ...f, user_name: e.target.value }))}
                  >
                    <option value="">--Select--</option>
                    {data?.users?.map((user) => (
                      <option key={user.value} value={user.value}>{user.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small text-muted mb-1" htmlFor="date_from">From</label>
                      <input
                        id="date_from"
                        type="date"
                        className="form-control form-control-sm"
                        value={filters.date_from}
                        max={filters.date_to || undefined}
                        onChange={(e) => updateDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-muted mb-1" htmlFor="date_to">To</label>
                      <input
                        id="date_to"
                        type="date"
                        className="form-control form-control-sm"
                        value={filters.date_to}
                        min={filters.date_from}
                        onChange={(e) => updateDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="form-label" htmlFor="os_name">OS</label>
                  <input
                    id="os_name"
                    className="form-control form-control-sm"
                    value={filters.os_name}
                    onChange={(e) => setFilters((f) => ({ ...f, os_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="ip_address">IP</label>
                  <input
                    id="ip_address"
                    className="form-control form-control-sm"
                    value={filters.ip_address}
                    onChange={(e) => setFilters((f) => ({ ...f, ip_address: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="operation">Operation</label>
                  <input
                    id="operation"
                    className="form-control form-control-sm"
                    value={filters.operation}
                    onChange={(e) => setFilters((f) => ({ ...f, operation: e.target.value }))}
                  />
                </div>
                <button type="submit" className="btn btn-info btn-sm align-self-end" disabled={busy}>Search</button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-9">
          <div className="card shadow-sm">
            <div className="card-body" id="admin-log-details-results">
              {showResults && data?.searchSummary && (
                <div className="small text-muted mb-3">
                  User: {data.searchSummary.user}
                  {data.searchSummary.date ? ` | Date: ${data.searchSummary.date}` : ''}
                  {data.searchSummary.os ? ` | OS: ${data.searchSummary.os}` : ''}
                  {data.searchSummary.ip ? ` | IP: ${data.searchSummary.ip}` : ''}
                  {data.searchSummary.operation ? ` | Operation: ${data.searchSummary.operation}` : ''}
                </div>
              )}

              {showResults ? (
                <div className="table-responsive">
                  <table className="table table-sm table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>LIT</th>
                        <th>S</th>
                        <th>LOT</th>
                        <th>Process</th>
                        <th>Time</th>
                        <th>Operation</th>
                        <th>IP</th>
                        <th>Device</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.rows?.length ? data.rows.map((row, idx) => (
                        <tr key={`${row.user}-${row.loginTime}-${idx}`}>
                          <td className="text-nowrap">{row.date}</td>
                          <td className="text-nowrap">{row.user}</td>
                          <td>{row.loginTime}</td>
                          <td>{row.status}</td>
                          <td>{row.logoutTime}</td>
                          <td>{row.processes?.map((p) => p.page).join(', ')}</td>
                          <td>{row.processes?.map((p) => p.time).filter(Boolean).join(', ')}</td>
                          <td>{row.processes?.map((p) => p.operation).filter(Boolean).join(', ')}</td>
                          <td className="text-nowrap">{row.ip}</td>
                          <td>{row.device}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={10} className="text-muted">
                            No matching log rows for the selected filters. Try widening the date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted mb-0">Use the filters and click Search to load session traces.</p>
              )}

              {showResults && (data?.rows?.length > 0 || (data?.page ?? 1) > 1) && (
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span className="text-muted small">
                    Page {data?.page ?? 1}
                    {data?.rows?.length ? ` · ${data.rows.length} rows` : ''}
                  </span>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={busy || (data?.page ?? 1) <= 1}
                      onClick={() => goToPage((data?.page ?? 1) - 1)}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={busy || !data?.hasMore}
                      onClick={() => goToPage((data?.page ?? 1) + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

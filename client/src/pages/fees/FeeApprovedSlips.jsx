import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import { printReportHtml } from '../../utils/printReport';
import { useShellData } from '../../hooks/useShellData';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';
import { formatIndianMoneyDisplay } from './feeUiHelpers';

const META = FEE_SCREEN_META['slips-approved'];

export default function FeeApprovedSlips() {
  const { settings, menu, loading: shellLoading, error: shellError, reload } = useShellData();
  const [dataLoading, setDataLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useTransientNotice(4000);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ slips: [], pagination: { page: 1, totalPages: 1, total: 0 } });

  const loadSlips = useCallback(async (nextPage = page, term = search) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.get('/api/fees/slips/approved', {
        params: { page: nextPage, search: term.trim() },
      });
      setData(res.data);
      setPage(res.data.pagination?.page || nextPage);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load approved slips');
    } finally {
      setBusy(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (shellLoading) return;
    const init = async () => {
      try {
        setBusy(true);
        const res = await api.get('/api/fees/slips/approved', { params: { page: 1 } });
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load approved slips');
      } finally {
        setBusy(false);
        setDataLoading(false);
      }
    };
    init();
  }, [shellLoading]);

  const onSearch = async (e) => {
    e.preventDefault();
    setPage(1);
    await loadSlips(1, search);
  };

  const onDelete = async (groupId) => {
    if (!window.confirm(`Delete approved slip ${groupId}? This soft-deletes fee_slip_tb and student_fee rows.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await api.delete(`/api/fees/slips/approved/${encodeURIComponent(groupId)}`);
      setMessage('Slip deleted.');
      await loadSlips(page, search);
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const onReprint = async (slip) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/fees/receipts/reprint', { groupId: slip.groupId });
      printReportHtml(res.data.html || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Reprint failed');
    } finally {
      setBusy(false);
    }
  };

  const { slips, pagination } = data;

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={shellLoading || dataLoading}
      error={shellError}
      onRetry={reload}
      breadcrumbs={feeScreenBreadcrumbs('slips-approved')}
      title={META.title}
      legacy={META.legacy}
      subtitle={META.subtitle}
      actions={feeBackAction()}
    >
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card mb-3 shadow-sm cis-fee-filter-card" onSubmit={onSearch}>
        <div className="card-header py-2">Search posted slips</div>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Register No</label>
            <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>Search</button>
          </div>
          {pagination.total > 0 && (
            <div className="col-md-6 text-md-end text-muted small align-self-center">
              {pagination.total} approved slip{pagination.total === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </form>

      {busy && !slips.length && (
        <div className="text-muted small mb-2">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          Loading slips…
        </div>
      )}

      {slips.length > 0 ? (
        <div className="row g-3">
          {slips.map((slip) => (
            <div className="col-md-6 col-xl-4" key={slip.groupId}>
              <section className="card shadow-sm h-100 cis-fee-slip-card cis-fee-slip-card--approved">
                <div className="cis-fee-slip-card-header">
                  <div>
                    <span className="badge cis-fee-slip-chip cis-fee-slip-chip--approved">Posted</span>
                    <Link to={`/fees/history?registerNo=${encodeURIComponent(slip.registerNo)}`}>
                      {slip.registerNo}
                    </Link>
                    <div className="cis-fee-slip-card-subtitle">{slip.studentLabel}</div>
                  </div>
                  <div className="cis-fee-slip-card-amount">{formatIndianMoneyDisplay(slip.amount)}</div>
                </div>
                <ul className="list-group list-group-flush">
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Slip ID</span>
                    <span className="font-monospace small">{slip.groupId}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Paid date</span>
                    <span>{slip.paidDate || '—'}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Bank</span>
                    <span className="text-uppercase">{slip.payBank || '—'}</span>
                  </li>
                  <li className="list-group-item">
                    <div className="small text-muted mb-1">Receipts</div>
                    <div className="small">{slip.receiptNos?.join(', ') || '—'}</div>
                  </li>
                  <li className="list-group-item">
                    <div className="small text-muted mb-1">Approved</div>
                    <div className="small">{slip.approvedBy} @ {slip.approvedAt}</div>
                  </li>
                </ul>
                <div className="cis-fee-slip-card-footer d-flex gap-2">
                  <button type="button" className="btn btn-sm btn-outline-primary flex-grow-1" disabled={busy} onClick={() => onReprint(slip)}>
                    Reprint
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onDelete(slip.groupId)}>
                    Delete
                  </button>
                </div>
              </section>
            </div>
          ))}
        </div>
      ) : (
        !busy && (
          <div className="card shadow-sm cis-fee-empty-state">
            <div className="card-body">
              <i className="fa fa-check-circle" aria-hidden="true" />
              <p className="mb-0">No approved slips found.</p>
            </div>
          </div>
        )
      )}

      {pagination.totalPages > 1 && (
        <nav className="cis-fee-pager d-flex justify-content-between align-items-center mt-3" aria-label="Approved slips pagination">
          <span className="text-muted small">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="btn-group">
            <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy || page <= 1} onClick={() => loadSlips(page - 1, search)}>Previous</button>
            <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy || page >= pagination.totalPages} onClick={() => loadSlips(page + 1, search)}>Next</button>
          </div>
        </nav>
      )}
    </FeePageShell>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import { printReportHtml } from '../../utils/printReport';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';
import { formatIndianMoneyDisplay } from './feeUiHelpers';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';

const META = FEE_SCREEN_META['slips-approved'];

export default function FeeApprovedSlips() {
  const { settings, menu } = useOutletContext();
  const [dataLoading, setDataLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useTransientNotice(4000);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ slips: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [pendingDelete, setPendingDelete] = useState(null);

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
  }, []);

  const onSearch = async (e) => {
    e.preventDefault();
    setPage(1);
    await loadSlips(1, search);
  };

  const requestDelete = (groupId) => setPendingDelete(groupId);

  const confirmDelete = async () => {
    const groupId = pendingDelete;
    if (!groupId) return;
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
      setPendingDelete(null);
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

  const columns = useMemo(() => [
    {
      key: 'registerNo',
      header: 'Register No',
      primary: true,
      sortable: true,
      searchField: true,
      width: '10rem',
      render: (row) => (
        <Link to={`/fees/history?registerNo=${encodeURIComponent(row.registerNo)}`} onClick={(e) => e.stopPropagation()}>
          {row.registerNo}
        </Link>
      ),
    },
    {
      key: 'studentLabel',
      header: 'Student',
      sortable: true,
      searchField: true,
      render: (row) => row.studentLabel || '—',
    },
    {
      key: 'groupId',
      header: 'Slip ID',
      hideOnMobile: true,
      render: (row) => <span className="font-monospace small">{row.groupId}</span>,
    },
    {
      key: 'paidDate',
      header: 'Paid Date',
      sortable: true,
      render: (row) => row.paidDate || '—',
    },
    {
      key: 'payBank',
      header: 'Bank',
      sortable: true,
      hideOnMobile: true,
      render: (row) => <span className="text-uppercase">{row.payBank || '—'}</span>,
    },
    {
      key: 'receiptNos',
      header: 'Receipts',
      hideOnMobile: true,
      render: (row) => row.receiptNos?.join(', ') || '—',
    },
    {
      key: 'approved',
      header: 'Approved',
      hideOnMobile: true,
      render: (row) => (
        <>
          {row.approvedBy || '—'}
          {row.approvedAt ? <div className="text-muted small">{row.approvedAt}</div> : null}
        </>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      numeric: true,
      sortable: true,
      sortValue: (row) => Number(row.amount) || 0,
      render: (row) => formatIndianMoneyDisplay(row.amount),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: () => <span className="badge bg-success-soft">Posted</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (row) => (
        <div className="d-flex gap-2 justify-content-center">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); onReprint(row); }}
          >
            Reprint
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); requestDelete(row.groupId); }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ], [busy]);

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={dataLoading}
      error={null}
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

      <DataTable
        columns={columns}
        rows={slips}
        getRowKey={(row) => row.groupId}
        loading={busy && !slips.length}
        error={null}
        empty={{
          icon: 'fa fa-check-circle',
          title: 'No approved slips',
          message: 'No approved slips found.',
        }}
        caption="Approved fee slips"
        searchable={slips.length > 8}
        searchPlaceholder="Filter approved slips by register no or name…"
        initialSort={{ key: 'paidDate', dir: 'desc' }}
      />

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

      <ConfirmModal
        show={Boolean(pendingDelete)}
        title="Delete approved slip?"
        message={pendingDelete ? `Delete approved slip ${pendingDelete}? This soft-deletes fee_slip_tb and student_fee rows.` : ''}
        confirmLabel="Delete slip"
        cancelLabel="Cancel"
        tone="danger"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </FeePageShell>
  );
}

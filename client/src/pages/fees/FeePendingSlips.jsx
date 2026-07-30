import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';
import DataTable from '../../components/DataTable';

import { formatIndianMoneyDisplay } from './feeUiHelpers';

const META = FEE_SCREEN_META['slips-pending'];

export default function FeePendingSlips() {
  const { settings, menu } = useOutletContext();
  const navigate = useNavigate();
  const [dataLoading, setDataLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [registerNo, setRegisterNo] = useState('');
  const [error, setError] = useState(null);
  const [slips, setSlips] = useState([]);
  const [total, setTotal] = useState(0);

  const loadSlips = async (roll = '') => {
    setSearching(true);
    setError(null);
    try {
      const res = await api.get('/api/fees/slips/pending', {
        params: roll ? { registerNo: roll } : {},
      });
      setSlips(res.data.slips || []);
      setTotal(Number(res.data.total) || (res.data.slips || []).length);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load pending slips');
      setSlips([]);
      setTotal(0);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await loadSlips();
      } finally {
        setDataLoading(false);
      }
    };
    init();
  }, []);

  const search = async (e) => {
    e.preventDefault();
    await loadSlips(registerNo.trim());
  };

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
      key: 'studentName',
      header: 'Student',
      sortable: true,
      searchField: true,
      render: (row) => (
        <>
          {row.studentName || row.studentLabel || '—'}
          {row.degreeName ? <div className="text-muted small">{row.degreeName}</div> : null}
        </>
      ),
    },
    {
      key: 'paidDate',
      header: 'Paid Date',
      sortable: true,
      sortValue: (row) => String(row.paidDate || row.createdAt || ''),
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
      key: 'receipts',
      header: 'Receipts',
      hideOnMobile: true,
      render: (row) => row.receipts || '—',
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
      render: () => <span className="badge bg-warning-soft">Pending</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      hideOnMobile: false,
      render: (row) => (
        <Link
          to={`/fees/slips/${encodeURIComponent(row.groupId)}/approve`}
          className="btn btn-sm btn-primary"
          onClick={(e) => e.stopPropagation()}
        >
          Approve
        </Link>
      ),
    },
  ], []);

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={dataLoading}
      error={null}
      breadcrumbs={feeScreenBreadcrumbs('slips-pending')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
    >
      <p className="text-muted small mb-0">
        Fee slips awaiting approval before posting to student accounts.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card mb-3 shadow-sm cis-fee-filter-card cis-fee-collection-search" onSubmit={search}>
        <div className="card-header py-2">Find pending slips</div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-auto">
              <label className="form-label" htmlFor="pending-slip-search">Register no</label>
              <input
                id="pending-slip-search"
                className="form-control cis-fee-roll-input"
                value={registerNo}
                onChange={(e) => setRegisterNo(e.target.value)}
                placeholder="Roll no"
              />
            </div>
            <div className="col-auto">
              <button type="submit" className="btn btn-primary cis-fee-go-btn" disabled={searching}>
                {searching ? '…' : 'Go'}
              </button>
            </div>
            {total > 0 && (
              <div className="col-md text-md-end text-muted small align-self-center">
                {total} pending slip{total === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={slips}
        getRowKey={(row) => row.groupId}
        loading={searching && !slips.length}
        error={null}
        empty={{
          icon: 'fa fa-inbox',
          title: 'No pending slips',
          message: registerNo.trim()
            ? `No pending slips for register ${registerNo.trim()}.`
            : 'No pending slips found.',
          action: (
            <Link to="/fees/collection" className="btn btn-sm btn-outline-primary">
              Go to Fee Collection
            </Link>
          ),
        }}
        caption="Pending fee slips"
        searchable={slips.length > 8}
        searchPlaceholder="Filter pending slips by register no, name, or bank…"
        pageSize={20}
        initialSort={{ key: 'paidDate', dir: 'desc' }}
      />
    </FeePageShell>
  );
}

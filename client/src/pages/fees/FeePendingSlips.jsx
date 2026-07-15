import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

import { formatIndianMoneyDisplay } from './feeUiHelpers';

const META = FEE_SCREEN_META['slips-pending'];

export default function FeePendingSlips() {
  const { settings, menu } = useOutletContext();
  const [dataLoading, setDataLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [registerNo, setRegisterNo] = useState('');
  const [error, setError] = useState(null);
  const [slips, setSlips] = useState([]);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('newest');

  const sortedSlips = useMemo(() => {
    const list = [...slips];
    const dateKey = (slip) => String(slip.paidDate || slip.createdAt || '');
    if (sortBy === 'oldest') {
      list.sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
    } else if (sortBy === 'amount-desc') {
      list.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
    } else if (sortBy === 'amount-asc') {
      list.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
    } else {
      list.sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
    }
    return list;
  }, [slips, sortBy]);

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

      {slips.length > 0 && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <span className="text-muted small">Sort slips</span>
          <select
            className="form-select form-select-sm cis-fee-slip-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-desc">Amount: high to low</option>
            <option value="amount-asc">Amount: low to high</option>
          </select>
        </div>
      )}

      {sortedSlips.length > 0 ? (
        <div className="row g-3 cis-fee-pending-slip-grid">
          {sortedSlips.map((slip) => (
            <div key={slip.groupId} className="col-md-6 col-xl-4">
              <section className="card shadow-sm h-100 cis-fee-slip-card">
                <div className="cis-fee-slip-card-header">
                  <div>
                    <span className="badge cis-fee-slip-chip">Pending</span>
                    <Link to={`/fees/history?registerNo=${encodeURIComponent(slip.registerNo)}`}>
                      {slip.registerNo}
                    </Link>
                    <div className="cis-fee-slip-card-subtitle">
                      {slip.studentName || slip.studentLabel || '—'}
                      {slip.degreeName ? ` · ${slip.degreeName}` : ''}
                    </div>
                  </div>
                  <div className="cis-fee-slip-card-amount">{formatIndianMoneyDisplay(slip.amount)}</div>
                </div>
                <ul className="list-group list-group-flush cis-fee-pending-slip-meta">
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Paid date</span>
                    <span>{slip.paidDate || '—'}</span>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Bank</span>
                    <span className="text-uppercase">{slip.payBank || '—'}</span>
                  </li>
                  {slip.receipts ? (
                    <li className="list-group-item">
                      <div className="small text-muted mb-1">Receipts</div>
                      <div className="small">{slip.receipts}</div>
                    </li>
                  ) : null}
                </ul>
                <div className="cis-fee-slip-card-footer">
                  <Link
                    to={`/fees/slips/${encodeURIComponent(slip.groupId)}/approve`}
                    className="btn btn-primary w-100"
                  >
                    Approve slip
                  </Link>
                </div>
              </section>
            </div>
          ))}
        </div>
      ) : (
        <div className="card shadow-sm cis-fee-empty-state">
          <div className="card-body">
            <i className="fa fa-inbox" aria-hidden="true" />
            <p className="mb-2">
              {registerNo.trim()
                ? `No pending slips for register ${registerNo.trim()}.`
                : 'No pending slips found.'}
            </p>
            <Link to="/fees/collection" className="btn btn-sm btn-outline-primary">
              Go to Fee Collection
            </Link>
          </div>
        </div>
      )}
    </FeePageShell>
  );
}

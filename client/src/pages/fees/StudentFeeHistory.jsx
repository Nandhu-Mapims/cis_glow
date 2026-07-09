import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useShellData } from '../../hooks/useShellData';
import { printReportHtml } from '../../utils/printReport';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';
import { formatIndianMoney, formatIndianMoneyDisplay } from './feeUiHelpers';

const META = FEE_SCREEN_META.history;

export default function StudentFeeHistory() {
  const [searchParams] = useSearchParams();
  const { settings, menu, loading: shellLoading, error: shellError, reload } = useShellData();
  const [searching, setSearching] = useState(false);
  const [registerNo, setRegisterNo] = useState(() => searchParams.get('registerNo') || '');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [printing, setPrinting] = useState(null);

  const reprintReceipt = async (receiptNo) => {
    setPrinting(receiptNo);
    setError(null);
    try {
      const res = await api.post('/api/fees/receipts/reprint', { receiptNo });
      printReportHtml(res.data.html || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to print receipt');
    } finally {
      setPrinting(null);
    }
  };

  useEffect(() => {
    const roll = searchParams.get('registerNo');
    if (!shellLoading && roll && !data && !searching) {
      setRegisterNo(roll);
      setSearching(true);
      api.get(`/api/fees/students/${encodeURIComponent(roll)}/history`)
        .then((res) => setData(res.data))
        .catch((err) => setError(err.response?.data?.message || 'Unable to load fee history'))
        .finally(() => setSearching(false));
    }
  }, [shellLoading, searchParams, data, searching]);

  const search = async (e) => {
    e.preventDefault();
    const roll = registerNo.trim();
    if (!roll) {
      setError('Register number is required');
      return;
    }
    setSearching(true);
    setError(null);
    setData(null);
    try {
      const res = await api.get(`/api/fees/students/${encodeURIComponent(roll)}/history`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load fee history');
    } finally {
      setSearching(false);
    }
  };

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={shellLoading}
      error={shellError}
      onRetry={reload}
      breadcrumbs={feeScreenBreadcrumbs('history')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
    >
      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card mb-3 shadow-sm cis-fee-filter-card cis-fee-collection-search" onSubmit={search}>
        <div className="card-header py-2">Student lookup</div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-auto">
              <label className="form-label">Register No</label>
              <input
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
          </div>
        </div>
      </form>

      {data?.student && (
        <div className="card mb-3 shadow-sm cis-fee-history-hero">
          <div className="card-body">
            <h5 className="mb-1">{data.student.name}</h5>
            <p className="text-muted mb-0">
              {data.student.registerNo}
              {' · '}
              {data.student.courseLabel}
              {' · '}
              {data.student.academicYear}
            </p>
            <p className="small text-muted mb-0 mt-2">
              {data.receipts.length} receipt(s), {data.lineCount} line item(s)
            </p>
            <Link
              to={`/fees/collection?registerNo=${encodeURIComponent(data.student.registerNo)}`}
              className="btn btn-sm btn-outline-primary mt-2"
            >
              Collect fees
            </Link>
          </div>
        </div>
      )}

      {data?.receipts?.map((receipt) => (
        <div className="card mb-3 shadow-sm cis-fee-receipt-card" key={receipt.receiptNo}>
          <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span>
              <strong>{receipt.receiptNo}</strong>
              <span className="text-muted ms-2">{receipt.paidDate}</span>
            </span>
            <span className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={printing === receipt.receiptNo}
                onClick={() => reprintReceipt(receipt.receiptNo)}
              >
                {printing === receipt.receiptNo ? 'Printing…' : 'Reprint'}
              </button>
              <span className="badge text-bg-secondary">{receipt.amountType}</span>
              <span className="cis-fee-receipt-total">{formatIndianMoneyDisplay(receipt.total)}</span>
            </span>
          </div>
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead className="cis-fee-sheet-head">
                <tr>
                  <th>Fee</th>
                  <th className="text-end">Paid</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Fine</th>
                  <th className="text-end">Discount</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.feeName}</td>
                    <td>{formatIndianMoney(line.feeAmount)}</td>
                    <td>{formatIndianMoney(line.totalAmount)}</td>
                    <td>{formatIndianMoney(line.fineAmount)}</td>
                    <td>{formatIndianMoney(line.discountAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {!data && !searching && (
        <div className="card shadow-sm cis-fee-empty-state">
          <div className="card-body">
            <i className="fa fa-history" aria-hidden="true" />
            <p className="mb-0">Enter a register number to view fee payment history.</p>
          </div>
        </div>
      )}
    </FeePageShell>
  );
}

import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import ReportPrintBar from '../../components/ReportPrintBar';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

const META = FEE_SCREEN_META['report-collection'];

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export default function FeeCollectionReport() {
  const { settings, menu } = useOutletContext();
  const [accountHeads, setAccountHeads] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState('');
  const [studentId, setStudentId] = useState('');
  const [feeType, setFeeType] = useState('');
  const [amountType, setAmountType] = useState('');
  const [html, setHtml] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const filtersRes = await api.get('/api/fees/filters');
        setAccountHeads(filtersRes.data.accountHeads || []);
        setPaymentModes(filtersRes.data.paymentModes || []);
      } finally {
        setFiltersLoading(false);
      }
    };
    load();
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post('/api/fees/report/collection', {
        fromDate: toDisplayDate(fromDate),
        toDate: toDate ? toDisplayDate(toDate) : '',
        studentId: studentId.trim(),
        feeType,
        amountType,
      });
      setHtml(res.data.html || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Report failed');
      setHtml('');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={filtersLoading}
      error={null}
      breadcrumbs={feeScreenBreadcrumbs('report-collection')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
    >
      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card shadow-sm mb-3 cis-fee-filter-card" onSubmit={generate}>
        <div className="card-header py-2">Report filters</div>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-2">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Account Head</label>
            <select className="form-select" value={feeType} onChange={(e) => setFeeType(e.target.value)}>
              <option value="">Select Account</option>
              {accountHeads.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Student ID</label>
            <input className="form-control" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Mode</label>
            <select className="form-select" value={amountType} onChange={(e) => setAmountType(e.target.value)}>
              {paymentModes.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary w-100" disabled={generating}>
              {generating ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {generating && !html && (
        <div className="cis-fee-dashboard-skeleton card shadow-sm mb-3">
          <div className="card-body p-4">
            <div className="cis-fee-skeleton-bar" />
            <div className="cis-fee-skeleton-bar" style={{ width: '70%' }} />
            <div className="cis-fee-skeleton-bar" style={{ width: '85%' }} />
          </div>
        </div>
      )}

      {html && (
        <>
          <ReportPrintBar html={html} />
          <div className="card shadow-sm cis-fee-report-preview">
            <div className="card-header py-2">Collection report</div>
            <div className="card-body" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </>
      )}

      {!html && !generating && (
        <div className="card shadow-sm cis-fee-empty-state">
          <div className="card-body">
            <i className="fa fa-file-text-o" aria-hidden="true" />
            <p className="mb-0">Set filters and click Search to generate the collection report.</p>
          </div>
        </div>
      )}
    </FeePageShell>
  );
}

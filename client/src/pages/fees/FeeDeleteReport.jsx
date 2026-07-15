import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import ReportPrintBar from '../../components/ReportPrintBar';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

const META = FEE_SCREEN_META['delete-report'];

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export default function FeeDeleteReport() {
  const { settings, menu } = useOutletContext();
  const [generating, setGenerating] = useState(false);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState('');
  const [html, setHtml] = useState('');
  const [error, setError] = useState(null);

  const generate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post('/api/fees/delete/report', {
        fromDate: toDisplayDate(fromDate),
        toDate: toDate ? toDisplayDate(toDate) : '',
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
      loading={false}
      error={null}
      breadcrumbs={feeScreenBreadcrumbs('delete-report')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction('/fees/delete')}
    >
      <form className="card shadow-sm mb-3" onSubmit={generate}>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}
      {html && (
        <div className="cis-fee-report-preview card shadow-sm">
          <div className="card-body student-report-preview overflow-auto">
            <ReportPrintBar html={html} />
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      )}
    </FeePageShell>
  );
}

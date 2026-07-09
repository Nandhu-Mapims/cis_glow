import { useEffect, useState } from 'react';
import api from '../../api/client';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import { useShellData } from '../../hooks/useShellData';
import ReceiptDetailCard from './ReceiptDetailCard';
import { FeeDeleteStatusBadge } from './feeDeleteUi';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

const META = FEE_SCREEN_META['delete-request'];

export default function FeeDeleteRequest() {
  const { settings, menu, loading: shellLoading, error: shellError, reload } = useShellData();
  const [dataLoading, setDataLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [receiptNo, setReceiptNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [preview, setPreview] = useState(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useTransientNotice(4000);

  const loadMine = async () => {
    const res = await api.get('/api/fees/delete/requests/mine');
    setRequests(res.data.requests || []);
  };

  useEffect(() => {
    if (shellLoading) return;
    const init = async () => {
      try {
        await loadMine();
      } finally {
        setDataLoading(false);
      }
    };
    init();
  }, [shellLoading]);

  const searchReceipt = async () => {
    const roll = receiptNo.trim();
    if (!roll) return;
    setBusy(true);
    setError(null);
    setMessage('');
    setPreview(null);
    setCanSubmit(false);
    try {
      const res = await api.get(`/api/fees/delete/lookup/${encodeURIComponent(roll)}`);
      setPreview(res.data.receipt || null);
      setCanSubmit(Boolean(res.data.allowed));
    } catch (err) {
      setError(err.response?.data?.message || 'Receipt not found');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/fees/delete/requests', {
        receiptNo: receiptNo.trim(),
        remarks,
      });
      setMessage(res.data.message || 'Request submitted');
      setReceiptNo('');
      setRemarks('');
      setPreview(null);
      setCanSubmit(false);
      await loadMine();
    } catch (err) {
      setError(err.response?.data?.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={shellLoading || dataLoading}
      error={shellError}
      onRetry={reload}
      breadcrumbs={feeScreenBreadcrumbs('delete-request')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction('/fees/delete')}
    >
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card shadow-sm cis-fee-delete-card mb-3">
            <div className="card-header py-2">Receipt lookup</div>
            <div className="card-body">
              <div className="row g-2 align-items-end mb-3">
                <div className="col-md-6">
                  <label className="form-label">Receipt No</label>
                  <input className="form-control" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
                </div>
                <div className="col-md-3">
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={searchReceipt}>Search</button>
                </div>
              </div>
              {preview && (
                <div className="cis-fee-receipt-detail-wrap mb-3">
                  <ReceiptDetailCard receipt={preview} />
                </div>
              )}
              {canSubmit && (
                <form onSubmit={submit}>
                  <label className="form-label">Remarks</label>
                  <textarea className="form-control mb-3" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  <button type="submit" className="btn btn-outline-danger" disabled={busy}>Send Delete Request</button>
                </form>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card shadow-sm cis-fee-delete-card h-100">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span>My requests</span>
              <span className="badge bg-secondary">{requests.length}</span>
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0 cis-fee-delete-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Receipt</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={`${r.receiptNo}-${r.createdAt}`}>
                      <td className="small">{r.createdAt}</td>
                      <td>{r.receiptNo}</td>
                      <td><FeeDeleteStatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                  {!requests.length && (
                    <tr>
                      <td colSpan={3} className="text-muted small p-3">No requests yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </FeePageShell>
  );
}

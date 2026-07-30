import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import ConfirmModal from '../../components/ConfirmModal';
import { useToast } from '../../components/ToastProvider';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import ReceiptDetailCard from './ReceiptDetailCard';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

const META = FEE_SCREEN_META['delete-approve'];

export default function FeeDeleteApprove() {
  const { settings, menu } = useOutletContext();
  const toast = useToast();
  const [dataLoading, setDataLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useTransientNotice(4000);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadPending = async () => {
    const res = await api.get('/api/fees/delete/requests/pending');
    setPending(res.data.requests || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await loadPending();
      } finally {
        setDataLoading(false);
      }
    };
    init();
  }, []);

  const loadDetail = async (receiptNo) => {
    setSelected(receiptNo);
    setBusy(true);
    setError(null);
    try {
      const res = await api.get(`/api/fees/delete/approve/${encodeURIComponent(receiptNo)}`);
      setDetail(res.data);
    } catch (err) {
      setDetail(null);
      setError(err.response?.data?.message || 'Unable to load receipt');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/fees/delete/approve', { receiptNo: selected });
      setMessage(res.data.message || 'Deleted');
      toast.success(res.data.message || `Receipt ${selected} deleted`);
      setSelected('');
      setDetail(null);
      await loadPending();
    } catch (err) {
      const msg = err.response?.data?.message || 'Approve failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={dataLoading}
      error={null}
      breadcrumbs={feeScreenBreadcrumbs('delete-approve')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction('/fees/delete')}
    >
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="row g-3">
        <div className="col-md-4">
          <div className="card shadow-sm cis-fee-delete-card h-100">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span>Pending queue</span>
              <span className="badge cis-fee-status-badge cis-fee-status-badge--pending">{pending.length}</span>
            </div>
            <div className="list-group list-group-flush cis-fee-delete-queue">
              {pending.map((r) => (
                <button
                  key={r.receiptNo}
                  type="button"
                  className={`list-group-item list-group-item-action ${selected === r.receiptNo ? 'active' : ''}`}
                  onClick={() => loadDetail(r.receiptNo)}
                >
                  <div className="fw-semibold">{r.receiptNo}</div>
                  <div className="small opacity-75">{r.createdBy} · {r.createdAt}</div>
                </button>
              ))}
              {!pending.length && <div className="list-group-item text-muted">No pending requests</div>}
            </div>
          </div>
        </div>
        <div className="col-md-8">
          {detail ? (
            <div className="card shadow-sm cis-fee-delete-card">
              <div className="card-header py-2">Receipt review</div>
              <div className="card-body">
                <div className="cis-fee-receipt-detail-wrap mb-3">
                  <ReceiptDetailCard receipt={detail.receipt} remarks={detail.remarks} />
                </div>
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirmOpen(true)}>
                  Delete Receipt
                </button>
              </div>
            </div>
          ) : (
            <div className="card shadow-sm cis-fee-empty-state">
              <div className="card-body">
                <i className="fa fa-hand-pointer-o" aria-hidden="true" />
                <p className="mb-0">Select a pending request to review.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        show={confirmOpen}
        title="Delete receipt?"
        message={`Delete receipt ${selected} from student_fee? This cannot be undone.`}
        confirmLabel="Delete Receipt"
        tone="danger"
        busy={busy}
        onConfirm={approve}
        onClose={() => setConfirmOpen(false)}
      />
    </FeePageShell>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import FeePaymentModeFields, { DEFAULT_FEE_PAYMENT } from '../../components/FeePaymentModeFields';
import ReportPrintBar from '../../components/ReportPrintBar';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import { useShellData } from '../../hooks/useShellData';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';
import { formatIndianMoney, formatIndianMoneyDisplay } from './feeUiHelpers';

const META = FEE_SCREEN_META['slip-approve'];

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export default function FeeSlipApprove() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { settings, menu, loading: shellLoading, error: shellError, reload } = useShellData();
  const [sheetLoading, setSheetLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useTransientNotice(4000);
  const [studentName, setStudentName] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [meta, setMeta] = useState(null);
  const [entries, setEntries] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payment, setPayment] = useState(DEFAULT_FEE_PAYMENT);
  const [receiptHtml, setReceiptHtml] = useState('');

  useEffect(() => {
    if (shellLoading) return;
    const load = async () => {
      try {
        const sheetRes = await api.post('/api/fees/slips/approve/load', { groupId });
        setStudentName(sheetRes.data.studentName || '');
        setRegisterNo(sheetRes.data.registerNo || '');
        setMeta(sheetRes.data.meta || null);
        setEntries(sheetRes.data.entries || []);
        setFeeTypes(sheetRes.data.feeTypes || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load slip');
      } finally {
        setSheetLoading(false);
      }
    };
    load();
  }, [groupId, shellLoading]);

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + (Number(e.feeAmount) || 0), 0),
    [entries],
  );

  const approve = async (withPrint) => {
    if (!meta || !entries.length) {
      setError('Nothing to approve');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage('');
    try {
      const res = await api.post('/api/fees/slips/approve', {
        groupId,
        meta,
        entries,
        feeTypes,
        paidDate: toDisplayDate(paidDate),
        payment,
        submitAction: withPrint ? 'Submit_Print' : 'Submit',
      });
      setMessage(res.data.message || 'Approved');
      if (res.data.receiptHtml) {
        setReceiptHtml(res.data.receiptHtml);
      }
      if (res.data.success) {
        setTimeout(() => navigate('/fees/slips/pending'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Approval failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={shellLoading || sheetLoading}
      error={shellError}
      onRetry={reload}
      breadcrumbs={feeScreenBreadcrumbs('slip-approve')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction('/fees/slips/pending')}
    >
      <p className="text-muted small mb-3">Slip group: <span className="font-monospace">{groupId}</span></p>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {studentName && (
        <div className="card mb-3 cis-fee-collection-hero">
          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h3 className="cis-fee-student-name mb-1">{studentName}</h3>
              <p className="text-muted mb-0">{registerNo}</p>
            </div>
            <span className="badge cis-fee-slip-chip">Awaiting approval</span>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="card mb-3 shadow-sm">
          <div className="card-header py-2">Slip lines to post to student_fee</div>
          <div className="card-body border-bottom cis-fee-approve-controls">
            <div className="row g-3 align-items-end mb-3">
              <div className="col-md-3">
                <label className="form-label small mb-1">Paid date</label>
                <input type="date" className="form-control form-control-sm" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
              </div>
              <div className="col-md-9 d-flex flex-wrap gap-2 justify-content-md-end">
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => approve(false)}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="btn btn-outline-primary btn-sm" disabled={saving} onClick={() => approve(true)}>
                  Save &amp; Print
                </button>
              </div>
            </div>
            <FeePaymentModeFields payment={payment} onChange={setPayment} />
          </div>
          <div className="table-responsive">
            <table className="table table-sm mb-0 align-middle">
              <thead className="cis-fee-sheet-head">
                <tr>
                  <th>Fee</th>
                  <th className="text-end">Balance</th>
                  <th className="text-end">Paid</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.index} className="cis-fee-approve-row">
                    <td>{entry.label}</td>
                    <td className="text-end">{formatIndianMoney(entry.balanceAmount)}</td>
                    <td className="text-end fw-semibold">{formatIndianMoney(entry.feeAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer text-end cis-fee-sheet-foot">
            Total: <strong>{formatIndianMoneyDisplay(total)}</strong>
          </div>
        </div>
      )}

      {receiptHtml && (
        <>
          <ReportPrintBar html={receiptHtml} label="Print Receipt" />
          <div className="card shadow-sm">
            <div className="card-body overflow-auto" dangerouslySetInnerHTML={{ __html: receiptHtml }} />
          </div>
        </>
      )}
    </FeePageShell>
  );
}

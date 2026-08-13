import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import CheckListSelect from '../../components/CheckListSelect';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

const META = FEE_SCREEN_META['pending-sms'];

export default function FeePendingSms() {
  const { settings, menu } = useOutletContext();
  const [initLoading, setInitLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useTransientNotice(5000);
  const [classGroups, setClassGroups] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [rows, setRows] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const init = async () => {
      try {
        const classesRes = await api.get('/api/fees/pending-sms/classes');
        setClassGroups(classesRes.data.classGroups || []);
        setClassOptions(classesRes.data.classOptions || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to initialize pending SMS');
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/api/fees/pending-sms/generate', { selectedClasses });
      setRows(res.data.rows || []);
      setClassGroups(res.data.classGroups || classGroups);
      setClassOptions(res.data.classOptions || classOptions);
      setHasGenerated(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to generate pending SMS');
      setRows([]);
      setHasGenerated(false);
    } finally {
      setBusy(false);
    }
  };

  const sendSmsBatch = async () => {
    setShowConfirm(false);
    setSending(true);
    setError('');
    setNotice('');
    setSendProgress({ current: 0, total: rows.length });

    try {
      const res = await api.post('/api/fees/pending-sms/send', { rows });
      setSendProgress({ current: rows.length, total: rows.length });
      setNotice(res.data.message || `${res.data.sent || 0} SMS Sent...`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send pending SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={initLoading}
      error={null}
      breadcrumbs={feeScreenBreadcrumbs('pending-sms')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
      notice={notice ? <div className="alert alert-success">{notice}</div> : null}
    >
      {error && <div className="alert alert-danger">{error}</div>}

      <form className="card shadow-sm mb-3 cis-fee-filter-card" onSubmit={generate}>
        <div className="card-header py-2">Class selection</div>
        <div className="card-body">
          <span className="form-label" id="fee_sms_classes_label">Classes</span>
          <CheckListSelect
            aria-labelledby="fee_sms_classes_label"
            value={selectedClasses}
            groups={classGroups.length ? classGroups : null}
            options={classOptions}
            searchPlaceholder="Search classes..."
            onChange={(next) => {
              setSelectedClasses(next);
              setHasGenerated(false);
              setRows([]);
            }}
          />
          <div className="mt-3">
            <button type="submit" className="btn btn-primary" disabled={busy || sending || !selectedClasses.length}>
              {busy ? 'Generating…' : 'Go'}
            </button>
          </div>
        </div>
      </form>

      {busy && (
        <div className="card shadow-sm mb-3 cis-fee-results-card">
          <div className="card-body text-muted">
            Generating pending SMS list… this may take a few seconds for large classes.
          </div>
        </div>
      )}

      {!!rows.length && (
        <div className="card shadow-sm cis-fee-results-card">
          <div className="card-header py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span>Pending SMS list</span>
            <span className="badge cis-fee-status-badge cis-fee-status-badge--pending">{rows.length} rows</span>
          </div>
          <div className="card-body">
            <div className="row g-2 align-items-center mb-3">
              <div className="col-sm-auto">
                <strong>Total No. of Students:</strong>
                {' '}
                {rows.length}
              </div>
              <div className="col-sm-auto">
                {!sending ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setShowConfirm(true)}
                    disabled={busy}
                  >
                    Send SMS
                  </button>
                ) : (
                  <div className="cis-fee-sms-progress">
                    <div className="progress progress-sm mb-1">
                      <div
                        className="progress-bar bg-success"
                        style={{ width: `${sendProgress.total ? (sendProgress.current / sendProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="small text-muted mb-0">
                      {sendProgress.current} of {sendProgress.total} SMS sent…
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0">
                <thead className="cis-fee-sheet-head">
                  <tr>
                    <th>#</th>
                    <th>Reg No</th>
                    <th>Mobile</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={`${row.registerNo}_${row.mobile}`}>
                      <td>{idx + 1}</td>
                      <td>{row.registerNo}</td>
                      <td>{row.mobile}</td>
                      <td className="cis-fee-sms-message">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {hasGenerated && !rows.length && !busy && (
        <div className="alert alert-warning mb-3">
          No pending fee SMS found for the selected class(es). Try another year or batch — some classes may have no enrolled students or no outstanding fees.
        </div>
      )}

      {!hasGenerated && !busy && (
        <div className="card shadow-sm cis-fee-empty-state">
          <div className="card-body">
            <i className="fa fa-commenting" aria-hidden="true" />
            <p className="mb-0">Select classes and click Go to generate the pending SMS list.</p>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm</h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirm(false)} aria-label="Close" />
              </div>
              <div className="modal-body">Are you sure to send SMS to {rows.length} parent(s)?</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Close</button>
                <button type="button" className="btn btn-danger" onClick={sendSmsBatch}>Send SMS</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </FeePageShell>
  );
}

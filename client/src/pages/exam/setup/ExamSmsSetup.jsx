import { useEffect, useState } from 'react';
import { CourseSemesterSelector, ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function ExamSmsSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('exam-sms');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [sendNotice, setSendNotice] = useState(null);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId != null) setExamId(data.examId);
    if (data?.courseKey != null) setCourseKey(data.courseKey);
  }, [data]);

  const reload = (patch = {}) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    ...patch,
  });

  const recipients = data?.recipients || [];

  const sendSmsBatch = async () => {
    setShowConfirm(false);
    setSending(true);
    setSendNotice(null);
    setProgress({ current: 0, total: recipients.length });

    const initRes = await save({
      action: 'init',
      exam_name: examId,
      course_name: courseKey,
    });
    if (initRes?.success === false) {
      setSendNotice(initRes.message || 'Failed to initialize SMS batch');
      setSending(false);
      return;
    }

    let sent = 0;
    for (let i = 0; i < recipients.length; i += 1) {
      const rec = recipients[i];
      const res = await save({
        action: 'sendOne',
        mobile: rec.mobile,
        message: encodeURIComponent(rec.message),
        registerNo: rec.registerNo,
      });
      if (res?.success !== false) sent += 1;
      setProgress({ current: i + 1, total: recipients.length });
    }

    setSendNotice(`${sent} SMS Sent...`);
    setSending(false);
  };

  return (
    <ExamSetupShell notice={notice || sendNotice} error={error} busy={busy || sending}>
      <ExamSelector
        value={examId}
        options={data?.examOptions}
        onChange={async (value) => {
          setExamId(value);
          setCourseKey('');
          await reload({ exam_name: value, course_name: '' });
        }}
        disabled={busy || sending}
      />
      <CourseSemesterSelector
        courseGroups={data?.courseGroups}
        value={courseKey}
        onChange={async (value) => {
          setCourseKey(value);
          await reload({ course_name: value });
        }}
        disabled={busy || sending}
      />

      {data?.ctx && courseKey ? (
        <>
          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Total No. of Student</label>
            <div className="col-sm-10">
              <h4 className="mb-0">{recipients.length}</h4>
            </div>
          </div>

          {recipients.length === 0 ? (
            <p className="text-muted">No data found</p>
          ) : (
            <>
              {!sending ? (
                <div className="mb-3">
                  <button
                    type="button"
                    className="btn btn-lg btn-danger"
                    onClick={() => setShowConfirm(true)}
                    disabled={busy}
                  >
                    Send SMS
                  </button>
                </div>
              ) : (
                <div className="mb-3 col-sm-6">
                  <div className="progress progress-sm mb-2">
                    <div
                      className="progress-bar progress-bar-success"
                      style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="small text-muted mb-0">
                    {progress.current} of {progress.total} SMS Sent...
                  </p>
                </div>
              )}

              <div className="table-responsive">
                <table className="table table-bordered table-sm">
                  <thead className="table-secondary">
                    <tr><th>Reg.No</th><th>Message</th></tr>
                  </thead>
                  <tbody>
                    {recipients.map((rec) => (
                      <tr key={`${rec.registerNo}-${rec.mobile}`}>
                        <td>{rec.registerNo}</td>
                        <td style={{ whiteSpace: 'pre-wrap' }}>{rec.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : null}

      {showConfirm ? (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm</h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirm(false)} aria-label="Close" />
              </div>
              <div className="modal-body">Are you sure to send SMS...</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Close</button>
                <button type="button" className="btn btn-lg btn-danger" onClick={sendSmsBatch}>Send SMS</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ExamSetupShell>
  );
}

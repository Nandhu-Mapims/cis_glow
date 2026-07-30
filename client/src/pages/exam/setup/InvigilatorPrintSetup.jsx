import { useEffect, useState } from 'react';
import { buildExamSchedulePrintHtml } from '../../../utils/examSchedulePrint';
import { printReportHtml } from '../../../utils/printReport';
import { ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function InvigilatorPrintSetup() {
  const { data, busy, error, notice, load } = useExamSetupApi('invigilator-print');
  const [examId, setExamId] = useState('');
  const [passType, setPassType] = useState('Theory');
  const [sessionType, setSessionType] = useState('Forenoon');

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.passType) setPassType(data.passType);
    if (data?.sessionType) setSessionType(data.sessionType);
  }, [data]);

  const reload = (patch) => load({
    exam_name: patch.examId ?? examId,
    a_pass_type: patch.passType ?? passType,
    a_session_type: patch.sessionType ?? sessionType,
    ...patch,
  });

  const handlePrint = () => {
    if (!data?.reportHtml) return;
    const body = buildExamSchedulePrintHtml({
      printMeta: data.printMeta,
      bannerUrl: data.bannerUrl,
      tablesHtml: data.reportHtml,
    });
    printReportHtml(body, 'exam-schedule-print');
  };

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <ExamSelector
        value={examId}
        options={data?.examOptions}
        onChange={async (v) => {
          setExamId(v);
          await reload({ exam_name: v });
        }}
        disabled={busy}
      />

      {data?.ctx ? (
        <>
          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Subject Category</label>
            <div className="col-sm-8 d-flex flex-wrap gap-3">
              <label className="form-check-label">
                <input
                  type="radio"
                  className="form-check-input me-1"
                  name="a_pass_type"
                  value="Theory"
                  checked={passType === 'Theory'}
                  onChange={async () => {
                    setPassType('Theory');
                    await reload({ a_pass_type: 'Theory' });
                  }}
                  disabled={busy}
                />
                Theory
              </label>
              <label className="form-check-label">
                <input
                  type="radio"
                  className="form-check-input me-1"
                  name="a_pass_type"
                  value="Clinical"
                  checked={passType === 'Clinical'}
                  onChange={async () => {
                    setPassType('Clinical');
                    await reload({ a_pass_type: 'Clinical' });
                  }}
                  disabled={busy}
                />
                Clinical
              </label>
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Exam Session</label>
            <div className="col-sm-8 d-flex flex-wrap gap-3">
              <label className="form-check-label">
                <input
                  type="radio"
                  className="form-check-input me-1"
                  name="a_session_type"
                  value="Forenoon"
                  checked={sessionType === 'Forenoon'}
                  onChange={async () => {
                    setSessionType('Forenoon');
                    await reload({ a_session_type: 'Forenoon' });
                  }}
                  disabled={busy}
                />
                Morning
              </label>
              <label className="form-check-label">
                <input
                  type="radio"
                  className="form-check-input me-1"
                  name="a_session_type"
                  value="Afternoon"
                  checked={sessionType === 'Afternoon'}
                  onChange={async () => {
                    setSessionType('Afternoon');
                    await reload({ a_session_type: 'Afternoon' });
                  }}
                  disabled={busy}
                />
                Afternoon
              </label>
            </div>
          </div>

          {data?.reportHtml ? (
            <div className="mb-3 row g-2">
              <div className="col-sm-3">
                <button type="button" className="btn btn-info" onClick={handlePrint} disabled={busy}>
                  Print
                </button>
              </div>
              <div className="col-sm-2" />
            </div>
          ) : null}
        </>
      ) : null}

      {data?.reportHtml ? (
        <div className="exam-schedule-print-preview">
          <div id="att_report_span" className="att_report_span" dangerouslySetInnerHTML={{ __html: data.reportHtml }} />
        </div>
      ) : null}
    </ExamSetupShell>
  );
}

import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

export default function BatchTimetableReportSetup() {
  const { data, busy, error, notice, load } = useAcademicSetupApi('batch-timetable-report');
  const [examId, setExamId] = useState('');
  const [passType, setPassType] = useState('Theory');
  const [html, setHtml] = useState('');

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.passType) setPassType(data.passType);
    if (data?.html) setHtml(data.html);
  }, [data]);

  const generate = async () => {
    const res = await load({ exam_name: examId, a_pass_type: passType, generate: true });
    if (res?.html) setHtml(res.html);
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-sm-5">
          <label className="form-label">Exam</label>
          <select className="form-select" value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">--Select Exam--</option>
            {(data?.examOptions || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.group} — {opt.label}</option>)}
          </select>
        </div>
        <div className="col-sm-4">
          <label className="form-label">Subject category</label>
          <div>
            <label className="me-3"><input className="me-2" type="radio" checked={passType === 'Theory'} onChange={() => setPassType('Theory')} /> Theory</label>
            <label><input className="me-2" type="radio" checked={passType === 'Clinical'} onChange={() => setPassType('Clinical')} /> Clinical</label>
          </div>
        </div>
        <div className="col-sm-2">
          <button type="button" className="btn btn-danger" disabled={busy || !examId} onClick={generate}>Print</button>
        </div>
      </div>
      <ReportPrintBar html={html} />
      {html ? <div className="academic-report-html" dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </>
  );
}

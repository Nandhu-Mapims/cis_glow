import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

export default function TimetableReportSetup() {
  const { data, busy, error, notice, load } = useAcademicSetupApi('timetable-report');
  const [attendanceDate, setAttendanceDate] = useState('');
  const [passType, setPassType] = useState('Theory');
  const [html, setHtml] = useState('');

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.attendanceDate) setAttendanceDate(data.attendanceDate);
    if (data?.passType) setPassType(data.passType);
    if (data?.html) setHtml(data.html);
  }, [data]);

  const generate = async () => {
    const res = await load({ attendance_date: attendanceDate, a_pass_type: passType, generate: true });
    if (res?.html) setHtml(res.html);
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-sm-3">
          <label className="form-label">Date</label>
          <input type="date" className="form-control" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
        </div>
        <div className="col-sm-4">
          <label className="form-label">Type</label>
          <div>
            <label className="me-3"><input className="me-2" type="radio" checked={passType === 'Theory'} onChange={() => setPassType('Theory')} /> Theory</label>
            <label><input className="me-2" type="radio" checked={passType === 'Clinical'} onChange={() => setPassType('Clinical')} /> Clinical/Practical</label>
          </div>
        </div>
        <div className="col-sm-2">
          <button type="button" className="btn btn-danger" disabled={busy || !attendanceDate} onClick={generate}>Go</button>
        </div>
      </div>
      <ReportPrintBar html={html} printMode="academic-timetable-class-report" />
      {html ? <div className="academic-report-html timetable-class-report-html" dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </>
  );
}

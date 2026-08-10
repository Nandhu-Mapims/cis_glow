import { useCallback, useEffect, useState } from 'react';
import api from '../../../api/client';
import ReportPrintBar from '../../../components/ReportPrintBar';

/** Mirrors dashboard_library.php's clickable numbers → dashboard_lib_report.php
 * popup. Instead of a separate popup window, the detail list is rendered
 * inline in a card (with a Print button that reuses the shared print-window
 * pattern) — see CISFLOW/library-module.md §2 for the flag/params contract. */
function useDrillDown() {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const open = useCallback(async (params) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/library/setup/dashboard-report/load', { fields: params });
      if (res.data.error) {
        setError(res.data.error);
        setReport(null);
      } else {
        setReport(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load report');
      setReport(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const close = useCallback(() => setReport(null), []);

  return { report, busy, error, open, close };
}

export default function DashboardSetup({ data, busy, onLoad }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  const drill = useDrillDown();

  const totalSummary = data?.totalSummary || [];
  const issueReturn = data?.issueReturn || [];
  const attendance = data?.attendance || { rows: [], total: { in: 0, out: 0 } };
  const branches = data?.branches || [];

  const callStaffAttendance = (cat, ctype) => drill.open({ flag: 1, cat, cdate: data?.date, ctype });
  const callStudentAttendance = (course, cyear, ctype) => drill.open({ flag: 2, course, cyear, cdate: data?.date, ctype });
  const callTrans = (cat, ctype) => drill.open({ flag: 5, cat, cdate: data?.date, ctype });
  const callBooks = (ctype) => drill.open({ flag: 6, ctype, cdate: data?.date });
  const callTotalAttendance = (ctype) => drill.open({ flag: 7, cdate: data?.date, ctype });

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-control"
            value={data?.date || ''}
            onChange={(e) => onLoad({ date: e.target.value })}
          />
        </div>
      </div>

      {busy && <div className="text-muted small mb-2">Loading…</div>}

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">Total Summary</div>
            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0">
                <thead><tr><th>Resources</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {totalSummary.map((row) => (
                    <tr key={row.id}><td>{row.name}</td><td className="text-end">{row.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">Issue/Return</div>
            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0">
                <thead><tr><th>Days</th><th className="text-end">I</th><th className="text-end">R</th><th className="text-end">D</th></tr></thead>
                <tbody>
                  {issueReturn.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="text-end"><button type="button" className="btn btn-link btn-sm p-0" onClick={() => callTrans(row.label, 'I')}>{row.i}</button></td>
                      <td className="text-end"><button type="button" className="btn btn-link btn-sm p-0" onClick={() => callTrans(row.label, 'R')}>{row.r}</button></td>
                      <td className="text-end"><button type="button" className="btn btn-link btn-sm p-0" onClick={() => callTrans(row.label, 'D')}>{row.d}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">Attendance</div>
            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0">
                <thead><tr><th>Class</th><th className="text-end">In</th><th className="text-end">Out</th></tr></thead>
                <tbody>
                  {attendance.rows.map((row, idx) => (
                    <tr key={`${row.type}-${row.label}-${idx}`}>
                      <td>{row.label}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0"
                          onClick={() => (row.type === 'student' ? callStudentAttendance(row.course, row.cyear, 'In') : callStaffAttendance(row.cat, 'In'))}
                        >{row.in}</button>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0"
                          onClick={() => (row.type === 'student' ? callStudentAttendance(row.course, row.cyear, 'Out') : callStaffAttendance(row.cat, 'Out'))}
                        >{row.out}</button>
                      </td>
                    </tr>
                  ))}
                  <tr className="table-light fw-bold">
                    <td>Total</td>
                    <td className="text-end"><button type="button" className="btn btn-link btn-sm p-0" onClick={() => callTotalAttendance('In')}>{attendance.total.in}</button></td>
                    <td className="text-end"><button type="button" className="btn btn-link btn-sm p-0" onClick={() => callTotalAttendance('Out')}>{attendance.total.out}</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {branches.length ? (
        <div className="mb-3">
          <h6>Resources by Branch</h6>
          <div className="row g-2">
            {branches.map((b) => (
              <div key={b.id} className="col-md-2 col-sm-3 col-6">
                <button
                  type="button"
                  className="border rounded p-2 text-center w-100 bg-white"
                  onClick={() => callBooks(b.id)}
                >
                  <strong className="d-block fs-5">{b.count}</strong>
                  <span className="small text-muted">{b.name}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {drill.error && <div className="alert alert-danger">{drill.error}</div>}
      {drill.busy && <div className="text-muted small mb-2">Loading report…</div>}
      {drill.report ? (
        <div className="card mt-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>{drill.report.title}</span>
            <div className="d-flex gap-2">
              <ReportPrintBar html={drill.report.printHtml} />
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={drill.close}>Close</button>
            </div>
          </div>
          <div className="card-body">
            {(drill.report.filters || []).filter((f) => f.value).map((f) => (
              <div key={f.label} className="small text-muted">{f.label}: <strong>{f.value}</strong></div>
            ))}
            <div className="table-responsive mt-2">
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>{(drill.report.columns || []).map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {(drill.report.rows || []).length ? drill.report.rows.map((row, idx) => (
                    <tr key={idx}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                  )) : (
                    <tr><td colSpan={(drill.report.columns || []).length || 1} className="text-muted text-center">No records</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

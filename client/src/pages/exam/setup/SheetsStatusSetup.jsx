import { Fragment, useEffect, useState } from 'react';
import { ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

function toDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

function toIsoDate(displayDate) {
  const parts = String(displayDate || '').split('-');
  if (parts.length !== 3) return displayDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export default function SheetsStatusSetup() {
  const { data, busy, error, notice, load } = useExamSetupApi('sheets-status');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [batchId, setBatchId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    load({
      batch_id: params.get('batchId') || params.get('b') || '',
    });
  }, [load]);

  useEffect(() => {
    if (data?.fromDate) setFromDate(toDisplayDate(data.fromDate));
    if (data?.toDate) setToDate(toDisplayDate(data.toDate));
    if (data?.batchId) setBatchId(data.batchId);
  }, [data]);

  const onSearch = async (e) => {
    e.preventDefault();
    await load({
      from_date: toIsoDate(fromDate),
      to_date: toIsoDate(toDate),
      batch_id: batchId,
      action: 'go',
    });
  };

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <form className="row g-2 mb-3" onSubmit={onSearch}>
        <div className="col-md-2">
          <label className="form-label small">From</label>
          <input className="form-control form-control-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="dd-mm-yyyy" />
        </div>
        <div className="col-md-2">
          <label className="form-label small">To</label>
          <input className="form-control form-control-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="dd-mm-yyyy" />
        </div>
        <div className="col-md-2">
          <label className="form-label small">Batch ID</label>
          <input className="form-control form-control-sm" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Go</button>
        </div>
      </form>

      {data?.totalCount != null ? (
        <p className="text-muted small">Total sheets: {data.totalCount}</p>
      ) : null}

      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-secondary">
            <tr>
              <th>Batch</th>
              <th>Course</th>
              <th>Exam</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Page</th>
              <th>Status</th>
              <th>File</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {(data?.groupedRows || []).map((group) => (
              <Fragment key={group.dateLabel}>
                <tr className="table-light">
                  <td colSpan={9}><strong>{group.dateLabel}</strong></td>
                </tr>
                {group.items.map((row) => (
                  <tr key={`${group.dateLabel}-${row.batchId}-${row.uploadSheet}-${row.createdTime}`}>
                    <td>{row.batchId}</td>
                    <td>{row.degreeLabel}</td>
                    <td>{row.examName}</td>
                    <td>{row.subjectName}</td>
                    <td>{row.markType}</td>
                    <td>{row.pageNo}</td>
                    <td dangerouslySetInnerHTML={{ __html: row.statusHtml }} />
                    <td>
                      {row.fileUrl ? <a href={row.fileUrl} target="_blank" rel="noreferrer">{row.uploadSheet}</a> : row.uploadSheet}
                    </td>
                    <td nowrap="nowrap">{row.createdTime}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </ExamSetupShell>
  );
}

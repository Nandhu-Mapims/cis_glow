import { useEffect, useMemo, useState } from 'react';
import { legacyPublicFileUrl } from '../../../utils/legacyFileUrls';
import { printCircularPreview } from '../../../utils/printReport';

function circularFileUrl(filename) {
  return legacyPublicFileUrl('circular', filename);
}

function CircularDescription({ html }) {
  if (!html) return <span className="text-muted">—</span>;
  return (
    <div
      className="circular-description-html legacy-form-html"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function CircularPrintSetup({ data, busy, onLoad }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    onLoad().then((d) => {
      if (d) {
        setFromDate(d.fromDate || '');
        setToDate(d.toDate || '');
      }
    });
  }, [onLoad]);

  const run = () => onLoad({ fromDate, toDate });

  const rows = data?.rows || [];
  const selectedRow = useMemo(
    () => rows.find((r) => r.id === expandedId) || null,
    [rows, expandedId],
  );

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label className="form-label">From</label>
          <input type="date" className="form-control" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label className="form-label">To</label>
          <input type="date" className="form-control" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>Load</button>
        </div>
      </div>

      {!rows.length ? (
        <p className="text-muted mb-0">No approved circulars in this date range.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered table-sm align-top">
            <thead className="table-secondary">
              <tr>
                <th style={{ width: '4rem' }}>ID</th>
                <th style={{ minWidth: '10rem' }}>Title</th>
                <th style={{ minWidth: '8rem' }}>Subtitle</th>
                <th style={{ width: '7rem' }}>Date</th>
                <th>Description</th>
                <th style={{ width: '6rem' }}>Attach</th>
                <th style={{ minWidth: '6rem' }}>From</th>
                <th style={{ width: '5rem' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const attachUrl = circularFileUrl(row.attach);
                const expanded = expandedId === row.id;
                return (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.title || '—'}</td>
                    <td>{row.subTitle || '—'}</td>
                    <td>{row.date || '—'}</td>
                    <td className="circular-description-cell" style={{ maxWidth: '28rem' }}>
                      {row.description ? (
                        <div className="circular-description-preview text-muted small">
                          {row.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}
                          {row.description.length > 160 ? '…' : ''}
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      {attachUrl ? (
                        <a href={attachUrl} target="_blank" rel="noreferrer">View</a>
                      ) : '—'}
                    </td>
                    <td>{row.circularFrom || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                      >
                        {expanded ? 'Collapse' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow ? (
        <div className="card mt-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Preview — {selectedRow.title}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => printCircularPreview({
                title: selectedRow.title,
                subTitle: selectedRow.subTitle,
                description: selectedRow.description,
                date: selectedRow.date,
              })}
            >
              Print
            </button>
          </div>
          <div className="card-body circular-print-preview">
            <CircularDescription html={selectedRow.description} />
          </div>
        </div>
      ) : null}
    </>
  );
}

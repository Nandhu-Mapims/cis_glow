import { useEffect, useState } from 'react';
import { printReportHtml } from '../../../utils/printReport';

export default function BookReportSetup({ data, busy, onLoad, onSave }) {
  const [filters, setFilters] = useState({ search: '', searchBy: '', resourceType: '', department: '' });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.filters) setFilters((p) => ({ ...p, ...data.filters })); }, [data]);

  const runSearch = (e) => { e.preventDefault(); onSave(filters); };

  return (
    <>
      <form className="row g-2 mb-3" onSubmit={runSearch}>
        <div className="col-md-3"><input className="form-control" placeholder="Search" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></div>
        <div className="col-md-2">
          <select className="form-select" value={filters.searchBy} onChange={(e) => setFilters((p) => ({ ...p, searchBy: e.target.value }))}>
            {(data?.searchFields || []).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.resourceType} onChange={(e) => setFilters((p) => ({ ...p, resourceType: e.target.value }))}>
            <option value="">--All Resource--</option>
            {data?.resourceTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.department} onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))}>
            <option value="">--All Department--</option>
            {data?.departments?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="col-md-2 d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>Search</button>
          <button type="button" className="btn btn-outline-secondary" disabled={!data?.printHtml} onClick={() => printReportHtml(data.printHtml)}>Print</button>
        </div>
      </form>

      <div id="final_result_span">
        {!data?.hasFilter && <p className="text-muted">Please select search option</p>}
        {data?.hasFilter && !data?.rows?.length && <p className="text-muted">No records found</p>}
        {Boolean(data?.rows?.length) && (
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead className="table-secondary">
                <tr>
                  <th>S.No.</th><th>Resource</th><th>Status</th><th>Accession No</th><th>No. Available</th>
                  <th>Title</th><th>Sub Title</th><th>Call No</th><th>Subject</th><th>Branch</th>
                  <th>Author</th><th>Publication</th><th>Year / Volume / Edition</th><th>Shelf / Rack No</th><th>E-book</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{r.resourceTypeName}</td>
                    <td style={r.highlight ? { backgroundColor: '#F6C3C3' } : undefined}>{r.status}{r.isDamage ? '(Damaged)' : ''}</td>
                    <td>{r.accessionNo}</td>
                    <td>{r.remainBook} of {r.totalBookAvailable}</td>
                    <td>{r.resourceName}{r.convertName ? <><br />({r.convertName})</> : null}</td>
                    <td>{r.resourceSubname}</td>
                    <td>{r.callNumber}</td>
                    <td>{r.subjectName}</td>
                    <td>{r.departmentNames}</td>
                    <td>{r.authorName}</td>
                    <td>{r.publisherName}</td>
                    <td>{r.year || '-'} / {r.volume || '-'} / {r.edition || '-'}{r.revisedEdition ? ' (Revised)' : ''}</td>
                    <td>{r.shelfNo}/{r.rackNo}</td>
                    <td>{r.ebookAttachment ? <a href={`https://www.cis.apdch.edu.in/files/library_ebook/${r.ebookAttachment}`} target="_blank" rel="noreferrer">View</a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

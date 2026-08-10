import { useEffect, useState } from 'react';

export default function ResourcesReportSetup({ data, busy, onLoad, onSave }) {
  const [filters, setFilters] = useState({ search: '', searchBy: '', resourceType: '', department: '' });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.filters) setFilters((p) => ({ ...p, ...data.filters })); }, [data]);

  const runSearch = (page = 1) => onSave({ ...filters, page });

  return (
    <>
      <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); runSearch(1); }}>
        <div className="col-md-3"><input className="form-control" placeholder="Search" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></div>
        <div className="col-md-2">
          <select className="form-select" value={filters.searchBy} onChange={(e) => setFilters((p) => ({ ...p, searchBy: e.target.value }))}>
            {(data?.searchFields || []).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.resourceType} onChange={(e) => setFilters((p) => ({ ...p, resourceType: e.target.value }))}>
            <option value="">All Resource</option>
            {data?.resourceTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <select className="form-select" value={filters.department} onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))}>
            <option value="">All Department</option>
            {data?.departments?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="col-md-2"><button type="submit" className="btn btn-danger" disabled={busy}>Search</button></div>
      </form>

      {!data?.hasFilter && <p className="text-muted">Please select search option</p>}
      {data?.hasFilter && !data?.rows?.length && <p className="text-danger">No records found...</p>}
      {Boolean(data?.rows?.length) && (
        <>
          <div className="mb-2 text-muted small">
            Showing {(data.filters.page - 1) * data.pageSize + 1} to {Math.min(data.filters.page * data.pageSize, data.total)} of {data.total} entries
          </div>
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead className="table-secondary">
                <tr>
                  <th>S.No.</th><th>Resource</th><th>Status</th><th>Accession No</th><th>No. of Copies Available</th>
                  <th>Name of the Author</th><th>Name of the Title</th><th>Sub Title</th><th>Edition</th><th>Volume No.</th>
                  <th>Year of Publication</th><th>Total No. of Copies</th><th>Call No</th><th>Subject</th><th>Branch</th>
                  <th>Publication</th><th>Shelf No</th><th>Rack No</th><th>No. of Pages</th><th>Disk No</th><th>E-Book</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>{(data.filters.page - 1) * data.pageSize + i + 1}</td>
                    <td>{r.resourceTypeName}</td>
                    <td style={r.highlight ? { backgroundColor: '#F6C3C3' } : undefined}>{r.status}{r.isDamage ? '(Damaged)' : ''}</td>
                    <td>{r.accessionNo}</td>
                    <td>{r.remainBook} of {r.totalBookAvailable}</td>
                    <td>{r.authorName}</td>
                    <td>{r.resourceName}{r.convertName ? <><br />({r.convertName})</> : null}</td>
                    <td>{r.resourceSubname}</td>
                    <td>{r.edition || '-'}{r.revisedEdition ? ' (Revised)' : ''}</td>
                    <td>{r.volume || '-'}</td>
                    <td>{r.year || '-'}</td>
                    <td>{r.totalBookAvailable}</td>
                    <td>{r.callNumber}</td>
                    <td>{r.subjectName}</td>
                    <td>{r.departmentNames}</td>
                    <td>{r.publisherName}</td>
                    <td>{r.shelfNo}</td>
                    <td>{r.rackNo}</td>
                    <td>{r.pageNo}</td>
                    <td>{r.disc}</td>
                    <td>{r.ebookAttachment ? <a href={`https://www.cis.apdch.edu.in/files/library_ebook/${r.ebookAttachment}`} target="_blank" rel="noreferrer">View</a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 && (
            <nav>
              <ul className="pagination pagination-sm">
                {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                  <li key={p} className={`page-item ${p === data.filters.page ? 'active' : ''}`}>
                    <button type="button" className="page-link" onClick={() => runSearch(p)}>{p}</button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </>
      )}
    </>
  );
}

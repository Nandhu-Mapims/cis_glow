import { useEffect, useState } from 'react';

export default function ResourcesBarcodeSetup({ data, busy, onLoad, onSave }) {
  const [filters, setFilters] = useState({ search: '', resourceType: '', department: '', fromAccession: '', toAccession: '' });
  const [copiesPerLabel, setCopiesPerLabel] = useState(4);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.filters) setFilters((p) => ({ ...p, ...data.filters }));
    if (data?.copiesPerLabel) setCopiesPerLabel(data.copiesPerLabel);
  }, [data]);

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...filters, copiesPerLabel }); }} className="row g-2 mb-3">
        <div className="col-md-3"><input className="form-control" placeholder="Accession list" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></div>
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
        <div className="col-md-2"><input className="form-control" placeholder="From A.No" value={filters.fromAccession} onChange={(e) => setFilters((p) => ({ ...p, fromAccession: e.target.value }))} /></div>
        <div className="col-md-2"><input className="form-control" placeholder="To A.No" value={filters.toAccession} onChange={(e) => setFilters((p) => ({ ...p, toAccession: e.target.value }))} /></div>
        <div className="col-md-1"><button type="submit" className="btn btn-success" disabled={busy}>Search</button></div>
      </form>
      <div className="mb-3">
        {[1, 2, 3, 4].map((n) => (
          <label key={n} className="me-3"><input type="radio" checked={copiesPerLabel === n} onChange={() => setCopiesPerLabel(n)} /> {n} copies</label>
        ))}
      </div>
      <div className="row g-2">
        {data?.rows?.map((row) => (
          <div key={row.id} className="col-md-3 border p-2 text-center">
            <div className="fw-bold">{row.accessionNo}</div>
            <div className="small">{row.resourceName}</div>
            <div className="small text-muted">{row.authorName}</div>
          </div>
        ))}
      </div>
    </>
  );
}

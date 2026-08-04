import { useEffect, useState } from 'react';

function ResourceSearchForm({ data, filters, setFilters, onSearch, busy, extra }) {
  const set = (k, v) => setFilters((p) => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="row g-2 mb-3">
      <div className="col-md-3"><input className="form-control" placeholder="Search" value={filters.search} onChange={(e) => set('search', e.target.value)} /></div>
      {data?.searchFields ? (
        <div className="col-md-2">
          <select className="form-select" value={filters.searchBy} onChange={(e) => set('searchBy', e.target.value)}>
            {data.searchFields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      ) : null}
      <div className="col-md-2">
        <select className="form-select" value={filters.resourceType} onChange={(e) => set('resourceType', e.target.value)}>
          <option value="">All Resource</option>
          {data?.resourceTypes?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="col-md-2">
        <select className="form-select" value={filters.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All Department</option>
          {data?.departments?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value="Others">Others</option>
        </select>
      </div>
      {extra}
      <div className="col-md-2"><button type="submit" className="btn btn-danger" disabled={busy}>Search</button></div>
    </form>
  );
}

export default function ResourcesReportSetup({ data, busy, onLoad, onSave }) {
  const [filters, setFilters] = useState({ search: '', searchBy: '', resourceType: '', department: '' });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.filters) setFilters((p) => ({ ...p, ...data.filters })); }, [data]);

  return (
    <>
      <ResourceSearchForm data={data} filters={filters} setFilters={setFilters} onSearch={() => onSave(filters)} busy={busy} />
      <div className="table-responsive">
        <table className="table table-hover table-sm">
          <thead><tr><th>Accession</th><th>Title</th><th>Author</th><th>Call No</th><th>Shelf</th><th>Rack</th></tr></thead>
          <tbody>
            {data?.rows?.map((row) => (
              <tr key={row.id}><td>{row.accessionNo}</td><td>{row.resourceName}</td><td>{row.authorName}</td><td>{row.callNumber}</td><td>{row.shelfNo}</td><td>{row.rackNo}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ResourcesBarcodeSetup({ data, busy, onLoad, onSave }) {
  const [filters, setFilters] = useState({ search: '', resourceType: '', department: '', fromAccession: '', toAccession: '' });
  const [copiesPerLabel, setCopiesPerLabel] = useState(4);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.filters) setFilters((p) => ({ ...p, ...data.filters }));
    if (data?.copiesPerLabel) setCopiesPerLabel(data.copiesPerLabel);
  }, [data]);

  return (
    <>
      <ResourceSearchForm
        data={data}
        filters={filters}
        setFilters={setFilters}
        onSearch={() => onSave({ ...filters, copiesPerLabel })}
        busy={busy}
        extra={(
          <>
            <div className="col-md-2"><input className="form-control" placeholder="From A.No" value={filters.fromAccession} onChange={(e) => setFilters((p) => ({ ...p, fromAccession: e.target.value }))} /></div>
            <div className="col-md-2"><input className="form-control" placeholder="To A.No" value={filters.toAccession} onChange={(e) => setFilters((p) => ({ ...p, toAccession: e.target.value }))} /></div>
          </>
        )}
      />
      <div className="mb-3">
        {[1, 2, 3, 4].map((n) => (
          <label key={n} className="me-3"><input className="me-2" type="radio" checked={copiesPerLabel === n} onChange={() => setCopiesPerLabel(n)} /> {n} copies</label>
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

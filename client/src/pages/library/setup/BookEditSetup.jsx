import { useEffect, useState } from 'react';
import CheckListSelect from '../../../components/CheckListSelect';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function TextField({ form, set, name, label, required = false, type = 'text', className = 'col-md-6', placeholder }) {
  return <div className={className}><label className="form-label" htmlFor={name}>{label}{required && <span className="text-danger"> *</span>}</label><input id={name} type={type} className="form-control" placeholder={placeholder} value={form[name] || ''} required={required} onChange={(e) => set(name, e.target.value)} /></div>;
}

function SelectField({ form, set, name, label, options = [], required = false, className = 'col-md-6' }) {
  return <div className={className}><label className="form-label" htmlFor={name}>{label}{required && ' *'}</label><select id={name} className="form-select" value={form[name] || ''} required={required} onChange={(e) => set(name, e.target.value)}><option value="">-- Select --</option>{options.map((option) => <option key={option.id ?? option.value} value={option.id ?? option.value}>{option.name ?? option.label}</option>)}</select></div>;
}

const SEARCH_FIELDS = [
  { value: '', label: '--All--' },
  { value: 'resource_name', label: 'Title' },
  { value: 'accession_no', label: 'Accession No.' },
  { value: 'convert_name', label: 'Convert Title' },
  { value: 'call_number', label: 'Call Number' },
  { value: 'author_name', label: 'Author' },
  { value: 'publisher_name', label: 'Publisher' },
];

function ListView({ data, busy, onLoad, onSave, onEdit }) {
  const [filters, setFilters] = useState({ search: '', searchBy: '', resourceType: '', department: '' });
  useEffect(() => { if (data?.filters) setFilters((p) => ({ ...p, ...data.filters })); }, [data]);

  const runSearch = (page = 1) => onLoad({ ...filters, page });

  const handleDelete = async (id) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this resource?')) return;
    await onSave({ action: 'delete', id, filters });
  };

  const resourceTypeName = (id) => (data?.resourceTypes || []).find((r) => String(r.id) === String(id))?.name || id;

  return (
    <>
      <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); runSearch(1); }}>
        <div className="col-md-3"><input className="form-control" placeholder="Search" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} /></div>
        <div className="col-md-2">
          <select className="form-select" value={filters.searchBy} onChange={(e) => setFilters((p) => ({ ...p, searchBy: e.target.value }))}>
            {SEARCH_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
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
        <div className="col-md-1"><button type="submit" className="btn btn-primary" disabled={busy}><i className="fa fa-search" aria-hidden="true" /></button></div>
      </form>

      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-secondary"><tr><th>Resource</th><th>Status</th><th>Accession</th><th>Title</th><th /></tr></thead>
          <tbody>
            {(data?.list || []).map((row) => (
              <tr key={row.id}>
                <td>{resourceTypeName(row.resourceType)}</td>
                <td>{row.status}</td>
                <td>{row.accessionNo}</td>
                <td>{row.resourceName}</td>
                <td className="text-nowrap">
                  <button type="button" className="btn btn-sm btn-primary me-1" title="Edit" onClick={() => onEdit(row.id, filters)}><i className="fa fa-pencil" aria-hidden="true" /></button>
                  <button type="button" className="btn btn-sm btn-danger" title="Trash" disabled={busy} onClick={() => handleDelete(row.id)}><i className="fa fa-trash" aria-hidden="true" /></button>
                </td>
              </tr>
            ))}
            {!data?.list?.length && <tr><td colSpan={5} className="text-center text-muted">No data available</td></tr>}
          </tbody>
        </table>
      </div>

      {data?.totalPages > 1 && (
        <nav>
          <ul className="pagination pagination-sm">
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <li key={p} className={`page-item ${p === data.filters?.page ? 'active' : ''}`}>
                <button type="button" className="page-link" onClick={() => runSearch(p)}>{p}</button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

function EditView({ data, busy, onSave, onBack, listFilters }) {
  const [form, setForm] = useState({});
  const [copies, setCopies] = useState([{ accessionNo: '', copyNo: '' }]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  useEffect(() => { if (data?.book) setForm({ ...data.book, ebookFile: null }); }, [data]);

  const isEbook = data?.ebookCategoryId && String(data.ebookCategoryId) === String(form.resourceType);
  const isJournal = (data?.resourceTypes || []).find((r) => String(r.id) === String(form.resourceType) && /journal/i.test(r.name || ''));

  const submit = async (e) => {
    e.preventDefault();
    let ebookFile = null;
    if (form.ebookFile instanceof File) {
      ebookFile = { name: form.ebookFile.name, data: await readFileAsDataUrl(form.ebookFile) };
    }
    await onSave({ ...form, ebookFile, id: form.id, filters: listFilters });
  };

  const addCopyRow = () => setCopies((p) => [...p, { accessionNo: '', copyNo: '' }]);
  const submitCopies = async (e) => {
    e.preventDefault();
    const rows = copies.filter((c) => c.accessionNo.trim());
    if (!rows.length) return;
    await onSave({ action: 'add-copies', copyBookId: form.id, copies: rows });
    setCopies([{ accessionNo: '', copyNo: '' }]);
  };

  if (!form.id) return <p className="text-danger">Resource not found.</p>;

  return (
    <>
      <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={onBack}>&laquo; Back to list</button>

      <form onSubmit={submit} className="row g-3">
        <SelectField form={form} set={set} name="resourceType" label="Resource" required options={data?.resourceTypes} />
        <TextField form={form} set={set} name="accessionNo" label="Accession No." className="col-md-6" />
        <TextField form={form} set={set} name="resourceName" label="Title" required />
        <TextField form={form} set={set} name="resourceSubname" label="Sub title" />
        <TextField form={form} set={set} name="convertTitle" label="Convert title" />
        <TextField form={form} set={set} name="convertName" label="Title (converted)" />
        <TextField form={form} set={set} name="authorName" label="Author" required />
        <TextField form={form} set={set} name="publisherName" label="Publisher" />
        <SelectField form={form} set={set} name="supplierCode" label="Supplier" options={data?.suppliers} />
        <SelectField form={form} set={set} name="source" label="Source" options={data?.sources} />
        <SelectField form={form} set={set} name="resourceSubject" label="Subject" options={data?.subjects} />
        <div className="col-md-6">
          <label className="form-label">Branch</label>
          <CheckListSelect
            options={(data?.departments || []).map((d) => ({ value: String(d.id), label: d.name }))}
            value={(form.resourceDepartment || []).map(String)}
            onChange={(next) => set('resourceDepartment', next)}
            searchPlaceholder="Search branches..."
          />
        </div>
        <TextField form={form} set={set} name="callNumber" label="Call No." />
        <TextField form={form} set={set} name="copyNo" label="Copy No." />
        <TextField form={form} set={set} name="isbnNo" label={isJournal ? 'ISSN No.' : 'ISBN No.'} />
        {isJournal && <TextField form={form} set={set} name="issnMonth" label="Month" />}
        <TextField form={form} set={set} name="edition" label="Edition" />
        <TextField form={form} set={set} name="year" label="Published year" type="number" />
        <TextField form={form} set={set} name="volume" label="Volume" />
        <TextField form={form} set={set} name="shelfNo" label="Shelf No." />
        <TextField form={form} set={set} name="rackNo" label="Rack No." />
        <TextField form={form} set={set} name="pageNo" label="Page No." />
        <TextField form={form} set={set} name="numberOfDisks" label="No. of disks" type="number" />
        <TextField form={form} set={set} name="billNo" label="Bill No." />
        <TextField form={form} set={set} name="billDate" label="Bill date" type="date" />
        <TextField form={form} set={set} name="price" label="Price" type="number" />
        <TextField form={form} set={set} name="remarks" label="Remarks" />

        <div className="col-md-6 d-flex align-items-end pb-2">
          <div className="form-check me-4">
            <input id="revisedEdition" className="form-check-input" type="checkbox" checked={Boolean(form.revisedEdition)} onChange={(e) => set('revisedEdition', e.target.checked)} />
            <label className="form-check-label" htmlFor="revisedEdition">Revised edition</label>
          </div>
          <div className="form-check me-4">
            <input id="referenceCopy" className="form-check-input" type="checkbox" checked={Boolean(form.referenceCopy)} onChange={(e) => set('referenceCopy', e.target.checked)} />
            <label className="form-check-label" htmlFor="referenceCopy">Reference copy</label>
          </div>
          <div className="form-check">
            <input id="isDamage" className="form-check-input" type="checkbox" checked={Boolean(form.isDamage)} onChange={(e) => set('isDamage', e.target.checked)} />
            <label className="form-check-label" htmlFor="isDamage">Damaged</label>
          </div>
        </div>

        {isEbook && (
          <div className="col-md-6">
            <label className="form-label" htmlFor="ebookFile">E-book (.pdf)</label>
            <input id="ebookFile" type="file" accept=".pdf,application/pdf" className="form-control" onChange={(e) => set('ebookFile', e.target.files?.[0] || null)} />
            {form.ebookAttachment && !(form.ebookFile instanceof File) && (
              <div className="form-text">
                <a href={`https://www.cis.apdch.edu.in/files/library_ebook/${form.ebookAttachment}`} target="_blank" rel="noreferrer">View current e-book</a>
              </div>
            )}
          </div>
        )}

        <div className="col-12">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>

      <hr />
      <h6>Add Book (copy accession numbers)</h6>
      <form onSubmit={submitCopies} className="mb-3">
        {copies.map((c, i) => (
          <div className="row g-2 mb-2" key={i}>
            <div className="col-md-3"><input className="form-control" placeholder="New Accession No" value={c.accessionNo} onChange={(e) => setCopies((p) => p.map((r, j) => (j === i ? { ...r, accessionNo: e.target.value } : r)))} /></div>
            <div className="col-md-3"><input className="form-control" placeholder="New Copy No" value={c.copyNo} onChange={(e) => setCopies((p) => p.map((r, j) => (j === i ? { ...r, copyNo: e.target.value } : r)))} /></div>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-info me-2" onClick={addCopyRow}>+</button>
        <button type="submit" className="btn btn-sm btn-success" disabled={busy}>Add Book</button>
      </form>
    </>
  );
}

export default function BookEditSetup({ data, busy, onLoad, onSave }) {
  const [editRowId, setEditRowId] = useState(null);
  const [listFilters, setListFilters] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);

  const openEdit = (id, filters) => { setListFilters(filters); setEditRowId(id); onLoad({ editRowId: id }); };
  const backToList = () => { setEditRowId(null); onLoad(listFilters); };

  const save = async (payload) => {
    const result = await onSave(payload);
    if (result?.success && payload.action !== 'add-copies') setEditRowId(null);
    return result;
  };

  return editRowId
    ? <EditView data={data} busy={busy} onSave={save} onBack={backToList} listFilters={listFilters} />
    : <ListView data={data} busy={busy} onLoad={onLoad} onSave={save} onEdit={openEdit} />;
}

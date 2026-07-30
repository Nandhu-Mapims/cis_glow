import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import { DragHandle, useDragReorder } from '../../../hooks/useDragReorder';

const DOC_TYPES = ['QN', 'QL', 'DOC'];

function naacAttachmentUrl(filename) {
  const file = String(filename || '').trim();
  if (!file) return '';
  return `/legacy/naac/${encodeURIComponent(file).replace(/%2F/g, '/')}`;
}

function emptyQuanItem() {
  return { name: '', docNumber: '', docType: 'QN', attachment: '', attachmentSize: '' };
}

export function NaacCrudScreen({ data, busy, readOnly, onLoad, onSave, itemFields }) {
  const [deptRef, setDeptRef] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptOrder, setDeptOrder] = useState('');
  const [items, setItems] = useState([]);
  const sortable = itemFields?.some((f) => f.key === 'order');
  const { dragHandleProps, rowDropProps, rowClassName } = useDragReorder(items, setItems);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (!data) return;
    setDeptRef(data.deptRef || '');
    setDeptName(data.deptName || '');
    setDeptOrder(data.deptOrder ?? '');
    setItems(data.items || []);
  }, [data]);

  const loadSection = async (ref) => {
    setDeptRef(String(ref));
    await onLoad({ deptRef: ref });
  };

  const showGrid = Boolean(deptRef && (deptRef === 'add_new' || Number(deptRef)));

  if (readOnly) {
    return (
      <div>
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <select className="form-control" value={deptRef} onChange={(e) => onLoad({ deptRef: e.target.value, docType: data?.docType })}>
              <option value="">All sections</option>
              {(data?.sections || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <table className="table table-bordered table-sm">
          <thead><tr><th>Section</th><th>Name</th><th>Doc</th><th>Attachment</th></tr></thead>
          <tbody>{(data?.rows || []).map((r) => <tr key={r.id}><td>{r.section}</td><td>{r.name}</td><td>{r.docNumber} {r.docType}</td><td>{r.attachment}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ deptRef, deptName, deptOrder, items }); }}>
      <div className="row g-3 mb-3 align-items-end">
        <div className="col-md-4">
          <label className="form-label">Category</label>
          <select className="form-select" value={deptRef} onChange={(e) => loadSection(e.target.value)}>
            <option value="">--Select One--</option>
            {(data?.sections || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value="add_new">Add New</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Category name</label>
          <input className="form-control" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
        </div>
      </div>

      {showGrid ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-2">
              <label className="form-label">Category order</label>
              <input type="number" className="form-control" value={deptOrder} onChange={(e) => setDeptOrder(e.target.value)} />
            </div>
          </div>

          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className={`border rounded p-2 mb-2 row g-2 align-items-center${rowClassName(idx) ? ` ${rowClassName(idx)}` : ''}`}
              {...(sortable ? rowDropProps(idx) : {})}
            >
              {sortable ? (
                <div className="col-auto"><DragHandle {...dragHandleProps(idx)} /></div>
              ) : null}
              {itemFields.map((f) => (
                <div key={f.key} className="col-md-3">
                  {f.key === 'order' && sortable ? (
                    <input className="form-control" value={item[f.key] || ''} readOnly disabled title="Drag the handle to reorder" />
                  ) : (
                    <input
                      className="form-control"
                      placeholder={f.label}
                      value={item[f.key] || ''}
                      onChange={(e) => setItems(items.map((row, i) => (i === idx ? { ...row, [f.key]: e.target.value } : row)))}
                    />
                  )}
                </div>
              ))}
              <div className="col-auto ms-auto">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={busy}
                  title="Delete row"
                  onClick={() => (item.id ? onSave({ action: 'delete', id: item.id, deptRef }) : setItems((p) => p.filter((_, i) => i !== idx)))}
                >
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}

          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setItems([...items, { order: items.length + 1, name: '' }])}>Add row</button>
            <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Save</button>
          </div>
        </>
      ) : null}
    </form>
  );
}

export function NaacQualScreen(props) {
  return (
    <NaacCrudScreen
      {...props}
      itemFields={[
        { key: 'order', label: 'Order' },
        { key: 'name', label: 'Name' },
        { key: 'attachment', label: 'Attachment' },
      ]}
    />
  );
}

export function NaacQuanScreen({ data, busy, onLoad, onSave }) {
  const [deptRef, setDeptRef] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptOrder, setDeptOrder] = useState('');
  const [items, setItems] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (!data) return;
    setDeptRef(data.deptRef || '');
    setDeptName(data.deptName || '');
    setDeptOrder(data.deptOrder ?? '');
    setItems(data.items?.length ? data.items : []);
  }, [data]);

  const loadSection = async (ref) => {
    setDeptRef(String(ref));
    await onLoad({ deptRef: ref });
  };

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const showGrid = Boolean(deptRef && (deptRef === 'add_new' || Number(deptRef)));

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({
      deptRef,
      deptName,
      deptOrder,
      items: items.map((row, index) => ({
        ...row,
        order: row.order || index + 1,
      })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', id: deleteId, deptRef });
    setDeleteId(null);
  };

  return (
    <>
      <form onSubmit={handleSave}>
        <div className="row g-3 mb-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Category</label>
            <select className="form-select" value={deptRef} onChange={(e) => loadSection(e.target.value)}>
              <option value="">--Select One--</option>
              {(data?.sections || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="add_new">Add New</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Category name</label>
            <input className="form-control" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
          </div>
        </div>

        {showGrid ? (
          <>
            <div className="row g-3 mb-3">
              <div className="col-md-2">
                <label className="form-label">Category order</label>
                <input className="form-control" value={deptOrder} onChange={(e) => setDeptOrder(e.target.value)} />
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-sm align-middle">
                <thead className="table-secondary">
                  <tr>
                    <th style={{ width: '5%' }}>S.No</th>
                    <th style={{ width: '8%' }}>Order</th>
                    <th>Title</th>
                    <th style={{ width: '14%' }}>Type</th>
                    <th style={{ width: '18%' }}>Attachment</th>
                    <th style={{ width: '10%' }}>View</th>
                    <th style={{ width: '8%' }}>Size</th>
                    <th style={{ width: '6%' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {(items.length ? items : [emptyQuanItem()]).map((item, index) => (
                    <tr key={item.id || `new-${index}`}>
                      <td>{index + 1}</td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={item.docNumber || ''}
                          onChange={(e) => updateItem(index, { docNumber: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={item.name || ''}
                          onChange={(e) => updateItem(index, { name: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          {DOC_TYPES.map((type) => (
                            <label key={type} className="form-check-label small">
                              <input
                                type="radio"
                                className="form-check-input me-1"
                                name={`docType-${item.id || index}`}
                                checked={(item.docType || 'QN') === type}
                                onChange={() => updateItem(index, { docType: type })}
                              />
                              {type}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={item.attachment || ''}
                          onChange={(e) => updateItem(index, { attachment: e.target.value })}
                        />
                      </td>
                      <td className="small">
                        {item.attachment ? (
                          <a href={naacAttachmentUrl(item.attachment)} target="_blank" rel="noreferrer">View</a>
                        ) : null}
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={item.attachmentSize || ''}
                          onChange={(e) => updateItem(index, { attachmentSize: e.target.value })}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => (item.id ? setDeleteId(item.id) : setItems((prev) => prev.filter((_, i) => i !== index)))}
                        >
                          Del
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between">
              <button type="button" className="btn btn-sm btn-info" onClick={() => setItems((prev) => [...prev, emptyQuanItem()])}>+</button>
              <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            </div>
          </>
        ) : null}
      </form>

      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete..."
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        busy={busy}
      />
    </>
  );
}

export function NaacQuanReportScreen(props) {
  return <NaacCrudScreen {...props} readOnly />;
}

export function NaacQuanDetailedReportScreen({ data, busy, onLoad }) {
  const [deptRef, setDeptRef] = useState('');
  const [docType, setDocType] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (!data) return;
    setDeptRef(data.deptRef || '');
    setDocType(data.docType || '');
  }, [data]);

  const runSearch = async (e) => {
    e.preventDefault();
    await onLoad({ deptRef, docType });
  };

  const reset = async () => {
    setDeptRef('');
    setDocType('');
    await onLoad({ deptRef: '', docType: '' });
  };

  return (
    <div>
      <form className="row g-2 mb-3" onSubmit={runSearch}>
        <div className="col-md-4">
          <select className="form-select" value={deptRef} onChange={(e) => setDeptRef(e.target.value)}>
            <option value="">-- Select Criteria --</option>
            {(data?.sections || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <select className="form-select" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="">-- Select Document Type --</option>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="col-md-5 d-flex gap-2">
          <button type="submit" className="btn btn-danger" disabled={busy}>Search</button>
          <button type="button" className="btn btn-info" disabled={busy} onClick={reset}>Reset</button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-secondary">
            <tr>
              <th>S.No</th>
              <th>Title</th>
              <th>URL Link</th>
              <th>File Size</th>
              <th>Doc.Type</th>
              <th>Created By</th>
              <th>Created Date</th>
              <th>Updated By</th>
              <th>Updated Date</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).length === 0 ? (
              <tr><td colSpan={9} className="text-muted text-center">No data available</td></tr>
            ) : (
              (data?.rows || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.sno}</td>
                  <td>{r.title}</td>
                  <td className="small">
                    {r.attachmentUrl ? (
                      <a href={r.attachmentUrl} target="_blank" rel="noreferrer">{r.attachmentUrl}</a>
                    ) : ''}
                  </td>
                  <td>{r.attachmentSize}</td>
                  <td>{r.docType}</td>
                  <td>{r.createdBy}</td>
                  <td>{r.createdAt}</td>
                  <td>{r.updatedBy}</td>
                  <td>{r.updatedAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

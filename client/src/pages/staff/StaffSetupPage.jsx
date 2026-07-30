import { useEffect, useRef, useState } from 'react';
import { useLocation, useOutletContext, useParams } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
import { DragHandle, useDragReorder } from '../../hooks/useDragReorder';
import { STAFF_SETUP_META } from './staffModuleMeta';
import { useStaffSetupApi } from './useStaffModuleApi';

/** Passing `onReorder` opts a CrudRows table into drag-and-drop reordering (see
 * useDragReorder) — the `order` column then becomes read-only since its value is
 * driven by row position, not manual typing. */
function CrudRows({ rows, columns, onChange, onAdd, onDelete, onReorder, actions }) {
  const sortable = typeof onReorder === 'function';
  const hasOrderColumn = columns.some((c) => c.key === 'order');
  const { dragHandleProps, rowDropProps, rowClassName } = useDragReorder(rows, onReorder || (() => {}), {
    orderKey: hasOrderColumn ? 'order' : null,
  });

  return (
  <div className="table-responsive">
    <table className="table table-bordered table-sm">
      <thead className="table-secondary">
        <tr>
          {sortable ? <th style={{ width: '2rem' }} aria-hidden="true" /> : null}
          {columns.map((c) => <th key={c.key}>{c.label}</th>)}
          {onDelete ? <th className="text-end" style={{ width: '1%' }} /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.id || `new-${i}`}
            className={sortable ? rowClassName(i) : undefined}
            {...(sortable ? rowDropProps(i) : {})}
          >
            {sortable ? (
              <td className="text-center">
                <DragHandle {...dragHandleProps(i)} />
              </td>
            ) : null}
            {columns.map((c) => (
              <td key={c.key}>
                {c.type === 'checkbox' ? (
                  <input type="checkbox" checked={!!row[c.key]} onChange={(e) => onChange(i, c.key, e.target.checked)} />
                ) : c.key === 'order' && sortable ? (
                  <input className="form-control form-control-sm" value={row[c.key] ?? ''} readOnly disabled title="Drag the row's handle to reorder" />
                ) : (
                  <input className="form-control form-control-sm" value={row[c.key] ?? ''} onChange={(e) => onChange(i, c.key, e.target.value)} />
                )}
              </td>
            ))}
            {onDelete ? (
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-outline-danger" title="Delete row" onClick={() => onDelete(i)}>
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
    <div className="d-flex align-items-center gap-2">
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onAdd}>Add row</button>
      {actions}
    </div>
  </div>
  );
}

function mergeGroupOption(groups, value, labelMap) {
  if (!value) return groups;
  const exists = groups.some((g) => g.options.some((o) => o.value === value));
  if (exists) return groups;
  return [
    ...groups,
    {
      departmentName: 'Selected',
      options: [{ value, label: labelMap?.[value] || value }],
    },
  ];
}

function DesignationSelect({ value, groups, labelMap, onChange, disabled }) {
  const options = mergeGroupOption(groups, value, labelMap);
  return (
    <select className="form-select form-select-sm" value={value || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">-- Select --</option>
      {options.map((g) => (
        <optgroup key={g.departmentName} label={g.departmentName}>
          {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function OrgChartPositionsTable({ rows, designationGroups, reportsToGroups, designationLabelMap, onChange, onAdd, onRemove }) {
  return (
    <div>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-secondary">
            <tr><th>S.No.</th><th>Designation</th><th>Reporting To</th></tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || `new-${i}`}>
                <td className="align-middle">{i + 1}</td>
                <td>
                  <DesignationSelect
                    value={row.designationKey}
                    groups={designationGroups}
                    labelMap={designationLabelMap}
                    onChange={(val) => onChange(i, 'designationKey', val)}
                  />
                </td>
                <td>
                  <DesignationSelect
                    value={row.reportsTo}
                    groups={reportsToGroups}
                    labelMap={designationLabelMap}
                    onChange={(val) => onChange(i, 'reportsTo', val)}
                    disabled={!reportsToGroups.length && !row.reportsTo}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-sm btn-info" onClick={onAdd}>+</button>
        <button type="button" className="btn btn-sm btn-info" onClick={onRemove} disabled={rows.length <= 1}>-</button>
      </div>
    </div>
  );
}

function OrgChartConfigForm({ data, rows, setRows, busy, onLoad, onSave, updateRow }) {
  const [levelTitle, setLevelTitle] = useState('');
  const [levelOrder, setLevelOrder] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!data) return;
    setLevelTitle(data.levelTitle || '');
    setLevelOrder(data.levelOrder ?? '');
  }, [data?.selectedLevelId, data?.levelTitle, data?.levelOrder]);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSave({
        selectedLevelId: data?.selectedLevelId,
        levelTitle,
        levelOrder: Number(levelOrder) || 1,
        positions: rows,
      });
    }}>
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-md-4">
          <label className="form-label">Level <span className="text-danger">*</span></label>
          <select
            className="form-select"
            value={data?.selectedLevelId || ''}
            onChange={(e) => onLoad({ levelId: e.target.value })}
          >
            <option value="add_new">Add New Level</option>
            {(data?.levels || []).map((l) => <option key={l.id} value={l.id}>{l.label || l.title}</option>)}
          </select>
        </div>
        {data?.selectedLevelId && (
          <div className="col-md-4">
            <label className="form-label">Level name <span className="text-danger">*</span></label>
            <input className="form-control" value={levelTitle} maxLength={155} required onChange={(e) => setLevelTitle(e.target.value)} />
          </div>
        )}
      </div>
      {data?.selectedLevelId && (
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label">Order <span className="text-danger">*</span></label>
            <input
              type="number"
              className="form-control"
              value={levelOrder}
              maxLength={5}
              required
              readOnly={data?.levelOrderReadonly}
              onChange={(e) => setLevelOrder(e.target.value)}
            />
          </div>
        </div>
      )}
      {data?.selectedLevelId && (
        <OrgChartPositionsTable
          rows={rows}
          designationGroups={data?.designationGroups || []}
          reportsToGroups={data?.reportsToGroups || []}
          designationLabelMap={data?.designationLabelMap || {}}
          onChange={updateRow}
          onAdd={() => setRows((p) => [...p, { designationKey: '', reportsTo: '' }])}
          onRemove={() => {
            if (rows.length <= 1) return;
            setConfirmRemove(true);
          }}
        />
      )}
      {data?.selectedLevelId && (
        <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Save</button>
      )}
      <ConfirmModal
        show={confirmRemove}
        title="Remove last row?"
        message="Remove the last position row from this level?"
        confirmLabel="Remove Row"
        tone="warning"
        onConfirm={() => { setRows((p) => p.slice(0, -1)); setConfirmRemove(false); }}
        onClose={() => setConfirmRemove(false)}
      />
    </form>
  );
}

function StaffSearchPanel({ onSearch, results, onSelect, selected, layout = 'inline' }) {
  const [by, setBy] = useState('name');
  const [q, setQ] = useState('');

  if (layout === 'sidebar') {
    return (
      <div className="card shadow-sm">
        <div className="card-header py-2"><strong>Filter</strong></div>
        <div className="card-body p-3">
          <label className="form-label small text-muted">Search by</label>
          <div className="d-flex flex-column gap-1 mb-3">
            <label className="small"><input type="radio" className="form-check-input me-1" checked={by === 'name'} onChange={() => setBy('name')} /> Name</label>
            <label className="small"><input type="radio" className="form-check-input me-1" checked={by === 'staff_id'} onChange={() => setBy('staff_id')} /> Staff ID</label>
            <label className="small"><input type="radio" className="form-check-input me-1" checked={by === 'category'} onChange={() => setBy('category')} /> Category</label>
          </div>
          <div className="input-group input-group-sm mb-2">
            <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." onKeyDown={(e) => { if (e.key === 'Enter') onSearch({ by, q }); }} />
            <button type="button" className="btn btn-info" onClick={() => onSearch({ by, q })}>Go</button>
          </div>
          <div className="list-group list-group-flush border rounded" style={{ maxHeight: '420px', overflow: 'auto' }}>
            {(results || []).length === 0 ? (
              <div className="list-group-item text-muted small">No staff found.</div>
            ) : (results || []).map((r) => (
              <button
                key={r.id}
                type="button"
                className={`list-group-item list-group-item-action py-2 small text-start ${selected?.id === r.id ? 'active' : ''}`}
                onClick={() => onSelect(r)}
              >
                <span className={selected?.id === r.id ? '' : 'text-success'}>{r.staffId}</span> — {r.name}
                {r.resigned && <span className="ms-1 fst-italic text-danger">Resigned</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="row g-2 mb-3">
      <div className="col-md-2">
        <select className="form-select form-select-sm" value={by} onChange={(e) => setBy(e.target.value)}>
          <option value="name">Name</option><option value="staff_id">Staff ID</option><option value="category">Category</option>
        </select>
      </div>
      <div className="col-md-4"><input className="form-control form-control-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." onKeyDown={(e) => { if (e.key === 'Enter') onSearch({ by, q }); }} /></div>
      <div className="col-md-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onSearch({ by, q })}>Search</button></div>
      <div className="col-12">
        <div className="list-group" style={{ maxHeight: '240px', overflow: 'auto' }}>
          {(results || []).length === 0 ? (
            <div className="list-group-item text-muted small">No staff found. Try a different search.</div>
          ) : (results || []).map((r) => (
            <button key={r.id} type="button" className={`list-group-item list-group-item-action ${selected?.id === r.id ? 'active' : ''}`} onClick={() => onSelect(r)}>
              <strong>{r.staffId}</strong> — {r.name}
              {r.resigned && <span className="ms-1 small fst-italic text-danger">Resigned</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DesignationRowsTable({ rows, departments, designations, onChange, onPatch, onAdd, onRemove, onSetMainRow }) {
  const designationsByDept = (deptId) => (designations || []).filter((d) => Number(d.departmentId) === Number(deptId));

  return (
    <div>
      <div className="table-responsive">
        <table className="table table-bordered table-sm mb-2">
          <thead className="table-secondary">
            <tr>
              <th>S.No.</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Unit</th>
              <th>From</th>
              <th>To</th>
              <th>Main</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || `new-${i}`} className="designation-edit-row">
                <td className="align-middle">{i + 1}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={row.departmentId ?? ''}
                    onChange={(e) => onPatch(i, { departmentId: e.target.value, designationId: '' })}
                  >
                    <option value="">-- Select --</option>
                    {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={row.designationId ?? ''}
                    disabled={!row.departmentId}
                    onChange={(e) => onChange(i, 'designationId', e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {designationsByDept(row.departmentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td>
                  <select className="form-select form-select-sm" value={row.unitType || 'II'} onChange={(e) => onChange(i, 'unitType', e.target.value)}>
                    <option value="I">I</option>
                    <option value="II">II</option>
                  </select>
                </td>
                <td>
                  <input type="date" className="form-control form-control-sm" value={row.fromDate || ''} onChange={(e) => onChange(i, 'fromDate', e.target.value)} />
                </td>
                <td>
                  <input type="date" className="form-control form-control-sm" value={row.toDate || ''} onChange={(e) => onChange(i, 'toDate', e.target.value)} />
                </td>
                <td className="text-center align-middle">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={!!row.isAcademic}
                    onChange={(e) => (e.target.checked ? onSetMainRow(i) : onChange(i, 'isAcademic', false))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-sm btn-info" onClick={onAdd}>+</button>
        <button type="button" className="btn btn-sm btn-info" onClick={onRemove} disabled={rows.length <= 1}>-</button>
      </div>
    </div>
  );
}

function DesignationEditForm({ staff, departments, designations, rows, setRows, busy, onSave, updateRow, patchRow }) {
  const [releavingDate, setReleavingDate] = useState('');
  const [releavingInfo, setReleavingInfo] = useState('');
  const [releavingAttachment, setReleavingAttachment] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!staff) return;
    setReleavingDate(staff.releavingDate || '');
    setReleavingInfo(staff.releavingInfo || '');
    setReleavingAttachment(staff.releavingAttachment || '');
    setAttachmentFile(null);
  }, [staff?.id, staff?.releavingDate, staff?.releavingInfo, staff?.releavingAttachment]);

  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      staffId: staff.id,
      releavingDate,
      releavingInfo,
      releavingAttachment,
      designations: rows,
    };
    if (attachmentFile) {
      payload.releavingAttachmentUpload = {
        filename: attachmentFile.name,
        dataBase64: await readFile(attachmentFile),
      };
    }
    onSave(payload);
  };

  if (!staff) {
    return <p className="text-muted">Select a staff member from the list.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card shadow-sm mb-3">
        <div className="card-header py-2"><strong>Staff</strong></div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-7">
              <div className="row mb-2">
                <label className="col-sm-4 col-form-label">Name</label>
                <div className="col-sm-8 col-form-label">{staff.name}</div>
              </div>
              <div className="row mb-2">
                <label className="col-sm-4 col-form-label">Staff ID</label>
                <div className="col-sm-8 col-form-label">{staff.staffId}</div>
              </div>
              <div className="row mb-2">
                <label className="col-sm-4 col-form-label">Discontinued</label>
                <div className="col-sm-8">
                  <input type="date" className="form-control form-control-sm" value={releavingDate} onChange={(e) => setReleavingDate(e.target.value)} />
                </div>
              </div>
              <div className="row mb-2">
                <label className="col-sm-4 col-form-label">Attachment</label>
                <div className="col-sm-8">
                  <input type="file" className="form-control form-control-sm" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} />
                  {releavingAttachment && staff.releavingAttachmentUrl && (
                    <div className="small mt-1">
                      <a href={staff.releavingAttachmentUrl} target="_blank" rel="noreferrer">{releavingAttachment}</a>
                    </div>
                  )}
                </div>
              </div>
              <div className="row">
                <label className="col-sm-4 col-form-label">Reason</label>
                <div className="col-sm-8">
                  <textarea className="form-control form-control-sm" rows={3} value={releavingInfo} onChange={(e) => setReleavingInfo(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="col-md-5 text-center">
              {staff.photoUrl && (
                <img src={staff.photoUrl} alt="" width={80} height={100} className="border rounded object-fit-cover" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-header py-2"><strong>Designation</strong></div>
        <div className="card-body">
          <DesignationRowsTable
            rows={rows}
            departments={departments}
            designations={designations}
            onChange={updateRow}
            onPatch={patchRow}
            onAdd={() => setRows((p) => [...p, { departmentId: '', designationId: '', unitType: 'II', fromDate: '', toDate: '', isAcademic: false }])}
            onRemove={() => {
              if (rows.length <= 1) return;
              setConfirmRemove(true);
            }}
            onSetMainRow={(index) => setRows((prev) => prev.map((r, i) => ({ ...r, isAcademic: i === index })))}
          />
        </div>
      </div>

      <div className="text-center">
        <button type="submit" className="btn btn-lg btn-danger px-5" disabled={busy}>Save</button>
      </div>

      <ConfirmModal
        show={confirmRemove}
        title="Remove last row?"
        message="Remove the last designation row for this staff member?"
        confirmLabel="Remove Row"
        tone="warning"
        onConfirm={() => { setRows((p) => p.slice(0, -1)); setConfirmRemove(false); }}
        onClose={() => setConfirmRemove(false)}
      />
    </form>
  );
}

function TransportTripRows({ rows, transports = [], stops = [], onChange, onPatch, onAdd }) {
  const stopMap = Object.fromEntries((stops || []).map((s) => [String(s.id), s.name]));

  const stopsForBus = (busNo) => {
    const transport = (transports || []).find((t) => t.number === busNo);
    if (!transport?.stopIds?.length) return [];
    return transport.stopIds.map((id) => ({
      id: String(id),
      name: stopMap[String(id)] || `Stop ${id}`,
    }));
  };

  const tripOptions = (busNo) => {
    const transport = (transports || []).find((t) => t.number === busNo);
    const count = transport?.tripCount || 0;
    if (!count) return [];
    return Array.from({ length: count }, (_, i) => i + 1);
  };

  const handleBusChange = (index, busNo) => {
    const options = stopsForBus(busNo);
    const trips = tripOptions(busNo);
    onPatch(index, {
      busNo,
      stopName: options[0]?.id || '',
      tripNo: trips[0] || '',
    });
  };

  return (
    <div className="table-responsive">
      <table className="table table-bordered table-sm">
        <thead className="table-secondary">
          <tr>
            <th>Enable</th>
            <th>Bus</th>
            <th>Stop</th>
            <th>Trip</th>
            <th>Pickup</th>
            <th>Drop</th>
            <th>Discontinue</th>
            <th>Disc. date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const stopChoices = stopsForBus(row.busNo);
            const tripChoices = tripOptions(row.busNo);
            return (
              <tr key={row.id || `new-${i}`}>
                <td>
                  <input type="checkbox" checked={!!row.enabled} onChange={(e) => onChange(i, 'enabled', e.target.checked)} />
                </td>
                <td>
                  <select className="form-select form-select-sm" value={row.busNo || ''} onChange={(e) => handleBusChange(i, e.target.value)}>
                    <option value="">--Select--</option>
                    {(transports || []).map((t) => <option key={t.number} value={t.number}>{t.number}</option>)}
                  </select>
                </td>
                <td>
                  <select className="form-select form-select-sm" value={row.stopName || ''} onChange={(e) => onChange(i, 'stopName', e.target.value)}>
                    <option value="">--Select--</option>
                    {stopChoices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td>
                  <select className="form-select form-select-sm" value={row.tripNo || ''} onChange={(e) => onChange(i, 'tripNo', e.target.value)}>
                    <option value="">--Select--</option>
                    {tripChoices.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td>
                  <input type="checkbox" checked={!!row.journeyUp} onChange={(e) => onChange(i, 'journeyUp', e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={!!row.journeyDown} onChange={(e) => onChange(i, 'journeyDown', e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={!!row.discontinued} onChange={(e) => onChange(i, 'discontinued', e.target.checked)} />
                </td>
                <td>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={row.discDate || ''}
                    disabled={!row.discontinued}
                    onChange={(e) => onChange(i, 'discDate', e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onAdd}>Add row</button>
    </div>
  );
}

function LoginHelpForm({ data, busy, onSave }) {
  const [content, setContent] = useState('');
  const [showSource, setShowSource] = useState(false);
  const editorRef = useRef(null);
  const loadedContent = useRef('');

  useEffect(() => {
    if (data?.content === undefined) return;
    const next = data.content || '';
    setContent(next);
    if (!showSource && editorRef.current && loadedContent.current !== next) {
      editorRef.current.innerHTML = next;
      loadedContent.current = next;
    }
  }, [data?.content, showSource]);

  const syncFromEditor = () => {
    const html = editorRef.current?.innerHTML ?? '';
    setContent(html);
    loadedContent.current = html;
  };

  const execFormat = (command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
  };

  const toggleSource = () => {
    if (!showSource && editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      loadedContent.current = html;
    } else if (showSource && editorRef.current) {
      editorRef.current.innerHTML = content;
      loadedContent.current = content;
    }
    setShowSource((prev) => !prev);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ content }); }}>
      <label className="form-label">Content <span className="text-danger">*</span></label>
      <div className="btn-toolbar gap-1 mb-2 border rounded p-2 bg-light flex-wrap">
        {!showSource && (
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => execFormat('bold')} title="Bold"><strong>B</strong></button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => execFormat('italic')} title="Italic"><em>I</em></button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => execFormat('underline')} title="Underline"><u>U</u></button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => execFormat('insertUnorderedList')} title="Bullet list">• List</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => execFormat('insertOrderedList')} title="Numbered list">1. List</button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                const url = window.prompt('Link URL');
                if (url) execFormat('createLink', url);
              }}
              title="Insert link"
            >
              Link
            </button>
          </>
        )}
        <button type="button" className="btn btn-sm btn-outline-primary ms-auto" onClick={toggleSource}>
          {showSource ? 'Visual editor' : 'HTML source'}
        </button>
      </div>
      {showSource ? (
        <textarea
          className="form-control font-monospace mb-3"
          rows={12}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            loadedContent.current = e.target.value;
          }}
        />
      ) : (
        <div
          ref={editorRef}
          className="form-control mb-3 login-help-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={syncFromEditor}
          onBlur={syncFromEditor}
          style={{ minHeight: '220px', overflowY: 'auto' }}
        />
      )}
      <div className="mb-3">
        <label className="form-label text-muted small">Staff portal preview</label>
        <div className="card border">
          <div className="card-body login-help-preview" dangerouslySetInnerHTML={{ __html: content || '<p class="text-muted mb-0">No content yet.</p>' }} />
        </div>
      </div>
      <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
    </form>
  );
}

function SetupBody({ screen, data, busy, onLoad, onSave, searchMore }) {
  const [rows, setRows] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    if (!data) return;
    if (data.rows) setRows(data.rows);
    if (data.subRows) setRows(data.subRows);
    if (data.designations_rows) setRows(data.designations_rows);
    if (data.positions) setRows(data.positions);
    if (data.trips) setRows(data.trips);
    if (data.staff) setSelectedStaff(data.staff);
    if (Array.isArray(data.searchResults)) setSearchResults(data.searchResults);
  }, [data]);

  const updateRow = (i, key, val) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: val } : r)));
  const patchRow = (i, patch) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  if (screen === 'login-help') {
    return <LoginHelpForm data={data} busy={busy} onSave={onSave} />;
  }

  if (screen === 'inspection-name') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSave({ rows }); }}>
        <CrudRows
          rows={rows}
          columns={[{ key: 'order', label: 'Order' }, { key: 'name', label: 'Inspection For' }]}
          onChange={updateRow}
          onAdd={() => setRows((p) => [...p, { name: '', order: p.length + 1 }])}
          onReorder={setRows}
          onDelete={(i) => {
            const row = rows[i];
            if (row.id) onSave({ action: 'delete', id: row.id });
            else setRows((p) => p.filter((_, j) => j !== i));
          }}
          actions={<button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Update</button>}
        />
      </form>
    );
  }

  if (screen === 'attachment-category') {
    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        onSave({ mainCategoryId: data?.selectedMainId, mainName: data?.mainName, mainOrder: data?.mainOrder, subRows: rows });
      }}>
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label">Main Category</label>
            <select className="form-select" value={data?.selectedMainId || ''} onChange={(e) => onLoad({ mainCategoryId: e.target.value })}>
              <option value="add_new">Add New</option>
              {(data?.mainCategories || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="col-md-4"><label className="form-label">Name</label><input className="form-control" defaultValue={data?.mainName} onBlur={(e) => onLoad({ mainCategoryId: data?.selectedMainId, mainName: e.target.value, mainOrder: data?.mainOrder })} /></div>
          <div className="col-md-2"><label className="form-label">Order</label><input type="number" className="form-control" defaultValue={data?.mainOrder} /></div>
        </div>
        <CrudRows
          rows={rows}
          columns={[{ key: 'order', label: 'Order' }, { key: 'name', label: 'Sub Category' }]}
          onChange={updateRow}
          onAdd={() => setRows((p) => [...p, { name: '', order: p.length + 1 }])}
          onReorder={setRows}
          onDelete={(i) => {
            const row = rows[i];
            if (row.id) onSave({ action: 'delete', id: row.id, mainCategoryId: data?.selectedMainId });
            else setRows((p) => p.filter((_, j) => j !== i));
          }}
          actions={<button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Update</button>}
        />
      </form>
    );
  }

  if (screen === 'org-chart-config') {
    return (
      <OrgChartConfigForm
        data={data}
        rows={rows}
        setRows={setRows}
        busy={busy}
        onLoad={onLoad}
        onSave={onSave}
        updateRow={updateRow}
      />
    );
  }

  if (screen === 'attachment-scategory' || screen === 'attachment-setup' || screen === 'inspection-config') {
    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        const payload = { rows };
        if (screen === 'attachment-scategory') {
          payload.mainCategoryId = data?.selectedMainId;
          payload.subCategoryId = data?.selectedSubId;
        }
        if (screen === 'attachment-setup') {
          payload.departmentId = data?.selectedDepartmentId;
          payload.designationId = data?.selectedDesignationId;
        }
        if (screen === 'inspection-config') {
          payload.courseId = data?.selectedCourseId;
          payload.academicYear = data?.academicYear;
          payload.academicType = data?.academicType;
        }
        onSave(payload);
      }}>
        {screen === 'attachment-scategory' && (
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <label className="form-label">Category <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={data?.selectedMainId || ''}
                onChange={(e) => onLoad({ mainCategoryId: e.target.value || undefined, subCategoryId: undefined })}
              >
                <option value="">-- Select --</option>
                {(data?.mainCategories || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Attachment Type <span className="text-danger">*</span></label>
              <select
                className="form-select"
                value={data?.selectedSubId || ''}
                disabled={!data?.selectedMainId}
                onChange={(e) => onLoad({ mainCategoryId: data?.selectedMainId, subCategoryId: e.target.value || undefined })}
              >
                <option value="">-- Select --</option>
                {(data?.subCategories || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        )}
        {screen === 'attachment-setup' && (
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <label className="form-label">Department</label>
              <select className="form-select" value={data?.selectedDepartmentId || ''} onChange={(e) => onLoad({ departmentId: e.target.value })}>
                {(data?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Designation</label>
              <select className="form-select" value={data?.selectedDesignationId || ''} onChange={(e) => onLoad({ departmentId: data?.selectedDepartmentId, designationId: e.target.value })}>
                {(data?.designations || []).filter((d) => d.departmentId === data?.selectedDepartmentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        )}
        {screen === 'inspection-config' && (
          <div className="row g-2 mb-3">
            <div className="col-md-5">
              <label className="form-label">Course</label>
              <select className="form-select" value={data?.selectedCourseId || ''} onChange={(e) => onLoad({ courseId: e.target.value, academicYear: data?.academicYear })}>
                {(data?.courses || []).map((c) => <option key={c.id} value={c.id}>{c.label || c.name}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Academic year</label>
              <input className="form-control" placeholder="Academic year" defaultValue={data?.academicYear} onBlur={(e) => onLoad({ courseId: data?.selectedCourseId, academicYear: e.target.value, academicType: data?.academicType })} />
            </div>
          </div>
        )}
        {screen === 'attachment-scategory' && (!data?.selectedMainId || !data?.selectedSubId) && (
          <div className="alert alert-info py-2">Select a category and attachment type to manage document titles. Try <strong>Educational</strong>, <strong>General</strong>, or <strong>Previous Work Experience</strong> for the full list of attachment types.</div>
        )}
        {(screen !== 'attachment-scategory' || (data?.selectedMainId && data?.selectedSubId)) && (
        <CrudRows
          rows={rows}
          columns={
            screen === 'inspection-config'
                ? [{ key: 'inspectionFor', label: 'Inspection For' }, { key: 'refLetterNo', label: 'Ref Letter' }, { key: 'seats', label: 'Seats' }, { key: 'fromDate', label: 'From' }, { key: 'toDate', label: 'To' }]
                : screen === 'attachment-setup'
                  ? [{ key: 'mcategoryId', label: 'M-Cat' }, { key: 'scategoryId', label: 'S-Cat' }, { key: 'mscategoryId', label: 'MS-Cat' }, { key: 'mandatory', label: 'Mandatory', type: 'checkbox' }]
                  : screen === 'attachment-scategory'
                    ? [{ key: 'order', label: 'Order' }, { key: 'name', label: 'Attachment Title' }]
                    : [{ key: 'order', label: 'Order' }, { key: 'name', label: 'Name' }, { key: 'shortName', label: 'Short' }]
          }
          onChange={updateRow}
          onAdd={() => setRows((p) => [...p, screen === 'attachment-scategory' ? { name: '', order: p.length + 1 } : {}])}
          onReorder={screen === 'attachment-scategory' ? setRows : undefined}
          onDelete={(i) => {
            const row = rows[i];
            if (screen === 'attachment-scategory' && row.id) {
              onSave({ action: 'delete', id: row.id, mainCategoryId: data?.selectedMainId, subCategoryId: data?.selectedSubId });
            } else {
              setRows((p) => p.filter((_, j) => j !== i));
            }
          }}
          actions={<button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Update</button>}
        />
        )}
      </form>
    );
  }

  if (screen === 'designation-edit') {
    return (
      <div className="row g-3">
        <div className="col-lg-3">
          <StaffSearchPanel
            layout="sidebar"
            results={searchResults}
            selected={selectedStaff || data?.staff}
            onSearch={async (q) => {
              const res = await searchMore(q);
              setSearchResults(Array.isArray(res) ? res : res?.staff || []);
            }}
            onSelect={(r) => { setSelectedStaff(r); onLoad({ staffId: r.id }); }}
          />
        </div>
        <div className="col-lg-9">
          <DesignationEditForm
            staff={data?.staff || selectedStaff}
            departments={data?.departments}
            designations={data?.designations}
            rows={rows}
            setRows={setRows}
            busy={busy}
            onSave={onSave}
            updateRow={updateRow}
            patchRow={patchRow}
          />
        </div>
      </div>
    );
  }

  if (screen === 'transport-setup') {
    return (
      <div>
        <StaffSearchPanel
          results={searchResults}
          selected={selectedStaff}
          onSearch={async (q) => {
            const res = await searchMore(q);
            setSearchResults(Array.isArray(res) ? res : res?.staff || []);
          }}
          onSelect={(r) => { setSelectedStaff(r); onLoad({ staffId: r.id }); }}
        />
        {selectedStaff && (
          <form onSubmit={(e) => {
            e.preventDefault();
            onSave({ staffId: selectedStaff.id, trips: rows });
          }}>
            <p className="mb-2"><strong>{selectedStaff.name}</strong> <span className="text-muted">({selectedStaff.staffId})</span></p>
            <TransportTripRows
              rows={rows}
              transports={data?.transports}
              stops={data?.stops}
              onChange={updateRow}
              onPatch={patchRow}
              onAdd={() => setRows((p) => [...p, { busNo: '', tripNo: '', stopName: '', journeyUp: false, journeyDown: false, enabled: true, discontinued: false, discDate: '' }])}
            />
            <button type="submit" className="btn btn-danger mt-2" disabled={busy}>Update</button>
          </form>
        )}
      </div>
    );
  }

  return <p className="text-muted">Setup screen ready.</p>;
}

export default function StaffSetupPage() {
  const { screen: paramScreen } = useParams();
  const location = useLocation();
  const screen = paramScreen || (location.pathname.endsWith('/login-help') ? 'login-help' : paramScreen);
  const meta = STAFF_SETUP_META[screen];
  const { data, busy, error, notice, clearNotice, load, save, searchMore } = useStaffSetupApi(screen);
  const { settings, menu } = useOutletContext();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!meta) { setReady(true); return; }
    const initialStaffId = location.state?.staffId;
    const promise = initialStaffId ? load({ staffId: initialStaffId }) : load();
    promise.finally(() => setReady(true));
  }, [meta, load, location.state?.staffId]);

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Staff"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Staff', to: '/staff/hub' },
          { label: 'Unknown' },
        ]}
        backTo="/staff/hub"
      >
        <p className="text-danger mb-0">Unknown staff setup screen.</p>
      </SetupPageShell>
    );
  }

  return (
    <SetupPageShell
      settings={settings}
      menu={menu}
      title={meta.title}
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Staff', to: '/staff/hub' },
        { label: meta.title },
      ]}
      backTo="/staff/hub"
      loading={!ready}
      alerts={(
        <SetupAlerts
          notice={notice}
          error={error}
          busy={busy}
          onDismissNotice={clearNotice}
        />
      )}
    >
      <SetupBody screen={screen} data={data} busy={busy} onLoad={load} onSave={save} searchMore={searchMore} />
    </SetupPageShell>
  );
}

import { useEffect, useState } from 'react';
import { DragHandle, useDragReorder } from '../../../hooks/useDragReorder';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toCssColor(hex) {
  const raw = String(hex || '').replace(/^#/, '').trim();
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw}`;
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`;
  }
  return null;
}

function contrastingTextColor(hex) {
  const raw = String(hex || '').replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{3,6}$/.test(raw)) return '#212529';
  const full = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#212529' : '#ffffff';
}

function ColorInput({ value, onChange, disabled }) {
  const cssColor = toCssColor(value);
  return (
    <input
      className="form-control form-control-sm tv-color-code-input"
      style={{
        width: 84,
        backgroundColor: cssColor || '#f8f9fa',
        color: cssColor ? contrastingTextColor(value) : '#6c757d',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}
      maxLength={7}
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/^#/, '').toUpperCase())}
    />
  );
}
function ListEditor({ items, fields, onSave, busy, readOnly }) {
  const [form, setForm] = useState({});
  useEffect(() => { if (items?.[0]) setForm(items[0]); }, [items]);
  return (
    <div className="row g-3">
      <div className="col-md-4">
        <div className="list-group">
          {(items || []).map((item) => (
            <button key={item.id} type="button" className="list-group-item list-group-item-action" onClick={() => setForm(item)}>
              {item.name || item.widgetName || item.attachment || item.username || `#${item.id}`}
            </button>
          ))}
        </div>
      </div>
      <div className="col-md-8">
        <form onSubmit={(e) => { e.preventDefault(); if (!readOnly) onSave({ ...form, id: form.id }); }}>
          {fields.map((f) => (
            <div key={f.key} className="mb-2">
              <label className="form-label">{f.label}</label>
              {f.type === 'textarea'
                ? <textarea className="form-control" rows={f.rows || 3} value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} disabled={readOnly} />
                : <input className="form-control" type={f.type || 'text'} value={form[f.key] || ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} disabled={readOnly} />}
            </div>
          ))}
          {!readOnly && <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>}
        </form>
      </div>
    </div>
  );
}

function UserPicker({ users, userId, onChange }) {
  return (
    <div className="mb-3" style={{ maxWidth: 480 }}>
      <label className="form-label">Select user</label>
      <select className="form-select" value={userId || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {(users || []).map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
    </div>
  );
}

export function TvSliderWidgetScreen({ data, busy, onLoad, onSave }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  return <ListEditor items={data?.widgets} busy={busy} onSave={onSave} fields={[
    { key: 'name', label: 'Widget name' },
    { key: 'content', label: 'Content', type: 'textarea', rows: 6 },
    { key: 'bgImage', label: 'Background image' },
    { key: 'bgColor', label: 'Background color' },
    { key: 'slideEffect', label: 'Effect' },
    { key: 'slideDelay', label: 'Delay (ms)' },
  ]} />;
}

export function TvSliderConfigScreen({ data, busy, onSave }) {
  const [widgets, setWidgets] = useState([]);
  const [pendingFiles, setPendingFiles] = useState({});

  useEffect(() => {
    if (data?.widgets) setWidgets(data.widgets);
  }, [data]);

  const updateRow = (index, patch) => {
    setWidgets((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleBgFile = async (index, file) => {
    if (!file) return;
    const id = widgets[index]?.id;
    if (!id) return;
    const dataUrl = await readFileAsBase64(file);
    setPendingFiles((prev) => ({
      ...prev,
      [id]: { field: `bgImage_${id}`, name: file.name, data: dataUrl },
    }));
    updateRow(index, { bgImage: file.name, removeBgImage: false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const files = Object.values(pendingFiles);
    const result = await onSave({ widgets }, files);
    if (result?.success !== false) setPendingFiles({});
  };

  if (!data) return null;

  return (
    <form className="cis-setup-form" onSubmit={handleSubmit}>
      <div className="table-responsive">
        <table className="table table-bordered table-sm align-middle tv-slider-config-table">
          <thead className="table-light">
            <tr>
              <th rowSpan={2}>S.no</th>
              <th rowSpan={2}>Widget</th>
              <th rowSpan={2}>Effects</th>
              <th rowSpan={2}>Time (sec)</th>
              <th rowSpan={2}>BG Image</th>
              <th rowSpan={2} className="text-center">Bg Color</th>
              <th colSpan={2} className="text-center">Title</th>
              <th colSpan={2} className="text-center">Sub Title</th>
              <th colSpan={2} className="text-center">Content</th>
              <th colSpan={2} className="text-center">Sub Content</th>
            </tr>
            <tr>
              <th>Color</th>
              <th>Size (px)</th>
              <th>Color</th>
              <th>Size (px)</th>
              <th>Color</th>
              <th>Size (px)</th>
              <th>Color</th>
              <th>Size (px)</th>
            </tr>
          </thead>
          <tbody>
            {widgets.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td className="text-nowrap">{row.name}</td>
                <td style={{ minWidth: 220 }}>
                  <select
                    className="form-select form-select-sm"
                    value={row.slideEffect || ''}
                    disabled={busy}
                    onChange={(e) => updateRow(index, { slideEffect: e.target.value })}
                  >
                    {(data.slideEffects || []).map((group) => (
                      <optgroup key={group.group} label={group.group}>
                        {group.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    style={{ width: 70 }}
                    maxLength={7}
                    value={row.slideDelay || ''}
                    disabled={busy}
                    onChange={(e) => updateRow(index, { slideDelay: e.target.value })}
                  />
                </td>
                <td style={{ minWidth: 180 }}>
                  <input
                    type="file"
                    className="form-control form-control-sm mb-1"
                    accept="image/*"
                    disabled={busy}
                    onChange={(e) => handleBgFile(index, e.target.files?.[0])}
                  />
                  {row.bgImage && (
                    <div className="small">
                      {row.bgImageUrl && (
                        <a href={row.bgImageUrl} target="_blank" rel="noreferrer">View</a>
                      )}
                      {' / '}
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        disabled={busy}
                        onClick={() => {
                          setPendingFiles((prev) => {
                            const next = { ...prev };
                            delete next[row.id];
                            return next;
                          });
                          updateRow(index, { bgImage: '', removeBgImage: true });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </td>
                <td><ColorInput value={row.bgColor} disabled={busy} onChange={(v) => updateRow(index, { bgColor: v })} /></td>
                <td><ColorInput value={row.titleColor} disabled={busy} onChange={(v) => updateRow(index, { titleColor: v })} /></td>
                <td>
                  <input className="form-control form-control-sm" style={{ width: 56 }} maxLength={3} value={row.titleSize || ''} disabled={busy} onChange={(e) => updateRow(index, { titleSize: e.target.value })} />
                </td>
                <td><ColorInput value={row.stitleColor} disabled={busy} onChange={(v) => updateRow(index, { stitleColor: v })} /></td>
                <td>
                  <input className="form-control form-control-sm" style={{ width: 56 }} maxLength={3} value={row.stitleSize || ''} disabled={busy} onChange={(e) => updateRow(index, { stitleSize: e.target.value })} />
                </td>
                <td><ColorInput value={row.textColor} disabled={busy} onChange={(v) => updateRow(index, { textColor: v })} /></td>
                <td>
                  <input className="form-control form-control-sm" style={{ width: 56 }} maxLength={3} value={row.textSize || ''} disabled={busy} onChange={(e) => updateRow(index, { textSize: e.target.value })} />
                </td>
                <td><ColorInput value={row.stextColor} disabled={busy} onChange={(v) => updateRow(index, { stextColor: v })} /></td>
                <td>
                  <input className="form-control form-control-sm" style={{ width: 56 }} maxLength={3} value={row.stextSize || ''} disabled={busy} onChange={(e) => updateRow(index, { stextSize: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="submit" className="btn btn-danger" disabled={busy || widgets.length === 0}>Save</button>
    </form>
  );
}

export function TvAccessScreen({ data, busy, onLoad, onSave }) {
  const [userId, setUserId] = useState('');
  const [widgets, setWidgets] = useState([]);

  useEffect(() => {
    if (data?.userId) setUserId(String(data.userId));
    if (data?.widgets) setWidgets(data.widgets);
  }, [data]);

  const pickUser = async (id) => {
    setUserId(id);
    if (!id) {
      setWidgets([]);
      return;
    }
    await onLoad({ userId: id });
  };

  if (!data) return null;

  return (
    <div>
      <UserPicker users={data.users} userId={userId} onChange={pickUser} />
      {userId && (
        <form className="cis-setup-form" onSubmit={(e) => { e.preventDefault(); onSave({ userId, widgets }); }}>
          {widgets.length > 0 ? (
            <>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy}
                  onClick={() => setWidgets((rows) => rows.map((w) => ({ ...w, enabled: true })))}
                >
                  Check all
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy}
                  onClick={() => setWidgets((rows) => rows.map((w, i) => ({ ...w, order: i + 1 })))}
                >
                  Fill default
                </button>
              </div>
              <table className="table table-bordered table-sm">
                <thead><tr><th>Enable</th><th>Order</th><th>Widget</th></tr></thead>
                <tbody>
                  {widgets.map((w, i) => (
                    <tr key={w.widgetId}>
                      <td><input type="checkbox" checked={w.enabled} disabled={busy} onChange={(e) => setWidgets(widgets.map((row, j) => (j === i ? { ...row, enabled: e.target.checked } : row)))} /></td>
                      <td><input className="form-control form-control-sm" style={{ width: 70 }} value={w.order} disabled={busy} onChange={(e) => setWidgets(widgets.map((row, j) => (j === i ? { ...row, order: e.target.value } : row)))} /></td>
                      <td>{w.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-muted">No TV widgets are configured in Slider Widget setup.</p>
          )}
          <button type="submit" className="btn btn-danger" disabled={busy || widgets.length === 0}>Save access</button>
        </form>
      )}
    </div>
  );
}

export function TvSliderAccessScreen({ data, busy, onLoad, onSave }) {
  const [userId, setUserId] = useState('');
  const [rows, setRows] = useState([]);
  const { dragHandleProps, rowDropProps, rowClassName } = useDragReorder(rows, setRows);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.userId) setUserId(String(data.userId));
    if (data?.rows) setRows(data.rows);
  }, [data]);

  const pickUser = async (id) => {
    setUserId(id);
    await onLoad({ userId: id });
  };

  const deleteRow = (i) => {
    const row = rows[i];
    if (row.rowId) onSave({ action: 'delete', rowId: row.rowId, userId });
    else setRows((p) => p.filter((_, j) => j !== i));
  };

  return (
    <div>
      <UserPicker users={data?.users} userId={userId} onChange={pickUser} />
      {userId && (
        <form className="cis-setup-form" onSubmit={(e) => { e.preventDefault(); onSave({ userId, rows }); }}>
          <table className="table table-bordered table-sm">
            <thead><tr><th style={{ width: '2rem' }} aria-hidden="true" /><th>Order</th><th>Widget</th><th>From</th><th>To</th><th>Active</th><th className="text-end" style={{ width: '1%' }} /></tr></thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.rowId || `new-${i}`} className={rowClassName(i)} {...rowDropProps(i)}>
                  <td className="text-center"><DragHandle {...dragHandleProps(i)} /></td>
                  <td><input className="form-control form-control-sm" value={row.order} readOnly disabled title="Drag the row's handle to reorder" /></td>
                  <td>
                    <select className="form-select form-select-sm" value={row.widgetKey} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, widgetKey: e.target.value } : r)))}>
                      <option value="">-- Select --</option>
                      {(data?.widgetOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td><input className="form-control form-control-sm" value={row.fromTime} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, fromTime: e.target.value } : r)))} /></td>
                  <td><input className="form-control form-control-sm" value={row.toTime} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, toTime: e.target.value } : r)))} /></td>
                  <td><input type="checkbox" checked={row.active} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, active: e.target.checked } : r)))} /></td>
                  <td className="text-end">
                    <button type="button" className="btn btn-sm btn-outline-danger" title="Delete row" onClick={() => deleteRow(i)}>
                      <i className="fa fa-trash" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRows([...rows, { rowId: null, widgetKey: '', order: rows.length + 1, fromTime: '00:00', toTime: '23:59', active: true }])}>Add row</button>
            <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Save</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function TvVideoScreen({ data, busy, onLoad, onSave }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  return <ListEditor items={data?.videos} busy={busy} onSave={onSave} fields={[
    { key: 'attachment', label: 'Video URL/path' },
    { key: 'fromTime', label: 'From' },
    { key: 'toTime', label: 'To' },
  ]} />;
}

export function TvYoutubeScreen({ data, busy, onLoad, onSave }) {
  const [videos, setVideos] = useState([]);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.videos) setVideos(data.videos); }, [data]);

  return (
    <form className="cis-setup-form" onSubmit={(e) => { e.preventDefault(); onSave({ videos }); }}>
      <table className="table table-bordered">
        <thead><tr><th>#</th><th>YouTube ID</th></tr></thead>
        <tbody>
          {videos.map((v, i) => (
            <tr key={v.id}>
              <td>{v.id}</td>
              <td>
                <div className="input-group">
                  <span className="input-group-text">youtube.com/watch?v=</span>
                  <input className="form-control" value={v.youtubeId} onChange={(e) => setVideos(videos.map((row, j) => (j === i ? { ...row, youtubeId: e.target.value } : row)))} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="submit" className="btn btn-danger" disabled={busy}>Save YouTube IDs</button>
    </form>
  );
}

export function TvLiveVideoScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  const [imageFile, setImageFile] = useState(null);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm(data.form); }, [data]);

  const filePayload = async (file, field) => {
    const fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { field, name: file.name, data: fileData };
  };

  return (
    <form className="cis-setup-form" onSubmit={async (e) => {
      e.preventDefault();
      const files = imageFile ? [await filePayload(imageFile, 'wImage')] : [];
      await onSave(form, files);
    }}>
      <div className="row g-3">
        <div className="col-md-8"><label className="form-label">Event title</label><input className="form-control" value={form.eventTitle || ''} onChange={(e) => setForm({ ...form, eventTitle: e.target.value })} /></div>
        <div className="col-md-4"><label className="form-label">Direct live</label><div><input type="checkbox" checked={form.directLive} onChange={(e) => setForm({ ...form, directLive: e.target.checked })} /></div></div>
        <div className="col-md-6"><label className="form-label">From</label><input type="datetime-local" className="form-control" value={(form.fromTimestamp || '').replace(' ', 'T').slice(0, 16)} onChange={(e) => setForm({ ...form, fromTimestamp: e.target.value })} /></div>
        <div className="col-md-6"><label className="form-label">To</label><input type="datetime-local" className="form-control" value={(form.toTimestamp || '').replace(' ', 'T').slice(0, 16)} onChange={(e) => setForm({ ...form, toTimestamp: e.target.value })} /></div>
        <div className="col-12"><label className="form-label">Player widget (HTML)</label><textarea className="form-control" rows={4} value={form.playerWidget || ''} onChange={(e) => setForm({ ...form, playerWidget: e.target.value })} /></div>
        <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="col-md-6"><label className="form-label">Background image</label><input type="file" accept="image/*" className="form-control" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />{form.wImage && <small className="text-muted">Current: {form.wImage}</small>}</div>
        <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Save live settings</button></div>
      </div>
    </form>
  );
}

export function TvPrintStyleScreen({ data, busy, onLoad, onSave }) {
  const [content, setContent] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.content != null) setContent(data.content); }, [data]);

  return (
    <form className="cis-setup-form" onSubmit={(e) => { e.preventDefault(); onSave({ content }); }}>
      <label className="form-label">tv/css/style.css</label>
      <textarea className="form-control font-monospace" rows={20} value={content} onChange={(e) => setContent(e.target.value)} />
      <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Save CSS</button>
    </form>
  );
}

function GalleryEditor({ data, busy, onLoad, onSave, itemKey, itemLabel, showTimes }) {
  const [galleryId, setGalleryId] = useState('');
  const [form, setForm] = useState({ title: '', fromDate: '', toDate: '' });
  const [items, setItems] = useState([]);
  const [photoFiles, setPhotoFiles] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.galleryId) setGalleryId(String(data.galleryId));
    if (data?.detail) {
      setForm({ title: data.detail.title, fromDate: data.detail.fromDate, toDate: data.detail.toDate });
      setItems(data.detail[itemKey] || []);
    }
  }, [data, itemKey]);

  const pick = async (id) => {
    setGalleryId(id);
    await onLoad({ galleryId: id });
  };

  const filePayload = async (file, field) => {
    const fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { field, name: file.name, data: fileData };
  };

  return (
    <div className="row g-3">
      <div className="col-md-3">
        <div className="list-group mb-2">
          <button type="button" className="list-group-item list-group-item-action" onClick={() => { setGalleryId(''); setForm({ title: '', fromDate: '', toDate: '' }); setItems([]); }}>+ New gallery</button>
          {(data?.galleries || []).map((g) => (
            <button key={g.id} type="button" className={`list-group-item list-group-item-action ${String(g.id) === galleryId ? 'active' : ''}`} onClick={() => pick(String(g.id))}>{g.title}</button>
          ))}
        </div>
      </div>
      <div className="col-md-9">
        <form className="cis-setup-form" onSubmit={async (e) => {
          e.preventDefault();
          const files = [];
          let payloadItems = items;
          if (!showTimes && photoFiles.length) {
            payloadItems = photoFiles.map((_, i) => ({ order: i + 1, ...(items[i] || {}) }));
            for (let i = 0; i < photoFiles.length; i++) {
              if (photoFiles[i]) files.push(await filePayload(photoFiles[i], `photo_${i}`));
            }
          }
          await onSave({ galleryId: galleryId || undefined, ...form, [itemKey]: payloadItems }, files);
        }}>
          <div className="row g-2 mb-3">
            <div className="col-md-6"><input className="form-control" placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="col-md-3"><input type="datetime-local" className="form-control" value={(form.fromDate || '').replace(' ', 'T').slice(0, 16)} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></div>
            <div className="col-md-3"><input type="datetime-local" className="form-control" value={(form.toDate || '').replace(' ', 'T').slice(0, 16)} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
          </div>
          {!showTimes && (
            <div className="mb-3">
              <input type="file" accept="image/*" multiple className="form-control" onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))} />
            </div>
          )}
          {showTimes && (
            <table className="table table-sm table-bordered mb-3">
              <thead><tr><th>Order</th><th>{itemLabel}</th><th>From</th><th>To</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id || `new-${i}`}>
                    <td><input className="form-control form-control-sm" value={item.order} onChange={(e) => setItems(items.map((r, j) => (j === i ? { ...r, order: e.target.value } : r)))} /></td>
                    <td><input className="form-control form-control-sm" value={item.apiUrl} onChange={(e) => setItems(items.map((r, j) => (j === i ? { ...r, apiUrl: e.target.value } : r)))} /></td>
                    <td><input className="form-control form-control-sm" value={item.fromTime} onChange={(e) => setItems(items.map((r, j) => (j === i ? { ...r, fromTime: e.target.value } : r)))} /></td>
                    <td><input className="form-control form-control-sm" value={item.toTime} onChange={(e) => setItems(items.map((r, j) => (j === i ? { ...r, toTime: e.target.value } : r)))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {showTimes && (
            <button type="button" className="btn btn-outline-secondary btn-sm mb-3" onClick={() => setItems([...items, { apiUrl: '', order: items.length + 1, fromTime: '', toTime: '' }])}>Add API row</button>
          )}
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            {galleryId && <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => onSave({ action: 'delete', galleryId })}>Delete</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

export function TvPhotoGalleryScreen(props) {
  return <GalleryEditor {...props} itemKey="photos" itemLabel="Image" showTimes={false} />;
}

export function TvApiGalleryScreen(props) {
  return <GalleryEditor {...props} itemKey="items" itemLabel="API URL" showTimes />;
}

import { useEffect, useMemo, useState } from 'react';

function formFieldsFromDom(formEl, state) {
  const fd = new FormData(formEl);
  const fromForm = {};
  for (const [key, value] of fd.entries()) {
    if (value instanceof File) continue;
    fromForm[key] = value;
  }
  return { ...state, ...fromForm };
}

function buildGridHtml(rows, cols) {
  const rowCount = Math.max(1, Number(rows) || 1);
  const colCount = Math.max(1, Number(cols) || 1);
  const hR1 = Math.ceil(rowCount / 2) - 1;
  const hR2 = Math.floor(rowCount / 2);
  const hC1 = Math.ceil(colCount / 2) - 1;
  const hC2 = Math.floor(colCount / 2);
  let html = '<table border="0" cellspacing="0" cellpadding="0" class="table table-bordered cis-collage-grid-table"><tbody>';
  let cell = 1;
  for (let r = 0; r < rowCount; r += 1) {
    html += '<tr>';
    for (let c = 0; c < colCount; c += 1) {
      const highlight = (r === hR1 || r === hR2) && (c === hC1 || c === hC2);
      html += `<td width="22" height="22" class="cis-collage-grid-cell${highlight ? ' is-merge-hint' : ''}">${cell}</td>`;
      cell += 1;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function CollageFieldRow({ label, children }) {
  return (
    <tr>
      <td className="cis-collage-label">{label}</td>
      <td>{children}</td>
    </tr>
  );
}

export default function CollageGeneratePanel({ data, busy, onGenerate }) {
  const defaults = data?.defaults || {};
  const [fields, setFields] = useState(defaults);
  const [localMessage, setLocalMessage] = useState('');
  const set = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (data?.defaults) setFields((prev) => ({ ...data.defaults, ...prev }));
  }, [data?.defaults]);

  const gridHtml = useMemo(
    () => buildGridHtml(fields.row_count, fields.column_count),
    [fields.row_count, fields.column_count],
  );

  const templates = data?.templates || [];

  return (
    <div className="row g-3">
      <div className="col-lg-4">
        <div className="card cis-student-screen-card">
          <div className="card-body">
            <div className="cis-student-filter-heading mb-3">Filter</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const payload = { ...formFieldsFromDom(e.currentTarget, fields), Search: 'Search' };
                if (!payload.name_enable) payload.name_enable = false;
                if (!payload.m_name_enable) payload.m_name_enable = false;
                const ids = String(payload.search_by_a_no || '').trim();
                if (!ids) {
                  setLocalMessage('Enter register / staff numbers (comma separated).');
                  return;
                }
                setLocalMessage('');
                onGenerate(payload);
              }}
            >
              <table className="table table-sm cis-collage-filter-table mb-3">
                <tbody>
                  <tr><td colSpan={2}><strong>Display</strong></td></tr>
                  <CollageFieldRow label="RxC,M">
                    <div className="d-flex gap-1 flex-wrap">
                      <input name="row_count" className="form-control form-control-sm cis-collage-mini" value={fields.row_count || ''} onChange={(e) => set('row_count', e.target.value)} placeholder="Row" />
                      <input name="column_count" className="form-control form-control-sm cis-collage-mini" value={fields.column_count || ''} onChange={(e) => set('column_count', e.target.value)} placeholder="Column" />
                      <input name="photo_margin" className="form-control form-control-sm cis-collage-mini" value={fields.photo_margin || ''} onChange={(e) => set('photo_margin', e.target.value)} placeholder="Margin" />
                    </div>
                  </CollageFieldRow>
                  <tr><td colSpan={2}><strong>Photo</strong></td></tr>
                  <CollageFieldRow label="Reg / Staff No">
                    <input name="search_by_a_no" className="form-control form-control-sm" value={fields.search_by_a_no || ''} onChange={(e) => set('search_by_a_no', e.target.value)} placeholder="e.g. 2021006, 14640" />
                  </CollageFieldRow>
                  <CollageFieldRow label="WxH,BG">
                    <div className="d-flex gap-1 flex-wrap">
                      <input name="photo_width" className="form-control form-control-sm cis-collage-mini" value={fields.photo_width || ''} onChange={(e) => set('photo_width', e.target.value)} />
                      <input name="photo_height" className="form-control form-control-sm cis-collage-mini" value={fields.photo_height || ''} onChange={(e) => set('photo_height', e.target.value)} />
                      <input name="photo_bgcolor" className="form-control form-control-sm cis-collage-mini" value={fields.photo_bgcolor || ''} onChange={(e) => set('photo_bgcolor', e.target.value)} />
                    </div>
                  </CollageFieldRow>
                  <CollageFieldRow label="Name">
                    <div className="d-flex gap-1 flex-wrap align-items-center">
                      <input type="checkbox" name="name_enable" value="1" checked={fields.name_enable === '1' || fields.name_enable === true} onChange={(e) => set('name_enable', e.target.checked ? '1' : false)} />
                      <input name="name_size" className="form-control form-control-sm cis-collage-mini" value={fields.name_size || ''} onChange={(e) => set('name_size', e.target.value)} />
                      <input name="name_height" className="form-control form-control-sm cis-collage-mini" value={fields.name_height || ''} onChange={(e) => set('name_height', e.target.value)} />
                      <input name="name_color" className="form-control form-control-sm cis-collage-mini" value={fields.name_color || ''} onChange={(e) => set('name_color', e.target.value)} />
                    </div>
                  </CollageFieldRow>
                  <CollageFieldRow label="Template">
                    <select name="template_id" className="form-select form-select-sm" value={fields.template_id || ''} onChange={(e) => set('template_id', e.target.value)}>
                      <option value="">None</option>
                      {templates.map((tpl) => <option key={tpl.value} value={tpl.value}>{tpl.label}</option>)}
                    </select>
                  </CollageFieldRow>
                  <tr><td colSpan={2}><strong>Merge</strong></td></tr>
                  <CollageFieldRow label="A.No">
                    <input name="merge_a_no" className="form-control form-control-sm" value={fields.merge_a_no || ''} onChange={(e) => set('merge_a_no', e.target.value)} placeholder="2356,4323" />
                  </CollageFieldRow>
                  <CollageFieldRow label="Merge Box">
                    <input name="merge_box" className="form-control form-control-sm" value={fields.merge_box || ''} onChange={(e) => set('merge_box', e.target.value)} placeholder="Eg: (15,16,21,22)" />
                    <div className="form-text">Merged cells show one larger photo. Set WxH below (legacy: 510 x 500 for a 2x2 merge).</div>
                  </CollageFieldRow>
                  <CollageFieldRow label="WxH,BG">
                    <div className="d-flex gap-1 flex-wrap">
                      <input name="m_width" className="form-control form-control-sm cis-collage-mini" value={fields.m_width || ''} onChange={(e) => set('m_width', e.target.value)} />
                      <input name="m_height" className="form-control form-control-sm cis-collage-mini" value={fields.m_height || ''} onChange={(e) => set('m_height', e.target.value)} />
                      <input name="m_bgcolor" className="form-control form-control-sm cis-collage-mini" value={fields.m_bgcolor || ''} onChange={(e) => set('m_bgcolor', e.target.value)} />
                    </div>
                  </CollageFieldRow>
                  <CollageFieldRow label="Name">
                    <div className="d-flex gap-1 flex-wrap align-items-center">
                      <input type="checkbox" name="m_name_enable" value="1" checked={fields.m_name_enable === '1' || fields.m_name_enable === true} onChange={(e) => set('m_name_enable', e.target.checked ? '1' : false)} />
                      <input name="m_name_size" className="form-control form-control-sm cis-collage-mini" value={fields.m_name_size || ''} onChange={(e) => set('m_name_size', e.target.value)} />
                      <input name="m_name_height" className="form-control form-control-sm cis-collage-mini" value={fields.m_name_height || ''} onChange={(e) => set('m_name_height', e.target.value)} />
                      <input name="m_name_color" className="form-control form-control-sm cis-collage-mini" value={fields.m_name_color || ''} onChange={(e) => set('m_name_color', e.target.value)} />
                    </div>
                  </CollageFieldRow>
                  <CollageFieldRow label="Template">
                    <select name="m_template_id" className="form-select form-select-sm" value={fields.m_template_id || ''} onChange={(e) => set('m_template_id', e.target.value)}>
                      <option value="">None</option>
                      {templates.map((tpl) => <option key={`m-${tpl.value}`} value={tpl.value}>{tpl.label}</option>)}
                    </select>
                  </CollageFieldRow>
                </tbody>
              </table>
              <button type="submit" className="btn btn-primary w-100" disabled={busy}>Search</button>
              {(localMessage || data?.validationMessage) && (
                <p className="text-danger small mt-2 mb-0">{localMessage || data.validationMessage}</p>
              )}
            </form>
          </div>
        </div>
      </div>

      <div className="col-lg-8">
        <div className="card cis-student-screen-card mb-3">
          <div className="card-body">
            <div className="mb-3" dangerouslySetInnerHTML={{ __html: gridHtml }} />
            {data?.outputUrl ? (
              <img src={data.outputUrl} alt="Collage output" className="img-fluid cis-collage-output-image" />
            ) : (
              <p className="text-muted mb-0">Configure the grid and click Search to generate the collage.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

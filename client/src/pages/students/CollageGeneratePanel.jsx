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

function Swatch({ value }) {
  const hex = String(value || '').replace(/^#/, '');
  const valid = /^[0-9a-fA-F]{3,8}$/.test(hex);
  return (
    <span
      className="cis-collage-swatch"
      style={valid ? { background: `#${hex}` } : undefined}
      aria-hidden="true"
      title={valid ? `#${hex}` : 'Enter a hex colour'}
    />
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

  // One captioned input in a multi-value row.
  const Num = ({ name, cap, wide = false }) => (
    <label className={`cis-collage-input${wide ? ' is-wide' : ''}`}>
      <span className="cis-collage-cap">{cap}</span>
      <input
        name={name}
        className="form-control form-control-sm"
        value={fields[name] || ''}
        onChange={(e) => set(name, e.target.value)}
      />
    </label>
  );

  const nameOn = fields.name_enable === '1' || fields.name_enable === true;
  const mNameOn = fields.m_name_enable === '1' || fields.m_name_enable === true;

  return (
    <div className="row g-3">
      <div className="col-lg-5">
        <div className="card cis-student-screen-card">
          <div className="card-body">
            <form
              className="cis-collage-form"
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
              {/* ── Grid layout ── */}
              <div className="cis-collage-section">
                <p className="cis-collage-section-title">Grid layout</p>
                <div className="cis-collage-field">
                  <span className="cis-collage-field-label">Rows × Columns, margin</span>
                  <div className="cis-collage-inputs">
                    <Num name="row_count" cap="Rows" />
                    <Num name="column_count" cap="Columns" />
                    <Num name="photo_margin" cap="Margin (px)" />
                  </div>
                </div>
              </div>

              {/* ── Photos ── */}
              <div className="cis-collage-section">
                <p className="cis-collage-section-title">Photos</p>
                <div className="cis-collage-field">
                  <label className="cis-collage-field-label" htmlFor="collage-regs">Register / staff numbers</label>
                  <input
                    id="collage-regs"
                    name="search_by_a_no"
                    className="form-control form-control-sm"
                    value={fields.search_by_a_no || ''}
                    onChange={(e) => set('search_by_a_no', e.target.value)}
                    placeholder="e.g. 2021006, 14640"
                  />
                  <div className="form-text">Comma-separated. These fill the grid in order.</div>
                </div>
                <div className="cis-collage-field">
                  <span className="cis-collage-field-label">Photo size &amp; background</span>
                  <div className="cis-collage-inputs">
                    <Num name="photo_width" cap="Width" />
                    <Num name="photo_height" cap="Height" />
                    <label className="cis-collage-input">
                      <span className="cis-collage-cap">Background</span>
                      <div className="cis-collage-color">
                        <Swatch value={fields.photo_bgcolor} />
                        <input name="photo_bgcolor" className="form-control form-control-sm" value={fields.photo_bgcolor || ''} onChange={(e) => set('photo_bgcolor', e.target.value)} placeholder="FFFFFF" />
                      </div>
                    </label>
                  </div>
                </div>
                <div className="cis-collage-field">
                  <label className="cis-collage-toggle">
                    <input type="checkbox" name="name_enable" value="1" checked={nameOn} onChange={(e) => set('name_enable', e.target.checked ? '1' : false)} />
                    <span>Show name under each photo</span>
                  </label>
                  {nameOn && (
                    <div className="cis-collage-inputs mt-2">
                      <Num name="name_size" cap="Font size" />
                      <Num name="name_height" cap="Line height" />
                      <label className="cis-collage-input">
                        <span className="cis-collage-cap">Text colour</span>
                        <div className="cis-collage-color">
                          <Swatch value={fields.name_color} />
                          <input name="name_color" className="form-control form-control-sm" value={fields.name_color || ''} onChange={(e) => set('name_color', e.target.value)} placeholder="333333" />
                        </div>
                      </label>
                    </div>
                  )}
                </div>
                <div className="cis-collage-field">
                  <label className="cis-collage-field-label" htmlFor="collage-tpl">Template</label>
                  <select id="collage-tpl" name="template_id" className="form-select form-select-sm" value={fields.template_id || ''} onChange={(e) => set('template_id', e.target.value)}>
                    <option value="">None</option>
                    {templates.map((tpl) => <option key={tpl.value} value={tpl.value}>{tpl.label}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Merged cells (optional) ── */}
              <div className="cis-collage-section">
                <p className="cis-collage-section-title">Merged cells <span className="cis-collage-optional">optional</span></p>
                <div className="cis-collage-field">
                  <label className="cis-collage-field-label" htmlFor="collage-merge-a">Photos for merged area</label>
                  <input id="collage-merge-a" name="merge_a_no" className="form-control form-control-sm" value={fields.merge_a_no || ''} onChange={(e) => set('merge_a_no', e.target.value)} placeholder="2356, 4323" />
                </div>
                <div className="cis-collage-field">
                  <label className="cis-collage-field-label" htmlFor="collage-merge-box">Cells to merge</label>
                  <input id="collage-merge-box" name="merge_box" className="form-control form-control-sm" value={fields.merge_box || ''} onChange={(e) => set('merge_box', e.target.value)} placeholder="e.g. 15,16,21,22" />
                  <div className="form-text">Shaded cells in the preview show one larger photo. Legacy: 510 × 500 for a 2×2 merge.</div>
                </div>
                <div className="cis-collage-field">
                  <span className="cis-collage-field-label">Merged photo size &amp; background</span>
                  <div className="cis-collage-inputs">
                    <Num name="m_width" cap="Width" />
                    <Num name="m_height" cap="Height" />
                    <label className="cis-collage-input">
                      <span className="cis-collage-cap">Background</span>
                      <div className="cis-collage-color">
                        <Swatch value={fields.m_bgcolor} />
                        <input name="m_bgcolor" className="form-control form-control-sm" value={fields.m_bgcolor || ''} onChange={(e) => set('m_bgcolor', e.target.value)} placeholder="FFFFFF" />
                      </div>
                    </label>
                  </div>
                </div>
                <div className="cis-collage-field">
                  <label className="cis-collage-toggle">
                    <input type="checkbox" name="m_name_enable" value="1" checked={mNameOn} onChange={(e) => set('m_name_enable', e.target.checked ? '1' : false)} />
                    <span>Show name under merged photo</span>
                  </label>
                  {mNameOn && (
                    <div className="cis-collage-inputs mt-2">
                      <Num name="m_name_size" cap="Font size" />
                      <Num name="m_name_height" cap="Line height" />
                      <label className="cis-collage-input">
                        <span className="cis-collage-cap">Text colour</span>
                        <div className="cis-collage-color">
                          <Swatch value={fields.m_name_color} />
                          <input name="m_name_color" className="form-control form-control-sm" value={fields.m_name_color || ''} onChange={(e) => set('m_name_color', e.target.value)} placeholder="333333" />
                        </div>
                      </label>
                    </div>
                  )}
                </div>
                <div className="cis-collage-field">
                  <label className="cis-collage-field-label" htmlFor="collage-m-tpl">Template</label>
                  <select id="collage-m-tpl" name="m_template_id" className="form-select form-select-sm" value={fields.m_template_id || ''} onChange={(e) => set('m_template_id', e.target.value)}>
                    <option value="">None</option>
                    {templates.map((tpl) => <option key={`m-${tpl.value}`} value={tpl.value}>{tpl.label}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                {busy ? 'Generating…' : 'Generate collage'}
              </button>
              {(localMessage || data?.validationMessage) && (
                <p className="text-danger small mt-2 mb-0">{localMessage || data.validationMessage}</p>
              )}
            </form>
          </div>
        </div>
      </div>

      <div className="col-lg-7">
        <div className="card cis-student-screen-card mb-3">
          <div className="card-body">
            <p className="cis-collage-section-title">Preview</p>
            <div className="mb-3" dangerouslySetInnerHTML={{ __html: gridHtml }} />
            {data?.outputUrl ? (
              <img src={data.outputUrl} alt="Collage output" className="img-fluid cis-collage-output-image" />
            ) : (
              <div className="cis-report-empty">
                <span className="cis-report-empty-icon" aria-hidden="true">🖼</span>
                <p className="mb-0">Configure the grid and click Generate to build the collage.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

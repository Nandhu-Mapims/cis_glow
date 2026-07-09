import { useState } from 'react';
import { printAlumniIdCard } from '../../utils/printReport';

function formFieldsFromDom(formEl, state) {
  const fd = new FormData(formEl);
  const fromForm = {};
  for (const [key, value] of fd.entries()) {
    if (value instanceof File) continue;
    fromForm[key] = value;
  }
  return { ...state, ...fromForm };
}

export default function AlumniIdCardPanel({ data, busy, onGenerate }) {
  const [fields, setFields] = useState({
    search_by: 'roll_no',
    front_enable: '1',
    back_enable: '1',
  });
  const set = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  const searchByBatch = fields.search_by === 'batch';
  const hasResults = typeof data?.count === 'number';
  const canPrint = Boolean(data?.reportHtml && data.count > 0);

  const handlePrint = () => {
    if (data?.reportHtml) printAlumniIdCard(data.reportHtml);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formFieldsFromDom(e.currentTarget, fields),
      Submit: 'Go',
    };
    if (!payload.front_enable) payload.front_enable = false;
    if (!payload.back_enable) payload.back_enable = false;
    onGenerate(payload);
  };

  return (
    <div className="row g-3">
      <div className="col-lg-4">
        <div className="card cis-student-screen-card h-100">
          <div className="card-body">
            <div className="cis-student-filter-heading mb-3">Filter</div>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small text-muted">Option</label>
                <div className="d-flex flex-wrap gap-3">
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input me-1"
                      name="front_enable"
                      value="1"
                      defaultChecked
                      onChange={(ev) => set('front_enable', ev.target.checked ? '1' : false)}
                    />
                    Front
                  </label>
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input me-1"
                      name="back_enable"
                      value="1"
                      defaultChecked
                      onChange={(ev) => set('back_enable', ev.target.checked ? '1' : false)}
                    />
                    Back
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small text-muted">Search by</label>
                <div className="d-flex flex-column gap-2">
                  <label className="form-check-label">
                    <input
                      type="radio"
                      className="form-check-input me-1"
                      name="search_by"
                      value="roll_no"
                      checked={!searchByBatch}
                      onChange={() => set('search_by', 'roll_no')}
                    />
                    Register No
                  </label>
                  <label className="form-check-label">
                    <input
                      type="radio"
                      className="form-check-input me-1"
                      name="search_by"
                      value="batch"
                      checked={searchByBatch}
                      onChange={() => set('search_by', 'batch')}
                    />
                    Batch
                  </label>
                </div>
              </div>

              {!searchByBatch ? (
                <div className="mb-3">
                  <label className="form-label small text-muted">Register numbers</label>
                  <input
                    className="form-control"
                    name="search_input"
                    placeholder="Register nos separated by ,"
                    value={fields.search_input || ''}
                    onChange={(ev) => set('search_input', ev.target.value)}
                  />
                </div>
              ) : (
                <div className="mb-3">
                  <label className="form-label small text-muted">Course / batch</label>
                  <select
                    className="form-select"
                    name="search_course"
                    value={fields.search_course || ''}
                    onChange={(ev) => set('search_course', ev.target.value)}
                  >
                    <option value="">Select</option>
                    {(data?.courses || []).flatMap((course) => (
                      (course.batchOptions || []).map((batch) => (
                        <option key={batch.value} value={batch.value}>{batch.label}</option>
                      ))
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                Go
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="col-lg-8">
        <div className="card cis-student-screen-card h-100">
          <div className="card-body">
            {!hasResults ? (
              <p className="text-muted mb-0">Enter search criteria and click Go to generate ID cards.</p>
            ) : (
              <>
                <p className="text-danger mb-2">Search results: {data.count} found...</p>
                {canPrint ? (
                  <>
                    <p className="mb-3">ID card generated successfully. Use Print to open the print preview.</p>
                    <button type="button" className="btn btn-primary" onClick={handlePrint}>
                      Print
                    </button>
                  </>
                ) : (
                  <p className="text-muted mb-0">No alumni with ID card photos found for the selected criteria.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

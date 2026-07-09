import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../api/client';

export default function GenericExamScreen({ readOnly }) {
  const { screen } = useParams();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    academicYear: '',
    academicType: '',
    note: '',
    enabled: true,
  });

  const load = async (payload = {}) => {
    setBusy(true);
    try {
      const res = await api.post(`/api/exam/setup/${screen}/load`, { fields: payload });
      setData(res.data);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load({});
  }, [screen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await load({
      academicYear: form.academicYear,
      academicType: form.academicType,
    });
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/api/exam/setup/${screen}/save`, {
        fields: { note: form.note, enabled: form.enabled },
      });
      if (res?.data) {
        await load({
          academicYear: form.academicYear,
          academicType: form.academicType,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <form className="row g-2 mb-3" onSubmit={handleSubmit}>
        <div className="col-md-3">
          <input
            className="form-control"
            placeholder="Academic year"
            value={form.academicYear}
            onChange={(event) => setForm((prev) => ({ ...prev, academicYear: event.target.value }))}
          />
        </div>
        <div className="col-md-3">
          <select
            className="form-control"
            value={form.academicType}
            onChange={(event) => setForm((prev) => ({ ...prev, academicType: event.target.value }))}
          >
            <option value="">All types</option>
            <option value="odd">Odd</option>
            <option value="even">Even</option>
            <option value="year">Year</option>
          </select>
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-info" disabled={busy}>Refresh</button>
        </div>
      </form>

      <div className="row g-3 mb-3">
        <div className="col-md-4"><div className="card p-3"><strong>Total</strong><div className="fs-4">{data?.summary?.total ?? 0}</div></div></div>
        <div className="col-md-4"><div className="card p-3"><strong>Active</strong><div className="fs-4">{data?.summary?.active ?? 0}</div></div></div>
        <div className="col-md-4"><div className="card p-3"><strong>Deleted</strong><div className="fs-4">{data?.summary?.deleted ?? 0}</div></div></div>
      </div>

      <div className="small text-muted mb-2">
        Data source: <code>{data?.tableName || '-'}</code>
      </div>
      {data?.warning ? <div className="alert alert-warning py-2">{data.warning}</div> : null}

      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Year</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row) => (
              <tr key={`${row.id}-${row.name}`}>
                <td>{row.id}</td>
                <td>{row.name}</td>
                <td>{row.academicYear}</td>
                <td>{row.academicType}</td>
                <td>{row.status}</td>
                <td>{row.createdDate}</td>
                <td>{row.updatedDate}</td>
              </tr>
            ))}
            {!data?.rows?.length ? <tr><td colSpan={7} className="text-center text-muted">No rows found</td></tr> : null}
          </tbody>
        </table>
      </div>

      {!readOnly ? (
        <div className="card p-3 mt-3">
          <h6 className="mb-2">Quick settings</h6>
          <div className="row g-2 align-items-center">
            <div className="col-md-7">
              <input
                className="form-control"
                placeholder="Note"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </div>
            <div className="col-md-3">
              <label className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                />
                <span className="form-check-label">Enabled</span>
              </label>
            </div>
            <div className="col-md-2">
              <button type="button" className="btn btn-primary w-100" disabled={busy} onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

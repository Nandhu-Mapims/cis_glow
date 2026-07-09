import { useEffect, useState } from 'react';
import { fileToUploadPayload } from '../../../utils/fileBase64';
import ConfirmModal from '../../fees/setup/ConfirmModal';

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));

function formatCronDay(day) {
  const value = Number(day);
  if (!value || value < 1 || value > 31) return '01';
  return String(value).padStart(2, '0');
}

export default function IndividualSetup({ data, save, busy }) {
  const saveCoverPage = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const ids = formData.getAll('id');
    const fields = {
      Submit: 'Submit',
      id: ids,
      hd_banner_image: formData.getAll('hd_banner_image'),
    };
    const files = [];
    for (let i = 0; i < ids.length; i += 1) {
      const input = form.querySelector(`input[type="file"][data-row-id="${ids[i]}"]`);
      if (input?.files?.[0]) {
        const payload = await fileToUploadPayload(input.files[0], `banner_image[${i}]`);
        if (payload) files.push(payload);
      }
    }
    await save(fields, files);
  };

  if (!data?.rows) return null;
  return (
    <form onSubmit={saveCoverPage}>
      <table className="table table-bordered">
        <thead><tr><th>S. No.</th><th>Title</th><th>Image</th><th>Upload</th></tr></thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr key={row.id}>
              <td>{idx + 1}</td>
              <td>{row.bannerName}</td>
              <td>
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt={row.bannerName || ''} width="100" height="40" />
                ) : '—'}
              </td>
              <td>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="hd_banner_image" value={row.bannerImage || ''} />
                <input type="file" accept="image/jpeg,image/png,image/gif" data-row-id={row.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Submit'}
      </button>
    </form>
  );
}

export function CronSetup({ data, load, save, busy }) {
  const [extraRows, setExtraRows] = useState(0);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setExtraRows(0);
  }, [data?.selectedCronId, data?.emails]);

  const saveCron = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const fields = Object.fromEntries(form.entries());
    fields.Submit = 'Update';
    fields.desg_name = form.getAll('desg_name');
    fields.desg_email = form.getAll('desg_email');
    fields.id = form.getAll('id');
    if (!fields.c_status) fields.c_status = '0';
    await save(fields);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await save({
      delete: 'Confirm',
      confirm: deleteId,
      dept_name_ref: data.selectedCronId,
    });
    setDeleteId(null);
  };

  if (!data) return null;

  const selectedCronId = data.selectedCronId || '';
  const showGrid = Boolean(selectedCronId);
  const dayValue = formatCronDay(data.selected?.cronDay);
  const statusChecked = Number(data.selected?.status) === 1;

  return (
    <>
      <form key={selectedCronId} onSubmit={saveCron}>
        <div className="row g-3 mb-3">
          <div className="col-md-4">
            <label className="form-label">Cron Type</label>
            <select
              name="dept_name_ref"
              className="form-select"
              defaultValue={selectedCronId}
              onChange={(e) => load({ dept_name_ref: e.target.value })}
            >
              <option value="">--Select One--</option>
              {(data.cronOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Title</label>
            <input name="dept_name" className="form-control" defaultValue={data.selected?.title || ''} />
          </div>
        </div>

        {showGrid ? (
          <>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label d-block">Status</label>
                <label className="form-check-label">
                  <input
                    type="checkbox"
                    className="form-check-input me-2"
                    name="c_status"
                    value="1"
                    defaultChecked={statusChecked}
                  />
                  Yes
                </label>
              </div>
              <div className="col-md-2">
                <label className="form-label">Day</label>
                <select name="c_day" className="form-select" defaultValue={dayValue}>
                  {DAY_OPTIONS.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered align-middle">
                <thead className="table-secondary">
                  <tr>
                    <th style={{ width: '10%' }}>S. No.</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th style={{ width: '10%' }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.emails || []).map((row, index) => (
                    <tr key={row.id}>
                      <td>
                        {index + 1}
                        <input type="hidden" name="id" value={row.id} />
                      </td>
                      <td><input name="desg_name" className="form-control" defaultValue={row.name} /></td>
                      <td><input name="desg_email" className="form-control" defaultValue={row.email} /></td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setDeleteId(row.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {Array.from({ length: extraRows }, (_, index) => (
                    <tr key={`new-${index}`}>
                      <td>{(data.emails?.length || 0) + index + 1}</td>
                      <td><input name="desg_name" className="form-control" /></td>
                      <td><input name="desg_email" className="form-control" /></td>
                      <td />
                    </tr>
                  ))}
                  {!data.emails?.length && extraRows === 0 ? (
                    <tr>
                      <td>1</td>
                      <td><input name="desg_name" className="form-control" /></td>
                      <td><input name="desg_email" className="form-control" /></td>
                      <td />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <button
                type="button"
                className="btn btn-sm btn-info"
                onClick={() => setExtraRows((count) => count + 1)}
              >
                +
              </button>
              <div>
                <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
                <input type="hidden" name="form_reset" value={String(Date.now())} />
              </div>
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

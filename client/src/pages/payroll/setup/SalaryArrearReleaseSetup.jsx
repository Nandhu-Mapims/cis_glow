import { useEffect, useState } from 'react';
import { fileToUploadPayload } from '../../../utils/fileBase64.js';

function monthRefToInputValue(mmYyyy) {
  if (!mmYyyy || !/^\d{2}-\d{4}$/.test(mmYyyy)) return '';
  const [mm, yyyy] = mmYyyy.split('-');
  return `${yyyy}-${mm}`;
}

function inputValueToMonthRef(yyyyMm) {
  if (!yyyyMm) return '';
  const [yyyy, mm] = yyyyMm.split('-');
  return `${mm}-${yyyy}`;
}

function ArrearList({ data, load, save, busy }) {
  const selected = data?.selected || {};
  const [receiptSearch, setReceiptSearch] = useState(selected.receiptSearch || '');
  const [staffSearch, setStaffSearch] = useState(selected.staffSearch || '');
  const [monthSearch, setMonthSearch] = useState(selected.monthSearch || '');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setReceiptSearch(selected.receiptSearch || '');
    setStaffSearch(selected.staffSearch || '');
    setMonthSearch(selected.monthSearch || '');
  }, [selected.receiptSearch, selected.staffSearch, selected.monthSearch]);

  const onSearch = async (e) => {
    e.preventDefault();
    await load({
      a_search: receiptSearch,
      s_search: staffSearch,
      m_search: monthSearch,
    });
  };

  const onEdit = (id) => load({
    edit_id: id,
    a_search: receiptSearch,
    s_search: staffSearch,
    m_search: monthSearch,
  });

  const onConfirmDelete = async () => {
    if (!deleteId) return;
    await save({
      delete: 'Confirm',
      confirm: deleteId,
      a_search: receiptSearch,
      s_search: staffSearch,
      m_search: monthSearch,
    });
    setDeleteId(null);
  };

  return (
    <>
      <form onSubmit={onSearch} className="row g-2 mb-3 align-items-end">
        <div className="col-md-3">
          <input className="form-control" placeholder="Account No" value={receiptSearch} onChange={(e) => setReceiptSearch(e.target.value)} />
        </div>
        <div className="col-md-3">
          <input className="form-control" placeholder="Staff ID" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} />
        </div>
        <div className="col-md-3">
          <input
            className="form-control"
            type="month"
            value={monthRefToInputValue(monthSearch)}
            onChange={(e) => setMonthSearch(inputValueToMonthRef(e.target.value))}
          />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-info" disabled={busy}>
            <i className="fa fa-search me-1" />Search
          </button>
        </div>
      </form>

      <table className="table table-hover table-bordered">
        <thead className="table-primary">
          <tr>
            <th>Receipt ID</th>
            <th>Staff ID</th>
            <th>Staff Name</th>
            <th>D.Amount</th>
            <th>D.Month</th>
            <th>R.Amount</th>
            <th>R.Month</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(data?.arrears || []).length === 0 ? (
            <tr><td colSpan={8} className="text-muted">No data available</td></tr>
          ) : (
            (data?.arrears || []).map((row) => (
              <tr key={row.id}>
                <td>{row.receiptNo}</td>
                <td>{row.staffCode}</td>
                <td>{row.name}</td>
                <td>{row.deductAmount}</td>
                <td>{row.deductMonth}</td>
                <td>{row.releaseAmount}</td>
                <td>{row.releaseMonth}</td>
                <td className="text-nowrap">
                  <button type="button" className="btn btn-sm btn-primary me-1" title="Edit" onClick={() => onEdit(row.id)} disabled={busy}>
                    <i className="fa fa-pencil" />
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" title="Delete" onClick={() => setDeleteId(row.id)} disabled={busy}>
                    <i className="fa fa-trash" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {deleteId && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm</h5>
                <button type="button" className="btn-close" onClick={() => setDeleteId(null)} />
              </div>
              <div className="modal-body">Are you sure to delete...</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>Close</button>
                <button type="button" className="btn btn-warning" onClick={onConfirmDelete} disabled={busy}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ArrearEditForm({ data, save, load, busy }) {
  const arrear = data?.selectedArrear || {};
  const selected = data?.selected || {};
  const [releaseOpen, setReleaseOpen] = useState(Boolean(arrear.releaseOpen));

  useEffect(() => {
    setReleaseOpen(Boolean(arrear.releaseOpen));
  }, [arrear.id, arrear.releaseOpen]);

  const onBack = () => load({
    a_search: selected.receiptSearch || '',
    s_search: selected.staffSearch || '',
    m_search: selected.monthSearch || '',
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const fields = {
      Submit: 'Save',
      edit_row_id: arrear.id,
      a_search: selected.receiptSearch || '',
      s_search: selected.staffSearch || '',
      m_search: selected.monthSearch || '',
      staff_id: formData.get('staff_id'),
      arrear_type: formData.get('arrear_type'),
      arrear_amount: formData.get('arrear_amount'),
      arrear_from: inputValueToMonthRef(formData.get('arrear_from')),
      arrear_reason: formData.get('arrear_reason'),
      hd_release_document: formData.get('hd_release_document'),
    };
    if (releaseOpen) {
      fields.a_close = '1';
      fields.release_amount = formData.get('release_amount');
      fields.release_from = inputValueToMonthRef(formData.get('release_from'));
      fields.release_approved = formData.get('release_approved');
    }
    const files = [];
    const fileInput = formEl.querySelector('input[type=file]');
    if (releaseOpen && fileInput?.files?.[0]) {
      const payload = await fileToUploadPayload(fileInput.files[0], 'release_document');
      if (payload) files.push(payload);
    }
    await save(fields, files);
  };

  return (
    <>
      <div className="text-end mb-2">
        <button type="button" className="btn btn-link" onClick={onBack}>← Back</button>
      </div>
      <form key={arrear.id} onSubmit={onSubmit} encType="multipart/form-data">
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">Account Number</label>
            <input className="form-control" value={arrear.receiptNo || ''} readOnly />
          </div>
          <div className="col-md-8">
            <label className="form-label">Staff</label>
            <select name="staff_id" className="form-select" defaultValue={arrear.staffId} disabled>
              {(data?.staffOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Type</label>
            <select name="arrear_type" className="form-select" defaultValue={arrear.arrearType} required>
              <option value="">--Select--</option>
              {(data?.arrearTypes || []).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Amount</label>
            <input name="arrear_amount" className="form-control" defaultValue={arrear.amount} required maxLength={11} inputMode="decimal" />
          </div>
          <div className="col-md-4">
            <label className="form-label">Detection Month</label>
            <input
              name="arrear_from"
              type="month"
              className="form-control"
              defaultValue={monthRefToInputValue(arrear.deductFrom)}
              required
            />
          </div>
          <div className="col-md-12">
            <label className="form-label">Reason</label>
            <textarea name="arrear_reason" className="form-control" rows={3} defaultValue={arrear.reason} />
          </div>
          <div className="col-md-12">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="a_close"
                checked={releaseOpen}
                onChange={(e) => setReleaseOpen(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="a_close">Release</label>
            </div>
          </div>
          {releaseOpen && (
            <>
              <div className="col-md-4">
                <label className="form-label">Release Amount</label>
                <input name="release_amount" className="form-control" defaultValue={arrear.releaseAmount} maxLength={11} inputMode="decimal" />
              </div>
              <div className="col-md-4">
                <label className="form-label">Release Month</label>
                <input
                  name="release_from"
                  type="month"
                  className="form-control"
                  defaultValue={monthRefToInputValue(arrear.releaseFrom)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Release Approved By</label>
                <input name="release_approved" className="form-control" defaultValue={arrear.releaseApproved} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Documents</label>
                <input type="file" name="release_document" className="form-control" accept=".pdf,.jpg,.jpeg,.png,.gif" />
                <input type="hidden" name="hd_release_document" value={arrear.releaseAttachment || ''} />
                {arrear.releaseAttachment ? (
                  <div className="form-text">
                    Current:{' '}
                    <a href={`/legacy/files/salary_arrear/${arrear.releaseAttachment}`} target="_blank" rel="noreferrer">
                      {arrear.releaseAttachment}
                    </a>
                  </div>
                ) : null}
                <div className="form-text">Supported: pdf, jpg, png, gif. Max 10 MB.</div>
              </div>
            </>
          )}
        </div>
        <div className="mt-3 d-flex gap-2">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          <button type="reset" className="btn btn-outline-secondary">Reset</button>
        </div>
      </form>
    </>
  );
}

export default function SalaryArrearReleaseSetup({ data, load, save, busy }) {
  if (data?.mode === 'edit') {
    return <ArrearEditForm data={data} save={save} load={load} busy={busy} />;
  }
  return <ArrearList data={data} load={load} save={save} busy={busy} />;
}

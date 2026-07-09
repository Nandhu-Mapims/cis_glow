import { useEffect, useState } from 'react';
import { fileToUploadPayload } from '../../../utils/fileBase64.js';

function inputValueToMonthRef(yyyyMm) {
  if (!yyyyMm) return '';
  const [yyyy, mm] = yyyyMm.split('-');
  return `${mm}-${yyyy}`;
}

export default function SalaryArrearAddSetup({ data, save, busy }) {
  const [releaseOpen, setReleaseOpen] = useState(false);

  useEffect(() => {
    setReleaseOpen(false);
  }, [data?.arrearNo]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const fields = {
      Submit: 'Update',
      staff_id: formData.get('staff_id'),
      arrear_type: formData.get('arrear_type'),
      arrear_amount: formData.get('arrear_amount'),
      arrear_from: inputValueToMonthRef(formData.get('arrear_from')),
      arrear_reason: formData.get('arrear_reason'),
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
    <form onSubmit={onSubmit} encType="multipart/form-data">
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label">Account Number</label>
          <input className="form-control" value={data?.arrearNo || ''} readOnly />
        </div>
        <div className="col-md-8">
          <label className="form-label">Staff</label>
          <select name="staff_id" className="form-select" required defaultValue="">
            <option value="">--Select--</option>
            {(data?.staffOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Type</label>
          <select name="arrear_type" className="form-select" required defaultValue="">
            <option value="">--Select--</option>
            {(data?.arrearTypes || []).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Amount</label>
          <input name="arrear_amount" className="form-control" required maxLength={11} inputMode="decimal" />
        </div>
        <div className="col-md-4">
          <label className="form-label">Detection Month</label>
          <input name="arrear_from" type="month" className="form-control" required />
        </div>
        <div className="col-md-12">
          <label className="form-label">Reason</label>
          <textarea name="arrear_reason" className="form-control" rows={3} />
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
              <input name="release_amount" className="form-control" maxLength={11} inputMode="decimal" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Release Month</label>
              <input name="release_from" type="month" className="form-control" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Release Approved By</label>
              <input name="release_approved" className="form-control" />
            </div>
            <div className="col-md-6">
              <label className="form-label">Documents</label>
              <input type="file" name="release_document" className="form-control" accept=".pdf,.jpg,.jpeg,.png,.gif" />
              <div className="form-text">Supported: pdf, jpg, png, gif. Max 10 MB.</div>
            </div>
          </>
        )}
      </div>
      <div className="mt-3 d-flex gap-2">
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        <button
          type="reset"
          className="btn btn-outline-secondary"
          onClick={() => setReleaseOpen(false)}
        >
          Reset
        </button>
      </div>
    </form>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { fileToUploadPayload } from '../../../utils/fileBase64.js';
import SuretyStaffPicker from './SuretyStaffPicker.jsx';
import HoldMonthPicker from './HoldMonthPicker.jsx';

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

function addMonths(date, count) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + count, 1);
  return d;
}

function buildHoldMonthOptions(detectionFromInput, noOfMonths, selectedHold = []) {
  const detectionFrom = inputValueToMonthRef(detectionFromInput);
  let count = Number(noOfMonths) || 0;
  if (selectedHold.length) count += selectedHold.length;
  if (!detectionFrom || count <= 0) return [];
  const [mm, yyyy] = detectionFrom.split('-');
  let date = new Date(Number(yyyy), Number(mm) - 1, 1);
  const total = count + selectedHold.length;
  const options = [];
  for (let i = 0; i < total; i += 1) {
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    const mmStr = String(m).padStart(2, '0');
    options.push({ value: `${y}-${mmStr}-01`, label: `${mmStr}-${y}` });
    date = addMonths(date, 1);
  }
  return options;
}

export default function SalaryAdvanceAddSetup({ data, save, busy }) {
  const [detectionFrom, setDetectionFrom] = useState('');
  const [noOfMonths, setNoOfMonths] = useState('1');
  const [holdMonths, setHoldMonths] = useState([]);
  const [surety, setSurety] = useState([]);

  useEffect(() => {
    setDetectionFrom('');
    setNoOfMonths('1');
    setHoldMonths([]);
    setSurety([]);
  }, [data?.advanceNo]);

  const holdOptions = useMemo(
    () => buildHoldMonthOptions(detectionFrom, noOfMonths, holdMonths),
    [detectionFrom, noOfMonths, holdMonths],
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const fields = {
      Submit: 'Update',
      staff_id: formData.get('staff_id'),
      advance_type: formData.get('advance_type'),
      advance_amount: formData.get('advance_amount'),
      issued_month: inputValueToMonthRef(formData.get('issued_month')),
      detection_from: inputValueToMonthRef(formData.get('detection_from')),
      no_of_month: formData.get('no_of_month'),
      approved_by: formData.get('approved_by'),
      hmonth_list: holdMonths,
      surity_list: surety,
    };
    const files = [];
    const fileInput = formEl.querySelector('input[type=file]');
    if (fileInput?.files?.[0]) {
      const payload = await fileToUploadPayload(fileInput.files[0], 'advance_document');
      if (payload) files.push(payload);
    }
    await save(fields, files);
  };

  return (
    <form onSubmit={onSubmit} encType="multipart/form-data">
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label">Account Number</label>
          <input className="form-control" value={data?.advanceNo || ''} readOnly />
        </div>
        <div className="col-md-8">
          <label className="form-label">Staff</label>
          <select name="staff_id" className="form-select" required defaultValue="">
            <option value="">--Select--</option>
            {(data?.staffOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}{opt.note || ''}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Type</label>
          <select name="advance_type" className="form-select" required defaultValue="">
            <option value="">--Select--</option>
            {(data?.advanceTypes || []).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Issued Month</label>
          <input name="issued_month" type="month" className="form-control" required />
        </div>
        <div className="col-md-4">
          <label className="form-label">Amount</label>
          <input name="advance_amount" className="form-control" required maxLength={11} inputMode="decimal" />
        </div>
        <div className="col-md-4">
          <label className="form-label">Detection from</label>
          <input
            name="detection_from"
            type="month"
            className="form-control"
            required
            value={detectionFrom}
            onChange={(e) => {
              setDetectionFrom(e.target.value);
              setHoldMonths([]);
            }}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Detection</label>
          <div className="input-group">
            <input
              name="no_of_month"
              className="form-control"
              required
              value={noOfMonths}
              onChange={(e) => {
                setNoOfMonths(e.target.value.replace(/\D/g, ''));
                setHoldMonths([]);
              }}
            />
            <span className="input-group-text">Months</span>
          </div>
        </div>
        <div className="col-md-4">
          <label className="form-label">Hold Month</label>
          <HoldMonthPicker
            options={holdOptions}
            value={holdMonths}
            onChange={setHoldMonths}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Surety Staff (max {data?.maxSurety || 2})</label>
          <SuretyStaffPicker
            options={data?.suretyOptions || []}
            value={surety}
            onChange={setSurety}
            max={data?.maxSurety || 2}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Documents</label>
          <input type="file" name="advance_document" className="form-control" accept=".pdf,.jpg,.jpeg,.png,.gif" />
          <div className="form-text">Supported: pdf, jpg, png, gif. Max 10 MB.</div>
        </div>
        <div className="col-md-6">
          <label className="form-label">Approved By</label>
          <input name="approved_by" className="form-control" required />
        </div>
      </div>
      <div className="mt-3 d-flex gap-2">
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        <button type="reset" className="btn btn-outline-secondary" onClick={() => { setDetectionFrom(''); setNoOfMonths('1'); setHoldMonths([]); setSurety([]); }}>Reset</button>
      </div>
    </form>
  );
}

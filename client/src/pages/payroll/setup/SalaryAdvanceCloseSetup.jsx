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

function sqlDateToInputDate(sqlDate) {
  if (!sqlDate || sqlDate.startsWith('0000')) return '';
  const [yyyy, mm, dd] = sqlDate.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

function inputDateToSqlDate(yyyyMmDd) {
  if (!yyyyMmDd) return '';
  return yyyyMmDd;
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

function monthDiff(fromRef, toRef) {
  const [fmm, fyyyy] = fromRef.split('-').map(Number);
  const [tmm, tyyyy] = toRef.split('-').map(Number);
  return (tyyyy - fyyyy) * 12 + (tmm - fmm);
}

function computeCloseAmount(amount, detectionFrom, closeMonth, noOfMonths, holdCount) {
  const advanceAmount = Number(amount) || 0;
  if (!detectionFrom || !closeMonth || advanceAmount <= 0) return '';
  let mdiff = monthDiff(detectionFrom, closeMonth);
  if (holdCount > 0) mdiff -= holdCount;
  if (mdiff < 0) mdiff = 0;
  const months = Number(noOfMonths) || 0;
  let monthly = advanceAmount;
  if (months > 0) monthly = Math.ceil(advanceAmount / months);
  return String(advanceAmount - monthly * mdiff);
}

function AdvanceList({ data, load, save, busy }) {
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
          <input className="form-control" type="month" value={monthRefToInputValue(monthSearch)} onChange={(e) => setMonthSearch(inputValueToMonthRef(e.target.value))} />
        </div>
        <div className="col-md-2">
          <button className="btn btn-info w-100" disabled={busy}>Search</button>
        </div>
      </form>
      <div className="text-muted small mb-2">Showing {data?.total || 0} entries</div>
      <div className="table-responsive">
        <table className="table table-bordered table-hover">
          <thead className="table-light">
            <tr>
              <th>Receipt ID</th>
              <th>Staff ID</th>
              <th>Staff Name</th>
              <th>Amount</th>
              <th>Issued Month</th>
              <th>Deduct From</th>
              <th>#Month</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.advances || []).map((row) => (
              <tr key={row.id}>
                <td>{row.receiptNo || row.receiptId}</td>
                <td>{row.staffCode}</td>
                <td>{row.name}</td>
                <td>{row.amount}</td>
                <td>{row.issuedMonth}</td>
                <td>{row.deductFrom}</td>
                <td>{row.deductMonths}</td>
                <td className="text-nowrap">
                  <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => onEdit(row.id)} title="Edit">
                    <i className="fa fa-pencil" />
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteId(row.id)} title="Delete">
                    <i className="fa fa-trash" />
                  </button>
                </td>
              </tr>
            ))}
            {(data?.advances || []).length === 0 && (
              <tr><td colSpan={8} className="text-muted">No data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {deleteId ? (
        <div className="modal show d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Confirm</h5><button type="button" className="btn-close" onClick={() => setDeleteId(null)} /></div>
              <div className="modal-body">Are you sure to delete...</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>Close</button>
                <button type="button" className="btn btn-warning" onClick={onConfirmDelete} disabled={busy}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AdvanceEditForm({ data, load, save, busy }) {
  const adv = data?.selectedAdvance || {};
  const search = data?.selected || {};
  const [detectionFrom, setDetectionFrom] = useState(monthRefToInputValue(adv.detectionFrom));
  const [noOfMonths, setNoOfMonths] = useState(adv.noOfMonths || '1');
  const [holdMonths, setHoldMonths] = useState(adv.holdMonths || []);
  const [surety, setSurety] = useState(adv.surety || []);
  const [isClosed, setIsClosed] = useState(Boolean(adv.closed));
  const [closeMonth, setCloseMonth] = useState(monthRefToInputValue(adv.closeMonth));
  const [closeAmount, setCloseAmount] = useState(adv.closeAmount || '');
  const [fromSalary, setFromSalary] = useState(adv.fromSalary !== false);
  const [fromBank, setFromBank] = useState(Boolean(adv.fromBank));

  useEffect(() => {
    setDetectionFrom(monthRefToInputValue(adv.detectionFrom));
    setNoOfMonths(adv.noOfMonths || '1');
    setHoldMonths(adv.holdMonths || []);
    setSurety(adv.surety || []);
    setIsClosed(Boolean(adv.closed));
    setCloseMonth(monthRefToInputValue(adv.closeMonth));
    setCloseAmount(adv.closeAmount || '');
    setFromSalary(adv.fromSalary !== false);
    setFromBank(Boolean(adv.fromBank));
  }, [adv.id]);

  const holdOptions = useMemo(
    () => buildHoldMonthOptions(detectionFrom, noOfMonths, holdMonths),
    [detectionFrom, noOfMonths, holdMonths],
  );

  const refreshCloseAmount = (nextCloseMonth = closeMonth, amountValue = adv.amount) => {
    const amount = computeCloseAmount(
      amountValue,
      inputValueToMonthRef(detectionFrom),
      inputValueToMonthRef(nextCloseMonth),
      noOfMonths,
      holdMonths.length,
    );
    if (amount !== '') setCloseAmount(amount);
  };

  const onBack = () => load({
    a_search: search.receiptSearch,
    s_search: search.staffSearch,
    m_search: search.monthSearch,
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const fields = {
      Submit: 'Save',
      edit_row_id: adv.id,
      a_search: search.receiptSearch,
      s_search: search.staffSearch,
      m_search: search.monthSearch,
      staff_id: adv.staffId,
      advance_type: formData.get('advance_type'),
      advance_amount: formData.get('advance_amount'),
      issued_month: inputValueToMonthRef(formData.get('issued_month')),
      detection_from: inputValueToMonthRef(formData.get('detection_from')),
      no_of_month: formData.get('no_of_month'),
      approved_by: formData.get('approved_by'),
      hd_advance_document: adv.attachment || '',
      hmonth_list: holdMonths,
      surity_list: surety,
      a_close: isClosed ? '1' : '0',
      close_month: inputValueToMonthRef(formData.get('close_month')),
      close_amount: closeAmount,
      close_approved: formData.get('close_approved'),
      from_salary: fromSalary ? '1' : '0',
      salary_month: inputValueToMonthRef(formData.get('salary_month')),
      salary_amount: formData.get('salary_amount'),
      from_bank: fromBank ? '1' : '0',
      d_date: formData.get('d_date'),
      d_amount: formData.get('d_amount'),
      bank_name: formData.get('bank_name'),
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
    <>
      <div className="text-end mb-2">
        <button type="button" className="btn btn-link" onClick={onBack}>← Back</button>
      </div>
      <form key={adv.id} onSubmit={onSubmit} encType="multipart/form-data">
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">Account Number</label>
            <input className="form-control" value={adv.receiptNo || ''} readOnly />
          </div>
          <div className="col-md-8">
            <label className="form-label">Staff</label>
            <select name="staff_id" className="form-select" defaultValue={adv.staffId} disabled>
              {(data?.staffOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Type</label>
            <select name="advance_type" className="form-select" defaultValue={adv.advanceType} required>
              <option value="">--Select--</option>
              {(data?.advanceTypes || []).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Issued Month</label>
            <input name="issued_month" type="month" className="form-control" defaultValue={monthRefToInputValue(adv.issuedMonth)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Amount</label>
            <input name="advance_amount" className="form-control" defaultValue={adv.amount} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">Detection from</label>
            <input
              name="detection_from"
              type="month"
              className="form-control"
              value={detectionFrom}
              onChange={(e) => { setDetectionFrom(e.target.value); setHoldMonths([]); }}
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Detection</label>
            <div className="input-group">
              <input
                name="no_of_month"
                className="form-control"
                value={noOfMonths}
                onChange={(e) => { setNoOfMonths(e.target.value.replace(/\D/g, '')); setHoldMonths([]); }}
                required
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
            {adv.attachment ? (
              <div className="form-text">
                Current: <a href={`/legacy/files/salary_advance/${adv.attachment}`} target="_blank" rel="noreferrer">{adv.attachment}</a>
              </div>
            ) : null}
          </div>
          <div className="col-md-6">
            <label className="form-label">Approved By</label>
            <input name="approved_by" className="form-control" defaultValue={adv.approvedBy} required />
          </div>
          <div className="col-md-6">
            <label className="form-label">Close</label>
            <div className="form-check mt-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="a_close"
                checked={isClosed}
                onChange={(e) => {
                  setIsClosed(e.target.checked);
                  if (e.target.checked) refreshCloseAmount();
                }}
              />
              <label className="form-check-label" htmlFor="a_close">Yes</label>
            </div>
          </div>
        </div>

        {isClosed && (
          <div className="card mt-3">
            <div className="card-body">
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label">Close Month</label>
                  <input
                    name="close_month"
                    type="month"
                    className="form-control"
                    value={closeMonth}
                    onChange={(e) => {
                      setCloseMonth(e.target.value);
                      refreshCloseAmount(e.target.value);
                    }}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Close Amount</label>
                  <input name="close_amount" className="form-control" readOnly value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Close Approved By</label>
                  <input name="close_approved" className="form-control" defaultValue={adv.closeApprovedBy} />
                </div>
              </div>
              <table className="table table-bordered">
                <thead className="table-secondary">
                  <tr><th>Source</th><th>Month/Date</th><th>Amount</th><th>Bank Name</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <label className="form-check-label">
                        <input type="checkbox" className="form-check-input me-1" checked={fromSalary} onChange={(e) => setFromSalary(e.target.checked)} />
                        Salary
                      </label>
                    </td>
                    <td><input name="salary_month" type="month" className="form-control" defaultValue={monthRefToInputValue(adv.salaryMonth)} disabled={!fromSalary} /></td>
                    <td><input name="salary_amount" className="form-control" defaultValue={adv.salaryAmount} disabled={!fromSalary} /></td>
                    <td />
                  </tr>
                  <tr>
                    <td>
                      <label className="form-check-label">
                        <input type="checkbox" className="form-check-input me-1" checked={fromBank} onChange={(e) => setFromBank(e.target.checked)} />
                        Bank
                      </label>
                    </td>
                    <td><input name="d_date" type="date" className="form-control" defaultValue={sqlDateToInputDate(adv.depositDate)} disabled={!fromBank} /></td>
                    <td><input name="d_amount" className="form-control" defaultValue={adv.depositAmount} disabled={!fromBank} /></td>
                    <td><input name="bank_name" className="form-control" defaultValue={adv.bankName} disabled={!fromBank} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-3 d-flex gap-2">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onBack}>Back</button>
        </div>
      </form>
    </>
  );
}

export default function SalaryAdvanceCloseSetup({ data, load, save, busy }) {
  if (data?.mode === 'edit' && data?.selectedAdvance) {
    return <AdvanceEditForm data={data} load={load} save={save} busy={busy} />;
  }
  return <AdvanceList data={data} load={load} save={save} busy={busy} />;
}

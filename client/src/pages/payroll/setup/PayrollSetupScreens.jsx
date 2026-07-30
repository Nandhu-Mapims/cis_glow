import { useEffect, useState } from 'react';
import PayrollMonthlyGridSetup from './PayrollMonthlyGridSetup';

export { default as SalaryAddSetup } from './SalaryAddSetup';
export { default as SalaryAdvanceAddSetup } from './SalaryAdvanceAddSetup';
export { default as SalaryAdvanceCloseSetup } from './SalaryAdvanceCloseSetup';
export { default as SalaryArrearAddSetup } from './SalaryArrearAddSetup';
export { default as SalaryArrearReleaseSetup } from './SalaryArrearReleaseSetup';

export function PayrollConfigSetup({ data, load, save, busy }) {
  const selected = data?.selected || {};
  const onTypeChange = (e) => load({ payroll_type: e.target.value });
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const fields = Object.fromEntries(form.entries());
    fields.Submit = 'Update';
    await save(fields);
  };

  return (
  <form key={selected.id || 'new'} onSubmit={onSubmit}>
    <div className="row g-3 mb-3">
      <div className="col-md-4">
        <label className="form-label">Payroll Type</label>
        <select name="payroll_type" className="form-select" defaultValue={selected.id} onChange={onTypeChange}>
          <option value="add-new">Add New Type</option>
          {(data?.typeOptions || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label">Title</label>
        <input name="payroll_title" className="form-control" defaultValue={selected.payrollType} />
      </div>
      <div className="col-md-2">
        <label className="form-label">Payroll Start Day</label>
        <input name="payroll_start" className="form-control" defaultValue={selected.payrollStart} />
      </div>
      <div className="col-md-2">
        <label className="form-label">TDS Limit</label>
        <input name="tds_limit" className="form-control" defaultValue={selected.tdsLimit} />
      </div>
    </div>
    <div className="row g-3 mb-3">
      {['basic_pay', 'basic_margin', 'hra_allowance', 'd_allowance', 'm_allowance', 'c_allowance'].map((field) => (
        <div className="col-md-2" key={field}>
          <label className="form-label">{field.replace(/_/g, ' ')}</label>
          <select name={field} className="form-select" defaultValue={selected[field.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, (s) => s.toLowerCase())] ?? selected[field] ?? ''}>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
      ))}
    </div>
    <div className="row g-3 mb-3">
      <div className="col-md-2"><label className="form-label">PF %</label><input name="pf_percentage" className="form-control" defaultValue={selected.pfPercentage} /></div>
      <div className="col-md-2"><label className="form-label">PF Limit</label><input name="salary_limit" className="form-control" defaultValue={selected.salaryLimit} /></div>
      <div className="col-md-2"><label className="form-label">Min Late</label><input name="minimum_late" className="form-control" defaultValue={selected.minimumLate} /></div>
      <div className="col-md-2"><label className="form-label">Min Permission</label><input name="minimum_permission" className="form-control" defaultValue={selected.minimumPermission} /></div>
      <div className="col-md-2"><label className="form-label">Yearly Leave</label><input name="yearly_leave" className="form-control" defaultValue={selected.yearlyLeave} /></div>
      <div className="col-md-2"><label className="form-label">Yearly EL</label><input name="yearly_el" className="form-control" defaultValue={selected.yearlyEl} /></div>
    </div>
    <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
  </form>
  );
}

export function PfEsiSetup({ data, load, save, busy }) {
  const selected = data?.selected || {};
  const onSlabChange = (e) => load({ academic_date: e.target.value });
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const fields = Object.fromEntries(form.entries());
    fields.Submit = 'Update';
    await save(fields);
  };
  return (
    <form key={selected.id || 'new'} onSubmit={onSubmit}>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Slab</label>
          <select name="academic_date" className="form-select" defaultValue={selected.id} onChange={onSlabChange}>
            <option value="add-new">Add New</option>
            {(data?.slabOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4"><label className="form-label">From (MM-YYYY)</label><input name="h_from_date" className="form-control" defaultValue={selected.fromMonth} /></div>
        <div className="col-md-4"><label className="form-label">To (MM-YYYY)</label><input name="h_to_date" className="form-control" defaultValue={selected.toMonth} /></div>
      </div>
      <div className="row g-3 mb-3">
        {['epf_er', 'eps', 'adm_charge', 'edli', 'adli_add', 'esi_min', 'esi_er'].map((f) => (
          <div className="col-md-2" key={f}><label className="form-label">{f}</label><input name={f} className="form-control" defaultValue={selected[f === 'epf_er' ? 'epfEr' : f === 'adm_charge' ? 'admCharge' : f === 'adli_add' ? 'adliAdd' : f === 'esi_min' ? 'esiMin' : f === 'esi_er' ? 'esiEr' : f]} /></div>
        ))}
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
    </form>
  );
}

export function SalaryReportSetup({ data, load, busy }) {
  const [cat, setCat] = useState(data?.selected?.searchCategory || 'All');
  const onGenerate = async (e) => {
    e.preventDefault();
    await load({ search_category: cat, Submit: 'Generate' });
  };
  return (
    <>
      <form onSubmit={onGenerate} className="row g-3 mb-3">
        <div className="col-md-4">
          <select className="form-select" value={cat} onChange={(e) => setCat(e.target.value)}>
            {(data?.categoryOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2"><button className="btn btn-danger" disabled={busy}>Generate</button></div>
      </form>
      {(data?.report || []).map((row) => (
        <div key={row.staffId} className="mb-3">
          <strong>{row.staffId}</strong> — {row.name}
          <table className="table table-sm table-bordered mt-1">
            <thead><tr><th>From</th><th>To</th><th>Total</th></tr></thead>
            <tbody>
              {row.salaries.map((s) => (
                <tr key={s.id}><td>{s.fromDate}</td><td>{s.toDate || '—'}</td><td>{s.totalAmount}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

export function PayrollCloseSetup({ data, save, busy }) {
  const [payrollMonth, setPayrollMonth] = useState(data?.selectedId || '');
  const [payrollComplete, setPayrollComplete] = useState(Boolean(data?.payrollComplete));

  useEffect(() => {
    setPayrollMonth(data?.selectedId || '');
    setPayrollComplete(Boolean(data?.payrollComplete));
  }, [data?.selectedId, data?.payrollComplete]);

  const onMonthChange = (event) => {
    const monthId = event.target.value;
    setPayrollMonth(monthId);
    const option = (data?.monthOptions || []).find((opt) => opt.value === monthId);
    setPayrollComplete(Boolean(option?.payrollComplete));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    await save({
      Submit: 'Update',
      payroll_month: payrollMonth,
      payroll_complete: payrollComplete ? '1' : '0',
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="col-md-4 mb-3">
        <label className="form-label">Payroll Month</label>
        <select name="payroll_month" className="form-select" value={payrollMonth} onChange={onMonthChange}>
          {(data?.monthOptions || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="form-check mb-3">
        <input
          type="checkbox"
          name="payroll_complete"
          className="form-check-input"
          id="payroll_complete"
          checked={payrollComplete}
          onChange={(event) => setPayrollComplete(event.target.checked)}
          value="1"
        />
        <label className="form-check-label ms-2" htmlFor="payroll_complete">Payroll Complete</label>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy || !payrollMonth}>Update</button>
    </form>
  );
}

export function OtherDeductionSetup(props) {
  return <PayrollMonthlyGridSetup {...props} amountLabel="Amount" showReason />;
}
export function LopDeductionSetup(props) {
  return <PayrollMonthlyGridSetup {...props} amountLabel="LOP" showReason />;
}
export function TdsAddSetup(props) {
  return <PayrollMonthlyGridSetup {...props} amountLabel="TDS" showReason={false} />;
}
export function ChequePaymentSetup(props) {
  return <PayrollMonthlyGridSetup {...props} chequeMode />;
}

export { default as SecurityDepositAddSetup } from './SecurityDepositAddSetup';
export { default as SecurityDepositCloseSetup } from './SecurityDepositCloseSetup';

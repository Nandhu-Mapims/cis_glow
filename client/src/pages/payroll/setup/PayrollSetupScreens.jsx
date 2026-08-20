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

    <h6 className="mt-4 mb-2">Attendance</h6>
    <div className="row g-3 mb-3">
      {['live_attendance', 'live_att_photo'].map((field) => (
        <div className="col-md-2" key={field}>
          <label className="form-label">{field.replace(/_/g, ' ')}</label>
          <select name={field} className="form-select" defaultValue={selected[field === 'live_attendance' ? 'liveAttendance' : 'liveAttPhoto']}>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
      ))}
      <div className="col-md-2">
        <label className="form-label">Academic Start Month</label>
        <input name="academic_start_month" className="form-control" defaultValue={selected.academicStartMonth} />
      </div>
      <div className="col-md-2">
        <label className="form-label">Academic Start Day</label>
        <input name="academic_start_day" className="form-control" defaultValue={selected.academicStartDay} />
      </div>
      <div className="col-md-2">
        <label className="form-label">Day Type</label>
        <select name="day_type" className="form-select" defaultValue={selected.dayType}>
          <option value="0">Month Wise</option>
          <option value="1">Day Wise</option>
        </select>
      </div>
      <div className="col-md-2"><label className="form-label">Day Count</label><input name="day_count" className="form-control" defaultValue={selected.dayCount} /></div>
    </div>

    <h6 className="mt-4 mb-2">Leave Policy</h6>
    <div className="row g-3 mb-3">
      <div className="col-md-2"><label className="form-label">Max Casual Leave</label><input name="max_leave" className="form-control" defaultValue={selected.maxLeave} /></div>
      <div className="col-md-2"><label className="form-label">Max Leave per Request</label><input name="allow_leave" className="form-control" defaultValue={selected.allowLeave} /></div>
      <div className="col-md-2"><label className="form-label">CL Apply Before (days)</label><input name="cl_apply" className="form-control" defaultValue={selected.clApply} /></div>
      <div className="col-md-2"><label className="form-label">Leave Apply Before (days)</label><input name="leave_apply" className="form-control" defaultValue={selected.leaveApply} /></div>
      <div className="col-md-2">
        <label className="form-label">Allow CL on Holiday</label>
        <select name="inc_leave_holiday" className="form-select" defaultValue={selected.incLeaveHoliday}>
          <option value="1">Yes</option><option value="0">No</option>
        </select>
      </div>
      <div className="col-md-2">
        <label className="form-label">Include Holiday in Leave Request</label>
        <select name="inc_lr_holiday" className="form-select" defaultValue={selected.incLrHoliday}>
          <option value="1">Yes</option><option value="0">No</option>
        </select>
      </div>
    </div>

    <h6 className="mt-4 mb-2">On-Duty Policy</h6>
    <div className="row g-3 mb-3">
      <div className="col-md-2"><label className="form-label">Yearly OD</label><input name="yearly_od" className="form-control" defaultValue={selected.yearlyOd} /></div>
      <div className="col-md-2"><label className="form-label">OD Apply Before (days)</label><input name="od_apply" className="form-control" defaultValue={selected.odApply} /></div>
      <div className="col-md-4"><label className="form-label">OD Reasons (comma separated)</label><input name="od_type" className="form-control" defaultValue={selected.odType} /></div>
      <div className="col-md-2">
        <label className="form-label">Allow OD on Holiday</label>
        <select name="inc_od_holiday" className="form-select" defaultValue={selected.incOdHoliday}>
          <option value="1">Yes</option><option value="0">No</option>
        </select>
      </div>
    </div>

    <h6 className="mt-4 mb-2">Earned Leave Policy</h6>
    <div className="row g-3 mb-3">
      <div className="col-md-2"><label className="form-label">Max EL</label><input name="max_el" className="form-control" defaultValue={selected.maxEl} /></div>
      <div className="col-md-2"><label className="form-label">Min EL</label><input name="min_el" className="form-control" defaultValue={selected.minEl} /></div>
      <div className="col-md-2"><label className="form-label">EL Apply Before (days)</label><input name="el_apply" className="form-control" defaultValue={selected.elApply} /></div>
      <div className="col-md-2">
        <label className="form-label">Allow EL on Holiday</label>
        <select name="inc_el_holiday" className="form-select" defaultValue={selected.incElHoliday}>
          <option value="1">Yes</option><option value="0">No</option>
        </select>
      </div>
    </div>

    <h6 className="mt-4 mb-2">Day Off Policy</h6>
    <div className="row g-3 mb-3">
      <div className="col-md-2"><label className="form-label">Max Off per Request</label><input name="allow_off" className="form-control" defaultValue={selected.allowOff} /></div>
      <div className="col-md-2">
        <label className="form-label">Allow Off on Holiday</label>
        <select name="inc_off_holiday" className="form-select" defaultValue={selected.incOffHoliday}>
          <option value="1">Yes</option><option value="0">No</option>
        </select>
      </div>
    </div>

    <h6 className="mt-4 mb-2">Defaulter Windows</h6>
    <div className="row g-3 mb-3">
      <div className="col-md-2"><label className="form-label">Defaulter Submission (prev. days)</label><input name="defaulter_apply" className="form-control" defaultValue={selected.defaulterApply} /></div>
      <div className="col-md-2"><label className="form-label">CL Defaulter Days</label><input name="d_cl_apply" className="form-control" defaultValue={selected.dClApply} /></div>
      <div className="col-md-2"><label className="form-label">EL Defaulter Days</label><input name="d_el_apply" className="form-control" defaultValue={selected.dElApply} /></div>
      <div className="col-md-2"><label className="form-label">OD Defaulter Days</label><input name="d_od_apply" className="form-control" defaultValue={selected.dOdApply} /></div>
    </div>

    <h6 className="mt-4 mb-2">Late / Permission Rules</h6>
    <div className="row g-3 mb-3">
      <div className="col-md-2"><label className="form-label">Min Late Time</label><input name="l_time" className="form-control" placeholder="HH:MM" defaultValue={selected.lateTime} /></div>
      <div className="col-md-2"><label className="form-label">Action When Late Exceeds Limit</label><input name="l_lop" className="form-control" defaultValue={selected.lLop} /></div>
      <div className="col-md-3">
        <label className="form-label d-block">Late Applies</label>
        <div className="form-check form-check-inline">
          <input className="form-check-input" type="radio" name="l_lop_type" value="each" id="l_lop_each" defaultChecked={selected.lLopType !== 'per'} />
          <label className="form-check-label" htmlFor="l_lop_each">Each</label>
        </div>
        <div className="form-check form-check-inline">
          <input className="form-check-input" type="radio" name="l_lop_type" value="per" id="l_lop_per" defaultChecked={selected.lLopType === 'per'} />
          <label className="form-check-label" htmlFor="l_lop_per">Per Late</label>
        </div>
      </div>
      <div className="col-md-3">
        <label className="form-label d-block">Each Late Incident Results In</label>
        <div className="form-check form-check-inline">
          <input className="form-check-input" type="radio" name="late_deduct" value="permission" id="late_deduct_permission" defaultChecked={selected.lateDeduct !== 'absent'} />
          <label className="form-check-label" htmlFor="late_deduct_permission">Permission</label>
        </div>
        <div className="form-check form-check-inline">
          <input className="form-check-input" type="radio" name="late_deduct" value="absent" id="late_deduct_absent" defaultChecked={selected.lateDeduct === 'absent'} />
          <label className="form-check-label" htmlFor="late_deduct_absent">LOP</label>
        </div>
      </div>
      <div className="col-md-2"><label className="form-label">Min Permission Time</label><input name="p_time" className="form-control" placeholder="HH:MM" defaultValue={selected.permissionTime} /></div>
      <div className="col-md-2"><label className="form-label">Action When Permission Exceeds Limit</label><input name="p_lop" className="form-control" defaultValue={selected.pLop} /></div>
      <div className="col-md-3">
        <label className="form-label d-block">Permission Applies</label>
        <div className="form-check form-check-inline">
          <input className="form-check-input" type="radio" name="p_lop_type" value="each" id="p_lop_each" defaultChecked={selected.pLopType !== 'per'} />
          <label className="form-check-label" htmlFor="p_lop_each">Each</label>
        </div>
        <div className="form-check form-check-inline">
          <input className="form-check-input" type="radio" name="p_lop_type" value="per" id="p_lop_per" defaultChecked={selected.pLopType === 'per'} />
          <label className="form-check-label" htmlFor="p_lop_per">Per Permission</label>
        </div>
      </div>
    </div>

    <h6 className="mt-4 mb-2">PF / ESI</h6>
    <div className="row g-3 mb-3">
      <div className="col-md-2">
        <label className="form-label">EPF Contribution</label>
        <select name="paryroll_calculation" className="form-select" defaultValue={selected.pfCalculation}>
          <option value="1">Yes</option><option value="0">No</option>
        </select>
      </div>
      <div className="col-md-2">
        <label className="form-label">ESI Contribution</label>
        <select name="esi_calculation" className="form-select" defaultValue={selected.esiCalculation}>
          <option value="1">Yes</option><option value="0">No</option>
        </select>
      </div>
      <div className="col-md-2"><label className="form-label">ESI Limit</label><input name="esi_limit" className="form-control" defaultValue={selected.esiLimit} /></div>
      <div className="col-md-2"><label className="form-label">ESI Amount</label><input name="esi_amount" className="form-control" defaultValue={selected.esiAmount} /></div>
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
      <div className="table-responsive">
        <table className="table table-sm table-bordered mt-1">
          <thead>
            <tr>
              <th>S.No</th><th>S.ID</th><th>Name</th><th>Category</th>
              <th>From</th><th>To</th><th>Basic</th><th>Margin</th><th>D.A</th>
              <th>HRA</th><th>Medical</th><th>Conveyance</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            {(data?.report || []).map((row, idx) => {
              const salaries = row.salaries.length ? row.salaries : [{ id: `${row.staffId}-empty` }];
              return salaries.map((s, i) => (
                <tr key={s.id}>
                  {i === 0 && (
                    <>
                      <td rowSpan={salaries.length}>{idx + 1}</td>
                      <td rowSpan={salaries.length}>{row.staffId}</td>
                      <td rowSpan={salaries.length}>{row.name}</td>
                      <td rowSpan={salaries.length}>{row.category}</td>
                    </>
                  )}
                  <td>{s.fromDate || ''}</td>
                  <td>{s.toDate || ''}</td>
                  <td>{s.basicPay ?? ''}</td>
                  <td>{s.basicMargin ?? ''}</td>
                  <td>{s.dAllowance ?? ''}</td>
                  <td>{s.hraAllowance ?? ''}</td>
                  <td>{s.mAllowance ?? ''}</td>
                  <td>{s.cAllowance ?? ''}</td>
                  <td>{s.totalAmount ?? ''}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
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

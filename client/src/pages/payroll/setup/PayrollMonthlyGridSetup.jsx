import { useEffect, useState } from 'react';

export default function PayrollMonthlyGridSetup({ data, load, save, busy, amountLabel = 'Amount', showReason = true, chequeMode = false }) {
  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  useEffect(() => {
    const selected = data?.selected || {};
    if (selected.payrollMonth) {
      setPayrollMonth(selected.payrollMonth);
    } else if (selected.defaultPayrollMonth) {
      setPayrollMonth(selected.defaultPayrollMonth);
    }
    if (selected.searchCategory) {
      setSearchCategory(selected.searchCategory);
    }
  }, [data?.selected?.payrollMonth, data?.selected?.defaultPayrollMonth, data?.selected?.searchCategory]);

  const onGenerate = async (e) => {
    e.preventDefault();
    await load({ payroll_month: payrollMonth, search_category: searchCategory, Submit: 'Generate' });
  };

  const onSave = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const fields = Object.fromEntries(form.entries());
    fields.Submit = 'Submit';
    fields.staff_id = form.getAll('staff_id');
    fields.tds_id = form.getAll('tds_id');
    if (chequeMode) {
      fields.pay_cheque = form.getAll('pay_cheque');
      fields.d_reason = form.getAll('d_reason');
    } else if (amountLabel === 'TDS') {
      fields.tds_amount = form.getAll('tds_amount');
    } else {
      fields.d_amount = form.getAll('d_amount');
      fields.d_reason = form.getAll('d_reason');
    }
    fields.salary_month = data?.selected?.payrollMonthSql || payrollMonth;
    fields.payroll_month = payrollMonth;
    fields.search_category = searchCategory;
    await save(fields);
  };

  return (
    <>
      <form onSubmit={onGenerate} className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Month</label>
          <select className="form-select" required value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)}>
            <option value="">-Select Month-</option>
            {(data?.monthOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value} style={opt.generated ? { backgroundColor: '#96CD6D' } : undefined}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Category</label>
          <select className="form-select" required value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}>
            <option value="">-Select Category-</option>
            {(data?.categoryOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4 d-flex align-items-end">
          <button type="submit" className="btn btn-info" disabled={busy}>Go</button>
        </div>
      </form>

      {data?.rows?.length > 0 && (
        <form onSubmit={onSave}>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>#</th>
                <th>Staff ID</th>
                <th>Name</th>
                {chequeMode ? (
                  <>
                    <th>Cheque</th>
                    <th>Reason</th>
                  </>
                ) : (
                  <th>{amountLabel}</th>
                )}
                {showReason && !chequeMode && <th>Reason</th>}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => (
                <tr key={row.staffId}>
                  <td>{row.index}</td>
                  <td>{row.staffCode}</td>
                  <td>{row.name}</td>
                  <input type="hidden" name="staff_id" value={row.staffId} />
                  <input type="hidden" name="tds_id" value={row.rowId} />
                  {chequeMode ? (
                    <>
                      <td>
                        <input type="checkbox" name="pay_cheque" value={String(idx)} defaultChecked={row.payCheque} />
                      </td>
                      <td><input name="d_reason" className="form-control" defaultValue={row.reason} /></td>
                    </>
                  ) : (
                    <>
                      <td>
                        <input
                          name={amountLabel === 'TDS' ? 'tds_amount' : 'd_amount'}
                          className="form-control"
                          defaultValue={row.amount}
                        />
                      </td>
                      {showReason && <td><input name="d_reason" className="form-control" defaultValue={row.reason} /></td>}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" className="btn btn-danger" disabled={busy}>Update</button>
        </form>
      )}
    </>
  );
}

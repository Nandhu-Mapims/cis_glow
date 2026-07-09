import { useEffect, useState } from 'react';

export default function StipendDeductionSetup({ data, load, save, busy }) {
  const [payrollMonth, setPayrollMonth] = useState(data?.selected?.payrollMonth || '');
  const [searchCategory, setSearchCategory] = useState(data?.selected?.searchCategory || '');

  useEffect(() => {
    setPayrollMonth(data?.selected?.payrollMonth || '');
    setSearchCategory(data?.selected?.searchCategory || '');
  }, [data?.selected?.payrollMonth, data?.selected?.searchCategory]);

  const onGenerate = async (e) => {
    e.preventDefault();
    await load({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      Submit: 'Generate',
    });
  };

  const onSave = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await save({
      Submit: 'Submit',
      payroll_month: payrollMonth,
      salary_month: data?.selected?.payrollMonthSql || payrollMonth,
      search_category: searchCategory,
      staff_id: form.getAll('staff_id'),
      tds_id: form.getAll('tds_id'),
      d_amount: form.getAll('d_amount'),
      d_reason: form.getAll('d_reason'),
    });
  };

  return (
    <>
      <form onSubmit={onGenerate} className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Month</label>
          <select className="form-select" required value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)}>
            <option value="">-Select Month-</option>
            {(data?.monthOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Category</label>
          <select className="form-select" required value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}>
            <option value="">--Select Category--</option>
            {(data?.categoryOptions || []).map((group) => (
              <optgroup key={group.group} label={group.group}>
                {(group.items || []).map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="col-md-4 d-flex align-items-end">
          <button type="submit" className="btn btn-info" disabled={busy}>Go</button>
        </div>
      </form>

      {data?.rows?.length > 0 ? (
        <form onSubmit={onSave}>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>#</th>
                  <th style={{ width: '15%' }}>Register No.</th>
                  <th style={{ width: '32%' }}>Student Name</th>
                  <th style={{ width: '15%' }}>Amount</th>
                  <th style={{ width: '30%' }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.staffId}>
                    <td>{row.index}</td>
                    <td>{row.staffCode}</td>
                    <td>
                      {row.name}
                      <input type="hidden" name="staff_id" value={row.staffId} />
                      <input type="hidden" name="tds_id" value={row.rowId} />
                    </td>
                    <td>
                      <input name="d_amount" className="form-control" defaultValue={row.amount} autoComplete="off" />
                    </td>
                    <td>
                      <input name="d_reason" className="form-control" defaultValue={row.reason} autoComplete="off" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="btn btn-danger btn-lg" disabled={busy}>Update</button>
        </form>
      ) : (
        <p className="text-muted small mb-0">
          Select month and category, then click Go to load students.
        </p>
      )}
    </>
  );
}

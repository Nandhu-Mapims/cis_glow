import { useEffect, useState } from 'react';

export default function WebStaffDisplayScreen({ data, busy, onLoad, onSave }) {
  const [deptId, setDeptId] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.deptId) setDeptId(String(data.deptId));
    if (data?.staffRows) setRows(data.staffRows);
  }, [data]);

  const pickDept = async (id) => {
    setDeptId(id);
    await onLoad({ deptId: id });
  };

  const updateOrder = (index, order) => {
    setRows((list) => list.map((row, i) => (i === index ? { ...row, order } : row)));
  };

  return (
    <div>
      <div className="row g-3 mb-3" style={{ maxWidth: 480 }}>
        <div className="col-12">
          <label className="form-label">Department</label>
          <select className="form-select" value={deptId} onChange={(e) => pickDept(e.target.value)}>
            <option value="">Select department</option>
            {(data?.departments || []).map((d) => (
              <option key={d.id} value={d.id}>{d.id} - {d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {rows.length > 0 && (
        <form
          className="cis-setup-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave({ deptId, rows });
          }}
        >
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>#</th>
                <th>Staff</th>
                <th>Designation</th>
                <th style={{ width: 100 }}>Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.staffId}-${row.desgId}`}>
                  <td>{index + 1}</td>
                  <td>{row.staffLabel}</td>
                  <td>{row.desgName}</td>
                  <td>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={row.order}
                      onChange={(e) => updateOrder(index, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit" className="btn btn-danger" disabled={busy}>Save order</button>
        </form>
      )}
    </div>
  );
}

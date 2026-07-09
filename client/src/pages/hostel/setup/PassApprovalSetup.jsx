import { useEffect } from 'react';

export default function PassApprovalSetup({ data, busy, onLoad, onSave }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <div className="table-responsive"><table className="table table-bordered"><thead className="table-secondary"><tr><th>Student</th><th>Type</th><th>From</th><th>To</th><th>Action</th></tr></thead><tbody>
      {(data?.rows || []).map((row) => (
        <tr key={row.id}><td>{row.studentName} ({row.registerNo})</td><td>{row.passType}</td><td>{row.fromDate}</td><td>{row.toDate}</td>
          <td className="d-flex gap-1"><button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => onSave({ id: row.id, status: 1 })}>Approve</button>
            <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => onSave({ id: row.id, status: 2 })}>Reject</button></td></tr>
      ))}
    </tbody></table></div>
  );
}

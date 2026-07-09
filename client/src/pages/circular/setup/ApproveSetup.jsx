import { useEffect } from 'react';

export default function ApproveSetup({ data, busy, onLoad, onSave }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <div className="table-responsive"><table className="table table-bordered"><thead className="table-secondary"><tr><th>Title</th><th>Audience</th><th>Action</th></tr></thead><tbody>
      {(data?.rows || []).map((row) => (
        <tr key={row.id}><td>{row.title}</td><td>{row.audienceFor}</td>
          <td className="d-flex gap-1"><button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => onSave({ id: row.id, action: 'approve' })}>Approve</button>
            <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => onSave({ id: row.id, action: 'reject' })}>Reject</button></td></tr>
      ))}
    </tbody></table></div>
  );
}

import { useEffect } from 'react';

export default function TransactionReturnSetup({ data, busy, onLoad, onSave }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <div className="table-responsive"><table className="table table-bordered"><thead className="table-secondary"><tr><th>Register</th><th>Book</th><th>Issued</th><th>Due</th><th>Return</th></tr></thead><tbody>
      {(data?.rows || []).map((row) => (
        <tr key={row.id}><td>{row.registerNo}</td><td>{row.bookId}</td><td>{row.checkOutDate}</td><td>{row.dueDate}</td>
          <td><button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => onSave({ id: row.id, returnDate: data?.returnDate, isDamage: false })}>Return</button></td></tr>
      ))}
    </tbody></table></div>
  );
}

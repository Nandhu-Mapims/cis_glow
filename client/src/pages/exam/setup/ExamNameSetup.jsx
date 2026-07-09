import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useExamSetupApi } from './useExamSetupApi';

function emptyRow(order = 1) {
  return { key: `new-${Date.now()}`, order, name: '', month: '' };
}

export default function ExamNameSetup() {
  const { data, busy, error, notice, clearNotice, load, save } = useExamSetupApi('exam-names');
  const [rows, setRows] = useState([emptyRow(1)]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.rows) {
      setRows(data.rows.map((row) => ({ ...row, key: row.id ? `id-${row.id}` : `new-${row.order}` })));
    }
  }, [data]);

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      action: 'update',
      rows: rows.map(({ id, order, name, month }) => ({ id, order, name, month })),
    });
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={clearNotice} />
      <form onSubmit={handleSave}>
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-secondary">
              <tr><th>Order</th><th>Name</th><th>Month</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key}>
                  <td><input className="form-control" value={row.order} onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, order: e.target.value } : r)))} /></td>
                  <td><input className="form-control" value={row.name} onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))} /></td>
                  <td>
                    <select className="form-select" value={row.month} onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, month: e.target.value } : r)))}>
                      <option value="">--Select--</option>
                      {(data?.monthOptions || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>{row.id ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="d-flex justify-content-between">
          <button type="button" className="btn btn-sm btn-info" onClick={() => setRows((prev) => [...prev, emptyRow(prev.length + 1)])}>+</button>
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>
      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={async () => { await save({ action: 'delete', id: deleteId }); setDeleteId(null); }} busy={busy} />
    </>
  );
}

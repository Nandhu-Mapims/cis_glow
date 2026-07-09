import { useEffect, useState } from 'react';
import { ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function CampActivityTypeSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('camp-activity-type');
  const [rows, setRows] = useState([]);
  const [newTitles, setNewTitles] = useState(['']);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data?.rows) setRows(data.rows); }, [data]);

  const updateRow = (index, title) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, title } : row)));
  };

  const addNewRow = () => setNewTitles((prev) => [...prev, '']);

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      newTitles: newTitles.filter((t) => t.trim()),
      updates: rows.map((row) => ({ id: row.id, title: row.title })),
    });
    setNewTitles(['']);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await save({ action: 'delete', deleteId });
    setDeleteId(null);
  };

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      {data?.warning ? <div className="alert alert-warning py-2">{data.warning}</div> : null}
      <form onSubmit={handleSave}>
        <div className="table-responsive">
          <table className="table table-hover table-sm">
            <thead>
              <tr><th>No.</th><th>Category</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <input className="form-control form-control-sm" value={row.title} onChange={(e) => updateRow(index, e.target.value)} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {newTitles.map((title, index) => (
                <tr key={`new-${index}`}>
                  <td />
                  <td>
                    <input className="form-control form-control-sm" value={title} placeholder="New category" onChange={(e) => setNewTitles((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))} />
                  </td>
                  <td>
                    {index === newTitles.length - 1 ? (
                      <button type="button" className="btn btn-sm btn-info" onClick={addNewRow}>+</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
      </form>

      {deleteId ? (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog"><div className="modal-content">
            <div className="modal-header"><h5 className="modal-title">Confirm</h5></div>
            <div className="modal-body">Are you sure to delete...</div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>Close</button>
              <button type="button" className="btn btn-warning" onClick={confirmDelete}>Confirm</button>
            </div>
          </div></div>
        </div>
      ) : null}
    </ExamSetupShell>
  );
}

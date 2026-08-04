import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';

function emptyRow() {
  return { key: `new-${Date.now()}`, blockType: 'Hostel', blockId: '', floor: 'Ground', blockName: '' };
}

export default function BlockSetupSetup({ data, busy, onLoad, onSave }) {
  const [rows, setRows] = useState([emptyRow()]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data?.rows) return;
    setRows(data.rows.length
      ? data.rows.map((row) => ({ ...row, key: row.id ? `id-${row.id}` : `new-${row.blockId || Date.now()}` }))
      : [emptyRow()]);
  }, [data]);

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({
      action: 'update',
      rows: rows.map(({ id, blockType, blockId, floor, blockName }) => ({
        id, blockType, blockId, floor, blockName,
      })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', id: deleteId });
    setDeleteId(null);
  };

  return (
    <>
      <form onSubmit={handleSave}>
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-secondary">
              <tr>
                <th>SNo.</th>
                <th>Block Type</th>
                <th>Block Id</th>
                <th>Floor</th>
                <th>Block Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key}>
                  <td>{index + 1}</td>
                  <td className="text-nowrap">
                    <label className="me-2">
                      <input className="me-2"
                        type="radio"
                        name={`blockType-${row.key}`}
                        checked={row.blockType === 'Hostel'}
                        onChange={() => updateRow(index, { blockType: 'Hostel' })}
                      />{' '}
                      Hostel
                    </label>
                    <label>
                      <input className="me-2"
                        type="radio"
                        name={`blockType-${row.key}`}
                        checked={row.blockType === 'Quarters'}
                        onChange={() => updateRow(index, { blockType: 'Quarters' })}
                      />{' '}
                      Quarters
                    </label>
                  </td>
                  <td>
                    <input className="form-control" value={row.blockId} onChange={(e) => updateRow(index, { blockId: e.target.value })} />
                  </td>
                  <td className="text-nowrap">
                    {[
                      { value: 'Ground', label: 'G' },
                      { value: 'First', label: '1' },
                      { value: 'Second', label: '2' },
                    ].map(({ value, label }) => (
                      <label key={value} className="me-2">
                        <input className="me-2"
                          type="radio"
                          name={`floor-${row.key}`}
                          checked={row.floor === value}
                          onChange={() => updateRow(index, { floor: value })}
                        />{' '}
                        {label}
                      </label>
                    ))}
                  </td>
                  <td>
                    <input className="form-control" value={row.blockName} onChange={(e) => updateRow(index, { blockName: e.target.value })} />
                  </td>
                  <td>
                    {row.id ? (
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)} title="Trash">
                        <i className="icon-trash" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="d-flex justify-content-between">
          <button type="button" className="btn btn-sm btn-info" onClick={() => setRows((prev) => [...prev, emptyRow()])}>+</button>
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>
      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={handleDelete} busy={busy} />
    </>
  );
}

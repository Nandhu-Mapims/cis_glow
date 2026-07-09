import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import SetupAlerts from './SetupAlerts';
import { useFeeSetupApi } from './useFeeSetupApi';

function emptyRow(order = 1) {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    feeOrder: order,
    feeId: '',
    feeType: '',
  };
}

function hydrateRows(rows) {
  if (!rows?.length) return [emptyRow(1)];
  return rows.map((row) => ({ ...row, key: `id-${row.id}` }));
}

export default function FeeTypeSetup() {
  const {
    data, busy, error, notice, clearNotice, load, save,
  } = useFeeSetupApi('type');
  const [rows, setRows] = useState([emptyRow(1)]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data?.rows) setRows(hydrateRows(data.rows));
  }, [data]);

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow(prev.length + 1)]);

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      action: 'update',
      rows: rows.map(({ id, feeOrder, feeId, feeType }) => ({
        id, feeOrder, feeId, feeType,
      })),
    });
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={clearNotice} />
    <form onSubmit={handleSave}>
      <div className="table-responsive">
        <table className="table table-bordered align-middle cis-fee-setup-table">
          <thead className="cis-fee-sheet-head">
            <tr>
              <th>Order</th>
              <th>Fee ID</th>
              <th>Fee Type</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={2}
                    value={row.feeOrder}
                    onChange={(e) => updateRow(index, { feeOrder: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={10}
                    value={row.feeId}
                    onChange={(e) => updateRow(index, { feeId: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={155}
                    value={row.feeType}
                    onChange={(e) => updateRow(index, { feeType: e.target.value })}
                  />
                </td>
                <td>
                  {row.id ? (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteId(row.id)}>
                      <i className="bi bi-trash" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex justify-content-between">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addRow}>+</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
      </div>
      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete..."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          await save({ action: 'delete', id: deleteId });
          setDeleteId(null);
        }}
        busy={busy}
      />
    </form>
    </>
  );
}

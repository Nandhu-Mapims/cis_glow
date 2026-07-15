import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import SetupAlerts from './SetupAlerts';
import { useFeeSetupApi } from './useFeeSetupApi';

function emptyRow(order = 1) {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    feeOrder: order,
    feeName: '',
    feeSname: '',
    isScholar: false,
    isValid: false,
  };
}

function hydrateRows(rows) {
  if (!rows?.length) return [emptyRow(1)];
  return rows.map((row) => ({
    ...row,
    key: `id-${row.id}`,
  }));
}

export default function FeeLabelSetup() {
  const {
    data, busy, error, notice, clearNotice, load, save,
  } = useFeeSetupApi('label');
  const [rows, setRows] = useState([emptyRow(1)]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data?.rows) {
      setRows(hydrateRows(data.rows));
    }
  }, [data]);

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(prev.length + 1)]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      action: 'update',
      rows: rows.map(({ id, feeOrder, feeName, feeSname, isScholar, isValid }) => ({
        id,
        feeOrder,
        feeName,
        feeSname,
        isScholar,
        isValid,
      })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await save({ action: 'delete', id: deleteId });
    setDeleteId(null);
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={clearNotice} />
    <form onSubmit={handleSave}>
      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead className="cis-fee-sheet-head">
            <tr>
              <th style={{ width: '10%' }}>Order</th>
              <th style={{ width: '30%' }}>Fee Name</th>
              <th style={{ width: '20%' }}>Fee Short Name</th>
              <th style={{ width: '15%' }}>Scholarship Option</th>
              <th style={{ width: '15%' }}>Enable if Previous Fee Paid</th>
              <th style={{ width: '10%' }} />
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
                    maxLength={155}
                    value={row.feeName}
                    onChange={(e) => updateRow(index, { feeName: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={70}
                    value={row.feeSname}
                    onChange={(e) => updateRow(index, { feeSname: e.target.value })}
                  />
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={row.isScholar}
                    onChange={(e) => updateRow(index, { isScholar: e.target.checked })}
                  />
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={row.isValid}
                    onChange={(e) => updateRow(index, { isValid: e.target.checked })}
                  />
                </td>
                <td>
                  {row.id ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      title="Delete"
                      onClick={() => setDeleteId(row.id)}
                    >
                      <i className="fa fa-trash" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-between align-items-center">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addRow}>+</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
      </div>

      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete..."
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        busy={busy}
      />
    </form>
    </>
  );
}

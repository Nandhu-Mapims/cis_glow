import { useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import SetupAlerts from './SetupAlerts';
import { useFeeSetupApi } from './useFeeSetupApi';

function emptyRow() {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    bankId: '',
    bankPtext: '',
    bankName: '',
    cbiAccNo: '',
    axisAccNo: '',
    sbiAccNo: '',
  };
}

function hydrateRows(rows) {
  if (!rows?.length) return [emptyRow()];
  return rows.map((row) => ({ ...row, key: `id-${row.id}` }));
}

export default function FeeBankSetup() {
  const {
    data, busy, error, notice, clearNotice, load, save,
  } = useFeeSetupApi('bank');
  const [rows, setRows] = useState([emptyRow()]);
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

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      action: 'update',
      rows: rows.map(({
        id, bankId, bankPtext, bankName, cbiAccNo, axisAccNo, sbiAccNo,
      }) => ({
        id, bankId, bankPtext, bankName, cbiAccNo, axisAccNo, sbiAccNo,
      })),
    });
  };

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={clearNotice} />
    <form onSubmit={handleSave}>
      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead className="cis-fee-sheet-head">
            <tr>
              <th>ID</th>
              <th>Pre. Text</th>
              <th>Name</th>
              <th>CBI A/c No.</th>
              <th>Axis A/c No.</th>
              <th>SBI A/c No.</th>
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
                    maxLength={10}
                    value={row.bankId}
                    onChange={(e) => updateRow(index, { bankId: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={3}
                    value={row.bankPtext}
                    onChange={(e) => updateRow(index, { bankPtext: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={155}
                    value={row.bankName}
                    onChange={(e) => updateRow(index, { bankName: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={70}
                    value={row.cbiAccNo}
                    onChange={(e) => updateRow(index, { cbiAccNo: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={70}
                    value={row.axisAccNo}
                    onChange={(e) => updateRow(index, { axisAccNo: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={70}
                    value={row.sbiAccNo}
                    onChange={(e) => updateRow(index, { sbiAccNo: e.target.value })}
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

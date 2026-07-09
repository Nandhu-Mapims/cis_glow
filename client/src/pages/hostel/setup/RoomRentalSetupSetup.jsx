import { useEffect, useState } from 'react';
import { BlockSelect } from './RoomSetupAddSetup';

export default function RoomRentalSetupSetup({ data, busy, onLoad, onSave }) {
  const [blockId, setBlockId] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.blockId !== undefined) setBlockId(data.blockId || '');
    if (data?.rows) setRows(data.rows);
  }, [data]);

  const onBlockChange = async (value) => {
    setBlockId(value);
    await onLoad({ blockId: value });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ blockId, rows });
      }}
    >
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label">Block *</label>
          <BlockSelect groups={data?.blockGroups} value={blockId} onChange={onBlockChange} required />
        </div>
      </div>
      {blockId ? (
        <>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead className="table-secondary">
                <tr>
                  <th>#</th>
                  <th>Room No</th>
                  <th>Name</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.roomPk}>
                    <td>{index + 1}</td>
                    <td>{row.roomId}</td>
                    <td>{row.roomName}{row.floorName ? ` (${row.floorName})` : ''}</td>
                    <td>
                      <input
                        className="form-control"
                        value={row.rentalAmount || ''}
                        onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, rentalAmount: e.target.value } : r)))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="btn btn-danger" disabled={busy}>Update</button>
        </>
      ) : null}
    </form>
  );
}

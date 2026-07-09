import { useEffect, useState } from 'react';

export default function ResourceTransferSetup({ data, busy, onLoad, onSave }) {
  const [accessionNo, setAccessionNo] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [receiveDate, setReceiveDate] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (!data) return;
    if (data.accessionNo) setAccessionNo(data.accessionNo);
    if (data.transferDate) setTransferDate(data.transferDate);
    if (data.receiveDate) setReceiveDate(data.receiveDate);
  }, [data]);

  const lookup = () => onLoad({ accessionNo });

  return (
    <div className="row g-3">
      <div className="col-md-8">
        <div className="row g-2 mb-3">
          <div className="col-md-4"><input className="form-control" placeholder="Book ID" value={accessionNo} onChange={(e) => setAccessionNo(e.target.value)} /></div>
          <div className="col-md-2"><button type="button" className="btn btn-primary" onClick={lookup} disabled={busy}>Go</button></div>
        </div>
        {data?.lookup?.error ? <p className="text-danger">{data.lookup.error}</p> : null}
        {data?.lookup?.book ? (
          <div className="border rounded p-3 mb-3">
            <p><strong>{data.lookup.book.resourceName}</strong></p>
            <p className="text-muted mb-0">{data.lookup.book.authorName} — {data.lookup.book.accessionNo}</p>
          </div>
        ) : null}
        {data?.lookup?.mode === 'transfer' ? (
          <form onSubmit={(e) => { e.preventDefault(); onSave({ action: 'transfer', accessionNo, transferTo, transferDate }); }} className="row g-2">
            <div className="col-md-4">
              <select className="form-select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} required>
                <option value="">Transfer to</option>
                {data.destinations?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-md-3"><input type="date" className="form-control" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} required /></div>
            <div className="col-md-3"><button type="submit" className="btn btn-danger" disabled={busy}>Transfer</button></div>
          </form>
        ) : null}
        {data?.lookup?.mode === 'return' ? (
          <form onSubmit={(e) => { e.preventDefault(); onSave({ action: 'return', transferId: data.lookup.transfer.id, receiveDate }); }} className="row g-2">
            <div className="col-md-6"><p>Transferred to: {data.lookup.transfer.transferTo} on {data.lookup.transfer.transferDate}</p></div>
            <div className="col-md-3"><input type="date" className="form-control" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} required /></div>
            <div className="col-md-3"><button type="submit" className="btn btn-danger" disabled={busy}>Return</button></div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';

// Book Return — book-first flow (parity with library_transaction.php +
// transaction_more.php). Step 1: resolve the Accession No. If exactly one open loan
// exists, the book alone determines the transaction -> Return form directly. If no
// open loan exists, this is a new-issue desk flow -> ask for the Student/Staff ID.
export default function TransactionReturnSetup({ data, busy, onLoad, onSave }) {
  const [bookId, setBookId] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [isDamage, setIsDamage] = useState(false);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    if (data.accessionNo !== undefined) setBookId(data.accessionNo || '');
    if (data.mode === 'return') {
      setReturnDate(data.returnDate || '');
      setIsDamage(false);
    }
    if (data.mode === 'issue') {
      setCheckOutDate(data.checkOutDate || '');
      setDueDate(data.dueDate || '');
    }
  }, [data]);

  const goBook = () => onLoad({ bookId });
  const goMember = () => onLoad({ bookId, registerNo });
  const clear = () => {
    setBookId('');
    setRegisterNo('');
    setReturnDate('');
    setIsDamage(false);
    setCheckOutDate('');
    setDueDate('');
    onLoad({});
  };

  const submitReturn = (e) => {
    e.preventDefault();
    onSave({ action: 'return', transId: data.transId, returnDate, isDamage });
  };
  const submitIssue = (e) => {
    e.preventDefault();
    onSave({ action: 'issue', registerNo, bookId: data.accessionNo, checkOutDate, dueDate });
  };

  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Accession No</label>
            <input
              className="form-control"
              value={bookId}
              autoFocus
              onChange={(e) => setBookId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goBook(); } }}
            />
          </div>
          <div className="col-md-2">
            <button type="button" className="btn btn-primary" onClick={goBook} disabled={busy || !bookId}>Go</button>
          </div>
          <div className="col-md-2">
            <button type="button" className="btn btn-outline-secondary" onClick={clear} disabled={busy}>Clear</button>
          </div>
        </div>
      </div>

      {data?.book ? (
        <div className="col-12">
          {data.book.error ? (
            <p className="text-danger"><strong>Oops!</strong> {data.book.error}</p>
          ) : (
            <div className="border rounded p-3">
              <p className="mb-1"><strong>{data.book.resourceName}</strong></p>
              <p className="text-muted mb-2">{data.book.authorName} — {data.book.resourceType}{data.book.isDamage ? ' (Damaged)' : ''}</p>

              {data.mode === 'return' ? (
                <form onSubmit={submitReturn} className="row g-2">
                  <div className="col-12">
                    <table className="table table-bordered mb-2">
                      <tbody>
                        <tr><td><strong>{data.holder?.name}</strong></td></tr>
                        <tr><td>{data.holder?.designation}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="col-md-3"><label className="form-label">Check-out</label><p>{data.checkOutDate}</p></div>
                  <div className="col-md-3"><label className="form-label">Due Date</label><p>{data.dueDate}</p></div>
                  <div className="col-md-3">
                    <label className="form-label">Return Date</label>
                    <input type="date" className="form-control" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
                  </div>
                  <div className="col-md-3 form-check mt-4">
                    <input type="checkbox" className="form-check-input" id="returnDamaged" checked={isDamage} onChange={(e) => setIsDamage(e.target.checked)} />
                    <label className="form-check-label" htmlFor="returnDamaged">Damaged</label>
                  </div>
                  <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Return</button></div>
                </form>
              ) : null}

              {(data.mode === 'need-member' || data.mode === 'issue' || data.mode === 'limit-exceeded') ? (
                <div className="row g-2 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label">Student / Staff ID</label>
                    <input className="form-control" value={registerNo} onChange={(e) => setRegisterNo(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goMember(); } }} />
                  </div>
                  <div className="col-md-2">
                    <button type="button" className="btn btn-primary" onClick={goMember} disabled={busy || !registerNo}>Go</button>
                  </div>

                  {data.memberError ? <div className="col-12"><p className="text-danger mb-0"><strong>Oops!</strong> {data.memberError}</p></div> : null}

                  {data.member ? (
                    <div className="col-12">
                      <table className="table table-bordered mt-2 mb-2">
                        <tbody>
                          <tr><td><strong>{data.member.name}</strong></td></tr>
                          <tr><td>{data.member.designation}</td></tr>
                          <tr><td>Issued: <strong>{data.issuedCount}</strong> / {data.limit}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {data.mode === 'limit-exceeded' ? (
                    <div className="col-12"><p className="text-danger"><strong>Oops!</strong> Issue Limit Exceed....</p></div>
                  ) : null}

                  {data.mode === 'issue' ? (
                    <form onSubmit={submitIssue} className="col-12 row g-2 mt-0">
                      <div className="col-md-3">
                        <label className="form-label">Check-out Date</label>
                        <input type="date" className="form-control" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Due Date</label>
                        <input type="date" className="form-control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                      </div>
                      <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Issue</button></div>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

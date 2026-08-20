import { useEffect, useState } from 'react';

// Book Issue — student/staff-first flow (parity with library_transaction1.php +
// transaction_more1.php). Step 1: resolve the Student/Staff ID and show their issue
// limit / currently-issued books. Step 2: resolve the Accession No and render either
// an Issue form (book free) or a Return form (this same person already holds it).
export default function TransactionIssueSetup({ data, busy, onLoad, onSave }) {
  const [registerNo, setRegisterNo] = useState('');
  const [bookId, setBookId] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [isDamage, setIsDamage] = useState(false);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    if (data.registerNo !== undefined) setRegisterNo(data.registerNo || '');
    if (data.book?.mode === 'issue') {
      setCheckOutDate(data.book.checkOutDate || '');
      setDueDate(data.book.dueDate || '');
    }
    if (data.book?.mode === 'return') {
      setReturnDate(data.book.returnDate || '');
      setIsDamage(false);
    }
  }, [data]);

  const goMember = () => onLoad({ registerNo });
  const goBook = () => onLoad({ registerNo, bookId });
  const clear = () => {
    setRegisterNo('');
    setBookId('');
    setCheckOutDate('');
    setDueDate('');
    setReturnDate('');
    setIsDamage(false);
    onLoad({});
  };

  const submitIssue = (e) => {
    e.preventDefault();
    onSave({ action: 'issue', registerNo, bookId, checkOutDate, dueDate });
  };
  const submitReturn = (e) => {
    e.preventDefault();
    onSave({ action: 'return', transId: data.book.transId, returnDate, isDamage });
  };

  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Student / Staff ID</label>
            <input
              className="form-control"
              value={registerNo}
              autoFocus
              onChange={(e) => setRegisterNo(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goMember(); } }}
            />
          </div>
          <div className="col-md-2">
            <button type="button" className="btn btn-primary" onClick={goMember} disabled={busy || !registerNo}>Go</button>
          </div>
          <div className="col-md-2">
            <button type="button" className="btn btn-outline-secondary" onClick={clear} disabled={busy}>Clear</button>
          </div>
        </div>
      </div>

      {data?.error ? <div className="col-12"><p className="text-danger mb-0"><strong>Oops!</strong> {data.error}</p></div> : null}

      {data?.member ? (
        <div className="col-12">
          <table className="table table-bordered mb-3">
            <tbody>
              <tr>
                <td width="30%" align="center" rowSpan={3}>
                  <img src={data.member.photoUrl} alt="" width="70" height="80" />
                </td>
                <td><strong>{data.member.name}</strong></td>
              </tr>
              <tr><td>{data.member.designation}</td></tr>
              <tr><td>Issued: <strong>{data.issuedCount}</strong> / {data.limit}</td></tr>
            </tbody>
          </table>
          {data.issuedBooks?.length ? (
            <table className="table table-sm table-bordered mb-3">
              <thead><tr><th>Issued Details</th></tr></thead>
              <tbody>
                {data.issuedBooks.map((b) => (
                  <tr key={b.accessionNo}><td>{b.accessionNo} : {b.resourceName}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {data.limitExceeded ? (
            <p className="text-danger"><strong>Oops!</strong> Issue Limit Exceed....</p>
          ) : (
            <div className="row g-2 align-items-end mb-3">
              <div className="col-md-4">
                <label className="form-label">Accession No</label>
                <input className="form-control" value={bookId} onChange={(e) => setBookId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); goBook(); } }} />
              </div>
              <div className="col-md-2">
                <button type="button" className="btn btn-primary" onClick={goBook} disabled={busy || !bookId}>Go</button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {data?.book ? (
        <div className="col-12">
          {data.book.error ? (
            <p className="text-danger"><strong>Oops!</strong> {data.book.error}</p>
          ) : (
            <div className="border rounded p-3">
              <p className="mb-1"><strong>{data.book.resourceName}</strong></p>
              <p className="text-muted mb-2">{data.book.authorName} — {data.book.resourceType}{data.book.isDamage ? ' (Damaged)' : ''}</p>

              {data.book.mode === 'issue' ? (
                <form onSubmit={submitIssue} className="row g-2">
                  {data.book.referenceCopyWarning ? (
                    <div className="col-12"><p className="text-danger mb-1">This is Reference Copy. It should be returned today itself.</p></div>
                  ) : null}
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

              {data.book.mode === 'return' ? (
                <form onSubmit={submitReturn} className="row g-2">
                  <div className="col-md-3"><label className="form-label">Check-out</label><p>{data.book.checkOutDate}</p></div>
                  <div className="col-md-3"><label className="form-label">Due Date</label><p>{data.book.dueDate}</p></div>
                  <div className="col-md-3">
                    <label className="form-label">Return Date</label>
                    <input type="date" className="form-control" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
                  </div>
                  <div className="col-md-3 form-check mt-4">
                    <input type="checkbox" className="form-check-input" id="issueDamaged" checked={isDamage} onChange={(e) => setIsDamage(e.target.checked)} />
                    <label className="form-check-label" htmlFor="issueDamaged">Damaged</label>
                  </div>
                  <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Return</button></div>
                </form>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

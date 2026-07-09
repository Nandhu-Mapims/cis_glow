import { useEffect, useState } from 'react';

export default function ApproveScreen({ data, busy, onLoad, onSave }) {
  const [filters, setFilters] = useState({ status: '0', fromDate: '', toDate: '', search: '', page: 1 });
  const [draft, setDraft] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!data?.filters) return;
    setFilters({
      status: data.filters.status ?? '0',
      fromDate: data.filters.fromDate ?? '',
      toDate: data.filters.toDate ?? '',
      search: data.filters.search ?? '',
      page: data.filters.page ?? 1,
    });
  }, [data?.filters]);

  useEffect(() => {
    if (!data?.selectedReceipt) return;
    setDraft(data.selectedReceipt);
    setModalOpen(true);
  }, [data?.selectedReceipt]);

  const runSearch = (next = {}) => {
    const payload = { ...filters, ...next, page: next.page ?? 1 };
    setFilters(payload);
    setDraft(null);
    setModalOpen(false);
    return onLoad(payload);
  };

  const openApprove = async (receipt) => {
    setDraft(receipt);
    setModalOpen(true);
    await onLoad({ ...filters, receiptId: receipt.id });
  };

  const closeModal = () => {
    setModalOpen(false);
    setDraft(null);
  };

  const submitDraft = async (status) => {
    if (!draft) return;
    await onSave({ ...draft, status, filters });
    closeModal();
  };

  const pagination = data?.pagination || { page: 1, pageSize: 20, total: 0, from: 0, to: 0 };
  const summary = data?.summary || { total: 0, approved: 0, pending: 0, rejected: 0 };

  return (
    <div className="row g-3">
      <div className="col-lg-9">
        <div className="card shadow-sm exam-setup-card">
          <div className="card-header bg-white fw-semibold">Filter</div>
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <label className="form-label">Search By</label>
                <input
                  className="form-control"
                  placeholder="Roll No"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">From Date</label>
                <input type="date" className="form-control" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="form-label">To Date</label>
                <input type="date" className="form-control" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
              </div>
              <div className="col-md-5">
                <label className="form-label d-block">Status</label>
                <div className="d-flex flex-wrap gap-3 align-items-center">
                  {[
                    { value: '0', label: 'Pending' },
                    { value: '1', label: 'Approved' },
                    { value: '2', label: 'Rejected' },
                  ].map((opt) => (
                    <label key={opt.value} className="form-check-label">
                      <input
                        type="radio"
                        className="form-check-input me-1"
                        name="approve_status"
                        checked={filters.status === opt.value}
                        onChange={() => setFilters({ ...filters, status: opt.value })}
                      />
                      {opt.label}
                    </label>
                  ))}
                  <button type="button" className="btn btn-info text-white" disabled={busy} onClick={() => runSearch()}>Search</button>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end mt-3 text-muted small">
              {pagination.total
                ? `Showing ${pagination.from} to ${pagination.to} of ${pagination.total} entries`
                : 'Showing 0 to 0 of 0 entries'}
            </div>

            <div className="table-responsive mt-2">
              <table className="table table-bordered table-sm mb-0">
                <thead className="table-success">
                  <tr>
                    <th>R.ID</th>
                    <th>Student</th>
                    <th>Date</th>
                    <th>Request For</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data?.receipts || []).length ? (data.receipts || []).map((r) => (
                    <tr key={r.id}>
                      <td>{r.receiptLabel || `CR${r.applicationNo}`}</td>
                      <td>
                        <strong>{r.studentName || '—'}</strong>
                        {r.studentLine ? <div className="small text-muted">{r.studentLine}</div> : null}
                      </td>
                      <td>{r.applicationDate || '—'}</td>
                      <td>{r.applyForName || '—'}</td>
                      <td>{r.statusLabel || 'Pending'}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => openApprove(r)}>
                          Approve / Reject
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="text-danger">No data found...</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {pagination.total > pagination.pageSize ? (
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy || pagination.page <= 1}
                  onClick={() => runSearch({ page: pagination.page - 1 })}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={busy || pagination.to >= pagination.total}
                  onClick={() => runSearch({ page: pagination.page + 1 })}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="col-lg-3">
        <div className="card shadow-sm exam-setup-card">
          <div className="card-header bg-white fw-semibold">Report</div>
          <div className="card-body p-0">
            <table className="table table-bordered mb-0">
              <tbody>
                <tr><td>Total</td><td>{summary.total}</td></tr>
                <tr><td>Approve</td><td>{summary.approved}</td></tr>
                <tr><td>Pending</td><td>{summary.pending}</td></tr>
                <tr><td>Rejected</td><td>{summary.rejected}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && draft ? (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Approve</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeModal} />
              </div>
              <div className="modal-body">
                <table className="table table-bordered table-sm">
                  <tbody>
                    <tr><td>Request ID</td><td>{draft.receiptLabel || `CR${draft.applicationNo}`}</td></tr>
                    <tr><td>Student</td><td>{draft.studentName}</td></tr>
                    <tr><td>Register No</td><td>{draft.registerNo}</td></tr>
                    <tr><td>Request For</td><td>{draft.applyForName}</td></tr>
                    <tr>
                      <td>Status</td>
                      <td>
                        <div className="d-flex flex-wrap gap-3">
                          {[
                            { value: 0, label: 'Pending' },
                            { value: 1, label: 'Approved & Print' },
                            { value: 2, label: 'Rejected' },
                          ].map((opt) => (
                            <label key={opt.value} className="form-check-label">
                              <input
                                type="radio"
                                className="form-check-input me-1"
                                name="draft_status"
                                checked={Number(draft.status) === opt.value}
                                onChange={() => setDraft({ ...draft, status: opt.value })}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Comments</td>
                      <td>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={draft.comments || ''}
                          onChange={(e) => setDraft({ ...draft, comments: e.target.value })}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>Year of completion</td>
                      <td><input className="form-control" value={draft.yearOfCompletion || ''} onChange={(e) => setDraft({ ...draft, yearOfCompletion: e.target.value })} /></td>
                    </tr>
                    <tr>
                      <td>Exam month / year</td>
                      <td>
                        <div className="row g-2">
                          <div className="col-md-6"><input className="form-control" placeholder="Month" value={draft.examMonth || ''} onChange={(e) => setDraft({ ...draft, examMonth: e.target.value })} /></div>
                          <div className="col-md-6"><input className="form-control" placeholder="Year" value={draft.examYear || ''} onChange={(e) => setDraft({ ...draft, examYear: e.target.value })} /></div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Conduct</td>
                      <td><input className="form-control" value={draft.conductChar || ''} onChange={(e) => setDraft({ ...draft, conductChar: e.target.value })} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Close</button>
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => submitDraft(draft.status)}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

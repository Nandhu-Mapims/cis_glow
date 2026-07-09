export default function SetupAlerts({ notice, error, busy, onDismissNotice }) {
  return (
    <>
      {notice && (
        <div className="alert alert-success alert-dismissible fade show">
          {notice}
          <button type="button" className="btn-close" aria-label="Close" onClick={onDismissNotice} />
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Working…</div>}
    </>
  );
}

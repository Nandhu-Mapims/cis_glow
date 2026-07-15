export default function SetupAlerts({ notice, error, busy, onDismissNotice }) {
  if (!notice && !error && !busy) return null;

  return (
    <div className="cis-setup-alerts" role="status" aria-live="polite">
      {notice && (
        <div className="alert alert-success alert-dismissible fade show">
          {notice}
          {onDismissNotice && (
            <button type="button" className="btn-close" aria-label="Dismiss" onClick={onDismissNotice} />
          )}
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="cis-setup-busy">Working</div>}
    </div>
  );
}

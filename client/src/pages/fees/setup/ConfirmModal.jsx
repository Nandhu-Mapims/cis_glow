export default function ConfirmModal({ show, title, message, onClose, onConfirm, busy }) {
  if (!show) return null;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title || 'Confirm'}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">{message || 'Are you sure?'}</div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Close
            </button>
            <button type="button" className="btn btn-warning" onClick={onConfirm} disabled={busy}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

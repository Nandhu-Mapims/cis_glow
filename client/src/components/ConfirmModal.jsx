import { useEffect, useRef } from 'react';

/**
 * Shared confirmation dialog for destructive / irreversible actions.
 * Focus-trapped-lite: focuses the confirm button on open and closes on Escape.
 *
 * tone: 'danger' | 'warning' | 'primary'
 */
export default function ConfirmModal({
  show,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    confirmRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show, busy, onClose]);

  if (!show) return null;

  const confirmClass = tone === 'primary' ? 'btn-primary' : tone === 'warning' ? 'btn-warning' : 'btn-danger';

  return (
    <div className="cis-modal-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
      <div className="cis-modal" role="dialog" aria-modal="true" aria-labelledby="cis-modal-title">
        <div className="cis-modal-head">
          <h3 id="cis-modal-title" className="cis-modal-title">{title}</h3>
          <button type="button" className="cis-modal-close" onClick={onClose} disabled={busy} aria-label="Close">
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </div>
        {message && <div className="cis-modal-body">{message}</div>}
        <div className="cis-modal-foot">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" ref={confirmRef} className={`btn ${confirmClass}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

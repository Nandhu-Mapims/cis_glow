import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4500;
const ICONS = {
  success: 'fa fa-check-circle',
  error: 'fa fa-exclamation-circle',
  warning: 'fa fa-exclamation-triangle',
  info: 'fa fa-info-circle',
};

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const scheduleDismiss = useCallback((id, duration) => {
    if (!duration) return;
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  const show = useCallback((message, opts = {}) => {
    const { tone = 'info', duration = DEFAULT_DURATION, title = null } = opts;
    const id = `toast-${(idSeq += 1)}`;
    setToasts((prev) => [...prev, { id, message, tone, title }]);
    scheduleDismiss(id, duration);
    return id;
  }, [scheduleDismiss]);

  const pause = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const resume = useCallback((id, duration = DEFAULT_DURATION) => {
    scheduleDismiss(id, duration);
  }, [scheduleDismiss]);

  const api = useMemo(() => ({
    show,
    success: (message, opts) => show(message, { ...opts, tone: 'success' }),
    error: (message, opts) => show(message, { ...opts, tone: 'error', duration: opts?.duration ?? 7000 }),
    warning: (message, opts) => show(message, { ...opts, tone: 'warning' }),
    info: (message, opts) => show(message, { ...opts, tone: 'info' }),
    dismiss,
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="cis-toast-region" role="region" aria-label="Notifications">
        <div className="cis-toast-stack" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`cis-toast cis-toast--${t.tone}`}
              role={t.tone === 'error' ? 'alert' : 'status'}
              onMouseEnter={() => pause(t.id)}
              onMouseLeave={() => resume(t.id)}
            >
              <i className={`${ICONS[t.tone] || ICONS.info} cis-toast-icon`} aria-hidden="true" />
              <div className="cis-toast-body">
                {t.title && <strong className="cis-toast-title">{t.title}</strong>}
                <span className="cis-toast-msg">{t.message}</span>
              </div>
              <button
                type="button"
                className="cis-toast-close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
              >
                <i className="fa fa-times" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

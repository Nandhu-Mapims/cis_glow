export function clearPayrollReportData(prev) {
  if (!prev) return prev;
  return {
    ...prev,
    reportHtml: '',
    canPrint: false,
    reportEmpty: false,
    reportMessage: '',
  };
}

export function ReportLoadingOverlay({ label }) {
  return (
    <div className="payroll-report-loading" aria-live="polite" aria-busy="true">
      <div className="loading-copy">
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}

export function isPayrollGenerating(busy, busyLabel, generatingPrefix = 'Generating') {
  return Boolean(busy && String(busyLabel || '').startsWith(generatingPrefix));
}

export function resolvePayrollBusyUi({
  busy,
  busyLabel,
  showPanel = false,
  generatingPrefix = 'Generating',
}) {
  const generating = isPayrollGenerating(busy, busyLabel, generatingPrefix);
  const panelBusy = Boolean(busy && showPanel);
  return {
    showBanner: Boolean(busy && !(generating && showPanel)),
    compactButton: Boolean(generating && showPanel),
    overlayBusy: panelBusy,
  };
}

export function PayrollBusyBanner({ busy, label }) {
  if (!busy) return null;
  return (
    <div className="alert alert-info py-2 d-flex align-items-center">
      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      {label}
    </div>
  );
}

export function PayrollPageLoader({ label = 'Loading…' }) {
  return (
    <div className="p-4 text-muted d-flex align-items-center gap-2">
      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function PayrollGenerateButton({
  busy,
  busyLabel,
  generatingPrefix = 'Generating',
  compactBusy = false,
  children = 'Go',
  className = 'btn btn-info',
  disabled = false,
  ...props
}) {
  const isGenerating = isPayrollGenerating(busy, busyLabel, generatingPrefix);
  const showGeneratingUi = isGenerating && !compactBusy;
  return (
    <button
      type="submit"
      className={`${className} d-inline-flex align-items-center gap-2`}
      disabled={disabled || busy}
      {...props}
    >
      {showGeneratingUi && (
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
      )}
      {showGeneratingUi ? 'Generating…' : children}
    </button>
  );
}

export function PayrollReportResults({
  busy,
  overlayBusy,
  busyLabel,
  showPanel,
  reportHtml,
  reportEmpty = false,
  reportMessage = '',
  panelClassName = 'payroll-report-root',
  emptyFilterMessage = 'No report data for the selected filters.',
  hintMessage = 'Select filters and click Go to generate the report.',
}) {
  const showOverlay = overlayBusy ?? busy;
  if (showPanel) {
    return (
      <div className={`card shadow-sm payroll-report-panel${showOverlay ? ' is-loading' : ''}`}>
        {showOverlay && <ReportLoadingOverlay label={busyLabel} />}
        <div className={`card-body payroll-report-content ${panelClassName}`}>
          {reportHtml ? (
            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
          ) : reportEmpty && !busy ? (
            <div className="payroll-report-empty">{reportMessage || emptyFilterMessage}</div>
          ) : (
            !busy && <p className="text-muted mb-0 payroll-report-empty">{emptyFilterMessage}</p>
          )}
        </div>
      </div>
    );
  }

  if (!busy) {
    return <p className="text-muted">{hintMessage}</p>;
  }
  return null;
}

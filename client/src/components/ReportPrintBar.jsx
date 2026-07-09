import { printReportHtml } from '../utils/printReport';

export default function ReportPrintBar({ html, label = 'Print Report', printMode = 'default' }) {
  if (!html) return null;
  return (
    <div className="d-flex justify-content-end mb-2">
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => printReportHtml(html, printMode)}>
        {label}
      </button>
    </div>
  );
}

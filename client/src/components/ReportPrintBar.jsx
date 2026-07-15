import { printReportHtml } from '../utils/printReport';

export default function ReportPrintBar({ html, label = 'Print report', printMode = 'default' }) {
  if (!html) return null;
  return (
    <div className="cis-print-bar">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => printReportHtml(html, printMode)}
      >
        {label}
      </button>
    </div>
  );
}

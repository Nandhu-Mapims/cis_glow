import { buildAttendanceReportPrintHtml } from './attendanceReportPrint';

/** Legacy term_exam_sch_print.php — callPrintHeader + att_report_span. */
export function buildExamSchedulePrintHtml({ printMeta, bannerUrl, tablesHtml }) {
  if (!printMeta) return String(tablesHtml || '');
  return buildAttendanceReportPrintHtml({
    title: printMeta.title || 'Exam Schedule',
    subtitleLine1: printMeta.subtitleLine1 || '',
    dateRange: printMeta.dateRange || '',
    bannerUrl,
    tablesHtml,
  });
}

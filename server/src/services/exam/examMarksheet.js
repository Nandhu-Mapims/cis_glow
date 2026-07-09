import { buildExamMarksheetHtml } from './examMarksheetPrint.js';

/** Legacy: term_mark_sheet_print.php */
export async function printExamMarksheet(memberId, query) {
  return buildExamMarksheetHtml(query || {}, memberId);
}

import { prisma } from '../../../../config/prisma.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { logAcademicSetup } from '../../setup/setupAudit.js';
import {
  buildPeriodCompletionReport,
  buildPeriodTableHtml,
  defaultDateRange,
  escapeHtml,
  loadDepartmentMap,
  parseInputDate,
  wrapReportPanel,
} from './reportShared.js';

const PAGE = 'department_period_completed.php';

export async function loadDepartmentPeriodCompletedReport(memberId, fields = {}, audit = {}) {
  const defaults = defaultDateRange();
  const fromDate = fields.from_date || defaults.fromDate;
  const toDate = fields.to_date || defaults.toDate;
  const departmentId = String(fields.department_id || fields.department || '').trim();
  const generate = Boolean(fields.generate || fields.Submit === 'Generate');
  let html = '';

  const deptIds = await prisma.$queryRawUnsafe(
    `SELECT GROUP_CONCAT(DISTINCT department SEPARATOR ',') AS ids FROM basic_subject_tt_tb WHERE del = 1 AND department != ''`,
  );
  const idSet = new Set();
  for (const part of String(deptIds[0]?.ids || '').split(',')) {
    const trimmed = part.trim();
    if (trimmed) idSet.add(trimmed);
  }
  const deptMap = await loadDepartmentMap();
  const departmentOptions = [...idSet]
    .filter((id) => deptMap[id])
    .map((id) => ({ value: id, label: deptMap[id] }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (generate && departmentId) {
    const fromIso = parseInputDate(fromDate);
    const toIso = parseInputDate(toDate);
    const d = escapeSql(String(departmentId));
    const { rows, totals } = await buildPeriodCompletionReport({
      fromDate,
      toDate,
      whereExtra: fromIso && toIso ? `AND (B.department = '${d}' OR B.department LIKE '%,${d}' OR B.department LIKE '${d},%' OR B.department LIKE '%,${d},%')` : '',
    });

    const table = buildPeriodTableHtml(deptMap[String(departmentId)] || 'Department', rows, totals, [
      { label: 'S.No', render: (_r, i) => i + 1 },
      { label: 'Staff ID', key: 'staffId' },
      { label: 'Name', key: 'staffName' },
      { label: 'Course', key: 'courseLabel' },
      { label: 'Subject', key: 'subjectName' },
      { label: 'Type', key: 'subjectType' },
      { label: 'Assigned', key: 'allocated', align: 'end' },
      { label: 'Actual', key: 'attended', align: 'end' },
      { label: 'Missed', key: 'missed', align: 'end' },
      { label: 'Reason', render: (r) => `OD : ${r.od} Period<br>AL : ${r.al} Period<br>UL : ${r.ul} period` },
      { label: 'Alternate', key: 'alternate' },
    ]);
    html = wrapReportPanel(`<p class="text-center">${escapeHtml(fromDate)} to ${escapeHtml(toDate)}</p>${table}`);
  }

  await logAcademicSetup(PAGE, generate ? 'Generate' : 'View', 'Successful', String(departmentId), memberId, audit);
  return { departmentOptions, department: departmentId, departmentId, fromDate, toDate, html };
}

export async function saveDepartmentPeriodCompletedReport(memberId, fields = {}, audit = {}) {
  return loadDepartmentPeriodCompletedReport(memberId, fields, audit);
}

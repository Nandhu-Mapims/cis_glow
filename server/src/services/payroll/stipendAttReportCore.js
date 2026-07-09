import { escapeSql } from '../../utils/sqlSafe.js';
import { loadAttendanceBannerUrl } from '../attendance/studentAttendanceShared.js';
import {
  escapeHtml,
  formatPayrollMonthLabel,
  loadPrintSetup,
  logPayrollPage,
} from './payrollHelpers.js';
import { parsePayrollMonthRef } from './payrollShared.js';
import {
  buildStipendAttendanceDayCell,
  computeStudentMonthAttendance,
} from './stipendAttendanceCore.js';
import {
  loadStipendCategoryOptions,
  loadStipendPayrollMonthOptions,
  resolveStipendStudents,
  studentDisplayName,
} from './stipendHelpers.js';
import { prisma } from '../../config/prisma.js';

const PAGE = 'stipend_payroll_att_report.php';

function eachDateIsoLocal(fromIso, toIso) {
  const dates = [];
  for (
    let ts = new Date(`${fromIso}T12:00:00`);
    ts <= new Date(`${toIso}T12:00:00`);
    ts.setDate(ts.getDate() + 1)
  ) {
    dates.push(
      `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}`,
    );
  }
  return dates;
}

function monthRangeFromPayrollMonth(payrollMonthRaw) {
  const payrollMonthSql = parsePayrollMonthRef(payrollMonthRaw) || payrollMonthRaw;
  if (!payrollMonthSql) {
    return { payrollMonthSql: '', fromIso: '', toIso: '', pmonth: null, tmonth: null };
  }
  const monthDate = new Date(`${payrollMonthSql}T00:00:00`);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const fromIso = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const toIso = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;
  return {
    payrollMonthSql: fromIso,
    fromIso,
    toIso,
    pmonth: Math.floor(monthDate.getTime() / 1000),
    tmonth: Math.floor(monthEnd.getTime() / 1000),
  };
}

function epochToLocalIso(epoch) {
  const d = new Date(epoch * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatStatementDayLabel(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dd}-${mm}-${yy} | ${days[d.getDay()]}`;
}

function buildStatementDayHeaders(fromIso, toIso) {
  let header = '';
  for (const dateIso of eachDateIsoLocal(fromIso, toIso)) {
    header += `<th width="20" nowrap class="valign_btm"><div class="att_vtext">${escapeHtml(formatStatementDayLabel(dateIso))}</div></th>`;
  }
  return header;
}

function buildAttReportTableHtml(reportType, fromIso, toIso) {
  const headHeight = reportType === 'Statement' ? '100' : '30';
  let header = `<table border="0" cellpadding="0" cellspacing="0" class="table table-bordered" id="payroll">
<thead><tr>
<th height="${headHeight}" width="30">S.No</th>
<th width="100" nowrap>Register No</th>
<th width="200">Student Name</th>`;

  if (reportType === 'Statement') {
    header += buildStatementDayHeaders(fromIso, toIso);
  }

  header += `<th width="40">T.D</th>
<th width="40">W.D</th>
<th width="40">Pr</th>
<th width="40">Ab</th>
<th width="40">La</th>
<th width="40">Pe</th>
<th width="40">Le</th>
<th width="40">LOP</th>
<th width="40">%</th>
</tr></thead><tbody></tbody></table>`;
  return header;
}

function buildStipendAttPrintMeta(printSetup, reportType, payrollMonthSql) {
  return {
    title: reportType === 'Report'
      ? (printSetup.title || 'Attendance Report')
      : 'Attendance Statement',
    subtitleLine1: printSetup.sub_title || printSetup.body_title || '',
    dateRange: formatPayrollMonthLabel(payrollMonthSql),
  };
}

function buildAttendanceReportRow(counter, registerNo, name, stats, reportType) {
  let dayCellsHtml = '';
  if (reportType === 'Statement') {
    for (const day of stats.dayAttendance || []) {
      dayCellsHtml += buildStipendAttendanceDayCell(day.attendance);
    }
  }

  return `<tr>
<td>${counter}</td>
<td>${registerNo}</td>
<td nowrap>${name}</td>
${dayCellsHtml}
<td align="right">${stats.totalDays}</td>
<td align="right">${stats.workingDays}</td>
<td align="right">${stats.present}</td>
<td align="right">${stats.absent}</td>
<td align="right">${stats.late}</td>
<td align="right">${stats.permission}</td>
<td align="right">${stats.leave}</td>
<td align="right">${stats.lop}</td>
<td align="right">${stats.percent}</td>
</tr>`;
}

export async function loadStipendAttReport(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadStipendPayrollMonthOptions(false);
  const payrollMonthRaw = String(fields.payroll_month || '').trim();
  const reportType = String(fields.report_type || '').trim() === 'Report' ? 'Report' : 'Statement';
  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);
  const isGenerate = fields.Submit === 'Generate';

  const { payrollMonthSql, fromIso, toIso, pmonth, tmonth } = monthRangeFromPayrollMonth(payrollMonthRaw);
  const categoryOptions = await loadStipendCategoryOptions(searchCategory);
  const printSetup = await loadPrintSetup('2');
  const bannerUrl = await loadAttendanceBannerUrl();
  let students = [];
  let reportHtml = '';

  if (isGenerate && payrollMonthSql && searchCategory.length) {
    students = await resolveStipendStudents(searchCategory, payrollMonthSql);
    reportHtml = buildAttReportTableHtml(reportType, fromIso, toIso);
    await logPayrollPage(
      PAGE,
      'Generate',
      `${searchCategory.join(',')} __ ${payrollMonthSql}`,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(PAGE, 'View', payrollMonthSql, memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    selected: {
      payrollMonth: payrollMonthRaw,
      payrollMonthSql,
      searchCategory,
      reportType,
    },
    students,
    pmonth,
    tmonth,
    acYear: searchCategory[0]?.split('_')[2] || '',
    reportHtml,
    printMeta: payrollMonthSql
      ? buildStipendAttPrintMeta(printSetup, reportType, payrollMonthSql)
      : null,
    bannerUrl,
    signatureHtml: printSetup.signatureHtml || '',
  };
}

export async function runStipendAttReportMore(memberId, query = {}) {
  void memberId;
  const flag = Number(query.flag) || 0;
  if (flag !== 1) return { error: 'Invalid flag' };

  const registerNo = String(query.s_staff || '').trim();
  const pmonth = Number(query.pmonth);
  const tmonth = Number(query.tmonth) || pmonth;
  const counter = Number(query.id) + 1;
  const acYear = String(query.ac_year || '');
  const reportType = String(query.report_type || query.report_type1 || 'Statement').trim() === 'Report'
    ? 'Report'
    : 'Statement';

  if (!registerNo || !pmonth) return { error: 's_staff and pmonth required' };

  const payrollMonthRef = epochToLocalIso(pmonth);
  const toDateRef = epochToLocalIso(tmonth);

  const profileRows = await prisma.$queryRawUnsafe(
    `SELECT student_title, student_name, student_initial
     FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(registerNo)}' LIMIT 1`,
  );
  const profile = profileRows[0];
  if (!profile) return { body: JSON.stringify(['']) };

  const stats = await computeStudentMonthAttendance(registerNo, payrollMonthRef, toDateRef, acYear);
  const name = studentDisplayName(profile);
  const rowHtml = buildAttendanceReportRow(counter, registerNo, name, stats, reportType);

  return { body: JSON.stringify([rowHtml]) };
}

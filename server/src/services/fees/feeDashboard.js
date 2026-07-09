import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatIndianMoney, loadAcademicYearSetup, parseDisplayDate } from './feeHelpers.js';
import { buildDashboardDrilldownReport } from './feeDashboardReport.js';
import { loadLegacyDashboardKpis } from './feeDashboardLegacyKpis.js';
import { insertLog } from '../logService.js';

const DASHBOARD_STYLES = `
.clevent{ cursor:pointer; }
`;

const dashboardCache = new Map();
const CACHE_TTL_MS = 120_000;

function feeGridKey(courseId, classYear) {
  return `${courseId}|${classYear}`;
}

function dayEndExclusive(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return escapeSql(d.toISOString().slice(0, 10));
}

async function loadCollectionStats(curDateIso) {
  const cur = escapeSql(curDateIso);
  const curEnd = dayEndExclusive(curDateIso);
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      COALESCE(SUM(CASE WHEN paid_date >= '${cur} 00:00:00' AND paid_date < '${curEnd} 00:00:00' THEN total_amount ELSE 0 END), 0) AS today,
      COALESCE(SUM(CASE WHEN paid_date >= DATE_SUB('${cur} 00:00:00', INTERVAL 1 DAY) AND paid_date < '${cur} 00:00:00' THEN total_amount ELSE 0 END), 0) AS yesterday,
      COALESCE(SUM(CASE WHEN paid_date >= DATE_SUB('${cur} 00:00:00', INTERVAL 7 DAY) AND paid_date < '${curEnd} 00:00:00' THEN total_amount ELSE 0 END), 0) AS week,
      COALESCE(SUM(CASE WHEN YEAR(paid_date) = YEAR('${cur}') AND MONTH(paid_date) = MONTH('${cur}') THEN total_amount ELSE 0 END), 0) AS month,
      COALESCE(SUM(CASE WHEN YEAR(paid_date) = YEAR(DATE_SUB('${cur}', INTERVAL 1 MONTH)) AND MONTH(paid_date) = MONTH(DATE_SUB('${cur}', INTERVAL 1 MONTH)) THEN total_amount ELSE 0 END), 0) AS last_month,
      COALESCE(SUM(CASE WHEN YEAR(paid_date) = YEAR(DATE_SUB('${cur}', INTERVAL 2 MONTH)) AND MONTH(paid_date) = MONTH(DATE_SUB('${cur}', INTERVAL 2 MONTH)) THEN total_amount ELSE 0 END), 0) AS prev_month
    FROM student_fee
    WHERE del = 1
      AND paid_date >= DATE_SUB('${cur} 00:00:00', INTERVAL 2 MONTH)
      AND paid_date < '${curEnd} 00:00:00'
  `);

  const row = rows[0] || {};
  return {
    today: Number(row.today || 0),
    yesterday: Number(row.yesterday || 0),
    week: Number(row.week || 0),
    month: Number(row.month || 0),
    lastMonth: Number(row.last_month || 0),
    prevMonth: Number(row.prev_month || 0),
    cur: curDateIso,
  };
}

async function loadFeeAmountGrid() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT course_id, class_year, COALESCE(SUM(fee_amount), 0) AS total
     FROM fee_name_master
     WHERE del = 1
     GROUP BY course_id, class_year`,
  );
  const grid = new Map();
  for (const row of rows) {
    grid.set(feeGridKey(row.course_id, row.class_year), Number(row.total || 0));
  }
  return grid;
}

async function loadFeePaidGrid(curDateIso, academicYear) {
  const cur = escapeSql(curDateIso);
  const curEnd = dayEndExclusive(curDateIso);
  const ay = escapeSql(academicYear);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT course_id, class_year, COALESCE(SUM(fee_amount), 0) AS total
     FROM student_fee
     WHERE del = 1
       AND academic_year = '${ay}'
       AND paid_date < '${curEnd} 00:00:00'
     GROUP BY course_id, class_year`,
  );
  const grid = new Map();
  for (const row of rows) {
    grid.set(feeGridKey(row.course_id, row.class_year), Number(row.total || 0));
  }
  return grid;
}

async function buildCourseSummaryTable(curDateIso, academicYear) {
  const [courses, amountGrid, paidGrid] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, course_name, degree_name, course_duration FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
    ),
    loadFeeAmountGrid(),
    loadFeePaidGrid(curDateIso, academicYear),
  ]);

  let html = '<table class="table table-bordered table-sm cis-fee-dash-table"><thead><tr><th>Course</th><th>Year</th><th class="text-end">Fee Amount</th><th class="text-end">Fee Paid</th><th class="text-end">Fee Pending</th></tr></thead><tbody>';
  let feeAmount = 0;
  let feePaid = 0;

  for (const course of courses) {
    const duration = Number(course.course_duration) || 1;
    for (let yr = 1; yr <= duration; yr += 1) {
      const key = feeGridKey(course.id, yr);
      const amount = amountGrid.get(key) || 0;
      const paid = paidGrid.get(key) || 0;
      const pending = Math.max(amount - paid, 0);
      feeAmount += amount;
      feePaid += paid;
      html += `<tr>
        <td>${course.degree_name} (${course.course_name})</td>
        <td>Year ${yr}</td>
        <td align="right">${formatIndianMoney(amount)}</td>
        <td align="right">${formatIndianMoney(paid)}</td>
        <td align="right" class="clevent cis-fee-pending-cell" title="Click for student-level report" onclick="callFeeReport('${course.course_name}','${academicYear}','regular','${yr}','${curDateIso}','regular','','0','0','0')">${formatIndianMoney(pending)}</td>
      </tr>`;
    }
  }
  html += '</tbody></table>';
  return {
    html,
    totals: {
      feeAmount,
      feePaid,
      feePending: Math.max(feeAmount - feePaid, 0),
    },
  };
}

async function loadAuxiliaryTotals(academicYear) {
  const ay = escapeSql(academicYear);
  const [scholarshipRows, dmeRows, acmecRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(s_amount), 0) AS total FROM student_fee_scholarship WHERE del = 1 AND academic_year = '${ay}'`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(s_amount), 0) AS total FROM student_fee_dme WHERE del = 1 AND academic_year = '${ay}'`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(s_amount), 0) AS total FROM student_fee_acmec WHERE del = 1 AND academic_year = '${ay}'`,
    ),
  ]);
  return {
    scholarship: Number(scholarshipRows[0]?.total || 0),
    dme: Number(dmeRows[0]?.total || 0),
    acmec: Number(acmecRows[0]?.total || 0),
  };
}

function buildKpiCard(amount, label) {
  return `<div class="cis-fee-kpi-card">
    <div class="cis-fee-kpi-value">₹ ${formatIndianMoney(amount)}</div>
    <footer class="pie-foot-s">${label}</footer>
  </div>`;
}

function buildQuickSummaryHtml({ years, asOfDate, overall }) {
  const yearBlocks = (years || []).slice(0, 4).map((year) => `
    <div class="cis-fee-quick-summary-year">
      <p class="cis-fee-quick-summary-meta mb-2">
        Academic Year <strong>${year.academicYear}</strong>
      </p>
      <div class="cis-fee-kpi-grid">
        ${buildKpiCard(year.feeAmount, 'Fee Amount')}
        ${buildKpiCard(year.feePaid, 'Fee Paid')}
        ${buildKpiCard(year.feeUnpaid, 'Fee Unpaid')}
        ${buildKpiCard(year.scholarship, 'Scholarship')}
        ${buildKpiCard(year.dme, 'DME Tuition Fee')}
        ${buildKpiCard(year.acmec, 'ACMEC Scholarship')}
      </div>
    </div>`).join('');

  const overallBlock = overall ? `
    <div class="cis-fee-quick-summary-year cis-fee-quick-summary-overall">
      <p class="cis-fee-quick-summary-meta mb-2"><strong>Overall unpaid</strong></p>
      <div class="cis-fee-kpi-grid cis-fee-kpi-grid--compact">
        ${buildKpiCard(overall.unpaidCollege, 'College')}
        ${buildKpiCard(overall.unpaidHostel, 'Hostel')}
        ${buildKpiCard(overall.unpaidExam, 'Exam')}
        ${buildKpiCard(overall.unpaidStationary, 'Stationary')}
        ${buildKpiCard(overall.scholarship, 'Scholarship')}
        ${buildKpiCard(overall.dme, 'DME')}
      </div>
    </div>` : '';

  return `<div class="col-sm-4" id="fee-quick-summary-panel"><section class="panel cis-fee-quick-summary">
    <header class="panel-heading"><strong>Quick Summary</strong></header>
    <div class="panel-body cis-fee-quick-summary-scroll">
      <p class="text-muted small mb-2">As of ${asOfDate}</p>
      ${yearBlocks}
      ${overallBlock}
      <p class="text-muted small mb-0 mt-2">Drill-down on pending cells opens the student-level report.</p>
    </div>
  </section></div>`;
}

function buildQuickSummaryPlaceholder() {
  return `<div class="col-sm-4" id="fee-quick-summary-panel"><section class="panel cis-fee-quick-summary">
    <header class="panel-heading"><strong>Quick Summary</strong></header>
    <div class="panel-body text-muted p-3"><!--FEE_QUICK_SUMMARY_BODY-->Loading summary…</div>
  </section></div>`;
}

function buildCollectionHtml(stats, curDateIso) {
  const curMonthLabel = new Date(curDateIso).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const lastMonthDate = new Date(curDateIso);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const prevMonthDate = new Date(curDateIso);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 2);

  return `<div class="col-sm-4"><section class="panel"><header class="panel-heading"><strong>Fee Collection</strong></header>
    <div class="panel-body"><table class="table table-bordered"><thead><tr><th>Period</th><th>Amount</th></tr></thead><tbody>
      <tr><td>Today</td><td class="text-right">${formatIndianMoney(stats.today)}</td></tr>
      <tr><td>Yesterday</td><td class="text-right">${formatIndianMoney(stats.yesterday)}</td></tr>
      <tr><td>Last 7 days</td><td class="text-right">${formatIndianMoney(stats.week)}</td></tr>
      <tr><td>${curMonthLabel}</td><td class="text-right">${formatIndianMoney(stats.month)}</td></tr>
      <tr><td>${lastMonthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</td><td class="text-right">${formatIndianMoney(stats.lastMonth)}</td></tr>
      <tr><td>${prevMonthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</td><td class="text-right">${formatIndianMoney(stats.prevMonth)}</td></tr>
    </tbody></table></div></section></div>`;
}

function buildDashboardHtml({ curDateIso, acYear, pgYear, summaryTable, stats, quickSummaryHtml }) {
  return `
<div class="row"><section class="panel"><header class="panel-header"><strong>Fee Dashboard</strong> <small>as of ${curDateIso}</small></header></section></div>
<div class="row">
  <div class="col-sm-4"><section class="panel"><header class="panel-heading"><strong>Fee Amount / Paid / Pending</strong></header>
    <div class="dashboard-panel">${summaryTable}</div></section></div>
  ${buildCollectionHtml(stats, curDateIso)}
  ${quickSummaryHtml}
</div>`;
}

export async function loadFeeDashboard(payload, memberId) {
  const curDateIso = parseDisplayDate(payload.attendanceDate);
  const phase = payload.phase === 'summary' || payload.phase === 'table' || payload.phase === 'kpis'
    ? payload.phase
    : 'full';
  const bypassCache = payload.refresh === true || phase !== 'full';
  const cacheKey = `${curDateIso}:${phase}`;

  if (phase === 'full' && !bypassCache) {
    const cached = dashboardCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const academicYears = await loadAcademicYearSetup(prisma);
  const acYear = academicYears['U.G']?.regular || academicYears['P.G']?.regular || '';
  const pgYear = academicYears['P.G']?.regular || '';

  if (phase === 'summary') {
    const stats = await loadCollectionStats(curDateIso);
    const html = `
<div class="row"><section class="panel"><header class="panel-header"><strong>Fee Dashboard</strong> <small>as of ${curDateIso}</small></header></section></div>
<div class="row">
  <div class="col-sm-4"><section class="panel"><header class="panel-heading"><strong>Fee Amount / Paid / Pending</strong></header>
    <div class="dashboard-panel text-muted p-3">Loading course summary…</div></section></div>
  ${buildCollectionHtml(stats, curDateIso)}
  ${buildQuickSummaryPlaceholder()}
</div>`;
    return { phase, html, styles: DASHBOARD_STYLES, stats, academicYear: acYear };
  }

  if (phase === 'table') {
    const { html: summaryTable, totals } = await buildCourseSummaryTable(curDateIso, acYear);
    return { phase, summaryTable, totals, academicYear: acYear };
  }

  if (phase === 'kpis') {
    const displayDate = payload.attendanceDate || '';
    const legacyKpis = await loadLegacyDashboardKpis(displayDate);
    const quickSummaryHtml = buildQuickSummaryHtml({
      years: legacyKpis.years,
      overall: legacyKpis.overall,
      asOfDate: curDateIso,
    });
    return { phase, quickSummaryHtml, years: legacyKpis.years, overall: legacyKpis.overall };
  }

  const [stats, summaryResult, legacyKpis] = await Promise.all([
    loadCollectionStats(curDateIso),
    buildCourseSummaryTable(curDateIso, acYear),
    loadLegacyDashboardKpis(payload.attendanceDate || '').catch((err) => {
      console.error('Legacy fee dashboard KPI load failed:', err.message);
      return { years: [], overall: null };
    }),
  ]);
  const quickSummaryHtml = buildQuickSummaryHtml({
    years: legacyKpis.years,
    overall: legacyKpis.overall,
    asOfDate: curDateIso,
  });

  const html = buildDashboardHtml({
    curDateIso,
    acYear,
    pgYear,
    summaryTable: summaryResult.html,
    stats,
    quickSummaryHtml,
  });

  insertLog(
    ['fee_dashboard_v2', 'View', 'Successful', curDateIso, new Date(), '', '', memberId],
    '',
  ).catch((err) => console.error('Fee dashboard audit write failed:', err));

  const result = { html, styles: DASHBOARD_STYLES, stats, academicYear: acYear };
  dashboardCache.set(`${curDateIso}:full`, { at: Date.now(), data: result });
  return result;
}

export async function loadFeeDashboardReport(payload, memberId) {
  const result = await buildDashboardDrilldownReport(payload);
  if (result.error) return result;
  insertLog(
    ['fee_dashboard_report_v2', 'Generate', 'Successful', JSON.stringify(payload), new Date(), '', '', memberId],
    '',
  ).catch((err) => console.error('Fee dashboard report audit write failed:', err));
  return result;
}

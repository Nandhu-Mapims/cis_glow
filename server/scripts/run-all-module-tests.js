#!/usr/bin/env node
/**
 * Full module smoke + latency test suite.
 * Usage: node scripts/run-all-module-tests.js [--http] [--json]
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { prisma } from '../src/config/prisma.js';
import { signToken, createSessionId } from '../src/utils/jwt.js';
import { config } from '../src/config/index.js';

import { loadStudentScreen, STUDENT_SCREEN_SLUGS } from '../src/services/students/studentModuleScreens.js';
import { loadStaffSetupScreen, STAFF_SETUP_SLUGS } from '../src/services/staff/staffModuleSetup.js';
import { loadStaffScreen, STAFF_SCREEN_SLUGS } from '../src/services/staff/staffModuleScreens.js';
import { loadStaffAttSetupScreen } from '../src/services/attendance/staffAttendanceSetup.js';
import { loadStaffAttScreen, STAFF_ATT_SCREEN_SLUGS } from '../src/services/attendance/staffAttendanceScreens.js';
import { buildStaffAttendanceCalendar } from '../src/services/attendance/staffCalendar.js';
import { buildStaffAttendanceReport } from '../src/services/attendance/staffReport.js';
import { loadStudentAttScreen, STUDENT_ATT_SCREEN_SLUGS } from '../src/services/attendance/studentAttendanceScreens.js';
import { loadFeeSetupScreen } from '../src/services/fees/feeSetup.js';
import { getFeeFilterOptions } from '../src/services/fees/feeFilters.js';
import { listMyFeeDeleteRequests, listPendingFeeDeleteApprovals } from '../src/services/fees/feeDelete.js';
import { loadPendingSmsClasses } from '../src/services/fees/feePendingSms.js';
import { loadPendingLetterForm } from '../src/services/fees/feePendingLetter.js';
import { loadScholarshipSetup } from '../src/services/fees/feeScholarshipSetup.js';
import { loadDmeSetup } from '../src/services/fees/feeDmeSetup.js';
import { loadAcmecScholarshipSetup } from '../src/services/fees/feeAcmecScholarshipSetup.js';
import { loadAcmecConfig } from '../src/services/fees/feeAcmecConfig.js';
import { loadAcademicSetupScreen } from '../src/services/academic/academicSetup.js';
import { CURRICULUM_SCREEN_SLUGS } from '../src/services/academic/curriculumScreenRegistry.js';
import { loadExamSetupScreen } from '../src/services/exam/examSetup.js';
import { loadExamDashboard } from '../src/services/exam/examDashboard.js';
import { loadElearnDashboard, loadElearningScreen } from '../src/services/elearning/elearningSetup.js';
import { loadPayrollSetupScreen } from '../src/services/payroll/payrollSetup.js';
import { loadGeneratePayroll } from '../src/services/payroll/generatePayrollCore.js';
import { loadPayrollAttReport } from '../src/services/payroll/payrollAttReportCore.js';
import { loadPayrollMonthlyReport } from '../src/services/payroll/payrollMonthlyReportCore.js';
import { loadPayrollTaxReport } from '../src/services/payroll/payrollTaxReportCore.js';
import { loadStipendGeneratePayroll } from '../src/services/payroll/stipendGenerateCore.js';
import { loadStipendAttReport } from '../src/services/payroll/stipendAttReportCore.js';
import { loadStipendReport } from '../src/services/payroll/stipendReportsCore.js';
import { loadStipendIndividualPdfReport } from '../src/services/payroll/stipendIndividualPdfReport.js';
import { loadHostelSetupScreen } from '../src/services/hostel/hostelSetup.js';
import { loadLibrarySetupScreen } from '../src/services/library/librarySetup.js';
import { fetchWidgets } from '../src/services/dashboard/widgetDispatcher.js';
import { loadStudentDashboardShell, loadStaffPatternShell } from '../src/services/dashboard/dashboardScreens.js';
import { loadOverallStrengthReport } from '../src/services/dashboard/studentStrengthOverall.js';
import { loadCommunityStrengthReport } from '../src/services/dashboard/studentCommunityStrength.js';
import { renderStaffUnit1, renderStaffUnit2 } from '../src/services/dashboard/widgets/staffUnitRoster.js';
import { loadPortfolioDashboard } from '../src/services/portfolio/portfolioDashboard.js';
import { loadPortfolioIndividualReport } from '../src/services/portfolio/portfolioIndividualReport.js';
import { loadAdminSetupScreen } from '../src/services/admin/adminSetup.js';
import { loadSettingsSetupScreen } from '../src/services/settings/settingsSetup.js';
import { loadSmsScreen } from '../src/services/sms/smsSetup.js';
import { loadWebScreen, NATIVE_SCREENS as WEB_SCREENS } from '../src/services/web/webSetup.js';
import { loadTvScreen } from '../src/services/tv/tvSetup.js';
import { loadKioskScreen } from '../src/services/kiosk/kioskSetup.js';
import { loadCommitteeScreen } from '../src/services/committee/committeeSetup.js';
import { loadCertificateScreen } from '../src/services/certificate/certificateSetup.js';
import { loadNaacScreen } from '../src/services/naac/naacSetup.js';
import { loadAdminOfficeSetupScreen } from '../src/services/adminOffice/adminOfficeSetup.js';
import { loadCircularSetupScreen } from '../src/services/circular/circularSetup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };
const WARN_MS = Number(process.env.TEST_WARN_MS || 2000);
const SLOW_MS = Number(process.env.TEST_SLOW_MS || 5000);
const API_BASE = process.env.API_URL || 'http://localhost:4000';
const args = new Set(process.argv.slice(2));
const RUN_HTTP = args.has('--http') || args.has('--all');
const WRITE_JSON = args.has('--json') || args.has('--all');

const EXAM_SCREENS = [
  'exam-names', 'exam-setup', 'exam-nodue', 'exam-schedule', 'exam-batch', 'mark-sheet',
  'exam-examiners', 'exam-attendance-certificate', 'examiner-setup', 'camp-activity-add',
  'camp-activity-edit', 'camp-activity-type', 'mark-entry', 'attendance-entry', 'attendance-report',
  'marks-upload', 'sheets-upload', 'sheets-status', 'mark-sheet-status', 'mark-sheet-received',
  'term-statement', 'term-report', 'report-analysis', 'report-analysis-v1', 'progress-card',
  'exam-sms', 'schedule-print', 'invigilator-print', 'omr-config',
];

const ELEARNING_SCREENS = ['elearn-dashboard', 'elearn-setup', 'elearn-report'];

const ACADEMIC_BASE = [
  'subject-master', 'academic-years', 'master-setup', 'subject-setup', 'subject-batch',
  'subject-unit', 'subject-schedule', 'tt-config', 'subject-report', 'timetable-report',
  'batch-timetable-report',
];

const FEE_SETUP = ['label', 'type', 'bank', 'fine', 'name'];

const PAYROLL_SETUP = [
  'individual-setup', 'cron-setup', 'stipend-amount-setup', 'stipend-deduction-add',
  'stipend-payroll-close', 'payroll-config', 'pf-esi-setup', 'salary-add', 'salary-report',
  'salary-advance-add', 'salary-advance-close', 'salary-arrear-add', 'salary-arrear-release',
  'other-deduction', 'lop-deduction', 'tds-add', 'cheque-payment', 'security-deposit-add',
  'security-deposit-close', 'payroll-close',
];

const HOSTEL_SCREENS = [
  'dashboard', 'block-setup', 'room-setup-add', 'room-setup-edit', 'room-rental-setup',
  'transport-add', 'transport-edit', 'transport-stopping-setup', 'transport-fee-config',
  'student-hostel', 'att-setup', 'attendance-report', 'pass-approval', 'pass-report', 'staff-rental',
];

const LIBRARY_SCREENS = [
  'dashboard', 'book-category', 'book-add', 'book-edit', 'book-report', 'transaction-issue',
  'transaction-return', 'transaction-setup', 'transaction-report', 'entry-report', 'attendance',
  'att-entry', 'att-report', 'supplier-add', 'supplier-edit', 'resources-report',
  'resources-barcode', 'resource-transfer',
];

const ADMIN_SCREENS = [
  'account-add', 'account-edit', 'access-restriction', 'dept-auth', 'dept-auth-v1', 'menu-auth',
  'dashboard-access', 'change-password', 'otp-reset', 'committee-access', 'staff-auth-hod',
  'staff-auth-page',
];

const SETTINGS_SCREENS = [
  'designation', 'd-order', 'staff-master', 'staff-edu-master', 'approval', 'college', 'hospital',
  'budget', 'print-setup', 'print-style', 'lesson-plan', 'signature', 'payroll-emailer', 'sms-cron',
];

const SMS_SCREENS = [
  'student-sms', 'staff-sms', 'group-sms', 'parent-meeting-sms', 'sms-history', 'sms-template',
  'sms-template-add', 'sms-template-edit', 'group-add', 'group-edit',
];

const TV_SCREENS = [
  'slider-widget', 'slider-config', 'dashboard-access', 'slider-access', 'photo-gallery',
  'video-gallery', 'api-gallery', 'youtube-gallery', 'live-video', 'print-style',
];

const KIOSK_SCREENS = [
  'machine-access', 'machine-room-add', 'machine-room-edit', 'student-password', 'staff-password', 'machine-slider',
  'slider-widget', 'att-menu', 'att-menu-access', 'att-instruction', 'staff-pin-reset',
  'student-pin-reset', 'att-statement', 'announcement-add', 'announcement-edit', 'receipt-setup',
];

const COMMITTEE_SCREENS = [
  'dashboard', 'committee-report', 'committee-add', 'committee-edit', 'committee-member',
  'designation', 'event-type', 'task-category', 'client-add', 'client-edit', 'task-colour',
  'task-type', 'task-wtype', 'task-participator', 'task-misc', 'task-doc-type', 'task-time-sheet',
  'task-budget-expenses', 'task-event-org', 'task-dashboard', 'task-allocation',
  'task-allocation-v2', 'task-manage-report', 'task-document', 'task-budget-approved',
  'approve-event', 'approve-event-report', 'approve-reschedule', 'tv-academic-event',
  'tv-academic-print',
];

const CERTIFICATE_SCREENS = [
  'setup', 'approve', 'generate', 'receipt-add', 'receipt-edit', 'receipt-report',
  'cert-request', 'tc-details', 'tc-request-add', 'tc-request-edit', 'tc-generate',
  'internship-schedule', 'internship-generate', 'internship-photo', 'implant-cert', 'laser-cert',
];

const NAAC_SCREENS = ['qual', 'quan', 'quan-report', 'quan-detailed-report'];

const ADMIN_OFFICE_SCREENS = [
  'student-activities-add', 'student-activities-edit', 'staff-activities-add', 'staff-activities-edit',
  'courier-add', 'courier-edit', 'courier-report', 'incident-add', 'incident-edit',
  'incident-report', 'events-group-add',
];

const CIRCULAR_SCREENS = [
  'dashboard', 'add', 'edit', 'approve', 'report', 'print-student', 'print-staff',
  'print-department', 'setup',
];

const STAFF_ATT_SETUP = ['calendar-add', 'calendar-edit', 'working-day', 'att-time'];

const DASHBOARD_WIDGETS = [
  'staff_attendance', 'staff_attendance_incampus', 'staff_leave_absent', 'staff_details',
  'staff_permission', 'staff_unit', 'staff_current', 'ug_attendance', 'ug_attendance_add',
  'pg_attendance', 'pg_attendance_dept', 'pg_leave_absent', 'pg_permission',
  'internship_attendance', 'internship_attendance_batch', 'internship_leave_absent',
  'internship_permission', 'student_details', 'student_add_details', 'student_hostel',
  'gents_hostel_attendance', 'ladies_hostel_attendance', 'student_ghostel', 'student_lhostel',
  'student_scholarship', 'feedback_analyasis',
];

function screenTests(module, loader, screens, extraArgs = []) {
  return screens.map((screen) => ({
    module,
    name: screen,
    fn: () => loader(screen, {}, MEMBER_ID, ...extraArgs, audit),
  }));
}

function customTests(module, entries) {
  return entries.map(([name, fn, options = {}]) => ({ module, name, fn, ...options }));
}

function buildServiceTests() {
  const academicScreens = [...ACADEMIC_BASE, ...CURRICULUM_SCREEN_SLUGS];
  const today = new Date().toISOString().slice(0, 10);
  const dateUnix = Math.floor(new Date(`${today}T12:00:00`).getTime() / 1000);

  return [
    ...STUDENT_SCREEN_SLUGS.map((screen) => ({
      module: 'student',
      name: screen,
      fn: () => loadStudentScreen(screen, {}, MEMBER_ID, audit),
    })),
    ...screenTests('staff-setup', loadStaffSetupScreen, STAFF_SETUP_SLUGS, [{}]),
    ...STAFF_SCREEN_SLUGS.map((screen) => ({
      module: 'staff',
      name: screen,
      fn: () => loadStaffScreen(screen, {}, MEMBER_ID, audit),
    })),
    ...screenTests('staff-att-setup', loadStaffAttSetupScreen, STAFF_ATT_SETUP, [{}]),
    ...STAFF_ATT_SCREEN_SLUGS.map((screen) => ({
      module: 'staff-att',
      name: screen,
      fn: () => loadStaffAttScreen(screen, {}, MEMBER_ID, audit),
    })),
    ...customTests('staff-att', [
      ['calendar', async () => {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT staff_id FROM staff_profile_tb WHERE del=1 AND staff_id IS NOT NULL AND staff_id != '' LIMIT 1`,
        );
        const staffId = rows[0]?.staff_id;
        if (!staffId) return { skipped: true };
        return buildStaffAttendanceCalendar({ staffId, fromDate: '2025-01-01', toDate: '2025-01-07' });
      }, { warnOnly: true }],
      ['staff-report', async () => {
        const cats = await prisma.$queryRawUnsafe(
          `SELECT DISTINCT job_category AS c FROM staff_profile_tb WHERE del=1 AND job_category IS NOT NULL LIMIT 1`,
        );
        const cat = cats[0]?.c;
        if (!cat) return { skipped: true };
        return buildStaffAttendanceReport({ categories: [String(cat)], fromDate: '2025-01-01', toDate: '2025-01-07' });
      }, { warnOnly: true }],
    ]),
    ...STUDENT_ATT_SCREEN_SLUGS.map((screen) => ({
      module: 'student-att',
      name: screen,
      fn: () => loadStudentAttScreen(screen, {}, MEMBER_ID, audit),
    })),
    ...customTests('fees', [
      ['filters', () => getFeeFilterOptions()],
      ['delete-requests', () => listMyFeeDeleteRequests(MEMBER_ID)],
      ['delete-approvals', () => listPendingFeeDeleteApprovals()],
      ['pending-sms-classes', () => loadPendingSmsClasses()],
      ['pending-letter-form', () => loadPendingLetterForm()],
      ['scholarship-setup', () => loadScholarshipSetup({})],
      ['dme-setup', () => loadDmeSetup({})],
      ['acmec-scholarship-setup', () => loadAcmecScholarshipSetup({})],
      ['acmec-config', () => loadAcmecConfig(MEMBER_ID, {}, audit)],
      ...FEE_SETUP.map((screen) => [
        `setup-${screen}`,
        () => loadFeeSetupScreen(screen, {}, MEMBER_ID, audit),
      ]),
    ]),
    ...screenTests('academic', loadAcademicSetupScreen, academicScreens, [{}]),
    ...screenTests('exam', loadExamSetupScreen, EXAM_SCREENS, [{}]),
    ...screenTests('elearning', loadElearningScreen, ELEARNING_SCREENS, [{}]),
    ...customTests('exam', [
      ['dashboard', () => loadExamDashboard(MEMBER_ID), { warnOnly: true }],
    ]),
    ...customTests('elearning', [
      ['dashboard', () => loadElearnDashboard(MEMBER_ID, {}, audit)],
    ]),
    ...screenTests('payroll', loadPayrollSetupScreen, PAYROLL_SETUP),
    ...customTests('payroll', [
      ['report:generate-payroll', () => loadGeneratePayroll(MEMBER_ID, {}, audit)],
      ['report:att-report', () => loadPayrollAttReport(MEMBER_ID, {}, audit)],
      ['report:monthly-report', () => loadPayrollMonthlyReport(MEMBER_ID, {}, audit)],
      ['report:tax-report', () => loadPayrollTaxReport(MEMBER_ID, {}, audit)],
    ]),
    ...customTests('stipend', [
      ['generate-payroll', () => loadStipendGeneratePayroll(MEMBER_ID, {}, audit)],
      ['att-report', () => loadStipendAttReport(MEMBER_ID, {}, audit)],
      ['payroll-report', () => loadStipendReport('stipend-report', MEMBER_ID, {}, audit)],
      ['statement', () => loadStipendReport('stipend-statement', MEMBER_ID, {}, audit)],
      ['individual-report', () => loadStipendReport('stipend-individual-report', MEMBER_ID, {}, audit)],
      ['individual-pdf', () => loadStipendIndividualPdfReport(MEMBER_ID, {}, audit), { warnOnly: true }],
    ]),
    ...screenTests('hostel', loadHostelSetupScreen, HOSTEL_SCREENS, [{}]),
    ...screenTests('library', loadLibrarySetupScreen, LIBRARY_SCREENS, [{}]),
    ...screenTests('admin', loadAdminSetupScreen, ADMIN_SCREENS, [{}]),
    ...screenTests('settings', loadSettingsSetupScreen, SETTINGS_SCREENS, [{}]),
    ...screenTests('sms', loadSmsScreen, SMS_SCREENS, [{}]),
    ...screenTests('web', loadWebScreen, [...WEB_SCREENS], [{}]),
    ...screenTests('tv', loadTvScreen, TV_SCREENS, [{}]),
    ...screenTests('kiosk', loadKioskScreen, KIOSK_SCREENS, [{}]),
    ...screenTests('committee', loadCommitteeScreen, COMMITTEE_SCREENS, [{}]),
    ...screenTests('certificate', loadCertificateScreen, CERTIFICATE_SCREENS, [{}]),
    ...screenTests('naac', loadNaacScreen, NAAC_SCREENS, [{}]),
    ...screenTests('admin-office', loadAdminOfficeSetupScreen, ADMIN_OFFICE_SCREENS, [{}]),
    ...screenTests('circular', loadCircularSetupScreen, CIRCULAR_SCREENS, [{}]),
    ...customTests('dashboard', [
      ['widgets-all', async () => {
        const result = await fetchWidgets({
          memberId: MEMBER_ID,
          widgetNames: DASHBOARD_WIDGETS,
          dateUnix,
          academicYears: { ugr: '', uga: '', pgr: '' },
        });
        const bad = (result.widgets || []).filter((w) => !w.html || w.html.includes('not yet ported'));
        if (bad.length) return { error: `placeholder widgets: ${bad.map((w) => w.id).join(', ')}` };
        return result;
      }],
    ]),
    ...customTests('dashboard', [
      ['student-dashboard-shell', async () => {
        const user = await prisma.web_account_setup.findFirst({ where: { member_id: MEMBER_ID, del: 1 } });
        return loadStudentDashboardShell(user, {});
      }],
      ['staff-pattern-shell', async () => {
        const user = await prisma.web_account_setup.findFirst({ where: { member_id: MEMBER_ID, del: 1 } });
        return loadStaffPatternShell(user, {});
      }],
      ['overall-strength', () => loadOverallStrengthReport(MEMBER_ID)],
      ['community-strength', () => loadCommunityStrengthReport(MEMBER_ID)],
      ['staff-unit-1', () => renderStaffUnit1({ academicDate: today })],
      ['staff-unit-2', () => renderStaffUnit2({ academicDate: today })],
    ]),
    ...customTests('portfolio', [
      ['dashboard', () => loadPortfolioDashboard(MEMBER_ID, {}, audit)],
      ['individual-report-init', () => loadPortfolioIndividualReport(MEMBER_ID, {}, audit)],
      ['individual-report-batch', () => loadPortfolioIndividualReport(MEMBER_ID, {
        searchBy: 'batch',
        searchCourse: '2___2020-2021',
      }, audit)],
    ]),
  ];
}

async function runTimed(test) {
  const t0 = performance.now();
  try {
    const result = await test.fn();
    const ms = Math.round(performance.now() - t0);
    if (result?.skipped) {
      return { ...test, ms, status: 'skip' };
    }
    if (result?.error) {
      const status = test.warnOnly ? 'warn' : 'fail';
      return { ...test, ms, status, error: result.error };
    }
    let status = 'ok';
    if (ms >= SLOW_MS) status = 'slow';
    else if (ms >= WARN_MS) status = 'warn-latency';
    return { ...test, ms, status };
  } catch (error) {
    const ms = Math.round(performance.now() - t0);
    const status = test.warnOnly ? 'warn' : 'fail';
    return { ...test, ms, status, error: error.message };
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarizeModule(results) {
  const byModule = new Map();
  for (const r of results) {
    if (!byModule.has(r.module)) {
      byModule.set(r.module, { ok: 0, fail: 0, warn: 0, skip: 0, slow: 0, latencies: [] });
    }
    const m = byModule.get(r.module);
    if (r.status === 'ok' || r.status === 'warn-latency') m.ok += 1;
    else if (r.status === 'fail') m.fail += 1;
    else if (r.status === 'warn') m.warn += 1;
    else if (r.status === 'skip') m.skip += 1;
    if (r.status === 'slow') {
      m.slow += 1;
      m.ok += 1;
    }
    if (r.status !== 'skip') m.latencies.push(r.ms);
  }
  return byModule;
}

async function runHttpLatencyTests(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const post = (path, body = { fields: {} }) => fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const get = (path) => fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });

  const endpoints = [
    { module: 'http', name: 'GET /api/auth/me', fn: () => get('/api/auth/me') },
    { module: 'http', name: 'GET /api/dashboard', fn: () => get('/api/dashboard') },
    { module: 'http', name: 'GET /api/menu', fn: () => get('/api/menu') },
    { module: 'http', name: 'GET /api/settings/basic', fn: () => get('/api/settings/basic') },
    { module: 'http', name: 'GET /api/fees/filters', fn: () => get('/api/fees/filters') },
    { module: 'http', name: 'GET /api/exam/dashboard', fn: () => get('/api/exam/dashboard') },
    { module: 'http', name: 'POST /api/students/screens/temp-admission-add/load', fn: () => post('/api/students/screens/temp-admission-add/load') },
    { module: 'http', name: 'POST /api/staff/setup/designation-edit/load', fn: () => post('/api/staff/setup/designation-edit/load') },
    { module: 'http', name: 'POST /api/fees/setup/label/load', fn: () => post('/api/fees/setup/label/load') },
    { module: 'http', name: 'POST /api/academic/setup/subject-master/load', fn: () => post('/api/academic/setup/subject-master/load') },
    { module: 'http', name: 'POST /api/exam/setup/exam-names/load', fn: () => post('/api/exam/setup/exam-names/load') },
    { module: 'http', name: 'POST /api/payroll/setup/payroll-config/load', fn: () => post('/api/payroll/setup/payroll-config/load') },
    { module: 'http', name: 'POST /api/hostel/setup/dashboard/load', fn: () => post('/api/hostel/setup/dashboard/load') },
    { module: 'http', name: 'POST /api/library/setup/dashboard/load', fn: () => post('/api/library/setup/dashboard/load') },
    { module: 'http', name: 'POST /api/admin/setup/menu-auth/load', fn: () => post('/api/admin/setup/menu-auth/load') },
    { module: 'http', name: 'POST /api/settings/setup/designation/load', fn: () => post('/api/settings/setup/designation/load') },
    { module: 'http', name: 'POST /api/sms/setup/student-sms/load', fn: () => post('/api/sms/setup/student-sms/load') },
    { module: 'http', name: 'POST /api/elearning/setup/elearn-setup/load', fn: () => post('/api/elearning/setup/elearn-setup/load') },
    { module: 'http', name: 'POST /api/circular/setup/dashboard/load', fn: () => post('/api/circular/setup/dashboard/load') },
    { module: 'http', name: 'POST /api/certificates/setup/setup/load', fn: () => post('/api/certificates/setup/setup/load') },
    { module: 'http', name: 'POST /api/committee/setup/dashboard/load', fn: () => post('/api/committee/setup/dashboard/load') },
    { module: 'http', name: 'POST /api/naac/setup/qual/load', fn: () => post('/api/naac/setup/qual/load') },
    { module: 'http', name: 'POST /api/admin-office/setup/courier-add/load', fn: () => post('/api/admin-office/setup/courier-add/load') },
    { module: 'http', name: 'POST /api/web/setup/about-us/load', fn: () => post('/api/web/setup/about-us/load') },
    { module: 'http', name: 'POST /api/tv/setup/slider-widget/load', fn: () => post('/api/tv/setup/slider-widget/load') },
    { module: 'http', name: 'POST /api/kiosk/setup/machine-access/load', fn: () => post('/api/kiosk/setup/machine-access/load') },
    { module: 'http', name: 'POST /api/attendance/staff/setup/calendar-add/load', fn: () => post('/api/attendance/staff/setup/calendar-add/load') },
    { module: 'http', name: 'POST /api/attendance/students/biometric-report/load', fn: () => post('/api/attendance/students/biometric-report/load') },
  ];

  const results = [];
  for (const ep of endpoints) {
    const t0 = performance.now();
    try {
      const res = await ep.fn();
      const ms = Math.round(performance.now() - t0);
      const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
      if (!res.ok) {
        results.push({
          module: ep.module,
          name: ep.name,
          ms,
          status: 'fail',
          error: body?.message || `HTTP ${res.status}`,
        });
      } else {
        let status = 'ok';
        if (ms >= SLOW_MS) status = 'slow';
        else if (ms >= WARN_MS) status = 'warn-latency';
        results.push({ module: ep.module, name: ep.name, ms, status });
      }
    } catch (error) {
      results.push({
        module: ep.module,
        name: ep.name,
        ms: Math.round(performance.now() - t0),
        status: 'fail',
        error: error.message,
      });
    }
  }
  return results;
}

async function main() {
  console.log('CIS full module test + latency suite');
  console.log(`Thresholds: warn=${WARN_MS}ms slow=${SLOW_MS}ms`);
  console.log('');

  const tests = buildServiceTests();
  console.log(`Running ${tests.length} service loader tests...\n`);

  const serviceResults = [];
  for (const test of tests) {
    const result = await runTimed(test);
    serviceResults.push(result);
    const tag = result.status === 'ok' ? 'OK' : result.status.toUpperCase();
    const err = result.error ? ` — ${result.error}` : '';
    console.log(`${tag.padEnd(14)} ${result.ms.toString().padStart(5)}ms  ${result.module}:${result.name}${err}`);
  }

  let httpResults = [];
  if (RUN_HTTP) {
    console.log('\nRunning HTTP API latency tests...\n');
    const user = await prisma.web_account_setup.findFirst({ where: { member_id: MEMBER_ID, del: 1 } });
    if (!user) {
      console.error('CISADMIN not found — skipping HTTP tests');
    } else {
      const token = signToken({
        id: user.id,
        memberId: user.member_id,
        memberName: user.member_name,
        accessType: user.access_type,
        sessionId: createSessionId(),
      });
      httpResults = await runHttpLatencyTests(token);
      for (const r of httpResults) {
        const tag = r.status === 'ok' ? 'OK' : r.status.toUpperCase();
        const err = r.error ? ` — ${r.error}` : '';
        console.log(`${tag.padEnd(14)} ${r.ms.toString().padStart(5)}ms  ${r.name}${err}`);
      }
    }
  }

  const allResults = [...serviceResults, ...httpResults];
  const latencies = allResults.filter((r) => r.status !== 'skip').map((r) => r.ms);
  const failures = allResults.filter((r) => r.status === 'fail');
  const warnings = allResults.filter((r) => r.status === 'warn');
  const slow = allResults.filter((r) => r.status === 'slow' || r.status === 'warn-latency');
  const skipped = allResults.filter((r) => r.status === 'skip');
  const passed = allResults.filter((r) => ['ok', 'slow', 'warn-latency'].includes(r.status)).length;

  const byModule = summarizeModule(allResults);
  const slowest = [...allResults]
    .filter((r) => r.status !== 'skip')
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 15);

  console.log('\n========== SUMMARY ==========');
  console.log(`Total tests:  ${allResults.length}`);
  console.log(`Passed:       ${passed}`);
  console.log(`Failed:       ${failures.length}`);
  console.log(`Warnings:     ${warnings.length}`);
  console.log(`Skipped:      ${skipped.length}`);
  console.log(`Slow (>${SLOW_MS}ms):   ${allResults.filter((r) => r.status === 'slow').length}`);
  console.log(`Warn latency: ${allResults.filter((r) => r.status === 'warn-latency').length}`);
  console.log('');
  console.log('Latency (all non-skip tests):');
  console.log(`  min:  ${Math.min(...latencies)}ms`);
  console.log(`  p50:  ${percentile(latencies, 50)}ms`);
  console.log(`  p95:  ${percentile(latencies, 95)}ms`);
  console.log(`  p99:  ${percentile(latencies, 99)}ms`);
  console.log(`  max:  ${Math.max(...latencies)}ms`);
  console.log(`  avg:  ${Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)}ms`);

  console.log('\nPer module:');
  for (const [mod, stats] of [...byModule.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const p95 = stats.latencies.length ? percentile(stats.latencies, 95) : 0;
    console.log(`  ${mod.padEnd(16)} ok=${stats.ok} fail=${stats.fail} warn=${stats.warn} skip=${stats.skip} p95=${p95}ms`);
  }

  console.log('\nSlowest 15:');
  for (const r of slowest) {
    console.log(`  ${r.ms.toString().padStart(5)}ms  ${r.module}:${r.name}`);
  }

  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  ${f.module}:${f.name} — ${f.error}`);
    }
  }

  if (warnings.length) {
    console.log('\nWarnings (non-fatal):');
    for (const w of warnings) {
      console.log(`  ${w.module}:${w.name} — ${w.error}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: { warnMs: WARN_MS, slowMs: SLOW_MS },
    summary: {
      total: allResults.length,
      passed,
      failed: failures.length,
      warnings: warnings.length,
      skipped: skipped.length,
      latency: {
        min: Math.min(...latencies),
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        max: Math.max(...latencies),
        avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      },
    },
    modules: Object.fromEntries([...byModule.entries()].map(([k, v]) => [k, {
      ok: v.ok,
      fail: v.fail,
      warn: v.warn,
      skip: v.skip,
      slow: v.slow,
      p95: v.latencies.length ? percentile(v.latencies, 95) : 0,
    }])),
    slowest: slowest.map((r) => ({ module: r.module, name: r.name, ms: r.ms, status: r.status })),
    failures: failures.map((r) => ({ module: r.module, name: r.name, ms: r.ms, error: r.error })),
    warnings: warnings.map((r) => ({ module: r.module, name: r.name, ms: r.ms, error: r.error })),
    results: allResults,
  };

  if (WRITE_JSON) {
    const outDir = join(__dirname, '../reports');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, `module-test-report-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nJSON report: ${outPath}`);
  }

  await prisma.$disconnect();

  if (failures.length) process.exit(1);
  console.log('\nAll tests passed.');
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

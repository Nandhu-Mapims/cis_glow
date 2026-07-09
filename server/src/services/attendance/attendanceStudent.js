import { prisma } from '../../config/prisma.js';
import { insertLog } from '../logService.js';
import { loadStudentReportFilters } from './studentReportFilters.js';
import {
  clearAttendanceReportCache,
  generateStudentAttendanceBatchNative,
  generateStudentQuarterlyBatchNative,
  setupStudentAttendanceReportNative,
  setupStudentQuarterlyReportNative,
} from './studentAttendanceReportCore.js';
import { loadStudentDailyAttendance, saveStudentDailyAttendance as nativeSaveStudentDaily } from './studentDaily.js';
import {
  generatePgAttendanceReportBatch,
  setupPgAttendanceReport,
} from './pgAttendanceReportCore.js';

const COURSE_OPTIONS = [
  { value: 'U.G___regular', label: 'U.G (Regular)' },
  { value: 'U.G___additional', label: 'U.G (Additional)' },
];

export function getStudentAttendanceFilters() {
  return { courseOptions: COURSE_OPTIONS };
}

export async function getStudentDailyAttendanceSheet(payload, memberId) {
  void memberId;
  const result = await loadStudentDailyAttendance(payload);
  if (result.error) return { error: result.error };
  return result;
}

export async function saveStudentDailyAttendance(payload, memberId, meta) {
  const attendanceDate = String(payload.attendanceDate || '').trim();
  const result = await nativeSaveStudentDaily(payload, memberId, meta);
  if (result.success) {
    await insertLog(
      ['student_mattendance', 'Update', 'Successful', attendanceDate, new Date(), meta.ip, '', memberId],
      '',
    );
  }
  return result;
}

export async function getStudentReportFilters(payload, _memberId) {
  return loadStudentReportFilters(payload || {});
}

export async function setupStudentAttendanceReport(payload, _memberId) {
  if (payload?.variant === 'quarterly') {
    return setupStudentQuarterlyReportNative(payload || {});
  }
  return setupStudentAttendanceReportNative(payload || {});
}

export async function generateStudentAttendanceReport(payload, _memberId) {
  const setup = payload.setup;
  if (!setup?.jobs?.length || !setup.meta?.fmonth) {
    return { error: 'Report setup with jobs is required' };
  }

  if (payload.clearCache) clearAttendanceReportCache();

  const offset = Number(payload.offset) || 0;
  const limit = Number(payload.limit) || 10;
  const batchJobs = setup.jobs.slice(offset, offset + limit);
  const rowsByFlag = {};

  const isQuarterly = payload.variant === 'quarterly' || setup.meta?.rtype === 'Quarterly';
  const batchRows = isQuarterly
    ? await generateStudentQuarterlyBatchNative(batchJobs, setup.meta, Boolean(payload.clearCache))
    : await generateStudentAttendanceBatchNative(batchJobs, setup.meta, Boolean(payload.clearCache));
  for (const row of batchRows) {
    if (row.html) {
      rowsByFlag[row.flag] = (rowsByFlag[row.flag] || '') + row.html;
    }
  }

  const nextOffset = offset + batchJobs.length;
  return {
    rowsByFlag,
    processed: nextOffset,
    total: setup.jobs.length,
    truncated: nextOffset < setup.jobs.length,
    nextOffset,
  };
}

export async function setupPgAttendanceReportScreen(payload, _memberId) {
  return setupPgAttendanceReport(payload || {});
}

export async function generatePgAttendanceReport(payload, _memberId) {
  const setup = payload.setup;
  if (!setup?.jobs?.length || !setup.meta) {
    return { error: 'Report setup with jobs is required' };
  }
  return generatePgAttendanceReportBatch(
    setup,
    Number(payload.offset) || 0,
    Number(payload.limit) || 10,
    Boolean(payload.clearCache),
  );
}

export async function getStudentReportAcademicYears() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT academic_year FROM basic_setup_subject_tb WHERE del = 1 ORDER BY academic_year ASC',
  );
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { ug_academic_year: true },
  });
  return {
    academicYears: rows.map((r) => r.academic_year),
    defaultAcademicYear: setup?.ug_academic_year || rows[0]?.academic_year || '',
  };
}

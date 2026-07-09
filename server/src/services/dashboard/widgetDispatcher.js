import { renderStaffDetails } from './widgets/staffDetails.js';
import { renderStaffPermission } from './widgets/staffPermission.js';
import { renderStaffUnit } from './widgets/staffUnit.js';
import { buildStaffAttendanceWidgets } from './widgets/staffAttendance.js';
import { renderStaffCurrent } from './widgets/staffCurrent.js';
import { buildStudentDetailsWidgets } from './widgets/studentDetails.js';
import { buildStudentAttendanceWidgets } from './widgets/studentAttendanceWidgets.js';
import { renderStudentScholarship } from './widgets/studentScholarshipWidget.js';
import {
  buildStudentHostelWidgets,
  renderGentsHostelAttendance,
  renderLadiesHostelAttendance,
  renderStudentGhostel,
  renderStudentLhostel,
} from './widgets/studentHostelWidgets.js';
import { renderFeedbackAnalysis } from './widgets/feedbackAnalysisWidget.js';
import { renderStaffUnit1, renderStaffUnit2 } from './widgets/staffUnitRoster.js';
import { renderPlaceholder } from './widgets/placeholder.js';

const STAFF_ATT_INDICES = {
  staff_attendance: 0,
  staff_attendance_incampus: 1,
  staff_leave_absent: 2,
};

const STUDENT_ATT_INDICES = {
  internship_attendance: 0,
  internship_attendance_batch: 1,
  ug_attendance: 2,
  internship_leave_absent: 3,
  internship_permission: 4,
  pg_attendance: 5,
  pg_attendance_dept: 6,
  pg_leave_absent: 7,
  pg_permission: 8,
  ug_attendance_add: 9,
};

const STUDENT_INFO_INDICES = {
  student_details: 0,
  student_add_details: 1,
};

const NATIVE_HANDLERS = {
  staff_details: renderStaffDetails,
  staff_permission: renderStaffPermission,
  staff_unit: renderStaffUnit,
  staff_current: renderStaffCurrent,
  staff_unit_1: renderStaffUnit1,
  staff_unit_2: renderStaffUnit2,
  student_scholarship: renderStudentScholarship,
  feedback_analyasis: renderFeedbackAnalysis,
};

/**
 * Map API query years (ugr/uga/pgr) to legacy academic_year_array shape.
 */
export function normalizeAcademicYears(years = {}) {
  if (years['U.G'] || years['P.G']) return years;
  return {
    'U.G': { regular: years.ugr || '', additional: years.uga || '' },
    'P.G': { regular: years.pgr || '' },
  };
}

/**
 * Parse attendance date like dashboard_more.php (c_flag / d / t).
 */
export function parseWidgetDate({ dateUnix, cFlag, time }) {
  if (cFlag === '1') {
    const academicTime = time || new Date().toTimeString().slice(0, 5);
    const parsed = new Date(dateUnix);
    const academicDate = Number.isNaN(parsed.getTime())
      ? new Date().toISOString().slice(0, 10)
      : parsed.toISOString().slice(0, 10);
    return { academicDate, academicTime };
  }

  const unix = Number(dateUnix);
  const academicDate = Number.isNaN(unix)
    ? new Date().toISOString().slice(0, 10)
    : new Date(unix * 1000).toISOString().slice(0, 10);
  const academicTime = new Date().toTimeString().slice(0, 5);
  return { academicDate, academicTime };
}

/**
 * Fetch dashboard widgets via native handlers (no PHP bridge).
 * Returns the same shape as normalizeLegacyWidgetResponse.
 */
export async function fetchWidgets({
  memberId,
  widgetNames,
  dateUnix,
  cFlag = '',
  time = '',
  academicYears = {},
  cRefresh = 0,
}) {
  const { academicDate, academicTime } = parseWidgetDate({ dateUnix, cFlag, time });
  const ctx = {
    memberId,
    academicDate,
    academicTime,
    academicYears: normalizeAcademicYears(academicYears),
    cRefresh,
    cFlag,
  };

  let staffAttCache = null;
  let studentAttCache = null;
  let studentInfoCache = null;
  let studentHostelCache = null;
  let studentHostelExtras = null;

  const needsStaffAtt = widgetNames.some((n) => n in STAFF_ATT_INDICES);
  const needsStudentAtt = widgetNames.some((n) => n in STUDENT_ATT_INDICES);
  const needsStudentInfo = widgetNames.some((n) => n in STUDENT_INFO_INDICES);
  const needsStudentHostel = widgetNames.some((n) => (
    n === 'student_hostel' || n === 'gents_hostel_attendance' || n === 'ladies_hostel_attendance'
    || n === 'student_ghostel' || n === 'student_lhostel'
  ));
  const nativeWidgetNames = widgetNames.filter((n) => NATIVE_HANDLERS[n]);

  const preloadTasks = [];
  if (needsStaffAtt) {
    preloadTasks.push(buildStaffAttendanceWidgets(ctx).then((r) => { staffAttCache = r; }));
  }
  if (needsStudentAtt) {
    preloadTasks.push(buildStudentAttendanceWidgets(ctx).then((r) => { studentAttCache = r; }));
  }
  if (needsStudentInfo) {
    preloadTasks.push(buildStudentDetailsWidgets(ctx).then((r) => { studentInfoCache = r; }));
  }
  if (needsStudentHostel) {
    preloadTasks.push(buildStudentHostelWidgets(ctx).then((r) => { studentHostelCache = r; }));
  }
  const nativeResults = new Map();
  for (const name of nativeWidgetNames) {
    preloadTasks.push(
      NATIVE_HANDLERS[name](ctx).then((html) => { nativeResults.set(name, html); }),
    );
  }
  await Promise.all(preloadTasks);

  if (needsStudentHostel && studentHostelCache) {
    const needs = new Set(widgetNames.filter((w) => (
      w === 'gents_hostel_attendance' || w === 'ladies_hostel_attendance'
      || w === 'student_ghostel' || w === 'student_lhostel'
    )));
    const tasks = [];
    if (needs.has('gents_hostel_attendance')) {
      tasks.push(renderGentsHostelAttendance(ctx, studentHostelCache[1]).then((h) => ['gents_hostel_attendance', h]));
    }
    if (needs.has('ladies_hostel_attendance')) {
      tasks.push(renderLadiesHostelAttendance(ctx, studentHostelCache[2]).then((h) => ['ladies_hostel_attendance', h]));
    }
    if (needs.has('student_ghostel')) {
      tasks.push(renderStudentGhostel(ctx, studentHostelCache[1]).then((h) => ['student_ghostel', h]));
    }
    if (needs.has('student_lhostel')) {
      tasks.push(renderStudentLhostel(ctx, studentHostelCache[2]).then((h) => ['student_lhostel', h]));
    }
    studentHostelExtras = Object.fromEntries(await Promise.all(tasks));
  }

  const widgets = [];

  for (const name of widgetNames) {
    let html;

    if (name in STAFF_ATT_INDICES) {
      html = staffAttCache[STAFF_ATT_INDICES[name]];
    } else if (name in STUDENT_ATT_INDICES) {
      html = studentAttCache[STUDENT_ATT_INDICES[name]];
    } else if (name in STUDENT_INFO_INDICES) {
      html = studentInfoCache[STUDENT_INFO_INDICES[name]];
    } else if (name === 'student_hostel' || name === 'gents_hostel_attendance'
      || name === 'ladies_hostel_attendance' || name === 'student_ghostel' || name === 'student_lhostel') {
      if (name === 'student_hostel') {
        html = studentHostelCache[0];
      } else {
        html = studentHostelExtras[name];
      }
    } else if (nativeResults.has(name)) {
      html = nativeResults.get(name);
    } else {
      html = renderPlaceholder(name);
    }

    widgets.push({ id: name, html });
  }

  return { count: widgets.length, widgets };
}

/** @deprecated kept for tests; fetchWidgets returns normalized shape directly */
export function normalizeLegacyWidgetResponse(legacyResult) {
  if (!Array.isArray(legacyResult) || legacyResult.length < 3) {
    return { count: 0, widgets: [] };
  }

  const count = legacyResult[0] || 0;
  const ids = legacyResult[1] || [];
  const htmlList = legacyResult[2] || [];
  const widgets = [];

  for (let i = 0; i < count; i += 1) {
    if (ids[i]) {
      widgets.push({ id: ids[i], html: htmlList[i] || '' });
    }
  }

  return { count, widgets };
}

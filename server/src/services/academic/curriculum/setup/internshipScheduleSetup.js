import { prisma } from '../../../../config/prisma.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { basicSetupCourseSelect } from '../../../../utils/legacySelects.js';
import {
  buildInternshipCourseOptions,
  courseIdYearKey,
  loadBatchCount,
  loadRoomOptions,
  parseCourseIdYearKey,
} from '../../academicSetupShared.js';
import { auditFields, logAcademicSetup } from '../../setup/setupAudit.js';

const PAGE = 'internship_schedule.php';
const BATCH_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function toIsoDate(value) {
  if (!value) return null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(String(value))) {
    const [dd, mm, yyyy] = String(value).split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(value) {
  if (!value || String(value).startsWith('0000-00-00')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function formatTimeDisplay(value) {
  if (!value || String(value) === '00:00:00') return '';
  return String(value).slice(0, 5);
}

function normalizeTimeInput(value) {
  const s = String(value || '').trim();
  if (!s) return '00:00:00';
  return s.length === 5 ? `${s}:00` : s;
}

function emptyRow() {
  return {
    id: null,
    department: '',
    fromDate: '',
    toDate: '',
    fromTime: '',
    toTime: '',
    roomNo: '',
  };
}

async function loadDepartmentOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM master_setup
     WHERE category='Internship Department' AND del != 0
     ORDER BY category_order ASC`,
  );
  return rows.map((r) => ({ value: String(r.id), label: r.category_name || '' }));
}

async function loadScheduleRows(scope, batchNo) {
  if (!scope || !batchNo) return [emptyRow()];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, department, CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date,
            CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time, room_no
     FROM internship_timetable
     WHERE del=1 AND course_id=${Number(scope.courseId)} AND academic_year='${escapeSql(scope.academicYear)}'
       AND current_year='${escapeSql(scope.currentYear)}' AND academic_type='${escapeSql(scope.academicType)}'
       AND batch_no='${escapeSql(String(batchNo))}'
     ORDER BY from_date ASC`,
  );
  if (!rows.length) return [emptyRow()];
  return rows.map((r) => ({
    id: Number(r.id),
    department: String(r.department || ''),
    fromDate: formatDateDisplay(r.from_date),
    toDate: formatDateDisplay(r.to_date),
    fromTime: formatTimeDisplay(r.from_time),
    toTime: formatTimeDisplay(r.to_time),
    roomNo: r.room_no ? String(r.room_no) : '',
  }));
}

export async function loadInternshipSchedule(memberId, fields = {}, audit = {}) {
  const courseOptions = await buildInternshipCourseOptions();
  const courseKey = String(fields.courseKey || fields.course_name || '').trim();
  const selection = parseCourseIdYearKey(courseKey);
  const departmentOptions = await loadDepartmentOptions();
  const { groups: roomGroups } = await loadRoomOptions();

  let currentYear = '';
  let batchOptions = [];
  let batchNo = Number(fields.batchNo || fields.batch_no) || 0;
  let rows = [emptyRow()];

  if (selection) {
    const course = await prisma.basic_setup_course_tb.findFirst({
      where: { del: 1, id: selection.courseId },
      select: basicSetupCourseSelect,
    });
    currentYear = String(course?.course_duration || '');
    const totalBatch = await loadBatchCount(
      selection.courseId,
      selection.academicYear,
      currentYear,
      selection.academicType,
    );
    batchOptions = Array.from({ length: totalBatch }, (_, i) => ({
      value: i + 1,
      label: BATCH_LABELS[i] || String(i + 1),
    }));
    if (!batchNo && batchOptions.length) batchNo = batchOptions[0].value;
    if (batchNo) {
      rows = await loadScheduleRows(
        { ...selection, currentYear },
        batchNo,
      );
    }
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', courseKey, memberId, audit);
  return {
    courseOptions,
    courseKey,
    selection: selection ? { ...selection, currentYear } : null,
    departmentOptions,
    roomGroups,
    batchOptions,
    batchNo,
    batchLabel: batchNo ? `Batch ${BATCH_LABELS[batchNo - 1] || batchNo}` : '',
    rows,
  };
}

export async function saveInternshipSchedule(payload, memberId, audit = {}) {
  const selection = parseCourseIdYearKey(payload.courseKey || payload.course_name)
    || (payload.int_course ? {
      courseId: Number(payload.int_course),
      academicYear: payload.int_ayear,
      academicType: payload.int_cacademic,
      currentYear: String(payload.int_cyear || ''),
    } : null);
  const batchNo = Number(payload.batchNo || payload.int_batch) || 0;

  if (!selection?.courseId || !selection.academicYear || !selection.academicType || !batchNo) {
    return { success: false, message: 'Course and batch are required' };
  }

  const course = await prisma.basic_setup_course_tb.findFirst({
    where: { del: 1, id: selection.courseId },
    select: basicSetupCourseSelect,
  });
  const currentYear = String(selection.currentYear || course?.course_duration || '');
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(
    `UPDATE internship_timetable SET del=0, updated_by='${escapeSql(memberId)}',
     updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
     WHERE del=1 AND course_id=${Number(selection.courseId)}
       AND academic_year='${escapeSql(selection.academicYear)}'
       AND current_year='${escapeSql(currentYear)}'
       AND academic_type='${escapeSql(selection.academicType)}'
       AND batch_no='${escapeSql(String(batchNo))}'`,
  );

  for (const row of rows) {
    const department = String(row.department || '').trim();
    if (!department) continue;

    const fromDate = toIsoDate(row.fromDate);
    const toDate = toIsoDate(row.toDate);
    const fromTime = normalizeTimeInput(row.fromTime);
    const toTime = normalizeTimeInput(row.toTime);
    const roomNo = Number(row.roomNo) || 0;

    if (row.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE internship_timetable SET course_id=${Number(selection.courseId)},
         academic_year='${escapeSql(selection.academicYear)}', current_year='${escapeSql(currentYear)}',
         academic_type='${escapeSql(selection.academicType)}', batch_no='${escapeSql(String(batchNo))}',
         department='${escapeSql(department)}', from_date='${escapeSql(fromDate || '2000-01-01')}',
         to_date='${escapeSql(toDate || '2000-01-01')}', from_time='${escapeSql(fromTime)}',
         to_time='${escapeSql(toTime)}', room_no=${roomNo}, del=1,
         updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
         WHERE id=${Number(row.id)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO internship_timetable (course_id, academic_year, current_year, academic_type, batch_no,
         department, from_date, to_date, from_time, to_time, room_no, created_dt, created_ip, created_by, del)
         VALUES (${Number(selection.courseId)}, '${escapeSql(selection.academicYear)}', '${escapeSql(currentYear)}',
         '${escapeSql(selection.academicType)}', '${escapeSql(String(batchNo))}', '${escapeSql(department)}',
         '${escapeSql(fromDate || '2000-01-01')}', '${escapeSql(toDate || '2000-01-01')}',
         '${escapeSql(fromTime)}', '${escapeSql(toTime)}', ${roomNo},
         NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)`,
      );
    }
  }

  const logDesc = `${selection.courseId}, ${selection.academicYear}, ${currentYear}, ${selection.academicType}, ${batchNo}`;
  await logAcademicSetup(PAGE, 'Update', 'Successful', logDesc, memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadInternshipSchedule(memberId, {
      courseKey: courseIdYearKey(selection.courseId, selection.academicYear, selection.academicType),
      batchNo,
    }, { ...audit, skipLog: true })),
  };
}

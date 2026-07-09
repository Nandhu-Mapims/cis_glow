import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { formatDisplayDate, parseInputDate } from '../../shared/ciaSetupHelpers.js';
import {
  buildSubjectScheduleCourseOptions,
  getCourseById,
  parseSubjectScheduleCourseKey,
} from '../academicSetupShared.js';
import { logAcademicSetup } from './setupAudit.js';

const PAGE = 'subject_schedule.php';

async function loadBannerImageUrl() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const image = rows[0]?.banner_image;
  return image ? `/legacy/img/global_images/${encodeURIComponent(image)}` : '';
}

function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(key) {
  const [y, m] = String(key || '').split('-');
  if (!y || !m) return null;
  return { year: Number(y), month: Number(m) };
}

async function loadCategoryMap() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, category_name FROM subject_master WHERE del = 1 AND category = 'Timetable' ORDER BY category_order ASC",
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.category_name]));
}

async function loadSubjectOptions(selection, semester) {
  if (!selection || !semester) return [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT B.id, B.subject_id, B.subject_name, B.subject_category, B.s_batch
     FROM basic_setup_subject_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
     WHERE A.del=1 AND B.del=1 AND A.academic_year='${escapeSql(selection.academicYear)}'
       AND A.course_id='${escapeSql(String(selection.courseId))}' AND A.semester_no='${escapeSql(String(semester))}'
     ORDER BY A.subject_order ASC`,
  );
  const catMap = await loadCategoryMap();
  return rows.map((r) => ({
    value: String(r.id),
    label: `${r.subject_id} | ${r.subject_name} | ${catMap[String(r.subject_category)] || ''}`,
    batchSplit: r.s_batch === 1,
  }));
}

async function loadStaffOptions(deptCsv) {
  let deptFilter = '';
  if (deptCsv) {
    const parts = String(deptCsv).split(',').map((d) => d.trim()).filter(Boolean)
      .map((d) => `B.department='${escapeSql(d)}'`);
    if (parts.length) deptFilter = ` AND (${parts.join(' OR ')})`;
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_title, A.staff_name, A.staff_initial
     FROM staff_profile_tb AS A
     INNER JOIN staff_designation_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND (A.releaving_date = '0000-00-00' OR A.releaving_date > CURDATE())
       AND B.del = 1 AND B.is_academic = 1 ${deptFilter}
     ORDER BY A.staff_id ASC`,
  );
  return rows.map((r) => ({
    value: String(r.id),
    label: `${r.staff_id} | ${r.staff_title ? `${r.staff_title}. ` : ''}${r.staff_name || ''} ${r.staff_initial || ''}`.trim(),
  }));
}

async function loadTopicOptions(subjectTtId, selection, semester) {
  const ttRows = await prisma.$queryRawUnsafe(
    `SELECT department, subject_category FROM basic_subject_tt_tb
     WHERE del = 1 AND id = ${Number(subjectTtId)} LIMIT 1`,
  );
  const ttRow = ttRows[0];
  if (!ttRow || !selection) return [];

  const catMap = await loadCategoryMap();
  const subCategory = catMap[String(ttRow.subject_category)] || '';

  const rows = await prisma.$queryRawUnsafe(
    `SELECT C.id, U.name AS unit_name, C.name AS topic_name
     FROM basic_subject_new_unit AS U
     INNER JOIN basic_subject_new_chapter AS C ON U.id = C.u_id
     WHERE U.del = 1 AND C.del = 1
       AND U.department = '${escapeSql(String(ttRow.department || ''))}'
       AND U.academic_year = '${escapeSql(selection.academicYear)}'
       AND U.sub_category = '${escapeSql(subCategory)}'
       AND U.current_year = '${escapeSql(String(semester))}'
     ORDER BY C.c_order ASC`,
  );
  return rows.map((r) => ({
    value: String(r.id),
    label: `${r.unit_name} | ${r.topic_name}`,
  }));
}

async function loadAssignedRow(selection, sem, subjectId, dateStr, period) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, pg_std_id, topic_id FROM timetable_tb
     WHERE del = 1 AND course_id = '${escapeSql(String(selection.courseId))}'
       AND academic_year = '${escapeSql(selection.academicYear)}'
       AND current_year = '${escapeSql(String(sem))}'
       AND period = '${escapeSql(String(period))}'
       AND academic_type = '${escapeSql(selection.academicType)}'
       AND subject_id = '${escapeSql(subjectId)}'
       AND CAST(from_date AS CHAR) = '${escapeSql(dateStr)}'
     ORDER BY id DESC LIMIT 1`,
  );
  return rows[0] || null;
}

async function loadTemplateRows(selection, sem, subjectId, dayName, dateStr) {
  return prisma.$queryRawUnsafe(
    `SELECT DISTINCT subject_id, course_id, academic_year, current_year, academic_type, period, batch_no, id
     FROM timetable_tb_new
     WHERE del = 1 AND t_day = '${escapeSql(dayName)}'
       AND academic_type = '${escapeSql(selection.academicType)}'
       AND subject_id = '${escapeSql(subjectId)}'
       AND current_year = '${escapeSql(String(sem))}'
       AND academic_year = '${escapeSql(selection.academicYear)}'
       AND CAST(from_date AS CHAR) <= '${escapeSql(dateStr)}'
       AND CAST(from_date AS CHAR) != '0000-00-00'
       AND (CAST(to_date AS CHAR) >= '${escapeSql(dateStr)}' OR CAST(to_date AS CHAR) = '0000-00-00')
     ORDER BY period ASC`,
  );
}

async function loadTemplateDateRange(selection, sem, subjectId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT CAST(MIN(from_date) AS CHAR) AS minDate, CAST(MAX(to_date) AS CHAR) AS maxDate
     FROM timetable_tb_new
     WHERE del = 1 AND academic_type = '${escapeSql(selection.academicType)}'
       AND subject_id = '${escapeSql(subjectId)}'
       AND current_year = '${escapeSql(String(sem))}'
       AND academic_year = '${escapeSql(selection.academicYear)}'
       AND CAST(from_date AS CHAR) != '0000-00-00'`,
  );
  const minDate = rows[0]?.minDate;
  const maxDate = rows[0]?.maxDate;
  if (!minDate || String(minDate).startsWith('0000')) return null;
  return {
    from: String(minDate).slice(0, 10),
    to: maxDate && !String(maxDate).startsWith('0000') ? String(maxDate).slice(0, 10) : null,
    suggestedMonth: String(minDate).slice(0, 7),
  };
}

function formatIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function buildScheduleRows(selection, sem, subjectId, month) {
  const monthParts = parseMonthKey(month);
  if (!monthParts) return [];

  const scheduleRows = [];
  const start = new Date(monthParts.year, monthParts.month - 1, 1);
  const end = new Date(monthParts.year, monthParts.month, 0);
  const cur = new Date(start);
  while (cur <= end) {
    const dayName = cur.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dateStr = formatIsoDate(cur);
    const templateRows = await loadTemplateRows(selection, sem, subjectId, dayName, dateStr);
    for (const tmpl of templateRows) {
      const assigned = await loadAssignedRow(selection, sem, subjectId, dateStr, tmpl.period);
      scheduleRows.push({
        date: formatDisplayDate(dateStr),
        dateIso: dateStr,
        day: dayName,
        ttId: String(tmpl.id),
        scheduleId: assigned?.id ? Number(assigned.id) : null,
        period: tmpl.period,
        batch: tmpl.batch_no,
        staffId: assigned?.staff_id ? String(assigned.staff_id) : '',
        pgId: assigned?.pg_std_id ? String(assigned.pg_std_id) : '',
        topicId: assigned?.topic_id ? String(assigned.topic_id) : '',
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return scheduleRows;
}

export async function loadSubjectSchedule(memberId, fields = {}, audit = {}) {
  const courseYearOptions = await buildSubjectScheduleCourseOptions();
  const parsed = parseSubjectScheduleCourseKey(fields.course_name);
  const semester = parsed?.semester || Number(fields.semester_name) || Number(fields.cyear) || 0;
  const selection = parsed ? {
    courseId: parsed.courseId,
    academicYear: parsed.academicYear,
    academicType: parsed.academicType,
    semester: parsed.semester,
  } : null;
  const subjectId = String(fields.subject_id || fields.suid || '').trim();
  let month = fields.month || monthKey(new Date());
  const alignMonth = fields.alignMonth !== false;

  let course = null;
  let subjectOptions = [];
  let scheduleRows = [];
  let staffOptions = [];
  let topicOptions = [];
  let templateDateRange = null;
  let monthAligned = false;

  if (selection) {
    course = await getCourseById(selection.courseId);
    const sem = selection.semester || semester || 1;
    subjectOptions = await loadSubjectOptions(selection, sem);
    if (subjectId) {
      const ttRows = await prisma.$queryRawUnsafe(
        `SELECT department FROM basic_subject_tt_tb WHERE del = 1 AND id = ${Number(subjectId)} LIMIT 1`,
      );
      staffOptions = await loadStaffOptions(ttRows[0]?.department);
      topicOptions = await loadTopicOptions(subjectId, selection, sem);
      templateDateRange = await loadTemplateDateRange(selection, sem, subjectId);

      scheduleRows = await buildScheduleRows(selection, sem, subjectId, month);
      if (
        alignMonth
        && scheduleRows.length === 0
        && templateDateRange?.suggestedMonth
        && templateDateRange.suggestedMonth !== month
      ) {
        month = templateDateRange.suggestedMonth;
        scheduleRows = await buildScheduleRows(selection, sem, subjectId, month);
        monthAligned = true;
      }
    }
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', fields.course_name || '', memberId, audit);
  const bannerUrl = await loadBannerImageUrl();
  const selectedSubject = subjectOptions.find((o) => o.value === subjectId) || null;
  const printMeta = selection && subjectId ? {
    title: 'Subject Schedule',
    subtitle: `Academic Year: ${selection.academicYear}`,
    subjectLabel: selectedSubject?.label || '',
  } : null;

  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection: selection ? { ...selection, courseName: course?.course_name } : null,
    semester: selection?.semester || semester || 0,
    totalSemester: course ? Number(course.total_semester) || 0 : 0,
    subjectId,
    subjectOptions,
    month,
    monthAligned,
    templateDateRange,
    staffOptions,
    topicOptions,
    scheduleRows,
    bannerUrl,
    printMeta,
    scope: selection && subjectId ? {
      courseId: selection.courseId,
      academicYear: selection.academicYear,
      currentYear: selection.semester,
      academicType: selection.academicType,
      subjectId,
    } : null,
  };
}

export async function saveSubjectSchedule(payload, memberId, audit = {}) {
  const scope = payload.scope || {};
  if (!scope.courseId || !scope.academicYear || !scope.subjectId) {
    return { success: false, message: 'Schedule scope is required' };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  let ok = true;

  for (const row of rows) {
    const fromDate = parseInputDate(row.dateIso || row.date);
    if (!row.ttId || !fromDate) continue;

    await prisma.$executeRawUnsafe(
      `UPDATE timetable_tb SET del = 0,
         updated_dt = NOW(),
         updated_ip = '${escapeSql(audit.ip || '')}',
         updated_by = '${escapeSql(memberId)}'
       WHERE del = 1 AND tt_id = '${escapeSql(String(row.ttId))}'
         AND course_id = '${escapeSql(String(scope.courseId))}'
         AND academic_year = '${escapeSql(scope.academicYear)}'
         AND current_year = '${escapeSql(String(scope.currentYear))}'
         AND t_day = '${escapeSql(row.day)}'
         AND period = '${escapeSql(String(row.period))}'
         AND batch_no = '${escapeSql(String(row.batch || ''))}'
         AND CAST(from_date AS CHAR) = '${escapeSql(fromDate)}'
         AND academic_type = '${escapeSql(scope.academicType)}'
         AND subject_id = '${escapeSql(String(scope.subjectId))}'`,
    );

    if (row.staffId) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO timetable_tb (tt_id, course_id, academic_year, current_year, academic_type, t_day,
             batch_no, period, subject_id, staff_id, pg_std_id, from_date, to_date, topic_id,
             period_type, subject_count, room_no, created_dt, created_ip, created_by,
             updated_dt, updated_ip, updated_by, del)
           VALUES ('${escapeSql(String(row.ttId))}', '${escapeSql(String(scope.courseId))}',
             '${escapeSql(scope.academicYear)}', '${escapeSql(String(scope.currentYear))}',
             '${escapeSql(scope.academicType)}', '${escapeSql(row.day)}',
             '${escapeSql(String(row.batch || ''))}', '${escapeSql(String(row.period))}',
             '${escapeSql(String(scope.subjectId))}', '${escapeSql(String(row.staffId))}',
             '${escapeSql(String(row.pgId || ''))}', '${fromDate}', '${fromDate}',
             '${escapeSql(String(row.topicId || ''))}', 0, 1, 0, NOW(),
             '${escapeSql(audit.ip || '')}', '${escapeSql(memberId)}',
             NOW(), '${escapeSql(audit.ip || '')}', '${escapeSql(memberId)}', 1)`,
        );
      } catch (err) {
        console.error('subject schedule save failed:', err?.meta?.message || err?.message || err);
        ok = false;
      }
    } else if (row.scheduleId) {
      await prisma.$executeRawUnsafe(
        `UPDATE timetable_tb SET staff_id = '', pg_std_id = '', topic_id = '',
           updated_dt = NOW(), updated_ip = '${escapeSql(audit.ip || '')}',
           updated_by = '${escapeSql(memberId)}'
         WHERE id = ${Number(row.scheduleId)}`,
      );
    }
  }

  await logAcademicSetup(PAGE, ok ? 'Update' : 'Update', ok ? 'Successful' : 'Unsuccessful', '', memberId, audit);
  return {
    success: ok,
    message: ok ? 'Your details are updated...' : 'Please try again...',
    ...(await loadSubjectSchedule(memberId, {
      course_name: payload.courseYearKey,
      semester_name: scope.currentYear,
      subject_id: scope.subjectId,
      month: payload.month,
    }, { ...audit, skipLog: true })),
  };
}

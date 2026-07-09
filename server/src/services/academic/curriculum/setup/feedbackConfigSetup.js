import { prisma } from '../../../../config/prisma.js';
import { escapeSql, parseId } from '../../../../utils/sqlSafe.js';
import { basicSetupCourseSelect } from '../../../../utils/legacySelects.js';
import { convertNYear } from '../../../fees/feeHelpers.js';
import { loadAcademicConfig } from '../../../shared/ciaSetupHelpers.js';
import { loadSubjectMasterMap } from '../../academicSetupShared.js';
import { auditFields, logAcademicSetup } from '../../setup/setupAudit.js';

const PAGES = {
  UG: 'feedback_config.php',
  PG: 'feedback_config_pg.php',
};

function feedbackCourseKey(courseId, academicYear, currentYear) {
  return `${courseId}___${academicYear}___${currentYear}`;
}

function parseFeedbackCourseKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length !== 3) return null;
  return {
    courseId: Number(parts[0]),
    academicYear: parts[1],
    currentYear: String(parts[2]),
  };
}

function formatDateTimeDisplay(value) {
  if (!value || String(value).startsWith('0000-00-00')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
}

function parseDateTimeInput(value) {
  const s = String(value || '').trim();
  const match = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]} ${match[4]}:${match[5]}:00`;
}

async function buildFeedbackCourseOptions(courseName, savedCourseKeys = []) {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1, course_name: courseName },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });
  const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));
  const options = [];
  const acYear = courseName === 'U.G'
    ? academicYearArray['U.G']?.regular || academicYearArray['U.G']
    : academicYearArray['P.G']?.regular || academicYearArray['P.G'];

  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    const duration = courseName === 'U.G'
      ? Math.max(1, (Number(course.course_duration) || 1) - 1)
      : Number(course.course_duration) || 1;
    const group = `${course.degree_name}${dept} | ${acYear}`;

    for (let i = 1; i <= duration; i += 1) {
      options.push({
        value: feedbackCourseKey(course.id, acYear, i),
        label: `${convertNYear(i, courseName)} Year`,
        group,
        courseId: course.id,
        academicYear: acYear,
        currentYear: String(i),
      });
    }
  }

  const seen = new Set(options.map((o) => o.value));
  for (const savedKey of savedCourseKeys) {
    const key = String(savedKey || '').trim();
    if (!key || seen.has(key)) continue;
    const parsed = parseFeedbackCourseKey(key);
    const course = parsed ? courseMap[parsed.courseId] : null;
    if (!parsed || !course) continue;
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    options.push({
      value: key,
      label: `${convertNYear(Number(parsed.currentYear), courseName)} Year`,
      group: `${course.degree_name}${dept} | ${parsed.academicYear}`,
      courseId: course.id,
      academicYear: parsed.academicYear,
      currentYear: parsed.currentYear,
    });
    seen.add(key);
  }

  return options;
}

async function loadFeedbackOptions(mode) {
  const filter = mode === 'UG'
    ? `course_id LIKE '1___20%'`
    : `course_id NOT LIKE '1___20%'`;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, title, course_id, CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
     FROM feedback_master WHERE del=1 AND ${filter} ORDER BY from_date ASC`,
  );
  return rows.map((r) => ({
    value: String(r.id),
    label: `${r.title || ''} | ${formatDateTimeDisplay(r.from_date)} to ${formatDateTimeDisplay(r.to_date)}`,
    title: r.title || '',
    courseId: r.course_id || '',
    fromDate: formatDateTimeDisplay(r.from_date),
    toDate: formatDateTimeDisplay(r.to_date),
  }));
}

async function loadStaffNameMap() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_title, staff_name, staff_initial
     FROM staff_profile_tb WHERE del=1 ORDER BY staff_name ASC, staff_initial ASC`,
  );
  const map = {};
  for (const row of rows) {
    const label = `${row.staff_id || ''} | ${row.staff_title || ''}. ${row.staff_initial || ''} ${row.staff_name || ''}`.trim();
    map[String(row.id)] = label;
  }
  return map;
}

async function loadStaffOptionsForSubject(subjectRow, courseSel, staffNameMap) {
  const deptList = String(subjectRow.department || '').split(',').map((v) => v.trim()).filter(Boolean);
  let staffIds = [];

  if (deptList.length) {
    const deptClause = deptList.map((d) => `B.department='${escapeSql(d)}'`).join(' OR ');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT A.id FROM staff_profile_tb AS A
       INNER JOIN staff_designation_tb AS B ON A.id=B.staff_id
       WHERE A.del=1 AND B.del=1 AND B.is_academic=1
         AND (A.releaving_date='0000-00-00' OR A.releaving_date > CURDATE())
         AND (${deptClause})
       ORDER BY A.staff_id ASC`,
    );
    staffIds = rows.map((r) => String(r.id));
  } else {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT staff_id FROM timetable_tb
       WHERE del=1 AND course_id=${Number(courseSel.courseId)}
         AND academic_year='${escapeSql(courseSel.academicYear)}'
         AND current_year='${escapeSql(courseSel.currentYear)}'
         AND subject_id='${escapeSql(String(subjectRow.t_sid))}'
       ORDER BY id ASC`,
    );
    staffIds = rows.map((r) => String(r.staff_id));
  }

  const unique = [...new Set(staffIds.filter(Boolean))];
  return unique
    .filter((id) => staffNameMap[id])
    .map((id) => ({ value: id, label: staffNameMap[id] }));
}

async function loadSubjectRows(mode, feedbackId, courseKey) {
  const courseSel = parseFeedbackCourseKey(courseKey);
  if (!courseSel) return [];

  const { map: subjectSubcatMap } = await loadSubjectMasterMap('Timetable');
  const staffNameMap = await loadStaffNameMap();

  const subjectRows = await prisma.$queryRawUnsafe(
    `SELECT A.subject_id, A.subject_name, B.id AS t_sid, B.subject_id AS t_subject_id,
            B.subject_name AS t_subject_name, B.subject_category, B.s_batch, B.department
     FROM basic_setup_subject_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.id=B.rid
     WHERE A.del=1 AND A.academic_year='${escapeSql(courseSel.academicYear)}'
       AND A.course_id=${Number(courseSel.courseId)} AND A.semester_no='${escapeSql(courseSel.currentYear)}'
       AND B.del=1
     ORDER BY B.subject_category ASC, A.subject_order ASC`,
  );

  const savedRows = feedbackId
    ? await prisma.$queryRawUnsafe(
      `SELECT id, subject_id, staff_id FROM feedback_subject
       WHERE del=1 AND f_id='${escapeSql(String(feedbackId))}' AND course_id='${escapeSql(courseKey)}'`,
    )
    : [];
  const savedMap = Object.fromEntries(savedRows.map((r) => [String(r.subject_id), r]));

  const rows = [];
  for (const row of subjectRows) {
    const saved = savedMap[String(row.t_sid)] || {};
    const selectedStaff = String(saved.staff_id || '').split(',').map((v) => v.trim()).filter(Boolean);
    rows.push({
      rowId: saved.id ? Number(saved.id) : null,
      subjectId: String(row.t_sid),
      subjectName: row.t_subject_name || row.subject_name || '',
      type: subjectSubcatMap[String(row.subject_category)] || '',
      staffOptions: await loadStaffOptionsForSubject({ ...row, t_sid: row.t_sid }, courseSel, staffNameMap),
      selectedStaff,
    });
  }
  return rows;
}

async function loadFeedbackConfig(mode, memberId, fields = {}, audit = {}) {
  const page = PAGES[mode];
  const courseName = mode === 'UG' ? 'U.G' : 'P.G';
  const feedbackOptions = await loadFeedbackOptions(mode);

  let feedbackId = String(fields.feedbackId || fields.category || '').trim();
  const courseKey = String(fields.courseKey || fields.course_name || '').trim();

  let feedback = {
    id: null,
    title: '',
    fromDate: formatDateTimeDisplay(new Date()),
    toDate: formatDateTimeDisplay(new Date(Date.now() + 86400000)),
    courseId: '',
  };

  if (feedbackId === 'add_new') {
    feedback.title = String(fields.title || fields.feedback_title || '').trim();
    if (fields.fromDate || fields.from_date) feedback.fromDate = String(fields.fromDate || fields.from_date);
    if (fields.toDate || fields.to_date) feedback.toDate = String(fields.toDate || fields.to_date);
  } else if (feedbackId) {
    const row = await prisma.$queryRawUnsafe(
      `SELECT id, title, course_id, CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
       FROM feedback_master WHERE del=1 AND id=${Number(feedbackId)} LIMIT 1`,
    );
    if (row[0]) {
      feedback = {
        id: Number(row[0].id),
        title: row[0].title || '',
        fromDate: formatDateTimeDisplay(row[0].from_date),
        toDate: formatDateTimeDisplay(row[0].to_date),
        courseId: row[0].course_id || '',
      };
    }
  }

  const resolvedCourseKey = courseKey
    || (feedbackId && feedbackId !== 'add_new' ? String(feedback.courseId || '').trim() : '');

  const courseOptions = await buildFeedbackCourseOptions(
    courseName,
    [resolvedCourseKey, feedback.courseId].filter(Boolean),
  );

  const subjectRows = resolvedCourseKey
    ? await loadSubjectRows(mode, feedback.id || feedbackId, resolvedCourseKey)
    : [];

  await logAcademicSetup(page, 'View', 'Successful', feedbackId || resolvedCourseKey, memberId, audit);
  return {
    feedbackOptions: [{ value: 'add_new', label: 'Add New' }, ...feedbackOptions],
    feedbackId,
    feedback,
    courseOptions,
    courseKey: resolvedCourseKey,
    subjectRows,
  };
}

async function saveFeedbackConfig(mode, payload, memberId, audit = {}) {
  const page = PAGES[mode];
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.feedbackId || payload.category);
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE feedback_master SET del=0, updated_by='${escapeSql(memberId)}',
         updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW() WHERE id=${id}`,
      );
      await logAcademicSetup(page, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadFeedbackConfig(mode, memberId, {}, { ...audit, skipLog: true })),
      };
    } catch {
      await logAcademicSetup(page, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const courseKey = String(payload.courseKey || payload.course_name || '').trim();
  const title = String(payload.title || payload.feedback_title || '').trim();
  const fromDate = parseDateTimeInput(payload.fromDate || payload.from_date);
  const toDate = parseDateTimeInput(payload.toDate || payload.to_date);
  let feedbackId = String(payload.feedbackId || payload.category || '').trim();

  if (!courseKey) {
    return { success: false, message: 'Course is required' };
  }

  if (feedbackId === 'add_new') {
    await prisma.$executeRawUnsafe(
      `INSERT INTO feedback_master (title, course_id, from_date, to_date, created_dt, created_ip, created_by, del)
       VALUES ('${escapeSql(title)}', '${escapeSql(courseKey)}', '${escapeSql(fromDate || '2000-01-01 00:00:00')}',
       '${escapeSql(toDate || '2000-01-01 00:00:00')}', NOW(), '${escapeSql(create.created_ip)}',
       '${escapeSql(memberId)}', 1)`,
    );
    const created = await prisma.$queryRawUnsafe(
      `SELECT id FROM feedback_master WHERE title='${escapeSql(title)}' AND created_by='${escapeSql(memberId)}'
       AND del=1 ORDER BY created_dt DESC LIMIT 1`,
    );
    feedbackId = String(created[0]?.id || '');
  } else if (feedbackId && /^\d+$/.test(feedbackId)) {
    await prisma.$executeRawUnsafe(
      `UPDATE feedback_master SET title='${escapeSql(title)}', course_id='${escapeSql(courseKey)}',
       from_date='${escapeSql(fromDate || '2000-01-01 00:00:00')}',
       to_date='${escapeSql(toDate || '2000-01-01 00:00:00')}',
       updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
       WHERE del=1 AND id=${Number(feedbackId)}`,
    );
  }

  if (feedbackId && /^\d+$/.test(feedbackId)) {
    await prisma.$executeRawUnsafe(
      `UPDATE feedback_subject SET del=0, updated_by='${escapeSql(memberId)}',
       updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
       WHERE f_id='${escapeSql(feedbackId)}' AND course_id='${escapeSql(courseKey)}' AND del=1`,
    );

    const subjectRows = Array.isArray(payload.subjectRows) ? payload.subjectRows : [];
    for (const row of subjectRows) {
      const subjectId = String(row.subjectId || row.subject_id || '').trim();
      const staffIds = Array.isArray(row.selectedStaff)
        ? row.selectedStaff
        : (Array.isArray(row.selected_staff) ? row.selected_staff : []);
      const staffId = staffIds.map((v) => String(v).trim()).filter(Boolean).join(',');
      const rowId = row.rowId || row.srow_id;

      if (rowId && /^\d+$/.test(String(rowId))) {
        await prisma.$executeRawUnsafe(
          `UPDATE feedback_subject SET course_id='${escapeSql(courseKey)}', subject_id='${escapeSql(subjectId)}',
           staff_id='${escapeSql(staffId)}', del=1, updated_by='${escapeSql(memberId)}',
           updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW() WHERE id=${Number(rowId)}`,
        );
      } else if (staffId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO feedback_subject (f_id, course_id, subject_id, staff_id, created_dt, created_ip, created_by, del)
           VALUES ('${escapeSql(feedbackId)}', '${escapeSql(courseKey)}', '${escapeSql(subjectId)}',
           '${escapeSql(staffId)}', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)`,
        );
      }
    }
  }

  await logAcademicSetup(page, 'Update', 'Successful', feedbackId, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadFeedbackConfig(mode, memberId, { feedbackId, courseKey }, { ...audit, skipLog: true })),
  };
}

export async function loadFeedbackConfigUg(memberId, fields = {}, audit = {}) {
  return loadFeedbackConfig('UG', memberId, fields, audit);
}

export async function saveFeedbackConfigUg(payload, memberId, audit = {}) {
  return saveFeedbackConfig('UG', payload, memberId, audit);
}

export async function loadFeedbackConfigPg(memberId, fields = {}, audit = {}) {
  return loadFeedbackConfig('PG', memberId, fields, audit);
}

export async function saveFeedbackConfigPg(payload, memberId, audit = {}) {
  return saveFeedbackConfig('PG', payload, memberId, audit);
}

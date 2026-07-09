import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import {
  buildTtConfigCourseYearOptions,
  loadBatchCount,
  getCourseById,
  getTimeTable,
  loadStaffIdMap,
  parseCourseIdYearKey,
  resolveSubjectAcademicYear,
} from '../academicSetupShared.js';
import { logAcademicSetup } from './setupAudit.js';

const PAGE = 'tt_config.php';

function batchLetters(count) {
  const map = {};
  let letter = 'A';
  for (let i = 1; i <= count; i += 1) {
    map[i] = letter;
    letter = String.fromCharCode(letter.charCodeAt(0) + 1);
  }
  return map;
}

async function loadCellAllocations(scope, day, period) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT subject_id, batch_no, staff_id FROM timetable_tb
     WHERE del=1 AND course_id='${escapeSql(String(scope.courseId))}'
       AND academic_year='${escapeSql(scope.academicYear)}' AND current_year='${escapeSql(String(scope.semester))}'
       AND academic_type='${escapeSql(scope.academicType)}' AND t_day='${escapeSql(day)}'
       AND period='${escapeSql(String(period))}' ORDER BY id ASC`,
  );

  const staffMap = await loadStaffIdMap();
  const subcatRows = await prisma.$queryRawUnsafe(
    "SELECT id, category_name FROM subject_master WHERE del=1 AND category='Timetable'",
  );
  const subcatMap = Object.fromEntries(subcatRows.map((r) => [String(r.id), r.category_name]));

  const subjectYear = await resolveSubjectAcademicYear(
    scope.courseId,
    scope.academicYear,
    scope.semester,
  );

  const subjectRows = await prisma.$queryRawUnsafe(
    `SELECT A.subject_id, A.subject_name, B.id, B.subject_id AS t_subject_id, B.subject_name AS t_subject_name,
            B.subject_category, B.s_batch, B.short_subject_name
     FROM basic_setup_subject_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
     WHERE A.del = 1 AND A.academic_year = '${escapeSql(subjectYear)}'
       AND A.course_id = '${escapeSql(String(scope.courseId))}' AND A.semester_no = '${escapeSql(String(scope.semester))}' AND B.del = 1
     ORDER BY A.subject_order ASC`,
  );
  const subjectMap = {};
  const totalBatch = await loadBatchCount(
    scope.courseId,
    subjectYear,
    scope.semester,
    scope.academicType,
  );
  const batchMap = batchLetters(totalBatch);
  for (const row of subjectRows) {
    const cat = subcatMap[String(row.subject_category)] || '';
    subjectMap[row.id] = {
      shortName: `${row.short_subject_name || row.t_subject_name} (${cat.slice(0, 2)})`,
      batchCount: row.s_batch === 1 ? totalBatch : 1,
    };
  }

  const items = rows.map((row) => {
    const subj = subjectMap[row.subject_id] || { shortName: '', batchCount: 1 };
    const staffIds = String(row.staff_id || '').split(',').map((s) => s.trim()).filter(Boolean);
    const staffLabel = staffIds.map((id) => staffMap[id]).filter(Boolean).join(', ');
    let label = subj.shortName;
    if (subj.batchCount > 1 && batchMap[Number(row.batch_no)]) {
      label += ` (#${batchMap[Number(row.batch_no)]})`;
    }
    return `${label}: ${staffLabel}`;
  });

  const summary = items.length > 5
    ? `${items.slice(0, 5).join('<br>')}<br>+${items.length - 5} more...`
    : items.join('<br>');

  return { summary, count: rows.length };
}

export async function loadTtConfig(memberId, fields = {}, audit = {}) {
  const courseYearOptions = await buildTtConfigCourseYearOptions();
  const selection = parseCourseIdYearKey(fields.course_name);
  const semester = Number(fields.semester_name) || 0;
  const loadGrid = fields.generate === true || fields.Submit === 'Go' || fields.loadGrid === true;

  let course = null;
  let grid = null;
  let scope = null;

  if (selection) {
    course = await getCourseById(selection.courseId);
  }

  if (selection && semester && loadGrid) {
    scope = {
      courseId: selection.courseId,
      academicYear: selection.academicYear,
      academicType: selection.academicType,
      semester,
      courseName: course?.course_name,
    };

    const tt = await getTimeTable(course.course_name, String(semester), selection.academicType);
    const headers = [];
    if (tt.first && tt.time[tt.first]) {
      const dayPeriod = tt.time[tt.first];
      for (let i = 1; i <= tt.max; i += 1) {
        const pt = dayPeriod[i];
        if (!pt) continue;
        const colspan = pt.col > 0 ? pt.col + 1 : 1;
        headers.push({
          from: pt.ftime,
          to: pt.ttime,
          colspan,
          periodOrder: i,
        });
        if (pt.col > 0) i += pt.col;
      }
    }

    const rows = [];
    let counter = 0;
    let pcounter = 0;
    let prevDay = '';
    for (const [day, dayPeriod] of Object.entries(tt.time)) {
      if (!dayPeriod.comp) continue;
      const rowSpan = dayPeriod.row === 2 && prevDay ? 2 : 1;
      const cells = [];
      for (let i = 1; i <= tt.max; i += 1) {
        const pt = dayPeriod[i];
        if (!pt || pt.row === -1) continue;
        const isBreak = String(pt.period).toLowerCase() === 'break';
        let cell = {
          isBreak,
          period: pt.period,
          from: pt.ftime,
          to: pt.ttime,
          colspan: pt.col > 0 ? pt.col + 1 : 1,
          rowspan: pt.row > 1 ? pt.row : rowSpan,
          counter: null,
          summary: isBreak ? 'Break' : '',
          day,
          periodNo: pt.period,
        };
        if (!isBreak && pt.period) {
          const alloc = await loadCellAllocations(scope, day, pt.period);
          cell = { ...cell, counter, summary: alloc.summary };
          counter += 1;
        }
        cells.push(cell);
        if (pt.col > 0) i += pt.col;
      }
      rows.push({
        day,
        label: day.charAt(0).toUpperCase() + day.slice(1),
        rowSpan,
        shaded: pcounter % 2 === 0,
        cells,
      });
      prevDay = day;
      pcounter += 1;
    }

    grid = { headers, rows, maxPeriod: tt.max };
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', fields.course_name || '', memberId, audit);
  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection,
    semester,
    totalSemester: course ? Number(course.total_semester) || Number(course.course_duration) || 0 : 0,
    scope,
    grid,
    loaded: Boolean(grid),
  };
}

export async function saveTtConfig() {
  return { success: false, message: 'Use timetable cell editor to save allocations' };
}

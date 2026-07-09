import { prisma } from '../src/config/prisma.js';
import {
  buildPeriodCompletionReport,
  dateOverlapSql,
  staffMatchSql,
  loadSessionPeriodMap,
} from '../src/services/academic/curriculum/reports/reportShared.js';
import { getAttendance, modifiedAttendance, getLPTime } from '../src/services/attendance/staffAttendanceCore.js';
import { getCourseById } from '../src/services/academic/academicSetupShared.js';
import { parseInputDate } from '../src/services/shared/ciaSetupHelpers.js';
import { escapeSql } from '../src/utils/sqlSafe.js';

const fromDate = process.argv[2] || '01-01-2026';
const toDate = process.argv[3] || '31-03-2026';
const fromIso = parseInputDate(fromDate);
const toIso = parseInputDate(toDate);

async function legacyCalc(stId, staff) {
  const sessionRef = await loadSessionPeriodMap();
  const lp = await getLPTime(staff.att_category);
  const attendanceStore = {};
  const courseCache = {};
  const legacyRows = [];
  const legacyTotals = { total: 0, attend: 0, unattend: 0 };
  const completedSubject = new Set();

  const ttRows = await prisma.$queryRawUnsafe(
    `SELECT A.course_id, A.academic_year, A.current_year, A.academic_type,
            A.subject_id, B.subject_name, GROUP_CONCAT(A.t_day SEPARATOR ',') AS t_days
     FROM timetable_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.subject_id = B.id
     WHERE A.del = 1 AND B.del = 1
       AND ${dateOverlapSql(fromIso, toIso)} AND ${staffMatchSql(stId)}
     GROUP BY A.subject_id, A.staff_id
     ORDER BY B.subject_id ASC`,
  );

  for (const tt of ttRows) {
    const subKey = String(tt.subject_id);
    if (completedSubject.has(subKey)) continue;
    completedSubject.add(subKey);

    const courseId = tt.course_id;
    if (!courseCache[courseId]) {
      const course = await getCourseById(courseId);
      courseCache[courseId] = { courseName: course?.course_name || '' };
    }
    const cname = courseCache[courseId].courseName;
    const academicType = String(tt.academic_type || '').toLowerCase();
    const sessionDetails = sessionRef[cname]?.[String(tt.current_year)]?.[academicType] || { session: {} };
    const tDayList = String(tt.t_days || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

    let allocated = 0;
    let attended = 0;
    let missed = 0;
    let od = 0;
    let al = 0;
    let ul = 0;

    for (let m = new Date(fromIso).getTime(); m <= new Date(toIso).getTime(); m += 86400000) {
      const curDate = new Date(m).toISOString().slice(0, 10);
      const tDay = new Date(m).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (!tDayList.includes(tDay)) continue;

      if (!attendanceStore[curDate]) {
        let att1 = await getAttendance(staff.id, staff.staff_id, curDate, lp);
        if (String(att1.s).toLowerCase() === 'h') att1 = { ...att1, m: 'h', e: 'h' };
        attendanceStore[curDate] = await modifiedAttendance(
          staff.id, staff.staff_id, curDate, lp, att1, 0,
        );
      }
      const attStatus = attendanceStore[curDate];
      if (attStatus.m !== 'h' || attStatus.e !== 'h') {
        const periods = await prisma.$queryRawUnsafe(
          `SELECT period FROM timetable_tb AS A
           WHERE A.del = 1 AND LOWER(A.t_day) = '${escapeSql(tDay)}'
             AND A.course_id = '${escapeSql(String(courseId))}'
             AND A.academic_year = '${escapeSql(tt.academic_year)}'
             AND A.current_year = '${escapeSql(String(tt.current_year))}'
             AND A.academic_type = '${escapeSql(tt.academic_type)}'
             AND A.subject_id = '${escapeSql(String(tt.subject_id))}'
             AND ${staffMatchSql(stId)}
             AND CAST(A.from_date AS CHAR) NOT LIKE '0000-00-00%'
             AND A.from_date <= '${escapeSql(curDate)}'
             AND (CAST(A.to_date AS CHAR) LIKE '0000-00-00%' OR A.to_date >= '${escapeSql(curDate)}')
           ORDER BY A.period ASC`,
        );
        for (const pr of periods) {
          allocated += 1;
          const ps = sessionDetails.session[tDay]?.[pr.period];
          if (ps === 'forenoon') {
            if (attStatus.m === 'le' || (attStatus.m === 'p' && attStatus.attopt?.m === 'od') || attStatus.m === 'a') {
              if (attStatus.m === 'p' && attStatus.attopt?.m === 'od') od += 1;
              else if (attStatus.msrc === 'lr') al += 1;
              else ul += 1;
              missed += 1;
            } else if (attStatus.m !== 'a' && attStatus.m !== 'h') attended += 1;
          } else if (ps === 'afternoon') {
            if (attStatus.e === 'le' || (attStatus.e === 'p' && attStatus.attopt?.e === 'od') || attStatus.e === 'a') {
              if (attStatus.e === 'p' && attStatus.attopt?.e === 'od') od += 1;
              else if (attStatus.esrc === 'lr') al += 1;
              else ul += 1;
              missed += 1;
            } else if (attStatus.e !== 'a' && attStatus.e !== 'h') attended += 1;
          } else {
            missed += 1;
            ul += 1;
          }
        }
      }
    }

    if (allocated > 0) {
      legacyRows.push({
        subject: tt.subject_name, allocated, attended, missed, od, al, ul,
      });
      legacyTotals.total += allocated;
      legacyTotals.attend += attended;
      legacyTotals.unattend += missed;
    }
  }

  return { legacyRows, legacyTotals };
}

const staffList = await prisma.$queryRawUnsafe(
  `SELECT DISTINCT TRIM(SUBSTRING_INDEX(staff_id, ',', 1)) AS sid
   FROM timetable_tb WHERE del = 1 AND staff_id != '' LIMIT 30`,
);

let compared = 0;
let mismatches = 0;

for (const { sid } of staffList) {
  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, att_category FROM staff_profile_tb
     WHERE del = 1 AND id = '${escapeSql(sid)}' LIMIT 1`,
  );
  const staff = staffRows[0];
  if (!staff) continue;

  const modern = await buildPeriodCompletionReport({
    fromDate,
    toDate,
    dedupeSubjects: true,
    whereExtra: `AND (${staffMatchSql(String(staff.id))})`,
  });
  const legacy = await legacyCalc(String(staff.id), staff);
  if (!modern.totals.total && !legacy.legacyTotals.total) continue;

  compared += 1;
  const match = modern.totals.total === legacy.legacyTotals.total
    && modern.totals.attend === legacy.legacyTotals.attend
    && modern.totals.unattend === legacy.legacyTotals.unattend;

  console.log(
    match ? 'OK' : 'MISMATCH',
    staff.staff_id,
    staff.staff_name,
    'modern', modern.totals,
    'legacy', legacy.legacyTotals,
    'rows', modern.rows.length, legacy.legacyRows.length,
  );

  if (!match) {
    mismatches += 1;
    for (let i = 0; i < Math.min(modern.rows.length, legacy.legacyRows.length, 3); i += 1) {
      const m = modern.rows[i];
      const l = legacy.legacyRows[i];
      if (m.subjectName !== l.subject || m.allocated !== l.allocated || m.attended !== l.attended) {
        console.log('  row', i, m?.subjectName, m?.allocated, m?.attended, m?.missed, 'vs', l?.subject, l?.allocated, l?.attended, l?.missed);
      }
    }
  }
  if (compared >= 5) break;
}

console.log('Compared', compared, 'staff with data. Mismatches:', mismatches);
await prisma.$disconnect();

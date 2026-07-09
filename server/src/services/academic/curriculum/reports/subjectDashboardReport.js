import { prisma } from '../../../../config/prisma.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { convertNYear } from '../../../fees/feeHelpers.js';
import { loadAcademicConfig } from '../../../shared/ciaSetupHelpers.js';
import {
  getAttendance,
  getLPTime,
  modifiedAttendance,
} from '../../../attendance/staffAttendanceCore.js';
import { logAcademicSetup } from '../../setup/setupAudit.js';
import { escapeHtml, loadRoomBlockMap, wrapReportPanel } from './reportShared.js';

const PAGE = 'subject_dashboard.php';
const academicYearCache = new Map();
const TIMETABLE_TABLES = ['timetable_tb_new', 'timetable_tb'];

function weekdayKey(dateIso) {
  const [y, m, d] = String(dateIso).split('-').map(Number);
  const local = new Date(y, m - 1, d, 12, 0, 0);
  return local.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function sqlTime(time) {
  const value = String(time || '').trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return value;
}

function formatPeriodClock(value) {
  const raw = String(value || '');
  const match = raw.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : raw.slice(0, 5);
}

function splitStaffIds(value) {
  return String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function timetableDateFilter(dateIso, alias = 'A') {
  const date = escapeSql(dateIso);
  const prefix = alias ? `${alias}.` : '';
  return ` AND ${prefix}from_date <= '${date}'
    AND CAST(${prefix}from_date AS CHAR) NOT LIKE '0000-00-00%'
    AND (CAST(${prefix}to_date AS CHAR) LIKE '0000-00-00%' OR ${prefix}to_date >= '${date}')`;
}

async function listAcademicYearsForDate(tableName, courseId, currentYear, academicType, dateIso) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT academic_year
     FROM ${tableName}
     WHERE del = 1
       AND course_id = '${escapeSql(String(courseId))}'
       AND current_year = '${escapeSql(String(currentYear))}'
       AND LOWER(academic_type) = LOWER('${escapeSql(academicType)}')
       ${timetableDateFilter(dateIso, '')}
     ORDER BY academic_year DESC`,
  );
  return rows.map((row) => String(row.academic_year));
}

async function resolveDashboardAcademicYear(courseId, setupYear, currentYear, academicType, dateIso) {
  const cacheKey = `${courseId}|${setupYear}|${currentYear}|${academicType}|${dateIso}`;
  if (academicYearCache.has(cacheKey)) return academicYearCache.get(cacheKey);

  const setup = String(setupYear || '');
  let resolved = setup;

  for (const tableName of TIMETABLE_TABLES) {
    const years = await listAcademicYearsForDate(tableName, courseId, currentYear, academicType, dateIso);
    if (!years.length) continue;
    resolved = (setup && years.includes(setup)) ? setup : years[0];
    break;
  }

  academicYearCache.set(cacheKey, resolved);
  return resolved;
}

async function loadDashboardTimetableRows({
  courseId,
  academicYearRef,
  currentYear,
  academicType,
  periodDay,
  prdStr,
  dateIso,
}) {
  const cid = escapeSql(String(courseId));
  const year = escapeSql(String(academicYearRef || ''));
  const cy = escapeSql(String(currentYear));
  const at = escapeSql(academicType);
  const day = escapeSql(periodDay);

  for (const tableName of TIMETABLE_TABLES) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT A.staff_id, A.period, A.subject_id, B.subject_name, B.room_no
       FROM ${tableName} AS A
       INNER JOIN basic_subject_tt_tb AS B ON A.subject_id = B.id
       WHERE A.del = 1 AND B.del = 1
         AND A.course_id = '${cid}'
         AND A.academic_year = '${year}'
         AND A.current_year = '${cy}'
         AND LOWER(A.academic_type) = LOWER('${at}')
         AND LOWER(A.t_day) = '${day}'
         ${timetableDateFilter(dateIso)} ${prdStr}
       ORDER BY B.subject_id ASC, A.period ASC`,
    );
    if (rows.length) return rows;
  }
  return [];
}

async function resolveStaffIds({
  courseId,
  academicYearRef,
  currentYear,
  academicType,
  periodDay,
  period,
  subjectId,
  staffIdFromRow,
  dateIso,
}) {
  const direct = splitStaffIds(staffIdFromRow);
  if (direct.length) return direct;

  const cid = escapeSql(String(courseId));
  const year = escapeSql(String(academicYearRef || ''));
  const cy = escapeSql(String(currentYear));
  const at = escapeSql(academicType);
  const day = escapeSql(periodDay);
  const per = escapeSql(String(period));
  const sid = escapeSql(String(subjectId));
  const date = escapeSql(dateIso);

  const exactRows = await prisma.$queryRawUnsafe(
    `SELECT staff_id
     FROM timetable_tb
     WHERE del = 1
       AND course_id = '${cid}'
       AND academic_year = '${year}'
       AND current_year = '${cy}'
       AND LOWER(academic_type) = LOWER('${at}')
       AND LOWER(t_day) = '${day}'
       AND period = '${per}'
       AND subject_id = '${sid}'
       AND from_date = '${date}'
       AND staff_id != ''
     ORDER BY id DESC
     LIMIT 1`,
  );
  const exact = splitStaffIds(exactRows[0]?.staff_id);
  if (exact.length) return exact;

  const latestRows = await prisma.$queryRawUnsafe(
    `SELECT staff_id
     FROM timetable_tb
     WHERE del = 1
       AND course_id = '${cid}'
       AND academic_year = '${year}'
       AND current_year = '${cy}'
       AND LOWER(academic_type) = LOWER('${at}')
       AND LOWER(t_day) = '${day}'
       AND period = '${per}'
       AND subject_id = '${sid}'
       AND from_date <= '${date}'
       AND CAST(from_date AS CHAR) NOT LIKE '0000-00-00%'
       AND staff_id != ''
     ORDER BY from_date DESC, id DESC
     LIMIT 1`,
  );
  return splitStaffIds(latestRows[0]?.staff_id);
}

async function loadCoursesByName(courseName) {
  return prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_short_name, course_name, c_order
     FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = '${escapeSql(courseName)}'
     ORDER BY c_order ASC`,
  );
}

function defaultDateTime() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()} ${hh}:${mi}`;
}

function parseDateTimeInput(val) {
  const s = String(val || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    date: `${m[3]}-${m[2]}-${m[1]}`,
    time: `${m[4]}:${m[5]}`,
    display: s,
  };
}

export async function loadSubjectDashboardReport(memberId, fields = {}, audit = {}) {
  const generate = Boolean(fields.generate || fields.Submit === 'Go');
  const currentDateRef = fields.current_date || defaultDateTime();
  const parsed = parseDateTimeInput(currentDateRef);
  let html = '';

  if (generate && parsed) {
    academicYearCache.clear();
    const academicYears = await loadAcademicConfig();
    const ugYear = academicYears['U.G']?.regular || academicYears['U.G'];
    const pgYear = academicYears['P.G']?.regular || academicYears['P.G'];
    const academicYearArray = { 'U.G': ugYear, 'P.G': pgYear };

    const periodDay = weekdayKey(parsed.date);
    const periodDayEsc = escapeSql(periodDay);
    const queryTime = sqlTime(parsed.time);
    const periodDayString = ` AND (LOWER(p_days) = '${periodDayEsc}' OR LOWER(p_days) LIKE '${periodDayEsc},%' OR LOWER(p_days) LIKE '%,${periodDayEsc}' OR LOWER(p_days) LIKE '%,${periodDayEsc},%')`;

    const periodRows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT period_no, course_name, academic_year, academic_type, from_time, to_time
       FROM period_set_up
       WHERE del != 0 AND period_no != 'Break' AND p_combined = '0' ${periodDayString}
         AND from_time != '00:00:00' AND to_time != '00:00:00'
         AND from_time <= '${escapeSql(queryTime)}' AND to_time >= '${escapeSql(queryTime)}'
       ORDER BY academic_year + 0 ASC, period_no + 0 ASC`,
    );

    const sessionDetails = {};
    for (const row of periodRows) {
      if (!sessionDetails[row.course_name]) sessionDetails[row.course_name] = {};
      if (!sessionDetails[row.course_name][row.academic_year]) sessionDetails[row.course_name][row.academic_year] = {};
      if (!sessionDetails[row.course_name][row.academic_year][row.academic_type]) {
        sessionDetails[row.course_name][row.academic_year][row.academic_type] = { prd: '' };
      }
      const bucket = sessionDetails[row.course_name][row.academic_year][row.academic_type];
      bucket[row.period_no] = {
        time: `${formatPeriodClock(row.from_time)} - ${formatPeriodClock(row.to_time)}`,
      };
      bucket.prd += ` A.period='${escapeSql(String(row.period_no))}' OR `;
    }

    const roomMap = await loadRoomBlockMap();
    const currentStaffDetails = { a: {}, le: {}, p: {} };
    const fStaffAtt = {};
    const lpCache = new Map();

    for (const [courseName, courseSub] of Object.entries(sessionDetails)) {
      const courses = await loadCoursesByName(courseName);

      for (const course of courses) {
        let dept = String(course.department_short_name || '').trim();
        if (dept && dept !== '-') dept = ` | ${dept}`;
        else dept = '';
        const setupYear = academicYearArray[courseName];

        for (const [currentYear, academicSub] of Object.entries(courseSub)) {
          const degreeNameStr = `<strong>${convertNYear(Number(currentYear), courseName)} ${course.degree_name}</strong>${dept}`;

          for (const [academicType, academicPeriod] of Object.entries(academicSub)) {
            if (!academicPeriod.prd) continue;
            const prdStr = ` AND (${academicPeriod.prd.slice(0, -3)})`;
            const academicYearRef = await resolveDashboardAcademicYear(
              course.id,
              setupYear,
              currentYear,
              academicType,
              parsed.date,
            );
            const ttRows = await loadDashboardTimetableRows({
              courseId: course.id,
              academicYearRef,
              currentYear,
              academicType,
              periodDay,
              prdStr,
              dateIso: parsed.date,
            });

            for (const row of ttRows) {
              const roomLabel = roomMap[String(row.room_no)] || '';
              const staffIds = await resolveStaffIds({
                courseId: course.id,
                academicYearRef,
                currentYear,
                academicType,
                periodDay,
                period: row.period,
                subjectId: row.subject_id,
                staffIdFromRow: row.staff_id,
                dateIso: parsed.date,
              });
              if (!staffIds.length) continue;

              for (const stId of staffIds) {
                const staffRows = await prisma.$queryRawUnsafe(
                  `SELECT id, staff_id, staff_initial, staff_name, att_category
                   FROM staff_profile_tb WHERE del = 1 AND id = '${escapeSql(stId)}' LIMIT 1`,
                );
                const staff = staffRows[0];
                if (!staff) continue;

                const stLabel = `<small><strong>${escapeHtml(staff.staff_initial)} ${escapeHtml(staff.staff_name)}</strong> | ${escapeHtml(staff.staff_id)}</small>`;
                if (!fStaffAtt[stId]) {
                  const catKey = String(staff.att_category || '1');
                  if (!lpCache.has(catKey)) lpCache.set(catKey, await getLPTime(staff.att_category));
                  const lp = lpCache.get(catKey);
                  let att1 = await getAttendance(staff.id, staff.staff_id, parsed.date, lp);
                  if (String(att1.s).toLowerCase() === 'h') att1 = { ...att1, m: 'h', e: 'h' };
                  const att = await modifiedAttendance(staff.id, staff.staff_id, parsed.date, lp, att1, 0);
                  if (att.m === 'h') fStaffAtt[stId] = 'h';
                  else if (
                    att.m === 'le'
                    || (att.m === 'p' && att.attopt?.m === 'od')
                    || (att.m === 'a' && (att.msrc === 'lr' || att.msrc === 'dr'))
                  ) fStaffAtt[stId] = 'le';
                  else if (att.m !== 'a') fStaffAtt[stId] = 'p';
                }

                let txtColor = '';
                if (fStaffAtt[stId] === 'le') txtColor = ' style="color:#5D9800;"';
                else if (fStaffAtt[stId] !== 'p') txtColor = ' style="color:#9F050F;"';
                let saType = fStaffAtt[stId] || 'a';
                if (saType === 'h') continue;

                let labelHtml = stLabel;
                if (saType === 'le') {
                  const tasks = await prisma.$queryRawUnsafe(
                    `SELECT A.staff_initial, A.staff_name, A.staff_id FROM staff_profile_tb AS A
                     INNER JOIN att_leave_task AS B ON A.id = B.allocated_to
                     WHERE A.del = 1 AND B.del = 1 AND B.staff_id = '${escapeSql(String(stId))}'
                       AND B.req_date = '${escapeSql(parsed.date)}'
                       AND B.from_time <= '${escapeSql(queryTime)}' AND B.to_time >= '${escapeSql(queryTime)}'`,
                  );
                  const alt = tasks.map((t) => `<br><small><strong>${escapeHtml(t.staff_initial)} ${escapeHtml(t.staff_name)}</strong> | ${escapeHtml(t.staff_id)}</small>`).join('');
                  if (alt) labelHtml = `<s>${stLabel}</s>${alt}`;
                }

                const rowHtml = `<tr>
                  <td${txtColor}>${labelHtml}</td>
                  <td${txtColor}><small>${degreeNameStr}</small></td>
                  <td${txtColor}>${escapeHtml(row.period)}</td>
                  <td${txtColor}><small>${escapeHtml(row.subject_name)}</small></td>
                  <td${txtColor}><small>${roomLabel}</small></td>
                </tr>`;
                const key = staff.staff_id;
                if (!currentStaffDetails[saType][key]) currentStaffDetails[saType][key] = rowHtml;
                else currentStaffDetails[saType][key] += rowHtml;
              }
            }
          }
        }
      }
    }

    const sortJoin = (obj) => Object.keys(obj).sort().map((k) => obj[k]).join('');
    html = wrapReportPanel(`<table class="table table-bordered staff_attendance">
      <tr class="table-secondary">
        <th>Staff</th><th>Class</th><th>Period</th><th>Subject</th><th>Class Room</th>
      </tr>${sortJoin(currentStaffDetails.a)}${sortJoin(currentStaffDetails.le)}${sortJoin(currentStaffDetails.p)}
    </table>`);
  }

  await logAcademicSetup(PAGE, generate ? 'Generate' : 'View', 'Successful', currentDateRef, memberId, audit);
  return { currentDate: currentDateRef, html };
}

export async function saveSubjectDashboardReport(memberId, fields = {}, audit = {}) {
  return loadSubjectDashboardReport(memberId, fields, audit);
}

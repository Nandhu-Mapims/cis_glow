import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear } from '../fees/feeHelpers.js';

/** Legacy: attendance_report.php, attendance_report_more.php, attendance_report_quartely*.php */

const attendanceCache = new Map();
const quarterlyCache = new Map();
const roomMachineCache = new Map();
let subcatMapCache = null;

function parseDisplayDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [d, m, y] = s.split('-');
  if (d && m && y && y.length === 4) return `${y}-${m}-${d}`;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

function rollMatchSql(registerNo) {
  const r = escapeSql(registerNo);
  return `(roll_no = '${r}' OR roll_no LIKE '${r},%' OR roll_no LIKE '%,${r}' OR roll_no LIKE '%,${r},%')`;
}

function matchInCommaList(listStr, value) {
  const v = String(value);
  return String(listStr || '').split(',').some((p) => p.trim() === v);
}

function matchBatchNo(batchField, batchNo) {
  return matchInCommaList(batchField, batchNo) || String(batchField) === String(batchNo);
}

function punchTableName(ds) {
  return `punchtimedetails_${ds.slice(0, 4)}${Math.ceil(Number(ds.slice(5, 7)) / 4)}`;
}

function parseMachineFlags(machineSql) {
  const flags = [];
  const re = /flag='([^']+)'/gi;
  let m;
  while ((m = re.exec(machineSql))) flags.push(m[1]);
  return flags;
}

function normalizeReportType(reportType) {
  if (reportType === 'Consolidated') return 'Overall';
  return reportType || 'Monthly';
}

async function getRoomNo(roomId) {
  const row = await prisma.rooms_tb.findFirst({
    where: { del: 1, id: Number(roomId) },
    select: { machine_id: true, room_name: true },
  });
  if (!row) return '';
  let machineStr = '';
  for (const src of [row.machine_id, row.room_name]) {
    for (const mid of String(src || '').split(',')) {
      const m = mid.trim();
      if (m) machineStr += ` flag='${escapeSql(m)}' OR`;
    }
  }
  return machineStr ? ` AND (${machineStr.slice(0, -2)})` : '';
}

async function getRoomNoCached(roomId) {
  const key = String(roomId);
  if (roomMachineCache.has(key)) return roomMachineCache.get(key);
  const v = await getRoomNo(roomId);
  roomMachineCache.set(key, v);
  return v;
}

async function getSubcatMap() {
  if (subcatMapCache) return subcatMapCache;
  const deptRows = await prisma.subject_master.findMany({
    where: { del: 1, category: 'Timetable' },
    select: { id: true, category_name: true },
  });
  subcatMapCache = Object.fromEntries(deptRows.map((d) => [String(d.id), d.category_name.toLowerCase()]));
  return subcatMapCache;
}

let subcatDisplayCache = null;
async function getSubcatDisplayMap() {
  if (subcatDisplayCache) return subcatDisplayCache;
  const deptRows = await prisma.subject_master.findMany({
    where: { del: 1, category: 'Timetable' },
    select: { id: true, category_name: true },
  });
  subcatDisplayCache = Object.fromEntries(deptRows.map((d) => [String(d.id), d.category_name]));
  return subcatDisplayCache;
}

/** Legacy header shows the subject name and category, not the raw tt id. */
async function getSubjectLabels(subjectIds) {
  const ids = subjectIds.map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) return [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, subject_name, subject_category FROM basic_subject_tt_tb
     WHERE del = 1 AND id IN (${ids.map((id) => `'${escapeSql(id)}'`).join(',')})`,
  );
  const catMap = await getSubcatDisplayMap();
  const byId = new Map();
  for (const r of rows) {
    const cat = catMap[String(r.subject_category)] || '';
    const name = String(r.subject_name || '').trim();
    byId.set(String(r.id), `${name}${cat ? ` | ${cat}` : ''}`.trim());
  }
  return ids.map((id) => byId.get(id) || id);
}

async function loadAttendanceBannerUrl() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const image = rows[0]?.banner_image;
  return image ? `/legacy/img/global_images/${encodeURIComponent(image)}` : '';
}

function formatCourseShortName(course, currentYear) {
  const yearLabel = convertNYear(Number(currentYear), course.course_name);
  let dept = String(course.department_name || '').trim();
  if (dept && dept !== '-') dept = ` - ${dept}`;
  else dept = '';
  return `${yearLabel} - ${course.degree_name}${dept}`;
}

function toDisplayDateIso(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m && y ? `${d}-${m}-${y}` : String(iso || '');
}

function buildAttendancePrintMeta({
  variant, reportType, academicYear, fromDate, toDate, courseCount, courseShort, subjectLabels,
}) {
  const title = variant === 'quarterly'
    ? 'STUDENT QUARTERLY ATTENDANCE'
    : `${reportType === 'Overall' ? 'Overall' : reportType} Attendance Report`;
  const subtitleLine1 = courseCount === 1 && courseShort
    ? `${courseShort} | ${subjectLabels.join(', ')} | ${academicYear}`
    : `Academic Year: ${academicYear}`;
  return {
    title,
    subtitleLine1,
    dateRange: `${toDisplayDateIso(fromDate)} to ${toDisplayDateIso(toDate)}`,
    singleCourse: courseCount === 1,
  };
}

function callAttendanceFlag(mFlag, eFlag) {
  let flag = `${mFlag}-${eFlag}`;
  const mMap = { p: '/', a: 'a', le: 'l', pe: '/', la: '/', H: 'h', h: 'h', '': '-' };
  const eMap = { p: '\\', a: 'a', le: 'l', pe: '\\', la: '\\', H: 'h', h: 'h', '': '-' };
  flag = (mMap[mFlag] ?? mFlag) + (eMap[eFlag] ?? eFlag);
  const norm = { '/\\': 'X', aa: 'a', ll: 'l', lala: 'la', pp: 'p', hh: 'h', '--': '-' };
  return norm[flag] || flag;
}

function filterTimetable(ttRows, attDate, attDay, subjectFilters) {
  return ttRows
    .filter((tt) => {
      const from = String(tt.from_date).slice(0, 10);
      const to = String(tt.to_date).slice(0, 10);
      if (from > attDate || to < attDate) return false;
      // t_day is stored capitalized (e.g. "Monday"); legacy matched it in SQL
      // (case-insensitive). Compare case-insensitively here too.
      if (String(tt.t_day).toLowerCase() !== attDay) return false;
      if (!tt.subject_id || !tt.period) return false;
      return subjectFilters.some((sf) => {
        if (String(tt.subject_id) !== String(sf.subjectId)) return false;
        if (sf.s_batch === 1) return matchBatchNo(tt.batch_no, sf.batchNo);
        return true;
      });
    })
    .sort((a, b) => Number(a.period) - Number(b.period));
}

function countPunchesInRange(punches, from, to, flags) {
  let count = 0;
  for (const p of punches) {
    const pd = new Date(p.p_date);
    if (pd < from || pd > to) continue;
    if (flags.length && !flags.includes(p.flag)) continue;
    count += 1;
  }
  return count;
}

function computeAttendanceForDay(sId, sStudent, attDate, refCourseName, refInput, subjectFilters, lookup) {
  const attDay = new Date(`${attDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const cal = lookup.calendar.get(attDate);
  const academicEvents = String(cal?.academic_events || '').toLowerCase().slice(0, 7);
  const classList = String(cal?.course_type || '').split(',,,');
  const classContain = !cal?.course_type || classList.includes(refCourseName);

  const status = { s: '-', p: 0, a: 0, t: 0, le: 0, i: '', st: '' };
  if ((academicEvents === 'working' && classContain) || (academicEvents === 'holiday' && !classContain)) {
    const fAttendance = lookup.leaves.get(`${sId}:${attDate}`) || {};
    const ttRows = filterTimetable(lookup.timetable, attDate, attDay, subjectFilters);

    let prdStr = '';
    let prdCount = 0;
    const mFlag = {};
    for (const tt of ttRows) {
      const period = tt.period;
      const subjectId = tt.subject_id;
      const machineId = refInput.sub[subjectId];
      const prd = refInput.prd[attDay]?.[period] || {};
      let fLeaveApp = '';
      if (fAttendance.fullday) fLeaveApp = String(fAttendance.fullday).toLowerCase();
      else if (refCourseName === 'P.G' && prdCount === 0) fLeaveApp = String(fAttendance.forenoon || '').toLowerCase();
      else if (refCourseName === 'P.G' && prdCount === 1) fLeaveApp = String(fAttendance.afternoon || '').toLowerCase();
      else if (fAttendance[prd.s]) fLeaveApp = String(fAttendance[prd.s]).toLowerCase();

      if (fLeaveApp) {
        if (refCourseName === 'P.G' && prdCount < 2) {
          if (fLeaveApp === 'le') { mFlag[prdCount] = 'le'; status.le += 0.5; }
          else { mFlag[prdCount] = 'p'; status.p += 0.5; }
          status.t += 0.5;
        } else if (fLeaveApp === 'le') { prdStr += 'l'; status.le += 1; status.t += 1; }
        else { prdStr += 'X'; status.p += 1; status.t += 1; }
      } else {
        // Legacy checks the manual att_present list first and unconditionally
        // (regardless of biometric machine). The machine/punch lookup is only a
        // fallback when the student is not in the manual list.
        const attCheck = lookup.studentAtt.get(`${attDate}:${period}`);
        const presentList = String(attCheck?.att_present || '').toLowerCase().split(',');
        if (presentList.includes(String(sStudent).toLowerCase())) {
          if (refCourseName === 'P.G' && prdCount < 2) { mFlag[prdCount] = 'p'; status.p += 0.5; status.t += 0.5; }
          else { prdStr += 'X'; status.p += 1; status.t += 1; }
        } else if (machineId && prd.f && prd.t) {
          const subCat = refInput.subcat[subjectId] || '';
          let inSql = 0;
          if (subCat === 'e-learning') {
            const examId = lookup.activityExams.get(`${attDate}:${period}:${subjectId}`);
            if (examId) inSql = lookup.activityAnswers.get(`${sStudent}:${examId}`) || 0;
          } else {
            const from = new Date(`${attDate}T${prd.f}`);
            from.setMinutes(from.getMinutes() - 10);
            const to = new Date(`${attDate}T${prd.t}`);
            const flags = refInput.machineFlags[subjectId] || [];
            const punches = lookup.punches.get(sStudent) || [];
            inSql = countPunchesInRange(punches, from, to, flags);
          }
          if (refCourseName === 'P.G' && prdCount < 2) {
            if (inSql > 0) { mFlag[prdCount] = 'p'; status.p += 0.5; }
            else { mFlag[prdCount] = 'a'; status.a += 0.5; }
            status.t += 0.5;
          } else if (inSql > 0) { prdStr += 'X'; status.p += 1; status.t += 1; }
          else { prdStr += 'a'; status.a += 1; status.t += 1; }
        }
      }
      prdCount += 1;
    }
    status.s = refCourseName === 'P.G' ? callAttendanceFlag(mFlag[0], mFlag[1]) : (prdStr || status.s);
  } else {
    status.s = 'h';
  }
  return status;
}

async function buildRefInput(rcourse, rsubject, batchRow) {
  const [, , refCurrentYear, refAcademicType, refCourseName] = rcourse.split('___');
  const refInput = { prd: {}, sub: {}, subcat: {}, room: {}, machineFlags: {} };
  const periodRows = await prisma.$queryRawUnsafe(
    `SELECT period_no, from_time, to_time, p_days, session FROM period_set_up
     WHERE course_name = '${escapeSql(refCourseName)}' AND academic_year = '${escapeSql(refCurrentYear)}'
       AND academic_type = '${escapeSql(refAcademicType)}'
       AND from_time != '00:00:00' AND to_time != '00:00:00' AND period_no != 'break' AND del != 0`,
  );
  for (const p of periodRows) {
    if (!refInput.prd[p.p_days]) refInput.prd[p.p_days] = {};
    refInput.prd[p.p_days][p.period_no] = { f: p.from_time, t: p.to_time, s: p.session };
  }

  const subIds = String(rsubject).split(',').map((s) => s.trim()).filter(Boolean);
  const subStr = subIds.length ? ` AND (${subIds.map((id) => `B.id='${escapeSql(id)}'`).join(' OR ')})` : '';
  const subRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.id, B.s_batch, B.room_no, B.subject_category
     FROM basic_setup_subject_tb AS A INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
     WHERE A.del = 1 AND A.academic_year = '${escapeSql(batchRow.academic_year)}'
       AND A.course_id = '${escapeSql(batchRow.course_id)}'
       AND A.semester_no = '${escapeSql(String(batchRow.current_year))}' AND B.del = 1 ${subStr}`,
  );
  const subcatMap = await getSubcatMap();
  const subjectFilters = [];
  for (const row of subRows) {
    if (!refInput.room[row.room_no]) refInput.room[row.room_no] = await getRoomNoCached(row.room_no);
    refInput.sub[row.id] = refInput.room[row.room_no];
    refInput.machineFlags[row.id] = parseMachineFlags(refInput.room[row.room_no]);
    refInput.subcat[row.id] = subcatMap[String(row.subject_category)] || '';
    subjectFilters.push({
      subjectId: row.id,
      s_batch: row.s_batch,
      batchNo: batchRow.batch_no,
    });
  }
  return { refInput, subjectFilters, refCourseName };
}

async function buildCourseLookup(rcourse, batchRow, fromDate, toDate, registerNos) {
  const [refCourseId, refAcademicYear, refCurrentYear, refAcademicType] = rcourse.split('___');
  const [ttRows, attRows, activityRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT subject_id, period, batch_no, t_day,
              CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
       FROM timetable_tb WHERE del = 1
         AND course_id = '${escapeSql(refCourseId)}'
         AND academic_year = '${escapeSql(refAcademicYear)}'
         AND current_year = '${escapeSql(refCurrentYear)}'
         AND academic_type = '${escapeSql(refAcademicType)}'
         AND from_date <= '${escapeSql(toDate)}' AND to_date >= '${escapeSql(fromDate)}'
         AND subject_id != '' AND period != ''`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT CAST(academic_date AS CHAR) AS academic_date, att_period, att_absent, att_present
       FROM student_att_tb WHERE del = 1
         AND academic_year = '${escapeSql(refAcademicYear)}'
         AND academic_type = '${escapeSql(refAcademicType)}'
         AND course_id = '${escapeSql(refCourseId)}'
         AND current_year = '${escapeSql(refCurrentYear)}'
         AND academic_date >= '${escapeSql(fromDate)}' AND academic_date <= '${escapeSql(toDate)}'`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, CAST(exam_date AS CHAR) AS exam_date, exam_period, subject_id
       FROM activity_task_tb WHERE exam_date >= '${escapeSql(fromDate)}' AND exam_date <= '${escapeSql(toDate)}'
         AND academic_year = '${escapeSql(refAcademicYear)}' AND course_type = '${escapeSql(refAcademicType)}'
         AND course_id = '${escapeSql(refCourseId)}' AND current_year = '${escapeSql(refCurrentYear)}'`,
    ),
  ]);

  const studentAtt = new Map();
  for (const row of attRows) {
    const ds = String(row.academic_date).slice(0, 10);
    studentAtt.set(`${ds}:${row.att_period}`, row);
  }

  const activityExams = new Map();
  const examIds = [];
  for (const row of activityRows) {
    const ds = String(row.exam_date).slice(0, 10);
    activityExams.set(`${ds}:${row.exam_period}:${row.subject_id}`, row.id);
    examIds.push(row.id);
  }

  const activityAnswers = new Map();
  if (examIds.length && registerNos.length) {
    const ansRows = await prisma.$queryRawUnsafe(
      `SELECT register_no, exam_id, COUNT(*) AS c FROM activity_answer_tb
       WHERE del = 1 AND register_no IN (${registerNos.map((r) => `'${escapeSql(r)}'`).join(',')})
         AND exam_id IN (${examIds.map((id) => `'${escapeSql(String(id))}'`).join(',')})
       GROUP BY register_no, exam_id`,
    );
    for (const row of ansRows) {
      activityAnswers.set(`${row.register_no}:${row.exam_id}`, Number(row.c || 0));
    }
  }

  const punchTables = new Set();
  for (let d = Math.floor(new Date(`${fromDate}T00:00:00`).getTime() / 1000);
    d <= Math.floor(new Date(`${toDate}T00:00:00`).getTime() / 1000);
    d += 86400) {
    punchTables.add(punchTableName(new Date(d * 1000).toISOString().slice(0, 10)));
  }

  const punches = new Map();
  if (registerNos.length) {
    const fromTs = `${fromDate} 00:00:00`;
    const toTs = `${toDate} 23:59:59`;
    const rollIn = registerNos.map((r) => `'${escapeSql(r)}'`).join(',');
    for (const tbl of punchTables) {
      const punchRows = await prisma.$queryRawUnsafe(
        `SELECT tktno, p_date, flag FROM ${tbl}
         WHERE p_date >= '${fromTs}' AND p_date <= '${toTs}' AND tktno IN (${rollIn})`,
      ).catch(() => []);
      for (const p of punchRows) {
        if (!punches.has(p.tktno)) punches.set(p.tktno, []);
        punches.get(p.tktno).push(p);
      }
    }
  }

  return { timetable: ttRows, studentAtt, activityExams, activityAnswers, punches };
}

async function prepareBatchContext(jobs, meta) {
  const fmonth = Number(meta.fmonth);
  const tmonth = Number(meta.tmonth);
  const dates = [];
  for (let d = fmonth; d <= tmonth; d += 86400) {
    dates.push(new Date(d * 1000).toISOString().slice(0, 10));
  }
  const fromDate = dates[0];
  const toDate = dates[dates.length - 1];
  const registerNos = [...new Set(jobs.map((j) => j.registerNo))];

  const [calRows, studentRows, batchRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT CAST(academic_date AS CHAR) AS academic_date, academic_events, comments, course_type
       FROM academic_calender_tb WHERE del = 1
         AND academic_date >= '${escapeSql(fromDate)}' AND academic_date <= '${escapeSql(toDate)}'`,
    ),
    registerNos.length ? prisma.$queryRawUnsafe(
      `SELECT id, register_no, student_title, student_name, student_initial
       FROM student_profile_tb WHERE del = 1
         AND register_no IN (${registerNos.map((r) => `'${escapeSql(r)}'`).join(',')})`,
    ) : [],
    registerNos.length ? prisma.$queryRawUnsafe(
      `SELECT course_id, academic_year, current_year, academic_type, batch_no, roll_no
       FROM basic_subject_batch_tb WHERE del = 1
         AND (${registerNos.map((r) => rollMatchSql(r)).join(' OR ')})`,
    ) : [],
  ]);

  const calendar = new Map();
  for (const r of calRows) calendar.set(String(r.academic_date).slice(0, 10), r);

  const studentByRoll = new Map(studentRows.map((s) => [s.register_no, s]));
  const batchRowByRoll = new Map();
  for (const br of batchRows) {
    for (const registerNo of registerNos) {
      if (matchInCommaList(br.roll_no, registerNo) || br.roll_no === registerNo) {
        batchRowByRoll.set(registerNo, br);
      }
    }
  }

  const studentIds = studentRows.map((s) => String(s.id));
  const leaves = new Map();
  if (studentIds.length) {
    const leaveRows = await prisma.$queryRawUnsafe(
      `SELECT student_id, CAST(req_date AS CHAR) AS req_date, r_session, m_att
       FROM stu_leave_request_more WHERE del = 1 AND status = 1
         AND req_date >= '${escapeSql(fromDate)}' AND req_date <= '${escapeSql(toDate)}'
         AND student_id IN (${studentIds.map((id) => `'${escapeSql(id)}'`).join(',')})
         AND r_session IN ('fullday','forenoon','afternoon')`,
    );
    for (const lr of leaveRows) {
      const key = `${lr.student_id}:${String(lr.req_date).slice(0, 10)}`;
      if (!leaves.has(key)) leaves.set(key, {});
      leaves.get(key)[lr.r_session] = lr.m_att;
    }
  }

  const courseCache = new Map();
  const jobCache = new Map();

  async function getJobCache(job) {
    const key = `${job.registerNo}___${job.rcourse}___${job.rsubject}`;
    if (jobCache.has(key)) return jobCache.get(key);

    const batchRow = batchRowByRoll.get(job.registerNo);
    if (!batchRow) {
      jobCache.set(key, null);
      return null;
    }

    const courseKey = `${job.rcourse}___${job.rsubject}___${batchRow.batch_no}`;
    let shared = courseCache.get(courseKey);
    if (!shared) {
      const rollsForCourse = jobs
        .filter((j) => j.rcourse === job.rcourse && j.rsubject === job.rsubject)
        .map((j) => j.registerNo);
      const { refInput, subjectFilters, refCourseName } = await buildRefInput(job.rcourse, job.rsubject, batchRow);
      const lookupPart = await buildCourseLookup(job.rcourse, batchRow, fromDate, toDate, rollsForCourse);
      shared = {
        refInput,
        subjectFilters,
        refCourseName,
        lookup: { calendar, leaves, ...lookupPart },
      };
      courseCache.set(courseKey, shared);
    }

    const result = { batchRow, ...shared };
    jobCache.set(key, result);
    return result;
  }

  return { dates, fmonth, tmonth, studentByRoll, getJobCache };
}

function getAttendanceFromContext(sId, registerNo, attDate, jobCache, clearCache) {
  const cacheKey = `${sId}:${attDate}:${jobCache.refCourseName}`;
  if (!clearCache && attendanceCache.has(cacheKey)) return attendanceCache.get(cacheKey);
  const att = computeAttendanceForDay(
    sId,
    registerNo,
    attDate,
    jobCache.refCourseName,
    jobCache.refInput,
    jobCache.subjectFilters,
    jobCache.lookup,
  );
  attendanceCache.set(cacheKey, att);
  return att;
}

function renderStudentRowHtml(job, ctx, meta, clearCache) {
  const registerNo = job.registerNo;
  const counter = Number(job.count) + 1;
  const fmonth = Number(meta.fmonth);
  const tmonth = Number(meta.tmonth);
  const rtype = meta.rtype || 'Monthly';

  const student = ctx.studentByRoll.get(registerNo);
  if (!student) return '';

  const jobCache = ctx.jobCacheByJob?.get(job) ?? null;
  if (!jobCache) return '';

  const title = student.student_title ? `${student.student_title}. ` : '';
  const staffName = `${title}${student.student_name || ''} ${student.student_initial || ''}`.trim();

  let body = `<tr><td>${counter}</td><td>${registerNo}</td><td nowrap>${staffName}</td>`;
  let totalDays = 0;
  let totalWorking = 0;
  let totalPresent = 0;
  let totalLeave = 0;
  let totalAbsent = 0;

  if (rtype === 'Overall') {
    const fromM = new Date(new Date(fmonth * 1000).toISOString().slice(0, 7));
    const toM = new Date(new Date(tmonth * 1000).toISOString().slice(0, 7));
    for (let m = fromM; m <= toM; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const monthFrom = m.getMonth() === new Date(fmonth * 1000).getMonth()
        ? new Date(fmonth * 1000) : new Date(m.getFullYear(), m.getMonth(), 1);
      const monthTo = m.getMonth() === new Date(tmonth * 1000).getMonth()
        ? new Date(tmonth * 1000) : new Date(m.getFullYear(), m.getMonth() + 1, 0);
      let mPresent = 0;
      let mWorking = 0;
      for (let d = new Date(monthFrom); d <= monthTo; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().slice(0, 10);
        const att = getAttendanceFromContext(student.id, registerNo, ds, jobCache, clearCache);
        totalDays += 1;
        totalAbsent += att.a || 0;
        mPresent += (att.p || 0) + (att.le || 0);
        mWorking += att.t || 0;
      }
      totalWorking += mWorking;
      totalPresent += mPresent;
      body += `<td align="right">${mPresent}<small>/${mWorking}</small></td>`;
    }
  } else {
    for (let d = fmonth; d <= tmonth; d += 86400) {
      const ds = new Date(d * 1000).toISOString().slice(0, 10);
      const att = getAttendanceFromContext(student.id, registerNo, ds, jobCache, clearCache);
      totalDays += 1;
      totalAbsent += att.a || 0;
      totalPresent += (att.p || 0) + (att.le || 0);
      totalLeave += att.le || 0;
      totalWorking += att.t || 0;
      const bg = String(att.s).toLowerCase() === 'h' ? ' bgcolor="#F8BBCA"' : '';
      body += `<td${bg} title="${att.st || ''}" align="center" class="attInfo">${att.s}${att.i ? `<small style="font-size:8px;"><br>${att.i}</small>` : ''}</td>`;
    }
  }

  const pct = totalWorking > 0 ? Math.round((totalPresent / totalWorking) * 100) : 0;
  body += `<td align="right">${totalDays}</td><td align="right">${totalWorking}</td>
    <td align="right">${totalPresent}</td><td align="right">${totalLeave}</td>
    <td align="right">${totalAbsent}</td><td align="right">${pct}</td></tr>`;
  return body;
}

export async function generateStudentAttendanceBatchNative(jobs, meta, clearCache = false) {
  if (!jobs?.length || !meta) return [];
  const ctx = await prepareBatchContext(jobs, meta);
  ctx.jobCacheByJob = new Map();
  for (const job of jobs) {
    ctx.jobCacheByJob.set(job, await ctx.getJobCache(job));
  }
  return jobs.map((job) => ({
    flag: job.flag || '0',
    html: renderStudentRowHtml(job, ctx, meta, clearCache),
  }));
}

function groupSubjectsByCourse(subjects) {
  const groups = new Map();
  for (const sub of subjects) {
    const parts = String(sub).split('___');
    if (parts.length < 5) continue;
    const courseKey = parts.slice(0, 4).join('___');
    const subjectId = parts[4];
    if (!groups.has(courseKey)) groups.set(courseKey, []);
    groups.get(courseKey).push(subjectId);
  }
  return groups;
}

export async function setupStudentAttendanceReportNative(payload) {
  const academicYear = payload.academicYear || '';
  const courses = payload.courses || [];
  const subjects = payload.subjects || [];
  const fromDate = parseDisplayDate(payload.fromDate);
  const toDate = parseDisplayDate(payload.toDate);
  const reportType = normalizeReportType(payload.reportType);
  if (!courses.length || !subjects.length || !fromDate || !toDate) {
    return { error: 'courses, subjects, and dates are required' };
  }

  const fromTs = Math.floor(new Date(`${fromDate}T00:00:00`).getTime() / 1000);
  const toTs = Math.floor(new Date(`${toDate}T00:00:00`).getTime() / 1000);
  const subjectGroups = groupSubjectsByCourse(subjects);
  const courseKeys = [...subjectGroups.keys()];
  const isSingleCourse = courseKeys.length === 1;
  let singleCourseShort = '';
  const allSubjectLabels = [];

  let headerHtml = '';
  const jobs = [];
  let tableFlag = 0;
  const fBatchStr = {};
  let bstr = 'A';
  for (let b = 1; b <= 26; b += 1) { fBatchStr[b] = bstr; bstr = String.fromCharCode(bstr.charCodeAt(0) + 1); }

  for (const [courseKey, subjectIds] of subjectGroups) {
    const [courseId, aYear, currentYear, academicType] = courseKey.split('___');
    const course = await prisma.basic_setup_course_tb.findFirst({
      where: { id: Number(courseId) },
      select: { degree_name: true, department_name: true, course_name: true },
    });
    if (!course) continue;

    const subStr = subjectIds.map((id) => `subject_id='${escapeSql(id)}'`).join(' OR ');
    const subjectFilter = ` AND (${subStr})`;
    const batchRows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT batch_no FROM timetable_tb WHERE del = 1
       AND course_id = '${escapeSql(courseId)}' AND academic_year = '${escapeSql(aYear)}'
       AND current_year = '${escapeSql(currentYear)}' AND academic_type = '${escapeSql(academicType)}'
       AND from_date >= '${escapeSql(fromDate)}' AND to_date <= '${escapeSql(toDate)}'
       ${subjectFilter}`,
    );
    let batchString = '';
    const batchListTmp = {};
    for (const br of batchRows) {
      for (const bno of String(br.batch_no || '').split(',')) {
        const b = bno.trim();
        if (!b) continue;
        batchString += ` batch_no="${escapeSql(b)}" OR`;
        batchListTmp[b] = fBatchStr[b];
      }
    }
    if (batchString) batchString = ` AND (${batchString.slice(0, -2)})`;

    const rollRow = await prisma.$queryRawUnsafe(
      `SELECT GROUP_CONCAT(roll_no SEPARATOR ',') AS rolls FROM basic_subject_batch_tb
       WHERE del = 1 AND course_id = '${escapeSql(courseId)}'
         AND academic_year = '${escapeSql(aYear)}' AND academic_type = '${escapeSql(academicType)}'
         AND current_year = '${escapeSql(currentYear)}' ${batchString}`,
    );
    const rollList = String(rollRow[0]?.rolls || '').split(',').map((r) => r.trim()).filter(Boolean);
    if (!rollList.length) continue;

    const courseLabel = `${course.degree_name}${course.department_name ? ` - ${course.department_name}` : ''}`;
    const subjectLabels = await getSubjectLabels(subjectIds);
    if (isSingleCourse) {
      if (!singleCourseShort) singleCourseShort = formatCourseShortName(course, currentYear);
      allSubjectLabels.push(...subjectLabels);
    }
    if (!isSingleCourse) {
      headerHtml += `<p style="margin:5px 0;"><strong>Course:</strong> ${courseLabel}</p>
        <p style="margin:5px 0;font-size:14px;"><strong>Subject:</strong> ${subjectLabels.join(', ')}</p>`;
    }

    headerHtml += `<table border="0" cellpadding="5" cellspacing="0" class="table table-bordered" id="payroll_${tableFlag}">
      <thead><tr><th height="100" width="30">S.No</th><th width="100" nowrap>Roll No</th><th width="200">Student Name</th>`;

    let periodLookup = new Map();
    if (reportType !== 'Overall') {
      const ttPeriodRows = await prisma.$queryRawUnsafe(
        `SELECT CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date,
                t_day, period
         FROM timetable_tb WHERE del = 1 AND course_id = '${escapeSql(courseId)}'
           AND academic_year = '${escapeSql(aYear)}' AND current_year = '${escapeSql(currentYear)}'
           AND academic_type = '${escapeSql(academicType)}'
           AND from_date <= '${escapeSql(toDate)}' AND to_date >= '${escapeSql(fromDate)}'
           AND subject_id != '' ${subjectFilter}`,
      );
      const dayPeriods = new Map();
      for (const row of ttPeriodRows) {
        const from = String(row.from_date).slice(0, 10);
        const to = String(row.to_date).slice(0, 10);
        for (let d = fromTs; d <= toTs; d += 86400) {
          const dt = new Date(d * 1000).toISOString().slice(0, 10);
          if (dt < from || dt > to) continue;
          const day = new Date(d * 1000).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          if (String(row.t_day).toLowerCase() !== day) continue;
          const lookupKey = `${courseId}_${currentYear}_${academicType}_${d}`;
          if (!dayPeriods.has(lookupKey)) dayPeriods.set(lookupKey, new Set());
          dayPeriods.get(lookupKey).add(row.period);
        }
      }
      periodLookup = dayPeriods;
    }

    if (reportType === 'Overall') {
      let m = new Date(`${fromDate.slice(0, 7)}-01T00:00:00`);
      const end = new Date(`${toDate.slice(0, 7)}-01T00:00:00`);
      while (m <= end) {
        headerHtml += `<th width="20" nowrap><div class="att_vtext">${m.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div></th>`;
        m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      }
    } else {
      for (let d = fromTs; d <= toTs; d += 86400) {
        const lookupKey = `${courseId}_${currentYear}_${academicType}_${d}`;
        const periodsSet = periodLookup.get(lookupKey);
        const periods = periodsSet && course.course_name !== 'P.G'
          ? ` (${[...periodsSet].sort((a, b) => Number(a) - Number(b)).join(',')})`
          : '';
        const label = new Date(d * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-');
        headerHtml += `<th width="20" nowrap class="dh_${lookupKey}"><div class="att_vtext">${label}${periods}</div></th>`;
      }
    }

    headerHtml += `<th width="40">T.D</th><th width="40">${course.course_name === 'P.G' ? 'W.D' : 'T.P'}</th>
      <th width="40">Pr</th><th width="40">Le</th><th width="40">Ab</th><th width="40">%</th></tr></thead><tbody></tbody></table>`;

    const seen = new Set();
    let counter = 0;
    for (const sid of rollList) {
      if (seen.has(sid)) continue;
      seen.add(sid);
      jobs.push({
        registerNo: sid,
        flag: String(tableFlag),
        count: String(counter),
        rcourse: `${courseId}___${aYear}___${currentYear}___${academicType}___${course.course_name}`,
        rsubject: subjectIds.join(','),
      });
      counter += 1;
    }
    tableFlag += 1;
  }

  if (!jobs.length) return { error: 'No students found for the selected filters' };
  const bannerUrl = await loadAttendanceBannerUrl();
  const printMeta = buildAttendancePrintMeta({
    variant: payload.variant || 'standard',
    reportType,
    academicYear: academicYear || courseKeys[0]?.split('___')[1] || '',
    fromDate,
    toDate,
    courseCount: courseKeys.length,
    courseShort: singleCourseShort,
    subjectLabels: allSubjectLabels,
  });
  return {
    headerHtml,
    jobs,
    meta: { fmonth: String(fromTs), tmonth: String(toTs), rtype: reportType },
    printMeta,
    bannerUrl,
  };
}

export async function generateStudentAttendanceChunkNative(payload) {
  const job = payload.job;
  const meta = payload.meta;
  if (!job || !meta) return [''];
  const [row] = await generateStudentAttendanceBatchNative([job], meta, Boolean(payload.clearCache));
  return [row?.html || ''];
}

export function clearAttendanceReportCache() {
  attendanceCache.clear();
  quarterlyCache.clear();
}

/* ---------------------------------------------------------------------------
 * Quarterly report (legacy: attendance_report_quartely_v1.php + _more.php)
 * Monthly Theory/Practical percentage grid with a cumulative (CUM) column.
 * Theory  = subject category "Lecture", Practical = subject category "Clinical".
 * ------------------------------------------------------------------------- */

async function getCategoryDisplayForSubjects(subjectIds) {
  const ids = subjectIds.map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) return new Set();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT subject_category FROM basic_subject_tt_tb
     WHERE del = 1 AND id IN (${ids.map((id) => `'${escapeSql(id)}'`).join(',')})`,
  );
  const catMap = await getSubcatDisplayMap();
  const set = new Set();
  for (const r of rows) {
    const display = catMap[String(r.subject_category)];
    if (display) set.add(display);
  }
  return set;
}

function quarterlyMonths(fromTs, toTs) {
  const start = new Date(fromTs * 1000);
  const end = new Date(toTs * 1000);
  const months = [];
  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({
      year,
      month,
      label: new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    });
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return months;
}

/** Category-aware version of computeAttendanceForDay (legacy getAttendance in _more). */
function computeQuarterlyAttendanceForDay(sId, sStudent, attDate, refCourseName, refInput, subjectFilters, lookup) {
  const attDay = new Date(`${attDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const cal = lookup.calendar.get(attDate);
  const academicEvents = String(cal?.academic_events || '').toLowerCase().slice(0, 7);
  const classList = String(cal?.course_type || '').split(',,,');
  const classContain = !cal?.course_type || classList.includes(refCourseName);

  const byCat = {};
  const bucket = (cat) => {
    if (!byCat[cat]) byCat[cat] = { p: 0, a: 0, le: 0, t: 0 };
    return byCat[cat];
  };

  if (!((academicEvents === 'working' && classContain) || (academicEvents === 'holiday' && !classContain))) {
    return byCat;
  }

  const fAttendance = lookup.leaves.get(`${sId}:${attDate}`) || {};
  const ttRows = filterTimetable(lookup.timetable, attDate, attDay, subjectFilters);

  let prdCount = 0;
  const mFlag = {};
  for (const tt of ttRows) {
    const period = tt.period;
    const subjectId = tt.subject_id;
    const subCat = refInput.subcat[subjectId] || '';
    const b = bucket(subCat);
    const machineId = refInput.sub[subjectId];
    const prd = refInput.prd[attDay]?.[period] || {};
    let fLeaveApp = '';
    if (fAttendance.fullday) fLeaveApp = String(fAttendance.fullday).toLowerCase();
    else if (refCourseName === 'P.G' && prdCount === 0) fLeaveApp = String(fAttendance.forenoon || '').toLowerCase();
    else if (refCourseName === 'P.G' && prdCount === 1) fLeaveApp = String(fAttendance.afternoon || '').toLowerCase();
    else if (fAttendance[prd.s]) fLeaveApp = String(fAttendance[prd.s]).toLowerCase();

    if (fLeaveApp) {
      if (refCourseName === 'P.G' && prdCount < 2) {
        if (fLeaveApp === 'le') { mFlag[prdCount] = 'le'; b.le += 0.5; }
        else { mFlag[prdCount] = 'p'; b.p += 0.5; }
        b.t += 0.5;
      } else if (fLeaveApp === 'le') { b.le += 1; b.t += 1; }
      else { b.p += 1; b.t += 1; }
    } else {
      const attCheck = lookup.studentAtt.get(`${attDate}:${period}`);
      const presentList = String(attCheck?.att_present || '').toLowerCase().split(',');
      if (presentList.includes(String(sStudent).toLowerCase())) {
        if (refCourseName === 'P.G' && prdCount < 2) { mFlag[prdCount] = 'p'; b.p += 0.5; b.t += 0.5; }
        else { b.p += 1; b.t += 1; }
      } else if (machineId && prd.f && prd.t) {
        let inSql = 0;
        if (subCat === 'e-learning') {
          const examId = lookup.activityExams.get(`${attDate}:${period}:${subjectId}`);
          if (examId) inSql = lookup.activityAnswers.get(`${sStudent}:${examId}`) || 0;
        } else {
          const from = new Date(`${attDate}T${prd.f}`);
          from.setMinutes(from.getMinutes() - 10);
          const to = new Date(`${attDate}T${prd.t}`);
          const flags = refInput.machineFlags[subjectId] || [];
          const punches = lookup.punches.get(sStudent) || [];
          inSql = countPunchesInRange(punches, from, to, flags);
        }
        if (refCourseName === 'P.G' && prdCount < 2) {
          if (inSql > 0) { mFlag[prdCount] = 'p'; b.p += 0.5; }
          else { mFlag[prdCount] = 'a'; b.a += 0.5; }
          b.t += 0.5;
        } else if (inSql > 0) { b.p += 1; b.t += 1; }
        else { b.a += 1; b.t += 1; }
      }
    }
    prdCount += 1;
  }
  return byCat;
}

function getQuarterlyAttendanceFromContext(sId, registerNo, attDate, jobCache, clearCache) {
  const cacheKey = `${sId}:${attDate}:${jobCache.refCourseName}:q`;
  if (!clearCache && quarterlyCache.has(cacheKey)) return quarterlyCache.get(cacheKey);
  const att = computeQuarterlyAttendanceForDay(
    sId, registerNo, attDate, jobCache.refCourseName, jobCache.refInput, jobCache.subjectFilters, jobCache.lookup,
  );
  quarterlyCache.set(cacheKey, att);
  return att;
}

function toDs(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderQuarterlyRowHtml(job, ctx, meta, clearCache) {
  const registerNo = job.registerNo;
  const counter = Number(job.count) + 1;
  const student = ctx.studentByRoll.get(registerNo);
  if (!student) return '';
  const jobCache = ctx.jobCacheByJob?.get(job) ?? null;
  if (!jobCache) return '';

  const theoryPract = meta.theoryPract || [];
  const hasLecture = theoryPract.includes('Lecture');
  const hasClinical = theoryPract.includes('Clinical');
  const months = quarterlyMonths(Number(meta.fmonth), Number(meta.tmonth));
  const fromDate = new Date(Number(meta.fmonth) * 1000);
  const toDate = new Date(Number(meta.tmonth) * 1000);

  const title = student.student_title ? `${student.student_title}. ` : '';
  const name = `${title}${student.student_name || ''} ${student.student_initial || ''}`.trim();
  const theoryBg = 'background-color:#D3ECF780;';
  const pracBg = 'background-color:#d3f7f3;';

  let theoryCells = '';
  let practicalCells = '';
  let totLecP = 0;
  let totLecT = 0;
  let totClinP = 0;
  let totClinT = 0;

  for (const mo of months) {
    const isFirst = mo.year === fromDate.getFullYear() && mo.month === fromDate.getMonth();
    const isLast = mo.year === toDate.getFullYear() && mo.month === toDate.getMonth();
    const start = isFirst ? new Date(fromDate) : new Date(mo.year, mo.month, 1);
    const end = isLast ? new Date(toDate) : new Date(mo.year, mo.month + 1, 0);
    let lecP = 0;
    let lecT = 0;
    let clinP = 0;
    let clinT = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const byCat = getQuarterlyAttendanceFromContext(student.id, registerNo, toDs(d), jobCache, clearCache);
      const lec = byCat.lecture;
      if (lec) { lecP += lec.p + lec.le; lecT += lec.t; }
      const clin = byCat.clinical;
      if (clin) { clinP += clin.p + clin.le; clinT += clin.t; }
    }
    totLecP += lecP; totLecT += lecT; totClinP += clinP; totClinT += clinT;
    if (hasLecture) {
      const pct = lecT > 0 ? Math.round((lecP / lecT) * 100) : 0;
      theoryCells += `<td class="theory" align="right" style="${theoryBg}">${pct}</td>`;
    }
    if (hasClinical) {
      const pct = clinT > 0 ? Math.round((clinP / clinT) * 100) : 0;
      practicalCells += `<td class="practical" align="right" style="${pracBg}">${pct}</td>`;
    }
  }

  let body = `<tr><td>${counter}</td><td>${registerNo}</td><td nowrap>${name}</td>`;
  if (hasLecture) {
    body += theoryCells;
    const cum = totLecT > 0 ? Math.round((totLecP / totLecT) * 100) : 0;
    body += `<td class="theory" align="right" style="${theoryBg}"><strong>${cum}</strong></td>`;
  }
  if (hasClinical) {
    body += practicalCells;
    const cum = totClinT > 0 ? Math.round((totClinP / totClinT) * 100) : 0;
    body += `<td class="practical" align="right" style="${pracBg}"><strong>${cum}</strong></td>`;
  }
  body += '</tr>';
  return body;
}

export async function generateStudentQuarterlyBatchNative(jobs, meta, clearCache = false) {
  if (!jobs?.length || !meta) return [];
  const ctx = await prepareBatchContext(jobs, meta);
  ctx.jobCacheByJob = new Map();
  for (const job of jobs) {
    ctx.jobCacheByJob.set(job, await ctx.getJobCache(job));
  }
  return jobs.map((job) => ({
    flag: job.flag || '0',
    html: renderQuarterlyRowHtml(job, ctx, meta, clearCache),
  }));
}

export async function setupStudentQuarterlyReportNative(payload) {
  const academicYear = payload.academicYear || '';
  const courses = payload.courses || [];
  const subjects = payload.subjects || [];
  const fromDate = parseDisplayDate(payload.fromDate);
  const toDate = parseDisplayDate(payload.toDate);
  void academicYear;
  if (!courses.length || !subjects.length || !fromDate || !toDate) {
    return { error: 'courses, subjects, and dates are required' };
  }

  const fromTs = Math.floor(new Date(`${fromDate}T00:00:00`).getTime() / 1000);
  const toTs = Math.floor(new Date(`${toDate}T00:00:00`).getTime() / 1000);
  const subjectGroups = groupSubjectsByCourse(subjects);
  const courseKeys = [...subjectGroups.keys()];
  const isSingleCourse = courseKeys.length === 1;
  let singleCourseShort = '';
  const allSubjectLabels = [];

  const allSubjectIds = [];
  for (const [, ids] of subjectGroups) allSubjectIds.push(...ids);
  const catSet = await getCategoryDisplayForSubjects(allSubjectIds);
  const hasLecture = catSet.has('Lecture');
  const hasClinical = catSet.has('Clinical');
  const theoryPract = [...catSet];

  const months = quarterlyMonths(fromTs, toTs);
  const theoryBg = 'background-color:#D3ECF780;';
  const pracBg = 'background-color:#d3f7f3;';
  const colSpan = months.length + 1;

  let headerHtml = '';
  const jobs = [];
  let tableFlag = 0;

  for (const [courseKey, subjectIds] of subjectGroups) {
    const [courseId, aYear, currentYear, academicType] = courseKey.split('___');
    const course = await prisma.basic_setup_course_tb.findFirst({
      where: { id: Number(courseId) },
      select: { degree_name: true, department_name: true, course_name: true },
    });
    if (!course) continue;

    // Legacy quarterly grabs every student for the course/year/type (no batch filter).
    const rollRow = await prisma.$queryRawUnsafe(
      `SELECT GROUP_CONCAT(roll_no SEPARATOR ',') AS rolls FROM basic_subject_batch_tb
       WHERE del = 1 AND course_id = '${escapeSql(courseId)}'
         AND academic_year = '${escapeSql(aYear)}' AND academic_type = '${escapeSql(academicType)}'
         AND current_year = '${escapeSql(currentYear)}'`,
    );
    const rollList = String(rollRow[0]?.rolls || '').split(',').map((r) => r.trim()).filter(Boolean);
    if (!rollList.length) continue;

    const departmentName = String(course.department_name || '').trim();
    const courseLabel = `${course.degree_name}${departmentName && departmentName !== '-' ? ` - ${departmentName}` : ''}`;
    const subjectLabels = await getSubjectLabels(subjectIds);
    if (isSingleCourse) {
      if (!singleCourseShort) singleCourseShort = formatCourseShortName(course, currentYear);
      allSubjectLabels.push(...subjectLabels);
    }
    if (!isSingleCourse) {
      headerHtml += `<p style="margin:5px 0;"><strong>Course:</strong> ${courseLabel}</p>
        <p style="margin:5px 0;font-size:14px;"><strong>Subject:</strong> ${subjectLabels.join(', ')}</p>`;
    }

    let row1 = '<th height="100" width="30" rowspan="3">S.No</th><th width="100" nowrap rowspan="3">Roll No</th><th width="200" rowspan="3">Student Name</th>';
    if (hasLecture) row1 += `<th colspan="${colSpan}" style="text-align:center;${theoryBg}">Theory</th>`;
    if (hasClinical) row1 += `<th colspan="${colSpan}" style="text-align:center;${pracBg}">Practical</th>`;

    let row2 = '';
    if (hasLecture) {
      row2 += months.map((m) => `<th width="20" nowrap style="${theoryBg}"><div>${m.label}</div></th>`).join('');
      row2 += `<th width="20" style="${theoryBg}">CUM</th>`;
    }
    if (hasClinical) {
      row2 += months.map((m) => `<th width="20" nowrap style="${pracBg}"><div>${m.label}</div></th>`).join('');
      row2 += `<th width="20" style="${pracBg}">CUM</th>`;
    }

    let row3 = '';
    if (hasLecture) {
      row3 += months.map(() => `<th style="${theoryBg}">Max.: 100%</th>`).join('');
      row3 += `<th style="${theoryBg}text-align:right;">%</th>`;
    }
    if (hasClinical) {
      row3 += months.map(() => `<th style="${pracBg}">Max.: 100%</th>`).join('');
      row3 += `<th style="${pracBg}text-align:right;">%</th>`;
    }

    headerHtml += `<table border="0" cellpadding="5" cellspacing="0" class="table table-bordered" id="payroll_${tableFlag}" width="100%">
      <thead><tr>${row1}</tr><tr>${row2}</tr><tr>${row3}</tr></thead><tbody></tbody></table>`;

    const seen = new Set();
    let counter = 0;
    for (const sid of rollList) {
      if (seen.has(sid)) continue;
      seen.add(sid);
      jobs.push({
        registerNo: sid,
        flag: String(tableFlag),
        count: String(counter),
        rcourse: `${courseId}___${aYear}___${currentYear}___${academicType}___${course.course_name}`,
        rsubject: subjectIds.join(','),
      });
      counter += 1;
    }
    tableFlag += 1;
  }

  if (!jobs.length) return { error: 'No students found for the selected filters' };
  const bannerUrl = await loadAttendanceBannerUrl();
  const printMeta = buildAttendancePrintMeta({
    variant: 'quarterly',
    reportType: 'Quarterly',
    academicYear: academicYear || courseKeys[0]?.split('___')[1] || '',
    fromDate,
    toDate,
    courseCount: courseKeys.length,
    courseShort: singleCourseShort,
    subjectLabels: allSubjectLabels,
  });
  return {
    headerHtml,
    jobs,
    meta: { fmonth: String(fromTs), tmonth: String(toTs), rtype: 'Quarterly', theoryPract },
    printMeta,
    bannerUrl,
  };
}

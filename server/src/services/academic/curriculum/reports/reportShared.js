import { prisma } from '../../../../config/prisma.js';
import { basicSetupCourseSelect } from '../../../../utils/legacySelects.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { convertNYear } from '../../../fees/feeHelpers.js';
import { parseInputDate } from '../../../shared/ciaSetupHelpers.js';
import {
  buildCourseIdYearOptions,
  escapeHtml,
  getCourseById,
  getTimeTable,
  loadBatchCount,
  loadDepartmentMap,
  parseCourseIdYearKey,
} from '../../academicSetupShared.js';
import { loadAcademicConfig } from '../../../shared/ciaSetupHelpers.js';
import {
  getAttendance,
  getLPTime,
  modifiedAttendance,
} from '../../../attendance/staffAttendanceCore.js';

export {
  escapeHtml,
  getTimeTable,
  loadBatchCount,
  loadDepartmentMap,
  buildCourseIdYearOptions,
  parseCourseIdYearKey,
  getCourseById,
  parseInputDate,
  convertNYear,
};

export function defaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  from.setDate(from.getDate() + 1);
  const fmt = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  };
  return { fromDate: fmt(from), toDate: fmt(to) };
}

export function parseCourseCyearKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length !== 3) return null;
  return {
    courseId: Number(parts[0]),
    academicYear: parts[1],
    currentYear: Number(parts[2]),
  };
}

export function courseCyearKey(courseId, academicYear, currentYear) {
  return `${courseId}___${academicYear}___${currentYear}`;
}

function incrementAcademicYear(ay) {
  const parts = String(ay).split('-').map((p) => Number(p.trim()));
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return `${parts[0] + 1}-${parts[1] + 1}`;
}

export async function buildCourseCyearOptions({ shortLabel = false } = {}) {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });

  const ttYearRows = await prisma.$queryRawUnsafe(
    "SELECT course_id, academic_year FROM timetable_tb WHERE del = 1 AND academic_year != '' GROUP BY course_id, academic_year",
  );
  const yearsByCourse = new Map();
  for (const row of ttYearRows) {
    const key = String(row.course_id);
    if (!yearsByCourse.has(key)) yearsByCourse.set(key, new Set());
    yearsByCourse.get(key).add(String(row.academic_year));
  }

  const options = [];
  for (const course of courses) {
    let duration = Number(course.course_duration) || Number(course.total_semester) || 0;
    if (course.course_name === 'U.G') duration -= 1;
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    const configYear = academicYearArray[course.course_name]?.regular
      || academicYearArray[course.course_name]
      || '';
    const degreeLabel = `${course.degree_name}${dept}`;

    const courseYears = yearsByCourse.get(String(course.id)) || new Set();
    const academicYears = [];
    if (configYear) academicYears.push(configYear);
    let cursor = configYear;
    while (cursor) {
      const nextYear = incrementAcademicYear(cursor);
      if (nextYear && courseYears.has(nextYear) && !academicYears.includes(nextYear)) {
        academicYears.push(nextYear);
        cursor = nextYear;
      } else {
        break;
      }
    }

    for (const acYear of academicYears) {
      const group = `${course.degree_name}${dept} | ${acYear}`;
      for (let i = 1; i <= duration; i += 1) {
        const yearLabel = `${convertNYear(i, course.course_name)} Year`;
        options.push({
          value: courseCyearKey(course.id, acYear, i),
          label: shortLabel ? yearLabel : `${yearLabel}  ${degreeLabel}`,
          group,
          courseId: course.id,
          courseName: course.course_name,
          academicYear: acYear,
          currentYear: i,
        });
      }
    }
  }
  return options;
}

export async function loadTimetableCategoryMap() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, category_name FROM subject_master WHERE del = 1 AND category = 'Timetable' ORDER BY category_order ASC",
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.category_name]));
}

const feedbackOptionsCache = new Map();
const FEEDBACK_OPTIONS_TTL_MS = 60_000;

export async function loadFeedbackOptions(variant = 'all') {
  const key = String(variant);
  const cached = feedbackOptionsCache.get(key);
  if (cached && Date.now() - cached.at < FEEDBACK_OPTIONS_TTL_MS) {
    return cached.data;
  }
  let filter = '';
  if (variant === true || variant === 'ug') filter = ` AND course_id LIKE '1___20%'`;
  else if (variant === false || variant === 'pg') filter = ` AND course_id NOT LIKE '1___20%'`;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, title, CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
     FROM feedback_master WHERE del = 1${filter} ORDER BY from_date ASC`,
  );
  const data = rows.map((r) => ({
    value: String(r.id),
    label: r.title,
    id: r.id,
    title: r.title,
    fromDate: r.from_date,
    toDate: r.to_date,
  }));
  feedbackOptionsCache.set(key, { at: Date.now(), data });
  return data;
}

export function formatDateTime(val) {
  if (!val || String(val).startsWith('0000')) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()} ${hh}:${mi}`;
}

export function minutesToHours(mins) {
  const n = Number(mins) || 0;
  if (!n) return '';
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

export function buildBatchLetters(count) {
  const map = {};
  let letter = 'A';
  for (let i = 1; i <= count; i += 1) {
    map[i] = letter;
    letter = String.fromCharCode(letter.charCodeAt(0) + 1);
  }
  return map;
}

export function wrapReportPanel(inner) {
  return `<div id="form_details_panel">${inner}</div>`;
}

export async function loadRoomBlockMap() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.room_name, B.block_name FROM rooms_tb AS A
     INNER JOIN blocks_tb AS B ON A.block_id = B.id WHERE A.del = 1 AND B.del = 1`,
  );
  const map = {};
  for (const r of rows) {
    map[String(r.id)] = `<strong>${escapeHtml(r.room_name)}</strong> | ${escapeHtml(r.block_name)}`;
  }
  return map;
}

export async function loadStaffNameMap(ids = null) {
  let sql = `SELECT id, staff_id, staff_title, staff_name, staff_initial FROM staff_profile_tb WHERE del = 1`;
  if (ids?.length) {
    const idList = ids.map((id) => `'${escapeSql(String(id))}'`).join(',');
    sql += ` AND id IN (${idList})`;
  }
  const rows = await prisma.$queryRawUnsafe(sql);
  const map = {};
  for (const s of rows) {
    map[s.id] = `${s.staff_title ? `${s.staff_title}. ` : ''}${s.staff_initial || ''} ${s.staff_name || ''}`.trim();
    map[String(s.id)] = map[s.id];
  }
  return map;
}

export async function loadSessionPeriodMap(courseName = null) {
  let sql = `SELECT course_name, academic_year, academic_type, p_days, period_no, session, from_time, to_time
    FROM period_set_up WHERE del != 0 AND period_no != 'Break' AND p_combined = '0'
    AND from_time != '00:00:00' AND to_time != '00:00:00'`;
  if (courseName) sql += ` AND course_name = '${escapeSql(courseName)}'`;
  sql += ' ORDER BY course_name, academic_year, p_days ASC, period_no+0 ASC';
  const rows = await prisma.$queryRawUnsafe(sql);
  const ref = {};
  for (const row of rows) {
    const cname = row.course_name;
    const ayear = row.academic_year;
    const atype = String(row.academic_type || '').toLowerCase();
    const day = row.p_days;
    const pno = row.period_no;
    if (!ref[cname]) ref[cname] = {};
    if (!ref[cname][ayear]) ref[cname][ayear] = {};
    if (!ref[cname][ayear][atype]) {
      ref[cname][ayear][atype] = { session: {}, from_time: {}, to_time: {} };
    }
    ref[cname][ayear][atype].session[day] = ref[cname][ayear][atype].session[day] || {};
    ref[cname][ayear][atype].session[day][pno] = row.session;
    ref[cname][ayear][atype].from_time[day] = ref[cname][ayear][atype].from_time[day] || {};
    ref[cname][ayear][atype].from_time[day][pno] = row.from_time;
    ref[cname][ayear][atype].to_time[day] = ref[cname][ayear][atype].to_time[day] || {};
    ref[cname][ayear][atype].to_time[day][pno] = row.to_time;
  }
  return ref;
}

function dateOverlapSql(fromDate, toDate) {
  const f = escapeSql(fromDate);
  const t = escapeSql(toDate);
  const zeroEnd = "CAST(A.to_date AS CHAR) LIKE '0000-00-00%'";
  const validFrom = "CAST(A.from_date AS CHAR) NOT LIKE '0000-00-00%'";
  return `(
    (A.from_date >= '${f}' AND (${zeroEnd} OR A.to_date <= '${t}')) OR
    (A.from_date <= '${f}' AND (${zeroEnd} OR A.to_date >= '${t}')) OR
    (A.from_date <= '${f}' AND A.to_date >= '${f}' AND (${zeroEnd} OR A.to_date <= '${t}')) OR
    (A.from_date >= '${f}' AND A.from_date <= '${t}' AND A.to_date >= '${t}')
  ) AND ${validFrom}`;
}

function staffMatchSql(stId) {
  const s = escapeSql(String(stId));
  return `(A.staff_id = '${s}' OR A.staff_id LIKE '${s},%' OR A.staff_id LIKE '%,${s}' OR A.staff_id LIKE '%,${s},%')`;
}

function deptMatchSql(deptId) {
  const d = escapeSql(String(deptId));
  return `(B.department = '${d}' OR B.department LIKE '%,${d}' OR B.department LIKE '${d},%' OR B.department LIKE '%,${d},%')`;
}

function formatAlternateStaffHtml(altStaffMap) {
  return [...altStaffMap.values()]
    .map((entry) => `${entry.period} Period : ${entry.name}`)
    .join('<br>');
}

async function evaluatePeriodRow(stId, attDate, periodNo, periodSession, attendanceStatus) {
  let attended = 0;
  let missed = 0;
  let od = 0;
  let al = 0;
  let ul = 0;
  let alternate = false;

  if (periodSession === 'forenoon') {
    if (
      attendanceStatus.m === 'le'
      || (attendanceStatus.m === 'p' && attendanceStatus.attopt?.m === 'od')
      || attendanceStatus.m === 'a'
    ) {
      if (attendanceStatus.m === 'p' && attendanceStatus.attopt?.m === 'od') od += 1;
      else if (attendanceStatus.msrc === 'lr') al += 1;
      else ul += 1;
      missed += 1;
      alternate = true;
    } else if (attendanceStatus.m !== 'a' && attendanceStatus.m !== 'h') attended += 1;
  } else if (periodSession === 'afternoon') {
    if (
      attendanceStatus.e === 'le'
      || (attendanceStatus.e === 'p' && attendanceStatus.attopt?.e === 'od')
      || attendanceStatus.e === 'a'
    ) {
      if (attendanceStatus.e === 'p' && attendanceStatus.attopt?.e === 'od') od += 1;
      else if (attendanceStatus.esrc === 'lr') al += 1;
      else ul += 1;
      missed += 1;
      alternate = true;
    } else if (attendanceStatus.e !== 'a' && attendanceStatus.e !== 'h') attended += 1;
  } else {
    missed += 1;
    ul += 1;
    alternate = true;
  }

  const altTasks = [];
  if (alternate) {
    const tasks = await prisma.$queryRawUnsafe(
      `SELECT A.staff_id, A.staff_initial, A.staff_name FROM staff_profile_tb AS A
       INNER JOIN att_leave_task AS B ON A.id = B.allocated_to
       WHERE A.del = 1 AND B.del = 1 AND B.staff_id = '${escapeSql(String(stId))}'
         AND B.req_date = '${escapeSql(attDate)}' AND B.period = '${escapeSql(String(periodNo))}'`,
    );
    for (const task of tasks) {
      altTasks.push({
        staffId: task.staff_id,
        name: `${task.staff_id} | ${task.staff_initial} ${task.staff_name}`,
      });
    }
  }

  return { attended, missed, od, al, ul, alternate, altTasks };
}

export { dateOverlapSql, staffMatchSql, deptMatchSql };

export async function buildPeriodCompletionReport({
  fromDate,
  toDate,
  whereExtra = '',
  groupByStaff = false,
  dedupeSubjects = false,
  departmentId = null,
}) {
  const fromIso = parseInputDate(fromDate);
  const toIso = parseInputDate(toDate);
  if (!fromIso || !toIso) return { rows: [], totals: { total: 0, attend: 0, unattend: 0 } };

  const categoryMap = await loadTimetableCategoryMap();
  const sessionRef = await loadSessionPeriodMap();
  const courseCache = {};
  const attendanceStore = {};
  const completedSubjects = new Set();
  const lpCache = new Map();
  const rows = [];
  const totals = { total: 0, attend: 0, unattend: 0 };

  const ttRows = await prisma.$queryRawUnsafe(
    `SELECT A.course_id, A.academic_year, A.current_year, A.academic_type,
            A.subject_id, A.staff_id, B.subject_id AS sub_code, B.subject_name, B.subject_category,
            GROUP_CONCAT(A.t_day SEPARATOR ',') AS t_days
     FROM timetable_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.subject_id = B.id
     WHERE A.del = 1 AND B.del = 1
       AND ${dateOverlapSql(fromIso, toIso)} ${whereExtra}
     GROUP BY A.subject_id, A.staff_id
     ORDER BY B.subject_id ASC`,
  );

  for (const tt of ttRows) {
    const subjectKey = String(tt.subject_id);
    if (dedupeSubjects && completedSubjects.has(subjectKey)) continue;
    if (dedupeSubjects) completedSubjects.add(subjectKey);

    const courseId = tt.course_id;
    if (!courseCache[courseId]) {
      const course = await getCourseById(courseId);
      let dept = String(course?.department_name || '').trim();
      if (dept && dept !== '-') dept = ` - ${dept}`;
      else dept = '';
      courseCache[courseId] = {
        courseName: course?.course_name || '',
        degreeLabel: `${course?.degree_name || ''}${dept}`,
      };
    }
    const cinfo = courseCache[courseId];
    const cname = cinfo.courseName;
    const cyearLabel = convertNYear(tt.current_year, cname);
    const courseLabel = `${cyearLabel}  ${cinfo.degreeLabel}`;
    const academicType = String(tt.academic_type || 'regular').toLowerCase();
    const sessionDetails = sessionRef[cname]?.[String(tt.current_year)]?.[academicType] || { session: {} };
    const tDayList = String(tt.t_days || '')
      .split(',')
      .map((day) => day.trim().toLowerCase())
      .filter(Boolean);
    const staffIds = String(tt.staff_id || '').split(',').map((s) => s.trim()).filter(Boolean);

    for (const stId of staffIds) {
      const staffRows = await prisma.$queryRawUnsafe(
        `SELECT id, staff_id, staff_title, staff_name, staff_initial, att_category
         FROM staff_profile_tb WHERE del = 1 AND id = '${escapeSql(stId)}'
           AND (CAST(releaving_date AS CHAR) LIKE '0000-00-00%' OR releaving_date >= '${escapeSql(fromIso)}')
         LIMIT 1`,
      );
      const staff = staffRows[0];
      if (!staff) continue;

      let allocated = 0;
      let attended = 0;
      let missed = 0;
      let od = 0;
      let al = 0;
      let ul = 0;
      const altStaffMap = new Map();

      const catKey = String(staff.att_category || '1');
      if (!lpCache.has(catKey)) lpCache.set(catKey, await getLPTime(staff.att_category));
      const lp = lpCache.get(catKey);

      for (let m = new Date(fromIso).getTime(); m <= new Date(toIso).getTime(); m += 86400000) {
        const curDate = new Date(m).toISOString().slice(0, 10);
        const tDay = new Date(m).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        if (!tDayList.includes(tDay)) continue;

        const storeKey = groupByStaff ? `${stId}_${curDate}` : `${stId}_${curDate}`;
        if (!attendanceStore[storeKey]) {
          let att1 = await getAttendance(staff.id, staff.staff_id, curDate, lp);
          if (String(att1.s).toLowerCase() === 'h') {
            att1 = { ...att1, m: 'h', e: 'h' };
          }
          attendanceStore[storeKey] = await modifiedAttendance(staff.id, staff.staff_id, curDate, lp, att1, 0);
        }
        const attStatus = attendanceStore[storeKey];
        if (attStatus.m === 'h' && attStatus.e === 'h') continue;

        const periods = await prisma.$queryRawUnsafe(
          `SELECT period FROM timetable_tb AS A WHERE A.del = 1 AND LOWER(A.t_day) = '${escapeSql(tDay)}'
           AND A.course_id = '${escapeSql(String(courseId))}' AND A.academic_year = '${escapeSql(tt.academic_year)}'
           AND A.current_year = '${escapeSql(String(tt.current_year))}' AND A.academic_type = '${escapeSql(tt.academic_type)}'
           AND A.subject_id = '${escapeSql(String(tt.subject_id))}' AND ${staffMatchSql(stId)}
           AND CAST(A.from_date AS CHAR) NOT LIKE '0000-00-00%' AND A.from_date <= '${escapeSql(curDate)}'
           AND (CAST(A.to_date AS CHAR) LIKE '0000-00-00%' OR A.to_date >= '${escapeSql(curDate)}')
           ORDER BY A.period ASC`,
        );

        for (const pr of periods) {
          allocated += 1;
          const periodDay = tDay;
          const periodSession = sessionDetails.session[periodDay]?.[pr.period]
            || sessionDetails.session[periodDay.charAt(0).toUpperCase() + periodDay.slice(1)]?.[pr.period];
          const evalResult = await evaluatePeriodRow(staff.id, curDate, pr.period, periodSession, attStatus);
          attended += evalResult.attended;
          missed += evalResult.missed;
          od += evalResult.od;
          al += evalResult.al;
          ul += evalResult.ul;
          for (const altTask of evalResult.altTasks) {
            const existing = altStaffMap.get(altTask.staffId) || { period: 0, name: altTask.name };
            existing.period += 1;
            altStaffMap.set(altTask.staffId, existing);
          }
        }
      }

      if (allocated <= 0) continue;

      rows.push({
        staffId: staff.staff_id,
        staffName: `${staff.staff_initial || ''} ${staff.staff_name || ''}`.trim(),
        courseLabel,
        subjectName: tt.subject_name,
        subjectType: categoryMap[String(tt.subject_category)] || '',
        allocated,
        attended,
        missed,
        od,
        al,
        ul,
        alternate: formatAlternateStaffHtml(altStaffMap),
      });
      totals.total += allocated;
      totals.attend += attended;
      totals.unattend += missed;
    }
  }

  if (departmentId) {
    return { rows, totals, departmentId };
  }
  return { rows, totals };
}

export function buildPeriodTableHtml(title, rows, totals, columns) {
  let body = `<h4>${escapeHtml(title)}</h4>
<table class="table table-bordered table-sm"><thead class="table-secondary"><tr>`;
  for (const col of columns) body += `<th>${escapeHtml(col.label)}</th>`;
  body += '</tr></thead><tbody>';
  rows.forEach((row, idx) => {
    body += '<tr>';
    for (const col of columns) {
      const val = col.render ? col.render(row, idx) : row[col.key];
      body += `<td${col.align ? ` class="text-${col.align}"` : ''}>${val ?? ''}</td>`;
    }
    body += '</tr>';
  });
  if (!rows.length) {
    body += `<tr><td colspan="${columns.length}" class="text-center text-muted py-3">No records found for the selected filters.</td></tr>`;
  }
  if (rows.length) {
    body += `<tfoot><tr><th colspan="${columns.length - 3}" class="text-end">Total</th>
<th class="text-end">${totals.total}</th><th class="text-end">${totals.attend}</th><th class="text-end">${totals.unattend}</th>
<th colspan="${Math.max(0, columns.length - 6)}"></th></tr></tfoot>`;
  }
  body += '</tbody></table>';
  return body;
}

function formatTimetableDate(value) {
  const raw = String(value || '').slice(0, 10);
  if (!raw || raw.startsWith('0000')) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatLegacyAsOnDate(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function loadTimetableBannerUrl() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const image = rows[0]?.banner_image;
  return image ? `/legacy/img/global_images/${encodeURIComponent(image)}` : '';
}

function buildTimetablePrintHeaderHtml(reportTitle, subtitleHtml, bannerUrl) {
  const logo = bannerUrl ? `<img src="${escapeHtml(bannerUrl)}" alt="" />` : '';
  return `<div id="printingHeader" style="display:none;">
<div id="printHeaderpanel" class="first-page">
<table class="header_table" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody>
<tr><td align="center" height="5" colspan="2"><small>omsakthi</small></td></tr>
<tr>
<td height="70" valign="middle" width="30%">${logo}</td>
<td nowrap align="right" valign="top" width="70%"><div class="promote_card">
<p class="pc_title title">${escapeHtml(reportTitle)}</p>
<p class="pc_sub-title sub-title">${subtitleHtml}</p>
</div></td>
</tr>
</tbody></table>
</div>
</div>`;
}

function buildTimetableStaffFooter(subjectMap, staffMap) {
  let rows = '';
  let stCount = 0;
  let borderLeft = '';
  let hasRows = false;
  for (const sub of Object.values(subjectMap)) {
    const staffNames = [...(sub.staffIds || [])]
      .map((id) => staffMap[id] || staffMap[Number(id)])
      .filter(Boolean);
    const uniqueNames = [...new Set(staffNames)];
    if (!uniqueNames.length) continue;
    hasRows = true;
    rows += `<td class="subject_name${borderLeft}" valign="top" width="20%">${escapeHtml(sub.name)}</td>`;
    rows += `<td width="30%" class="staff_name" valign="top"> - ${escapeHtml(uniqueNames.join(', '))}</td>`;
    stCount += 1;
    if (stCount % 2 === 0) {
      rows += '</tr><tr>';
      borderLeft = '';
    } else {
      borderLeft = ' border_left';
    }
  }
  if (!hasRows) return '';
  return `<table cellspacing="0" cellpadding="0" border="0"><tr>${rows}</tr></table>`;
}

function buildTimetableHodSignFooter(subjectMap, deptMap) {
  const deptIds = new Set();
  for (const sub of Object.values(subjectMap)) {
    for (const deptId of sub.departmentIds || []) {
      deptIds.add(deptId);
    }
  }
  const deptNames = [...deptIds].map((id) => deptMap[id]).filter(Boolean);
  if (!deptNames.length) return '';

  let signRow = '';
  let nameRow = '';
  let hsignDetails = '';
  let dcount = 0;
  for (const deptName of deptNames) {
    signRow += '<td valign="bottom" height="80"> </td>';
    nameRow += `<td valign="top"><p class="hod_sign">HOD's Sign<br><small>${escapeHtml(deptName)}</small></p></td>`;
    dcount += 1;
    if (dcount % 6 === 0) {
      hsignDetails += `<tr>${signRow}</tr><tr>${nameRow}</tr>`;
      signRow = '';
      nameRow = '';
    }
  }
  if (signRow) {
    hsignDetails += `<tr>${signRow}</tr><tr>${nameRow}</tr>`;
  }
  return `<table width="100%">${hsignDetails}</table>`;
}

function buildTimetablePrincipalSignFooter() {
  return `<table width="100%">
<tr><td valign="bottom" height="80" colspan="3"> </td></tr>
<tr>
<td width="33%"> </td>
<td valign="top" width="33%"><p class="hod_sign">Principal's Sign<br> </p></td>
<td width="33%"> </td>
</tr></table>`;
}

async function loadTimetableCellContent({
  courseId,
  academicYear,
  semester,
  academicType,
  day,
  periodNo,
  showDateBatch,
  tableName,
  subjectMap,
  batchLetters,
  staffState,
}) {
  if (!periodNo || String(periodNo).toLowerCase() === 'break') {
    return "<p class='ver_text'>Break</p>";
  }

  const sql = showDateBatch
    ? `SELECT subject_id, staff_id, batch_no,
              CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
       FROM ${tableName}
       WHERE del=1 AND course_id='${escapeSql(String(courseId))}' AND academic_year='${escapeSql(academicYear)}'
         AND current_year='${escapeSql(String(semester))}' AND academic_type='${escapeSql(academicType)}'
         AND t_day='${escapeSql(day)}' AND period='${escapeSql(String(periodNo))}' ORDER BY id ASC`
    : `SELECT DISTINCT subject_id, staff_id FROM ${tableName}
       WHERE del=1 AND course_id='${escapeSql(String(courseId))}' AND academic_year='${escapeSql(academicYear)}'
         AND current_year='${escapeSql(String(semester))}' AND academic_type='${escapeSql(academicType)}'
         AND t_day='${escapeSql(day)}' AND period='${escapeSql(String(periodNo))}' ORDER BY id ASC`;
  const slots = await prisma.$queryRawUnsafe(sql);

  const grouped = {};
  for (const slot of slots) {
    const key = String(slot.subject_id);
    if (!grouped[key]) grouped[key] = { extras: [] };
    if (subjectMap[key] && slot.staff_id) {
      subjectMap[key].staffIds.add(String(slot.staff_id));
      staffState.hasStaff = true;
    }
    if (showDateBatch) {
      const fd = formatTimetableDate(slot.from_date);
      const td = formatTimetableDate(slot.to_date);
      let batchStr = '';
      const sub = subjectMap[key];
      if (sub?.batch > 1 && slot.batch_no) {
        batchStr = String(slot.batch_no).split(',').map((b) => batchLetters[b.trim()]).filter(Boolean).join(', ');
        if (batchStr) batchStr = ` (Batch ${batchStr})`;
      }
      let dateStr = '';
      if (fd || td) {
        dateStr = `<small>${fd}${fd && td ? '/' : ''}${td}</small>`;
      }
      if (batchStr) {
        grouped[key].extras.push(`<br><span>${batchStr}</span>${dateStr ? ` - ${dateStr}` : ''}`);
      } else if (dateStr) {
        grouped[key].extras.push(`<br>${dateStr}`);
      }
    }
  }

  const parts = [];
  let borderTop = '';
  for (const [subjectId, { extras }] of Object.entries(grouped)) {
    const sub = subjectMap[subjectId];
    if (!sub) continue;
    const extra = showDateBatch ? (extras[0] || '') : '';
    parts.push(`<p class="tt_subject${borderTop}">${escapeHtml(sub.name)}${extra}</p>`);
    borderTop = ' border_top';
  }
  return parts.join('');
}

export async function buildClassTimetableHtml({
  courseId,
  courseName,
  academicYear,
  academicType,
  semester,
  showDateBatch,
  tableName,
}) {
  const { gridHtml } = await buildClassTimetableGrid({
    courseId,
    courseName,
    academicYear,
    academicType,
    semester,
    showDateBatch,
    tableName,
  });
  return gridHtml;
}

export async function buildClassTimetablePrintHtml({
  courseId,
  courseName,
  academicYear,
  academicType,
  semester,
  showDateBatch,
  tableName,
  degreeLabel,
  memberId,
}) {
  const { gridHtml, subjectMap, hasStaff } = await buildClassTimetableGrid({
    courseId,
    courseName,
    academicYear,
    academicType,
    semester,
    showDateBatch,
    tableName,
  });
  if (!gridHtml) return '';

  const [bannerUrl, deptMap, staffMap] = await Promise.all([
    loadTimetableBannerUrl(),
    loadDepartmentMap(),
    loadStaffNameMap(),
  ]);

  const yearPrefix = `${convertNYear(semester, courseName)} `;
  const asOn = formatLegacyAsOnDate();
  const subtitle = `${escapeHtml(yearPrefix + degreeLabel)} | ${escapeHtml(academicYear)} <small> as on ${asOn}</small>`;
  const header = buildTimetablePrintHeaderHtml(' TimeTable', subtitle, bannerUrl);
  const generatedAt = formatDateTime(new Date());
  const generatedBy = `<p><small>Generated by ${escapeHtml(memberId || '')} @ ${escapeHtml(generatedAt)}</small></p>`;
  const staffFooter = hasStaff ? buildTimetableStaffFooter(subjectMap, staffMap) : '';
  const hodFooter = hasStaff ? buildTimetableHodSignFooter(subjectMap, deptMap) : '';
  const principalFooter = hasStaff ? buildTimetablePrincipalSignFooter() : '';

  return `${header}${wrapReportPanel(`${gridHtml}${generatedBy}${staffFooter}${hodFooter}${principalFooter}`)}`;
}

async function buildClassTimetableGrid({
  courseId,
  courseName,
  academicYear,
  academicType,
  semester,
  showDateBatch,
  tableName,
}) {
  const course = await getCourseById(courseId);
  if (!course) return { gridHtml: '', subjectMap: {}, hasStaff: false };
  const tt = await getTimeTable(courseName, String(semester), academicType);
  const maxPeriod = tt.max;
  const firstDay = tt.first;
  const finalPeriodArray = tt.time;
  const categoryMap = await loadTimetableCategoryMap();
  const batchCount = await loadBatchCount(courseId, academicYear, semester, academicType);
  const batchLetters = buildBatchLetters(batchCount);
  const staffState = { hasStaff: false };

  const subRows = await prisma.$queryRawUnsafe(
    `SELECT A.subject_id, A.subject_name, B.id, B.subject_name AS tt_name, B.subject_category, B.s_batch, B.department
     FROM basic_setup_subject_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
     WHERE A.del = 1 AND B.del = 1 AND A.academic_year = '${escapeSql(academicYear)}'
       AND A.course_id = '${escapeSql(String(courseId))}' AND A.semester_no = '${escapeSql(String(semester))}'
     ORDER BY A.subject_order ASC`,
  );
  const subjectMap = {};
  for (const s of subRows) {
    const cat = categoryMap[String(s.subject_category)] || '';
    const departmentIds = String(s.department || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    subjectMap[s.id] = {
      name: `${s.tt_name || s.subject_name} (${cat.slice(0, 2)})`,
      batch: s.s_batch === 1 ? batchCount : 1,
      staffIds: new Set(),
      departmentIds,
    };
  }

  let html = '<table width="100%" class="table table-bordered class-timetable-grid"><tr><td nowrap class="tt_time">Day/Time</td>';
  const headerDay = finalPeriodArray[firstDay] || {};
  for (let i = 1; i <= maxPeriod; i += 1) {
    const ptimes = headerDay[i];
    if (!ptimes) continue;
    const colspan = ptimes.col > 0 ? ` colspan="${ptimes.col + 1}"` : '';
    html += `<td${colspan} class="tt_time" nowrap>${escapeHtml(ptimes.ftime)} - <br> ${escapeHtml(ptimes.ttime)}</td>`;
    if (ptimes.col > 0) i += ptimes.col;
  }
  html += '</tr>';

  let prevDay = '';
  for (const [day, dayPeriod] of Object.entries(finalPeriodArray)) {
    if (!dayPeriod?.comp) continue;

    let trowSpan = 0;
    let subrowSpan = '';
    let trowTxt = '';
    if (dayPeriod.row === 2 && prevDay) {
      trowSpan = 2;
      trowTxt = ' rowspan="2"';
    }

    html += `<tr><td nowrap class="tt_time"${trowTxt}>${escapeHtml(day.charAt(0).toUpperCase() + day.slice(1))}</td>`;

    let lastRowspan = '';
    for (let i = 1; i <= maxPeriod; i += 1) {
      const ptimes = dayPeriod[i];
      if (!ptimes || ptimes.row === -1) continue;

      const cellContent = await loadTimetableCellContent({
        courseId,
        academicYear,
        semester,
        academicType,
        day,
        periodNo: ptimes.period,
        showDateBatch,
        tableName,
        subjectMap,
        batchLetters,
        staffState,
      });

      let colspan = '';
      if (ptimes.col > 0) {
        colspan = ` colspan="${ptimes.col + 1}"`;
        i += ptimes.col;
      }

      let vtableAlign = '';
      if (String(ptimes.period).toLowerCase() === 'break') {
        vtableAlign = ' style="vertical-align: top;"';
      }

      const prevSplit = prevDay ? finalPeriodArray[prevDay]?.split?.[i] : '';
      const curSplit = dayPeriod.split?.[i];
      if (curSplit && prevDay && curSplit !== prevSplit) {
        html += `<td${colspan} class="tt_time">${escapeHtml(ptimes.ftime)} - ${escapeHtml(ptimes.ttime)}</td>`;
        subrowSpan += `<td${colspan}${vtableAlign} style="padding:0">${cellContent}</td>`;
      } else {
        let rowspan = '';
        if (ptimes.row > 1) rowspan = ` rowspan="${ptimes.row}"`;
        if (trowSpan > 0 || ptimes.row > 1) {
          rowspan = ` rowspan="${ptimes.row + trowSpan}"`;
        }
        lastRowspan = rowspan;
        html += `<td${colspan}${rowspan}${vtableAlign} style="padding:0">${cellContent}</td>`;
      }
    }

    html += '</tr>';
    if (trowSpan > 0 || lastRowspan) {
      html += `<tr>${subrowSpan}</tr>`;
    }
    prevDay = day;
  }

  html += '</table>';
  return { gridHtml: html, subjectMap, hasStaff: staffState.hasStaff };
}

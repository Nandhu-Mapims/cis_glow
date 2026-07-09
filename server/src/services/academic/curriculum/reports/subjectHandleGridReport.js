import { prisma } from '../../../../config/prisma.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { logAcademicSetup } from '../../setup/setupAudit.js';
import {
  buildBatchLetters,
  buildCourseCyearOptions,
  defaultDateRange,
  escapeHtml,
  getCourseById,
  getTimeTable,
  loadBatchCount,
  parseCourseCyearKey,
  parseInputDate,
  wrapReportPanel,
} from './reportShared.js';

const PAGE = 'subject_handle1.php';
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

async function loadRoomMachineMap() {
  const roomRows = await prisma.$queryRawUnsafe(
    'SELECT id, machine_id, room_name FROM rooms_tb WHERE del = 1',
  );
  const machineArray = {};
  for (const room of roomRows) {
    const parts = [];
    for (const mid of String(room.machine_id || '').split(',')) {
      const t = mid.trim();
      if (t) parts.push(`flag='${escapeSql(t)}'`);
    }
    for (const mid of String(room.room_name || '').split(',')) {
      const t = mid.trim();
      if (t) parts.push(`flag='${escapeSql(t)}'`);
    }
    if (parts.length) machineArray[room.id] = ` AND (${parts.join(' OR ')})`;
  }
  return machineArray;
}

function buildPeriodTimeMap(tt) {
  const fPeriodTime = {};
  let fmaxPeriod = 1;
  for (const [day, dayPeriod] of Object.entries(tt.time)) {
    let aPrd = 1;
    let pFt = '';
    let pTt = '';
    for (let i = 1; i <= tt.max; i += 1) {
      const prdNo = dayPeriod[i]?.period;
      const fTime = dayPeriod[i]?.ftime;
      const tTime = dayPeriod[i]?.ttime;
      pFt = fPeriodTime[day]?.[aPrd - 1]?.f;
      pTt = fPeriodTime[day]?.[aPrd - 1]?.t;
      if (Number.isFinite(Number(prdNo)) && pFt !== fTime && pTt !== tTime) {
        if (!fPeriodTime[day]) fPeriodTime[day] = {};
        fPeriodTime[day][aPrd] = { f: fTime, t: tTime };
        aPrd += 1;
        if (aPrd > fmaxPeriod) fmaxPeriod = aPrd;
      }
    }
  }
  return { fPeriodTime, fmaxPeriod };
}

async function loadTimetableSlots(courseId, academicYear, currentYear, academicType, fromIso, toIso) {
  return prisma.$queryRawUnsafe(
    `SELECT subject_id, staff_id, batch_no, LOWER(t_day) AS t_day, period,
      IF(CAST(from_date AS CHAR) LIKE '0000-00-00%', NULL, from_date) AS from_date,
      IF(CAST(to_date AS CHAR) LIKE '0000-00-00%', NULL, to_date) AS to_date
     FROM timetable_tb
     WHERE del = 1 AND course_id = '${escapeSql(String(courseId))}'
       AND academic_year = '${escapeSql(academicYear)}'
       AND current_year = '${escapeSql(String(currentYear))}'
       AND academic_type = '${escapeSql(academicType)}'
       AND CAST(from_date AS CHAR) NOT LIKE '0000-00-00%'
       AND from_date <= '${escapeSql(toIso)}'
       AND (CAST(to_date AS CHAR) LIKE '0000-00-00%' OR to_date >= '${escapeSql(fromIso)}')`,
  );
}

function slotActiveOnDate(slot, attDate) {
  const attTs = new Date(attDate).getTime();
  const fromTs = slot.from_date ? new Date(slot.from_date).getTime() : 0;
  const toRaw = slot.to_date;
  const toTs = !toRaw || String(toRaw).startsWith('0000')
    ? Infinity
    : new Date(toRaw).getTime();
  return fromTs <= attTs && attTs <= toTs;
}

function quarterTableName(dateStr) {
  const d = new Date(dateStr);
  return `punchtimedetails_${d.getFullYear()}${Math.ceil((d.getMonth() + 1) / 4)}`;
}

function quarterTablesForRange(fromIso, toIso) {
  const tables = new Set();
  for (let m = new Date(`${fromIso}T00:00:00`).getTime(); m <= new Date(`${toIso}T00:00:00`).getTime(); m += 86400000) {
    tables.add(quarterTableName(new Date(m).toISOString().slice(0, 10)));
  }
  return [...tables];
}

function parseMachineFlags(machineSql) {
  if (!machineSql) return null;
  const flags = new Set();
  const re = /flag='([^']*)'/g;
  let match = re.exec(machineSql);
  while (match) {
    flags.add(match[1]);
    match = re.exec(machineSql);
  }
  return flags.size ? flags : null;
}

async function loadPunchRowsByTable(fromIso, toIso, tickets) {
  const uniqueTickets = [...new Set(
    tickets.flatMap((t) => [String(t), `0${String(t)}`]).filter(Boolean),
  )];
  const byTable = new Map();
  if (!uniqueTickets.length) return byTable;

  const ticketsSql = uniqueTickets.map((t) => `'${escapeSql(t)}'`).join(',');
  const rangeStart = `${fromIso} 00:00:00`;
  const rangeEnd = `${toIso} 23:59:59`;

  await Promise.all(quarterTablesForRange(fromIso, toIso).map(async (tbl) => {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT tktno, p_date, flag FROM ${tbl}
         WHERE p_date >= '${escapeSql(rangeStart)}' AND p_date <= '${escapeSql(rangeEnd)}'
           AND tktno IN (${ticketsSql})
         ORDER BY p_date ASC`,
      );
      byTable.set(tbl, rows);
    } catch {
      byTable.set(tbl, []);
    }
  }));
  return byTable;
}

function findFirstPunch(punchRows, ticket, fromDt, toDt, allowedFlags) {
  const tkt1 = String(ticket);
  const tkt2 = `0${tkt1}`;
  const fromTs = fromDt.getTime();
  const toTs = toDt.getTime();
  for (const row of punchRows) {
    const tkt = String(row.tktno);
    if (tkt !== tkt1 && tkt !== tkt2) continue;
    const pTs = new Date(row.p_date).getTime();
    if (pTs < fromTs || pTs > toTs) continue;
    if (allowedFlags && !allowedFlags.has(String(row.flag))) continue;
    return new Date(row.p_date);
  }
  return null;
}

export async function loadSubjectHandleGridReport(memberId, fields = {}, audit = {}) {
  const defaults = defaultDateRange();
  const courseYearOptions = await buildCourseCyearOptions({ shortLabel: true });
  const selection = parseCourseCyearKey(fields.course_name);
  const fromDate = fields.from_date || defaults.fromDate;
  const toDate = fields.to_date || defaults.toDate;
  const generate = Boolean(fields.generate || fields.Submit === 'Generate');
  let html = '';

  if (generate && selection) {
    const course = await getCourseById(selection.courseId);
    const academicType = 'Regular';
    const fromIso = parseInputDate(fromDate);
    const toIso = parseInputDate(toDate);
    const tt = await getTimeTable(course?.course_name || '', selection.currentYear, academicType);
    const batchCount = await loadBatchCount(selection.courseId, selection.academicYear, selection.currentYear, academicType);
    const batchLetters = buildBatchLetters(batchCount);
    const { fPeriodTime, fmaxPeriod } = buildPeriodTimeMap(tt);

    const [subRows, machineArray, staffRows, timetableSlots] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT A.subject_id, A.subject_name, B.id, B.subject_id AS sid, B.subject_name AS tt_name, B.s_batch, B.room_no
         FROM basic_setup_subject_tb AS A INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
         WHERE A.del = 1 AND B.del = 1 AND A.academic_year = '${escapeSql(selection.academicYear)}'
           AND A.course_id = '${escapeSql(String(selection.courseId))}' AND A.semester_no = '${escapeSql(String(selection.currentYear))}'
         ORDER BY A.subject_order ASC`,
      ),
      loadRoomMachineMap(),
      prisma.$queryRawUnsafe(
        `SELECT A.id, A.staff_id, A.staff_title, A.staff_name, A.staff_initial
         FROM staff_profile_tb AS A INNER JOIN staff_designation_tb AS B ON A.id = B.staff_id
         WHERE A.del = 1 AND (CAST(A.releaving_date AS CHAR) LIKE '0000-00-00%' OR A.releaving_date >= '${escapeSql(fromIso)}')
           AND B.del = 1 AND B.is_academic = 1 ORDER BY A.staff_id ASC`,
      ),
      loadTimetableSlots(
        selection.courseId,
        selection.academicYear,
        selection.currentYear,
        academicType,
        fromIso,
        toIso,
      ),
    ]);

    const subjectMap = {};
    for (const s of subRows) {
      subjectMap[s.id] = { sid: s.sid, name: s.tt_name || s.subject_name, batch: s.s_batch, room: s.room_no };
    }

    const staffMap = Object.fromEntries(staffRows.map((s) => [String(s.id), {
      id: s.staff_id,
      name: `${s.staff_title ? `${s.staff_title}. ` : ''}${s.staff_initial || ''} ${s.staff_name || ''}`.trim(),
    }]));

    const staffTickets = new Set();
    for (const slot of timetableSlots) {
      for (const stId of String(slot.staff_id || '').split(',').map((s) => s.trim()).filter(Boolean)) {
        const st = staffMap[stId];
        if (st?.id) staffTickets.add(String(st.id));
      }
    }
    const punchByTable = await loadPunchRowsByTable(fromIso, toIso, [...staffTickets]);

    const slotsByDayPeriod = new Map();
    for (const slot of timetableSlots) {
      const key = `${slot.t_day}|${slot.period}`;
      if (!slotsByDayPeriod.has(key)) slotsByDayPeriod.set(key, []);
      slotsByDayPeriod.get(key).push(slot);
    }

    let body = '<table class="table table-bordered table-sm"><tr class="table-secondary"><td>Date/Period</td>';
    for (let i = 1; i <= fmaxPeriod; i += 1) body += `<td>${i}</td>`;
    body += '</tr>';

    for (let m = new Date(`${fromIso}T00:00:00`).getTime(); m <= new Date(`${toIso}T00:00:00`).getTime(); m += 86400000) {
      const attDate = new Date(m).toISOString().slice(0, 10);
      const day = DAY_NAMES[new Date(m).getDay()];
      const tbl = quarterTableName(attDate);
      const punchRows = punchByTable.get(tbl) || [];
      body += `<tr><td class="tt_time">${new Date(m).toLocaleDateString('en-GB')}<br>${escapeHtml(day)}</td>`;

      for (let i = 1; i <= fmaxPeriod; i += 1) {
        const slots = (slotsByDayPeriod.get(`${day}|${String(i)}`) || [])
          .filter((slot) => slotActiveOnDate(slot, attDate));
        let cell = '';
        const prdTime = fPeriodTime[day]?.[i];
        let attFrom = null;
        let attTo = null;
        if (prdTime?.f && prdTime?.t) {
          attFrom = new Date(`${attDate}T${prdTime.f}`);
          attTo = new Date(`${attDate}T${prdTime.t}`);
          attFrom.setMinutes(attFrom.getMinutes() - 10);
        }

        for (const slot of slots) {
          const sub = subjectMap[slot.subject_id];
          if (!sub) continue;
          let batchStr = '';
          if (sub.batch === 1 && slot.batch_no) {
            batchStr = String(slot.batch_no).split(',').map((b) => batchLetters[b.trim()]).filter(Boolean).join(', ');
            if (batchStr) batchStr = `, #${batchStr}`;
          }
          const machineSql = machineArray[sub.room];
          const allowedFlags = parseMachineFlags(machineSql);
          for (const stId of String(slot.staff_id || '').split(',').map((s) => s.trim()).filter(Boolean)) {
            const st = staffMap[stId];
            if (!st) continue;
            let attStatus = 'Room no. Empty';
            if (machineSql && attFrom && attTo) {
              const punchTime = findFirstPunch(punchRows, st.id, attFrom, attTo, allowedFlags);
              attStatus = punchTime
                ? punchTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                : 'No FP';
            }
            cell += `<span>${escapeHtml(sub.sid)}${escapeHtml(batchStr)} (${escapeHtml(st.id)}): ${escapeHtml(attStatus)}</span><br>`;
          }
        }
        body += `<td class="tt_time">${cell}</td>`;
      }
      body += '</tr>';
    }
    body += '</table>';
    html = wrapReportPanel(body);
  }

  await logAcademicSetup(PAGE, generate ? 'Generate' : 'View', 'Successful', fields.course_name || '', memberId, audit);
  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection,
    fromDate,
    toDate,
    html,
  };
}

export async function saveSubjectHandleGridReport(memberId, fields = {}, audit = {}) {
  return loadSubjectHandleGridReport(memberId, fields, audit);
}

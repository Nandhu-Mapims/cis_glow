import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { formatDateDisplay, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'library_entry_report.php';

function resolveDateRange(fields = {}) {
  const from = toIsoDate(fields.fromDate || fields.from_date);
  const to = toIsoDate(fields.toDate || fields.to_date);
  if (from && to) return { fromDate: from, toDate: to };
  const today = new Date();
  const fromDefault = new Date(today);
  fromDefault.setMonth(fromDefault.getMonth() - 1);
  fromDefault.setDate(fromDefault.getDate() + 1);
  return {
    fromDate: fromDefault.toISOString().slice(0, 10),
    toDate: today.toISOString().slice(0, 10),
  };
}

function eachDay(fromDate, toDate) {
  const days = [];
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);
  for (let cur = new Date(fromDate); cur <= end; cur.setDate(cur.getDate() + 1)) {
    days.push(cur.toISOString().slice(0, 10));
  }
  return days;
}

async function countsByDay(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  const map = new Map();
  for (const row of rows) {
    const day = String(row.day).slice(0, 10);
    map.set(day, Number(row.cnt || 0));
  }
  return map;
}

async function loadTransactionCountsByDay(fromDate, toDate) {
  const from = escapeSql(fromDate);
  const to = escapeSql(toDate);
  const baseJoin = `FROM library_transaction_tb AS A
    INNER JOIN book_tb AS B ON A.book_id = B.accession_no
    WHERE A.del = 1 AND B.del = 1`;

  const [issued, returned, dueOpen, dueAll] = await Promise.all([
    countsByDay(
      `SELECT DATE(A.check_out_date) AS day, COUNT(*) AS cnt ${baseJoin}
       AND DATE(A.check_out_date) BETWEEN '${from}' AND '${to}'
       GROUP BY DATE(A.check_out_date)`,
    ),
    countsByDay(
      `SELECT DATE(A.check_in_date) AS day, COUNT(*) AS cnt ${baseJoin}
       AND DATE(A.check_in_date) BETWEEN '${from}' AND '${to}'
       AND A.check_in_date != '0000-00-00 00:00:00'
       AND A.check_in_date != '1970-01-01 00:00:00'
       GROUP BY DATE(A.check_in_date)`,
    ),
    countsByDay(
      `SELECT DATE(A.due_date) AS day, COUNT(*) AS cnt ${baseJoin}
       AND A.check_in_date = '0000-00-00'
       AND DATE(A.due_date) BETWEEN '${from}' AND '${to}'
       GROUP BY DATE(A.due_date)`,
    ),
    countsByDay(
      `SELECT DATE(A.due_date) AS day, COUNT(*) AS cnt ${baseJoin}
       AND DATE(A.due_date) BETWEEN '${from}' AND '${to}'
       GROUP BY DATE(A.due_date)`,
    ),
  ]);

  return { issued, returned, dueOpen, dueAll };
}

async function loadStaffAttendanceByDay(fromDate, toDate) {
  const from = escapeSql(fromDate);
  const to = escapeSql(toDate);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DATE(B.p_date) AS day,
            COUNT(DISTINCT CASE WHEN MOD(B.sno, 2) = 1 THEN A.id END) AS staff_in,
            COUNT(DISTINCT CASE WHEN MOD(B.sno, 2) = 0 THEN A.id END) AS staff_out
     FROM staff_profile_tb AS A
     INNER JOIN library_attendance AS B
       ON (A.staff_id = B.tktno OR CONCAT('0', A.staff_id) = B.tktno)
     WHERE A.del = 1
       AND DATE(B.p_date) BETWEEN '${from}' AND '${to}'
     GROUP BY DATE(B.p_date)`,
  );
  const map = new Map();
  for (const row of rows) {
    const day = String(row.day).slice(0, 10);
    map.set(day, {
      staffIn: Number(row.staff_in || 0),
      staffOut: Number(row.staff_out || 0),
    });
  }
  return map;
}

async function studentLibraryAttendance(currentDate, courseName) {
  const setupRows = await prisma.$queryRawUnsafe(
    `SELECT ug_academic_year, pg_academic_year FROM basic_setup_tb WHERE del = 1 LIMIT 1`,
  );
  const acYear = courseName === 'P.G'
    ? setupRows[0]?.pg_academic_year
    : setupRows[0]?.ug_academic_year;

  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_duration FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = '${escapeSql(courseName)}' ORDER BY c_order ASC`,
  );
  if (!courses.length) return [0, 0];

  let maxYear = 0;
  let courseIdSql = '';
  for (const course of courses) {
    if (Number(course.course_duration) > maxYear) maxYear = Number(course.course_duration);
    courseIdSql += ` A.course_id='${escapeSql(String(course.id))}' OR`;
  }
  courseIdSql = ` AND (${courseIdSql.slice(0, -2)}) `;

  const d = escapeSql(currentDate);
  let totalIn = 0;
  let totalOut = 0;

  for (let year = 1; year <= maxYear; year += 1) {
    let yearCourseSql = courseIdSql;
    if (!(courseName === 'U.G' && year === maxYear)) {
      yearCourseSql += ` AND A.academic_year='${escapeSql(String(acYear || ''))}' `;
    }

    const inRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT A.id) AS cnt
       FROM student_academic_tb AS A
       INNER JOIN library_attendance AS B ON A.register_no = B.tktno
       WHERE A.del = 1 ${yearCourseSql}
         AND A.current_year = '${year}'
         AND DATE(B.p_date) = '${d}'`,
    );
    const outRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM (
         SELECT B.tktno
         FROM student_academic_tb AS A
         INNER JOIN library_attendance AS B ON A.register_no = B.tktno
         WHERE A.del = 1 ${yearCourseSql}
           AND A.current_year = '${year}'
           AND DATE(B.p_date) = '${d}'
         GROUP BY B.tktno
         HAVING COUNT(A.id) > 1
       ) AS t`,
    );

    totalIn += Number(inRows[0]?.cnt || 0);
    totalOut += Number(outRows[0]?.cnt || 0);
  }

  return [totalIn, totalOut];
}

function formatSummaryDate(isoDate) {
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  return `${dd}-${mm}-${yy} | ${weekday}`;
}

export async function loadEntryReportSetup(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = resolveDateRange(fields);
  const days = eachDay(fromDate, toDate);

  const [txnCounts, staffByDay] = await Promise.all([
    loadTransactionCountsByDay(fromDate, toDate),
    loadStaffAttendanceByDay(fromDate, toDate),
  ]);

  const rows = [];
  for (let i = 0; i < days.length; i += 1) {
    const day = days[i];
    const [ugIn, ugOut] = await studentLibraryAttendance(day, 'U.G');
    const [pgIn, pgOut] = await studentLibraryAttendance(day, 'P.G');
    const staff = staffByDay.get(day) || { staffIn: 0, staffOut: 0 };
    const dueOpen = txnCounts.dueOpen.get(day) || 0;
    const dueAll = txnCounts.dueAll.get(day) || 0;

    rows.push({
      sn: i + 1,
      date: formatSummaryDate(day),
      issued: txnCounts.issued.get(day) || 0,
      returned: txnCounts.returned.get(day) || 0,
      due: `${dueOpen} of ${dueAll}`,
      ugIn,
      ugOut,
      pgIn,
      pgOut,
      staffIn: staff.staffIn,
      staffOut: staff.staffOut,
    });
  }

  await logLibrarySetup(PAGE, fields.load ? 'Generate' : 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    rowCount: rows.length,
    summary: {
      issued: rows.reduce((sum, row) => sum + row.issued, 0),
      returned: rows.reduce((sum, row) => sum + row.returned, 0),
    },
    rows,
  };
}

export async function saveEntryReportSetup(payload, memberId, audit = {}) {
  return loadEntryReportSetup(memberId, { ...payload, load: true }, audit);
}

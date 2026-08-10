import { prisma } from '../../../config/prisma.js';
import { bookCategorySelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { formatDateDisplay, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'dashboard_library.php';
const REPORT_PAGE = 'dashboard_lib_report.php';

// ---------------------------------------------------------------------------
// Date helpers (all pure ISO 'YYYY-MM-DD' string math, done in UTC to avoid
// server-timezone drift — see legacy `dashboard_library.php` day_list logic).
// ---------------------------------------------------------------------------
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function toUtcDate(iso) {
  return new Date(`${iso}T00:00:00Z`);
}
function fromUtcDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDaysIso(iso, n) {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtcDate(d);
}
function startOfMonthIso(iso) {
  return `${iso.slice(0, 7)}-01`;
}
function endOfMonthIso(iso) {
  const d = toUtcDate(startOfMonthIso(iso));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return fromUtcDate(last);
}
function prevMonthFirstIso(iso) {
  const d = toUtcDate(startOfMonthIso(iso));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return fromUtcDate(d);
}

/** Mirrors dashboard_library.php / dashboard_lib_report.php $day_list construction. */
function buildDayBuckets(currentDate) {
  const yesterday = addDaysIso(currentDate, -1);
  const thisMonthFrom = startOfMonthIso(currentDate);
  const thisMonthTo = currentDate;
  const lastMonthFrom = prevMonthFirstIso(currentDate);
  const lastMonthTo = endOfMonthIso(lastMonthFrom);

  const dow = toUtcDate(currentDate).getUTCDay(); // 0=Sun..6=Sat, matches PHP date('w')
  let thisWeekFrom;
  let thisWeekTo;
  if (dow === 1) {
    thisWeekFrom = currentDate;
    thisWeekTo = currentDate;
  } else {
    const daysSinceMonday = (dow + 6) % 7;
    thisWeekFrom = addDaysIso(currentDate, -daysSinceMonday);
    thisWeekTo = currentDate;
  }
  const lastWeekFrom = addDaysIso(thisWeekFrom, -7);
  const lastWeekTo = addDaysIso(thisWeekFrom, -1);

  return [
    { label: 'Today', from: currentDate, to: currentDate },
    { label: 'Yesterday', from: yesterday, to: yesterday },
    { label: 'This Week', from: thisWeekFrom, to: thisWeekTo },
    { label: 'Last Week', from: lastWeekFrom, to: lastWeekTo },
    { label: 'This Month', from: thisMonthFrom, to: thisMonthTo },
    { label: 'Last Month', from: lastMonthFrom, to: lastMonthTo },
    { label: 'Total', from: null, to: null },
  ];
}

function rangeSql(col, bucket) {
  if (!bucket.from) return '';
  return ` AND ${col} >= '${escapeSql(bucket.from)}' AND ${col} <= '${escapeSql(bucket.to)}'`;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
function fmtDateSql(col) {
  return `IF(${col} IS NULL OR ${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%d-%m-%Y'))`;
}

function formatDateTimeDisplay(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() <= 1970) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h %= 12;
  if (h === 0) h = 12;
  const hh = String(h).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${mi} ${ampm}`;
}

function staffDisplayName(title, name, initial) {
  const t = String(title || '').trim();
  const prefix = t ? `${t}. ` : '';
  return `${prefix}${String(name || '')} ${String(initial || '')}`.trim();
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReportHtml({ title, filters, columns, rows }) {
  const filterHtml = (filters || [])
    .filter((f) => f && f.value !== undefined && f.value !== null && f.value !== '')
    .map((f) => `<p>${escapeHtml(f.label)}: <strong>${escapeHtml(f.value)}</strong></p>`)
    .join('');
  const headHtml = (columns || []).map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const bodyHtml = (rows || [])
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<h3>${escapeHtml(title)}</h3>${filterHtml}<table class="table table-bordered table-sm"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

/** Odd/even per-person parity trick shared by every in/out split in this module
 * (dashboard tiles + drill-down report): each attendance scan for a person
 * toggles in/out — 1st scan of the day = In, 2nd = Out, 3rd = In, … */
async function fetchParityRows(sql, keyField) {
  const rows = await prisma.$queryRawUnsafe(sql);
  const ref = new Map();
  return rows.map((row) => {
    const key = String(row[keyField]);
    const n = (ref.get(key) || 0) + 1;
    ref.set(key, n);
    return { ...row, __seq: n };
  });
}

async function parityCounts(sql, keyField) {
  const rows = await fetchParityRows(sql, keyField);
  let inCount = 0;
  let outCount = 0;
  for (const row of rows) {
    if (row.__seq % 2 === 1) inCount += 1;
    else outCount += 1;
  }
  return { in: inCount, out: outCount };
}

/** ctype = 'In' | 'Out'. `guardZero` mirrors the (functionally inert but
 * documented) extra `>0` guard the legacy student/combined-attendance report
 * has on the Out branch that the staff report lacks — see doc §2. */
function filterParityRows(rows, ctype, guardZero = false) {
  return rows.filter((row) => {
    if (ctype === 'In') return row.__seq % 2 === 1;
    if (ctype === 'Out') return row.__seq % 2 === 0 && (!guardZero || row.__seq > 0);
    return false;
  });
}

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------
async function loadAcademicYearRef() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ug_academic_year, pg_academic_year FROM basic_setup_tb WHERE del=1 LIMIT 1`,
  );
  return {
    'U.G': rows[0]?.ug_academic_year || '',
    'P.G': rows[0]?.pg_academic_year || '',
  };
}

async function loadCourseYearContext(courseName, acYearRef) {
  const acYear = acYearRef[courseName] || '';
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_duration FROM basic_setup_course_tb WHERE del=1 AND course_name='${escapeSql(courseName)}' ORDER BY c_order ASC`,
  );
  let tyear = 0;
  const ids = [];
  for (const c of courses) {
    if (Number(c.course_duration) > tyear) tyear = Number(c.course_duration);
    ids.push(String(c.id));
  }
  return { acYear, tyear, ids };
}

function courseIdFilterSql(ids, alias) {
  if (!ids.length) return '';
  return ` (${ids.map((id) => `${alias}.course_id='${escapeSql(id)}'`).join(' OR ')})`;
}

async function loadDepartmentCategories() {
  return prisma.book_category_tb.findMany({
    where: { del: 1, category: 'Department' },
    orderBy: { category_order: 'asc' },
    select: bookCategorySelect,
  });
}

/** Mirrors LibraryBook()'s branch-match / not-like-any-branch ("Other") SQL,
 * reused by both the dashboard branch tiles and drill-down flag=6. */
function buildDeptFilter(cats, ctype) {
  if (ctype && ctype !== 'Other') {
    const cat = cats.find((c) => String(c.id) === String(ctype));
    const id = escapeSql(String(ctype));
    return {
      sql: ` AND (resource_department='${id}' OR resource_department LIKE '${id}%,' OR resource_department LIKE ',%${id}' OR resource_department LIKE ',%${id}%,')`,
      label: cat ? cat.category_name : '',
    };
  }
  let notLike = '';
  for (const cat of cats) {
    const id = escapeSql(String(cat.id));
    notLike += ` AND resource_department!='${id}' AND resource_department NOT LIKE '${id}%,' AND resource_department NOT LIKE ',%${id}' AND resource_department NOT LIKE ',%${id}%,'`;
  }
  return { sql: notLike, label: 'Other' };
}

async function getNameDetails(registerNo) {
  const rn = escapeSql(String(registerNo || ''));
  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT staff_id, staff_name, staff_initial, staff_title, job_category FROM staff_profile_tb WHERE del=1 AND staff_id='${rn}'`,
  );
  if (staffRows.length) {
    const s = staffRows[0];
    const name = staffDisplayName(s.staff_title, s.staff_name, s.staff_initial);
    const catRows = await prisma.$queryRawUnsafe(
      `SELECT category_name FROM edu_setup_tb WHERE category='Category' AND id='${escapeSql(String(s.job_category))}' ORDER BY category_order ASC`,
    );
    return [name, catRows[0]?.category_name || ''];
  }

  const studentRows = await prisma.$queryRawUnsafe(
    `SELECT A.student_name, A.student_initial, A.register_no, A.course_id, A.academic_year,
            B.degree_name, B.department_short_name, B.course_duration, B.course_name, A.id, A.student_title
     FROM student_profile_tb AS A INNER JOIN basic_setup_course_tb AS B ON A.course_id=B.id
     WHERE A.del=1 AND B.del=1 AND A.register_no='${rn}'`,
  );
  if (!studentRows.length) return ['', ''];
  const s = studentRows[0];

  const setupRows = await prisma.$queryRawUnsafe(`SELECT ug_academic_year, pg_academic_year FROM basic_setup_tb WHERE del=1 AND id=1`);
  const acYear = s.course_name === 'P.G' ? setupRows[0]?.pg_academic_year : setupRows[0]?.ug_academic_year;
  const acRows = await prisma.$queryRawUnsafe(
    `SELECT current_year FROM student_academic_tb WHERE del=1 AND s_id='${escapeSql(String(s.id))}' AND academic_year='${escapeSql(String(acYear || ''))}' AND course_id='${escapeSql(String(s.course_id))}'`,
  );
  const currentYear = acRows[0]?.current_year;
  const sYear = String(currentYear) === '5' && s.course_name === 'U.G'
    ? convertNYear(currentYear, s.course_name)
    : `${convertNYear(currentYear, s.course_name)} Year`;

  const name = staffDisplayName(s.student_title, s.student_name, s.student_initial);
  const dept = String(s.department_short_name || '').trim() && String(s.department_short_name).trim() !== '-'
    ? ` - ${s.department_short_name}`
    : '';
  const line2 = `${sYear}${sYear ? ' | ' : ''}${s.degree_name || ''}${dept}`;
  return [name, line2];
}

// ---------------------------------------------------------------------------
// Dashboard tiles
// ---------------------------------------------------------------------------

/** "Total Summary" tile — book_category_tb category='Resource', first 6 by
 * category_order; count = book_tb rows with resource_type = that category id. */
async function loadTotalSummary() {
  const cats = await prisma.book_category_tb.findMany({
    where: { del: 1, category: 'Resource' },
    orderBy: { category_order: 'asc' },
    take: 6,
    select: bookCategorySelect,
  });
  const out = [];
  for (const cat of cats) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM book_tb WHERE del=1 AND resource_type='${escapeSql(String(cat.id))}'`,
    );
    out.push({ id: cat.id, name: cat.category_name, count: Number(rows[0]?.cnt || 0) });
  }
  return out;
}

/** "Issue/Return" tile — I/R/D counts per day bucket, joined to book_tb. */
async function loadIssueReturnBuckets(currentDate) {
  const buckets = buildDayBuckets(currentDate);
  const out = [];
  for (const bucket of buckets) {
    const [iRows, rRows, dRows] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS cnt FROM library_transaction_tb AS A INNER JOIN book_tb AS B ON A.book_id=B.accession_no
         WHERE A.del=1 ${rangeSql('A.check_out_date', bucket)} AND B.del=1`,
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS cnt FROM library_transaction_tb AS A INNER JOIN book_tb AS B ON A.book_id=B.accession_no
         WHERE A.del=1 ${rangeSql('A.check_in_date', bucket)} AND B.del=1`,
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS cnt FROM library_transaction_tb AS A INNER JOIN book_tb AS B ON A.book_id=B.accession_no
         WHERE A.del=1 AND A.check_in_date='0000-00-00' ${rangeSql('A.due_date', bucket)} AND B.del=1`,
      ),
    ]);
    out.push({
      label: bucket.label,
      i: Number(iRows[0]?.cnt || 0),
      r: Number(rRows[0]?.cnt || 0),
      d: Number(dRows[0]?.cnt || 0),
    });
  }
  return out;
}

/** "Attendance" tile — ssAttendance(): per-course-year (U.G/P.G) In/Out rows,
 * per-staff-category In/Out rows, plus a grand Total row. This is the only
 * attendance block actually rendered by the live dashboard_library.php —
 * `staffLibraryAttendance()` / `studentLibraryAttendance()` are defined but
 * never invoked in the current file (dead code); see final report. */
async function loadAttendanceSummary(currentDate) {
  const acYearRef = await loadAcademicYearRef();
  const rows = [];
  let totalIn = 0;
  let totalOut = 0;

  for (const courseName of ['U.G', 'P.G']) {
    const { acYear, tyear, ids } = await loadCourseYearContext(courseName, acYearRef);
    if (!ids.length) continue;
    const baseCourseSql = courseIdFilterSql(ids, 'A');
    for (let i = 1; i <= tyear; i += 1) {
      const isFinalUg = courseName === 'U.G' && i === tyear;
      const yearFilter = isFinalUg ? '' : ` AND A.academic_year='${escapeSql(acYear)}'`;
      const sql = `SELECT A.id AS person_key, B.id AS att_id FROM student_academic_tb AS A
        INNER JOIN library_attendance AS B ON A.register_no=B.tktno
        WHERE A.del=1 AND ${baseCourseSql} AND A.current_year='${i}'${yearFilter} AND DATE(B.p_date)='${escapeSql(currentDate)}'
        ORDER BY B.p_date ASC, B.id ASC`;
      const counts = await parityCounts(sql, 'person_key');
      totalIn += counts.in;
      totalOut += counts.out;
      rows.push({
        type: 'student',
        label: `${convertNYear(i, courseName)} ${courseName}`,
        course: courseName,
        cyear: i,
        in: counts.in,
        out: counts.out,
      });
    }
  }

  const catRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(B.id), B.sub_category FROM staff_profile_tb AS A INNER JOIN edu_setup_tb AS B ON A.job_category=B.id
     WHERE A.del=1 AND (A.releaving_date > '${escapeSql(currentDate)}' OR A.releaving_date='0000-00-00') AND B.category='Category'
     ORDER BY A.job_category ASC`,
  );
  const staffCatTotals = new Map();
  const staffCatOrder = [];
  for (const row of catRows) {
    const cid = row.id;
    const catName = row.sub_category;
    const sql = `SELECT A.id AS person_key, B.id AS att_id FROM staff_profile_tb AS A
      INNER JOIN library_attendance AS B ON (A.staff_id=B.tktno OR CONCAT('0',A.staff_id)=B.tktno)
      WHERE A.del=1 AND A.job_category='${escapeSql(String(cid))}' AND DATE(B.p_date)='${escapeSql(currentDate)}'
      ORDER BY B.p_date ASC, B.id ASC`;
    const counts = await parityCounts(sql, 'person_key');
    totalIn += counts.in;
    totalOut += counts.out;
    if (!staffCatTotals.has(catName)) {
      staffCatTotals.set(catName, { in: 0, out: 0 });
      staffCatOrder.push(catName);
    }
    const acc = staffCatTotals.get(catName);
    acc.in += counts.in;
    acc.out += counts.out;
  }
  for (const catName of staffCatOrder) {
    const acc = staffCatTotals.get(catName);
    rows.push({ type: 'staff', label: catName, cat: catName, in: acc.in, out: acc.out });
  }

  return { rows, total: { in: totalIn, out: totalOut } };
}

/** LibraryBook() — resource-count tiles by branch (book_category_tb
 * category='Department'), plus a synthetic "Other" tile. */
async function loadBranchTiles() {
  const cats = await loadDepartmentCategories();
  const tiles = [];
  for (const cat of cats) {
    const { sql } = buildDeptFilter(cats, String(cat.id));
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM book_tb WHERE del=1 ${sql}`);
    const count = Number(rows[0]?.cnt || 0);
    if (count > 0) tiles.push({ id: cat.id, name: cat.category_name, count });
  }
  const { sql: otherSql } = buildDeptFilter(cats, 'Other');
  if (otherSql) {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM book_tb WHERE del=1 ${otherSql}`);
    const count = Number(rows[0]?.cnt || 0);
    if (count > 0) tiles.push({ id: 'Other', name: 'Other', count });
  }
  return tiles;
}

export async function loadLibraryDashboard(memberId, fields = {}, audit = {}) {
  const dateIso = toIsoDate(fields.date || fields.attendance_date) || todayIso();

  const [totalSummary, issueReturn, attendance, branches] = await Promise.all([
    loadTotalSummary(),
    loadIssueReturnBuckets(dateIso),
    loadAttendanceSummary(dateIso),
    loadBranchTiles(),
  ]);

  await logLibrarySetup(PAGE, 'View', 'Successful', dateIso, memberId, audit);
  return {
    date: dateIso,
    dateDisplay: formatDateDisplay(dateIso),
    totalSummary,
    issueReturn,
    attendance,
    branches,
  };
}

export async function saveLibraryDashboard(payload, memberId, audit = {}) {
  return loadLibraryDashboard(memberId, payload, audit);
}

// ---------------------------------------------------------------------------
// Drill-down report — dashboard_lib_report.php (flag 1..7)
// ---------------------------------------------------------------------------

async function reportStaffAttendance(fields) {
  const cdate = toIsoDate(fields.cdate) || todayIso();
  const atype = fields.ctype === 'Out' ? 'Out' : 'In';
  const catName = String(fields.cat || '').trim();
  const filters = [];
  let catFilter = '';
  if (catName) {
    filters.push({ label: 'Category', value: catName });
    const idRows = await prisma.$queryRawUnsafe(`SELECT id FROM edu_setup_tb WHERE sub_category='${escapeSql(catName)}'`);
    if (idRows.length) {
      catFilter = ` AND (${idRows.map((r) => `A.job_category='${escapeSql(String(r.id))}'`).join(' OR ')})`;
    }
  }
  filters.push({ label: 'Date', value: formatDateDisplay(cdate) });

  const sql = `SELECT A.id AS person_key, B.p_date AS att_time, A.staff_id, A.staff_title, A.staff_name, A.staff_initial
    FROM staff_profile_tb AS A INNER JOIN library_attendance AS B ON (A.staff_id=B.tktno OR CONCAT('0',A.staff_id)=B.tktno)
    WHERE A.del=1 AND DATE(B.p_date)='${escapeSql(cdate)}' ${catFilter}
    ORDER BY B.p_date ASC, B.id ASC`;
  const parityRows = await fetchParityRows(sql, 'person_key');
  const matched = filterParityRows(parityRows, atype, false);

  const columns = ['S.No.', 'S.ID', 'Staff Name', 'Time'];
  const rows = matched.map((r, idx) => [
    idx + 1,
    r.staff_id,
    staffDisplayName(r.staff_title, r.staff_name, r.staff_initial),
    formatDateTimeDisplay(r.att_time),
  ]);
  const title = `Staff Library ${atype}`;
  return { title, filters, columns, rows, printHtml: buildReportHtml({ title, filters, columns, rows }) };
}

async function reportStudentAttendance(fields) {
  const cdate = toIsoDate(fields.cdate) || todayIso();
  const atype = fields.ctype === 'Out' ? 'Out' : 'In';
  const course = String(fields.course || '').trim();
  const cyear = String(fields.cyear || '').trim();
  const title = `${course} Student Library ${atype}`;
  const filters = [];
  const rows = [];

  if (course) {
    const acYearRef = await loadAcademicYearRef();
    const { acYear, tyear: ftyear, ids } = await loadCourseYearContext(course, acYearRef);
    let syear = 1;
    let tyear = ftyear;
    if (cyear) {
      const yearLabel = course === 'U.G' && Number(cyear) === ftyear
        ? convertNYear(cyear, course)
        : `${convertNYear(cyear, course)} Year`;
      filters.push({ label: 'Year', value: yearLabel });
      syear = Number(cyear);
      tyear = Number(cyear);
    }
    filters.push({ label: 'Academic Year', value: acYear });
    filters.push({ label: 'Date', value: formatDateDisplay(cdate) });

    if (ids.length) {
      const baseCourseSql = courseIdFilterSql(ids, 'B');
      let counter = 0;
      for (let i = syear; i <= tyear; i += 1) {
        const isFinalUg = course === 'U.G' && i === ftyear;
        const cYearLabel = isFinalUg ? convertNYear(i, course) : `${convertNYear(i, course)} Year`;
        const yearFilter = isFinalUg ? '' : ` AND B.academic_year='${escapeSql(acYear)}'`;
        const sql = `SELECT A.id AS person_key, A.p_date AS att_time, B.register_no, C.student_title, C.student_name, C.student_initial, C.id AS c_id
          FROM library_attendance AS A INNER JOIN student_academic_tb AS B ON A.tktno=B.register_no INNER JOIN student_profile_tb AS C ON B.register_no=C.register_no
          WHERE DATE(A.p_date)='${escapeSql(cdate)}' AND B.del=1 AND ${baseCourseSql} AND B.current_year='${i}'${yearFilter} AND B.register_no!='' AND C.del=1
          ORDER BY A.p_date ASC, A.id ASC`;
        const parityRows = await fetchParityRows(sql, 'c_id');
        const matched = filterParityRows(parityRows, atype, true);
        for (const r of matched) {
          counter += 1;
          rows.push([
            counter,
            r.register_no,
            staffDisplayName(r.student_title, r.student_name, r.student_initial),
            cYearLabel,
            formatDateTimeDisplay(r.att_time),
          ]);
        }
      }
    }
  }

  const columns = ['S.No.', 'Roll No.', 'Student Name', 'Year', 'Time'];
  return { title, filters, columns, rows, printHtml: buildReportHtml({ title, filters, columns, rows }) };
}

async function reportStaffTransactions(fields) {
  const cdate = toIsoDate(fields.cdate) || todayIso();
  const atype = fields.ctype;
  const catId = String(fields.cat || '').trim();

  let searchCol = 'check_out_date';
  let orderCol = 'created_dt';
  let extraFilter = '';
  let showReturnCol = false;
  let title = 'Staff | Book Issued';
  if (atype === 'Return') {
    searchCol = 'check_in_date'; orderCol = 'updated_dt'; showReturnCol = true; title = 'Staff | Book Return';
  } else if (atype === 'Due') {
    searchCol = 'due_date'; extraFilter = ` AND DATE(A.check_in_date)='0000-00-00'`; title = 'Staff | Book Due';
  }

  const filters = [];
  let catFilter = '';
  if (catId) {
    const catRows = await prisma.$queryRawUnsafe(`SELECT category_name FROM edu_setup_tb WHERE id='${escapeSql(catId)}'`);
    filters.push({ label: 'Category', value: catRows[0]?.category_name || '' });
    catFilter = ` AND B.job_category='${escapeSql(catId)}'`;
  }
  filters.push({ label: 'Date', value: formatDateDisplay(cdate) });

  const sql = `SELECT DISTINCT A.id, A.book_id, ${fmtDateSql('A.check_out_date')} AS check_out, ${fmtDateSql('A.check_in_date')} AS check_in,
      ${fmtDateSql('A.due_date')} AS due, B.staff_id, B.staff_title, B.staff_name, B.staff_initial, C.resource_name
    FROM library_transaction_tb AS A INNER JOIN staff_profile_tb AS B ON A.register_no=B.staff_id INNER JOIN book_tb AS C ON A.book_id=C.accession_no
    WHERE A.del=1 AND DATE(A.${searchCol})='${escapeSql(cdate)}' ${extraFilter} AND B.del=1 ${catFilter} AND C.del=1
    ORDER BY A.${orderCol} ASC`;
  const dataRows = await prisma.$queryRawUnsafe(sql);

  const columns = ['S.No.', 'S.ID', 'Staff Name', 'Accession No.', 'Book', 'Issued Date', 'Due Date'];
  if (showReturnCol) columns.push('Return Date');
  const rows = dataRows.map((r, idx) => {
    const row = [idx + 1, r.staff_id, staffDisplayName(r.staff_title, r.staff_name, r.staff_initial), r.book_id, r.resource_name, r.check_out, r.due];
    if (showReturnCol) row.push(r.check_in);
    return row;
  });
  return { title, filters, columns, rows, printHtml: buildReportHtml({ title, filters, columns, rows }) };
}

async function reportStudentTransactions(fields) {
  const cdate = toIsoDate(fields.cdate) || todayIso();
  const atype = fields.ctype;
  const course = String(fields.course || '').trim();
  const cyear = String(fields.cyear || '').trim();

  let searchCol = 'check_out_date';
  let orderCol = 'created_dt';
  let extraFilter = '';
  let showReturnCol = false;
  let title = `${course} Student | Book Issued`;
  if (atype === 'Return') {
    searchCol = 'check_in_date'; orderCol = 'updated_dt'; showReturnCol = true; title = `${course} Student | Book Return`;
  } else if (atype === 'Due') {
    searchCol = 'due_date'; extraFilter = ` AND DATE(A.check_in_date)='0000-00-00'`; title = `${course} Student | Book Due`;
  }

  const filters = [];
  const rows = [];
  if (course) {
    const acYearRef = await loadAcademicYearRef();
    const { acYear, tyear: ftyear, ids } = await loadCourseYearContext(course, acYearRef);
    let syear = 1;
    let tyear = ftyear;
    if (cyear) {
      const yearLabel = course === 'U.G' && Number(cyear) === ftyear
        ? convertNYear(cyear, course)
        : `${convertNYear(cyear, course)} Year`;
      filters.push({ label: 'Year', value: yearLabel });
      syear = Number(cyear);
      tyear = Number(cyear);
    }
    filters.push({ label: 'Academic Year', value: acYear });
    filters.push({ label: 'Date', value: formatDateDisplay(cdate) });

    if (ids.length) {
      const baseCourseSql = courseIdFilterSql(ids, 'B');
      let counter = 0;
      for (let i = syear; i <= tyear; i += 1) {
        const isFinalUg = course === 'U.G' && i === ftyear;
        const cYearLabel = isFinalUg ? convertNYear(i, course) : `${convertNYear(i, course)} Year`;
        const yearFilter = isFinalUg ? '' : ` AND B.academic_year='${escapeSql(acYear)}'`;
        const sql = `SELECT DISTINCT A.id, A.book_id, ${fmtDateSql('A.check_out_date')} AS check_out, ${fmtDateSql('A.check_in_date')} AS check_in,
            ${fmtDateSql('A.due_date')} AS due, B.register_no, C.student_title, C.student_name, C.student_initial, D.resource_name
          FROM library_transaction_tb AS A INNER JOIN student_academic_tb AS B ON A.register_no=B.register_no
            INNER JOIN student_profile_tb AS C ON A.register_no=C.register_no INNER JOIN book_tb AS D ON A.book_id=D.accession_no
          WHERE A.del=1 AND DATE(A.${searchCol})='${escapeSql(cdate)}' ${extraFilter} AND B.del=1 AND ${baseCourseSql} AND B.current_year='${i}'${yearFilter} AND C.del=1 AND D.del=1
          ORDER BY A.${orderCol} ASC`;
        const dataRows = await prisma.$queryRawUnsafe(sql);
        for (const r of dataRows) {
          counter += 1;
          const row = [counter, r.register_no, staffDisplayName(r.student_title, r.student_name, r.student_initial), cYearLabel, r.book_id, r.resource_name, r.check_out, r.due];
          if (showReturnCol) row.push(r.check_in);
          rows.push(row);
        }
      }
    }
  }

  const columns = ['S.No.', 'Roll No.', 'Student Name', 'Year', 'Accession No.', 'Book', 'Issued Date', 'Due Date'];
  if (showReturnCol) columns.push('Return Date');
  return { title, filters, columns, rows, printHtml: buildReportHtml({ title, filters, columns, rows }) };
}

async function reportBucketTransactions(fields) {
  const cdate = toIsoDate(fields.cdate) || todayIso();
  const atype = fields.ctype; // I | R | D
  const acat = String(fields.cat || '').trim(); // bucket label e.g. "This Week"

  let orderCol = 'A.created_dt';
  let searchCol = 'check_out_date';
  let extraFilter = '';
  let showReturnCol = false;
  let label = 'Book Issued';
  if (atype === 'R') { orderCol = 'A.updated_dt'; searchCol = 'check_in_date'; showReturnCol = true; label = 'Book Return'; }
  else if (atype === 'D') { searchCol = 'due_date'; extraFilter = ` AND DATE(A.check_in_date)='0000-00-00'`; label = 'Book Due'; }
  const title = `${acat} ${label}`.trim();

  const buckets = buildDayBuckets(cdate);
  const bucket = buckets.find((b) => b.label === acat) || { label: acat, from: null, to: null };
  const bucketCol = atype === 'R' ? 'A.check_in_date' : atype === 'D' ? 'A.due_date' : 'A.check_out_date';
  const bucketFilter = rangeSql(bucketCol, bucket);

  const filters = [{ label: 'Date', value: formatDateDisplay(cdate) }];

  // The "Total" bucket (no date filter) can match the entire transaction
  // history — tens of thousands of rows. Legacy has no cap here either, but
  // this repo has an explicit priority on not hanging screens (see commit
  // "Hang/timeout … fixed"), so cap defensively and de-dupe the per-row
  // getNameDetails() lookups below (a single student/staff member typically
  // appears on many rows).
  const sql = `SELECT DISTINCT A.id, A.book_id, ${fmtDateSql('A.check_out_date')} AS check_out, ${fmtDateSql('A.check_in_date')} AS check_in,
      ${fmtDateSql('A.due_date')} AS due, A.register_no, B.resource_name
    FROM library_transaction_tb AS A INNER JOIN book_tb AS B ON A.book_id=B.accession_no
    WHERE A.del=1 ${extraFilter}${bucketFilter} AND B.del=1
    ORDER BY ${orderCol} ASC LIMIT 1000`;
  const dataRows = await prisma.$queryRawUnsafe(sql);

  const columns = ['S.No.', 'S.ID', 'Name', 'Category/Year', 'Accession No.', 'Book', 'Issued Date', 'Due Date'];
  if (showReturnCol) columns.push('Return Date');
  const rows = [];
  let counter = 0;
  const nameCache = new Map();
  for (const r of dataRows) {
    const key = String(r.register_no);
    if (!nameCache.has(key)) nameCache.set(key, await getNameDetails(r.register_no));
    const [name, catYear] = nameCache.get(key);
    counter += 1;
    const row = [counter, r.register_no, name, catYear, r.book_id, r.resource_name, r.check_out, r.due];
    if (showReturnCol) row.push(r.check_in);
    rows.push(row);
  }
  return { title, filters, columns, rows, printHtml: buildReportHtml({ title, filters, columns, rows }) };
}

async function reportBookList(fields) {
  const ctype = String(fields.ctype || '').trim();
  const cats = await loadDepartmentCategories();
  const { sql: deptSql, label } = buildDeptFilter(cats, ctype);
  const title = 'Books';
  const filters = [{ label: 'Branch', value: label }];
  if (!deptSql) return { title, filters, columns: [], rows: [], printHtml: buildReportHtml({ title, filters, columns: [], rows: [] }) };

  const resourceCatRows = await prisma.$queryRawUnsafe(`SELECT id, category_name FROM book_category_tb WHERE del=1 AND category='Resource'`);
  const resourceCatMap = new Map(resourceCatRows.map((r) => [String(r.id), r.category_name]));

  const dataRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(id), accession_no, resource_name, resource_type, author_name FROM book_tb WHERE del=1 ${deptSql} ORDER BY accession_no ASC`,
  );
  const columns = ['S.No.', 'Accession No.', 'Name', 'Resource', 'Author'];
  const rows = dataRows.map((r, idx) => [
    idx + 1,
    r.accession_no,
    r.resource_name,
    resourceCatMap.get(String(r.resource_type)) || '',
    r.author_name,
  ]);
  return { title, filters, columns, rows, printHtml: buildReportHtml({ title, filters, columns, rows }) };
}

async function reportCombinedAttendance(fields) {
  const cdate = toIsoDate(fields.cdate) || todayIso();
  const atype = fields.ctype === 'Out' ? 'Out' : 'In';
  const title = `Attendance Library ${atype}`;
  const filters = [{ label: 'Date', value: formatDateDisplay(cdate) }];
  const columns = ['S.No.', 'S.ID', 'Name', 'Time'];
  const rows = [];
  let counter = 0;

  const studentSql = `SELECT A.id AS att_id, A.p_date AS att_time, B.register_no, B.student_title, B.student_name, B.student_initial, B.id AS person_key
    FROM library_attendance AS A INNER JOIN student_profile_tb AS B ON A.tktno=B.register_no
    WHERE DATE(A.p_date)='${escapeSql(cdate)}' AND B.del=1 AND B.register_no!=''
    ORDER BY A.p_date ASC, A.id ASC`;
  const studentParityRows = await fetchParityRows(studentSql, 'person_key');
  for (const r of filterParityRows(studentParityRows, atype, true)) {
    counter += 1;
    rows.push([counter, r.register_no, staffDisplayName(r.student_title, r.student_name, r.student_initial), formatDateTimeDisplay(r.att_time)]);
  }

  const staffSql = `SELECT A.id AS person_key, B.p_date AS att_time, A.staff_id, A.staff_title, A.staff_name, A.staff_initial
    FROM staff_profile_tb AS A INNER JOIN library_attendance AS B ON (A.staff_id=B.tktno OR CONCAT('0',A.staff_id)=B.tktno)
    WHERE A.del=1 AND DATE(B.p_date)='${escapeSql(cdate)}'
    ORDER BY B.p_date ASC, B.id ASC`;
  const staffParityRows = await fetchParityRows(staffSql, 'person_key');
  for (const r of filterParityRows(staffParityRows, atype, false)) {
    counter += 1;
    rows.push([counter, r.staff_id, staffDisplayName(r.staff_title, r.staff_name, r.staff_initial), formatDateTimeDisplay(r.att_time)]);
  }

  return { title, filters, columns, rows, printHtml: buildReportHtml({ title, filters, columns, rows }) };
}

export async function loadLibraryDashboardReport(memberId, fields = {}, audit = {}) {
  const flag = Number(fields.flag);
  let result;
  switch (flag) {
    case 1: result = await reportStaffAttendance(fields); break;
    case 2: result = await reportStudentAttendance(fields); break;
    case 3: result = await reportStaffTransactions(fields); break;
    case 4: result = await reportStudentTransactions(fields); break;
    case 5: result = await reportBucketTransactions(fields); break;
    case 6: result = await reportBookList(fields); break;
    case 7: result = await reportCombinedAttendance(fields); break;
    default:
      return { error: 'Unknown report flag' };
  }
  await logLibrarySetup(REPORT_PAGE, 'View', 'Successful', JSON.stringify(fields).slice(0, 500), memberId, audit);
  return result;
}

export async function saveLibraryDashboardReport(payload, memberId, audit = {}) {
  return loadLibraryDashboardReport(memberId, payload, audit);
}

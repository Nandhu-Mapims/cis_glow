import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'student_portfolio_dashboard.php';

const PUBLICATION_TYPES = [
  'National Journal', 'International Journal', 'National Conference', 'International Conference',
  'National Seminar', 'International Seminar', 'National Workshop', 'International Workshop',
  'National Symposium', 'International Symposium', 'Book', 'Patency', 'Copyright', 'Other',
];

const SEMINAR_CATEGORIES = ['Seminar', 'Conference', 'Workshop'];
const SEMINAR_NTYPES = ['National', 'International'];

function buildYearOptions(startYear, endYear) {
  const options = [];
  const from = Number(startYear) || new Date().getFullYear();
  const to = Number(endYear) || 2017;
  for (let year = from; year >= to; year -= 1) {
    const value = `${year}-${year + 1}`;
    options.push({ value, label: value });
  }
  return options;
}

async function loadMaxAcademicStartYear(courseName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT MAX(CAST(SUBSTRING(B.academic_year, 1, 4) AS UNSIGNED)) AS max_year
     FROM student_academic_tb AS B
     INNER JOIN basic_setup_course_tb AS C ON C.id = B.course_id
     WHERE B.del = 1 AND C.del = 1 AND C.course_name = '${escapeSql(courseName)}'
       AND B.academic_year REGEXP '^[0-9]{4}-[0-9]{4}$'`,
  );
  return Number(rows[0]?.max_year) || 0;
}

function indexCounts(rows, keys) {
  const map = new Map();
  for (const row of rows) {
    const parts = keys.map((key) => String(row[key] ?? ''));
    map.set(parts.join('\0'), Number(row.cnt || 0));
  }
  return map;
}

export async function loadPortfolioDashboard(memberId, fields = {}, audit = {}) {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
  const ugDefault = setup?.ug_academic_year || '';
  const pgDefault = setup?.pg_academic_year || '';
  const ugYear = fields.ugYear || fields.ug_regular || ugDefault;
  const pgYear = fields.pgYear || fields.pg_regular || pgDefault;

  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, dept_sname, c_order
     FROM basic_setup_course_tb WHERE del = 1 AND course_name IN ('U.G', 'P.G')
     ORDER BY c_order ASC`,
  );

  const publicationRows = await prisma.$queryRawUnsafe(
    `SELECT B.course_id AS course_id, A.p_journal AS p_journal, COUNT(A.id) AS cnt
     FROM student_publication_tb AS A
     INNER JOIN student_academic_tb AS B ON A.student_id = B.s_id
     INNER JOIN basic_setup_course_tb AS C ON C.id = B.course_id
     WHERE A.del = 1 AND B.del = 1 AND C.del = 1
       AND C.course_name IN ('U.G', 'P.G')
       AND (
         (C.course_name = 'U.G' AND B.academic_year = '${escapeSql(ugYear)}')
         OR (C.course_name = 'P.G' AND B.academic_year = '${escapeSql(pgYear)}')
       )
     GROUP BY B.course_id, A.p_journal`,
  );

  const seminarRowsRaw = await prisma.$queryRawUnsafe(
    `SELECT B.course_id AS course_id, A.category AS category, A.ntype AS ntype, COUNT(A.id) AS cnt
     FROM student_seminar_tb AS A
     INNER JOIN student_academic_tb AS B ON A.student_id = B.s_id
     INNER JOIN basic_setup_course_tb AS C ON C.id = B.course_id
     WHERE A.del = 1 AND B.del = 1 AND C.del = 1
       AND C.course_name IN ('U.G', 'P.G')
       AND A.category IN ('Seminar', 'Conference', 'Workshop')
       AND A.ntype IN ('National', 'International')
       AND (
         (C.course_name = 'U.G' AND B.academic_year = '${escapeSql(ugYear)}')
         OR (C.course_name = 'P.G' AND B.academic_year = '${escapeSql(pgYear)}')
       )
     GROUP BY B.course_id, A.category, A.ntype`,
  );

  const pubIndex = indexCounts(publicationRows, ['course_id', 'p_journal']);
  const seminarIndex = indexCounts(seminarRowsRaw, ['course_id', 'category', 'ntype']);

  const publicationTable = [];
  const seminarTable = [];
  const totals = {
    publications: 0,
    seminars: 0,
    conferences: 0,
    workshops: 0,
  };

  for (const course of courses) {
    const courseId = String(course.id);
    const courseLabel = course.dept_sname || course.degree_name || courseId;
    const pubCounts = {};

    for (const type of PUBLICATION_TYPES) {
      const count = pubIndex.get(`${courseId}\0${type}`) || 0;
      pubCounts[type] = count;
      totals.publications += count;
    }

    publicationTable.push({
      course: courseLabel,
      courseName: course.course_name,
      counts: pubCounts,
    });

    for (const category of SEMINAR_CATEGORIES) {
      const national = seminarIndex.get(`${courseId}\0${category}\0National`) || 0;
      const international = seminarIndex.get(`${courseId}\0${category}\0International`) || 0;
      seminarTable.push({
        course: courseLabel,
        category,
        national,
        international,
      });
      if (category === 'Seminar') {
        totals.seminars += national + international;
      } else if (category === 'Conference') {
        totals.conferences += national + international;
      } else {
        totals.workshops += national + international;
      }
    }
  }

  const ugConfigStart = Number(String(ugDefault).slice(0, 4)) || new Date().getFullYear();
  const pgConfigStart = Number(String(pgDefault).slice(0, 4)) || new Date().getFullYear();
  const [ugDataStart, pgDataStart] = await Promise.all([
    loadMaxAcademicStartYear('U.G'),
    loadMaxAcademicStartYear('P.G'),
  ]);
  const ugStart = Math.max(ugConfigStart, ugDataStart);
  const pgStart = Math.max(pgConfigStart, pgDataStart);

  await logModulePage(PAGE, 'View', 'Successful', `${ugYear}/${pgYear}`, memberId, audit);
  return {
    ugYear,
    pgYear,
    ugYearOptions: buildYearOptions(ugStart, 2017),
    pgYearOptions: buildYearOptions(pgStart, 2018),
    publicationTypes: PUBLICATION_TYPES,
    publicationRows: publicationTable,
    seminarRows: seminarTable,
    summary: {
      overall: totals.publications + totals.seminars + totals.conferences + totals.workshops,
      publications: totals.publications,
      seminars: totals.seminars,
      conferences: totals.conferences,
      workshops: totals.workshops,
    },
  };
}

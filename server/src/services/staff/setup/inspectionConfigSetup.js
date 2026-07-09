import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import { formatDisplayDate } from '../staffShared.js';

const PAGE = 'inspection_config.php';

function formatCourseOptionLabel(course, academicYear = '') {
  const degree = String(course.degree_name || course.degree_short_name || course.course_name || '').trim();
  let department = String(course.department_name || '').trim();
  if (department && department !== '-') {
    department = ` - ${department}`;
  } else {
    department = '';
  }
  const yearPart = academicYear ? ` | ${academicYear}` : '';
  return `${degree}${department}${yearPart}`;
}

function toDateInput(val) {
  if (!val || String(val).startsWith('0000-00-00')) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export async function loadInspectionConfigSetup(memberId, fields = {}, audit = {}) {
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, degree_short_name, department_name, department_short_name, dept_sname
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC, id ASC`,
  );
  const inspectionNames = await prisma.$queryRawUnsafe(
    'SELECT id, inspection_for FROM inspection_name WHERE del = 1 ORDER BY inspection_order ASC',
  );
  const courseId = fields.courseId || courses[0]?.id || '';
  const academicYear = fields.academicYear || '';
  const academicType = fields.academicType || 'Regular';

  let rows = [];
  if (courseId) {
    const where = { del: 1, course_id: String(courseId), academic_type: academicType };
    if (academicYear) where.academic_year = String(academicYear);
    const dbRows = await prisma.$queryRawUnsafe(
      `SELECT id, inspection_for, ref_letter_no, ins_academic_year, seats,
              IF(CAST(from_date AS CHAR)='0000-00-00', NULL, from_date) AS from_date,
              IF(CAST(to_date AS CHAR)='0000-00-00', NULL, to_date) AS to_date,
              i_enable
       FROM inspection_config_tb WHERE del = 1 AND course_id = '${String(courseId).replace(/'/g, "''")}'
         AND academic_type = '${String(academicType).replace(/'/g, "''")}'
         ${academicYear ? `AND academic_year = '${String(academicYear).replace(/'/g, "''")}'` : ''}
       ORDER BY id ASC`,
    );
    rows = dbRows.map((r) => ({
      id: r.id,
      inspectionFor: r.inspection_for,
      refLetterNo: r.ref_letter_no,
      insAcademicYear: r.ins_academic_year,
      seats: r.seats,
      fromDate: toDateInput(r.from_date),
      toDate: toDateInput(r.to_date),
      enabled: r.i_enable === 1,
    }));
  }

  await logStaffModule(PAGE, 'View', 'Successful', courseId, memberId, audit);
  return {
    courses: courses.map((c) => ({
      id: String(c.id),
      name: c.course_name,
      label: formatCourseOptionLabel(c, academicYear),
      shortName: c.degree_short_name || c.dept_sname,
    })),
    inspectionNames: inspectionNames.map((n) => ({ id: n.id, name: n.inspection_for })),
    selectedCourseId: courseId,
    academicYear,
    academicType,
    rows: rows.length ? rows : [{ inspectionFor: '', refLetterNo: '', insAcademicYear: '', seats: '', fromDate: '', toDate: '', enabled: true }],
  };
}

export async function saveInspectionConfigSetup(payload, memberId, audit = {}) {
  const courseId = String(payload.courseId || '').trim();
  const academicYear = String(payload.academicYear || '').trim();
  const academicType = String(payload.academicType || 'Regular').trim();
  if (!courseId) return { success: false, message: 'Course is required' };
  const { create, update } = auditFields(memberId, audit);

  const course = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_short_name, dept_sname FROM basic_setup_course_tb WHERE del = 1 AND id = ${Number(courseId)} LIMIT 1`,
  );
  const courseRow = course[0];
  const courseName = courseRow?.degree_short_name?.slice(0, 10) || courseRow?.dept_sname || String(courseId);

  await prisma.inspection_config_tb.updateMany({
    where: { del: 1, course_id: courseId, academic_type: academicType, academic_year: academicYear },
    data: { del: 0, ...update },
  });

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const inspectionFor = String(row.inspectionFor || '').trim();
    if (!inspectionFor) continue;
    const data = {
      course_id: courseId,
      course_name: courseName,
      academic_year: academicYear,
      academic_type: academicType,
      inspection_for: inspectionFor,
      ref_letter_no: String(row.refLetterNo || ''),
      ins_academic_year: String(row.insAcademicYear || ''),
      seats: String(row.seats || ''),
      from_date: row.fromDate ? new Date(row.fromDate) : new Date('1970-01-01'),
      to_date: row.toDate ? new Date(row.toDate) : new Date('1970-01-01'),
      i_enable: row.enabled ? 1 : 0,
      del: 1,
      ...update,
    };
    if (row.id) {
      await prisma.inspection_config_tb.update({ where: { id: Number(row.id) }, data });
    } else {
      await prisma.inspection_config_tb.create({ data: { ...data, ...create } });
    }
  }

  await logStaffModule(PAGE, 'Update', 'Successful', courseId, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadInspectionConfigSetup(memberId, { courseId, academicYear, academicType }, { ...audit, skipLog: true })),
  };
}

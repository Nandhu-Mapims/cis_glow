import { prisma } from '../../config/prisma.js';
import { logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'elearn_report.php';

export async function loadElearnReport(memberId, fields = {}, audit = {}) {
  const date = fields.date ? new Date(fields.date) : new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const courseId = String(fields.courseId || '');

  const where = { del: 1, exam_date: new Date(dateStr) };
  if (courseId) where.course_id = courseId;

  const tasks = await prisma.activity_task_tb.findMany({
    where,
    orderBy: [{ course_name: 'asc' }, { exam_period: 'asc' }],
  });

  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: { id: true, degree_name: true, course_name: true },
  });

  await logModulePage(PAGE, 'View', 'Successful', dateStr, memberId, audit);
  return {
    date: dateStr,
    courseId,
    courseOptions: courses.map((c) => ({ value: String(c.id), label: `${c.course_name} — ${c.degree_name}` })),
    rows: tasks.map((t) => ({
      id: t.id,
      examName: t.exam_name,
      courseName: t.course_name,
      subjectId: t.subject_id,
      period: t.exam_period,
      batch: t.batch_no,
      fromDate: t.from_date,
      toDate: t.to_date,
      active: t.is_active === 1,
    })),
  };
}

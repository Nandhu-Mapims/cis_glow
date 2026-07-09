import { prisma } from '../../config/prisma.js';
import { logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'elearn_dashboard.php';

export async function loadElearnDashboard(memberId, fields = {}, audit = {}) {
  const date = fields.date ? new Date(fields.date) : new Date();
  const dateStr = date.toISOString().slice(0, 10);

  const tasks = await prisma.activity_task_tb.findMany({
    where: { del: 1, exam_date: new Date(dateStr) },
    orderBy: { id: 'desc' },
    take: 200,
  });

  const summary = {
    classes: tasks.filter((t) => t.handle_link || t.material_link1).length,
    assignments: tasks.filter((t) => t.assignment_link).length,
    tests: tasks.filter((t) => t.total_question && Number(t.total_question) > 0).length,
  };

  await logModulePage(PAGE, 'View', 'Successful', dateStr, memberId, audit);
  return {
    date: dateStr,
    summary,
    sessions: tasks.map((t) => ({
      id: t.id,
      examName: t.exam_name,
      courseName: t.course_name,
      subjectId: t.subject_id,
      period: t.exam_period,
      active: t.is_active === 1,
    })),
  };
}

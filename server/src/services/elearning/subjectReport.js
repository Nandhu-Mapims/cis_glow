import { prisma } from '../../config/prisma.js';
import { logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'staff/subject_report.php';

export async function loadSubjectReport(memberId, fields = {}, audit = {}) {
  const taskId = Number(fields.taskId || 0);
  const task = taskId
    ? await prisma.activity_task_tb.findFirst({ where: { del: 1, id: taskId } })
    : null;

  let answers = [];
  if (task) {
    answers = await prisma.activity_answer_tb.findMany({
      where: { del: 1, exam_id: String(taskId) },
      orderBy: { register_no: 'asc' },
    });
  }

  const recentTasks = await prisma.activity_task_tb.findMany({
    where: { del: 1 },
    orderBy: { exam_date: 'desc' },
    take: 30,
    select: { id: true, exam_name: true, exam_date: true, subject_id: true },
  });

  await logModulePage(PAGE, 'View', 'Successful', String(taskId), memberId, audit);
  return {
    taskId: task ? String(task.id) : '',
    taskOptions: recentTasks.map((t) => ({
      value: String(t.id),
      label: `${t.exam_name} (${String(t.exam_date).slice(0, 10)})`,
    })),
    task: task ? {
      id: task.id,
      examName: task.exam_name,
      examDate: task.exam_date,
      subjectId: task.subject_id,
      period: task.exam_period,
    } : null,
    answers: answers.map((a) => ({
      registerNo: a.register_no,
      marks: a.marks,
      status: a.a_status,
    })),
    totalSubmitted: answers.length,
  };
}

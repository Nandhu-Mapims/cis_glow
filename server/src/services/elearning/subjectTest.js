import { prisma } from '../../config/prisma.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'staff/subject_test.php';

export async function loadSubjectTest(memberId, fields = {}, audit = {}) {
  const scheduleId = String(fields.scheduleId || '');
  const tasks = scheduleId
    ? await prisma.activity_task_tb.findMany({
        where: { del: 1, course_id: scheduleId },
        orderBy: { exam_date: 'desc' },
        take: 50,
      })
    : [];

  await logModulePage(PAGE, 'View', 'Successful', scheduleId, memberId, audit);
  return {
    scheduleId,
    tasks: tasks.map((t) => ({
      id: t.id,
      examName: t.exam_name,
      examDate: t.exam_date,
      subjectId: t.subject_id,
      period: t.exam_period,
      classInfo: t.class_info,
      materialLink1: t.material_link1,
      assignmentLink: t.assignment_link,
      isActive: t.is_active === 1,
    })),
    form: {
      examName: '',
      examDate: new Date().toISOString().slice(0, 10),
      subjectId: '',
      period: '',
      classInfo: '',
      materialLink1: '',
      assignmentLink: '',
    },
  };
}

export async function saveSubjectTest(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    await prisma.activity_task_tb.update({ where: { id: Number(payload.id) }, data: { del: 0, ...update } });
    await logModulePage(PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return { success: true, message: 'Session deleted...', ...(await loadSubjectTest(memberId, { scheduleId: payload.scheduleId }, { ...audit, skipLog: true })) };
  }

  const examName = String(payload.examName || '').trim();
  if (!examName) return { success: false, message: 'Session name is required' };

  const data = {
    exam_name: examName,
    exam_date: payload.examDate ? new Date(payload.examDate) : new Date(),
    exam_period: String(payload.period || ''),
    course_name: String(payload.courseName || ''),
    course_id: String(payload.scheduleId || payload.courseId || ''),
    course_type: String(payload.courseType || ''),
    academic_year: String(payload.academicYear || ''),
    current_year: String(payload.currentYear || ''),
    semester_no: String(payload.semesterNo || ''),
    batch_no: String(payload.batchNo || ''),
    subject_id: String(payload.subjectId || ''),
    chapter_list: '',
    total_question: '0',
    total_marks: '0',
    class_info: String(payload.classInfo || ''),
    handle_link: String(payload.handleLink || ''),
    material_link1: String(payload.materialLink1 || ''),
    material_link2: String(payload.materialLink2 || ''),
    assignment_link: String(payload.assignmentLink || ''),
    assignment_info: String(payload.assignmentInfo || ''),
    class_from: new Date(),
    class_to: new Date(),
    asmt_from: new Date(),
    asmt_to: new Date(),
    from_date: payload.fromDate ? new Date(payload.fromDate) : new Date(),
    to_date: payload.toDate ? new Date(payload.toDate) : new Date(),
    is_active: payload.isActive === false ? 0 : 1,
  };

  if (payload.id) {
    await prisma.activity_task_tb.update({ where: { id: Number(payload.id) }, data: { ...data, ...update } });
  } else {
    await prisma.activity_task_tb.create({ data: { ...data, ...create } });
  }

  await logModulePage(PAGE, 'Update', 'Successful', examName, memberId, audit);
  return { success: true, message: 'E-learning session saved...', ...(await loadSubjectTest(memberId, { scheduleId: payload.scheduleId }, { ...audit, skipLog: true })) };
}

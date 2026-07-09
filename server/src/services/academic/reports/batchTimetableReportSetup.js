import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect, ciaExamNameSelect, ciaSetupSelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { escapeHtml, loadExamSetupReportOptions } from '../academicSetupShared.js';
import { logAcademicSetup } from '../setup/setupAudit.js';

const PAGE = 'class_time_table_batch_report.php';

const BATCH_STR = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F' };

function batchLabel(raw) {
  return String(raw || '').split(',').map((b) => BATCH_STR[Number(b.trim())] || b.trim()).filter(Boolean).join(',');
}

export async function loadBatchTimetableReport(memberId, fields = {}, audit = {}) {
  const examOptions = await loadExamSetupReportOptions();
  const examId = String(fields.exam_name || '').trim();
  const passType = fields.a_pass_type === 'Clinical' ? 'Clinical' : 'Theory';
  const generate = Boolean(fields.generate);
  let html = '';

  if (generate && examId) {
    const exam = await prisma.cia_setup.findFirst({
      where: { del: 1, id: Number(examId) },
      select: ciaSetupSelect,
    });
    if (exam) {
      const examNameRow = await prisma.cia_exam_name.findFirst({
        where: { id: Number(exam.exam_name) },
        select: ciaExamNameSelect,
      });
      const examLabel = examNameRow
        ? `${examNameRow.exam_name}${examNameRow.exam_month ? ` (${examNameRow.exam_month})` : ''}`
        : `Exam ${examId}`;

      const courses = await prisma.basic_setup_course_tb.findMany({
        where: { del: 1, course_name: exam.course_name },
        select: basicSetupCourseSelect,
      });

      const catFilter = passType === 'Clinical'
        ? '(B.subject_category=5 OR B.subject_category=20)'
        : 'B.subject_category=4';

      html = `<div id="form_details_panel"><h4 class="text-center">${escapeHtml(examLabel)}</h4>
<p class="text-center">${escapeHtml(exam.course_name)} | ${escapeHtml(exam.academic_year)} (${escapeHtml(exam.academic_type)}) | ${escapeHtml(passType)}</p>`;

      for (const course of courses) {
        const totalSem = Number(course.total_semester) || Number(course.course_duration) || 0;
        for (let year = 1; year <= totalSem; year += 1) {
          const schedules = await prisma.$queryRawUnsafe(
            `SELECT A.exam_date, A.session_time, A.batch_no, B.short_subject_name, B.subject_name
             FROM cia_schedule_tb AS A
             INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
             INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
             WHERE A.del=1 AND B.del=1 AND C.del=1 AND A.exam_name='${escapeSql(examId)}'
               AND A.course_id='${course.id}' AND A.current_year='${year}'
               AND C.academic_year='${escapeSql(exam.academic_year)}' AND C.course_id='${course.id}'
               AND C.semester_no='${year}' AND ${catFilter}
             ORDER BY A.exam_date ASC, A.session_time ASC`,
          );
          if (!schedules.length) continue;

          html += `<h5 class="mt-3">${escapeHtml(convertNYear(year, course.course_name))} Year — ${escapeHtml(course.degree_name || '')}</h5>`;

          if (passType === 'Clinical') {
            const dates = [...new Set(schedules.map((s) => String(s.exam_date).slice(0, 10)))];
            const subjects = [...new Map(schedules.map((s) => [s.short_subject_name || s.subject_name, s])).values()];
            html += '<table class="table table-bordered table-sm"><thead class="table-secondary"><tr><th>Date</th>';
            for (const sub of subjects) {
              html += `<th>${escapeHtml(sub.short_subject_name || sub.subject_name)}</th>`;
            }
            html += '</tr></thead><tbody>';
            for (const date of dates) {
              html += `<tr><td>${escapeHtml(new Date(date).toLocaleDateString('en-GB'))}</td>`;
              for (const sub of subjects) {
                const match = schedules.find((s) => String(s.exam_date).slice(0, 10) === date
                  && (s.short_subject_name || s.subject_name) === (sub.short_subject_name || sub.subject_name));
                html += `<td>${escapeHtml(match ? batchLabel(match.batch_no) : '')}</td>`;
              }
              html += '</tr>';
            }
            html += '</tbody></table>';
          } else {
            html += '<table class="table table-bordered table-sm"><thead class="table-secondary"><tr><th>Date/Day</th><th>Time</th><th>Subject</th></tr></thead><tbody>';
            for (const row of schedules) {
              const d = new Date(row.exam_date);
              html += `<tr><td>${escapeHtml(d.toLocaleDateString('en-GB'))} / ${escapeHtml(d.toLocaleDateString('en-US', { weekday: 'short' }))}</td>
<td>${escapeHtml(row.session_time || '')}</td><td>${escapeHtml(row.short_subject_name || row.subject_name)}</td></tr>`;
            }
            html += '</tbody></table>';
          }
        }
      }

      html += '<p class="mt-4 text-end"><em>Principal</em></p></div>';
    }
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    passType,
    html,
  };
}

export async function saveBatchTimetableReport() {
  return { success: false, message: 'Report screen is read-only' };
}

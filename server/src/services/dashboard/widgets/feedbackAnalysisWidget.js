import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';

function num(val) {
  return Number(val) || 0;
}

/**
 * Legacy dashboard_more.php student_feedback($academic_date, $academic_year_ref)
 */
export async function renderFeedbackAnalysis({ academicDate, academicYears }) {
  const d = escapeSql(academicDate);
  let feedbackCatBody = '';
  let finalFeedbackTitle = '';

  let feedbackRows = await prisma.$queryRawUnsafe(
    `SELECT id, title FROM feedback_master
     WHERE del = 1
       AND (from_date = '0000-00-00' OR DATE(from_date) <= '${d}')
       AND (to_date = '0000-00-00' OR DATE(to_date) >= '${d}')
     LIMIT 1`,
  );

  if (!feedbackRows.length) {
    feedbackRows = await prisma.$queryRawUnsafe(
      `SELECT id, title FROM feedback_master WHERE del = 1 ORDER BY id DESC LIMIT 1`,
    );
  }

  const feedbackRow = feedbackRows[0];
  const finalFeedbackId = feedbackRow?.id;

  if (finalFeedbackId) {
    finalFeedbackTitle = feedbackRow.title || '';

    const selectedCourses = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT course_id FROM feedback_subject
       WHERE del = 1 AND f_id = '${escapeSql(String(finalFeedbackId))}'`,
    );
    const selectedSet = new Set(selectedCourses.map((r) => r.course_id));

    const courses = await prisma.$queryRawUnsafe(
      `SELECT id, course_name, course_duration, degree_name FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
    );

    const finalCourseListArray = [];

    for (const course of courses) {
      let courseDuration = num(course.course_duration);
      if (course.course_name === 'U.G') courseDuration -= 1;

      const acYear = academicYears[course.course_name]?.regular;
      if (!acYear) continue;

      for (let i = 1; i <= courseDuration; i += 1) {
        const cidStr = `${course.id}___${acYear}___${i}`;
        if (selectedSet.has(cidStr)) {
          finalCourseListArray.push({
            courseId: course.id,
            academicYear: acYear,
            currentYear: i,
            cidStr,
            label: `${convertNYear(i, course.course_name)} Year ${course.degree_name}`,
          });
        }
      }
    }

    for (const cd of finalCourseListArray) {
      const stuRow = await prisma.$queryRawUnsafe(
        `SELECT COUNT(A.id) AS cnt, GROUP_CONCAT(A.register_no SEPARATOR ',') AS regs
         FROM student_profile_tb AS A
         INNER JOIN student_academic_tb AS B ON A.id = B.s_id
         WHERE A.del = 1 AND A.course_id = '${escapeSql(String(cd.courseId))}'
           AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
           AND B.del = 1 AND B.academic_year = '${escapeSql(cd.academicYear)}'
           AND B.current_year = '${escapeSql(String(cd.currentYear))}'`,
      );

      const finalStudentList = String(stuRow[0]?.regs || '').split(',').filter(Boolean);
      const studentFillStatus = {};

      const subRows = await prisma.$queryRawUnsafe(
        `SELECT A.subject_id, A.subject_name, B.id, B.subject_id, B.subject_name,
                B.subject_category, B.s_batch, B.department, C.id, C.staff_id
         FROM basic_setup_subject_tb AS A
         INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
         INNER JOIN feedback_subject AS C ON B.id = C.subject_id
         WHERE A.del = 1 AND A.academic_year = '${escapeSql(cd.academicYear)}'
           AND A.course_id = '${escapeSql(String(cd.courseId))}'
           AND A.semester_no = '${escapeSql(String(cd.currentYear))}'
           AND B.del = 1 AND C.del = 1
           AND C.f_id = '${escapeSql(String(finalFeedbackId))}'
           AND C.course_id = '${escapeSql(cd.cidStr)}'
           AND C.staff_id != ''
         ORDER BY B.subject_category ASC, A.subject_order ASC`,
      );

      let totalSubCount = 0;

      for (const sub of subRows) {
        const staffList = String(sub.staff_id || '').split(',').map((s) => s.trim()).filter(Boolean);
        for (const stfId of staffList) {
          totalSubCount += 1;
          const rateRows = await prisma.$queryRawUnsafe(
            `SELECT GROUP_CONCAT(student_id SEPARATOR ',') AS ids FROM feedback_tb
             WHERE feedback_id = '${escapeSql(String(finalFeedbackId))}'
               AND course_id = '${escapeSql(cd.cidStr)}'
               AND subject_id = '${escapeSql(String(sub.id))}'
               AND staff_id = '${escapeSql(stfId)}' AND del = 1`,
          );

          if (rateRows[0]?.ids) {
            for (const stuid of String(rateRows[0].ids).split(',')) {
              if (!studentFillStatus[stuid]) studentFillStatus[stuid] = {};
              studentFillStatus[stuid][stfId] = stfId;
            }
          }
        }
      }

      let filledStudent = 0;
      let unfilledStudent = 0;

      for (const stuid of finalStudentList) {
        if (Object.keys(studentFillStatus[stuid] || {}).length === totalSubCount) {
          filledStudent += 1;
        } else {
          unfilledStudent += 1;
        }
      }

      feedbackCatBody += `<tr>
        <td height="30" >${cd.label}</td>
        <td align="right" class="cinfo" onclick="callfeedbackfill('${finalFeedbackId}','${academicDate}','all','${cd.cidStr}')">${filledStudent + unfilledStudent}</td>
        <td align="right" class="cinfo" onclick="callfeedbackfill('${finalFeedbackId}','${academicDate}','completed','${cd.cidStr}')">${filledStudent}</td>
        <td align="right" class="cinfo" onclick="callfeedbackfill('${finalFeedbackId}','${academicDate}','pending','${cd.cidStr}')">${unfilledStudent}</td>
        </tr>`;
    }
  }

  return `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
    <div class="revenue-head">
      <span>
      <i class="icon-user-follow"></i>
      </span>
      <h3>Feedback <span style="color:#CCC; font-size:14px; font-weight:normal; "> ${finalFeedbackTitle}</span></h3>
    </div>
    <div class="dashboard-panel">
      <table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
      <tr bgcolor="#F4F4F4" class="td_head_color">
      <th width="40%" height="30" >Course</th>
      <th width="20%" >#T</th>
      <th width="20%" >Completed</th>
      <th width="20%" >Pending</th>
      </tr> ${feedbackCatBody}
      </table>
    </div>
  </section>
</div>`;
}

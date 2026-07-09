import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

/** Legacy: /home/mapims/cis/cis/student/exam_statement.php (admin register lookup) */

async function loadStudentContext(registerNo) {
  const student = await prisma.student_profile_tb.findFirst({
    where: { del: 1, register_no: registerNo },
    select: {
      id: true,
      register_no: true,
      student_name: true,
      student_initial: true,
      course_id: true,
    },
  });
  if (!student) return null;

  const course = await prisma.basic_setup_course_tb.findFirst({
    where: { id: student.course_id },
    select: { course_name: true, degree_name: true, department_name: true },
  });

  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { ug_academic_year: true, uga_academic_year: true, pg_academic_year: true },
  });
  const acYears = {
    'U.G': { regular: setup?.ug_academic_year, additional: setup?.uga_academic_year },
    'P.G': { regular: setup?.pg_academic_year },
  };
  const courseName = course?.course_name || 'U.G';
  let acFilter = `academic_year='${escapeSql(acYears[courseName]?.regular || '')}' AND academic_batch='regular'`;
  if (courseName === 'U.G') {
    acFilter = `((academic_year='${escapeSql(acYears['U.G'].regular || '')}' AND academic_batch='regular')
      OR (academic_year='${escapeSql(acYears['U.G'].additional || '')}' AND academic_batch='additional'))`;
  }

  const academic = await prisma.$queryRawUnsafe(
    `SELECT id, current_year, academic_type, academic_batch, academic_year
     FROM student_academic_tb
     WHERE del = 1 AND s_id = '${student.id}' AND (${acFilter})
       AND course_id = '${student.course_id}'
     ORDER BY academic_year DESC, academic_batch DESC LIMIT 1`,
  );
  const ac = academic[0];
  if (!ac) return { student, course, academic: null };

  return {
    student,
    course,
    academic: {
      refAcademicYear: ac.academic_year,
      refCourseName: courseName,
      refCourseId: student.course_id,
      refCurrentYear: ac.current_year,
      refAcademicType: ac.academic_batch,
      refStudentNo: student.id,
    },
  };
}

async function listExamsWithMarks(ctx) {
  const { academic, student } = ctx;
  const exams = await prisma.cia_setup.findMany({
    where: {
      del: 1,
      course_name: academic.refCourseName,
      academic_year: academic.refAcademicYear,
      academic_type: academic.refAcademicType,
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      exam_name: true,
      exam_internal: true,
      exam_viva: true,
      exam_external: true,
      mark_option: true,
    },
  });

  const result = [];
  for (const exam of exams) {
    const marksCount = await prisma.cia_marks_tb.count({
      where: {
        del: 1,
        exam_name: exam.id,
        register_no: student.register_no,
      },
    });
    if (!marksCount) continue;

    const nameRow = await prisma.cia_exam_name.findFirst({
      where: { del: 1, id: Number(exam.exam_name) },
      select: { exam_name: true },
    });
    result.push({ ...exam, label: nameRow?.exam_name || String(exam.exam_name) });
  }
  return result;
}

async function buildMarksTable(ctx, examId) {
  const { academic, student } = ctx;
  const typeRows = await prisma.subject_master.findMany({
    where: { del: 1, category: 'Type' },
    orderBy: { category_order: 'asc' },
    select: { id: true, category_name: true },
  });
  const subjectTypeArray = Object.fromEntries(typeRows.map((r) => [String(r.id), r.category_name]));
  const scatOrder = typeRows.length
    ? `, FIELD(B.subject_category, ${typeRows.map((r) => `'${escapeSql(String(r.id))}'`).join(',')})`
    : '';

  const schedules = await prisma.$queryRawUnsafe(
    `SELECT A.internal_max, A.viva_max, A.external_max, A.pass_mark,
            B.subject_id, B.subject_category, B.rid, C.subject_name, C.short_subject_name
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del = 1 AND B.del = 1 AND C.del = 1
       AND A.academic_year = '${escapeSql(academic.refAcademicYear)}'
       AND A.current_year = '${academic.refCurrentYear}'
       AND A.academic_type = '${escapeSql(academic.refAcademicType)}'
       AND A.course_id = '${academic.refCourseId}'
       AND A.exam_name = '${Number(examId)}'
       AND C.academic_year = '${escapeSql(academic.refAcademicYear)}'
       AND C.course_id = '${academic.refCourseId}'
       AND C.semester_no = '${academic.refCurrentYear}'
       AND C.subject_enable = 1
     ORDER BY C.subject_order+0 ASC${scatOrder}`,
  );

  const subjectIdList = {};
  const theoryPracticalList = {};
  const theoryPracticalMarks = { I: {}, T: [] };
  const theoryPracticalCat = {};

  for (const row of schedules) {
    const rid = String(row.rid);
    const subId = String(row.subject_id);
    const scat = subjectTypeArray[String(row.subject_category)] || '';
    const tmark = Number(row.internal_max) + Number(row.viva_max) + Number(row.external_max);
    if (!subjectIdList[rid]) {
      subjectIdList[rid] = {
        name: row.subject_name,
        sname: row.short_subject_name || row.subject_name,
        exam: {},
        tmark: 0,
        tmax: 0,
      };
    }
    subjectIdList[rid].exam[subId] = { tmark, pmark: row.pass_mark, cat: scat };
    if (!theoryPracticalList[scat]) theoryPracticalList[scat] = {};
    if (!theoryPracticalList[scat][rid]) theoryPracticalList[scat][rid] = [];
    theoryPracticalList[scat][rid].push(subId);
    if (!theoryPracticalCat[rid]) theoryPracticalCat[rid] = { total: {}, pass: {} };
    theoryPracticalCat[rid].total[scat] = (theoryPracticalCat[rid].total[scat] || 0) + tmark;
    theoryPracticalCat[rid].pass[scat] = (theoryPracticalCat[rid].pass[scat] || 0) + Number(row.pass_mark);
    if (!theoryPracticalMarks.I[scat]) theoryPracticalMarks.I[scat] = [];
    theoryPracticalMarks.I[scat].push(tmark);
    theoryPracticalMarks.T.push(tmark);
  }

  let totalSubjectMarks = 0;
  let totalNoOfSubject = 0;
  for (const [, rsub] of Object.entries(subjectIdList)) {
    let tmark = 0;
    const maxParts = [];
    for (const [subId, ex] of Object.entries(rsub.exam)) {
      tmark += ex.tmark;
      maxParts.push(`subject_id='${escapeSql(subId)}'`);
    }
    rsub.tmark = tmark;
    totalSubjectMarks += tmark;
    totalNoOfSubject += 1;
    if (maxParts.length) {
      const maxRow = await prisma.$queryRawUnsafe(
        `SELECT SUM(t_marks) AS TMARK FROM cia_marks_tb
         WHERE del = 1 AND exam_name = '${Number(examId)}'
           AND course_id = '${academic.refCourseId}'
           AND academic_year = '${escapeSql(academic.refAcademicYear)}'
           AND current_year = '${academic.refCurrentYear}'
           AND academic_type = '${escapeSql(academic.refAcademicType)}'
           AND t_marks != 'A' AND (${maxParts.join(' OR ')})
         GROUP BY register_no ORDER BY TMARK DESC LIMIT 1`,
      );
      rsub.tmax = maxRow[0]?.TMARK || 0;
    }
  }

  let header = `<table width="100%" cellspacing="0" cellpadding="3" border="0" class="table table-bordered">
<tbody><tr bgcolor="#CCCCCC"><td align="center" width="25"><strong>SL.NO</strong></td>
<td align="center" width="200"><strong>NAME OF THE SUBJECT</strong></td>`;
  for (const scat of Object.keys(theoryPracticalList)) {
    const tmark = [...new Set(theoryPracticalMarks.I[scat] || [])];
    const mstr = tmark.length ? `<br>(${Math.max(...tmark)})` : '';
    header += `<td align="center" width="60"><strong>${scat.toUpperCase()}</strong>${mstr}</td>`;
  }
  const uniqueT = [...new Set(theoryPracticalMarks.T)];
  const tRef = uniqueT.length ? Math.max(...uniqueT) : 0;
  header += `<td align="center" width="60"><strong>MARKS OBTAINED</strong>${tRef ? `<br>(${tRef})` : ''}</td>
<td align="center" width="60"><strong>CLASS HIGHEST</strong></td></tr>`;

  let overallTotal = 0;
  const overallResult = { NONE: 0, FAIL: 0, AB: 0, PASS: 0, NA: 0 };
  let subCount = 0;
  let body = header;

  for (const [rid, rsub] of Object.entries(subjectIdList)) {
    subCount += 1;
    const rStatus = {};
    let cStatus = 0;
    let cTotal = 0;
    body += `<tr><td align="left" valign="top" height="40">${subCount}</td>
<td align="left" valign="top" bgcolor="#F4F4F4">${rsub.name}</td>`;

    for (const scat of Object.keys(theoryPracticalList)) {
      const catSubs = theoryPracticalList[scat][rid] || [];
      let tCTotal = 0;
      let tCStatus = 0;
      const tRStatus = {};

      for (const subId of catSubs) {
        if (!rsub.exam[subId]) continue;
        const marks = await prisma.cia_marks_tb.findFirst({
          where: {
            del: 1,
            exam_name: Number(examId),
            course_id: academic.refCourseId,
            academic_year: academic.refAcademicYear,
            current_year: academic.refCurrentYear,
            academic_type: academic.refAcademicType,
            subject_id: subId,
            register_no: student.register_no,
          },
          select: { t_marks: true, p_status: true },
        });
        if (marks?.p_status) {
          const tm = String(marks.t_marks).toLowerCase();
          if (tm !== 'a' && tm !== 'na') {
            cTotal += Number(marks.t_marks) || 0;
            overallTotal += Number(marks.t_marks) || 0;
            tCTotal += Number(marks.t_marks) || 0;
          }
          tRStatus[marks.p_status] = (tRStatus[marks.p_status] || 0) + 1;
        } else {
          tRStatus.NONE = (tRStatus.NONE || 0) + 1;
        }
        tCStatus += 1;
      }
      cStatus += 1;
      body += `<td class="marks_details" align="right" valign="top">${tCStatus > 0 ? tCTotal : '-'}&nbsp;</td>`;
      const catPass = theoryPracticalCat[rid]?.pass[scat] || 0;
      if ((tRStatus.NONE || 0) > 0) rStatus.NONE = (rStatus.NONE || 0) + 1;
      else if ((tRStatus.NA || 0) > 0) rStatus.NA = (rStatus.NA || 0) + 1;
      else if (tCStatus === (tRStatus.AB || 0)) rStatus.AB = (rStatus.AB || 0) + 1;
      else if (tCTotal >= catPass) rStatus.PASS = (rStatus.PASS || 0) + 1;
      else rStatus.FAIL = (rStatus.FAIL || 0) + 1;
    }

    let tmpTotal = cTotal;
    if ((rStatus.NONE || 0) > 0) overallResult.NONE += 1;
    else if ((rStatus.NA || 0) > 0) { overallResult.NA += 1; tmpTotal = 'NA'; }
    else if ((rStatus.FAIL || 0) > 0) overallResult.FAIL += 1;
    else if ((rStatus.AB || 0) === cStatus) { overallResult.AB += 1; tmpTotal = 'AB'; }
    else if ((rStatus.PASS || 0) === cStatus) overallResult.PASS += 1;
    else overallResult.FAIL += 1;

    body += `<td align="right" valign="top" bgcolor="#F4F4F4">${tmpTotal !== 'PASS' ? `<u>${tmpTotal}</u>` : tmpTotal}&nbsp;</td>
<td align="right" valign="top">${rsub.tmax}&nbsp;</td></tr>`;
  }

  let pLabel = 'FAIL';
  if (overallResult.NONE > 0) pLabel = '-';
  else if (overallResult.NA > 0) pLabel = 'NA';
  else if (overallResult.FAIL > 0) pLabel = 'FAIL';
  else if (overallResult.AB > 0) pLabel = 'AB';
  else if (overallResult.PASS === totalNoOfSubject) pLabel = 'PASS';

  body += `</table></td><td width="30%" style="padding-left:20px;">
<table height="298" width="120" cellspacing="0" cellpadding="0" border="0" class="table-bordered">
<tr><td nowrap height="60" align="center" width="107"><p>Total Marks</p><h3>${overallTotal}</h3><p>out of ${totalSubjectMarks}</p></td></tr>
<tr><td height="60" align="center"><p>Result</p><h3>${pLabel}</h3></td></tr>
</table></td></tr></table>`;

  return body;
}

export async function buildExamStudentStatementHtml(registerNo, fields = {}) {
  const ctx = await loadStudentContext(registerNo);
  if (!ctx) return { error: 'Student not found' };
  if (!ctx.academic) return { error: 'Student academic record not found' };

  const exams = await listExamsWithMarks(ctx);
  if (!exams.length) return { error: 'No exam marks found for this student' };

  let selectedExamId = String(fields.exam_id || '').trim();
  if (!selectedExamId || !exams.find((e) => String(e.id) === selectedExamId)) {
    selectedExamId = String(exams[0].id);
  }

  const selectedExam = exams.find((e) => String(e.id) === selectedExamId);
  let sidebar = `<div class="profile-nav col-sm-3"><section class="panel">
    <header class="panel-heading">Exam</header>
    <form class="cmxform form-horizontal tasi-form" id="signupForm" method="post">
    <ul class="nav nav-pills nav-stacked">`;
  for (const exam of exams) {
    const active = String(exam.id) === selectedExamId;
    sidebar += `<li class="${active ? 'active' : ''}"><a><label style="cursor:pointer;">
      <input name="exam_id" type="radio" value="${exam.id}" ${active ? 'checked' : ''} onclick="this.form.submit()" style="display:none;"/>
      &nbsp; &nbsp; ${exam.label}</label></a></li>`;
  }
  sidebar += '</ul></form></section></div>';

  const marksPanel = `<div class="col-sm-9"><section class="panel">
    <header class="panel-heading">${selectedExam?.label || ''} - Marks Statement</header>
    <div class="panel-body">${await buildMarksTable(ctx, selectedExamId)}</div>
  </section></div>`;

  return {
    html: sidebar + marksPanel,
    exams: exams.map((e) => ({ id: e.id, label: e.label })),
    selectedExamId: Number(selectedExamId),
  };
}

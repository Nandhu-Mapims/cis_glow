import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear } from '../fees/feeHelpers.js';

/** Legacy: /home/mapims/cis/cis/exam_dashboard.php */

function daySpan(fromTs, toTs) {
  if (!fromTs || !toTs || fromTs <= 0 || toTs <= 0) return '';
  const days = Math.floor((toTs - fromTs) / 86400) + 1;
  return `${days} day${days > 1 ? 's' : ''}`;
}

function tsFromDt(val) {
  if (!val || String(val).startsWith('0000-00-00')) return 0;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return 0;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(day.getTime() / 1000);
}

function sheetGroupKey(courseId, cyear, subjectId, scheduleId, markType) {
  return `${courseId}_${cyear}_${subjectId}_${scheduleId}_${markType}`;
}

function marksKey(registerNo, courseId, cyear, subjectId) {
  return `${registerNo}|${courseId}|${cyear}|${subjectId}`;
}

function buildLatestLogMap(logRows) {
  const bySheet = new Map();
  for (const row of logRows) {
    const id = String(row.foil_sheet_no);
    if (!bySheet.has(id)) bySheet.set(id, []);
    bySheet.get(id).push(row);
  }
  const latest = new Map();
  for (const [id, rows] of bySheet) {
    rows.sort((a, b) => tsFromDt(b.created_dt) - tsFromDt(a.created_dt));
    latest.set(id, rows);
  }
  return latest;
}

function pickLogEntry(logMap, sheetId, preferCompleted) {
  const rows = logMap.get(String(sheetId)) || [];
  if (!rows.length) return null;
  if (preferCompleted) {
    const completed = rows.find((r) => r.status === 'Completed');
    if (completed) return completed;
  }
  return rows[0];
}

async function queryRawInChunks(ids, buildSql, chunkSize = 400) {
  if (!ids.length) return [];
  const rows = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const part = await prisma.$queryRawUnsafe(buildSql(chunk));
    rows.push(...part);
  }
  return rows;
}

function groupRowsByExamName(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = String(row.exam_name);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

async function loadStudentsForRolls(rollSet, studentCache) {
  const missing = [...rollSet].filter((roll) => !studentCache.has(roll));
  if (missing.length) {
    const students = await queryRawInChunks(
      missing,
      (chunk) => `SELECT id, uregister_no, register_no, student_name, student_initial
       FROM student_profile_tb
       WHERE del = 1 AND register_no IN (${chunk.map((r) => `'${escapeSql(r)}'`).join(',')})`,
    );
    for (const student of students) {
      studentCache.set(student.register_no, student);
    }
  }
  const map = new Map();
  for (const roll of rollSet) {
    const student = studentCache.get(roll);
    if (student) map.set(roll, student);
  }
  return map;
}

async function loadSharedExamDashboardData(allSetups, scatOrder) {
  const examIds = allSetups.map((e) => String(e.id));
  if (!examIds.length) {
    return {
      schedules: [],
      allSheets: [],
      allMarksRows: [],
      batchRows: [],
      logMap: new Map(),
    };
  }

  const examIdList = examIds.map((id) => `'${escapeSql(id)}'`).join(',');

  const schedules = await prisma.$queryRawUnsafe(
    `SELECT IF(CAST(A.exam_date AS CHAR) LIKE '0000-00-00%', '', CAST(A.exam_date AS CHAR)) AS exam_date,
            A.exam_session, A.internal_max, A.viva_max, A.external_max,
            A.pass_mark, B.subject_id, B.subject_name, B.subject_category,
            B.rid, B.department,
            C.subject_id AS setup_subject_id, C.subject_name, C.short_subject_name, A.id, A.batch_no,
            A.course_id, A.current_year, A.exam_name, A.academic_year, A.academic_type,
            IF(CAST(A.created_dt AS CHAR) LIKE '0000-00-00%', '', CAST(A.created_dt AS CHAR)) AS created_dt,
            IF(CAST(A.updated_dt AS CHAR) LIKE '0000-00-00%', '', CAST(A.updated_dt AS CHAR)) AS updated_dt
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del = 1 AND B.del = 1 AND C.del = 1
       AND A.exam_name IN (${examIdList})
       AND C.academic_year = A.academic_year
       AND C.course_id = A.course_id
       AND C.semester_no = A.current_year
       AND C.subject_enable = 1
     ORDER BY A.exam_name ASC, A.course_id ASC, A.current_year ASC, C.subject_order ASC${scatOrder}`,
  );

  const [allSheets, batchRows, allMarksRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, exam_name, course_id, current_year, subject_id, schedule_id, mark_type, status, page_no,
              academic_year, academic_type,
              IF(CAST(created_dt AS CHAR) LIKE '0000-00-00%', '', CAST(created_dt AS CHAR)) AS created_dt,
              IF(CAST(updated_dt AS CHAR) LIKE '0000-00-00%', '', CAST(updated_dt AS CHAR)) AS updated_dt
       FROM cia_omr_sheet_tb
       WHERE del = 1 AND exam_name IN (${examIdList})
       ORDER BY exam_name ASC, page_no ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT course_id, current_year, academic_year, academic_type,
              GROUP_CONCAT(roll_no SEPARATOR ',') AS rolls
       FROM cia_batch_tb
       WHERE del = 1
       GROUP BY academic_year, academic_type, course_id, current_year`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT register_no, subject_id, course_id, current_year, exam_name, t_marks, p_status,
              academic_year, academic_type
       FROM cia_marks_tb
       WHERE del = 1 AND exam_name IN (${examIdList})`,
    ),
  ]);

  const sheetIds = allSheets.map((s) => s.id);
  const logRows = sheetIds.length ? await queryRawInChunks(
    sheetIds,
    (chunk) => `SELECT foil_sheet_no, status,
            IF(CAST(created_dt AS CHAR) LIKE '0000-00-00%', '', CAST(created_dt AS CHAR)) AS created_dt
     FROM cia_omr_log_tb
     WHERE del = 1 AND foil_sheet_no IN (${chunk.map((id) => `'${escapeSql(String(id))}'`).join(',')})
     ORDER BY created_dt DESC`,
  ) : [];

  return {
    schedules,
    allSheets,
    allMarksRows,
    batchRows,
    logMap: buildLatestLogMap(logRows),
  };
}

async function sliceGroupData(shared, ac, exams, courses, studentCache) {
  const examIdSet = new Set(exams.map((e) => String(e.id)));
  const courseIdSet = new Set(courses.map((c) => String(c.id)));
  const matchesAc = (row) => row.academic_year === ac.academic_year && row.academic_type === ac.academic_type;
  const matchesCourse = (row) => courseIdSet.has(String(row.course_id));

  const schedules = shared.schedules.filter(
    (row) => matchesAc(row) && examIdSet.has(String(row.exam_name)) && matchesCourse(row),
  );
  const sheets = shared.allSheets.filter(
    (row) => matchesAc(row) && examIdSet.has(String(row.exam_name)) && matchesCourse(row),
  );
  const marksRows = shared.allMarksRows.filter(
    (row) => matchesAc(row) && examIdSet.has(String(row.exam_name)) && matchesCourse(row),
  );

  const batchesByKey = new Map();
  const allRolls = new Set();
  for (const row of shared.batchRows) {
    if (!matchesAc(row) || !matchesCourse(row)) continue;
    const key = `${row.course_id}_${row.current_year}`;
    const rolls = String(row.rolls || '').split(',').map((r) => r.trim()).filter(Boolean);
    batchesByKey.set(key, rolls);
    rolls.forEach((r) => allRolls.add(r));
  }

  const studentsByRoll = new Map();
  for (const roll of allRolls) {
    const student = studentCache.get(roll);
    if (student) studentsByRoll.set(roll, student);
  }

  return {
    schedulesByExam: groupRowsByExamName(schedules),
    sheetsByExam: groupRowsByExamName(sheets),
    marksByExam: groupRowsByExamName(marksRows),
    logMap: shared.logMap,
    batchesByKey,
    studentsByRoll,
  };
}

function buildExamContext(setup, groupData, courses, typeRows, deptRows) {
  const examOptions = {};
  if (setup.exam_internal === 1) examOptions.I = 'I';
  if (setup.exam_viva === 1) examOptions.V = 'V';
  if (setup.exam_external === 1) examOptions.E = 'E';

  const examId = String(setup.id);
  const schedules = groupData.schedulesByExam.get(examId) || [];
  const sheets = groupData.sheetsByExam.get(examId) || [];
  const marksRows = groupData.marksByExam.get(examId) || [];

  const sheetsByKey = new Map();
  for (const sheet of sheets) {
    const key = sheetGroupKey(sheet.course_id, sheet.current_year, sheet.subject_id, sheet.schedule_id, sheet.mark_type);
    if (!sheetsByKey.has(key)) sheetsByKey.set(key, []);
    sheetsByKey.get(key).push(sheet);
  }

  const marksMap = new Map();
  for (const row of marksRows) {
    marksMap.set(marksKey(row.register_no, String(row.course_id), String(row.current_year), String(row.subject_id)), row);
  }

  return {
    setup,
    examOptions,
    courses,
    schedules,
    sheetsByKey,
    logMap: groupData.logMap,
    marksMap,
    batchesByKey: groupData.batchesByKey,
    studentsByRoll: groupData.studentsByRoll,
    subjectTypeArray: Object.fromEntries(typeRows.map((r) => [String(r.id), r.category_name])),
    scatOrder: '',
    typeRows,
    deptRows,
  };
}

function computeSheetStatus(ctx) {
  const stat = {
    t_subject: [],
    t_qr_subject: 0,
    t_qr_subject_print: 0,
    qr_not_printed: 0,
    t_qr_sheet_print: 0,
    Completed: 0,
    Error: 0,
    Printed: 0,
    sf_time: 0,
    st_time: 0,
    qf_time: 0,
    qt_time: 0,
    uf_time: 0,
    ut_time: 0,
    ef_time: 0,
    et_time: 0,
  };
  if (!ctx) return stat;

  const schedulesByCourseYear = new Map();
  for (const row of ctx.schedules) {
    const key = `${row.course_id}_${row.current_year}`;
    if (!schedulesByCourseYear.has(key)) schedulesByCourseYear.set(key, []);
    schedulesByCourseYear.get(key).push(row);
  }

  for (const course of ctx.courses) {
    for (let cyear = 1; cyear <= Number(course.total_semester) || 0; cyear += 1) {
      const scheduleRows = schedulesByCourseYear.get(`${course.id}_${cyear}`) || [];
      for (const row of scheduleRows) {
        const maxMarks = { I: row.internal_max, V: row.viva_max, E: row.external_max };
        stat.t_subject.push(`${course.id}_${cyear}_${row.subject_id}`);

        const cCreated = tsFromDt(row.created_dt);
        const cUpdated = tsFromDt(row.updated_dt);
        if (cCreated) {
          if (!stat.sf_time || stat.sf_time > cCreated) stat.sf_time = cCreated;
          if (!stat.st_time || stat.st_time < cCreated) stat.st_time = cCreated;
        }
        if (cUpdated && (!stat.st_time || stat.st_time < cUpdated)) stat.st_time = cUpdated;

        for (const [, marksType] of Object.entries(ctx.examOptions)) {
          if (Number(maxMarks[marksType] || 0) <= 0) continue;
          stat.t_qr_subject += 1;

          const sheetList = ctx.sheetsByKey.get(
            sheetGroupKey(String(course.id), String(cyear), row.subject_id, row.id, marksType),
          ) || [];

          if (!sheetList.length) {
            stat.qr_not_printed += 1;
            continue;
          }

          stat.t_qr_subject_print += 1;
          for (const sheet of sheetList) {
            const sCreated = tsFromDt(sheet.created_dt);
            const sUpdated = tsFromDt(sheet.updated_dt);
            if (sCreated) {
              if (!stat.qf_time || stat.qf_time > sCreated) stat.qf_time = sCreated;
              if (!stat.qt_time || stat.qt_time < sCreated) stat.qt_time = sCreated;
            }

            let statusStr = sheet.status === 1 ? 'Completed' : 'Error';
            if (sheet.status === 1 && sUpdated) {
              if (!stat.uf_time || stat.uf_time > sUpdated) stat.uf_time = sUpdated;
              if (!stat.ut_time || stat.ut_time < sUpdated) stat.ut_time = sUpdated;
            }

            const logEntry = pickLogEntry(ctx.logMap, sheet.id, statusStr === 'Completed');
            if (logEntry?.created_dt) {
              const eUpdated = tsFromDt(logEntry.created_dt);
              if (eUpdated) {
                if (!stat.ef_time || stat.ef_time > eUpdated) stat.ef_time = eUpdated;
                if (!stat.et_time || stat.et_time < eUpdated) stat.et_time = eUpdated;
              }
            } else {
              statusStr = 'Printed';
            }

            stat.t_qr_sheet_print += 1;
            stat[statusStr] = (stat[statusStr] || 0) + 1;
          }
        }
      }
    }
  }

  return stat;
}

function buildAnalysisHtml(ctx) {
  const panelCol = 'col-12 col-md-6 col-xl-4';
  let finalExamStatus = `<div class="${panelCol}">
   <section class="panel exam-dashboard-panel">
   <header class="panel-heading"><strong>Analysis</strong></header>
   <div class="panel-body exam-dashboard-panel__body">
   <table class="table table-bordered exam-dashboard-table mb-0">
   <thead><tr>
   <th width="50%">Year</th><th width="10%">#T</th><th width="10%">Pass</th>
   <th width="10%">Fail</th><th width="10%">AB</th><th width="10%">Highest</th></tr></thead><tbody>`;

  if (!ctx) {
    return `${finalExamStatus}</tbody></table></div></section></div>`;
  }

  const departmentAnalysis = {};
  let deptMaxYear = 0;
  let refCourseName = ctx.setup.course_name;

  const schedulesByCourseYear = new Map();
  for (const row of ctx.schedules) {
    const key = `${row.course_id}_${row.current_year}`;
    if (!schedulesByCourseYear.has(key)) schedulesByCourseYear.set(key, []);
    schedulesByCourseYear.get(key).push(row);
  }

  for (const course of ctx.courses) {
    let deptShort = String(course.department_short_name || '').trim();
    if (deptShort && deptShort !== '-') deptShort = ` - ${deptShort}`;
    else deptShort = '';
    const refDegreeName = `${course.degree_name}${deptShort}`;
    refCourseName = course.course_name;

    finalExamStatus += `<tr><td bgcolor="#F4F4F4" colspan="6">${refDegreeName}</td></tr>`;
    if (deptMaxYear < Number(course.total_semester)) {
      deptMaxYear = Number(course.total_semester);
    }

    for (let cyear = 1; cyear <= Number(course.total_semester) || 0; cyear += 1) {
      const scheduleRows = schedulesByCourseYear.get(`${course.id}_${cyear}`) || [];
      const subjectIdList = {};
      for (const row of scheduleRows) {
        const rid = String(row.rid);
        const subId = String(row.subject_id);
        const tmark = Number(row.internal_max) + Number(row.viva_max) + Number(row.external_max);
        if (!subjectIdList[rid]) {
          subjectIdList[rid] = {
            name: row.subject_name,
            sname: row.short_subject_name || row.subject_name,
            exam: {},
            tmark: 0,
            FAIL: 0,
            AB: 0,
            PASS: 0,
          };
        }
        subjectIdList[rid].exam[subId] = {
          tmark,
          pmark: row.pass_mark,
          dept: String(row.department || '').split(',').filter(Boolean),
        };
      }

      let totalNoOfSubject = 0;
      let totalSubjectMarks = 0;
      for (const entry of Object.values(subjectIdList)) {
        let tmark = 0;
        for (const ex of Object.values(entry.exam)) tmark += ex.tmark;
        entry.tmark = tmark;
        totalSubjectMarks += tmark;
        totalNoOfSubject += 1;
      }

      const rollList = ctx.batchesByKey.get(`${course.id}_${cyear}`) || [];
      if (!rollList.length) continue;

      const students = rollList.map((roll) => ctx.studentsByRoll.get(roll)).filter(Boolean);
      const studentPassStatus = { PASS: 0, FAIL: 0, AB: 0, NONE: 0 };
      const studentTotalMarks = {};

      for (const stu of students) {
        const registerNo = stu.register_no;
        let overallTotal = 0;
        const overallResult = { NONE: 0, FAIL: 0, AB: 0, PASS: 0 };

        for (const [, rsub] of Object.entries(subjectIdList)) {
          const rStatus = {};
          let cStatus = 0;
          for (const [subId, subDetails] of Object.entries(rsub.exam)) {
            const marks = ctx.marksMap.get(marksKey(registerNo, String(course.id), String(cyear), subId));
            if (marks?.p_status) {
              if (String(marks.t_marks).toLowerCase() !== 'a') {
                overallTotal += Number(marks.t_marks) || 0;
              }
              rStatus[marks.p_status] = (rStatus[marks.p_status] || 0) + 1;
            } else {
              rStatus.NONE = (rStatus.NONE || 0) + 1;
            }
            cStatus += 1;
            for (const dId of subDetails.dept) {
              if (!departmentAnalysis[dId]) departmentAnalysis[dId] = {};
              if (!departmentAnalysis[dId][cyear]) departmentAnalysis[dId][cyear] = { appear: 0, pass: 0 };
              departmentAnalysis[dId][cyear].appear += 1;
              if (marks?.p_status === 'PASS') departmentAnalysis[dId][cyear].pass += 1;
            }
          }

          if ((rStatus.NONE || 0) > 0) overallResult.NONE += 1;
          else if ((rStatus.FAIL || 0) > 0) overallResult.FAIL += 1;
          else if ((rStatus.AB || 0) === cStatus) overallResult.AB += 1;
          else if ((rStatus.PASS || 0) === cStatus) overallResult.PASS += 1;
          else overallResult.FAIL += 1;
        }

        studentTotalMarks[overallTotal] = studentTotalMarks[overallTotal] || [];
        studentTotalMarks[overallTotal].push(stu.id);

        if (overallResult.NONE > 0) {
          studentPassStatus.FAIL += 1;
          studentPassStatus.NONE += 1;
        } else if (overallResult.FAIL > 0) studentPassStatus.FAIL += 1;
        else if (overallResult.AB > 0) studentPassStatus.AB += 1;
        else if (overallResult.PASS === totalNoOfSubject) studentPassStatus.PASS += 1;
        else studentPassStatus.FAIL += 1;
      }

      const totalNoOfStudent = students.length;
      let topMark = '';
      const markKeysSorted = Object.keys(studentTotalMarks).map(Number).sort((a, b) => b - a);
      if (markKeysSorted.length) topMark = `${markKeysSorted[0]}/${totalSubjectMarks}`;

      const yearLabel = convertNYear(cyear, refCourseName);
      if (studentPassStatus.NONE === 0) {
        finalExamStatus += `<tr><td height="35">${yearLabel} Year</td>
          <td class="text-right">${totalNoOfStudent}</td>
          <td class="text-right">${studentPassStatus.PASS}</td>
          <td class="text-right">${studentPassStatus.FAIL}</td>
          <td class="text-right">${studentPassStatus.AB}</td>
          <td class="text-right">${topMark}</td></tr>`;
      } else {
        finalExamStatus += `<tr><td height="35">${yearLabel} Year</td>
          <td class="text-right">${totalNoOfStudent}</td><td></td><td></td><td></td><td></td></tr>`;
      }
    }
  }

  finalExamStatus += '</tbody></table></div></section></div>';

  let deptStatus = `<div class="${panelCol}">
   <section class="panel exam-dashboard-panel">
   <header class="panel-heading"><strong>Department Analysis</strong></header>
   <div class="panel-body exam-dashboard-panel__body">
   <table class="table table-bordered exam-dashboard-table mb-0"><thead><tr><th width="50%">Department</th>`;
  for (let y = 1; y <= deptMaxYear; y += 1) {
    deptStatus += `<th width="10%">${convertNYear(y, refCourseName)} </th>`;
  }
  deptStatus += '</tr></thead><tbody>';

  for (const dept of ctx.deptRows || []) {
    const analysis = departmentAnalysis[String(dept.id)];
    if (!analysis || !Object.keys(analysis).length) continue;
    deptStatus += `<tr><td><div style="white-space:nowrap;overflow:hidden;width:150px;text-overflow:ellipsis;font-size:12px;">${dept.name}</div></td>`;
    for (let y = 1; y <= deptMaxYear; y += 1) {
      const pass = analysis[y]?.pass || 0;
      const appear = analysis[y]?.appear || 0;
      const pct = appear > 0 ? Math.round((pass / appear) * 10000) / 100 : '';
      deptStatus += `<td class="text-right">${pct}</td>`;
    }
    deptStatus += '</tr>';
  }
  deptStatus += '</tbody></table></div></section></div>';

  return finalExamStatus + deptStatus;
}

function buildExamBlockFromContext(ctx, exam, ac, examNameMap, now) {
  const getStat = computeSheetStatus(ctx);
  const uniqueSubjects = [...new Set(getStat.t_subject || [])];
  if (!uniqueSubjects.length) return '';

  const examLabel = examNameMap[String(exam.exam_name)] || exam.exam_name;
  const totalScheduleDays = daySpan(getStat.sf_time, getStat.st_time);
  const totalQrDays = daySpan(getStat.qf_time, getStat.qt_time);
  let totalNuploadDays = '';
  if (getStat.qf_time > 0) {
    const days = Math.floor((now - getStat.qf_time) / 86400) + 1;
    totalNuploadDays = `${days} day${days > 1 ? 's' : ''}`;
  }
  const totalUploadDays = daySpan(getStat.uf_time, getStat.ut_time);
  const totalErrorDays = daySpan(getStat.ef_time, getStat.et_time);

  const acTypeLabel = ac.academic_type.replace(/^./, (c) => c.toUpperCase());
  const blockTitle = `${examLabel} | ${ac.course_name} | ${ac.academic_year} | ${acTypeLabel}`;
  const panelCol = 'col-12 col-md-6 col-xl-4';

  let html = `<div class="exam-dashboard-block">
    <div class="exam-dashboard-block__header">
      <h4 class="exam-dashboard-block__title">${blockTitle}</h4>
    </div>
    <div class="row g-3 exam-dashboard-panels">`;
  html += `<div class="${panelCol}"><section class="panel exam-dashboard-panel">
        <header class="panel-heading"><strong>Exam</strong></header>
        <div class="panel-body exam-dashboard-panel__body"><table class="table table-bordered exam-dashboard-table mb-0">
        <thead><tr><th></th><th class="text-end">#T</th><th>Days</th></tr></thead><tbody>
        <tr><td>Total Subjects</td><td class="text-end">${uniqueSubjects.length}</td><td>${totalScheduleDays}</td></tr>
        <tr><td>Total QR Subjects</td><td class="text-end">${getStat.t_qr_subject || 0}</td><td>${totalScheduleDays}</td></tr>
        <tr><td>Total QR Printed Subjects</td><td class="text-end">${getStat.t_qr_subject_print || 0}</td><td>${totalQrDays}</td></tr>
        <tr><td>Total QR Not Printed Subjects</td><td class="text-end">${getStat.qr_not_printed || 0}</td><td></td></tr>
        <tr><td>Printed QR Sheets</td><td class="text-end">${getStat.t_qr_sheet_print || 0}</td><td>${totalQrDays}</td></tr>
        <tr><td>Upload Completed Sheets</td><td class="text-end">${getStat.Completed || 0}</td><td>${totalUploadDays}</td></tr>
        <tr><td>Upload Mistake Sheets</td><td class="text-end">${getStat.Error || 0}</td><td>${(getStat.Printed || 0) > 0 ? totalErrorDays : ''}</td></tr>
        <tr><td>Upload Not Yet Process</td><td class="text-end">${getStat.Printed || 0}</td><td>${(getStat.Printed || 0) > 0 ? totalNuploadDays : ''}</td></tr>
        </tbody></table></div></section></div>`;
  html += buildAnalysisHtml(ctx);
  html += '</div></div>';
  return html;
}

export async function buildExamDashboardHtml() {
  const [examNames, acyearRows, typeRows, deptRows, allSetups] = await Promise.all([
    prisma.cia_exam_name.findMany({
      where: { del: 1 },
      orderBy: { exam_order: 'asc' },
      select: { id: true, exam_name: true },
    }),
    prisma.$queryRawUnsafe(
      `SELECT DISTINCT course_name, academic_type, academic_year
       FROM cia_setup WHERE del = 1 AND exam_status = 0
       ORDER BY academic_year DESC`,
    ),
    prisma.subject_master.findMany({
      where: { del: 1, category: 'Type' },
      orderBy: { category_order: 'asc' },
      select: { id: true, category_name: true },
    }),
    prisma.staff_dept_master.findMany({
      where: { del: 1 },
      orderBy: { d_order: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.$queryRawUnsafe(
      `SELECT id, exam_name, course_name, academic_year, academic_type,
              exam_internal, exam_viva, exam_external
       FROM cia_setup
       WHERE del = 1 AND exam_status = 0
       ORDER BY id ASC`,
    ),
  ]);

  const scatOrder = typeRows.length
    ? `, FIELD(B.subject_category, ${typeRows.map((r) => `'${escapeSql(String(r.id))}'`).join(',')})`
    : '';
  const examNameMap = Object.fromEntries(examNames.map((e) => [String(e.id), e.exam_name]));
  const setupById = new Map(allSetups.map((row) => [String(row.id), row]));
  const courseCache = new Map();
  const studentCache = new Map();
  const now = Math.floor(Date.now() / 1000);

  const courseNames = [...new Set(acyearRows.map((row) => row.course_name))];
  if (courseNames.length) {
    const allCourses = await prisma.basic_setup_course_tb.findMany({
      where: { del: 1, course_name: { in: courseNames } },
      select: {
        id: true,
        total_semester: true,
        degree_name: true,
        department_short_name: true,
        course_name: true,
      },
    });
    for (const course of allCourses) {
      const list = courseCache.get(course.course_name) || [];
      list.push(course);
      courseCache.set(course.course_name, list);
    }
  }

  const shared = await loadSharedExamDashboardData(allSetups, scatOrder);

  const allRolls = new Set();
  for (const row of shared.batchRows) {
    String(row.rolls || '').split(',').forEach((roll) => {
      const trimmed = roll.trim();
      if (trimmed) allRolls.add(trimmed);
    });
  }
  await loadStudentsForRolls(allRolls, studentCache);

  const groupHtml = [];
  for (const ac of acyearRows) {
    const exams = allSetups.filter(
      (row) => row.course_name === ac.course_name
        && row.academic_year === ac.academic_year
        && row.academic_type === ac.academic_type,
    );
    if (!exams.length) continue;

    const courses = courseCache.get(ac.course_name) || [];
    const groupData = await sliceGroupData(shared, ac, exams, courses, studentCache);

    let block = '';
    for (const exam of exams) {
      const setup = setupById.get(String(exam.id));
      if (!setup) continue;
      const ctx = buildExamContext(setup, groupData, courses, typeRows, deptRows);
      block += buildExamBlockFromContext(ctx, exam, ac, examNameMap, now);
    }
    if (block) groupHtml.push(block);
  }

  return groupHtml.join('');
}

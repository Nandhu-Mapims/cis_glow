import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { logExamSetup } from '../setup/setupAudit.js';
import { ciaExamNameSelect, ciaSetupSelect } from '../../../utils/legacySelects.js';
import {
  buildPrintHeader,
  loadAcademicConfig,
  loadBatchRollNumbers,
  loadCourseSemesterOptions,
  loadStudentsByRollNumbers,
  parseCourseSemesterKey,
  resolveExamContext,
} from '../setup/examSetupShared.js';

const PAGE = 'term_report_analysis_v1.php';

async function loadExamNameMap() {
  const rows = await prisma.cia_exam_name.findMany({
    where: { del: 1 },
    orderBy: { exam_order: 'asc' },
    select: ciaExamNameSelect,
  });
  const map = {};
  for (const row of rows) {
    map[row.id] = `${row.exam_name}${row.exam_month ? ` (${row.exam_month})` : ''}`;
  }
  return map;
}

function academicYearFilterSql(academicYearArray) {
  const years = [
    academicYearArray['U.G']?.regular,
    academicYearArray['U.G']?.additional,
    academicYearArray['P.G']?.regular,
    ...(academicYearArray.EXAM || []),
  ].filter(Boolean);
  if (!years.length) return '';
  return ` AND (${years.map((y) => `academic_year='${escapeSql(y)}'`).join(' OR ')})`;
}

async function loadAnalysisV1ExamOptions() {
  const academicYearArray = await loadAcademicConfig();
  const examNameMap = await loadExamNameMap();
  const yearFilter = academicYearFilterSql(academicYearArray);
  const courseRows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC',
  );
  const options = [];
  for (const { course_name: courseName } of courseRows) {
    for (const [atype, alabel] of [['regular', 'Regular'], ['additional', 'Additional']]) {
      if (atype === 'additional' && courseName !== 'U.G') continue;
      const yearRows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT academic_year FROM cia_setup WHERE del=1 AND course_name='${escapeSql(courseName)}' AND academic_type='${escapeSql(atype)}'${yearFilter} ORDER BY academic_year DESC`,
      );
      for (const row of yearRows) {
        const acYear = row.academic_year;
        const examRows = await prisma.cia_setup.findMany({
          where: { del: 1, course_name: courseName, academic_year: acYear, academic_type: atype },
          orderBy: { id: 'asc' },
          select: ciaSetupSelect,
        });
        if (!examRows.length) continue;
        for (const exam of examRows) {
          options.push({
            value: String(exam.id),
            label: examNameMap[Number(exam.exam_name)] || String(exam.exam_name),
            group: `${courseName} | ${acYear} (${alabel})`,
          });
        }
      }
    }
  }
  return options;
}

async function loadSubjectTypeMap() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT id, category_name FROM subject_master WHERE del=1 AND category='Type' ORDER BY category_order ASC",
  );
  const map = {};
  const orderIds = [];
  for (const row of rows) {
    map[row.id] = row.category_name;
    orderIds.push(row.id);
  }
  return { map, orderIds };
}

async function loadSubjectGroups(ctx, courseId, semester) {
  const { map: subjectTypeMap, orderIds } = await loadSubjectTypeMap();
  const fieldOrder = orderIds.length
    ? `, FIELD(B.subject_category,${orderIds.join(',')})`
    : '';

  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.internal_max, A.viva_max, A.external_max, A.pass_mark,
            B.subject_id, B.subject_name, B.subject_category, B.rid,
            C.subject_name AS main_name, C.short_subject_name
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del=1 AND B.del=1
       AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND A.current_year='${semester}'
       AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND A.course_id='${courseId}'
       AND A.exam_name='${ctx.examSetupId}'
       AND C.del=1 AND C.academic_year='${escapeSql(ctx.academicYear)}'
       AND C.course_id='${courseId}'
       AND C.semester_no='${semester}'
       AND C.subject_enable=1
     ORDER BY C.subject_order+0 ASC${fieldOrder}`,
  );

  const groups = {};
  for (const row of rows) {
    const rid = row.rid;
    const subId = String(row.subject_id);
    const tmark = (Number(row.internal_max) || 0) + (Number(row.viva_max) || 0) + (Number(row.external_max) || 0);
    const scat = subjectTypeMap[Number(row.subject_category)] || '';
    const sname = String(row.short_subject_name || row.main_name || row.subject_name || subId);

    if (!groups[rid]) {
      groups[rid] = {
        rid,
        name: String(row.main_name || row.subject_name),
        sname,
        tmark: 0,
        exam: {},
        PASS: 0, FAIL: 0, AB: 0, NA: 0, NONE: 0, DIST: 0, FIRST: 0, TOTAL: 0,
        topper: {},
      };
    }
    groups[rid].exam[subId] = {
      id: subId,
      pmark: Number(row.pass_mark) || 0,
      tmark,
      cat: scat,
    };
    groups[rid].tmark += tmark;
  }
  return { groups, subjectOrder: Object.keys(groups) };
}

async function loadMarksMap(ctx, courseId, semester) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT register_no, subject_id, t_marks, p_status
     FROM cia_marks_tb
     WHERE del=1 AND exam_name='${ctx.examSetupId}'
       AND course_id='${courseId}'
       AND academic_year='${escapeSql(ctx.academicYear)}'
       AND current_year='${semester}'
       AND academic_type='${escapeSql(ctx.academicType)}'`,
  );
  const map = {};
  for (const row of rows) {
    map[`${row.register_no}::${row.subject_id}`] = row;
  }
  return map;
}

function buildCategoryParts(group) {
  const parts = {};
  for (const sub of Object.values(group.exam)) {
    const scat = sub.cat;
    if (!parts[scat]) parts[scat] = [];
    parts[scat].push(sub.id);
  }
  return parts;
}

function evaluateSubjectForStudent(group, registerNo, marksMap) {
  const categoryParts = buildCategoryParts(group);
  const rStatus = {};
  let cTotal = 0;

  for (const [scat, subIds] of Object.entries(categoryParts)) {
    const tRStatus = {};
    let tCStatus = 0;
    let tCTotal = 0;
    let lastPassMark = 0;

    for (const subId of subIds) {
      const marks = marksMap[`${registerNo}::${subId}`];
      lastPassMark = group.exam[subId]?.pmark || 0;
      const pStatus = marks?.p_status || '';
      const tMarks = marks?.t_marks ?? '';
      if (pStatus) {
        const lower = String(tMarks).toLowerCase();
        if (lower !== 'a' && lower !== 'na') {
          cTotal += Number(tMarks) || 0;
          tCTotal += Number(tMarks) || 0;
        }
        tRStatus[pStatus] = (tRStatus[pStatus] || 0) + 1;
      } else {
        tRStatus.NONE = (tRStatus.NONE || 0) + 1;
      }
      tCStatus += 1;
    }

    let pStatus = '';
    if ((tRStatus.NONE || 0) > 0) {
      rStatus.NONE = (rStatus.NONE || 0) + 1;
    } else if ((tRStatus.NA || 0) > 0) {
      rStatus.NA = (rStatus.NA || 0) + 1;
      pStatus = 'NA';
      tCTotal = 'NA';
    } else if (tCStatus === (tRStatus.AB || 0)) {
      rStatus.AB = (rStatus.AB || 0) + 1;
      pStatus = 'AB';
      tCTotal = 'AB';
    } else if (Number(tCTotal) >= lastPassMark) {
      rStatus.PASS = (rStatus.PASS || 0) + 1;
      pStatus = 'PASS';
    } else {
      rStatus.FAIL = (rStatus.FAIL || 0) + 1;
      pStatus = 'FAIL';
    }
    void scat;
    void pStatus;
  }

  const cStatus = Object.keys(categoryParts).length;
  let pLabel = '-';
  if ((rStatus.NONE || 0) > 0) {
    pLabel = '--';
  } else if ((rStatus.NA || 0) > 0) {
    pLabel = 'NA';
  } else if ((rStatus.FAIL || 0) > 0) {
    pLabel = 'FAIL';
  } else if ((rStatus.AB || 0) === cStatus) {
    pLabel = 'AB';
  } else if ((rStatus.PASS || 0) === cStatus) {
    pLabel = 'PASS';
  } else {
    pLabel = 'FAIL';
  }

  return { pLabel, cTotal, rStatus, cStatus };
}

async function buildAnalysisReport(ctx, courseSel) {
  const { groups, subjectOrder } = await loadSubjectGroups(ctx, courseSel.courseId, courseSel.semester);
  const totalSubjects = subjectOrder.length;
  const totalSubjectMarks = subjectOrder.reduce((sum, rid) => sum + (groups[rid].tmark || 0), 0);
  const marksMap = await loadMarksMap(ctx, courseSel.courseId, courseSel.semester);
  const rolls = await loadBatchRollNumbers(
    courseSel.courseId, ctx.academicYear, courseSel.semester, ctx.academicType,
  );
  const students = await loadStudentsByRollNumbers(rolls);

  const studentRegno = {};
  const studentTotalMarks = {};
  const studentPassStatus = { PASS: 0, FAIL: 0, AB: 0, NA: 0, NONE: 0 };
  const studentFailList = {};
  const studentFailSubjectList = {};

  for (const stu of students) {
    const registerNo = stu.registerNo;
    let overallTotal = 0;
    const overallResult = { NONE: 0, FAIL: 0, AB: 0, PASS: 0, NA: 0 };

    for (const rid of subjectOrder) {
      const group = groups[rid];
      const { pLabel, cTotal, rStatus, cStatus } = evaluateSubjectForStudent(group, registerNo, marksMap);

      if (pLabel === '--') {
        overallResult.NONE += 1;
        group.NONE += 1;
      } else if (pLabel === 'NA') {
        group.NA += 1;
        overallResult.PASS += 1;
      } else if (pLabel === 'FAIL') {
        overallResult.FAIL += 1;
        group.FAIL += 1;
        if (!studentFailSubjectList[stu.registerNo]) studentFailSubjectList[stu.registerNo] = { fail: '' };
        studentFailSubjectList[stu.registerNo].fail += `${group.sname}-${cTotal},`;
      } else if (pLabel === 'AB') {
        overallResult.AB += 1;
        group.AB += 1;
      } else if (pLabel === 'PASS') {
        overallResult.PASS += 1;
        group.PASS += 1;
        const mpre = group.tmark ? Math.round((cTotal / group.tmark) * 10000) / 100 : 0;
        if (mpre >= 75) group.DIST += 1;
        else if (mpre >= 60) group.FIRST += 1;
        if (!group.topper[cTotal]) group.topper[cTotal] = [];
        group.topper[cTotal].push(stu.registerNo);
      } else {
        overallResult.FAIL += 1;
        group.FAIL += 1;
        if (!studentFailSubjectList[stu.registerNo]) studentFailSubjectList[stu.registerNo] = { fail: '' };
        studentFailSubjectList[stu.registerNo].fail += `${group.sname}-${cTotal},`;
      }

      if (pLabel !== 'NA' && pLabel !== '--') group.TOTAL += 1;
      overallTotal += Number(cTotal) || 0;
      void rStatus;
      void cStatus;
    }

    if (!studentTotalMarks[overallTotal]) studentTotalMarks[overallTotal] = [];
    studentTotalMarks[overallTotal].push(stu.registerNo);

    studentRegno[stu.registerNo] = {
      name: stu.name,
      rno: stu.uregisterNo || stu.registerNo,
      result: '',
    };

    if (overallResult.NA > 0 && overallResult.FAIL === 0 && overallResult.NONE === 0
      && overallResult.PASS === 0 && overallResult.AB === 0) {
      studentPassStatus.NA += 1;
    } else if (overallResult.NONE > 0 && overallResult.FAIL === 0 && overallResult.NA === 0
      && overallResult.PASS === 0 && overallResult.AB === 0) {
      studentPassStatus.NONE += 1;
    } else if (overallResult.NONE > 0 || overallResult.NA > 0) {
      studentPassStatus.FAIL += 1;
    } else if (overallResult.FAIL > 0) {
      studentPassStatus.FAIL += 1;
      studentFailList[stu.registerNo] = overallTotal;
    } else if (overallResult.AB > 0 && overallResult.FAIL === 0
      && overallResult.NONE === 0 && overallResult.NA === 0) {
      studentPassStatus.AB += 1;
    } else if (overallResult.PASS === totalSubjects) {
      studentRegno[stu.registerNo].result = 'PASS';
      studentPassStatus.PASS += 1;
    } else {
      studentPassStatus.FAIL += 1;
      studentFailList[stu.registerNo] = '';
    }
  }

  const subjectColumns = subjectOrder.map((rid) => ({
    rid,
    sname: groups[rid].sname,
    stats: groups[rid],
  }));

  const statRows = [
    { label: 'Total Number of Students', key: 'TOTAL' },
    { label: 'Number of Students Passed', key: 'PASS' },
    { label: 'Number of Students Failed', key: 'FAIL' },
    { label: 'Absentees', key: 'AB' },
    { label: 'Distinction', key: 'DIST' },
    { label: 'First Class', key: 'FIRST' },
    { label: 'Pass %', key: 'PASS_PCT' },
  ];

  const tableRows = statRows.map((row) => {
    const cells = subjectColumns.map((col) => {
      const g = col.stats;
      if (row.key === 'PASS_PCT') {
        return g.TOTAL > 0 ? Math.round((g.PASS / g.TOTAL) * 10000) / 100 : 0;
      }
      return g[row.key] || 0;
    });
    return { label: row.label, cells, isPercent: row.key === 'PASS_PCT' };
  });

  let totPassPre = 0;
  let totPCount = 0;
  for (const col of subjectColumns) {
    if (col.stats.TOTAL > 0) {
      totPassPre += Math.round((col.stats.PASS / col.stats.TOTAL) * 10000) / 100;
      totPCount += 1;
    }
  }
  const overallPassPct = totPCount > 0 ? Math.round((totPassPre / totPCount) * 100) / 100 : 0;

  const toppers = [];
  const sortedTotals = Object.keys(studentTotalMarks).map(Number).sort((a, b) => b - a);
  let rank = 1;
  for (const tmarks of sortedTotals) {
    if (tmarks <= 0) continue;
    let rankCount = 0;
    for (const regNo of studentTotalMarks[tmarks]) {
      if (studentRegno[regNo]?.result === 'PASS') {
        toppers.push({
          rank,
          registerNo: studentRegno[regNo].rno,
          marks: tmarks,
          totalMarks: totalSubjectMarks,
          name: studentRegno[regNo].name,
        });
        rankCount += 1;
      }
    }
    if (rankCount > 0) rank += 1;
    if (rank > 3) break;
  }

  const subjectToppers = [];
  for (const rid of subjectOrder) {
    const group = groups[rid];
    const topperMarks = Object.keys(group.topper).map(Number).sort((a, b) => b - a);
    if (!topperMarks.length) continue;
    const topMark = topperMarks[0];
    const entries = (group.topper[topMark] || []).map((regNo) => ({
      subjectName: group.name,
      registerNo: studentRegno[regNo]?.rno || regNo,
      marks: topMark,
      totalMarks: group.tmark,
      name: studentRegno[regNo]?.name || regNo,
    }));
    subjectToppers.push(...entries);
  }

  const failedStudents = Object.entries(studentFailList).map(([regNo, marks], index) => ({
    sno: index + 1,
    registerNo: studentRegno[regNo]?.rno || regNo,
    name: studentRegno[regNo]?.name || regNo,
    marks: marks === '' ? '' : `${marks}/${totalSubjectMarks}`,
    failedSubjects: (studentFailSubjectList[regNo]?.fail || '').replace(/,$/, ''),
  }));

  const courseLabel = `${convertNYear(courseSel.semester, ctx.courseName)} - ${ctx.examNameLabel}`;

  return {
    headerTitle: `Result Analysis : ${ctx.academicYear}`,
    headerSubtitle: `${ctx.examNameLabel} - ${courseLabel} - ${ctx.academicType}`,
    subjectColumns,
    tableRows,
    overallPassPct,
    toppers,
    subjectToppers,
    failedStudents,
    totalStudents: students.length,
    reportHtml: buildReportHtml(ctx, courseLabel, subjectColumns, tableRows, overallPassPct, toppers, subjectToppers, failedStudents),
  };
}

function buildReportHtml(ctx, courseLabel, subjectColumns, tableRows, overallPassPct, toppers, subjectToppers, failedStudents) {
  let headerCells = subjectColumns.map((c) => `<th nowrap>${c.sname}</th>`).join('');
  let body = '';
  for (const row of tableRows) {
    body += `<tr><td nowrap>${row.label}</td>`;
    for (const cell of row.cells) {
      body += `<td align="right">${row.isPercent ? `${cell}%` : cell}</td>`;
    }
    body += '</tr>';
  }

  let topperHtml = '';
  for (const t of toppers) {
    topperHtml += `<tr><td>${t.rank} Rank</td><td>${t.registerNo}</td><td>${t.marks}/${t.totalMarks}</td><td>${t.name}</td></tr>`;
  }

  let subTopperHtml = '';
  let lastSubject = '';
  for (const t of subjectToppers) {
    subTopperHtml += `<tr><td>${t.subjectName}</td><td>${t.registerNo}</td><td>${t.marks}/${t.totalMarks}</td><td>${t.name}</td></tr>`;
    lastSubject = t.subjectName;
  }
  void lastSubject;

  let failHtml = '';
  for (const f of failedStudents) {
    failHtml += `<tr><td>${f.sno}</td><td>${f.registerNo}</td><td>${f.name}</td><td>${f.marks}</td><td>${f.failedSubjects}</td></tr>`;
  }

  return `${buildPrintHeader(`Result Analysis : ${ctx.academicYear}`, `${ctx.examNameLabel}<br>${courseLabel} - ${ctx.academicType}`)}
    <h4>Individual Department Pass Percentage</h4>
    <table class="table table-bordered"><thead class="table-secondary"><tr><th>Subject</th>${headerCells}</tr></thead><tbody>${body}</tbody></table>
    <h4>Overall Pass Percentage</h4>
    <table class="table table-bordered w-auto"><tr><th>Pass %</th><td><strong>${overallPassPct}%</strong></td></tr></table>
    ${topperHtml ? `<h4>Overall Topper</h4><table class="table table-bordered"><thead class="table-secondary"><tr><th>Rank</th><th>Reg.No.</th><th>Marks</th><th>Name</th></tr></thead><tbody>${topperHtml}</tbody></table>` : ''}
    ${subTopperHtml ? `<h4>Subject wise Topper</h4><table class="table table-bordered"><thead class="table-secondary"><tr><th>Subject</th><th>Reg.No.</th><th>Marks</th><th>Name</th></tr></thead><tbody>${subTopperHtml}</tbody></table>` : ''}
    ${failHtml ? `<h4>Failed Student Details</h4><table class="table table-bordered"><thead class="table-secondary"><tr><th>S.No</th><th>Reg.No.</th><th>Name</th><th>Marks</th><th>Failed Subject(s)</th></tr></thead><tbody>${failHtml}</tbody></table>` : ''}`;
}

export async function loadReportAnalysisV1(memberId, fields = {}, audit = {}) {
  const examOptions = await loadAnalysisV1ExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);

  let report = null;
  if (ctx && courseSel) {
    report = await buildAnalysisReport(ctx, courseSel);
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    ctx,
    courseGroups,
    courseKey,
    courseSel,
    ...report,
  };
}

export async function saveReportAnalysisV1() {
  return { success: false, message: 'Report is view only' };
}

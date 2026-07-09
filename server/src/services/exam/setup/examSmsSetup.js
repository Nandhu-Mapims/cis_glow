import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { logExamSetup } from '../setup/setupAudit.js';
import { recordSmsSend } from '../../sms/smsShared.js';
import {
  loadActiveExamOptions,
  loadBatchRollNumbers,
  loadCourseSemesterOptions,
  parseCourseSemesterKey,
  resolveExamContext,
} from '../setup/examSetupShared.js';

const PAGE = 'exam_sms.php';

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
  const theoryPracticalList = {};
  const theoryPracticalCat = {};

  for (const row of rows) {
    const rid = row.rid;
    const subId = String(row.subject_id);
    const tmark = (Number(row.internal_max) || 0) + (Number(row.viva_max) || 0) + (Number(row.external_max) || 0);
    const scat = subjectTypeMap[Number(row.subject_category)] || '';
    const sname = String(row.short_subject_name || row.main_name || row.subject_name || subId);

    if (!groups[rid]) {
      groups[rid] = {
        name: String(row.main_name || row.subject_name),
        sname,
        tmark: 0,
        exam: {},
      };
    }
    groups[rid].exam[subId] = { id: subId, pmark: Number(row.pass_mark) || 0, tmark, cat: scat };
    groups[rid].tmark += tmark;

    if (!theoryPracticalCat[rid]) theoryPracticalCat[rid] = { total: {}, pass: {} };
    theoryPracticalCat[rid].total[scat] = (theoryPracticalCat[rid].total[scat] || 0) + tmark;
    theoryPracticalCat[rid].pass[scat] = (theoryPracticalCat[rid].pass[scat] || 0) + (Number(row.pass_mark) || 0);
    if (!theoryPracticalList[scat]) theoryPracticalList[scat] = {};
    if (!theoryPracticalList[scat][rid]) theoryPracticalList[scat][rid] = [];
    theoryPracticalList[scat][rid].push(subId);
  }

  return { groups, theoryPracticalList, theoryPracticalCat, subjectOrder: Object.keys(groups) };
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

async function loadStudentsWithMobile(rolls) {
  if (!rolls.length) return [];
  const filter = rolls.map((r) => `register_no='${escapeSql(r)}'`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT uregister_no, register_no, student_name, student_initial, student_gender, father_mobile_1
     FROM student_profile_tb
     WHERE del=1 AND (${filter})
     ORDER BY uregister_no ASC, register_no ASC`,
  );
  return rows.map((row) => ({
    uregisterNo: row.uregister_no || row.register_no,
    registerNo: row.register_no,
    name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
    gender: String(row.student_gender || ''),
    mobile: String(row.father_mobile_1 || '').trim(),
  }));
}

function buildSmsMessage(student, groups, subjectOrder, theoryPracticalList, theoryPracticalCat, marksMap, examLabel, totalSubjects) {
  let genderStr = 'son/daughter';
  const g = student.gender.toLowerCase();
  if (g === 'male') genderStr = 'son';
  else if (g === 'female') genderStr = 'daughter';

  let overallTotal = 0;
  const overallResult = { NONE: 0, FAIL: 0, AB: 0, PASS: 0, NA: 0 };
  let smsText = `Dear Parent, \nYour ${genderStr} ${student.name}, ${examLabel} marks statement.`;

  for (const rid of subjectOrder) {
    const group = groups[rid];
    const rStatus = {};
    let cStatus = 0;
    let cTotal = 0;

    smsText += `\n${group.sname}:`;

    for (const scat of Object.keys(theoryPracticalList)) {
      const subList = theoryPracticalList[scat]?.[rid];
      if (!subList?.length) continue;

      const catPassm = theoryPracticalCat[rid]?.pass[scat] || 0;
      const tRStatus = {};
      let tCStatus = 0;
      let tCTotal = 0;

      for (const subId of subList) {
        const marks = marksMap[`${student.registerNo}::${subId}`];
        const pStatus = marks?.p_status || '';
        const tMarks = marks?.t_marks ?? '';
        if (pStatus) {
          const lower = String(tMarks).toLowerCase();
          if (lower !== 'a' && lower !== 'na') {
            cTotal += Number(tMarks) || 0;
            overallTotal += Number(tMarks) || 0;
            tCTotal += Number(tMarks) || 0;
          }
          tRStatus[pStatus] = (tRStatus[pStatus] || 0) + 1;
        } else {
          tRStatus.NONE = (tRStatus.NONE || 0) + 1;
        }
        tCStatus += 1;
      }

      cStatus += 1;
      if ((tRStatus.NONE || 0) > 0) {
        rStatus.NONE = (rStatus.NONE || 0) + 1;
      } else if ((tRStatus.NA || 0) > 0) {
        rStatus.NA = (rStatus.NA || 0) + 1;
        tCTotal = 'NA';
      } else if (tCStatus === (tRStatus.AB || 0)) {
        rStatus.AB = (rStatus.AB || 0) + 1;
        tCTotal = 'AB';
      } else if (Number(tCTotal) >= catPassm) {
        rStatus.PASS = (rStatus.PASS || 0) + 1;
      } else {
        rStatus.FAIL = (rStatus.FAIL || 0) + 1;
      }
      void tCTotal;
    }

    let tmpTotal = cTotal;
    let pLabel = '-';
    if ((rStatus.NONE || 0) > 0) {
      pLabel = '-';
      overallResult.NONE += 1;
      tmpTotal = 'NA';
    } else if ((rStatus.NA || 0) > 0) {
      pLabel = 'NA';
      overallResult.NA += 1;
      tmpTotal = 'NA';
    } else if ((rStatus.FAIL || 0) > 0) {
      pLabel = 'FAIL';
      overallResult.FAIL += 1;
    } else if ((rStatus.AB || 0) === cStatus) {
      pLabel = 'AB';
      overallResult.AB += 1;
      tmpTotal = 'AB';
    } else if ((rStatus.PASS || 0) === cStatus) {
      pLabel = 'PASS';
      overallResult.PASS += 1;
    } else {
      pLabel = 'FAIL';
      overallResult.FAIL += 1;
    }

    smsText += ` ${tmpTotal} - ${pLabel}`;
  }

  let overallLabel = '-';
  if (overallResult.NONE > 0) overallLabel = '-';
  else if (overallResult.NA > 0) overallLabel = 'NA';
  else if (overallResult.FAIL > 0) overallLabel = 'FAIL';
  else if (overallResult.AB > 0 && overallResult.FAIL === 0 && overallResult.NONE === 0 && overallResult.NA === 0) {
    overallLabel = 'AB';
  } else if (overallResult.PASS === totalSubjects) overallLabel = 'PASS';
  else overallLabel = 'FAIL';

  smsText += `\nTotal: ${overallTotal}\nResult: ${overallLabel}\n -Principal`;
  return smsText;
}

async function buildRecipients(ctx, courseSel) {
  const { groups, theoryPracticalList, theoryPracticalCat, subjectOrder } = await loadSubjectGroups(
    ctx, courseSel.courseId, courseSel.semester,
  );
  if (!subjectOrder.length) return { recipients: [], totalSubjects: 0 };

  const marksMap = await loadMarksMap(ctx, courseSel.courseId, courseSel.semester);
  const rolls = await loadBatchRollNumbers(
    courseSel.courseId, ctx.academicYear, courseSel.semester, ctx.academicType,
  );
  const students = await loadStudentsWithMobile(rolls);
  const courseLabel = `${convertNYear(courseSel.semester, ctx.courseName)}`;
  const examLabel = `${ctx.examNameLabel}`;

  const recipients = [];
  for (const stu of students) {
    if (!stu.mobile) continue;
    const message = buildSmsMessage(
      stu, groups, subjectOrder, theoryPracticalList, theoryPracticalCat,
      marksMap, examLabel, subjectOrder.length,
    );
    recipients.push({
      registerNo: stu.uregisterNo || stu.registerNo,
      mobile: stu.mobile,
      message,
    });
  }

  return { recipients, totalSubjects: subjectOrder.length, courseLabel, examLabel };
}

export async function loadExamSms(memberId, fields = {}, audit = {}) {
  const examOptions = await loadActiveExamOptions(true);
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);

  let recipients = [];
  if (ctx && courseSel) {
    const built = await buildRecipients(ctx, courseSel);
    recipients = built.recipients;
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    ctx,
    courseGroups,
    courseKey,
    courseSel,
    recipients,
    studentCount: recipients.length,
  };
}

export async function saveExamSms(payload, memberId, audit = {}) {
  const action = String(payload.action || '');

  if (action === 'init') {
    const loaded = await loadExamSms(memberId, payload, { ...audit, skipLog: true });
    const mobiles = (loaded.recipients || []).map((r) => r.mobile).join(',');
    const sample = loaded.recipients?.[0]?.message || '';
    if (!mobiles) {
      return { success: false, message: 'No recipients with mobile numbers' };
    }
    await recordSmsSend({
      memberId,
      audit,
      registerNo: loaded.courseKey || '',
      mobiles,
      messageType: 'Exam Mark',
      message: sample,
      templateId: '',
    });
    await logExamSetup(PAGE, 'Generate', 'Successful', mobiles, memberId, audit);
    return { success: true, message: 'SMS batch logged', ...loaded };
  }

  if (action === 'sendOne') {
    const mobile = String(payload.mobile || '').trim();
    const message = decodeURIComponent(String(payload.message || ''));
    if (!mobile || !message) {
      return { success: false, message: 'Mobile and message required' };
    }
    const result = await recordSmsSend({
      memberId,
      audit,
      registerNo: String(payload.registerNo || ''),
      mobiles: mobile,
      messageType: 'Exam Mark',
      message,
      templateId: '',
    });
    return result;
  }

  if (action === 'sendAll') {
    const loaded = await loadExamSms(memberId, payload, { ...audit, skipLog: true });
    const recipients = loaded.recipients || [];
    if (!recipients.length) {
      return { success: false, message: 'No recipients to send' };
    }
    await recordSmsSend({
      memberId,
      audit,
      registerNo: loaded.courseKey || '',
      mobiles: recipients.map((r) => r.mobile).join(','),
      messageType: 'Exam Mark',
      message: recipients[0].message,
      templateId: '',
    });
    let sent = 0;
    for (const rec of recipients) {
      const res = await recordSmsSend({
        memberId,
        audit,
        registerNo: rec.registerNo,
        mobiles: rec.mobile,
        messageType: 'Exam Mark',
        message: rec.message,
        templateId: '',
      });
      if (res.success) sent += 1;
    }
    await logExamSetup(PAGE, 'Send SMS', 'Successful', String(sent), memberId, audit);
    return {
      success: true,
      message: `${sent} SMS queued...`,
      sentCount: sent,
      ...loaded,
    };
  }

  return { success: false, message: 'Unknown action' };
}

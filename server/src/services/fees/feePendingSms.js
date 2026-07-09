import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { loadAcademicYearSetup, loadFeeLabelMap } from './feeHelpers.js';
import { loadCollectionSheet } from './feeSlipCollectionLoad.js';
import { recordSmsSend } from '../sms/smsShared.js';

const SMS_CONCURRENCY = 12;

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function genderWord(gender) {
  const g = String(gender || '').toLowerCase();
  if (g === 'male') return 'son';
  if (g === 'female') return 'daughter';
  return 'son/daughter';
}

function courseDeptPart(course) {
  return course.department_name && course.department_name !== '-'
    ? ` - ${course.department_name}`
    : '';
}

function timeAbbrev(fullPartTime) {
  const value = String(fullPartTime || '').toLowerCase();
  if (value.includes('part')) return 'PT';
  return 'FT';
}

function yearLabel(year, courseName) {
  const labels = ['', 'I', 'II', 'III', 'IV', 'Int.', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return labels[Number(year)] || String(year);
}

function buildPendingText(entries = []) {
  const pendingEntries = entries.filter((entry) => {
    const amount = Number(entry.balanceAmount || 0) + Number(entry.feeFine || 0);
    return amount > 0;
  });
  let total = 0;
  const chunks = pendingEntries.slice(0, 10).map((entry) => {
    const amount = Number(entry.balanceAmount || 0) + Number(entry.feeFine || 0);
    total += amount;
    return `${entry.label}: ${amount}`;
  });
  const more = pendingEntries.length > 10 ? ` (+${pendingEntries.length - 10} more)` : '';
  if (!chunks.length) return '';
  return `${chunks.join('; ')}; Total: ${total}${more}`;
}

export async function loadPendingSmsClasses() {
  const ac = await loadAcademicYearSetup(prisma);
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, full_part_time, course_duration
     FROM basic_setup_course_tb
     WHERE del = 1
     ORDER BY c_order ASC`,
  );

  const groups = [];
  const options = [];

  for (const course of courses) {
    const labelBase = `${course.degree_name || course.course_name}${courseDeptPart(course)}`;
    const groupPrefix = `${course.course_name} | ${course.degree_name}${courseDeptPart(course)} | ${timeAbbrev(course.full_part_time)}`;
    const duration = Number(course.course_duration) || 0;

    const pushBatchGroup = (batch, setupYear) => {
      if (!setupYear || !duration) return;
      const batchTitle = batch.charAt(0).toUpperCase() + batch.slice(1);
      const batchOptions = [];

      for (let year = 1; year <= duration; year += 1) {
        const value = `${course.id}___${setupYear}___${year}___${batch}`;
        const label = `${yearLabel(year, course.course_name)} - ${labelBase}`;
        const option = { value, label, courseId: String(course.id), year, batch, academicYear: setupYear };
        batchOptions.push(option);
        options.push(option);
      }

      if (batchOptions.length) {
        groups.push({
          label: `${groupPrefix} | ${batchTitle}`,
          options: batchOptions,
        });
      }
    };

    pushBatchGroup('regular', ac[course.course_name]?.regular || '');
    if (course.course_name === 'U.G' && ac[course.course_name]?.additional) {
      pushBatchGroup('additional', ac[course.course_name].additional);
    }
  }

  return { groups, classOptions: options };
}

export async function generatePendingSms(fields = {}) {
  const selectedClasses = Array.isArray(fields.selectedClasses)
    ? fields.selectedClasses.map(String).filter(Boolean)
    : [];
  const today = new Date().toISOString().slice(0, 10);

  if (!selectedClasses.length) {
    const { groups, classOptions } = await loadPendingSmsClasses();
    return { classGroups: groups, classOptions, selectedClasses: [], rows: [], total: 0, generated: false };
  }

  const [classData, shared] = await Promise.all([
    loadPendingSmsClasses(),
    Promise.all([
      loadAcademicYearSetup(prisma),
      loadFeeLabelMap(prisma),
    ]).then(([academicYears, feeLabelMap]) => ({ academicYears, feeLabelMap })),
  ]);
  const { groups, classOptions } = classData;
  const sheetOptions = { skipPhoto: true, pendingOnly: true, shared };

  const studentJobs = [];
  const seen = new Set();

  for (const classKey of selectedClasses) {
    const [courseId, academicYear, currentYear, academicBatch] = String(classKey).split('___');
    if (!courseId || !academicYear || !currentYear || !academicBatch) continue;

    const students = await prisma.$queryRawUnsafe(
      `SELECT P.register_no, P.student_name, P.student_initial, P.student_gender, P.father_mobile_1
       FROM student_profile_tb AS P
       INNER JOIN student_academic_tb AS A ON A.s_id = P.id
       WHERE P.del = 1
         AND A.del = 1
         AND A.course_id = '${escapeSql(courseId)}'
         AND A.academic_year = '${escapeSql(academicYear)}'
         AND A.current_year = '${escapeSql(currentYear)}'
         AND LOWER(A.academic_type) = '${escapeSql(academicBatch)}'
         AND P.mobile_no != ''
         AND (P.releaving_date = '0000-00-00' OR P.releaving_date > '${escapeSql(today)}')
         AND P.father_mobile_1 != ''
       ORDER BY P.register_no ASC`,
    );

    for (const student of students) {
      const key = `${student.register_no}__${student.father_mobile_1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      studentJobs.push(student);
    }
  }

  const rowResults = await mapWithConcurrency(studentJobs, SMS_CONCURRENCY, async (student) => {
    try {
      const sheet = await loadCollectionSheet(student.register_no, today, sheetOptions);
      if (!sheet?.entries?.length) return null;

      const studentName = `${student.student_name || ''} ${student.student_initial || ''}`.trim();
      const pendingText = buildPendingText(sheet.entries);
      if (!pendingText) return null;
      const message = `Dear Parent, Your ${genderWord(student.student_gender)} ${studentName}, Fee Pending details ${pendingText}. If paid, please check with your student portal.-APDCH`;
      return {
        registerNo: student.register_no,
        mobile: student.father_mobile_1,
        message,
      };
    } catch {
      return null;
    }
  });

  const rows = rowResults.filter(Boolean);

  return {
    classGroups: groups,
    classOptions,
    selectedClasses,
    rows,
    total: rows.length,
    generated: true,
    processedStudents: studentJobs.length,
  };
}

export async function sendPendingFeeSms(payload = {}, memberId = '', audit = {}) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) {
    return { error: 'No SMS rows to send' };
  }

  let sent = 0;
  for (const row of rows) {
    const mobile = String(row.mobile || '').trim();
    const message = String(row.message || '').trim();
    if (!mobile || !message) continue;

    const result = await recordSmsSend({
      memberId,
      audit,
      registerNo: String(row.registerNo || ''),
      mobiles: mobile,
      messageType: 'Fee Pending',
      message,
      templateId: 'fee_pending_sms',
    });
    if (result.success) sent += 1;
  }

  return {
    success: true,
    message: `${sent} SMS Sent...`,
    sent,
    total: rows.length,
  };
}

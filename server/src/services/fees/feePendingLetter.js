import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear, formatIndianMoney, loadAcademicYearSetup, loadFeeLabelMap } from './feeHelpers.js';
import { loadPendingSmsClasses } from './feePendingSms.js';
import { loadCollectionSheet } from './feeSlipCollectionLoad.js';

const LETTER_CONCURRENCY = 12;

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function courseDeptPart(course) {
  const dept = String(course?.department_name || '').trim();
  return dept && dept !== '-' ? ` - ${dept}` : '';
}

function formatStudentName(student, courseName) {
  const name = String(student.student_name || '').trim();
  const initial = String(student.student_initial || '').trim();
  if (courseName === 'U.G') {
    return `${name} ${initial}`.trim();
  }
  const title = student.student_title ? `${student.student_title}. ` : '';
  return `${title}${name} ${initial}`.trim();
}

function formatFatherName(student) {
  const title = student.father_title ? `${student.father_title}. ` : '';
  const name = String(student.father_name || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return `${title}${name}`.trim();
}

function genderDetails(gender) {
  const g = String(gender || '').toLowerCase();
  if (g === 'male') {
    return { relation: 'S/o', possessive: 'his', label: 'son' };
  }
  if (g === 'female') {
    return { relation: 'D/o', possessive: 'her', label: 'daughter' };
  }
  return { relation: 'S/o', possessive: 'his', label: 'son/daughter' };
}

function formatCommunicationAddress(student, studentName, relation, fatherName, mobile) {
  const stripTrailingComma = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
  };
  const skip = new Set(['-', ',', '.', '--']);
  const parts = [
    stripTrailingComma(student.c_door_no),
    stripTrailingComma(student.c_street),
    stripTrailingComma(student.c_post),
    stripTrailingComma(student.c_taluk),
    stripTrailingComma(student.c_district),
    stripTrailingComma(student.c_state),
    stripTrailingComma(student.c_pincode),
  ].filter((part) => part && !skip.has(part));

  let address = '';
  parts.forEach((part, idx) => {
    if (idx <= 1) address += `${escapeHtml(part)}, `;
    else if (idx === 2) address += `<br>${escapeHtml(part)}, `;
    else if (idx === 3 && !parts[2]) address += `<br>${escapeHtml(part)}, `;
    else if (idx === 4) address += `<br>${escapeHtml(part)}, `;
    else if (idx === 5 && !parts[4]) address += `<br>${escapeHtml(part)}, `;
    else address += `${escapeHtml(part)}, `;
  });
  if (address) address = `${address.slice(0, -2)}.`;

  const mobileLine = mobile ? `<br>M: ${escapeHtml(mobile)}` : '';
  const fatherLine = fatherName ? `${escapeHtml(relation)} ${escapeHtml(fatherName)}` : '';
  const addressDetails = `<strong>${escapeHtml(studentName)}, <strong style="white-space:nowrap;">${escapeHtml(student.yearLabel || '')} Year</strong></strong><br>${fatherLine}${address ? `<br>${address}` : ''}${mobileLine}`;

  return { address, addressDetails };
}

function buildPendingAmountHtml(entries, courseName) {
  const pending = entries.filter((entry) => Number(entry.balanceAmount || 0) > 0);
  if (!pending.length) return '';

  let html = '';
  let totalAmt = 0;
  let maxFine = 0;
  let feeCounter = 0;

  for (const entry of pending) {
    const amount = Number(entry.balanceAmount || 0);
    const fine = Number(entry.feeFine || 0);
    totalAmt += amount;
    if (fine > maxFine) maxFine = fine;
    const yearLabel = convertNYear(entry.classYear, courseName);
    html += `<strong>${escapeHtml(yearLabel)} Year</strong> : ${escapeHtml(entry.feeNameLabel)}: ${formatIndianMoney(amount)}<br>`;
    feeCounter += 1;
  }

  if (maxFine > 0) {
    html += `Late Fee Penalty: ${formatIndianMoney(maxFine)}<br>`;
    totalAmt += maxFine;
    feeCounter += 1;
  }

  if (feeCounter > 1) {
    html += '----------------------------------------------------<br>';
    html += `<strong>Total: ${formatIndianMoney(totalAmt)}</strong>`;
  }

  return html;
}

function buildFeeReminderLetter({
  studentName,
  registerNo,
  academicYear,
  currentYear,
  course,
  pendingHtml,
  addressDetails,
  relation,
  possessive,
  letterDate,
}) {
  const degreeLabel = `${course.degree_name || ''}${courseDeptPart(course)}`;
  const yearLabel = convertNYear(currentYear, course.course_name || '1');
  const bannerImage = '<img src="/legacy/files/certificate/apdch_letter_header.png" height="90" />';
  const signImage = '<img src="/legacy/files/certificate/sign/vs_principal_ sign_withseal.png" style="height: 130px;" />';
  const dateLabel = letterDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return `<div id="total_con" style="page-break-after: always;">
<table class="header_table" border="0" cellpadding="0" cellspacing="0" height="96" width="100%">
<tr>
<td align="left" height="95" width="50%">${bannerImage}</td>
<td nowrap="nowrap" valign="middle" width="50%"><div class="promote_card" style="font-size:25px;background-color:#ffff;">Fee Reminder</div></td>
</tr>
</table>
<table style="padding:25px;" border="0" cellpadding="0" cellspacing="0" width="100%">
<tbody>
<tr>
<td valign="top">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tbody>
<tr>
<td width="50%" align="left"><p class="date_name">Ref: APDC&amp;H/Fee-Rem/${escapeHtml(academicYear)}/FRL${escapeHtml(registerNo)} </p></td>
<td width="50%" align="right"><p class="date_name">Date &nbsp;: ${escapeHtml(dateLabel)} </p></td>
</tr>
</tbody></table>
</td>
</tr>
<tr>
<td style="padding-top:40px;height:530px;border-bottom:dashed 1px #333;" valign="top">
<table border="0" cellpadding="0" cellspacing="0" width="100%">
<tbody>
<tr>
<td><p>Dear Parent</p><p style="line-height:25px;text-align:justify;">This is to inform that <strong style="white-space:nowrap;">${escapeHtml(studentName)}</strong>, who is pursing ${escapeHtml(possessive)} <strong style="white-space:nowrap;">${escapeHtml(degreeLabel)}</strong> degree programme in our institution, has an outstanding fees amount as follows.</p><p style="padding-left:100px;">${pendingHtml}</p><br></td>
</tr>
<tr>
<td>We request you to pay the Outstanding fees at the earliest to avoid any additional late fees.</td>
</tbody></table>
<table align="left" border="0" cellpadding="0" cellspacing="0" width="100%">
<tbody><tr>
<td width="33.3%" height="90" align="left" valign="bottom" class="sign_name">Copy to:-<br>1.Student File</td>
<td width="33.3%" align="center" valign="bottom"></td>
<td width="33.3%" align="center" valign="bottom"><p class="sign_name">${signImage}</p></td>
</tr>
</tbody></table>
</td>
</tr>
</tbody></table>
<div class="pfooter">
<table width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
<tbody>
<tr>
<td style="padding-left:23px;" width="45%" valign="top" align="left">
<div class="title_div" style="margin-top:50px;padding:0px;">
<p class="top_heading">FEE REMINDER</p>
</div>
<div style="margin-top:100px;width:100%;float:left;">
<p class="footer_company"><strong>From<br>Adhiparasakthi Dental College &amp; Hospital</strong>
<br>GST Road, Melmaruvathur - 603319.
<br>Ph: 044 - 2752 8082 &amp; 83.<br>https://www.apdch.edu.in</p>
</div>
</td>
<td width="55%" valign="top" align="left">
<table width="100%" border="0">
<tbody><tr>
<td height="50"><div style="margin:30px 30px 0 0;float:right;border:dashed 1px #999;width:55px;height:65px;line-height:65px;font-size:11px;color:#999;text-align:center;"> Stamp </div></td>
</tr>
<tr><td align="center"> </td></tr>
<tr><td>&nbsp;</td></tr>
<tr>
<td><div style="margin-top:10px;"><p class="student_address"><strong>To</strong><br>${addressDetails}</p></div></td>
</tr>
</tbody></table></td>
</tr>
<tr>
<td colspan="2" style="padding-left:23px;" valign="top" align="left">
<p class="footer_message"> Knowledge coming from experience is more important than knowledge coming from education alone. - "AMMA"</p></td>
</tr>
</tbody>
</table>
</div>
</div>`;
}

export async function loadPendingLetterForm() {
  const { groups, classOptions } = await loadPendingSmsClasses();
  return { classGroups: groups, classOptions };
}

export async function generatePendingLetters(fields = {}) {
  const selectedClasses = Array.isArray(fields.selectedClasses)
    ? fields.selectedClasses.map(String).filter(Boolean)
    : [];
  const today = new Date().toISOString().slice(0, 10);
  const letterDate = new Date();

  if (!selectedClasses.length) {
    const form = await loadPendingLetterForm();
    return {
      ...form,
      selectedClasses: [],
      count: 0,
      lettersHtml: '',
      generated: false,
    };
  }

  const [classData, shared] = await Promise.all([
    loadPendingSmsClasses(),
    Promise.all([
      loadAcademicYearSetup(prisma),
      loadFeeLabelMap(prisma),
    ]).then(([academicYears, feeLabelMap]) => ({ academicYears, feeLabelMap })),
  ]);
  const sheetOptions = { skipPhoto: true, pendingOnly: true, shared };
  const courseCache = {};
  const studentJobs = [];
  const seen = new Set();

  for (const classKey of selectedClasses) {
    const [courseId, academicYear, currentYear, academicBatch] = String(classKey).split('___');
    if (!courseId || !academicYear || !currentYear || !academicBatch) continue;

    if (!courseCache[courseId]) {
      const courseRows = await prisma.$queryRawUnsafe(
        `SELECT id, course_name, degree_name, department_name
         FROM basic_setup_course_tb
         WHERE del = 1 AND id = '${escapeSql(courseId)}'
         LIMIT 1`,
      );
      courseCache[courseId] = courseRows[0] || {};
    }

    const students = await prisma.$queryRawUnsafe(
      `SELECT P.register_no, P.student_name, P.student_initial, P.student_title, P.student_gender,
              P.father_mobile_1, P.father_name, P.father_title,
              P.c_door_no, P.c_street, P.c_post, P.c_taluk, P.c_district, P.c_state, P.c_pincode,
              A.current_year
       FROM student_profile_tb AS P
       INNER JOIN student_academic_tb AS A ON A.s_id = P.id
       WHERE P.del = 1
         AND A.del = 1
         AND A.course_id = '${escapeSql(courseId)}'
         AND A.academic_year = '${escapeSql(academicYear)}'
         AND A.current_year = '${escapeSql(currentYear)}'
         AND LOWER(A.academic_type) = '${escapeSql(academicBatch)}'
         AND P.mobile_no != ''
         AND P.father_mobile_1 != ''
         AND (P.releaving_date = '0000-00-00' OR P.releaving_date > '${escapeSql(today)}')
       ORDER BY P.register_no ASC`,
    );

    for (const student of students) {
      const key = student.register_no;
      if (seen.has(key)) continue;
      seen.add(key);
      studentJobs.push({
        ...student,
        courseId,
        academicYear,
        currentYear,
        academicBatch,
      });
    }
  }

  const letterResults = await mapWithConcurrency(studentJobs, LETTER_CONCURRENCY, async (student) => {
    try {
      const course = courseCache[student.courseId] || {};
      const sheet = await loadCollectionSheet(student.register_no, today, sheetOptions);
      if (!sheet?.entries?.length) return null;

      const pendingHtml = buildPendingAmountHtml(sheet.entries, course.course_name || '1');
      if (!pendingHtml) return null;

      const studentName = formatStudentName(student, course.course_name);
      const fatherName = formatFatherName(student);
      const { relation, possessive } = genderDetails(student.student_gender);
      const yearLabel = convertNYear(student.current_year, course.course_name || '1');
      const { addressDetails } = formatCommunicationAddress(
        { ...student, yearLabel },
        studentName,
        relation,
        fatherName,
        student.father_mobile_1,
      );

      return buildFeeReminderLetter({
        studentName,
        registerNo: student.register_no,
        academicYear: student.academicYear,
        currentYear: student.current_year,
        course,
        pendingHtml,
        addressDetails,
        relation,
        possessive,
        letterDate,
      });
    } catch {
      return null;
    }
  });

  const letters = letterResults.filter(Boolean);

  return {
    classGroups: classData.groups,
    classOptions: classData.classOptions,
    selectedClasses,
    count: letters.length,
    lettersHtml: letters.join(''),
    generated: true,
    processedStudents: studentJobs.length,
  };
}

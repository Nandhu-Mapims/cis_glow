import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields } from '../shared/moduleAudit.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDepartmentName(name) {
  const dept = String(name || '').trim();
  if (!dept || dept === '-') return '';
  return ` - ${dept}`;
}

function fmtLegacyDate(val) {
  if (!val || val === '0000-00-00' || val === '0000-00-00 00:00:00') return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function nilOrDate(val) {
  return fmtLegacyDate(val) || '-Nil-';
}

function nilOrText(val) {
  const text = String(val ?? '').trim();
  return text || '-Nil-';
}

function pronouns(title) {
  const t = String(title || '').toLowerCase();
  if (t === 'ms') return { relation: 'D/o', gstr: 'her', gstr1: 'she', gstr2: 'Ladies' };
  if (t === 'mr') return { relation: 'S/o', gstr: 'his', gstr1: 'he', gstr2: 'Gents' };
  return { relation: 'D/o (or) S/o', gstr: 'his/her', gstr1: 'he/she', gstr2: '' };
}

function formatPeriod(value) {
  return String(value || '')
    .replace('1 1/2 Months', '1 ½ Months')
    .replace('1 &frac12; Months', '1 ½ Months');
}

function splitLines(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `${escapeHtml(part)}<br>`)
    .join('');
}

function legacyPhotoUrl(registerNo) {
  const file = `${registerNo}A.jpg`;
  const full = path.join(config.legacyFilesPath, 'student_idcard', file);
  if (fs.existsSync(full)) {
    return `/legacy/files/student_idcard/${encodeURIComponent(file)}`;
  }
  return '';
}

async function loadDepartmentMap() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, category_name
    FROM master_setup
    WHERE category = 'Internship Department' AND del != 0
    ORDER BY category_order ASC
  `);
  const map = new Map();
  for (const row of rows) map.set(Number(row.id), String(row.category_name || ''));
  return map;
}

export async function loadInternshipCourseOptions() {
  const [courses, academicSetup] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT id, course_name, degree_name, department_name, full_part_time, year_of_start, course_duration
      FROM basic_setup_course_tb
      WHERE del = 1 AND course_name = 'U.G'
      ORDER BY c_order ASC
    `),
    prisma.$queryRawUnsafe('SELECT ug_academic_year FROM basic_setup_tb WHERE del = 1 LIMIT 1'),
  ]);

  const ugYear = academicSetup[0]?.ug_academic_year || '';
  const startYear = Number.parseInt(String(ugYear).split('-')[1], 10)
    || Number.parseInt(String(ugYear).split('-')[0], 10)
    || new Date().getFullYear();

  const options = [];
  for (const course of courses) {
    const dept = formatDepartmentName(course.department_name);
    const ft = String(course.full_part_time || '').toLowerCase().includes('part') ? 'PT' : 'FT';
    const group = `U.G | ${course.degree_name}${dept} | ${ft}`;
    const yearOfStart = Number(course.year_of_start) || startYear;
    const duration = Number(course.course_duration) || 5;

    for (let year = (startYear - duration); year >= yearOfStart; year -= 1) {
      const academicYear = `${year}-${year + 1}`;
      options.push({
        courseRef: `${course.id}___${academicYear}`,
        label: `${course.degree_name}${dept} | ${academicYear}`,
        group,
      });
    }
  }
  return options;
}

export async function searchInternshipStudents(searchBy, searchInput) {
  const input = String(searchInput || '').trim();
  if (!input) return [];

  let sql = '';
  if (searchBy === 'batch') {
    const [courseId, academicYear] = input.split('___');
    if (!courseId || !academicYear) return [];
    sql = `
      SELECT A.id, A.register_no, A.student_name, A.student_initial, A.student_title
      FROM student_profile_tb AS A
      INNER JOIN student_internship_related_tb AS B ON A.id = B.s_id
      WHERE A.del = 1 AND B.del = 1
        AND A.course_id = '${escapeSql(courseId)}'
        AND A.academic_year = '${escapeSql(academicYear)}'
      ORDER BY A.student_title ASC, A.student_name ASC, A.student_initial ASC
    `;
  } else {
    const regs = input.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean);
    if (!regs.length) return [];
    const clause = regs.map((reg) => `A.register_no = '${escapeSql(reg)}'`).join(' OR ');
    sql = `
      SELECT A.id, A.register_no, A.student_name, A.student_initial, A.student_title
      FROM student_profile_tb AS A
      INNER JOIN student_internship_related_tb AS B ON A.id = B.s_id
      WHERE A.del = 1 AND B.del = 1 AND (${clause})
      ORDER BY A.student_title ASC, A.student_name ASC, A.student_initial ASC
    `;
  }

  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map((row, index) => ({
    id: Number(row.id),
    serialNo: index + 1,
    registerNo: row.register_no || '',
    studentName: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
    studentTitle: row.student_title || '',
  }));
}

async function ensureCertificateNumber(studentId, memberId, audit) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT cri_cert_no FROM student_profile_tb WHERE del = 1 AND id = ${Number(studentId)} LIMIT 1
  `);
  let certNo = Number(rows[0]?.cri_cert_no || 0);
  if (certNo > 0) return certNo;

  const maxRows = await prisma.$queryRawUnsafe(`
    SELECT cri_cert_no FROM student_profile_tb WHERE del = 1 ORDER BY cri_cert_no + 1 DESC LIMIT 1
  `);
  certNo = Number(maxRows[0]?.cri_cert_no || 0);
  if (certNo === 0) certNo = 1;
  else certNo += 1;

  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE student_profile_tb SET cri_cert_no = ${certNo},
      updated_dt = NOW(),
      updated_by = '${escapeSql(memberId)}',
      updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE id = ${Number(studentId)}
  `);
  return certNo;
}

export async function buildInternshipCertificateHtml(studentId, memberId, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.id, A.admission_no, A.academic_year, A.register_no, A.uregister_no,
      A.student_title, A.student_name, A.student_initial, A.course_id, A.cri_cert_no
    FROM student_profile_tb AS A
    WHERE A.del = 1 AND A.id = ${Number(studentId)}
    LIMIT 1
  `);
  const student = rows[0];
  if (!student) return '';

  const [courseRows, relatedRows, internshipRows, departmentMap] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT degree_name, department_name, course_duration
      FROM basic_setup_course_tb WHERE del = 1 AND id = '${escapeSql(String(student.course_id))}' LIMIT 1
    `),
    prisma.$queryRawUnsafe(`
      SELECT study_date, final_year, leave_reason, lrno1, lrno2, conduct_character, id, leave_date,
        IF(leave_fdate = '0000-00-00' OR leave_fdate IS NULL, '', DATE_FORMAT(leave_fdate, '%d-%m-%Y')) AS leave_fdate,
        IF(leave_tdate = '0000-00-00' OR leave_tdate IS NULL, '', DATE_FORMAT(leave_tdate, '%d-%m-%Y')) AS leave_tdate,
        IF(lrdate1 = '0000-00-00' OR lrdate1 IS NULL, '', DATE_FORMAT(lrdate1, '%d-%m-%Y')) AS lrdate1,
        IF(lrdate2 = '0000-00-00' OR lrdate2 IS NULL, '', DATE_FORMAT(lrdate2, '%d-%m-%Y')) AS lrdate2
      FROM student_internship_related_tb
      WHERE del = 1 AND s_id = '${escapeSql(String(student.id))}'
      ORDER BY id ASC LIMIT 1
    `),
    prisma.$queryRawUnsafe(`
      SELECT department, total_period, from_date, to_date, grade, id, el_department
      FROM student_internship_tb
      WHERE del = 1 AND s_id = '${escapeSql(String(student.id))}'
      ORDER BY id ASC
    `),
    loadDepartmentMap(),
  ]);

  if (!internshipRows.length) return '';

  const course = courseRows[0] || {};
  const related = relatedRows[0] || {};
  const pronoun = pronouns(student.student_title);
  const studentNames = `${String(student.student_title || '').charAt(0).toUpperCase()}${String(student.student_title || '').slice(1).toLowerCase()} ${String(student.student_name || '').toUpperCase()} ${String(student.student_initial || '').toUpperCase()}`.trim();
  const degreeName = course.degree_name || '';
  let departmentName = formatDepartmentName(course.department_name);
  const displayReg = student.uregister_no || student.register_no;

  const yearFromParts = String(student.academic_year || '').split('-');
  const yearFrom = yearFromParts[0] ? `AUG-${yearFromParts[0]}` : '';
  const studyDate = related.study_date || '';
  const finalYear = related.final_year || '';

  const rangeRows = await prisma.$queryRawUnsafe(`
    SELECT MIN(from_date) AS from_date, MAX(to_date) AS to_date
    FROM student_internship_tb
    WHERE del = 1 AND s_id = '${escapeSql(String(student.id))}'
  `);
  const tdateInter = rangeRows[0]?.to_date || '';
  const certNoValue = await ensureCertificateNumber(student.id, memberId, audit);
  const certYearMatch = String(tdateInter).match(/(19|20)\d{2}/);
  const certYear = certYearMatch
    ? Number(certYearMatch[0])
    : new Date().getFullYear();
  const certificateNo = `APDCH/${certYear}/CRI/${String(certNoValue).padStart(4, '0')}`;

  const photoUrl = legacyPhotoUrl(student.register_no);
  const photoHtml = photoUrl
    ? `<img src="${photoUrl}" height="170" width="130" alt="" />`
    : '';

  let tableRows = '';
  internshipRows.forEach((row, index) => {
    const deptLabel = departmentMap.get(Number(row.department)) || '';
    const elDeptLabel = departmentMap.get(Number(row.el_department)) || '';
    const period = formatPeriod(row.total_period || '');

    tableRows += `
      <tr>
        <td height="35" align="center" nowrap="nowrap" class="mark_td_bottom_border">${index + 1}</td>
        <td valign="middle" nowrap="nowrap" class="mark_td_left_bottom_border">${escapeHtml(deptLabel)}${escapeHtml(elDeptLabel)}</td>
        <td valign="middle" nowrap="nowrap" class="mark_td_left_bottom_border" align="center">${escapeHtml(period)}</td>
        <td valign="middle" nowrap="nowrap" class="mark_td_left_bottom_border" align="center">${splitLines(row.from_date)}</td>
        <td valign="middle" nowrap="nowrap" class="mark_td_left_bottom_border" align="center">${splitLines(row.to_date)}</td>
        <td valign="middle" nowrap="nowrap" class="mark_td_left_bottom_border" align="center">${escapeHtml(String(row.grade || '').replace(/\b\w/g, (c) => c.toUpperCase()))}</td>
      </tr>`;
  });

  const heShe = pronoun.gstr1.charAt(0).toUpperCase() + pronoun.gstr1.slice(1);

  return `
<div id="cri_container">
  <div id="cri_name">${escapeHtml(certificateNo)}</div>
  <div id="cri_title">Compulsory Rotatory Internship Certificate In Dental Surgery</div>
  <div class="cri_intro_row">
    <div class="cri_intro_text">
      <p class="cri_content">This is to certify that <strong>${escapeHtml(studentNames)}</strong> (Reg.No.<strong>${escapeHtml(displayReg)}</strong>) is a Bonafide student of Adhiparasakthi Dental College &amp; Hospital from <strong>${escapeHtml(yearFrom)}</strong> to <strong>${escapeHtml(finalYear)}</strong>. ${escapeHtml(heShe)} has passed the B.D.S. Final Examination of The Tamilnadu Dr.M.G.R. Medical University held in <strong>${escapeHtml(finalYear)}</strong>.</p>
      <p class="cri_content">${escapeHtml(heShe)} has Completed Twelve months of Compulsory Rotatory Internship satisfactorily from <strong>${escapeHtml(studyDate)}</strong> as per the regulations of The Tamilnadu Dr.M.G.R. Medical University. During this period ${escapeHtml(pronoun.gstr1)} has worked in the following departments/specialities as shown below:</p>
    </div>
    <div class="cri_intro_photo">${photoHtml}</div>
  </div>
  <div class="cri_table_wrap">
    <table width="100%" cellpadding="3" cellspacing="0" class="table_border">
      <tr>
        <td width="40" valign="middle" class="mark_td_bottom_border"><p class="mark_content" style="text-align:center;">S.No.</p></td>
        <td width="200" valign="middle" class="mark_td_left_bottom_border"><p class="mark_content" style="text-align:center;">Department</p></td>
        <td width="100" valign="middle" class="mark_td_left_bottom_border"><p class="mark_content" style="text-align:center;">Period</p></td>
        <td width="150" valign="middle" class="mark_td_left_bottom_border"><p class="mark_content" style="text-align:center;">From</p></td>
        <td width="150" valign="middle" class="mark_td_left_bottom_border"><p class="mark_content" style="text-align:center;">To</p></td>
        <td width="150" valign="middle" class="mark_td_left_bottom_border"><p class="mark_content" style="text-align:center;">Grade</p></td>
      </tr>
      ${tableRows}
    </table>
  </div>
  <p class="cri_footer">
    Leave taken from <strong>${escapeHtml(related.leave_date || '')}.</strong>
    Reason for Extension of C.R.R.I. <strong>${escapeHtml(nilOrText(related.leave_reason))}.</strong><br/>
    Permission of the University is issued Lr.No. <strong>${escapeHtml(nilOrText(related.lrno1))}</strong> dated <strong>${escapeHtml(related.lrdate1 || '-Nil-')}</strong> (to do C.R.R.I. other than other Parent Institution).<br/>
    Permission of the University is issued Lr.No. <strong>${escapeHtml(nilOrText(related.lrno2))}</strong> dated <strong>${escapeHtml(related.lrdate2 || '-Nil-')}</strong> (Order of Condonation of break of study).<br/>
    ${escapeHtml(heShe)} is eligible for B.D.S. degree. During the above period ${escapeHtml(pronoun.gstr)} conduct and character has been <strong>${escapeHtml(nilOrText(related.conduct_character))}</strong>
  </p>
  <div class="cri_signatures">
    <div>Signature of the Internee</div>
    <div style="text-transform:uppercase;">Principal</div>
  </div>
</div>`;
}

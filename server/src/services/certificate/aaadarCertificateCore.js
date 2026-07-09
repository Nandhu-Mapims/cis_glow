import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields } from '../shared/moduleAudit.js';

const CERT_CONFIG = {
  implant: {
    background: 'Certificate-Implant.jpg',
    certColumn: 'aaadar_imp_cno',
    certLabel: 'Implant',
    programme: 'has completed Standard Dental Implant Competency Programme (10 months)',
  },
  laser: {
    background: 'Certificate-Laser.jpg',
    certColumn: 'aaadar_las_cno',
    certLabel: 'Laser',
    programme: 'has completed Soft & Hard Tissue Laser Competency Programme (6 Days)',
  },
};

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

function titlePrefix(title) {
  const t = String(title || '').toLowerCase();
  if (t === 'dr') return 'Dr';
  return '';
}

export async function loadAaadarCourseOptions() {
  const [courses, academicSetup] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT id, course_name, degree_name, department_name, full_part_time, year_of_start, course_duration
      FROM basic_setup_course_tb
      WHERE del = 1
      ORDER BY c_order ASC
    `),
    prisma.$queryRawUnsafe('SELECT ug_academic_year, pg_academic_year FROM basic_setup_tb WHERE del = 1 LIMIT 1'),
  ]);

  const academicYears = {
    'U.G': academicSetup[0]?.ug_academic_year || '',
    'P.G': academicSetup[0]?.pg_academic_year || '',
  };

  const options = [];
  for (const course of courses) {
    const activeYear = academicYears[course.course_name] || academicYears['U.G'] || '';
    const endYear = Number.parseInt(String(activeYear).split('-')[1], 10)
      || Number.parseInt(String(activeYear).split('-')[0], 10)
      || new Date().getFullYear();
    const dept = formatDepartmentName(course.department_name);
    const ft = String(course.full_part_time || '').toLowerCase().includes('part') ? 'PT' : 'FT';
    const group = `${course.course_name} | ${course.degree_name}${dept} | ${ft}`;
    const yearOfStart = Number(course.year_of_start) || endYear;
    const duration = Number(course.course_duration) || 5;

    for (let year = (endYear - duration); year >= yearOfStart; year -= 1) {
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

export async function searchAaadarStudents(searchBy, searchInput) {
  const input = String(searchInput || '').trim();
  if (!input) return [];

  let sql = '';
  if (searchBy === 'batch') {
    const [courseId, academicYear] = input.split('___');
    if (!courseId || !academicYear) return [];
    sql = `
      SELECT A.id, A.register_no, A.student_name, A.student_initial, A.student_title
      FROM student_profile_tb AS A
      WHERE A.del = 1
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
      WHERE A.del = 1 AND (${clause})
      ORDER BY A.student_title ASC, A.student_name ASC, A.student_initial ASC
    `;
  }

  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map((row) => ({
    id: Number(row.id),
    registerNo: row.register_no || '',
    studentName: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
    studentTitle: row.student_title || '',
  }));
}

async function ensureCertNumber(studentId, certType, memberId, audit) {
  const cfg = CERT_CONFIG[certType];
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${cfg.certColumn} AS cert_no FROM student_profile_tb
    WHERE del = 1 AND id = ${Number(studentId)} LIMIT 1
  `);
  let certNo = Number(rows[0]?.cert_no || 0);
  if (certNo > 0) return certNo;

  const maxRows = await prisma.$queryRawUnsafe(`
    SELECT ${cfg.certColumn} AS cert_no FROM student_profile_tb
    WHERE del = 1 ORDER BY ${cfg.certColumn} + 1 DESC LIMIT 1
  `);
  certNo = Number(maxRows[0]?.cert_no || 0);
  if (certNo === 0) certNo = 1;
  else certNo += 1;

  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE student_profile_tb SET ${cfg.certColumn} = ${certNo},
      updated_dt = NOW(),
      updated_by = '${escapeSql(memberId)}',
      updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE id = ${Number(studentId)}
  `);
  return certNo;
}

async function certYearForStudent(studentId) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT MAX(updated_dt) AS updated_dt
    FROM student_internship_tb
    WHERE del = 1 AND s_id = '${escapeSql(String(studentId))}'
  `);
  const updatedDt = rows[0]?.updated_dt;
  if (updatedDt && updatedDt !== '0000-00-00 00:00:00') {
    const d = new Date(updatedDt);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }
  return new Date().getFullYear();
}

export async function buildAaadarCertificateHtml(studentId, certType, memberId, audit = {}) {
  const cfg = CERT_CONFIG[certType];
  if (!cfg) return '';

  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.id, A.register_no, A.student_title, A.student_name, A.student_initial,
      A.course_id, A.${cfg.certColumn} AS cert_no,
      C.degree_name, C.department_name
    FROM student_profile_tb AS A
    LEFT JOIN basic_setup_course_tb AS C ON C.del = 1 AND C.id = A.course_id
    WHERE A.del = 1 AND A.id = ${Number(studentId)}
    LIMIT 1
  `);
  const student = rows[0];
  if (!student) return '';

  const certNoValue = await ensureCertNumber(student.id, certType, memberId, audit);
  const certYear = await certYearForStudent(student.id);
  const certificateNo = `APDCH/${certYear}/${cfg.certLabel}/${String(certNoValue).padStart(4, '0')}`;

  const prefix = titlePrefix(student.student_title);
  const displayName = `${prefix ? `${prefix} ` : ''}${String(student.student_name || '').charAt(0).toUpperCase()}${String(student.student_name || '').slice(1)} ${String(student.student_initial || '').toUpperCase()}`.trim();
  const degreeName = student.degree_name || '';

  let qrHtml = '';
  try {
    const qrData = `Certificate No.: ${certificateNo}\n Reg.No.: ${student.register_no}\n Name: ${displayName}\n Course: ${degreeName}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'M', margin: 1, width: 80 });
    qrHtml = `<img src="${qrDataUrl}" width="80" height="80" alt="QR code" />`;
  } catch {
    qrHtml = '';
  }

  const bgUrl = `/legacy/files/certificate/${cfg.background}?v=1`;

  return `
<div class="certificate_total">
  <img src="${bgUrl}" alt="Certificate background" width="1108" height="780" />
  <div class="aaadar_cert_no">${escapeHtml(certificateNo)}</div>
  <div class="content">
    <table width="100%" height="100%" cellspacing="0" cellpadding="0" border="0" align="center">
      <tbody>
        <tr>
          <td valign="middle" height="62" align="center">
            <p class="staff_desig2">This is to certify that</p>
            <p class="staff_name2"><strong>${escapeHtml(displayName)}</strong></p>
            <p class="staff_desig2">${escapeHtml(cfg.programme)}</p>
            <p class="staff_desig2">at Adhiparasakthi Academy of Advanced Dentistry &amp; Research</p>
            <p class="small_name">A Unit Of Adhiparasakthi Dental College And Hospital, Melmaruvathur, Tamilnadu, India</p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="aaadar_qr">${qrHtml}</div>
</div>`;
}

export async function loadAaadarCertificateScreen(memberId, fields = {}, audit = {}, certType) {
  const searchBy = fields.searchBy === 'batch' ? 'batch' : 'roll_no';
  const searchInput = String(fields.searchInput || fields.registerNo || '').trim();
  const studentId = fields.studentId ? Number(fields.studentId) : 0;

  const courseOptions = await loadAaadarCourseOptions();
  let students = [];
  let certificateHtml = '';
  let message = '';
  let selectedStudentId = studentId;

  if (studentId) {
    if (searchInput) {
      students = await searchAaadarStudents(searchBy, searchInput);
    }
    certificateHtml = await buildAaadarCertificateHtml(studentId, certType, memberId, audit);
    if (!certificateHtml) message = 'No details found...';
  } else if (searchInput) {
    students = await searchAaadarStudents(searchBy, searchInput);
    if (students.length) {
      selectedStudentId = students[0].id;
      certificateHtml = await buildAaadarCertificateHtml(selectedStudentId, certType, memberId, audit);
    }
    if (!students.length || !certificateHtml) message = 'No details found...';
  }

  return {
    success: true,
    certType,
    searchBy,
    searchInput,
    courseOptions,
    students,
    selectedStudentId,
    certificateHtml,
    message,
  };
}

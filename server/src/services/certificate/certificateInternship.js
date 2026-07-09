import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { lookupStudent } from './certificateShared.js';
import {
  buildInternshipCertificateHtml,
  loadInternshipCourseOptions,
  searchInternshipStudents,
} from './internshipGenerateCore.js';

const SCHEDULE_PAGE = 'student_internship.php';
const GENERATE_PAGE = 'internship_generate.php';
const PHOTO_PAGE = 'student_internship_photo.php';

export async function loadInternshipSchedule(memberId, fields = {}, audit = {}) {
  const registerNo = fields.registerNo ? String(fields.registerNo).trim().toUpperCase() : '';
  let internships = [];
  let related = [];
  let student = null;

  if (registerNo) {
    student = await lookupStudent(registerNo);
    if (student) {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT id, s_id, department, el_department, total_period, from_date, to_date, grade
        FROM student_internship_tb WHERE del = 1 AND s_id = '${escapeSql(String(student.id))}'
        ORDER BY id DESC
      `);
      internships = rows.map((r) => ({
        id: Number(r.id),
        department: r.department || '',
        elDepartment: r.el_department || '',
        totalPeriod: r.total_period || '',
        fromDate: r.from_date || '',
        toDate: r.to_date || '',
        grade: r.grade || '',
      }));

      const relRows = await prisma.$queryRawUnsafe(`
        SELECT id, s_id, leave_fdate, leave_tdate, leave_date, study_date, final_year,
          leave_reason, lrno1, lrdate1
        FROM student_internship_related_tb WHERE del = 1 AND s_id = '${escapeSql(String(student.id))}'
        ORDER BY id DESC LIMIT 1
      `);
      if (relRows[0]) {
        const r = relRows[0];
        related = [{
          id: Number(r.id),
          leaveFromDate: r.leave_fdate || '',
          leaveToDate: r.leave_tdate || '',
          leaveDate: r.leave_date || '',
          studyDate: r.study_date || '',
          finalYear: r.final_year || '',
          leaveReason: r.leave_reason || '',
          lrNo1: r.lrno1 || '',
          lrDate1: r.lrdate1 || '',
        }];
      }
    }
  }

  await logModulePage(SCHEDULE_PAGE, 'View', 'Successful', registerNo, memberId, audit);
  return { success: true, registerNo, student, internships, related };
}

export async function saveInternshipSchedule(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const registerNo = String(payload.registerNo || '').trim().toUpperCase();
  const student = await lookupStudent(registerNo);
  if (!student) return { success: false, message: 'Student not found.' };

  if (payload.action === 'delete' && payload.id) {
    await prisma.$executeRawUnsafe(`
      UPDATE student_internship_tb SET del = 0, updated_dt = NOW(),
        updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${Number(payload.id)}
    `);
    await logModulePage(SCHEDULE_PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return {
      success: true,
      message: 'Internship deleted.',
      ...(await loadInternshipSchedule(memberId, { registerNo }, { ...audit, skipLog: true })),
    };
  }

  const internship = payload.internship || {};
  if (internship.id) {
    await prisma.$executeRawUnsafe(`
      UPDATE student_internship_tb SET
        department = '${escapeSql(String(internship.department || ''))}',
        el_department = '${escapeSql(String(internship.elDepartment || ''))}',
        total_period = '${escapeSql(String(internship.totalPeriod || ''))}',
        from_date = '${escapeSql(String(internship.fromDate || ''))}',
        to_date = '${escapeSql(String(internship.toDate || ''))}',
        grade = '${escapeSql(String(internship.grade || ''))}',
        updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${Number(internship.id)} AND del = 1
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO student_internship_tb (s_id, department, el_department, total_period, from_date, to_date, grade,
        created_dt, created_ip, created_by, del)
      VALUES ('${escapeSql(String(student.id))}',
        '${escapeSql(String(internship.department || ''))}',
        '${escapeSql(String(internship.elDepartment || ''))}',
        '${escapeSql(String(internship.totalPeriod || ''))}',
        '${escapeSql(String(internship.fromDate || ''))}',
        '${escapeSql(String(internship.toDate || ''))}',
        '${escapeSql(String(internship.grade || ''))}',
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
    `);
  }

  await logModulePage(SCHEDULE_PAGE, 'Update', 'Successful', registerNo, memberId, audit);
  return {
    success: true,
    message: 'Internship saved.',
    ...(await loadInternshipSchedule(memberId, { registerNo }, { ...audit, skipLog: true })),
  };
}

export async function loadInternshipGenerate(memberId, fields = {}, audit = {}) {
  const searchBy = fields.searchBy === 'batch' ? 'batch' : 'roll_no';
  const searchInput = String(fields.searchInput || fields.registerNo || '').trim();
  const studentId = fields.studentId ? Number(fields.studentId) : 0;

  const courseOptions = await loadInternshipCourseOptions();
  let students = [];
  let certificateHtml = '';
  let message = '';
  let selectedStudentId = studentId;

  if (studentId) {
    if (searchInput) {
      students = await searchInternshipStudents(searchBy, searchInput);
    }
    certificateHtml = await buildInternshipCertificateHtml(studentId, memberId, audit);
    if (!certificateHtml) message = 'No details found...';
  } else if (searchInput) {
    students = await searchInternshipStudents(searchBy, searchInput);
    if (students.length) {
      selectedStudentId = students[0].id;
      certificateHtml = await buildInternshipCertificateHtml(selectedStudentId, memberId, audit);
    }
    if (!students.length || !certificateHtml) message = 'No details found...';
  }

  await logModulePage(GENERATE_PAGE, 'View', 'Successful', searchInput || String(studentId), memberId, audit);
  return {
    success: true,
    searchBy,
    searchInput,
    courseOptions,
    students,
    selectedStudentId,
    certificateHtml,
    message,
  };
}

export async function saveInternshipGenerate(payload, memberId, audit = {}) {
  return loadInternshipGenerate(memberId, payload, audit);
}

export async function loadInternshipPhoto(memberId, fields = {}, audit = {}) {
  await logModulePage(PHOTO_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    note: 'File name should be "rollno"A.jpg. Individual files less than 3 MB.',
    results: Array.isArray(fields.results) ? fields.results : [],
  };
}

function sanitizeInternshipPhotoName(filename) {
  return String(filename || '').replace(/[\s\-()[\]]/g, '');
}

export async function saveInternshipPhoto(payload, memberId, files = [], audit = {}) {
  if (!files.length) {
    return { success: false, message: 'Please select at least one JPG file.' };
  }

  const overwrite = Boolean(payload.overwriteExists);
  const uploadDir = path.join(config.legacyFilesPath, 'student_idcard');
  fs.mkdirSync(uploadDir, { recursive: true });

  const results = [];
  for (const file of files) {
    const ext = path.extname(file.filename || '').toLowerCase();
    if (ext !== '.jpg' && ext !== '.jpeg') {
      results.push({ filename: file.filename, success: false, message: 'Unsupported file type!' });
      continue;
    }

    const buffer = Buffer.from(file.content, 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      results.push({ filename: file.filename, success: false, message: 'File is too big, it should be less than 3 MB.' });
      continue;
    }

    const storedName = sanitizeInternshipPhotoName(file.filename);
    if (!storedName) {
      results.push({ filename: file.filename, success: false, message: 'Invalid file name.' });
      continue;
    }

    const targetPath = path.join(uploadDir, storedName);
    if (fs.existsSync(targetPath) && !overwrite) {
      results.push({ filename: file.filename, success: false, message: `${storedName} already exists...` });
      continue;
    }

    fs.writeFileSync(targetPath, buffer);
    results.push({ filename: file.filename, success: true, stored: storedName });
  }

  const uploaded = results.filter((row) => row.success).length;
  await logModulePage(PHOTO_PAGE, 'Update', 'Successful', String(uploaded), memberId, audit);
  const allOk = results.every((row) => row.success);
  return {
    success: allOk,
    message: uploaded ? `${uploaded} file(s) uploaded.` : 'Upload failed.',
    results,
    ...(await loadInternshipPhoto(memberId, { results }, { ...audit, skipLog: true })),
  };
}

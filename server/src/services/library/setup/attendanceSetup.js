import { existsSync } from 'fs';
import { join } from 'path';
import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';

// Legacy: library_attendance.php (kiosk shell, menu_enable=0) +
// library_attendance_more.php (the actual staff_id/register_no onchange AJAX
// lookup + insert, flag=1). Both are disabled in the live menu, documented
// here for parity/completeness only (CISFLOW/library-module.md §15).
const PAGE = 'library_attendance.php';
const LEGACY_ROOT = process.env.LEGACY_CIS_PATH || '/home/mapims/cis/cis';

/** mysql2 formats outgoing Date params for DATETIME columns and DATE() row
 * comparisons using local getters, but `.toISOString()` gives *UTC* digits —
 * on this box (Asia/Kolkata, DB session tz=SYSTEM) that silently wrote
 * 04:42 into a row that should read 10:12, and could mis-bucket "today" near
 * midnight. Build the wall-clock string from local getters instead. */
function localSqlDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function localSqlDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function loadAttendanceSetup(memberId, _fields = {}, audit = {}) {
  // Explicit columns — SELECT * pulls updated_dt, which can be a zero date
  // (0000-00-00 00:00:00) that Prisma's raw DateTime decoding rejects.
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, live_attendance, live_att_photo FROM basic_setup_library_tb WHERE id = 1 LIMIT 1',
  );
  const row = rows[0] || {};
  await logLibrarySetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    liveAttendance: Number(row.live_attendance || 0),
    liveAttPhoto: Number(row.live_att_photo || 0),
  };
}

/** Mirrors library_attendance_more.php?flag=1. Looks up staff_id first (active,
 * non-releaved), falling back to student register_no. NOTE (doc §15, open
 * question): the legacy student-lookup branch has no active/releaving-date
 * guard at all — unlike almost every other student lookup in this module.
 * Preserved here exactly as documented rather than "fixed", since this is a
 * parity migration and the doc calls it out as a possible-bug-or-exception
 * needing a product decision, not a confirmed bug like the two flagged ones. */
export async function saveAttendanceSetup(payload, memberId, audit = {}) {
  const staffId = String(payload.staffId || '').trim().toUpperCase();
  if (!staffId) {
    return { success: false, message: `Invalid ID: ${staffId}` };
  }

  const { create } = auditFields(memberId, audit);
  const nowStr = localSqlDateTime(create.created_dt);
  const today = localSqlDate(create.created_dt);

  let personRef = '';
  let personName = '';
  let designationDisplay = '';
  let photoPath = '';

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT staff_id, staff_name, staff_initial, job_category FROM staff_profile_tb WHERE del=1 AND staff_id='${escapeSql(staffId)}'
       AND (releaving_date='0000-00-00' OR releaving_date > CURDATE()) ORDER BY created_dt DESC LIMIT 1`,
  );

  if (staffRows.length) {
    const s = staffRows[0];
    personRef = s.staff_id;
    personName = `${s.staff_name || ''} ${s.staff_initial || ''}`.trim();
    designationDisplay = String(s.job_category ?? '');
    photoPath = join(LEGACY_ROOT, 'files/staff_idcard', `${personRef}.png`);
  } else {
    const studentRows = await prisma.$queryRawUnsafe(
      `SELECT register_no, student_name, student_initial, academic_year, course_id
       FROM student_profile_tb WHERE del=1 AND register_no='${escapeSql(staffId)}' LIMIT 1`,
    );
    if (studentRows.length) {
      const st = studentRows[0];
      personRef = st.register_no;
      personName = `${st.student_name || ''} ${st.student_initial || ''}`.trim();
      const courseRows = await prisma.$queryRawUnsafe(
        `SELECT degree_name, department_name FROM basic_setup_course_tb WHERE del=1 AND id='${escapeSql(String(st.course_id))}' LIMIT 1`,
      );
      const course = courseRows[0] || {};
      let departmentName = String(course.department_name || '').trim();
      departmentName = departmentName && departmentName !== '-' ? ` ${departmentName}` : '';
      designationDisplay = `${st.academic_year || ''} | ${course.degree_name || ''}${departmentName}`;
      photoPath = join(LEGACY_ROOT, 'files/student_idcard', `${personRef}.png`);
    }
  }

  if (!personRef) {
    return { success: false, message: `Invalid ID: ${staffId}` };
  }
  if (!existsSync(photoPath)) {
    photoPath = join(LEGACY_ROOT, 'images/empty_image.jpg');
  }

  const lastRows = await prisma.$queryRawUnsafe(
    `SELECT entry_in_out FROM library_image_att_tb WHERE del=1 AND s_id='${escapeSql(personRef)}'
       AND DATE(entry_date_time)='${escapeSql(today)}' ORDER BY entry_date_time DESC LIMIT 1`,
  );
  // Simple last-state toggle (not the odd/even parity trick the hardware-fed
  // library_attendance table uses elsewhere): last empty/'Out' -> 'In', else 'Out'.
  let entryInOut = 'In';
  if (lastRows.length && lastRows[0].entry_in_out && lastRows[0].entry_in_out !== 'Out') {
    entryInOut = 'Out';
  }

  // `photo` is the webcam-uploaded filename from the client capture step;
  // '-'/absent means no live photo was taken, so fall back to the ID-card image path.
  const photoMarker = payload.photo && payload.photo !== '-' ? String(payload.photo) : photoPath;

  // updated_by/updated_ip/updated_dt are NOT NULL with no column default for
  // the first two (this DB runs in strict SQL mode, unlike whatever mode the
  // legacy mysqli connection tolerates) — filled with the same blank/zero
  // values the column itself defaults to where a default exists, since this
  // is a brand-new row that hasn't been "updated" yet.
  await prisma.$executeRawUnsafe(
    `INSERT INTO library_image_att_tb(s_id, job_category, staff_image, entry_date_time, entry_in_out, manual_entry, created_dt, created_ip, created_by, updated_by, updated_ip, updated_dt)
     VALUES ('${escapeSql(personRef)}', '', '${escapeSql(photoMarker)}', '${escapeSql(nowStr)}', '${escapeSql(entryInOut)}', 0,
       '${escapeSql(nowStr)}', '${escapeSql(create.created_ip)}', '${escapeSql(String(memberId))}', '', '', '0000-00-00 00:00:00')`,
  );

  // Legacy library_attendance_more.php never calls insert_log() itself — only
  // the page load (View, above) is logged. No save-time log call here, to match.

  const timestamp = create.created_dt.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return {
    success: true,
    name: `${personName} (${personRef})`,
    designation: designationDisplay,
    time: timestamp,
    inOut: entryInOut,
    photoUrl: photoMarker,
  };
}

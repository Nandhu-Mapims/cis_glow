import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { toIsoDate } from './setupAudit.js';
import { loadAcademicConfig } from '../shared/ciaSetupHelpers.js';
import { convertNYear } from '../fees/feeHelpers.js';

function fmtDateExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d')) AS ${a}`;
}

function fmtDateTimeExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d %H:%i:%s')) AS ${a}`;
}

export async function loadHostelBlocks() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, block_id, block_name, block_type, floor, fee_id
    FROM hostel_blocks_tb WHERE del = 1 ORDER BY block_name ASC
  `);
  return rows.map((b) => ({
    id: String(b.id),
    name: b.block_name || '',
    blockId: b.block_id || '',
    blockType: b.block_type || '',
  }));
}

export async function loadHostelBlockGroups({ roomAddOnly = false } = {}) {
  const typeFilter = roomAddOnly
    ? `AND LOWER(block_type) IN ('hostel', 'quarters')`
    : `AND LOWER(block_type) NOT IN ('type')`;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, block_id, block_name, block_type
    FROM hostel_blocks_tb WHERE del = 1 ${typeFilter}
    ORDER BY block_type ASC, block_name ASC
  `);
  const groups = new Map();
  for (const row of rows) {
    const type = row.block_type || 'Other';
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push({
      id: Number(row.id),
      blockId: row.block_id || '',
      blockName: row.block_name || '',
      label: `${row.block_id || ''} : ${row.block_name || ''}`.replace(/^ : /, ''),
    });
  }
  return [...groups.entries()].map(([type, blocks]) => ({ type, blocks }));
}

export async function loadHostelRoomTypeOptions() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, block_name FROM hostel_blocks_tb
    WHERE del = 1 AND LOWER(block_type) = 'type'
    ORDER BY block_name ASC
  `);
  return rows.map((row) => ({ id: Number(row.id), name: row.block_name || '' }));
}

export async function loadNextRoomNumber() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT room_id FROM hostel_rooms_tb WHERE del = 1 ORDER BY room_id+0 DESC LIMIT 1
  `);
  return String(Number(rows[0]?.room_id || 0) + 1);
}

export async function loadBlockLabelMap() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, block_id, block_name, block_type
    FROM hostel_blocks_tb WHERE del = 1 ORDER BY block_name ASC
  `);
  const map = {};
  const roomTypeNames = {};
  for (const row of rows) {
    const id = Number(row.id);
    if (String(row.block_type).toLowerCase() === 'type') {
      roomTypeNames[id] = row.block_name || '';
    } else {
      map[id] = `${row.block_type || ''} : ${row.block_id || ''} : ${row.block_name || ''}`;
    }
  }
  return { blockLabels: map, roomTypeNames };
}

export async function loadHostelRoomsForBlock(blockPkId, activeOnly = false) {
  const blockId = escapeSql(String(blockPkId));
  let sql = `
    SELECT id, room_id, room_name, floor_name, bed_count
    FROM hostel_rooms_tb WHERE del = 1 AND block_id = '${blockId}'`;
  if (activeOnly) sql += ' AND is_active = 1';
  sql += ' ORDER BY room_id+0 ASC, room_id ASC';
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map((row) => ({
    id: Number(row.id),
    roomId: row.room_id || '',
    roomName: row.room_name || '',
    floorName: row.floor_name || '',
    bedCount: row.bed_count || '',
    label: `${row.room_id || ''}${row.room_name ? ` : ${row.room_name}` : ''}${row.floor_name ? ` (${row.floor_name})` : ''}`,
  }));
}

export async function loadHostelRooms(activeOnly = true) {
  let sql = `
    SELECT id, block_id, room_id, room_name, room_type, floor_name, bed_count, is_active
    FROM hostel_rooms_tb WHERE del = 1`;
  if (activeOnly) sql += ' AND is_active = 1';
  sql += ' ORDER BY room_name ASC';
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map((r) => ({
    id: String(r.id),
    name: r.room_name || '',
    blockId: r.block_id || '',
    roomId: r.room_id || '',
  }));
}

export async function loadHostelRentals() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, block_id, room_id, rental_amount
    FROM hostel_rental_tb WHERE del = 1 ORDER BY id ASC
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    blockId: r.block_id || '',
    roomId: r.room_id || '',
    rentalAmount: r.rental_amount || '',
  }));
}

export async function lookupStudentByRegister(registerNo) {
  const reg = escapeSql(String(registerNo || '').trim().toUpperCase());
  if (!reg) return null;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, register_no, student_name, student_initial, sms_mobile
    FROM student_profile_tb WHERE del = 1 AND register_no = '${reg}' LIMIT 1
  `);
  const profile = rows[0];
  if (!profile) return null;
  return {
    id: Number(profile.id),
    registerNo: profile.register_no || '',
    name: `${profile.student_initial || ''} ${profile.student_name || ''}`.trim(),
    smsMobile: profile.sms_mobile || '',
  };
}

// Mirrors student_hostel.php's course/academic-year dropdowns for the "Batch"
// (courseId___academicYear) and "Year" (courseId___currentYear___regular|additional)
// search-by modes.
export async function loadHostelSearchCourseOptions() {
  const config = await loadAcademicConfig();
  const courses = await prisma.$queryRawUnsafe(`
    SELECT id, course_name, degree_name, department_name, full_part_time, year_of_start, course_duration
    FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC
  `);

  const batchOptions = [];
  const yearOptions = [];

  for (const course of courses) {
    const dept = String(course.department_name || '').trim();
    const deptLabel = dept && dept !== '-' ? ` - ${dept}` : '';
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    const group = `${course.course_name} | ${course.degree_name}${deptLabel} | ${ft}`;

    const regularYear = config[course.course_name]?.regular || '';
    const startYear = Number(regularYear.split('-')[0]) || 0;
    const yearOfStart = Number(course.year_of_start) || 0;
    for (let y = startYear; y >= yearOfStart; y -= 1) {
      const acYear = `${y}-${y + 1}`;
      batchOptions.push({
        value: `${course.id}___${acYear}`,
        label: `${course.degree_name}${deptLabel} | ${acYear}`,
        group,
      });
    }

    const duration = Number(course.course_duration) || 0;
    const regularGroup = `${group} | Regular`;
    for (let i = 1; i <= duration; i += 1) {
      yearOptions.push({
        value: `${course.id}___${i}___regular`,
        label: `${convertNYear(i, course.course_name)} - ${course.degree_name}${deptLabel}`,
        group: regularGroup,
      });
    }
    if (course.course_name === 'U.G') {
      const additionalGroup = `${group} | Additional`;
      for (let i = 1; i <= duration; i += 1) {
        yearOptions.push({
          value: `${course.id}___${i}___additional`,
          label: `${convertNYear(i, course.course_name)} - ${course.degree_name}${deptLabel}`,
          group: additionalGroup,
        });
      }
    }
  }

  return { batchOptions, yearOptions };
}

function mapStudentRosterRow(row) {
  return {
    id: Number(row.id),
    registerNo: row.register_no || '',
    name: `${row.student_initial || ''} ${row.student_name || ''}`.trim(),
  };
}

export async function searchHostelStudentsByRollNo(rollNoList) {
  const ids = rollNoList.map((r) => String(r).trim().toUpperCase()).filter(Boolean);
  if (!ids.length) return [];
  const where = ids.map((id) => `register_no = '${escapeSql(id)}'`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, register_no, student_name, student_initial
    FROM student_profile_tb WHERE del = 1 AND (${where})
    ORDER BY student_name ASC, student_initial ASC
  `);
  return rows.map(mapStudentRosterRow);
}

export async function searchHostelStudentsByBatch(searchCourseKey) {
  const [courseId, acYear] = String(searchCourseKey || '').split('___');
  if (!courseId || !acYear) return [];
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, register_no, student_name, student_initial
    FROM student_profile_tb
    WHERE del = 1 AND course_id = '${escapeSql(courseId)}' AND academic_year = '${escapeSql(acYear)}'
    ORDER BY student_name ASC, student_initial ASC
  `);
  return rows.map(mapStudentRosterRow);
}

export async function searchHostelStudentsByYear(searchYearKey) {
  const [courseId, yearNum, academicType] = String(searchYearKey || '').split('___');
  if (!courseId || !yearNum || !academicType) return [];

  const courseRows = await prisma.$queryRawUnsafe(`
    SELECT course_name FROM basic_setup_course_tb WHERE del = 1 AND id = '${escapeSql(courseId)}' LIMIT 1
  `);
  const courseName = courseRows[0]?.course_name;
  if (!courseName) return [];
  const config = await loadAcademicConfig();
  const academicYear = academicType === 'additional' ? config[courseName]?.additional : config[courseName]?.regular;
  if (!academicYear) return [];

  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.id, A.register_no, A.student_name, A.student_initial
    FROM student_profile_tb AS A
    INNER JOIN student_academic_tb AS B ON A.id = B.s_id
    WHERE A.del = 1 AND B.del = 1 AND A.course_id = '${escapeSql(courseId)}' AND B.course_id = '${escapeSql(courseId)}'
      AND B.academic_year = '${escapeSql(academicYear)}' AND B.academic_batch = '${escapeSql(academicType)}'
      AND B.current_year = '${escapeSql(yearNum)}'
    ORDER BY A.student_name ASC, A.student_initial ASC
  `);
  return rows.map(mapStudentRosterRow);
}

export async function loadStudentHostelStays(studentId) {
  const sid = escapeSql(String(studentId));
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, block_no, room_no,
      ${fmtDateExpr('from_month', 'from_month')},
      ${fmtDateExpr('to_month', 'to_month')},
      stay_year, join_reason, hostel_discontinue, discontinue_reason
    FROM student_hostel_tb
    WHERE del = 1 AND s_id = '${sid}'
    ORDER BY from_month DESC
  `);
  return rows.map((row) => ({
    id: Number(row.id),
    blockNo: row.block_no || '',
    roomNo: row.room_no || '',
    fromMonth: toIsoDate(row.from_month) || '',
    toMonth: toIsoDate(row.to_month) || '',
    stayYear: row.stay_year || '1',
    joinReason: row.join_reason || '',
    hostelDiscontinue: Number(row.hostel_discontinue) === 1,
    discontinueReason: row.discontinue_reason || '',
  }));
}

export async function loadPassRequests({
  status = null, limit = 100, passType = null, registerNo = '', fromDate = '', toDate = '',
} = {}) {
  let where = 'A.del = 1';
  if (status !== null && status !== 'all') {
    where += ` AND A.status = ${Number(status)}`;
  }
  if (passType === 'home' || passType === 'out') {
    where += ` AND A.pass_type = '${escapeSql(passType)}'`;
  }
  if (registerNo) {
    where += ` AND B.register_no LIKE '%${escapeSql(String(registerNo).toUpperCase())}%'`;
  }
  if (fromDate) where += ` AND DATE(A.from_date) >= '${escapeSql(fromDate)}'`;
  if (toDate) where += ` AND DATE(A.from_date) <= '${escapeSql(toDate)}'`;

  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.id, A.pass_type, A.request_id, A.student_id, A.status, A.comments, A.parent_status, A.purpose_type,
      ${fmtDateTimeExpr('A.from_date', 'from_date')},
      ${fmtDateTimeExpr('A.to_date', 'to_date')},
      ${fmtDateTimeExpr('A.created_dt', 'created_dt')},
      B.register_no, B.student_name, B.student_initial
    FROM hostel_pass_request AS A
    LEFT JOIN student_profile_tb AS B ON A.student_id = B.id AND B.del = 1
    WHERE ${where}
    ORDER BY A.id DESC
    LIMIT ${Number(limit)}
  `);

  const purposeIds = [...new Set(rows.map((r) => String(r.purpose_type || '')).filter(Boolean))];
  let purposeNames = {};
  if (purposeIds.length) {
    const purposeRows = await prisma.$queryRawUnsafe(`
      SELECT id, category_name FROM master_setup
      WHERE (category = 'HostelHomePass' OR category = 'HostelOutPass') AND del != 0
        AND id IN (${purposeIds.map((id) => `'${escapeSql(id)}'`).join(',')})
    `);
    purposeNames = Object.fromEntries(purposeRows.map((p) => [String(p.id), p.category_name || '']));
  }

  return rows.map((row) => ({
    id: Number(row.id),
    requestId: Number(row.request_id),
    passType: row.pass_type || '',
    studentId: row.student_id || '',
    registerNo: row.register_no || '',
    studentName: row.student_name ? `${row.student_initial || ''} ${row.student_name}`.trim() : '',
    fromDate: row.from_date || '',
    toDate: row.to_date || '',
    createdDt: row.created_dt || '',
    purpose: purposeNames[String(row.purpose_type || '')] || '',
    status: Number(row.status || 0),
    comments: row.comments || '',
    parentStatus: Number(row.parent_status || 0),
  }));
}

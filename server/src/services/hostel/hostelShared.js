import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { toIsoDate } from './setupAudit.js';

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

export async function loadPassRequests({ status = null, limit = 100 } = {}) {
  let where = 'A.del = 1';
  if (status !== null && status !== 'all') {
    where += ` AND A.status = ${Number(status)}`;
  }
  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.id, A.pass_type, A.request_id, A.student_id, A.status, A.comments, A.parent_status,
      ${fmtDateTimeExpr('A.from_date', 'from_date')},
      ${fmtDateTimeExpr('A.to_date', 'to_date')},
      B.register_no, B.student_name, B.student_initial
    FROM hostel_pass_request AS A
    LEFT JOIN student_profile_tb AS B ON A.student_id = B.id AND B.del = 1
    WHERE ${where}
    ORDER BY A.id DESC
    LIMIT ${Number(limit)}
  `);
  return rows.map((row) => ({
    id: Number(row.id),
    requestId: Number(row.request_id),
    passType: row.pass_type || '',
    studentId: row.student_id || '',
    registerNo: row.register_no || '',
    studentName: row.student_name ? `${row.student_initial || ''} ${row.student_name}`.trim() : '',
    fromDate: row.from_date || '',
    toDate: row.to_date || '',
    status: Number(row.status || 0),
    comments: row.comments || '',
    parentStatus: Number(row.parent_status || 0),
  }));
}

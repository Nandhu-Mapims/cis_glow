import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import {
  loadHostelBlocks,
  loadHostelRooms,
  loadStudentHostelStays,
  lookupStudentByRegister,
} from '../hostelShared.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'student_hostel.php';

export async function loadStudentHostelSetup(memberId, fields = {}, audit = {}) {
  const registerNo = String(fields.registerNo || '').trim().toUpperCase();
  const [blocks, rooms] = await Promise.all([loadHostelBlocks(), loadHostelRooms(true)]);

  let student = null;
  let stays = [];

  if (registerNo) {
    student = await lookupStudentByRegister(registerNo);
    if (student) {
      stays = await loadStudentHostelStays(student.id);
    }
  }

  await logHostelSetup(PAGE, 'View', 'Successful', registerNo, memberId, audit);
  return {
    registerNo,
    student,
    stays: stays.length ? stays : [{ stayYear: '1', hostelDiscontinue: false }],
    blocks,
    rooms,
  };
}

export async function saveStudentHostelSetup(payload, memberId, audit = {}) {
  const studentId = String(payload.studentId || '').trim();
  if (!studentId) return { success: false, message: 'Student is required' };

  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    await prisma.$executeRawUnsafe(`
      UPDATE student_hostel_tb SET del = 0,
        updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${id}
    `);
    await logHostelSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadStudentHostelSetup(memberId, { registerNo: payload.registerNo }, { ...audit, skipLog: true })),
    };
  }

  if (payload.smsMobile) {
    await prisma.$executeRawUnsafe(`
      UPDATE student_profile_tb SET sms_mobile = '${escapeSql(String(payload.smsMobile))}',
        updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${Number(studentId)} AND del = 1
    `);
  }

  await prisma.$executeRawUnsafe(`
    UPDATE student_hostel_tb SET del = 0,
      updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE s_id = '${escapeSql(studentId)}' AND del = 1
  `);

  const stays = Array.isArray(payload.stays) ? payload.stays : [];
  for (const stay of stays) {
    if (!stay.blockNo && !stay.roomNo && !stay.id) continue;

    const fromMonth = stay.fromMonth || new Date().toISOString().slice(0, 10);
    const toMonth = stay.toMonth || fromMonth;
    const fields = {
      block_no: escapeSql(String(stay.blockNo || '')),
      room_no: escapeSql(String(stay.roomNo || '')),
      from_month: escapeSql(fromMonth),
      to_month: escapeSql(toMonth),
      join_reason: escapeSql(String(stay.joinReason || '')),
      stay_year: escapeSql(String(stay.stayYear || '1')),
      hostel_discontinue: stay.hostelDiscontinue ? 1 : 0,
      discontinue_reason: escapeSql(String(stay.discontinueReason || '')),
    };

    if (stay.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE student_hostel_tb SET
          block_no = '${fields.block_no}', room_no = '${fields.room_no}',
          from_month = '${fields.from_month}', to_month = '${fields.to_month}',
          join_reason = '${fields.join_reason}', stay_year = '${fields.stay_year}',
          hostel_discontinue = ${fields.hostel_discontinue},
          discontinue_reason = '${fields.discontinue_reason}',
          del = 1, updated_dt = NOW(),
          updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
        WHERE id = ${Number(stay.id)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO student_hostel_tb (
          s_id, academic_year, block_no, room_no, from_month, to_month,
          join_reason, stay_year, hostel_discontinue, discontinue_reason,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
        ) VALUES (
          '${escapeSql(studentId)}', '', '${fields.block_no}', '${fields.room_no}',
          '${fields.from_month}', '${fields.to_month}', '${fields.join_reason}', '${fields.stay_year}',
          ${fields.hostel_discontinue}, '${fields.discontinue_reason}',
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
        )
      `);
    }
  }

  await logHostelSetup(PAGE, 'Update', 'Successful', studentId, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadStudentHostelSetup(memberId, { registerNo: payload.registerNo }, { ...audit, skipLog: true })),
  };
}

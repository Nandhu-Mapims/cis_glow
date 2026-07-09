import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { loadHostelBlockGroups, loadNextRoomNumber } from '../hostelShared.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'room_setup_add.php';

export async function loadRoomSetupAddSetup(memberId, _fields = {}, audit = {}) {
  const [blockGroups, nextRoomNo] = await Promise.all([
    loadHostelBlockGroups({ roomAddOnly: true }),
    loadNextRoomNumber(),
  ]);
  await logHostelSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { blockGroups, nextRoomNo };
}

export async function saveRoomSetupAddSetup(payload, memberId, audit = {}) {
  const roomNo = String(payload.roomNo || '').trim();
  if (!roomNo) return { success: false, message: 'Room No is required' };
  if (!payload.blockId) return { success: false, message: 'Block is required' };

  const dup = await prisma.$queryRawUnsafe(`
    SELECT id FROM hostel_rooms_tb WHERE del = 1 AND room_id = '${escapeSql(roomNo)}' LIMIT 1
  `);
  if (dup.length) {
    return { success: false, message: 'Room No Already Exists...' };
  }

  const { create } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    INSERT INTO hostel_rooms_tb (
      room_id, room_name, block_id, floor_name, bed_count, room_type, is_active,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
    ) VALUES (
      '${escapeSql(roomNo)}',
      '${escapeSql(String(payload.roomName || ''))}',
      '${escapeSql(String(payload.blockId))}',
      '${escapeSql(String(payload.floorName || ''))}',
      '${escapeSql(String(payload.bedCount || ''))}',
      '',
      0,
      NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
      NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
    )
  `);

  await logHostelSetup(PAGE, 'Add', 'Successful', roomNo, memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadRoomSetupAddSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}

import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { loadHostelBlockGroups, loadHostelRoomsForBlock } from '../hostelShared.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'room_rental_setup.php';

export async function loadRoomRentalSetupSetup(memberId, fields = {}, audit = {}) {
  const blockGroups = await loadHostelBlockGroups();
  const blockId = String(fields.blockId || '').trim();
  let rows = [];

  if (blockId) {
    const rooms = await loadHostelRoomsForBlock(blockId);
    const rentals = await prisma.$queryRawUnsafe(`
      SELECT id, room_id, rental_amount
      FROM hostel_rental_tb
      WHERE del = 1 AND block_id = '${escapeSql(blockId)}'
    `);
    const rentalByRoom = new Map(rentals.map((r) => [String(r.room_id), r]));
    rows = rooms.map((room) => {
      const rental = rentalByRoom.get(String(room.id));
      return {
        roomPk: room.id,
        roomId: room.roomId,
        roomName: room.roomName,
        floorName: room.floorName,
        rentalId: rental ? Number(rental.id) : null,
        rentalAmount: rental?.rental_amount || '',
      };
    });
  }

  await logHostelSetup(PAGE, 'View', 'Successful', blockId, memberId, audit);
  return { blockGroups, blockId, rows };
}

export async function saveRoomRentalSetupSetup(payload, memberId, audit = {}) {
  const blockId = String(payload.blockId || '').trim();
  if (!blockId) return { success: false, message: 'Block is required' };

  const { create, update } = auditFields(memberId, audit);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  await prisma.$executeRawUnsafe(`
    UPDATE hostel_rental_tb SET del = 0,
      updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(memberId)}'
    WHERE del = 1 AND block_id = '${escapeSql(blockId)}'
  `);

  for (const row of rows) {
    const roomPk = escapeSql(String(row.roomPk || ''));
    const rentalAmount = escapeSql(String(row.rentalAmount || ''));
    if (!roomPk) continue;

    if (row.rentalId) {
      await prisma.$executeRawUnsafe(`
        UPDATE hostel_rental_tb SET
          block_id = '${escapeSql(blockId)}',
          room_id = '${roomPk}',
          rental_amount = '${rentalAmount}',
          del = 1,
          updated_dt = NOW(),
          updated_ip = '${escapeSql(update.updated_ip)}',
          updated_by = '${escapeSql(memberId)}'
        WHERE id = ${Number(row.rentalId)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO hostel_rental_tb (
          block_id, room_id, rental_amount,
          created_dt, created_ip, created_by,
          updated_dt, updated_ip, updated_by, del
        ) VALUES (
          '${escapeSql(blockId)}', '${roomPk}', '${rentalAmount}',
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
        )
      `);
    }
  }

  await logHostelSetup(PAGE, 'Update', 'Successful', blockId, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadRoomRentalSetupSetup(memberId, { blockId }, { ...audit, skipLog: true })),
  };
}

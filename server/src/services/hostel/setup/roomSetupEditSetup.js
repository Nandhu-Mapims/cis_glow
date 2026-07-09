import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import {
  loadBlockLabelMap,
  loadHostelBlockGroups,
  loadHostelRoomTypeOptions,
} from '../hostelShared.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'room_setup_edit.php';
const PAGE_SIZE = 20;

function mapListRow(row, blockLabels, roomTypeNames) {
  const blockPk = Number(row.block_id);
  const roomTypePk = Number(row.room_type);
  return {
    id: Number(row.id),
    roomId: row.room_id || '',
    roomName: row.room_name || '',
    roomTypeLabel: roomTypeNames[roomTypePk] || '',
    blockLabel: blockLabels[blockPk] || row.block_id || '',
    floorName: row.floor_name || '',
  };
}

export async function loadRoomSetupEditSetup(memberId, fields = {}, audit = {}) {
  const editId = parseOptionalId(fields.id);
  const { blockLabels, roomTypeNames } = await loadBlockLabelMap();

  if (editId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, room_id, room_name, room_type, block_id, floor_name, bed_count
      FROM hostel_rooms_tb WHERE del = 1 AND id = ${editId} LIMIT 1
    `);
    const row = rows[0];
    if (!row) return { error: 'Room not found' };

    const [blockGroups, roomTypes] = await Promise.all([
      loadHostelBlockGroups(),
      loadHostelRoomTypeOptions(),
    ]);
    await logHostelSetup(PAGE, 'View', 'Successful', String(editId), memberId, audit);
    return {
      mode: 'edit',
      room: {
        id: Number(row.id),
        roomNo: row.room_id || '',
        roomName: row.room_name || '',
        roomType: row.room_type ? Number(row.room_type) : '',
        blockId: row.block_id ? Number(row.block_id) : '',
        floorName: row.floor_name || '',
        bedCount: row.bed_count || '',
      },
      blockGroups,
      roomTypes,
      listContext: {
        search: String(fields.search || ''),
        page: Number(fields.page) || 1,
      },
    };
  }

  const search = escapeSql(String(fields.search || '').trim());
  const page = Math.max(1, Number(fields.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  let where = 'del = 1';
  if (search) {
    where += ` AND (room_id LIKE '%${search}%' OR room_name LIKE '%${search}%' OR floor_name LIKE '%${search}%')`;
  }

  const [countRows, listRows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM hostel_rooms_tb WHERE ${where}`),
    prisma.$queryRawUnsafe(`
      SELECT id, room_id, room_name, room_type, block_id, floor_name
      FROM hostel_rooms_tb WHERE ${where}
      ORDER BY room_id+0 ASC, room_id ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
  ]);

  const total = Number(countRows[0]?.cnt || 0);
  await logHostelSetup(PAGE, 'View', 'Successful', search, memberId, audit);
  return {
    mode: 'list',
    search: fields.search || '',
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: listRows.map((row) => mapListRow(row, blockLabels, roomTypeNames)),
  };
}

export async function saveRoomSetupEditSetup(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE hostel_rooms_tb SET del = 0,
          updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}',
          updated_by = '${escapeSql(memberId)}'
        WHERE id = ${id}
      `);
      await logHostelSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadRoomSetupEditSetup(memberId, {
          search: payload.search,
          page: payload.page,
        }, { ...audit, skipLog: true })),
      };
    } catch {
      await logHostelSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const id = parseId(payload.id);
  const roomNo = String(payload.roomNo || '').trim();
  const prevRoomNo = String(payload.prevRoomNo || '').trim();
  if (!roomNo) return { success: false, message: 'Room No is required' };

  if (prevRoomNo !== roomNo) {
    const dup = await prisma.$queryRawUnsafe(`
      SELECT id FROM hostel_rooms_tb WHERE del = 1 AND room_id = '${escapeSql(roomNo)}' LIMIT 1
    `);
    if (dup.length) return { success: false, message: 'Room No Already Exists ..' };
  }

  await prisma.$executeRawUnsafe(`
    UPDATE hostel_rooms_tb SET
      room_id = '${escapeSql(roomNo)}',
      room_name = '${escapeSql(String(payload.roomName || ''))}',
      room_type = '${escapeSql(String(payload.roomType || ''))}',
      block_id = '${escapeSql(String(payload.blockId || ''))}',
      floor_name = '${escapeSql(String(payload.floorName || ''))}',
      bed_count = '${escapeSql(String(payload.bedCount || ''))}',
      updated_dt = NOW(),
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(memberId)}'
    WHERE id = ${id}
  `);

  await logHostelSetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadRoomSetupEditSetup(memberId, {
      id,
      search: payload.search,
      page: payload.page,
    }, { ...audit, skipLog: true })),
  };
}

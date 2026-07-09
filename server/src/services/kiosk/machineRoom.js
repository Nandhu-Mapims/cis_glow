import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'machine_room_add.php';

function mapRoom(row, blockMap = {}) {
  const blockId = row.block_id || '';
  return {
    id: Number(row.id),
    blockId,
    blockName: blockMap[blockId] || blockId,
    name: row.room_name || '',
    machineId: row.machine_id || '',
    machineIp: row.machine_ip || '',
    remarks: row.remarks || '',
  };
}

async function loadBlocks() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, block_name FROM blocks_tb WHERE del=1 ORDER BY block_name ASC
  `);
  return rows.map((row) => ({
    value: String(row.id),
    label: row.block_name || '',
  }));
}

async function resolveBlockId(payload, memberId, audit) {
  const { create, update } = auditFields(memberId, audit);
  let blockRef = String(payload.blockId || '').trim();
  const blockName = String(payload.blockName || '').trim();

  if (blockRef === 'add_new') {
    if (!blockName) return { error: 'Block name is required for a new block.' };
    await prisma.$executeRawUnsafe(`
      INSERT INTO blocks_tb (
        block_name, created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
      ) VALUES (
        '${escapeSql(blockName)}', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
        NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
      )
    `);
    const inserted = await prisma.$queryRawUnsafe(`
      SELECT id FROM blocks_tb
      WHERE del=1 AND block_name='${escapeSql(blockName)}'
        AND created_by='${escapeSql(memberId)}'
      ORDER BY id DESC LIMIT 1
    `);
    blockRef = inserted[0]?.id ? String(inserted[0].id) : '';
  } else if (blockRef && blockName) {
    await prisma.$executeRawUnsafe(`
      UPDATE blocks_tb SET block_name='${escapeSql(blockName)}', del=1,
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${Number(blockRef)}
    `);
  }

  if (!blockRef || blockRef === 'add_new') {
    return { error: 'Block selection is required.' };
  }
  return { blockId: blockRef };
}

export async function loadMachineRoom(memberId, fields = {}, audit = {}) {
  const roomId = Number(fields.roomId || 0);
  const search = String(fields.search || '').trim().toLowerCase();

  const [blockOptions, rows] = await Promise.all([
    loadBlocks(),
    prisma.$queryRawUnsafe(`
      SELECT id, block_id, room_name, machine_id, machine_ip, remarks
      FROM rooms_tb WHERE del=1 ORDER BY room_name ASC
    `),
  ]);

  const blockMap = Object.fromEntries(blockOptions.map((b) => [b.value, b.label]));
  let rooms = rows.map((row) => mapRoom(row, blockMap));

  if (search) {
    rooms = rooms.filter((room) => (
      room.name.toLowerCase().includes(search)
      || room.machineId.toLowerCase().includes(search)
      || room.blockName.toLowerCase().includes(search)
    ));
  }

  const selected = rooms.find((r) => r.id === roomId)
    || (roomId ? rows.map((row) => mapRoom(row, blockMap)).find((r) => r.id === roomId) : null)
    || null;

  await logModulePage(PAGE, 'View', 'Successful', String(roomId || ''), memberId, audit);
  return {
    success: true,
    rooms,
    blockOptions,
    roomId: selected ? String(selected.id) : '',
    form: selected ? {
      roomId: selected.id,
      blockId: selected.blockId,
      blockName: selected.blockName,
      name: selected.name,
      machineId: selected.machineId,
      machineIp: selected.machineIp,
      remarks: selected.remarks,
    } : {
      roomId: '',
      blockId: '',
      blockName: '',
      name: '',
      machineId: '',
      machineIp: '',
      remarks: '',
    },
    search: fields.search || '',
  };
}

export async function saveMachineRoom(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    await prisma.$executeRawUnsafe(`
      UPDATE rooms_tb SET del=0, updated_by='${escapeSql(memberId)}',
        updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${Number(payload.roomId)}
    `);
    await logModulePage('machine_room_edit.php', 'Delete', 'Successful', String(payload.roomId), memberId, audit);
    return { success: true, message: 'Room deleted.', ...(await loadMachineRoom(memberId, {}, { ...audit, skipLog: true })) };
  }

  const name = String(payload.name || '').trim();
  if (!name) return { success: false, message: 'Hall/Room name is required.' };

  const machineId = String(payload.machineId || '').trim();
  if (!machineId) return { success: false, message: 'Machine ID is required.' };

  const blockResult = await resolveBlockId(payload, memberId, audit);
  if (blockResult.error) return { success: false, message: blockResult.error };

  const blockId = escapeSql(blockResult.blockId);
  const machineIp = escapeSql(payload.machineIp || '');
  const remarks = escapeSql(payload.remarks || '');

  if (payload.roomId) {
    await prisma.$executeRawUnsafe(`
      UPDATE rooms_tb SET
        block_id='${blockId}', room_name='${escapeSql(name)}', machine_id='${escapeSql(machineId)}',
        machine_ip='${machineIp}', remarks='${remarks}', del=1,
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${Number(payload.roomId)}
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO rooms_tb (
        block_id, room_name, machine_id, machine_ip, remarks,
        created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
      ) VALUES (
        '${blockId}', '${escapeSql(name)}', '${escapeSql(machineId)}', '${machineIp}', '${remarks}',
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
        NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
      )
    `);
  }

  await logModulePage(PAGE, 'Update', 'Successful', name, memberId, audit);
  return { success: true, message: 'Room saved.', ...(await loadMachineRoom(memberId, {}, { ...audit, skipLog: true })) };
}

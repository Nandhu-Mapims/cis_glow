import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'block_setup.php';

function emptyRow() {
  return { blockType: 'Hostel', blockId: '', floor: 'Ground', blockName: '' };
}

function mapRow(row) {
  return {
    id: Number(row.id),
    blockType: row.block_type === 'Quarters' ? 'Quarters' : 'Hostel',
    blockId: row.block_id || '',
    floor: row.floor === 'Second' ? 'Second' : row.floor === 'First' ? 'First' : 'Ground',
    blockName: row.block_name || '',
  };
}

export async function loadBlockSetupSetup(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, block_id, block_name, block_type, floor
    FROM hostel_blocks_tb
    WHERE del = 1 AND block_type != 'Type'
    ORDER BY block_type ASC, block_name ASC
  `);
  const mapped = rows.map(mapRow);
  await logHostelSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    rows: mapped.length ? mapped : [emptyRow()],
  };
}

export async function saveBlockSetupSetup(payload, memberId, audit = {}) {
  const { ip } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE hostel_blocks_tb SET del = 0,
          updated_dt = NOW(),
          updated_ip = '${escapeSql(ip)}',
          updated_by = '${escapeSql(memberId)}'
        WHERE id = ${id}
      `);
      await logHostelSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadBlockSetupSetup(memberId, {}, { ...audit, skipLog: true })),
      };
    } catch {
      await logHostelSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const blockId = String(row.blockId || '').trim();
    if (!blockId) continue;

    const blockType = row.blockType === 'Quarters' ? 'Quarters' : 'Hostel';
    const floor = ['First', 'Second'].includes(row.floor) ? row.floor : 'Ground';
    const blockName = String(row.blockName || '').trim();
    const id = row.id ? parseId(row.id) : null;

    if (!id) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO hostel_blocks_tb (
          block_id, block_type, floor, block_name,
          created_dt, created_ip, created_by,
          updated_dt, updated_ip, updated_by, del
        ) VALUES (
          '${escapeSql(blockId)}', '${escapeSql(blockType)}', '${escapeSql(floor)}', '${escapeSql(blockName)}',
          NOW(), '${escapeSql(ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(ip)}', '${escapeSql(memberId)}', 1
        )
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        UPDATE hostel_blocks_tb SET
          del = 1,
          block_id = '${escapeSql(blockId)}',
          block_type = '${escapeSql(blockType)}',
          floor = '${escapeSql(floor)}',
          block_name = '${escapeSql(blockName)}',
          updated_dt = NOW(),
          updated_ip = '${escapeSql(ip)}',
          updated_by = '${escapeSql(memberId)}'
        WHERE id = ${id}
      `);
    }
  }

  await logHostelSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadBlockSetupSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}

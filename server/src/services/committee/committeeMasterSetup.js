import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { EVENT_TYPE_FLAGS } from './committeeShared.js';

const DESIGNATION_PAGE = 'event_committee_designation.php';
const EVENT_TYPE_PAGE = 'committee_event_type.php';

export async function loadCommitteeDesignation(memberId, _fields, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, category_name, category_sname, category_order
    FROM master_setup WHERE del=1 AND category='Committee Designation' ORDER BY category_order ASC
  `);
  await logModulePage(DESIGNATION_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    rows: rows.map((r) => ({
      id: Number(r.id),
      name: r.category_name || '',
      shortName: r.category_sname || '',
      order: r.category_order ?? 0,
    })),
  };
}

export async function saveCommitteeDesignation(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    await prisma.$executeRawUnsafe(`UPDATE master_setup SET del=0, updated_dt=NOW() WHERE id=${id}`);
    await logModulePage(DESIGNATION_PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Deleted.', ...(await loadCommitteeDesignation(memberId, {}, { ...audit, skipLog: true })) };
  }
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  await prisma.$executeRawUnsafe(`UPDATE master_setup SET del=0, updated_dt=NOW() WHERE del=1 AND category='Committee Designation'`);
  for (const row of rows) {
    const name = escapeSql(row.name || '');
    if (!name) continue;
    if (row.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE master_setup SET category='Committee Designation', category_name='${name}',
          category_sname='${escapeSql(row.shortName || '')}', category_order=${Number(row.order) || 0}, del=1,
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${Number(row.id)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO master_setup (category, category_name, category_sname, category_order, created_dt, created_ip, created_by, del)
        VALUES ('Committee Designation', '${name}', '${escapeSql(row.shortName || '')}', ${Number(row.order) || 0},
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
      `);
    }
  }
  await logModulePage(DESIGNATION_PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Designations saved.', ...(await loadCommitteeDesignation(memberId, {}, { ...audit, skipLog: true })) };
}

export async function loadCommitteeEventType(memberId, fields = {}, audit = {}) {
  const selectedId = fields.eventTypeId ? String(fields.eventTypeId) : '';
  const list = await prisma.$queryRawUnsafe(`
    SELECT id, category_name, category_order, sub_category FROM master_setup
    WHERE del=1 AND category='Event Type' ORDER BY category_order ASC
  `);
  let form = { eventTypeId: '', name: '', order: '', enabledFlags: [] };
  if (selectedId && selectedId !== 'add_new') {
    const row = list.find((r) => String(r.id) === selectedId);
    if (row) {
      form = {
        eventTypeId: String(row.id),
        name: row.category_name || '',
        order: row.category_order ?? '',
        enabledFlags: String(row.sub_category || '').split(',').map((s) => s.trim()).filter(Boolean),
      };
    }
  } else if (selectedId === 'add_new') {
    form = { eventTypeId: 'add_new', name: '', order: '', enabledFlags: [] };
  }
  await logModulePage(EVENT_TYPE_PAGE, 'View', 'Successful', selectedId, memberId, audit);
  return {
    success: true,
    eventTypes: list.map((r) => ({ id: Number(r.id), name: r.category_name || '' })),
    flagOptions: EVENT_TYPE_FLAGS,
    form,
  };
}

export async function saveCommitteeEventType(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  if (payload.action === 'delete') {
    const id = parseId(payload.eventTypeId);
    await prisma.$executeRawUnsafe(`UPDATE master_setup SET del=0, updated_dt=NOW() WHERE id=${id}`);
    await logModulePage(EVENT_TYPE_PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Deleted.', ...(await loadCommitteeEventType(memberId, {}, { ...audit, skipLog: true })) };
  }
  const name = String(payload.name || '').trim();
  if (!name) return { success: false, message: 'Event type name required.' };
  const flags = Array.isArray(payload.enabledFlags) ? payload.enabledFlags.join(',') : '';
  const order = Number(payload.order) || 0;
  if (payload.eventTypeId && payload.eventTypeId !== 'add_new') {
    await prisma.$executeRawUnsafe(`
      UPDATE master_setup SET category_name='${escapeSql(name)}', category_order=${order},
        sub_category='${escapeSql(flags)}', updated_by='${escapeSql(memberId)}',
        updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${Number(payload.eventTypeId)} AND category='Event Type'
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO master_setup (category, category_name, category_order, sub_category, created_dt, created_ip, created_by, del)
      VALUES ('Event Type', '${escapeSql(name)}', ${order}, '${escapeSql(flags)}',
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
    `);
  }
  await logModulePage(EVENT_TYPE_PAGE, 'Update', 'Successful', name, memberId, audit);
  return { success: true, message: 'Event type saved.', ...(await loadCommitteeEventType(memberId, { eventTypeId: payload.eventTypeId }, { ...audit, skipLog: true })) };
}

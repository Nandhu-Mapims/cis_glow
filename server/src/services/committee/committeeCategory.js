import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadWorkTypeOptions } from './committeeShared.js';

const PAGE = 'task_category_setup.php';

function insertClientCategorySql({ name, clientId, create, memberId }) {
  return `
    INSERT INTO t_client_master (
      client_start, client_type, client_id, client_name, client_logo,
      client_industry, client_address, client_country, client_location,
      client_phone, client_fax, client_email, client_skype, client_website,
      client_bankinfo, client_username, client_password, client_about, client_anniversary,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
    ) VALUES (
      DATE(NOW()), '', '${escapeSql(clientId)}', '${escapeSql(name)}', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '0000-00-00',
      NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', '0000-00-00 00:00:00', '', '', 1
    )
  `;
}

function insertClientMasterTypeSql({ categoryId, workTypeId, create, memberId }) {
  return `
    INSERT INTO t_client_master_type (
      task_category_id, task_type_id, created_dt, created_ip, created_by,
      updated_dt, updated_ip, updated_by, del
    ) VALUES (
      ${categoryId}, ${Number(workTypeId)}, NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
      '0000-00-00 00:00:00', '', '', 1
    )
  `;
}

export async function loadCommitteeTaskCategory(memberId, fields = {}, audit = {}) {
  const categoryId = fields.categoryId ? String(fields.categoryId) : '';
  const categories = await prisma.$queryRawUnsafe(`
    SELECT id, client_name FROM t_client_master WHERE del=1 ORDER BY client_name ASC
  `);
  let form = { categoryId: '', name: '', workTypeIds: [] };
  if (categoryId && categoryId !== 'add_new') {
    const row = categories.find((c) => String(c.id) === categoryId);
    const mapped = await prisma.$queryRawUnsafe(`
      SELECT task_type_id FROM t_client_master_type WHERE del=1 AND task_category_id=${Number(categoryId)}
    `);
    form = {
      categoryId,
      name: row?.client_name || '',
      workTypeIds: mapped.map((m) => String(m.task_type_id)),
    };
  } else if (categoryId === 'add_new') {
    form = { categoryId: 'add_new', name: '', workTypeIds: [] };
  }
  await logModulePage(PAGE, 'View', 'Successful', categoryId, memberId, audit);
  return {
    success: true,
    categories: categories.map((c) => ({ id: Number(c.id), name: c.client_name })),
    workTypes: await loadWorkTypeOptions(),
    form,
  };
}

export async function saveCommitteeTaskCategory(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const name = String(payload.name || '').trim();
  if (!name) return { success: false, message: 'Category name required.' };
  let categoryId = payload.categoryId && payload.categoryId !== 'add_new' ? Number(payload.categoryId) : null;

  if (!categoryId) {
    const clientId = `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${Math.floor(1001 + Math.random() * 8999)}`;
    await prisma.$executeRawUnsafe(insertClientCategorySql({ name, clientId, create, memberId }));
    const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
    categoryId = Number(idRows[0]?.id);
  } else {
    await prisma.$executeRawUnsafe(`
      UPDATE t_client_master SET client_name='${escapeSql(name)}',
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${categoryId}
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE t_client_master_type SET del=0,
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE task_category_id=${categoryId}
    `);
  }

  const workTypeIds = Array.isArray(payload.workTypeIds) ? payload.workTypeIds : [];
  for (const wtId of workTypeIds) {
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id FROM t_client_master_type WHERE task_category_id=${categoryId} AND task_type_id=${Number(wtId)} LIMIT 1
    `);
    if (existing[0]?.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE t_client_master_type SET del=1,
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${existing[0].id}
      `);
    } else {
      await prisma.$executeRawUnsafe(insertClientMasterTypeSql({
        categoryId, workTypeId: wtId, create, memberId,
      }));
    }
  }

  await logModulePage(PAGE, 'Update', 'Successful', name, memberId, audit);
  return { success: true, message: 'Category saved.', ...(await loadCommitteeTaskCategory(memberId, { categoryId: String(categoryId) }, { ...audit, skipLog: true })) };
}

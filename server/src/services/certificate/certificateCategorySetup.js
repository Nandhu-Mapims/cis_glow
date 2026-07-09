import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadCerCategories, loadCerSubcategories } from './certificateShared.js';

const PAGE = 'certificate_setup.php';
const TEMPLATES = ['bonafide', 'fee', 'others', 'photocopy', 'custom'];

export async function loadCertificateSetup(memberId, fields = {}, audit = {}) {
  const categoryId = fields.categoryId ? String(fields.categoryId) : '';
  const categories = await loadCerCategories();
  let form = {
    categoryId: categoryId || (categories[0] ? String(categories[0].id) : ''),
    categoryName: '',
    categoryOrder: 0,
    subcategories: [],
  };

  if (form.categoryId && form.categoryId !== 'add_new') {
    const cat = categories.find((c) => String(c.id) === form.categoryId);
    form.categoryName = cat?.name || '';
    form.categoryOrder = Number(cat?.c_order || 0);
    const subs = await loadCerSubcategories(form.categoryId);
    form.subcategories = subs.map((s) => ({
      id: Number(s.id),
      name: s.name,
      order: Number(s.c_order || 0),
      format: s.c_format || '',
      details: s.c_details || '',
    }));
  } else if (form.categoryId === 'add_new') {
    form = { categoryId: 'add_new', categoryName: '', categoryOrder: 0, subcategories: [] };
  }

  await logModulePage(PAGE, 'View', 'Successful', categoryId, memberId, audit);
  return {
    success: true,
    categories: categories.map((c) => ({ id: Number(c.id), name: c.name, order: Number(c.c_order || 0) })),
    templates: TEMPLATES,
    form,
  };
}

export async function saveCertificateSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete' && payload.id) {
    await prisma.$executeRawUnsafe(`
      UPDATE cer_subcategory_tb SET del = 0, updated_dt = NOW(),
        updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${Number(payload.id)}
    `);
    await logModulePage(PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return { success: true, message: 'Subcategory deleted.', ...(await loadCertificateSetup(memberId, { categoryId: String(payload.categoryId || '') }, { ...audit, skipLog: true })) };
  }

  const categoryName = String(payload.categoryName || '').trim();
  if (!categoryName) return { success: false, message: 'Category name required.' };

  let categoryId = payload.categoryId && payload.categoryId !== 'add_new' ? Number(payload.categoryId) : null;
  const categoryOrder = Number(payload.categoryOrder || 0);

  if (!categoryId) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO cer_category_tb (name, c_order, created_dt, created_ip, created_by, del)
      VALUES ('${escapeSql(categoryName)}', ${categoryOrder}, NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
    `);
    const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
    categoryId = Number(idRows[0]?.id);
  } else {
    await prisma.$executeRawUnsafe(`
      UPDATE cer_category_tb SET name = '${escapeSql(categoryName)}', c_order = ${categoryOrder},
        updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}', updated_dt = NOW()
      WHERE id = ${categoryId} AND del = 1
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE cer_subcategory_tb SET del = 0, updated_dt = NOW(),
        updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE c_id = ${categoryId} AND del = 1
    `);
  }

  const subcategories = Array.isArray(payload.subcategories) ? payload.subcategories : [];
  for (const sub of subcategories) {
    const name = String(sub.name || '').trim();
    if (!name) continue;
    const order = Number(sub.order || 0);
    const format = escapeSql(String(sub.format || ''));
    const details = escapeSql(String(sub.details || ''));
    if (sub.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE cer_subcategory_tb SET name = '${escapeSql(name)}', c_order = ${order},
          c_format = '${format}', c_details = '${details}', del = 1,
          updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}', updated_dt = NOW()
        WHERE id = ${Number(sub.id)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO cer_subcategory_tb (c_id, name, c_order, c_format, c_details, created_dt, created_ip, created_by, del)
        VALUES (${categoryId}, '${escapeSql(name)}', ${order}, '${format}', '${details}',
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
      `);
    }
  }

  await logModulePage(PAGE, 'Update', 'Successful', categoryName, memberId, audit);
  return {
    success: true,
    message: 'Certificate setup saved.',
    ...(await loadCertificateSetup(memberId, { categoryId: String(categoryId) }, { ...audit, skipLog: true })),
  };
}

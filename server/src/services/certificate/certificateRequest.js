import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadCerCategories, loadCerSubcategories, lookupStudent, nextApplicationNo } from './certificateShared.js';

const PAGE = 'create_crequest.php';

export async function loadCertificateRequest(memberId, fields = {}, audit = {}) {
  const categories = await loadCerCategories();
  const categoryId = fields.categoryId
    ? String(fields.categoryId)
    : (categories[0] ? String(categories[0].id) : '');
  const subcategories = categoryId ? await loadCerSubcategories(categoryId) : [];

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    categories: categories.map((c) => ({ id: Number(c.id), name: c.name })),
    subcategories: subcategories.map((s) => ({
      id: Number(s.id),
      categoryId: Number(s.c_id),
      name: s.name,
      format: s.c_format || '',
    })),
    form: { categoryId, subcategoryId: '', registerNo: '', photocopyList: [] },
  };
}

export async function saveCertificateRequest(payload, memberId, audit = {}) {
  const { create } = auditFields(memberId, audit);
  const registerNo = String(payload.registerNo || '').trim().toUpperCase();
  const subcategoryId = Number(payload.subcategoryId);
  const categoryId = Number(payload.categoryId);

  if (!registerNo || !subcategoryId) {
    return { success: false, message: 'Register number and certificate type required.' };
  }

  const student = await lookupStudent(registerNo);
  if (!student) return { success: false, message: 'Student not found.' };

  const subs = await loadCerSubcategories(categoryId);
  const sub = subs.find((s) => Number(s.id) === subcategoryId);
  if (!sub) return { success: false, message: 'Invalid certificate type.' };

  const existing = await prisma.$queryRawUnsafe(`
    SELECT id FROM certificate_receipt_tb
    WHERE del = 1 AND apply_for = '${escapeSql(String(subcategoryId))}' AND student_id = '${escapeSql(String(student.id))}' AND status = 0
    LIMIT 1
  `);
  if (existing[0]?.id) return { success: false, message: 'A pending request already exists for this certificate.' };

  const format = String(sub.c_format || '').toLowerCase();
  let applyReason = '';
  if (format === 'photocopy') {
    const list = Array.isArray(payload.photocopyList) ? payload.photocopyList : [];
    if (!list.length) return { success: false, message: 'Select photocopy items.' };
    applyReason = list.join(',');
  }

  const appNo = await nextApplicationNo();
  await prisma.$executeRawUnsafe(`
    INSERT INTO certificate_receipt_tb (
      application_no, application_date, student_id, register_no, apply_for,
      application_fee, apply_reason, address_type, relation_type, status,
      created_dt, created_ip, created_by, del
    ) VALUES (
      ${appNo}, CURDATE(), '${escapeSql(String(student.id))}', '${escapeSql(registerNo)}',
      '${escapeSql(String(subcategoryId))}', '0', '${escapeSql(applyReason)}',
      0, 0, 0, NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1
    )
  `);

  await logModulePage(PAGE, 'Add', 'Successful', String(appNo), memberId, audit);
  return { success: true, message: `Request ${appNo} created.`, applicationNo: appNo };
}

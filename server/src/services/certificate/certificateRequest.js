import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { fmtDateExpr, loadCerCategories, loadCerSubcategories, lookupStudent, nextApplicationNo, receiptBlankColumnsSql } from './certificateShared.js';

const PAGE = 'create_crequest.php';

export async function loadCertificateRequest(memberId, fields = {}, audit = {}) {
  const categories = await loadCerCategories();
  const categoryId = fields.categoryId
    ? String(fields.categoryId)
    : (categories[0] ? String(categories[0].id) : '');
  const subcategories = categoryId ? await loadCerSubcategories(categoryId) : [];

  const photocopyItems = await prisma.$queryRawUnsafe(`
    SELECT id, category_name FROM master_setup WHERE category = 'Attachment' AND del != 0 ORDER BY category_order ASC
  `);

  const lastRequestRows = await prisma.$queryRawUnsafe(`
    SELECT R.application_no, ${fmtDateExpr('R.application_date', 'application_date')}, S.name AS certificate_name,
      A.student_name, A.student_initial, A.register_no, B.degree_name, B.department_name
    FROM certificate_receipt_tb AS R
    LEFT JOIN cer_subcategory_tb AS S ON S.del = 1 AND S.id = R.apply_for
    LEFT JOIN student_profile_tb AS A ON A.del = 1 AND A.id = R.student_id
    LEFT JOIN basic_setup_course_tb AS B ON B.del = 1 AND B.id = A.course_id
    WHERE R.del = 1 ORDER BY R.application_no + 0 DESC LIMIT 1
  `);
  const lr = lastRequestRows[0];
  const lastRequest = lr ? {
    applicationNo: Number(lr.application_no),
    applicationDate: lr.application_date || '',
    certificateName: lr.certificate_name || '',
    studentName: `${lr.student_name || ''} ${lr.student_initial || ''}`.trim(),
    registerNo: lr.register_no || '',
    degreeName: lr.degree_name || '',
    departmentName: lr.department_name || '',
  } : null;

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
    photocopyItems: photocopyItems.map((p) => ({ id: Number(p.id), name: p.category_name })),
    lastRequest,
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
  const { columnsSql, valuesSql } = receiptBlankColumnsSql();
  await prisma.$executeRawUnsafe(`
    INSERT INTO certificate_receipt_tb (
      application_no, application_date, generated_date, student_id, register_no, apply_for,
      application_fee, apply_reason, address_type, relation_type, status,
      created_dt, created_ip, created_by, del, ${columnsSql}
    ) VALUES (
      ${appNo}, CURDATE(), '0000-00-00', '${escapeSql(String(student.id))}', '${escapeSql(registerNo)}',
      '${escapeSql(String(subcategoryId))}', '0', '${escapeSql(applyReason)}',
      0, 0, 0, NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1, ${valuesSql}
    )
  `);

  await logModulePage(PAGE, 'Add', 'Successful', String(appNo), memberId, audit);
  return { success: true, message: `Request ${appNo} created.`, applicationNo: appNo };
}

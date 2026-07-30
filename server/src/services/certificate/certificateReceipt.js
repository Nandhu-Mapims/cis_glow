import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { buildReasonString, CERTIFICATE_COURSE_JOIN, CERTIFICATE_REGISTER_NO_EXPR, CERTIFICATE_STUDENT_JOIN, fmtDateExpr, lookupStudent, nextApplicationNo, receiptBlankColumnsSql } from './certificateShared.js';

const ADD_PAGE = 'certificate_receipt_add.php';
const EDIT_PAGE = 'certificate_receipt_edit.php';
const REPORT_PAGE = 'certificate_receipt_report.php';

const APPLY_TYPES = ['Bonafide', 'Fee', 'Others'];

function mapReceiptRow(row) {
  return {
    id: Number(row.id),
    applicationNo: Number(row.application_no),
    applicationDate: row.application_date || '',
    registerNo: row.register_no || '',
    applyFor: row.apply_for || '',
    applicationFee: row.application_fee || '',
    applyReason: row.apply_reason || '',
    status: Number(row.status || 0),
    studentName: row.student_name ? `${row.student_name} ${row.student_initial || ''}`.trim() : '',
    degreeName: row.degree_name || '',
  };
}

export async function loadCertificateReceiptAdd(memberId, _fields = {}, audit = {}) {
  await logModulePage(ADD_PAGE, 'View', 'Successful', '', memberId, audit);
  return { success: true, applyTypes: APPLY_TYPES };
}

export async function saveCertificateReceiptAdd(payload, memberId, audit = {}) {
  const { create } = auditFields(memberId, audit);
  const registerNo = String(payload.registerNo || '').trim().toUpperCase();
  const applyFor = String(payload.applyFor || '');
  const applicationFee = String(payload.applicationFee || '0');
  const applicationDate = payload.applicationDate || new Date().toISOString().slice(0, 10);

  if (!registerNo || !applyFor) return { success: false, message: 'Register number and apply type required.' };

  const student = await lookupStudent(registerNo);
  if (!student && applyFor !== 'Others') return { success: false, message: 'Student not found.' };

  const { reasonString } = buildReasonString(applyFor, payload);
  const appNo = await nextApplicationNo();
  const studentId = student ? String(student.id) : '';

  const { columnsSql, valuesSql } = receiptBlankColumnsSql();
  await prisma.$executeRawUnsafe(`
    INSERT INTO certificate_receipt_tb (
      application_no, application_date, generated_date, student_id, register_no, apply_for,
      application_fee, apply_reason, address_type, relation_type, status,
      created_dt, created_ip, created_by, del, ${columnsSql}
    ) VALUES (
      ${appNo}, '${escapeSql(applicationDate)}', '0000-00-00', '${escapeSql(studentId)}', '${escapeSql(registerNo)}',
      '${escapeSql(applyFor)}', '${escapeSql(applicationFee)}', '${escapeSql(reasonString)}',
      0, 0, 0, NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1, ${valuesSql}
    )
  `);

  await logModulePage(ADD_PAGE, 'Add', 'Successful', String(appNo), memberId, audit);
  return { success: true, message: `Receipt ${appNo} created.`, applicationNo: appNo };
}

export async function loadCertificateReceiptEdit(memberId, fields = {}, audit = {}) {
  const applicationNo = fields.applicationNo ? String(fields.applicationNo).trim() : '';
  let receipt = null;
  if (applicationNo) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, application_no, ${fmtDateExpr('application_date', 'application_date')},
        register_no, apply_for, application_fee, apply_reason, status
      FROM certificate_receipt_tb WHERE del = 1 AND application_no = ${Number(applicationNo)} LIMIT 1
    `);
    if (rows[0]) {
      receipt = {
        id: Number(rows[0].id),
        applicationNo: Number(rows[0].application_no),
        applicationDate: rows[0].application_date || '',
        registerNo: rows[0].register_no || '',
        applyFor: rows[0].apply_for || '',
        applicationFee: rows[0].application_fee || '',
        applyReason: rows[0].apply_reason || '',
        status: Number(rows[0].status || 0),
      };
    }
  }
  await logModulePage(EDIT_PAGE, 'View', 'Successful', applicationNo, memberId, audit);
  return { success: true, applyTypes: APPLY_TYPES, receipt };
}

export async function saveCertificateReceiptEdit(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const id = Number(payload.id);
  if (!id) return { success: false, message: 'Receipt id required.' };

  const registerNo = String(payload.registerNo || '').trim().toUpperCase();
  const applyFor = String(payload.applyFor || '');
  const applicationFee = String(payload.applicationFee || '0');
  const applicationDate = payload.applicationDate || '';
  const { reasonString } = buildReasonString(applyFor, payload);

  const student = await lookupStudent(registerNo);
  if (!student && applyFor !== 'Others') return { success: false, message: 'Student not found.' };
  const studentId = student ? String(student.id) : '';

  await prisma.$executeRawUnsafe(`
    UPDATE certificate_receipt_tb SET
      application_date = '${escapeSql(applicationDate)}',
      register_no = '${escapeSql(registerNo)}',
      student_id = '${escapeSql(studentId)}',
      apply_for = '${escapeSql(applyFor)}',
      application_fee = '${escapeSql(applicationFee)}',
      apply_reason = '${escapeSql(reasonString)}',
      updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE id = ${id} AND del = 1
  `);

  await logModulePage(EDIT_PAGE, 'Update', 'Successful', String(payload.applicationNo || id), memberId, audit);
  return {
    success: true,
    message: 'Receipt updated.',
    ...(await loadCertificateReceiptEdit(memberId, { applicationNo: String(payload.applicationNo || '') }, { ...audit, skipLog: true })),
  };
}

export async function loadCertificateReceiptReport(memberId, fields = {}, audit = {}) {
  const fromDate = fields.fromDate || new Date().toISOString().slice(0, 10);
  const toDate = fields.toDate || '';
  const searchType = fields.searchType || '';

  let where = 'WHERE R.del = 1';
  if (fromDate) where += ` AND DATE(R.application_date) >= '${escapeSql(fromDate)}'`;
  if (toDate) where += ` AND DATE(R.application_date) <= '${escapeSql(toDate)}'`;
  if (searchType) where += ` AND R.apply_for = '${escapeSql(searchType)}'`;

  const rows = await prisma.$queryRawUnsafe(`
    SELECT R.id, R.application_no, ${fmtDateExpr('R.application_date', 'application_date')},
      ${CERTIFICATE_REGISTER_NO_EXPR} AS register_no, R.apply_for, R.application_fee, R.apply_reason,
      S.student_name, S.student_initial, C.degree_name
    FROM certificate_receipt_tb AS R
    ${CERTIFICATE_STUDENT_JOIN}
    ${CERTIFICATE_COURSE_JOIN}
    ${where}
    ORDER BY R.application_no ASC
  `);

  const receipts = rows.map(mapReceiptRow);
  const totalAmount = receipts.reduce((sum, r) => sum + Number(String(r.applicationFee).replace(/[^0-9.]/g, '') || 0), 0);

  await logModulePage(REPORT_PAGE, 'View', 'Successful', searchType, memberId, audit);
  return {
    success: true,
    applyTypes: APPLY_TYPES,
    filters: { fromDate, toDate, searchType },
    receipts,
    totalAmount,
  };
}

export async function saveCertificateReceiptReport(payload, memberId, audit = {}) {
  await logModulePage(REPORT_PAGE, 'Search', 'Successful', JSON.stringify(payload.filters || {}), memberId, audit);
  return loadCertificateReceiptReport(memberId, payload.filters || payload, { ...audit, skipLog: true });
}

import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logModulePage } from '../shared/moduleAudit.js';
import { CERTIFICATE_COURSE_JOIN, CERTIFICATE_REGISTER_NO_EXPR, CERTIFICATE_STUDENT_JOIN, fmtDateExpr } from './certificateShared.js';

const PAGE = 'certificate_generate.php';

export async function loadCertificateGenerate(memberId, fields = {}, audit = {}) {
  const searchInput = String(fields.searchInput || '').trim();
  let receipts = [];

  if (searchInput) {
    const nums = searchInput.split(/[\s,]+/).filter(Boolean).map((n) => Number(n)).filter((n) => !Number.isNaN(n));
    const regs = searchInput.split(/[\s,]+/).filter((t) => Number.isNaN(Number(t))).map((t) => escapeSql(t.trim().toUpperCase())).filter(Boolean);

    const clauses = [];
    if (nums.length) clauses.push(`R.application_no IN (${nums.join(',')})`);
    if (regs.length) clauses.push(`${CERTIFICATE_REGISTER_NO_EXPR} IN ('${regs.join("','")}')`);
    if (clauses.length) {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT R.id, R.application_no, ${fmtDateExpr('R.application_date', 'application_date')},
          ${fmtDateExpr('R.generated_date', 'generated_date')},
          ${CERTIFICATE_REGISTER_NO_EXPR} AS register_no, R.apply_for, R.application_fee, R.apply_reason, R.status,
          R.certificate_content, R.comments,
          S.student_name, S.student_initial, C.degree_name, C.department_name
        FROM certificate_receipt_tb AS R
        ${CERTIFICATE_STUDENT_JOIN}
        ${CERTIFICATE_COURSE_JOIN}
        WHERE R.del = 1 AND (${clauses.join(' OR ')})
        ORDER BY R.application_no ASC
      `);
      receipts = rows.map((r) => ({
        id: Number(r.id),
        applicationNo: Number(r.application_no),
        applicationDate: r.application_date || '',
        generatedDate: r.generated_date || '',
        registerNo: r.register_no || '',
        applyFor: r.apply_for || '',
        applicationFee: r.application_fee || '',
        applyReason: r.apply_reason || '',
        status: Number(r.status || 0),
        certificateContent: r.certificate_content || '',
        comments: r.comments || '',
        studentName: r.student_name ? `${r.student_name} ${r.student_initial || ''}`.trim() : '',
        degreeName: r.degree_name || '',
        departmentName: r.department_name || '',
      }));
    }
  }

  await logModulePage(PAGE, 'View', 'Successful', searchInput, memberId, audit);
  return { success: true, searchInput, receipts };
}

export async function saveCertificateGenerate(payload, memberId, audit = {}) {
  return loadCertificateGenerate(memberId, payload, { ...audit, skipLog: false });
}

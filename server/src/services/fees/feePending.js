import { runLegacyBridge } from '../legacy/phpBridge.js';
import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

function parseStudentLabel(label) {
  const text = String(label || '').trim();
  if (!text.includes('|')) {
    return { studentName: text, degreeName: '' };
  }
  const [studentName, degreeName] = text.split('|').map((part) => part.trim());
  return { studentName, degreeName };
}

function formatLegacySlip(row) {
  const { studentName, degreeName } = parseStudentLabel(row.studentLabel);
  return {
    groupId: row.groupId,
    registerNo: row.registerNo,
    studentName,
    degreeName,
    paidDate: row.paidDate,
    payBank: row.payBank,
    amount: row.amount,
    receipts: row.receipts || '',
    createdAt: '',
    createdBy: '',
  };
}

async function loadPendingFeeSlipsFromSql(payload = {}) {
  const limit = Math.min(Number(payload.limit) || 50, 100);
  const registerNo = String(payload.registerNo || '').trim();

  let whereSql = 'S.del = 1 AND S.f_status = 0 AND S.group_id != \'\' AND S.id > 306';
  if (registerNo) {
    whereSql += ` AND S.register_no LIKE '${escapeSql(registerNo)}'`;
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT S.group_id, S.register_no, CAST(S.paid_date AS CHAR) AS paid_date,
            S.pay_bank, S.ref_id, CAST(S.created_dt AS CHAR) AS created_dt, S.created_by,
            P.student_name, P.student_initial, C.degree_name
     FROM fee_slip_tb AS S
     LEFT JOIN student_profile_tb AS P ON P.del = 1 AND P.register_no = S.register_no
     LEFT JOIN basic_setup_course_tb AS C ON C.del = 1 AND C.id = P.course_id
     WHERE ${whereSql}
     ORDER BY S.created_dt ASC
     LIMIT ${limit * 3}`,
  );

  const seen = new Set();
  const slips = [];
  rows.forEach((row) => {
    if (seen.has(row.group_id)) return;
    seen.add(row.group_id);
    const studentName = [row.student_name, row.student_initial].filter(Boolean).join(' ').trim();
    slips.push({
      groupId: row.group_id,
      registerNo: row.register_no,
      studentName,
      degreeName: row.degree_name || '',
      paidDate: row.paid_date,
      payBank: row.pay_bank,
      amount: row.ref_id,
      receipts: '',
      createdAt: row.created_dt,
      createdBy: row.created_by,
    });
  });

  return { slips: slips.slice(0, limit), total: slips.length };
}

export async function getPendingFeeSlips(payload = {}) {
  const registerNo = String(payload.registerNo || '').trim();

  try {
    const raw = await runLegacyBridge('student_fee_pending_list.php', {
      memberId: 'CISADMIN',
      registerNo: registerNo || undefined,
    });
    const parsed = JSON.parse(raw);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return {
      slips: (parsed.slips || []).map(formatLegacySlip),
      total: parsed.total ?? (parsed.slips || []).length,
      source: 'legacy',
    };
  } catch (err) {
    console.error('Legacy pending slip list failed, using SQL fallback:', err.message);
    const result = await loadPendingFeeSlipsFromSql(payload);
    return { ...result, source: 'sql' };
  }
}

import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logFeeSetup } from './setupAudit.js';

const PAGE = 'fee_bank_config.php';

function normalizePtext(value) {
  return String(value || '').trim().toUpperCase();
}

function mapRow(row) {
  return {
    id: row.id,
    bankId: row.bank_id,
    bankPtext: row.bank_ptext,
    bankName: row.bank_name,
    cbiAccNo: row.cbi_acc_no,
    axisAccNo: row.axis_acc_no,
    sbiAccNo: row.sbi_acc_no,
  };
}

async function fetchRows() {
  const rows = await prisma.fee_bank_master.findMany({
    where: { del: 1 },
    orderBy: { bank_id: 'asc' },
  });
  return rows.map(mapRow);
}

export async function loadFeeBankSetup(memberId, _fields, audit = {}) {
  const rows = await fetchRows();
  await logFeeSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { rows };
}

export async function saveFeeBankSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.fee_bank_master.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logFeeSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return { success: true, message: 'Your details are deleted...', rows: await fetchRows() };
    } catch {
      await logFeeSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.fee_bank_master.updateMany({
    where: { del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const bankId = String(row.bankId || '').trim();
    const bankPtext = normalizePtext(row.bankPtext);
    const bankName = String(row.bankName || '').trim();
    const cbiAccNo = String(row.cbiAccNo || '').trim();
    const axisAccNo = String(row.axisAccNo || '').trim();
    const sbiAccNo = String(row.sbiAccNo || '').trim();

    if (!row.id) {
      if (!bankId) continue;
      await prisma.fee_bank_master.create({
        data: {
          bank_id: bankId,
          bank_ptext: bankPtext,
          bank_name: bankName,
          cbi_acc_no: cbiAccNo,
          axis_acc_no: axisAccNo,
          sbi_acc_no: sbiAccNo,
          ...create,
        },
      });
    } else {
      await prisma.fee_bank_master.update({
        where: { id: Number(row.id) },
        data: {
          del: 1,
          bank_id: bankId,
          bank_ptext: bankPtext,
          bank_name: bankName,
          cbi_acc_no: cbiAccNo,
          axis_acc_no: axisAccNo,
          sbi_acc_no: sbiAccNo,
          ...update,
        },
      });
    }
  }

  await logFeeSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Your details are Updated...', rows: await fetchRows() };
}

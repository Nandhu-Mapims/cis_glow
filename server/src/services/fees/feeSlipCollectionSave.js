import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatDisplayDate, formatIndianMoney, loadFeeLabelMap, parseDisplayDate } from './feeHelpers.js';

const BANK_TITLES = {
  cbi: { title: 'CENTRAL BANK OF INDIA', branch: 'Melmaruvathur - 603319' },
  axis: { title: 'AXIS BANK', branch: 'Maduranthakam - 603306' },
  sbi: { title: 'STATE BANK OF INDIA', branch: 'Melmaruvathur - 603319' },
};

async function ensureBankSeed(bankId, memberId, ip, now) {
  const exists = await prisma.$queryRawUnsafe(
    `SELECT id FROM fee_slip_tb WHERE del = 1 AND bank_id = '${escapeSql(bankId)}' LIMIT 1`,
  );
  if (!exists.length) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO fee_slip_tb (
         group_id, bank_id, pay_bank, receipt_no, register_no, paid_date, ref_id,
         discount_details, slip_details, f_status, created_dt, created_ip, created_by,
         updated_dt, updated_by, updated_ip, del
       ) VALUES (
         '', '${escapeSql(bankId)}', '', 0, '', '0000-00-00', '0',
         '', '', 0, '${escapeSql(now)}', '${escapeSql(ip)}', '${escapeSql(memberId)}',
         '0000-00-00 00:00:00', '', '', 1
       )`,
    );
  }
}

async function nextSlipReceiptNo(
  bankId, groupId, registerNo, paidDate, memberId, ip, now, refTotal, slipDetailsJson, payBank,
  discountDetails = '',
) {
  await ensureBankSeed(bankId, memberId, ip, now);
  await prisma.$executeRawUnsafe(
    `INSERT INTO fee_slip_tb (
       group_id, bank_id, pay_bank, receipt_no, register_no, paid_date, ref_id,
       discount_details, slip_details, created_dt, created_ip, created_by,
       updated_dt, updated_by, updated_ip, del, f_status
     )
     SELECT '${escapeSql(groupId)}', '${escapeSql(bankId)}', '${escapeSql(payBank)}', (receipt_no + 1),
            '${escapeSql(registerNo)}', '${escapeSql(paidDate)}', '${escapeSql(String(refTotal))}',
            '${escapeSql(discountDetails)}', '${escapeSql(slipDetailsJson)}',
            '${escapeSql(now)}', '${escapeSql(ip)}', '${escapeSql(memberId)}',
            '0000-00-00 00:00:00', '', '', 1, 0
     FROM fee_slip_tb WHERE bank_id = '${escapeSql(bankId)}' ORDER BY receipt_no DESC LIMIT 1`,
  );
  const rows = await prisma.$queryRawUnsafe(
    `SELECT receipt_no FROM fee_slip_tb
     WHERE del = 1 AND bank_id = '${escapeSql(bankId)}' AND group_id = '${escapeSql(groupId)}'
       AND register_no = '${escapeSql(registerNo)}' AND paid_date = '${escapeSql(paidDate)}' LIMIT 1`,
  );
  return String(rows[0]?.receipt_no || '1').padStart(4, '0');
}

function buildBankSlipHtml({
  studentName, registerNo, degreeName, stuCurrentYear, payBank, paidDateDisplay,
  bankPrefix, receiptNo, bankAccNo, feeSlipByBank, feeLabels, copyLabel,
}) {
  const bankInfo = BANK_TITLES[payBank] || BANK_TITLES.cbi;
  let parts = `<div class="receipt_container">
<table width="100%" cellspacing="0" cellpadding="0" border="0"><tbody>
<tr><td valign="middle" align="center" height="20"></td></tr>
<tr><td valign="middle" align="center" height="30"><small class="h_title">Om Sakthi</small></td></tr>
<tr><td valign="middle" align="right"><div class="h_acno">${bankAccNo || ''}</div></td></tr>
<tr><td valign="middle" align="center">
<p class="slip_title">${bankInfo.title}</p>
<p class="slip_title_1">Adhiparasakthi Dental College & Hospital</p>
<p class="slip_title_2">${bankInfo.branch}</p></td></tr></tbody></table>
<table width="100%" cellspacing="0" cellpadding="5" border="0"><tbody>
<tr>
<td valign="middle" align="left" width="50%" nowrap><p class="receipt_no">No: <strong>${bankPrefix}${receiptNo}</strong></p></td>
<td valign="middle" align="left" width="50%" nowrap><p class="receipt_no">Date: <strong>${paidDateDisplay}</strong></p></td>
</tr></tbody></table>
<table width="100%" cellspacing="0" cellpadding="5" border="0"><tbody>
<tr><td width="7%"><p class="receipt_txt">Name</p></td><td width="1%"><p class="receipt_txt nopadding">:</p></td>
<td width="92%"><p class="receipt_txt nopadding"><strong>${studentName}</strong></p></td></tr>
<tr><td><p class="receipt_txt">Course</p></td><td><p class="receipt_txt nopadding">:</p></td>
<td><p class="receipt_txt nopadding"><strong>${registerNo} | ${stuCurrentYear ? `${stuCurrentYear} ` : ''}${degreeName}</strong></p></td></tr>
</tbody></table>
<table width="93%" cellspacing="0" cellpadding="3" border="0" class="tablemargin border_top border_left border_right border_bottom"><tbody>
<tr><td width="65%" class="border_bottom"><p class="receipt_txt"><strong>Particulars</strong></p></td>
<td width="35%" class="border_bottom border_left"><p class="receipt_txt"><strong>Amount</strong></p></td></tr>`;

  let total = 0;
  Object.entries(feeSlipByBank).forEach(([feeNameId, amount]) => {
    if (feeNameId === 'fine' || feeNameId === 'dis') return;
    const label = feeLabels[feeNameId] || feeNameId;
    const amt = Number(amount) || 0;
    total += amt;
    parts += `<tr><td><p class="receipt_txt nopadding">${label}</p></td>
<td align="right" class="border_left"><p class="receipt_txt nopadding">${formatIndianMoney(amt)}</p></td></tr>`;
  });
  if (feeSlipByBank.fine) {
    total += Number(feeSlipByBank.fine);
    parts += `<tr><td><p class="receipt_txt nopadding">Fine</p></td>
<td align="right" class="border_left"><p class="receipt_txt nopadding">${formatIndianMoney(feeSlipByBank.fine)}</p></td></tr>`;
  }
  if (feeSlipByBank.dis?.amt) {
    total -= Number(feeSlipByBank.dis.amt);
    parts += `<tr><td><p class="receipt_txt nopadding">Concession${feeSlipByBank.dis.msg ? ` - ${feeSlipByBank.dis.msg}` : ''}</p></td>
<td align="right" class="border_left"><p class="receipt_txt nopadding">-${formatIndianMoney(feeSlipByBank.dis.amt)}</p></td></tr>`;
  }
  parts += `<tr><td align="right"><strong>Total</strong></td><td align="right" class="border_left"><strong>${formatIndianMoney(total)}</strong></td></tr>
</tbody></table>
<table width="100%" cellspacing="0" cellpadding="5" border="0"><tbody>
<tr>
<td valign="bottom" align="center" width="50%"><p class="receipt_txt">Student / Parent</p></td>
<td valign="bottom" align="center" width="50%"><p class="receipt_txt">Accountant</p></td>
</tr></tbody></table>
${copyLabel ? `<p class="receipt_txt text-center" style="margin:8px 0 0;font-weight:bold;">${copyLabel}</p>` : ''}
</div>`;
  return parts;
}

const SLIP_COPY_LABELS = ['COLLEGE COPY', 'BANK COPY', "REMITTER'S COPY", "REMITTER'S COPY"];

function wrapSlipCopies(slipArgs) {
  const copies = SLIP_COPY_LABELS.map((copyLabel) => buildBankSlipHtml({ ...slipArgs, copyLabel }));
  return `<div class="page_container fee-slip-print-page">${copies.join('')}</div>`;
}

export async function saveCollectionSlip(payload, memberId, meta = {}) {
  const entries = payload.entries;
  if (!payload.meta?.registerNo || !Array.isArray(entries)) {
    return { success: false, error: 'meta and entries are required' };
  }

  const selected = entries.filter((e) => e.selected);
  if (!selected.length) {
    return { success: false, error: 'Select at least one fee line' };
  }

  const registerNo = payload.meta.registerNo;
  const paidDateSql = parseDisplayDate(payload.paidDate);
  const payBank = payload.payBank || 'cbi';
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const ip = meta.ip || '';

  const totals = payload.totals || {};
  const feePaidDetails = {};
  const finalFeeSlip = {};

  selected.forEach((entry) => {
    const ftype = entry.feeType;
    const feeId = entry.feeId;
    if (!feePaidDetails[ftype]) feePaidDetails[ftype] = {};
    feePaidDetails[ftype][feeId] = {
      cyear: entry.classYear,
      acyear: entry.academicYear,
      acbatch: entry.academicBatch,
      payment: entry.paymentNo,
      name: entry.feeName,
      fee: entry.tfeeAmount,
      balance: entry.balanceAmount,
      paid: entry.feeAmount,
      fee_fine: entry.feeFine,
      total: totals[ftype]?.fee ?? entry.feeAmount,
      fine: totals[ftype]?.fine ?? entry.feeFine,
      ftotal: totals[ftype]?.total ?? entry.feeAmount,
      dis: totals[ftype]?.discount ?? '0',
      dis_det: totals[ftype]?.discountDetails ?? '',
    };

    const bankName = entry.feeBank;
    if (!finalFeeSlip[bankName]) finalFeeSlip[bankName] = {};
    finalFeeSlip[bankName][entry.feeName] = (finalFeeSlip[bankName][entry.feeName] || 0) + Number(entry.feeAmount || 0);
    const fineAmt = totals[ftype]?.fine ?? entry.feeFine;
    if (Number(fineAmt) > 0) finalFeeSlip[bankName].fine = fineAmt;
    const disAmt = totals[ftype]?.discount;
    if (Number(disAmt) > 0) {
      finalFeeSlip[bankName].dis = { amt: disAmt, msg: totals[ftype]?.discountDetails || '' };
    }
  });

  const slipDetailsJson = JSON.stringify(feePaidDetails);
  const groupId = `${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 14)}${registerNo}`;
  const discountDetails = Object.values(totals)
    .map((t) => t?.discountDetails)
    .filter(Boolean)
    .join('; ');

  let fTotalAmt = 0;
  Object.values(finalFeeSlip).forEach((bankFees) => {
    Object.entries(bankFees).forEach(([k, v]) => {
      if (k === 'dis') fTotalAmt -= Number(v.amt || 0);
      else if (k !== 'fine') fTotalAmt += Number(v || 0);
      else fTotalAmt += Number(v || 0);
    });
  });

  const { labels: feeLabels } = await loadFeeLabelMap(prisma);
  const bankRows = await prisma.$queryRawUnsafe(
    'SELECT id, bank_ptext, cbi_acc_no, axis_acc_no, sbi_acc_no FROM fee_bank_master WHERE del = 1 ORDER BY bank_id ASC',
  );
  const bankMap = {};
  bankRows.forEach((b) => {
    bankMap[b.id] = {
      ptxt: b.bank_ptext,
      acc: { cbi: b.cbi_acc_no, axis: b.axis_acc_no, sbi: b.sbi_acc_no },
    };
  });

  const studentRows = await prisma.$queryRawUnsafe(
    `SELECT A.student_name, A.student_initial, A.id, A.course_id, B.degree_name
     FROM student_profile_tb AS A
     INNER JOIN basic_setup_course_tb AS B ON A.course_id = B.id
     WHERE A.del = 1 AND B.del = 1 AND A.register_no = '${escapeSql(registerNo)}' LIMIT 1`,
  );
  const stu = studentRows[0] || {};
  const studentName = `${stu.student_name || ''} ${stu.student_initial || ''}`.trim();
  const degreeName = stu.degree_name || '';
  const yearRows = await prisma.$queryRawUnsafe(
    `SELECT current_year FROM student_academic_tb
     WHERE del = 1 AND s_id = '${escapeSql(stu.id)}' AND course_id = '${escapeSql(stu.course_id)}'
     ORDER BY academic_year DESC, academic_batch DESC LIMIT 1`,
  );
  const stuCurrentYear = yearRows[0]?.current_year
    ? `${yearRows[0].current_year} Year`
    : '';

  const receiptParts = [];
  for (const [bankId, feeList] of Object.entries(finalFeeSlip)) {
    const receiptNo = await nextSlipReceiptNo(
      bankId, groupId, registerNo, paidDateSql, memberId, ip, now, fTotalAmt, slipDetailsJson, payBank,
      discountDetails,
    );
    const prefix = bankMap[bankId]?.ptxt || '';
    const accNo = bankMap[bankId]?.acc?.[payBank] || '';
    receiptParts.push(wrapSlipCopies({
      studentName,
      registerNo,
      degreeName,
      stuCurrentYear,
      payBank,
      paidDateDisplay: formatDisplayDate(paidDateSql),
      bankPrefix: prefix,
      receiptNo,
      bankAccNo: accNo,
      feeSlipByBank: feeList,
      feeLabels,
    }));
  }

  return {
    success: true,
    message: 'Fee slip generated',
    groupId,
    receiptHtml: receiptParts.join('<div style="page-break-after:always;height:16px;"></div>'),
  };
}

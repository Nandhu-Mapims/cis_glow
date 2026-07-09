import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  convertNumberToWords,
  formatDisplayDate,
  formatIndianMoney,
  loadFeeLabelMap,
  parseDisplayDate,
  titleCaseName,
} from './feeHelpers.js';

function buildAmountDetails(amountType, payment = {}) {
  if (amountType === 'Bank' || amountType === 'RTGS/NEFT') {
    return [payment.bankRefNo || '', payment.bankDate || '', payment.bankAmount || ''].join('^^^');
  }
  if (amountType === 'Cash') {
    return [
      payment.otherte || '', payment.fivete || '', payment.onehu || '',
      payment.fivehu || '', payment.oneth || '',
    ].join('^^^');
  }
  return [
    payment.chequeNo || '', payment.chequeDate || '', payment.chequeAmount || '', payment.chequeBankName || '',
  ].join('^^^');
}

async function nextReceiptNo(feeTypeId) {
  const typeRows = await prisma.$queryRawUnsafe(
    `SELECT fee_id FROM fee_type_master WHERE del = 1 AND id = '${escapeSql(feeTypeId)}' LIMIT 1`,
  );
  const prefix = typeRows[0]?.fee_id || '';
  const siz = prefix.length + 1;
  const lastRows = await prisma.$queryRawUnsafe(
    `SELECT (SUBSTR(receipt_no, ${siz}) + 1) AS n FROM student_fee
     WHERE receipt_no LIKE '${escapeSql(prefix)}%' AND del = 1
     ORDER BY SUBSTR(receipt_no, ${siz}) + 0 DESC LIMIT 1`,
  );
  let padLen = String(lastRows[0]?.n || '').length;
  if (padLen < 3) padLen = 3;
  const nextRows = await prisma.$queryRawUnsafe(
    `SELECT CONCAT('${escapeSql(prefix)}', LPAD((SUBSTR(receipt_no, ${siz}) + 1), ${padLen}, '0')) AS r
     FROM student_fee WHERE receipt_no LIKE '${escapeSql(prefix)}%' AND del = 1
     ORDER BY SUBSTR(receipt_no, ${siz}) + 0 DESC LIMIT 1`,
  );
  return nextRows[0]?.r || `${prefix}001`;
}

function buildApprovalReceiptHtml({
  bannerImage, receiptNo, paidDate, studentName, degreeName, registerNo,
  feeTypeNames, totalAmount, amountType, paymentLabel,
}) {
  const banner = bannerImage ? `<img src='img/global_images/${bannerImage}' width='350' />` : '';
  const feenameString = ` For ${feeTypeNames.join(' & ')}<br>`;
  return `<div id="container" style="min-height:512px;width:100%;height:auto;">
<table align="center" border="0" cellpadding="2" cellspacing="2" width="100%"><tbody>
<tr><td colspan="2"><div id="top"><table border="0" width="100%"><tbody><tr>
<td height="92" valign="middle"><h2>${banner}</h2></td>
<td colspan="3" align="center" valign="middle"><p style="font-size:16px;"><strong>FEE RECEIPT</strong></p></td>
</tr></tbody></table></div></td></tr>
<tr><td colspan="2"><table border="0" width="85%" align="center"><tbody>
<tr><td><strong>Receipt No:</strong> ${receiptNo}</td><td><strong>Date:</strong> ${formatDisplayDate(paidDate)}</td></tr>
<tr><td colspan="2"><strong>Student Name:</strong> ${studentName}</td></tr>
<tr><td colspan="2">${registerNo} | ${degreeName}</td></tr>
</tbody></table></td></tr>
<tr><td colspan="2"><table class="fees_table" width="85%" align="center"><tbody>
<tr><td bgcolor="#F0F0F0" width="37%"><strong>Particulars</strong></td>
<td bgcolor="#F0F0F0" width="21%" align="center"><strong>Amount (Rs.)</strong></td></tr>
<tr><td style="padding:15px;">${feenameString}</td>
<td align="center"><strong>${formatIndianMoney(totalAmount)}</strong></td></tr>
<tr><td colspan="2">In words: ${convertNumberToWords(totalAmount)} Rupees only.</td></tr>
</tbody></table></td></tr>
<tr><td><strong>Received by:</strong> ${amountType}<br>${paymentLabel || ''}</td></tr>
</tbody></table></div>`;
}

export async function saveApprovalSlip(payload, memberId, meta = {}) {
  const groupId = String(payload.groupId || '').trim();
  const entries = payload.entries;
  if (!groupId || !payload.meta?.registerNo || !Array.isArray(entries)) {
    return { success: false, error: 'groupId, meta and entries are required' };
  }

  const selected = entries.filter((e) => e.selected);
  if (!selected.length) return { success: false, error: 'No fee lines to approve' };

  const paidDate = parseDisplayDate(payload.paidDate);
  const amountType = payload.payment?.amountType || 'Bank';
  const amountDetails = buildAmountDetails(amountType, payload.payment || {});
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const ip = meta.ip || '';
  const registerNo = payload.meta.registerNo;
  const courseId = payload.meta.courseId;
  const admissionYear = payload.meta.admissionYear;
  const totals = payload.totals || {};
  const withPrint = payload.submitAction === 'Submit_Print';

  const { labels: feeLabels } = await loadFeeLabelMap(prisma);
  const byType = {};
  selected.forEach((entry) => {
    if (!byType[entry.feeType]) byType[entry.feeType] = [];
    byType[entry.feeType].push(entry);
  });

  let receiptHtml = '';
  const receiptNos = [];

  for (const [ftype, lines] of Object.entries(byType)) {
    const receiptNo = await nextReceiptNo(ftype);
    receiptNos.push(receiptNo);
    const t = totals[ftype] || {};
    const feeTypeNameArr = [];
    let totalFine = 0;
    let totalDiscount = 0;
    let refTotal = 0;

    for (const entry of lines) {
      const fine = t.fine ?? entry.feeFine ?? '0';
      const dis = t.discount ?? '0';
      const disDet = t.discountDetails ?? '';
      const tot = t.fee ?? entry.feeAmount ?? '0';
      const ftot = t.total ?? entry.feeAmount ?? '0';

      await prisma.$executeRawUnsafe(
        `INSERT INTO student_fee (
          receipt_no, paid_date, register_no, course_id, admission_year, academic_year, academic_batch,
          class_year, fee_id, fee_name, payment_no, fee_amount, fee_fine, amount, fine_amount, total_amount,
          amount_type, amount_details, discount_amount, discount_details, slip_id,
          created_dt, created_ip, created_by, del
        ) VALUES (
          '${escapeSql(receiptNo)}', '${escapeSql(paidDate)}', '${escapeSql(registerNo)}', '${escapeSql(courseId)}',
          '${escapeSql(admissionYear)}', '${escapeSql(entry.academicYear)}', '${escapeSql(entry.academicBatch)}',
          '${escapeSql(entry.classYear)}', '${escapeSql(entry.feeId)}', '${escapeSql(entry.feeName)}',
          '${escapeSql(entry.paymentNo)}', '${escapeSql(entry.feeAmount)}', '${escapeSql(entry.feeFine)}',
          '${escapeSql(tot)}', '${escapeSql(fine)}', '${escapeSql(ftot)}',
          '${escapeSql(amountType)}', '${escapeSql(amountDetails)}', '${escapeSql(dis)}', '${escapeSql(disDet)}',
          '${escapeSql(groupId)}', '${escapeSql(now)}', '${escapeSql(ip)}', '${escapeSql(memberId)}', 1
        )`,
      );

      const nameLabel = feeLabels[entry.feeName] || entry.feeName;
      if (Number(entry.paymentNo) === 1 && Number(entry.tfeeAmount) <= Number(entry.feeAmount)) {
        feeTypeNameArr.push(nameLabel);
      } else if (Number(entry.paymentNo) === 1) {
        feeTypeNameArr.push(`${nameLabel} - Part Payment`);
      } else {
        feeTypeNameArr.push(`${nameLabel} - Balance Amount`);
      }
      totalFine = Number(fine);
      totalDiscount = Number(dis);
      refTotal += Number(entry.feeAmount);
    }

    if (withPrint && refTotal > 0) {
      const bannerRows = await prisma.$queryRawUnsafe(
        'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
      );
      const stuRows = await prisma.$queryRawUnsafe(
        `SELECT A.student_name, A.student_initial, B.degree_name, B.department_name
         FROM student_profile_tb AS A INNER JOIN basic_setup_course_tb AS B ON A.course_id = B.id
         WHERE A.del = 1 AND B.del = 1 AND A.register_no = '${escapeSql(registerNo)}' LIMIT 1`,
      );
      const stu = stuRows[0] || {};
      if (totalFine > 0) feeTypeNameArr.push('Fine');
      if (totalDiscount > 0) feeTypeNameArr.push('Concession');
      const total = refTotal + totalFine - totalDiscount;
      receiptHtml += buildApprovalReceiptHtml({
        bannerImage: bannerRows[0]?.banner_image,
        receiptNo,
        paidDate,
        studentName: titleCaseName(stu.student_name, stu.student_initial),
        degreeName: `${stu.degree_name || ''} ${stu.department_name || ''}`.trim(),
        registerNo,
        feeTypeNames: feeTypeNameArr,
        totalAmount: total,
        amountType,
        paymentLabel: '',
      });
    }
  }

  await prisma.$executeRawUnsafe(
    `UPDATE fee_slip_tb SET f_status = 1, updated_dt = '${escapeSql(now)}', updated_ip = '${escapeSql(ip)}', updated_by = '${escapeSql(memberId)}'
     WHERE group_id = '${escapeSql(groupId)}' AND f_status = 0 AND del = 1`,
  );

  return {
    success: true,
    message: withPrint ? 'Approved and receipt generated' : 'Approved',
    receiptNos,
    receiptHtml: receiptHtml || undefined,
  };
}

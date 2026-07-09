import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  convertNumberToWords,
  formatDisplayDate,
  formatIndianMoney,
  loadFeeLabelMap,
  titleCaseName,
} from './feeHelpers.js';

function buildReceiptHtmlPart(receipt, student, degree, bannerImage) {
  const particulars = [...new Set(receipt.lines)].join(' & ');
  let particularsHtml = particulars;
  if (receipt.fine > 0) {
    particularsHtml += `<br>Fine : <strong>${formatIndianMoney(receipt.fine)}</strong>`;
  }
  if (receipt.discount > 0) {
    particularsHtml += `<br>Concession : <strong>${formatIndianMoney(receipt.discount)}</strong>`;
  }

  const paymentLabel = receipt.paymentNo > 1
    ? `${receipt.amountType} (Part payment)`
    : receipt.amountType;

  const banner = bannerImage
    ? `<img src='img/global_images/${bannerImage}' width='350' />`
    : '';

  return `<div id="container" style="min-height:512px;width:100%;height:auto;">
<table align="center" border="0" cellpadding="2" cellspacing="2" width="100%">
<tbody>
<tr><td colspan="2"><div id="top"><table border="0" width="100%"><tr>
<td valign="middle"><h2>${banner}</h2></td>
<td colspan="3" align="center"><p style="font-size:16px;"><strong>FEE RECEIPT</strong></p></td>
</tr></table></div></td></tr>
<tr><td colspan="2"><table border="0" width="85%" align="center">
<tr><td><strong>Receipt No:</strong> ${receipt.receiptNo}</td>
<td><strong>Date:</strong> ${formatDisplayDate(receipt.paidDate)}</td></tr>
<tr><td colspan="2"><strong>Student Name:</strong> ${student}</td></tr>
<tr><td colspan="2">${receipt.registerNo} | ${degree}</td></tr>
</table></td></tr>
<tr><td colspan="2"><table class="fees_table" border="0" width="85%" align="center">
<tr bgcolor="#F0F0F0"><td width="70%"><strong>Particulars</strong></td><td align="center"><strong>Amount (Rs.)</strong></td></tr>
<tr><td style="padding:12px;"> For ${particularsHtml}</td><td align="center"><strong>${formatIndianMoney(receipt.total)}</strong></td></tr>
<tr><td colspan="2">In words: ${convertNumberToWords(receipt.total)} Rupees only.</td></tr>
</table></td></tr>
<tr><td colspan="2"><strong>Received by:</strong> ${paymentLabel}<br>${receipt.amountDetails || ''}</td></tr>
</tbody></table></div>`;
}

export async function buildFeeReceiptHtml({ receiptNo = '', groupId = '' }) {
  const { labels } = await loadFeeLabelMap(prisma);

  let where = 'del = 1';
  if (receiptNo) {
    where += ` AND receipt_no = '${escapeSql(String(receiptNo).trim())}'`;
  } else if (groupId) {
    where += ` AND slip_id = '${escapeSql(String(groupId).trim())}'`;
  } else {
    return { error: 'receiptNo or groupId required' };
  }

  const feeRows = await prisma.$queryRawUnsafe(
    `SELECT receipt_no, CAST(paid_date AS CHAR) AS paid_date, register_no,
            amount_type, amount_details, payment_no, fee_name, fee_amount,
            total_amount, fine_amount, discount_amount
     FROM student_fee WHERE ${where} ORDER BY receipt_no ASC, id ASC`,
  );

  if (!feeRows.length) {
    return { error: 'No fee receipt found' };
  }

  const bannerRows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const bannerImage = bannerRows[0]?.banner_image || '';

  const receipts = {};
  feeRows.forEach((row) => {
    const key = row.receipt_no;
    if (!receipts[key]) {
      receipts[key] = {
        receiptNo: row.receipt_no,
        paidDate: row.paid_date,
        registerNo: row.register_no,
        amountType: row.amount_type,
        amountDetails: row.amount_details,
        paymentNo: Number(row.payment_no) || 0,
        lines: [],
        total: 0,
        fine: 0,
        discount: 0,
      };
    }
    const label = labels[row.fee_name] || row.fee_name;
    const lineAmount = Number(row.total_amount || row.fee_amount || 0);
    receipts[key].lines.push(label);
    receipts[key].total += lineAmount;
    receipts[key].fine += Number(row.fine_amount || 0);
    receipts[key].discount += Number(row.discount_amount || 0);
  });

  const htmlParts = [];
  for (const receipt of Object.values(receipts)) {
    const stuRows = await prisma.$queryRawUnsafe(
      `SELECT A.student_name, A.student_initial, B.degree_name, B.department_name
       FROM student_profile_tb AS A
       INNER JOIN basic_setup_course_tb AS B ON A.course_id = B.id
       WHERE A.del = 1 AND B.del = 1 AND A.register_no = '${escapeSql(receipt.registerNo)}'
       LIMIT 1`,
    );
    const stu = stuRows[0] || {};
    const studentName = titleCaseName(stu.student_name, stu.student_initial);
    const degree = `${String(stu.degree_name || '').trim()} ${String(stu.department_name || '').toUpperCase()}`.trim();
    htmlParts.push(buildReceiptHtmlPart(receipt, studentName, degree, bannerImage));
  }

  return {
    html: htmlParts.join('<div style="page-break-after:always;height:16px;"></div>'),
    receiptCount: htmlParts.length,
  };
}

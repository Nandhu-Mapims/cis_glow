import QRCode from 'qrcode';
import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear } from '../fees/feeHelpers.js';

/** Legacy: /home/mapims/cis/cis/term_mark_sheet_print.php */

function printRegNo(regNos) {
  const rows = [];
  for (let i = 0; i < 40; i += 1) {
    const h = i === 5 || i === 10 || i === 15 || i === 20 || i === 24 || i === 29 || i === 35 ? 20 : 25;
    rows.push(`<tr><td height="${h}"><p class="register_no">${regNos[i] || ''}</p></td></tr>`);
  }
  return `<table cellpadding="0" cellspacing="0">${rows.join('')}</table>`;
}

function batchLabel(batchStr, totalBatch) {
  const list = String(batchStr || '').split(',').map((b) => b.trim()).filter(Boolean);
  if (!list.length || list.length === totalBatch) return { label: '', search: '' };
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const label = list.map((b) => letters[Number(b) - 1] || b).join(', ');
  const search = ` AND (${list.map((b) => `batch_no="${escapeSql(b)}"`).join(' OR ')})`;
  return { label, search };
}

export async function buildExamMarksheetHtml(query, memberId, audit = {}) {
  void memberId;
  void audit;
  const flag = String(query.flag || '');
  const refExamId = String(query.exam || '').trim();
  const refCourseId = String(query.course || '').trim();
  const refAcademicYear = String(query.ayear || '').trim();
  const refCurrentYear = String(query.cyear || '').trim();
  const refAcademicType = String(query.atype || '').trim();
  const refSubjectName = String(query.subject || '').trim();
  const refMarkOption = String(query.mark || '').trim();
  const refScheduleId = String(query.scheid || '').trim();

  if (flag !== '1' || !refExamId || !refCourseId || !refAcademicYear || !refCurrentYear
    || !refAcademicType || !refSubjectName || !refMarkOption || !refScheduleId) {
    return '<html><body><p>Invalid marksheet parameters</p></body></html>';
  }

  const sheetConfig = await prisma.cia_sheet_config.findFirst({ where: { id: 1 } });
  const cfg = {
    fp_top: Number(sheetConfig?.t_margin_fpage) || 0,
    sp_top: Number(sheetConfig?.t_margin_spage) || 0,
    qr_top: Number(sheetConfig?.qr_top) || 0,
    qr_left: Number(sheetConfig?.qr_left) || 0,
    re_top: Number(sheetConfig?.reg_top) || 0,
    re_left: Number(sheetConfig?.reg_left) || 0,
    rwidth: Number(sheetConfig?.right_width) || 0,
  };

  const setup = await prisma.cia_setup.findFirst({
    where: { del: 1, id: Number(refExamId) },
    select: { exam_name: true, mark_option: true },
  });
  if (!setup) return '<html><body><p>Exam not found</p></body></html>';

  const examNameRow = await prisma.cia_exam_name.findFirst({
    where: { del: 1, id: Number(setup.exam_name) },
    select: { exam_name: true },
  });
  const examLabel = { exam_name: examNameRow?.exam_name || '' };

  const course = await prisma.basic_setup_course_tb.findFirst({
    where: { del: 1, id: Number(refCourseId) },
    select: { degree_name: true, course_name: true },
  });
  examLabel.course = `${convertNYear(refCurrentYear, course?.course_name)} - ${course?.degree_name || ''}`;

  const batchMax = await prisma.$queryRawUnsafe(
    `SELECT batch_no FROM cia_batch_tb
     WHERE del = 1 AND course_id = '${escapeSql(refCourseId)}'
       AND academic_year = '${escapeSql(refAcademicYear)}'
       AND current_year = '${escapeSql(refCurrentYear)}'
       AND academic_type = '${escapeSql(refAcademicType)}'
     ORDER BY batch_no+0 DESC LIMIT 1`,
  );
  const totalBatchRef = Math.max(1, Number(batchMax[0]?.batch_no) || 1);
  const fBatchStr = {};
  let bstr = 'A';
  for (let b = 1; b <= totalBatchRef; b += 1) {
    fBatchStr[b] = bstr;
    bstr = String.fromCharCode(bstr.charCodeAt(0) + 1);
  }

  const schedRows = await prisma.$queryRawUnsafe(
    `SELECT A.exam_date, A.exam_session, A.internal_max, A.viva_max, A.external_max, A.pass_mark,
            B.subject_id, B.subject_name, B.subject_category, C.subject_name, A.id, A.batch_no
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del = 1 AND A.id = '${escapeSql(refScheduleId)}' AND B.del = 1
       AND B.subject_id = '${escapeSql(refSubjectName)}'
       AND A.academic_year = '${escapeSql(refAcademicYear)}'
       AND A.current_year = '${escapeSql(refCurrentYear)}'
       AND A.academic_type = '${escapeSql(refAcademicType)}'
       AND A.course_id = '${escapeSql(refCourseId)}'
       AND A.exam_name = '${escapeSql(refExamId)}'
       AND C.del = 1`,
  );
  const row = schedRows[0];
  if (!row) return '<html><body><p>Schedule not found</p></body></html>';

  const catRow = await prisma.subject_master.findFirst({
    where: { del: 1, id: Number(row.subject_category) },
    select: { category_name: true },
  });
  const cSubjectCategory = catRow?.category_name || '';
  const { label: batchStr, search: batchSearch } = batchLabel(row.batch_no, totalBatchRef);

  let subStr = `${row.subject_id} - ${row.subject_name}${cSubjectCategory ? ` (${cSubjectCategory})` : ''}`;
  subStr = subStr.length > 20
    ? `<span style="font-size:11px;">${subStr}</span>`
    : `<span style="font-size:13px;">${subStr}</span>`;
  examLabel.subject = subStr;
  examLabel.slabel = `${cSubjectCategory ? `${cSubjectCategory}: ` : ''}${row.subject_name}`;
  examLabel.date = `${new Date(row.exam_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')} | ${row.exam_session}`;

  const rollRow = await prisma.$queryRawUnsafe(
    `SELECT GROUP_CONCAT(roll_no SEPARATOR ',') AS rolls FROM cia_batch_tb
     WHERE del = 1 AND course_id = '${escapeSql(refCourseId)}'
       AND academic_year = '${escapeSql(refAcademicYear)}'
       AND academic_type = '${escapeSql(refAcademicType)}'
       AND current_year = '${escapeSql(refCurrentYear)}' ${batchSearch}`,
  );
  const regList = String(rollRow[0]?.rolls || '').split(',').map((r) => r.trim()).filter(Boolean);
  if (!regList.length) return '<html><body><p>No students in batch</p></body></html>';

  const regFilter = regList.map((r) => `register_no='${escapeSql(r)}'`).join(' OR ');
  const students = await prisma.$queryRawUnsafe(
    `SELECT uregister_no, register_no FROM student_profile_tb
     WHERE del = 1 AND (${regFilter})
     ORDER BY academic_year DESC, uregister_no ASC, register_no ASC`,
  );

  const pages = {};
  let counter = 0;
  let page = 1;
  for (const stu of students) {
    if (!pages[page]) pages[page] = { print_no: [], reg_no: [] };
    pages[page].print_no.push(stu.uregister_no || stu.register_no);
    pages[page].reg_no.push(stu.register_no);
    counter += 1;
    if (counter % 40 === 0) page += 1;
  }

  let printContainer = '';
  let marginStr = `${cfg.fp_top}px 0px 0px 0px`;
  const totalPages = Object.keys(pages).length;

  for (const [pageNo, regNoList] of Object.entries(pages)) {
    const p = Number(pageNo);
    const folioRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM cia_omr_sheet_tb WHERE del = 1
         AND exam_name = '${escapeSql(refExamId)}' AND course_id = '${escapeSql(refCourseId)}'
         AND academic_year = '${escapeSql(refAcademicYear)}' AND current_year = '${escapeSql(refCurrentYear)}'
         AND academic_type = '${escapeSql(refAcademicType)}' AND subject_id = '${escapeSql(refSubjectName)}'
         AND mark_type = '${escapeSql(refMarkOption)}' AND page_no = '${escapeSql(String(p))}'
         AND schedule_id = '${escapeSql(refScheduleId)}' LIMIT 1`,
    );
    let folio = folioRows[0];

    const regNoStr = regNoList.reg_no.join(',');
    if (folio?.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE cia_omr_sheet_tb SET register_no = '${escapeSql(regNoStr)}' WHERE id = '${folio.id}'`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO cia_omr_sheet_tb(exam_name, course_id, academic_year, current_year, academic_type,
           subject_id, schedule_id, page_no, mark_type, register_no, sub_category, created_by)
         VALUES ('${escapeSql(refExamId)}', '${escapeSql(refCourseId)}', '${escapeSql(refAcademicYear)}',
           '${escapeSql(refCurrentYear)}', '${escapeSql(refAcademicType)}', '${escapeSql(refSubjectName)}',
           '${escapeSql(refScheduleId)}', '${escapeSql(String(p))}', '${escapeSql(refMarkOption)}',
           '${escapeSql(regNoStr)}', '${escapeSql(String(row.subject_category || ''))}', '${escapeSql(memberId)}')`,
      );
      const created = await prisma.$queryRawUnsafe(
        `SELECT id FROM cia_omr_sheet_tb WHERE del = 1
           AND exam_name = '${escapeSql(refExamId)}' AND page_no = '${escapeSql(String(p))}'
           AND schedule_id = '${escapeSql(refScheduleId)}' ORDER BY id DESC LIMIT 1`,
      );
      folio = created[0];
    }

    let refMarkLabel;
    let maxMarksLabel;
    if (refMarkOption === 'I') {
      refMarkLabel = `Internal :${row.internal_max} Marks`;
      maxMarksLabel = row.internal_max;
    } else if (refMarkOption === 'V') {
      refMarkLabel = `Viva :${row.viva_max} Marks`;
      maxMarksLabel = row.viva_max;
    } else {
      refMarkLabel = `${cSubjectCategory} :${row.external_max} Marks`;
      maxMarksLabel = row.external_max;
    }

    const folioId = `${folio.id}ZZZ${refExamId}ZZZ${p}ZZZ${refScheduleId}`;
    const qrDataUrl = await QRCode.toDataURL(folioId, { errorCorrectionLevel: 'Q', margin: 2, width: 120 });
    const pageStyle = totalPages !== p ? 'page-break-after:always;' : '';
    const ayShort = `${refAcademicYear.slice(0, 5)}${refAcademicYear.slice(-2)}`;

    printContainer += `<div style="float:left;width:100%;padding:0;margin:${marginStr};${pageStyle}">
      <div style="float:left;width:145px;height:800px;padding:${cfg.qr_top}px 0 0 ${cfg.qr_left}px;margin:0;text-align:center;overflow:hidden;">
        <img src="${qrDataUrl}" style="margin-bottom:5px;margin-right:15px;" align="center"><br>
        <table width="130" border="0" cellspacing="0" cellpadding="0" class="table-bordered">
          <tr><td height="20" align="left" class="subtitle" colspan="2"><strong>${examLabel.exam_name}</strong></td></tr>
          <tr><td height="20" align="left" class="subtitle" colspan="2"><strong>${examLabel.course}</strong> ${ayShort} (${refAcademicType.slice(0, 1)})</td></tr>
          <tr><td height="20" align="left" class="subtitle" colspan="2">${examLabel.subject}</td></tr>
          ${batchStr ? `<tr><td height="10" align="left" class="subtitle" colspan="2">Batch : ${batchStr}</td></tr>` : ''}
          <tr><td height="20" align="left" class="subtitle" colspan="2">${refMarkLabel}</td></tr>
          <tr><td height="20" align="left" class="subtitle1">Date&nbsp;</td><td align="left" class="subtitle">${examLabel.date}</td></tr>
          <tr><td height="20" align="left" class="subtitle1">Page&nbsp;</td><td align="left" class="subtitle">${p}</td></tr>
        </table>
      </div>
      <div style="float:left;width:300px;margin:0;padding:${cfg.re_top}px 0 0 ${cfg.re_left}px;">${printRegNo(regNoList.print_no)}</div>
      <div style="float:right;width:${cfg.rwidth}px;padding-top:330px;font-size:28px;text-align:center;font-weight:bold;">
        ${refMarkLabel.charAt(0).toUpperCase()}<br>${maxMarksLabel}<br><small style="font-size:9px;">Marks</small>
        <div style="height:500px;position:relative;"><div style="position:absolute;transform:rotate(-90deg);transform-origin:left bottom;font-size:12px;white-space:nowrap;bottom:0;left:30px;overflow:hidden;width:300px;text-overflow:ellipsis;">${examLabel.slabel}</div></div>
        <div style="font-size:30px;padding-top:30px;text-align:center;font-weight:bold;">${p}<br><small style="font-size:11px;">Page</small></div>
      </div></div>`;
    marginStr = `${cfg.sp_top}px 0px 0px 0px`;
  }

  return `<html><style type="text/css">
body{margin:0;padding:0}p{margin:0;padding:0}.register_no{font-size:11px;color:#000;padding-left:8px}
.subtitle{font-size:12px;line-height:13px;color:#000;margin:0;padding:0}
.subtitle1{font-size:11px;line-height:12px;color:#000;margin:0;padding:0}
table{border-collapse:collapse;border-spacing:0}
.table-bordered td,.table-bordered th{border:1px solid #999;vertical-align:top;padding:3px 0 3px 3px}
</style><body onload="window.print()">${printContainer}</body></html>`;
}

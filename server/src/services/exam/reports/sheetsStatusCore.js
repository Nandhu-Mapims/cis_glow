import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { ciaExamNameSelect, ciaSetupSelect } from '../../../utils/legacySelects.js';
import { logExamSetup } from '../setup/setupAudit.js';

const PAGE = 'term_sheets_status.php';

function formatInputDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = new Date(text.includes('-') && text.length === 10 ? text.split('-').reverse().join('-') : text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function formatDisplayTime(value) {
  const text = String(value || '');
  if (!text || text.startsWith('0000-00-00')) return '';
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDisplayDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!text || text.startsWith('0000-00-00')) return '';
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

async function loadExamNameMap() {
  const rows = await prisma.cia_exam_name.findMany({
    where: { del: 1 },
    orderBy: { exam_order: 'asc' },
    select: ciaExamNameSelect,
  });
  const map = {};
  for (const row of rows) {
    map[row.id] = `${row.exam_name}${row.exam_month ? ` (${row.exam_month})` : ''}`;
  }
  return map;
}

function resolveMarkType(markType, subjectCategory) {
  if (markType === 'I') return 'Internal';
  if (markType === 'V') return 'Viva';
  if (markType === 'E') return subjectCategory || 'External';
  return markType || '';
}

function resolveSheetStatus(row, batchStartLabel) {
  let status = String(row.status || '');
  if (Number(row.c_flag) === 1) {
    return `${status}<span class="text-danger">In Queue: Process begin at <strong>${batchStartLabel}</strong></span>`;
  }
  const updated = String(row.updated_dt || '');
  if (!status && updated && !updated.startsWith('0000-00-00')) {
    const ageSec = (Date.now() - new Date(updated).getTime()) / 1000;
    if (ageSec > 90) return 'Qr Code not recognize';
    return 'Processing';
  }
  return status;
}

export async function loadSheetsStatus(memberId, fields = {}, audit = {}) {
  const today = new Date();
  const fromDate = formatInputDate(fields.from_date) || today.toISOString().slice(0, 10);
  const toDate = formatInputDate(fields.to_date) || today.toISOString().slice(0, 10);
  const batchId = fields.batch_id || fields.batchId || '';

  const dtStr = Math.floor(Date.now() / 1000);
  const batchStart = new Date((dtStr + (300 - (dtStr % 300))) * 1000)
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  let where = `del=1 AND DATE(created_dt)>='${escapeSql(fromDate)}' AND DATE(created_dt)<='${escapeSql(toDate)}'`;
  if (batchId && /^\d+$/.test(String(batchId))) {
    where += ` AND batch_id='${escapeSql(String(batchId))}'`;
  }

  const dateRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT DATE(created_dt) AS sheetDate
     FROM cia_omr_log_tb WHERE ${where}
     ORDER BY sheetDate DESC`,
  );

  const examNameMap = await loadExamNameMap();
  const courseCache = {};
  const examCache = {};
  const subjectCache = {};
  const subjectCatCache = {};
  const groupedRows = [];
  let totalCount = 0;

  for (const { sheetDate } of dateRows) {
    const dateKey = String(sheetDate).slice(0, 10);
    const sheetRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM cia_omr_log_tb
       WHERE del=1 AND DATE(created_dt)='${escapeSql(dateKey)}'
       ${batchId && /^\d+$/.test(String(batchId)) ? `AND batch_id='${escapeSql(String(batchId))}'` : ''}
       ORDER BY created_dt DESC`,
    );
    totalCount += sheetRows.length;
    const items = [];

    for (const row of sheetRows) {
      const courseId = String(row.course_id || '');
      if (courseId && !courseCache[courseId]) {
        const courseRows = await prisma.$queryRawUnsafe(
          `SELECT course_name, degree_name, department_name FROM basic_setup_course_tb
           WHERE del=1 AND id='${escapeSql(courseId)}' LIMIT 1`,
        );
        const course = courseRows?.[0];
        let dept = String(course?.department_name || '').trim();
        if (dept && dept !== '-') dept = ` - ${dept}`;
        courseCache[courseId] = {
          courseName: course?.course_name || '',
          degreeLabel: `${course?.degree_name || ''}${dept}`,
        };
      }

      const examKey = String(row.exam_name || '');
      if (examKey && !examCache[examKey]) {
        const setup = await prisma.cia_setup.findFirst({
          where: { del: 1, id: Number(examKey) || -1 },
          select: ciaSetupSelect,
        });
        examCache[examKey] = setup ? (examNameMap[Number(setup.exam_name)] || examKey) : examKey;
      }

      const subjectKey = String(row.subject_id || '');
      if (subjectKey && courseId && !subjectCache[subjectKey]) {
        const subRows = await prisma.$queryRawUnsafe(
          `SELECT A.subject_name, A.subject_category
           FROM basic_subject_marks_tb AS A
           INNER JOIN basic_setup_subject_tb AS B ON A.rid=B.id
           WHERE A.del=1 AND A.subject_id='${escapeSql(subjectKey)}'
             AND B.del=1 AND B.academic_year='${escapeSql(String(row.academic_year || ''))}'
             AND B.course_id='${escapeSql(courseId)}'
             AND B.semester_no='${escapeSql(String(row.current_year || ''))}'
             AND B.subject_enable=1 LIMIT 1`,
        );
        const sub = subRows?.[0];
        const catRows = sub?.subject_category
          ? await prisma.$queryRawUnsafe(
            `SELECT category_name FROM subject_master WHERE del=1 AND id='${Number(sub.subject_category)}' LIMIT 1`,
          )
          : [];
        const catName = catRows?.[0]?.category_name || '';
        subjectCatCache[subjectKey] = catName;
        subjectCache[subjectKey] = sub
          ? `${subjectKey} - ${sub.subject_name} (${catName})`
          : subjectKey;
      }

      const courseInfo = courseCache[courseId] || {};
      const degreeLabel = courseId
        ? `${convertNYear(Number(row.current_year), courseInfo.courseName || '')} - ${courseInfo.degreeLabel || ''}`
        : '';

      const ym = omrYm(row.created_dt);
      items.push({
        batchId: row.batch_id,
        degreeLabel,
        examName: examCache[examKey] || '',
        subjectName: subjectCache[subjectKey] || '',
        markType: resolveMarkType(String(row.mark_type || ''), subjectCatCache[subjectKey]),
        pageNo: row.page_no || '',
        statusHtml: resolveSheetStatus(row, batchStart),
        uploadSheet: row.upload_sheet || '',
        storeSheet: row.store_sheet || '',
        fileUrl: row.store_sheet ? `/api/files/omr/${ym}/${row.store_sheet}` : '',
        createdTime: formatDisplayTime(row.created_dt),
      });
    }

    groupedRows.push({ dateLabel: formatDisplayDate(dateKey), items });
  }

  await logExamSetup(PAGE, 'View', 'Successful', `${fromDate} to ${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    batchId: batchId ? String(batchId) : '',
    totalCount,
    groupedRows,
  };
}

function omrYm(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

export async function saveSheetsStatus() {
  return { success: false, message: 'Report is view only' };
}

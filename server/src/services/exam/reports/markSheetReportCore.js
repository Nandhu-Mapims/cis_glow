import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { logExamSetup } from '../setup/setupAudit.js';
import { basicSetupCourseSelect } from '../../../utils/legacySelects.js';
import {
  batchLetters,
  buildPrintHeader,
  formatDisplayDate,
  getMaxBatchCount,
  loadActiveExamOptions,
  loadCourseSemesterOptions,
  loadSubjectCategories,
  parseCourseSemesterKey,
  resolveExamContext,
} from '../setup/examSetupShared.js';

const STATUS_PAGE = 'term_mark_sheet_status.php';
const RECEIVED_PAGE = 'term_mark_sheet_received.php';

const PROCESS_TYPES = ['Completed', 'Pending', 'Printed', 'Not Printed'];
const BADGE_CLASS = {
  Completed: 'badge bg-success',
  Pending: 'badge bg-warning',
  Printed: 'badge bg-info',
  'Not Printed': 'badge',
};

function parseArrayField(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value != null && value !== '') return [String(value)];
  return [];
}

function buildMarkSheetOptions(ctx) {
  const options = [];
  if (ctx.examInternal) options.push({ value: 'I', label: 'Internal' });
  if (ctx.examViva) options.push({ value: 'V', label: 'Viva' });
  if (ctx.examExternal) options.push({ value: 'E', label: 'Theory', displayLabel: 'Theory/Clinical' });
  return options;
}

function markLabelForType(type, label) {
  if (type === 'E') return label?.displayLabel || 'Theory/Clinical';
  return label?.label || type;
}

function omrYm(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

function formatBatchStr(batchNo, totalBatch, batchMap) {
  const list = String(batchNo || '').split(',').map((b) => b.trim()).filter(Boolean);
  if (!list.length) return '';
  if (list.length === totalBatch) return 'All';
  return list.map((bid) => batchMap[Number(bid)] || bid).join(', ');
}

async function loadScheduledSubjects(ctx, courseId, semester, received = false) {
  const orderBy = received
    ? 'C.subject_order ASC, B.subject_category ASC, A.batch_no ASC'
    : 'C.subject_order ASC';
  return prisma.$queryRawUnsafe(
    `SELECT CAST(A.exam_date AS CHAR) AS exam_date, A.exam_session, A.internal_max, A.viva_max, A.external_max, A.pass_mark,
            B.subject_id, B.subject_name, B.subject_category, B.short_subject_name,
            C.subject_id AS main_subject_id, C.subject_name AS main_subject_name,
            A.id AS schedule_id, A.batch_no
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del=1 AND B.del=1
       AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND A.current_year='${semester}'
       AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND A.course_id='${courseId}'
       AND A.exam_name='${ctx.examSetupId}'
       AND C.del=1 AND C.academic_year='${escapeSql(ctx.academicYear)}'
       AND C.course_id='${courseId}'
       AND C.semester_no='${semester}'
       AND C.subject_enable=1
     ORDER BY ${orderBy}`,
  );
}

async function resolveSheetStatus(folioNo, sheetStatus) {
  let statusStr = 'Pending';
  let fileUrl = '';
  let remarks = '';

  if (Number(sheetStatus) === 1) {
    statusStr = 'Completed';
  }

  const searchClause = Number(sheetStatus) === 1 ? " AND status='Completed' " : '';
  const logRows = await prisma.$queryRawUnsafe(
    `SELECT id, created_dt, store_sheet, status FROM cia_omr_log_tb
     WHERE del=1 AND foil_sheet_no='${escapeSql(String(folioNo))}'${searchClause}
     ORDER BY created_dt DESC LIMIT 1`,
  );
  const log = logRows?.[0];
  if (log?.id) {
    const ym = omrYm(log.created_dt);
    if (log.store_sheet) fileUrl = `/api/files/omr/${ym}/${log.store_sheet}`;
    if (Number(sheetStatus) !== 1) remarks = String(log.status || '');
  } else {
    statusStr = 'Printed';
  }

  return { statusStr, fileUrl, remarks, badgeClass: BADGE_CLASS[statusStr] || 'badge' };
}

async function buildStatusRows(ctx, courseSel, markTypes, processTypes) {
  const categories = await loadSubjectCategories();
  const totalBatch = await getMaxBatchCount(
    courseSel.courseId,
    ctx.academicYear,
    courseSel.semester,
    ctx.academicType,
  );
  const batchMap = batchLetters(totalBatch);
  const markOptions = buildMarkSheetOptions(ctx);
  const markTypeMap = Object.fromEntries(markOptions.map((o) => [o.value, o]));

  const subjects = await loadScheduledSubjects(ctx, courseSel.courseId, courseSel.semester, false);
  const rows = [];
  const summaryCounts = {};
  for (const p of processTypes) summaryCounts[p] = 0;

  let counter = 0;
  for (const sub of subjects) {
    const maxMarks = {
      I: Number(sub.internal_max) || 0,
      V: Number(sub.viva_max) || 0,
      E: Number(sub.external_max) || 0,
    };
    const batchStr = formatBatchStr(sub.batch_no, totalBatch, batchMap);
    const examDate = formatDisplayDate(sub.exam_date);
    const examDateSession = `${examDate}${examDate ? ' & ' : ''}${sub.exam_session || ''}`;
    const categoryName = categories[Number(sub.subject_category)] || '';

    for (const markType of markTypes) {
      if (maxMarks[markType] <= 0) continue;
      const markLabel = markLabelForType(markType, markTypeMap[markType]);

      const sheetRows = await prisma.$queryRawUnsafe(
        `SELECT id, page_no, status FROM cia_omr_sheet_tb
         WHERE del=1 AND exam_name='${ctx.examSetupId}'
           AND course_id='${courseSel.courseId}'
           AND academic_year='${escapeSql(ctx.academicYear)}'
           AND current_year='${courseSel.semester}'
           AND academic_type='${escapeSql(ctx.academicType)}'
           AND subject_id='${escapeSql(String(sub.subject_id))}'
           AND schedule_id='${sub.schedule_id}'
           AND mark_type='${escapeSql(markType)}'
         ORDER BY page_no`,
      );

      if (sheetRows.length) {
        for (const sheet of sheetRows) {
          const { statusStr, fileUrl, remarks, badgeClass } = await resolveSheetStatus(
            sheet.id,
            sheet.status,
          );
          if (!processTypes.includes(statusStr)) continue;
          summaryCounts[statusStr] = (summaryCounts[statusStr] || 0) + 1;
          rows.push({
            index: counter + 1,
            subjectId: String(sub.subject_id),
            subjectName: String(sub.subject_name || sub.subject_id),
            categoryName,
            batchStr,
            examDateSession,
            markLabel,
            pageNo: sheet.page_no ?? '',
            status: statusStr,
            badgeClass,
            fileUrl,
            remarks,
          });
          counter += 1;
        }
      } else if (processTypes.includes('Not Printed')) {
        summaryCounts['Not Printed'] += 1;
        rows.push({
          index: counter + 1,
          subjectId: String(sub.subject_id),
          subjectName: String(sub.subject_name || sub.subject_id),
          categoryName,
          batchStr,
          examDateSession,
          markLabel,
          pageNo: 'All',
          status: 'Not Printed',
          badgeClass: BADGE_CLASS['Not Printed'],
          fileUrl: '',
          remarks: '',
        });
        counter += 1;
      }
    }
  }

  return { rows, summaryCounts };
}

async function buildReceivedRows(ctx, courseSel, markTypes) {
  const categories = await loadSubjectCategories();
  const totalBatch = await getMaxBatchCount(
    courseSel.courseId,
    ctx.academicYear,
    courseSel.semester,
    ctx.academicType,
  );
  const batchMap = batchLetters(totalBatch);
  const markOptions = buildMarkSheetOptions(ctx);
  const markTypeMap = Object.fromEntries(markOptions.map((o) => [o.value, o]));

  const subjects = await loadScheduledSubjects(ctx, courseSel.courseId, courseSel.semester, true);
  const rows = [];
  let counter = 0;

  for (const sub of subjects) {
    const maxMarks = {
      I: Number(sub.internal_max) || 0,
      V: Number(sub.viva_max) || 0,
      E: Number(sub.external_max) || 0,
    };
    const batchStr = formatBatchStr(sub.batch_no, totalBatch, batchMap);
    const examDate = formatDisplayDate(sub.exam_date);
    const examDateSession = `${examDate}${examDate ? ' & ' : ''}${sub.exam_session || ''}`;
    const categoryName = categories[Number(sub.subject_category)] || '';
    const categoryShort = categoryName.slice(0, 3);

    for (const markType of markTypes) {
      if (maxMarks[markType] <= 0) continue;
      const markLabel = markTypeMap[markType]?.label || markType;
      counter += 1;
      rows.push({
        index: counter,
        categoryShort,
        subjectId: String(sub.subject_id),
        shortSubjectName: String(sub.short_subject_name || sub.subject_name || sub.subject_id),
        batchStr,
        examDateSession,
        markTypeShort: markLabel.slice(0, 1),
      });
    }
  }

  return rows;
}

async function buildCourseLabel(courseId, semester, courseName) {
  const course = await prisma.basic_setup_course_tb.findFirst({
    where: { del: 1, id: courseId },
    select: basicSetupCourseSelect,
  });
  if (!course) return '';
  return `${convertNYear(semester, courseName)} - ${course.degree_name}`;
}

function buildStatusReportHtml(ctx, courseLabel, summaryCounts, processTypes, rows) {
  if (!rows.length) return '';
  let summaryCells = '';
  for (const option of processTypes) {
    const suffix = option === 'Not Printed' ? ' Subject' : ' Sheet';
    summaryCells += `<td height="35" class="text-right" width="120">${option}</td>`
      + `<td width="120"><strong>${summaryCounts[option] || 0}</strong>${suffix}</td>`;
  }

  let body = '';
  for (const row of rows) {
    const statusHtml = row.fileUrl
      ? `<a href="${row.fileUrl}" class="${row.badgeClass}" target="_blank">${row.status}</a>`
      : `<span class="${row.badgeClass}">${row.status}</span>`;
    body += `<tr><td>${row.index}</td><td>${row.subjectId}</td><td>${row.subjectName}</td>`
      + `<td>${row.categoryName}</td><td>${row.batchStr}</td><td>${row.examDateSession}</td>`
      + `<td>${row.markLabel}</td><td>${row.pageNo}</td><td>${statusHtml}</td><td>${row.remarks || ''}</td></tr>`;
  }

  const table = `<h3>${ctx.examNameLabel} | ${courseLabel}</h3>`
    + `<table class="table table-bordered col-sm-6" cellpadding="5"><tr>${summaryCells}</tr></table>`
    + `<table class="table table-bordered" cellpadding="3"><tr>
      <td bgcolor="#CCCCCC"><strong>#</strong></td>
      <td bgcolor="#CCCCCC"><strong>Subject ID</strong></td>
      <td bgcolor="#CCCCCC"><strong>Name</strong></td>
      <td bgcolor="#CCCCCC"><strong>Category</strong></td>
      <td bgcolor="#CCCCCC"><strong>Batch</strong></td>
      <td bgcolor="#CCCCCC"><strong>Date</strong></td>
      <td bgcolor="#CCCCCC"><strong>M.Type</strong></td>
      <td bgcolor="#CCCCCC"><strong>Page</strong></td>
      <td bgcolor="#CCCCCC"><strong>Status</strong></td>
      <td bgcolor="#CCCCCC"><strong>Remarks</strong></td>
    </tr>${body}</table>`;

  return table;
}

function buildReceivedReportHtml(ctx, courseLabel, rows) {
  if (!rows.length) return '';
  let body = '';
  for (const row of rows) {
    body += `<tr><td align="center">${row.index}</td><td align="center">${row.categoryShort}</td>`
      + `<td>${row.subjectId}</td><td>${row.shortSubjectName}</td><td align="center">${row.batchStr}</td>`
      + `<td nowrap>${row.examDateSession}</td><td align="center">${row.markTypeShort}</td>`
      + '<td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
  }

  const table = `<table class="table table-bordered" cellpadding="3" cellspacing="0" border="0">
    <thead><tr class="vmiddle">
      <th bgcolor="#CCCCCC"><strong>#</strong></th>
      <th bgcolor="#CCCCCC"><strong>Cat</strong></th>
      <th bgcolor="#CCCCCC" nowrap><strong>Subject ID</strong></th>
      <th bgcolor="#CCCCCC" nowrap><strong>Subject Name</strong></th>
      <th bgcolor="#CCCCCC"><strong>Batch</strong></th>
      <th bgcolor="#CCCCCC"><strong>Date</strong></th>
      <th bgcolor="#CCCCCC"><strong>Type</strong></th>
      <th bgcolor="#CCCCCC"><strong>Page</strong></th>
      <th bgcolor="#CCCCCC"><strong>OMR Print</strong></th>
      <th bgcolor="#CCCCCC"><strong>Hand Over</strong></th>
      <th bgcolor="#CCCCCC"><strong>Rec</strong></th>
      <th bgcolor="#CCCCCC"><strong>Scan</strong></th>
      <th bgcolor="#CCCCCC"><strong>Upload</strong></th>
      <th bgcolor="#CCCCCC"><strong>Status</strong></th>
    </tr></thead><tbody>${body}</tbody></table>`;

  return `${buildPrintHeader('OMR Marking Status', `${ctx.examNameLabel}<br>${courseLabel}`)}${table}`;
}

async function loadMarkSheetReportBase(memberId, fields, audit, page, received = false) {
  const examOptions = await loadActiveExamOptions(true);
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKeyInput = String(fields.course_name || '').trim();
  let courseKey = courseKeyInput;
  if (!courseKey && courseGroups.length) {
    courseKey = courseGroups[0]?.semesters?.[0]?.value || '';
  }
  const courseSel = parseCourseSemesterKey(courseKey);
  const availableMarkOptions = ctx ? buildMarkSheetOptions(ctx) : [];

  const selectedMarks = parseArrayField(fields.mark_option);
  const markTypes = selectedMarks.length
    ? selectedMarks.filter((m) => availableMarkOptions.some((o) => o.value === m))
    : availableMarkOptions.map((o) => o.value);

  const selectedProcess = parseArrayField(fields.process_option);
  const processTypes = selectedProcess.length ? selectedProcess : [...PROCESS_TYPES];

  const markOptions = availableMarkOptions.map((opt) => ({
    ...opt,
    checked: markTypes.includes(opt.value),
    displayLabel: opt.displayLabel || opt.label,
  }));

  const processOptions = PROCESS_TYPES.map((value) => ({
    value,
    checked: processTypes.includes(value),
  }));

  let courseLabel = '';
  let rows = [];
  let summaryCounts = {};
  let reportHtml = '';
  const showReport = String(fields.action || '').toLowerCase() === 'go';

  if (ctx && courseSel && showReport) {
    courseLabel = await buildCourseLabel(courseSel.courseId, courseSel.semester, ctx.courseName);
    if (received) {
      rows = await buildReceivedRows(ctx, courseSel, markTypes);
      reportHtml = buildReceivedReportHtml(ctx, courseLabel, rows);
    } else {
      const result = await buildStatusRows(ctx, courseSel, markTypes, processTypes);
      rows = result.rows;
      summaryCounts = result.summaryCounts;
      reportHtml = buildStatusReportHtml(ctx, courseLabel, summaryCounts, processTypes, rows);
    }
    await logExamSetup(page, 'Generate', 'Successful', `${examId}-${courseKey}`, memberId, audit);
  } else {
    await logExamSetup(page, 'View', 'Successful', examId, memberId, audit);
  }

  return {
    examOptions,
    examId,
    ctx,
    courseGroups,
    courseKey,
    courseSel,
    courseLabel,
    markOptions,
    processOptions: received ? [] : processOptions,
    markTypes,
    processTypes: received ? [] : processTypes,
    summaryCounts,
    rows,
    reportHtml,
    showReport,
  };
}

export async function loadMarkSheetStatus(memberId, fields = {}, audit = {}) {
  return loadMarkSheetReportBase(memberId, fields, audit, STATUS_PAGE, false);
}

export async function loadMarkSheetReceived(memberId, fields = {}, audit = {}) {
  return loadMarkSheetReportBase(memberId, fields, audit, RECEIVED_PAGE, true);
}

export async function saveMarkSheetStatus() {
  return { success: false, message: 'Report is view only' };
}

export async function saveMarkSheetReceived() {
  return { success: false, message: 'Report is view only' };
}

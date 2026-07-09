import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import {
  buildCourseIdYearReportOptions,
  escapeHtml,
  getCourseById,
  loadDepartmentMap,
  loadRoomOptions,
  parseCourseIdYearOnlyKey,
} from '../academicSetupShared.js';
import { logAcademicSetup } from '../setup/setupAudit.js';

const PAGE = 'subject_report.php';

async function buildCategoryMap() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, category_name FROM subject_master WHERE del = 1',
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.category_name]));
}

async function loadBannerImageUrl() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const image = rows[0]?.banner_image;
  return image ? `/legacy/img/global_images/${encodeURIComponent(image)}` : '';
}

function formatLegacyShortDate(value) {
  const raw = String(value || '').slice(0, 10);
  if (!raw || raw.startsWith('0000')) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

function mapDepartmentNames(department, deptMap) {
  return String(department || '')
    .split(',')
    .map((d) => deptMap[d.trim()] || d.trim())
    .filter(Boolean)
    .join(', ');
}

function buildPrintHeaderHtml(reportTitle, bannerUrl) {
  const logo = bannerUrl ? `<img src="${escapeHtml(bannerUrl)}" alt="" />` : '';
  return `<div id="printingHeader" style="display:none;">
<div id="printHeaderpanel" class="first-page">
<table class="header_table" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody>
<tr><td align="center" height="5" colspan="2"><small>omsakthi</small></td></tr>
<tr>
<td height="70" valign="middle" width="30%">${logo}</td>
<td nowrap align="right" valign="top" width="70%"><div class="promote_card"><p class="pc_title title">${escapeHtml(reportTitle)}</p></div></td>
</tr>
</tbody></table>
</div>
</div>`;
}

function buildReportHtml({
  degreeLabel, academicYear, semester, courseName, reportType, subjects, deptMap, roomMap, categoryMap, bannerUrl,
}) {
  const yearLabel = convertNYear(semester, courseName || 'U.G');
  const reportTitle = reportType === 'timetable' ? 'Time Table | Subject List' : 'Exam | Subject List';

  let body = `${buildPrintHeaderHtml(reportTitle, bannerUrl)}
<div id="form_details_panel"><div>
<table border="0" cellpadding="0" cellspacing="0" width="100%" class="table subject-report-meta-table">
<tr>
<td height="35"><strong>Course</strong></td>
<td nowrap width="70%">${escapeHtml(yearLabel)} year | ${escapeHtml(degreeLabel)}</td>
</tr>
<tr>
<td height="35" width="10%" nowrap><strong>Academic Year</strong></td>
<td>${escapeHtml(academicYear)}</td>
</tr>
</table>
<table width="100%" border="0" cellspacing="0" cellpadding="5" class="table table-bordered subject-report-table" style="margin:0px;">
<thead>
<tr bgcolor="#F4F4F4">
<th width="10%" nowrap height="30">#</th>
<th width="10%">Category</th>
<th width="10%" nowrap>Subject Id</th>
<th width="20%" nowrap>Subject Name</th>`;

  if (reportType === 'timetable') {
    body += `<th width="20%" nowrap>Department</th>
<th width="20%" nowrap>Room No.</th>
<th width="10%" nowrap>Batch</th>
<th width="10%" nowrap>Period</th>`;
  } else {
    body += `<th width="5%" nowrap>Internal</th>
<th width="5%" nowrap>Viva</th>
<th width="5%" nowrap>Theory</th>
<th width="5%" nowrap>Pass Mark</th>`;
  }
  body += '</tr></thead><tbody>';

  let counter = 1;
  for (const sub of subjects) {
    const mainCategory = escapeHtml(categoryMap[sub.categoryId] || '');
    const mainSubjectId = escapeHtml(sub.subjectId || '');
    const mainSubjectName = escapeHtml(sub.name || '');

    if (reportType === 'timetable') {
      const rows = sub.ttRows || [];
      if (rows.length === 0) continue;

      body += `<tr bgcolor="#F0F0F0">
<td><strong>${counter}</strong></td>
<td height="30"><strong>${mainCategory}</strong></td>
<td><strong>${mainSubjectId}</strong></td>
<td colspan="5"><strong>${mainSubjectName}</strong></td>
</tr>`;

      let scount = 1;
      for (const child of rows) {
        body += `<tr>
<td height="30">${counter}.${scount}</td>
<td>${escapeHtml(categoryMap[child.categoryId] || '')}</td>
<td>${escapeHtml(child.subjectId || '')}</td>
<td>${escapeHtml(child.name || '')}</td>
<td>${escapeHtml(mapDepartmentNames(child.department, deptMap))}</td>
<td>${escapeHtml(roomMap[child.roomNo] || '')}</td>
<td>${child.batchSplit ? 'Yes' : '-'}</td>
<td>${escapeHtml(child.period || '')}</td>
</tr>`;
        scount += 1;
      }
      counter += 1;
    } else if (sub.enabled) {
      const rows = sub.markRows || [];
      if (rows.length === 0) continue;

      body += `<tr bgcolor="#F0F0F0">
<td><strong>${counter}</strong></td>
<td height="30"><strong>${mainCategory}</strong></td>
<td><strong>${mainSubjectId}</strong></td>
<td colspan="6"><strong>${mainSubjectName}</strong></td>
</tr>`;

      let scount = 1;
      for (const child of rows) {
        body += `<tr>
<td height="30">${counter}.${scount}</td>
<td>${escapeHtml(categoryMap[child.categoryId] || '')}</td>
<td>${escapeHtml(child.subjectId || '')}</td>
<td>${escapeHtml(child.name || '')}</td>
<td>${escapeHtml(mapDepartmentNames(child.department, deptMap))}</td>
<td>${escapeHtml(child.internalMax ?? '')}</td>
<td>${escapeHtml(child.vivaMax ?? '')}</td>
<td>${escapeHtml(child.externalMax ?? '')}</td>
<td>${escapeHtml(child.passMark ?? '')}</td>
</tr>`;
        scount += 1;
      }
      counter += 1;
    }
  }

  body += '</tbody></table></div></div>';
  return body;
}

function buildLegacyPeriod(fromDate, toDate) {
  return `${formatLegacyShortDate(fromDate)} to ${formatLegacyShortDate(toDate)}`;
}

async function loadTimetablePeriodMap({
  courseId, academicYear, semester, academicType, subjectIds,
}) {
  if (!subjectIds.length) return {};

  const idList = subjectIds.map((id) => Number(id)).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT B.id AS tt_id,
            MIN(CASE WHEN CAST(A.from_date AS CHAR) NOT LIKE '0000-00-00%' THEN A.from_date END) AS from_date,
            MAX(CASE WHEN CAST(A.to_date AS CHAR) NOT LIKE '0000-00-00%' THEN A.to_date END) AS to_date
     FROM timetable_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.subject_id = B.id
     WHERE A.del = 1 AND B.del = 1
       AND A.academic_year = '${escapeSql(academicYear)}'
       AND A.course_id = '${escapeSql(String(courseId))}'
       AND A.current_year = '${escapeSql(String(semester))}'
       AND A.academic_type = '${escapeSql(academicType)}'
       AND B.rid IN (${idList})
     GROUP BY B.id`,
  );

  return Object.fromEntries(rows.map((row) => [
    String(row.tt_id),
    buildLegacyPeriod(row.from_date, row.to_date),
  ]));
}

async function loadSubjectChildren(subjectIds, reportType) {
  if (!subjectIds.length) {
    return { ttBySubjectId: {}, markBySubjectId: {} };
  }

  const idList = subjectIds.map((id) => Number(id)).join(',');
  const loads = [];
  if (reportType === 'timetable') {
    loads.push(
      prisma.$queryRawUnsafe(
        `SELECT id, rid, subject_category, subject_id, subject_name, department, room_no, s_batch
         FROM basic_subject_tt_tb
         WHERE del = 1 AND rid IN (${idList})
         ORDER BY rid ASC, id ASC`,
      ),
      Promise.resolve([]),
    );
  } else {
    loads.push(
      Promise.resolve([]),
      prisma.$queryRawUnsafe(
        `SELECT rid, subject_category, subject_id, subject_name, department,
                internal_max, viva_max, external_max, pass_mark
         FROM basic_subject_marks_tb
         WHERE del = 1 AND rid IN (${idList})
         ORDER BY rid ASC, id ASC`,
      ),
    );
  }

  const [ttRows, markRows] = await Promise.all(loads);

  const ttBySubjectId = {};
  for (const tt of ttRows) {
    const key = String(tt.rid);
    if (!ttBySubjectId[key]) ttBySubjectId[key] = [];
    ttBySubjectId[key].push(tt);
  }

  const markBySubjectId = {};
  for (const mk of markRows) {
    const key = String(mk.rid);
    if (!markBySubjectId[key]) markBySubjectId[key] = [];
    markBySubjectId[key].push(mk);
  }

  return { ttBySubjectId, markBySubjectId };
}

export async function loadSubjectReport(memberId, fields = {}, audit = {}) {
  const courseYearOptions = await buildCourseIdYearReportOptions();
  const selection = parseCourseIdYearOnlyKey(fields.course_name);
  const semester = Number(fields.semester_name) || 1;
  const reportType = fields.report_type === 'exam' ? 'exam' : 'timetable';
  const generate = Boolean(fields.generate);

  let html = '';
  let degreeLabel = '';
  let course = null;

  if (generate && selection) {
    course = await getCourseById(selection.courseId);
    let dept = String(course?.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    degreeLabel = `${course?.degree_name || ''}${dept}`;

    const [categoryMap, deptMap, roomData, bannerUrl] = await Promise.all([
      buildCategoryMap(),
      loadDepartmentMap(),
      loadRoomOptions(),
      loadBannerImageUrl(),
    ]);

    const subjectRows = await prisma.$queryRawUnsafe(
      `SELECT id, subject_category, subject_id, subject_name, subject_enable
       FROM basic_setup_subject_tb
       WHERE del = 1 AND academic_year = '${escapeSql(selection.academicYear)}'
         AND course_id = ${Number(selection.courseId)} AND semester_no = ${Number(semester)}
       ORDER BY subject_order ASC`,
    );

    const subjectIds = subjectRows.map((row) => row.id);
    const [{ ttBySubjectId, markBySubjectId }, periodByTtId] = await Promise.all([
      loadSubjectChildren(subjectIds, reportType),
      reportType === 'timetable'
        ? loadTimetablePeriodMap({
          courseId: selection.courseId,
          academicYear: selection.academicYear,
          semester,
          academicType: 'regular',
          subjectIds,
        })
        : Promise.resolve({}),
    ]);

    const subjects = subjectRows.map((row) => {
      const ttRows = ttBySubjectId[String(row.id)] || [];
      const markRows = markBySubjectId[String(row.id)] || [];

      return {
        categoryId: String(row.subject_category),
        subjectId: row.subject_id,
        name: row.subject_name,
        enabled: row.subject_enable === 1,
        ttRows: ttRows.map((tt) => ({
          categoryId: String(tt.subject_category),
          subjectId: tt.subject_id,
          name: tt.subject_name,
          department: tt.department,
          roomNo: tt.room_no,
          batchSplit: tt.s_batch === 1,
          period: periodByTtId[String(tt.id)] || buildLegacyPeriod('', ''),
        })),
        markRows: markRows.map((mk) => ({
          categoryId: String(mk.subject_category),
          subjectId: mk.subject_id,
          name: mk.subject_name,
          department: mk.department,
          internalMax: mk.internal_max,
          vivaMax: mk.viva_max,
          externalMax: mk.external_max,
          passMark: mk.pass_mark,
        })),
      };
    });

    html = buildReportHtml({
      degreeLabel,
      academicYear: selection.academicYear,
      semester,
      courseName: course?.course_name || 'U.G',
      reportType,
      subjects,
      deptMap,
      roomMap: roomData.map,
      categoryMap,
      bannerUrl,
    });
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', fields.course_name || '', memberId, audit);
  if (!course && selection) {
    course = await getCourseById(selection.courseId);
  }
  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection,
    semester: selection ? (Number(fields.semester_name) || 1) : 0,
    totalSemester: course ? Number(course.total_semester) || 0 : 0,
    reportType,
    html,
  };
}

export async function saveSubjectReport() {
  return { success: false, message: 'Report screen is read-only' };
}

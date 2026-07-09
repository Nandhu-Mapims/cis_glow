import { prisma } from '../../../../config/prisma.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { convertNYear } from '../../../fees/feeHelpers.js';
import {
  escapeHtml,
  loadTimetableCategoryMap,
  wrapReportPanel,
} from './reportShared.js';

export async function buildFeedbackCourseContext(feedbackId, courseKey) {
  const selectedCourses = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT course_id FROM feedback_subject WHERE del = 1 AND f_id = '${escapeSql(String(feedbackId))}'`,
  );

  const parsed = [];
  const courseIdSet = new Set();
  for (const row of selectedCourses) {
    const cidStr = String(row.course_id || '').trim();
    const parts = cidStr.split('___');
    if (parts.length < 3) continue;
    const [courseIdStr, academicYear, currentYearStr] = parts;
    const courseId = Number(courseIdStr);
    const currentYear = Number(currentYearStr);
    if (!courseId || !academicYear || !currentYear) continue;
    courseIdSet.add(courseId);
    parsed.push({ courseId, academicYear, currentYear, cidStr });
  }

  const courseById = new Map();
  if (courseIdSet.size) {
    const courseIdsSql = [...courseIdSet].map((id) => `'${escapeSql(String(id))}'`).join(',');
    const courseRows = await prisma.$queryRawUnsafe(
      `SELECT id, course_name, degree_name, department_name
       FROM basic_setup_course_tb WHERE del = 1 AND id IN (${courseIdsSql})`,
    );
    for (const c of courseRows) courseById.set(Number(c.id), c);
  }

  const courseList = [];
  let selected = null;
  for (const item of parsed) {
    const course = courseById.get(item.courseId);
    if (!course) continue;
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    const entry = {
      courseId: item.courseId,
      academicYear: item.academicYear,
      currentYear: item.currentYear,
      cidStr: item.cidStr,
      label: `${convertNYear(item.currentYear, course.course_name)} Year ${course.degree_name}${dept}`,
    };
    courseList.push(entry);
    if (item.cidStr === courseKey) selected = entry;
  }

  courseList.sort((a, b) => a.label.localeCompare(b.label));
  return { courseList, selected };
}

export async function loadFeedbackSubjectOptions(feedbackId, selected) {
  if (!selected) return [];
  const categoryMap = await loadTimetableCategoryMap();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT B.id, B.subject_name, B.subject_category FROM basic_setup_subject_tb AS A
     INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
     INNER JOIN feedback_subject AS C ON B.id = C.subject_id
     WHERE A.del = 1 AND B.del = 1 AND C.del = 1
       AND A.academic_year = '${escapeSql(selected.academicYear)}'
       AND A.course_id = '${escapeSql(String(selected.courseId))}'
       AND A.semester_no = '${escapeSql(String(selected.currentYear))}'
       AND C.f_id = '${escapeSql(String(feedbackId))}'
       AND C.course_id = '${escapeSql(selected.cidStr)}'
       AND C.staff_id != ''
     ORDER BY B.subject_category ASC, A.subject_order ASC`,
  );
  return rows.map((r) => ({
    value: String(r.id),
    label: `${categoryMap[String(r.subject_category)] || ''} | ${r.subject_name}`,
  }));
}

async function loadStaffBriefMap(staffIds) {
  const unique = [...new Set(staffIds.map(String).filter(Boolean))];
  if (!unique.length) return new Map();
  const idsSql = unique.map((id) => `'${escapeSql(id)}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_title, staff_initial, staff_name FROM staff_profile_tb
     WHERE del = 1 AND id IN (${idsSql})`,
  );
  const map = new Map();
  for (const staff of rows) {
    map.set(
      String(staff.id),
      `${staff.staff_title ? `${staff.staff_title}. ` : ''}${staff.staff_initial || ''} ${staff.staff_name || ''}`.trim(),
    );
  }
  return map;
}

async function loadStaffDeptMap(staffIds) {
  const unique = [...new Set(staffIds.map(String).filter(Boolean))];
  if (!unique.length) return new Map();
  const idsSql = unique.map((id) => `'${escapeSql(id)}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT staff_id, department FROM staff_designation_tb
     WHERE del = 1 AND is_academic = 1 AND staff_id IN (${idsSql})
     ORDER BY id DESC`,
  );
  const map = new Map();
  for (const row of rows) {
    const key = String(row.staff_id);
    if (!map.has(key)) map.set(key, row.department);
  }
  return map;
}

async function loadFeedbackOverallTotals(feedbackId) {
  return prisma.$queryRawUnsafe(
    `SELECT course_id, subject_id, staff_id, COUNT(feedback_id) AS cnt, SUM(total_rating) AS total
     FROM feedback_tb WHERE del = 1 AND feedback_id = '${escapeSql(String(feedbackId))}'
     GROUP BY course_id, subject_id, staff_id`,
  );
}

function topicRateCategorySql(reportType) {
  if (reportType === 'theory') {
    return ` AND LOWER(sm.category_name) IN ('theory', 'lecture')`;
  }
  if (reportType === 'practical') {
    return ` AND LOWER(sm.category_name) = 'practical'`;
  }
  if (reportType === 'online' || reportType === 'pg-clinical') {
    return ` AND LOWER(sm.category_name) NOT IN ('theory', 'lecture', 'practical')`;
  }
  return '';
}

async function loadFeedbackTopicRateIndex(feedbackId, { courseId, subjectIds, reportType } = {}) {
  let filter = '';
  if (courseId) filter += ` AND f.course_id = '${escapeSql(courseId)}'`;
  if (subjectIds?.length) {
    filter += ` AND f.subject_id IN (${subjectIds.map((id) => `'${escapeSql(String(id))}'`).join(',')})`;
  }
  const categoryFilter = reportType ? topicRateCategorySql(reportType) : '';

  const headers = await prisma.$queryRawUnsafe(
    `SELECT f.id, f.course_id, f.subject_id, f.staff_id FROM feedback_tb AS f
     INNER JOIN basic_subject_tt_tb AS b ON b.id = f.subject_id AND b.del = 1
     INNER JOIN subject_master AS sm ON sm.id = b.subject_category AND sm.del = 1 AND sm.category = 'Timetable'
     WHERE f.del = 1 AND f.feedback_id = '${escapeSql(String(feedbackId))}' ${filter}${categoryFilter}`,
  );
  if (!headers.length) return new Map();

  const headerById = new Map(headers.map((h) => [String(h.id), h]));
  const ids = headers.map((h) => String(h.id));
  const agg = new Map();
  const CHUNK = 800;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK).map((id) => `'${escapeSql(id)}'`).join(',');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT f_id, t_id, COUNT(*) AS cnt, SUM(t_rate) AS total FROM feedback_rate_tb
       WHERE del = 1 AND f_id IN (${chunk}) GROUP BY f_id, t_id`,
    );
    for (const row of rows) {
      const header = headerById.get(String(row.f_id));
      if (!header) continue;
      const key = `${header.course_id}|${header.subject_id}|${header.staff_id}|${row.t_id}`;
      if (!agg.has(key)) agg.set(key, { cnt: 0, total: 0 });
      const bucket = agg.get(key);
      bucket.cnt += Number(row.cnt);
      bucket.total += Number(row.total) || 0;
    }
  }
  return agg;
}

async function loadAllFeedbackSubjectStaff(feedbackId) {
  return prisma.$queryRawUnsafe(
    `SELECT C.course_id AS cid_str, B.id AS subject_id, B.subject_category, C.staff_id
     FROM feedback_subject AS C
     INNER JOIN basic_subject_tt_tb AS B ON B.id = C.subject_id AND B.del = 1
     INNER JOIN basic_setup_subject_tb AS A ON A.id = B.rid AND A.del = 1
     WHERE C.del = 1 AND C.f_id = '${escapeSql(String(feedbackId))}' AND C.staff_id != ''`,
  );
}

function subjectStaffType(categoryMap, subjectCategory, reportType) {
  let stype = 'online';
  const catName = String(categoryMap[String(subjectCategory)] || '').toLowerCase();
  if (catName === 'theory' || catName === 'lecture') stype = 'theory';
  else if (catName === 'practical') stype = 'practical';
  else if (reportType === 'pg-clinical') stype = 'pg-clinical';
  return stype;
}

export async function loadFeedbackTopics() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, topic_name, category FROM feedback_topic WHERE del != 0 ORDER BY category ASC, t_order ASC`,
  );
  const map = {};
  for (const row of rows) {
    const cat = String(row.category || '').toLowerCase();
    if (!map[cat]) map[cat] = {};
    map[cat][row.id] = row.topic_name;
  }
  return map;
}

export async function buildOverallFeedbackHtml(feedbackId, feedbackTitle, reportType, courseList) {
  const needTopicRates = reportType !== 'overall';
  const [topicMap, deptRows, categoryMap, allSubRows, overallTotals, topicRateIndex] = await Promise.all([
    loadFeedbackTopics(),
    prisma.$queryRawUnsafe(`SELECT id, name FROM staff_dept_master WHERE del = 1 ORDER BY d_order ASC`),
    loadTimetableCategoryMap(),
    loadAllFeedbackSubjectStaff(feedbackId),
    loadFeedbackOverallTotals(feedbackId),
    needTopicRates ? loadFeedbackTopicRateIndex(feedbackId, { reportType }) : Promise.resolve(new Map()),
  ]);

  const deptMap = Object.fromEntries(deptRows.map((d) => [d.id, d.name]));
  const overallIndex = new Map(
    overallTotals.map((r) => [`${r.course_id}|${r.subject_id}|${r.staff_id}`, r]),
  );
  const courseSet = new Set(courseList.map((c) => c.cidStr));

  const staffDetails = {};
  const allStaffIds = [];

  for (const sub of allSubRows) {
    const cidStr = String(sub.cid_str);
    if (!courseSet.has(cidStr)) continue;
    const stype = subjectStaffType(categoryMap, sub.subject_category, reportType);
    if (reportType !== 'overall' && stype !== reportType) continue;

    const topics = topicMap[stype] || {};
    const totalTopic = Object.keys(topics).length * 5;
    const subjectId = String(sub.subject_id);

    for (const stfId of String(sub.staff_id || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      allStaffIds.push(stfId);
      if (reportType === 'overall') {
        const rate = overallIndex.get(`${cidStr}|${subjectId}|${stfId}`);
        if (rate && Number(rate.cnt) > 0) {
          if (!staffDetails[stfId]) staffDetails[stfId] = {};
          if (!staffDetails[stfId][stype]) staffDetails[stfId][stype] = { s_count: 0, s_total: 0, t_total: totalTopic };
          staffDetails[stfId][stype].s_count += Number(rate.cnt);
          staffDetails[stfId][stype].s_total += Number(rate.total) || 0;
        }
      } else {
        for (const catId of Object.keys(topics)) {
          const rate = topicRateIndex.get(`${cidStr}|${subjectId}|${stfId}|${catId}`);
          if (rate && Number(rate.cnt) > 0) {
            if (!staffDetails[stfId]) staffDetails[stfId] = {};
            if (!staffDetails[stfId][catId]) staffDetails[stfId][catId] = { s_count: 0, s_total: 0 };
            staffDetails[stfId][catId].s_count += Number(rate.cnt);
            staffDetails[stfId][catId].s_total += Number(rate.total) || 0;
          }
        }
      }
    }
  }

  const [staffNames, staffDeptMap] = await Promise.all([
    loadStaffBriefMap(allStaffIds),
    loadStaffDeptMap(allStaffIds),
  ]);
  const staffByDept = {};
  for (const [stfId, deptId] of staffDeptMap.entries()) {
    if (!staffByDept[deptId]) staffByDept[deptId] = {};
    staffByDept[deptId][stfId] = stfId;
  }
  const staffNameLookup = Object.fromEntries(staffNames);

  let body = '';
  if (reportType === 'overall') {
    body = '<table class="table table-bordered table-sm"><thead class="table-secondary"><tr><th>Department</th><th>Faculty Name</th><th>Feedback %</th></tr></thead><tbody>';
    let avgTotal = 0; let avgCount = 0;
    for (const [deptId, staffMap] of Object.entries(staffByDept)) {
      const staffIds = Object.keys(staffMap);
      let first = true;
      for (const stfId of staffIds) {
        let catCount = 0; let catTotal = 0;
        for (const rated of Object.values(staffDetails[stfId] || {})) {
          if (rated.s_count > 0) {
            catTotal += Math.round((((rated.s_total / rated.s_count) / rated.t_total) * 100) * 10) / 10;
            catCount += 1;
          }
        }
        if (catCount > 1) catTotal = Math.round((catTotal / catCount) * 10) / 10;
        body += `<tr>${first ? `<td rowspan="${staffIds.length}">${escapeHtml(deptMap[deptId] || '')}</td>` : ''}
          <td>${escapeHtml(staffNameLookup[stfId] || '')}</td><td class="text-end">${catTotal}</td></tr>`;
        first = false;
        avgTotal += catTotal; avgCount += 1;
      }
    }
    body += `<tr><td colspan="2" class="text-end">Average</td><td class="text-end">${avgCount ? Math.round((avgTotal / avgCount) * 10) / 10 : 0}</td></tr></tbody></table>`;
  } else {
    const orderDetails = {};
    for (const [stfId, cats] of Object.entries(staffDetails)) {
      for (const [catId, counts] of Object.entries(cats)) {
        const totalRate = counts.s_count > 0 ? Math.round((counts.s_total / counts.s_count) * 10) : 0;
        if (!orderDetails[catId]) orderDetails[catId] = {};
        if (!orderDetails[catId][totalRate]) orderDetails[catId][totalRate] = {};
        orderDetails[catId][totalRate][stfId] = `${counts.s_total}/${counts.s_count}`;
      }
    }
    const topics = topicMap[reportType] || {};
    body = '<table class="table table-bordered table-sm"><thead class="table-secondary"><tr><th>S.No.</th><th>Topic</th><th>Faculty Name</th><th>Feedback</th></tr></thead><tbody>';
    let sno = 0; let avgTotal = 0; let avgCount = 0;
    const maxStaff = Math.min(5, Object.keys(staffDetails).length || 5);
    for (const [catId, catName] of Object.entries(topics)) {
      const details = orderDetails[catId] || {};
      const rates = Object.keys(details).map(Number).sort((a, b) => b - a);
      let rowCount = 0; let first = true;
      for (const rate of rates) {
        for (const stfId of Object.keys(details[rate])) {
          if (rowCount >= maxStaff) break;
          body += `<tr>${first ? `<td rowspan="${Math.min(maxStaff, Object.keys(details).reduce((n, r) => n + Object.keys(details[r]).length, 0))}">${++sno}</td><td rowspan="${Math.min(maxStaff, 1)}">${escapeHtml(catName)}</td>` : ''}
            <td>${escapeHtml(staffNameLookup[stfId] || '')}</td><td class="text-end">${rate / 10}</td></tr>`;
          first = false;
          avgTotal += rate / 10; avgCount += 1;
          rowCount += 1;
        }
        if (rowCount >= maxStaff) break;
      }
    }
    body += `<tr><td colspan="3" class="text-end">Average</td><td class="text-end">${avgCount ? Math.round((avgTotal / avgCount) * 10) / 10 : 0}</td></tr></tbody></table>`;
  }

  return wrapReportPanel(`<h4 class="text-center">Overall ${escapeHtml(feedbackTitle)}</h4>${body}`);
}

export async function buildSubjectFeedbackHtml(feedbackId, feedbackTitle, courseLabel, cidStr, subjectIds, defaultType = 'theory') {
  if (!subjectIds.length) return wrapReportPanel('');

  const subjectIdsSql = subjectIds.map((id) => `'${escapeSql(String(id))}'`).join(',');
  const cidEsc = escapeSql(cidStr);
  const fidEsc = escapeSql(String(feedbackId));

  const [topicMap, categoryMap, subRows, topicRateIndex] = await Promise.all([
    loadFeedbackTopics(),
    loadTimetableCategoryMap(),
    prisma.$queryRawUnsafe(
      `SELECT B.id, B.subject_name, B.subject_category, C.staff_id FROM basic_subject_tt_tb AS B
       INNER JOIN feedback_subject AS C ON B.id = C.subject_id
       WHERE B.del = 1 AND C.del = 1 AND B.id IN (${subjectIdsSql})
         AND C.f_id = '${fidEsc}' AND C.course_id = '${cidEsc}'`,
    ),
    loadFeedbackTopicRateIndex(feedbackId, { courseId: cidStr, subjectIds }),
  ]);

  const allStaffIds = [];
  for (const row of subRows) {
    for (const stfId of String(row.staff_id || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      allStaffIds.push(stfId);
    }
  }
  const staffNameMap = await loadStaffBriefMap(allStaffIds);

  let html = '';
  for (const row of subRows) {
    const subjectId = String(row.id);
    let subType = defaultType;
    const catName = String(categoryMap[String(row.subject_category)] || '').toLowerCase();
    if (defaultType === 'theory') {
      if (catName === 'practical') subType = 'practical';
      else if (catName !== 'theory' && catName !== 'lecture') subType = 'online';
    } else if (defaultType === 'PG-Clinical') {
      subType = 'pg-clinical';
    }
    const topics = topicMap[subType.toLowerCase()] || {};
    const staffIds = {};
    for (const stfId of String(row.staff_id || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const name = staffNameMap.get(stfId);
      if (name) staffIds[stfId] = name;
    }

    let body = `<h5>${escapeHtml(courseLabel)} | ${escapeHtml(feedbackTitle)} — ${escapeHtml(row.subject_name)}</h5>
<table class="table table-bordered table-sm"><thead class="table-secondary"><tr><th>S.No.</th><th>Topic</th>`;
    for (const name of Object.values(staffIds)) body += `<th>${escapeHtml(name)}</th>`;
    body += '</tr></thead><tbody>';

    const totals = {};
    let sno = 0;
    for (const [catId, catName] of Object.entries(topics)) {
      body += `<tr><td>${++sno}</td><td>${escapeHtml(catName)}</td>`;
      for (const stfId of Object.keys(staffIds)) {
        const rate = topicRateIndex.get(`${cidStr}|${subjectId}|${stfId}|${catId}`);
        const avg = rate && Number(rate.cnt) > 0
          ? Math.round((Number(rate.total) / Number(rate.cnt)) * 10) / 10
          : 0;
        if (!totals[stfId]) totals[stfId] = [0, 0];
        totals[stfId][0] += avg;
        totals[stfId][1] += 5;
        body += `<td class="text-end">${avg}</td>`;
      }
      body += '</tr>';
    }
    body += '<tr><td colspan="2" class="text-end">Total</td>';
    let avgRow = '<tr class="table-light"><td colspan="2" class="text-end">Average</td>';
    for (const stfId of Object.keys(staffIds)) {
      const pct = totals[stfId]?.[1] > 0 ? Math.round(((totals[stfId][0] / totals[stfId][1]) * 100) * 10) / 10 : 0;
      body += `<td class="text-end"><strong>${totals[stfId][0]}</strong></td>`;
      avgRow += `<td class="text-end"><strong>${pct}%</strong></td>`;
    }
    body += `</tr>${avgRow}</tr></tbody></table><hr>`;
    html += body;
  }
  return wrapReportPanel(html);
}

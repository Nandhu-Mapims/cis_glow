import { prisma } from '../../../../config/prisma.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { convertNYear } from '../../../fees/feeHelpers.js';
import { auditFields, logAcademicSetup } from '../../setup/setupAudit.js';

const PAGE = 'period_setup.php';

const DAY_OPTIONS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
];

export function periodCourseKey(courseName, year, academicType) {
  return `${courseName}__${year}__${academicType}`;
}

export function parsePeriodCourseKey(key) {
  const parts = String(key || '').split('__');
  if (parts.length !== 3) return null;
  return {
    courseName: parts[0],
    year: String(parts[1]),
    academicType: parts[2],
  };
}

function formatTime(val) {
  if (!val || String(val) === '00:00:00') return '';
  const str = String(val);
  if (/^\d{2}:\d{2}/.test(str)) return str.slice(0, 5);
  const d = new Date(`1970-01-01T${str}`);
  if (Number.isNaN(d.getTime())) return str.slice(0, 5);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeTimeInput(val) {
  const s = String(val || '').trim();
  if (!s) return '00:00:00';
  return s.length === 5 ? `${s}:00` : s;
}

/** Legacy period_setup.php getCombinedList */
export function getCombinedList(cListTmp) {
  const groups = String(cListTmp || '').replace(/\s/g, '').split(')');
  const results = { start: [], size: {}, list: [] };
  for (const group of groups) {
    const cleaned = group.replace(/\(/g, '');
    if (!cleaned) continue;
    const groupList = cleaned.split(',').filter(Boolean);
    if (groupList.length <= 1) continue;
    let fcount = 0;
    let ftmp = '';
    let prevNo = '';
    let fstatus = 0;
    for (const groupNo of groupList) {
      if (!ftmp) ftmp = groupNo;
      if (!prevNo || prevNo === String(Number(groupNo) - 1)) {
        prevNo = groupNo;
        fcount += 1;
        fstatus = 1;
      } else {
        fstatus = 0;
        break;
      }
    }
    if (fstatus === 1) {
      results.start.push(Number(ftmp));
      results.size[Number(ftmp)] = fcount;
      for (const groupNo of groupList) results.list.push(Number(groupNo));
    }
  }
  return results;
}

function buildPeriodCells(periodPerDay, breakPeriod, combinedList, existingByPeriod = {}, previewPeriods = null) {
  const breakList = String(breakPeriod || '').split(',').map((v) => Number(v.trim())).filter(Boolean);
  const combined = getCombinedList(combinedList);
  const cells = [];
  let period = 1;
  let pcount = 0;

  for (let p = 1; p <= periodPerDay; p += 1) {
    let periodList = '';
    let colspan = 1;
    let startPeriod = '';

    if (combined.start.includes(p) && (combined.size[p] || 0) > 1) {
      const size = combined.size[p];
      const parts = [];
      startPeriod = String(period);
      for (let pl = 0; pl < size; pl += 1) {
        parts.push(String(period));
        period += 1;
        p += 1;
      }
      p -= 1;
      periodList = parts.join(',');
      colspan = size;
    } else if (breakList.includes(p)) {
      periodList = 'Break';
      startPeriod = 'Break';
    } else {
      periodList = String(period);
      startPeriod = String(period);
      period += 1;
    }

    const preview = previewPeriods?.[pcount];
    const existing = existingByPeriod[startPeriod] || {};
    const session = preview?.session ?? existing.session ?? 'forenoon';
    const fromTime = preview?.fromTime ?? formatTime(existing.from_time);
    const toTime = preview?.toTime ?? formatTime(existing.to_time);

    cells.push({
      periodList,
      startPeriod,
      session: String(session).toLowerCase() === 'afternoon' ? 'afternoon' : 'forenoon',
      fromTime,
      toTime,
      colspan,
    });
    pcount += 1;
  }
  return cells;
}

async function buildPeriodCourseOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT course_name, MAX(total_semester) AS total_semester
     FROM basic_setup_course_tb
     WHERE del=1 GROUP BY course_name ORDER BY course_name DESC`,
  );
  const options = [];
  for (const row of rows) {
    const courseName = row.course_name;
    const duration = Number(row.total_semester) || 0;
    const groupRegular = `${courseName} (${duration} years) | Regular`;
    for (let i = 1; i <= duration; i += 1) {
      options.push({
        value: periodCourseKey(courseName, i, 'regular'),
        label: `${courseName} - ${convertNYear(i, courseName)} year`,
        group: groupRegular,
        courseName,
        year: String(i),
        academicType: 'regular',
      });
    }
    if (courseName === 'U.G') {
      const groupAdditional = `${courseName} (${duration} years) | Additional`;
      for (let i = 1; i <= duration; i += 1) {
        options.push({
          value: periodCourseKey(courseName, i, 'additional'),
          label: `${courseName} - ${convertNYear(i, courseName)} year`,
          group: groupAdditional,
          courseName,
          year: String(i),
          academicType: 'additional',
        });
      }
    }
  }
  return options;
}

async function loadScopeConfig(scope, preview = {}) {
  const usePreview = Boolean(preview.usePreview);
  let selectedDays = Array.isArray(preview.selectedDays) ? preview.selectedDays : [];
  let periodPerDay = Number(preview.periodPerDay) || 0;
  let breakPeriod = String(preview.breakPeriod ?? '');

  if (!usePreview) {
    const configRow = await prisma.$queryRawUnsafe(
      `SELECT period_list, period_per_day, period_break FROM period_config_tb
       WHERE del=1 AND course_name='${escapeSql(scope.courseName)}'
         AND academic_year='${escapeSql(scope.year)}' AND academic_type='${escapeSql(scope.academicType)}'
       LIMIT 1`,
    );
    if (configRow[0]) {
      selectedDays = String(configRow[0].period_list || '').split(',').filter(Boolean);
      periodPerDay = Number(configRow[0].period_per_day) || 0;
      breakPeriod = configRow[0].period_break || '';
    }
  }

  return { selectedDays, periodPerDay, breakPeriod };
}

async function buildDayRows(scope, selectedDays, periodPerDay, breakPeriod, previewDayRows = null) {
  if (!selectedDays.length || !periodPerDay) return [];

  const dayRows = [];
  for (const day of selectedDays) {
    const previewRow = previewDayRows?.find((r) => r.day === day);
    let dayId = null;
    let combined = previewRow?.combined ?? '';

    if (!previewRow) {
      const configDay = await prisma.$queryRawUnsafe(
        `SELECT id, period_combine FROM period_config_tb
         WHERE del=1 AND course_name='${escapeSql(scope.courseName)}'
           AND academic_year='${escapeSql(scope.year)}' AND academic_type='${escapeSql(scope.academicType)}'
           AND period_day='${escapeSql(day)}' LIMIT 1`,
      );
      if (configDay[0]) {
        dayId = Number(configDay[0].id);
        combined = configDay[0].period_combine || '';
      }
    } else if (previewRow.dayId) {
      dayId = previewRow.dayId;
    }

    const periodRows = await prisma.$queryRawUnsafe(
      `SELECT period_no, CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time, session
       FROM period_set_up
       WHERE del=1 AND course_name='${escapeSql(scope.courseName)}'
         AND academic_year='${escapeSql(scope.year)}' AND academic_type='${escapeSql(scope.academicType)}'
         AND p_days='${escapeSql(day)}'`,
    );
    const existingByPeriod = Object.fromEntries(periodRows.map((r) => [String(r.period_no), r]));

    dayRows.push({
      day,
      dayId,
      combined,
      periods: buildPeriodCells(
        periodPerDay,
        breakPeriod,
        combined,
        existingByPeriod,
        previewRow?.periods,
      ),
    });
  }
  return dayRows;
}

export async function loadPeriodSetup(memberId, fields = {}, audit = {}) {
  const courseOptions = await buildPeriodCourseOptions();
  const courseKey = String(fields.courseKey || fields.course_name || '').trim();
  const scope = parsePeriodCourseKey(courseKey);
  const usePreview = fields.action === 'change' || Boolean(fields.preview);

  let selectedDays = Array.isArray(fields.selectedDays) ? fields.selectedDays : [];
  let periodPerDay = Number(fields.periodPerDay || fields.period_per_day) || 0;
  let breakPeriod = String(fields.breakPeriod ?? fields.break_period ?? '');
  let dayRows = [];

  if (scope) {
    if (!usePreview && !selectedDays.length) {
      const config = await loadScopeConfig(scope);
      selectedDays = config.selectedDays;
      periodPerDay = config.periodPerDay;
      breakPeriod = config.breakPeriod;
    }
    dayRows = await buildDayRows(
      scope,
      selectedDays,
      periodPerDay,
      breakPeriod,
      usePreview ? fields.dayRows : null,
    );
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', courseKey, memberId, audit);
  return {
    courseOptions,
    courseKey,
    scope,
    dayOptions: DAY_OPTIONS,
    selectedDays,
    periodPerDay,
    breakPeriod,
    showSave: Boolean(selectedDays.length && periodPerDay),
    dayRows,
  };
}

export async function savePeriodSetup(payload, memberId, audit = {}) {
  if (payload.action === 'change') {
    return {
      success: true,
      preview: true,
      ...(await loadPeriodSetup(memberId, { ...payload, preview: true }, { ...audit, skipLog: true })),
    };
  }

  const scope = parsePeriodCourseKey(payload.courseKey || payload.course_name)
    || (payload.courseName ? {
      courseName: payload.courseName,
      year: String(payload.year || payload.cyear || ''),
      academicType: payload.academicType || payload.cacademic || '',
    } : null);

  if (!scope?.courseName || !scope.year || !scope.academicType) {
    return { success: false, message: 'Course selection is required' };
  }

  const selectedDays = Array.isArray(payload.selectedDays) ? payload.selectedDays : [];
  const periodPerDay = Number(payload.periodPerDay || payload.period_per_day) || 0;
  const breakPeriod = String(payload.breakPeriod ?? payload.break_period ?? '');
  const dayRows = Array.isArray(payload.dayRows) ? payload.dayRows : [];
  const periodList = selectedDays.join(',');
  const { create, update } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(
    `UPDATE period_config_tb SET del=0, updated_by='${escapeSql(memberId)}',
     updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
     WHERE del=1 AND course_name='${escapeSql(scope.courseName)}'
       AND academic_year='${escapeSql(scope.year)}' AND academic_type='${escapeSql(scope.academicType)}'`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE period_set_up SET del=0, updated_by='${escapeSql(memberId)}',
     updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
     WHERE del=1 AND course_name='${escapeSql(scope.courseName)}'
       AND academic_year='${escapeSql(scope.year)}' AND academic_type='${escapeSql(scope.academicType)}'`,
  );

  for (const dayRow of dayRows) {
    const day = String(dayRow.day || '').trim();
    const combined = String(dayRow.combined || '').trim();
    if (!day) continue;

    let configId = dayRow.dayId ? Number(dayRow.dayId) : null;
    if (!configId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO period_config_tb (course_name, academic_year, academic_type, period_day, period_combine,
         period_list, period_per_day, period_break, created_dt, created_ip, created_by, del)
         VALUES ('${escapeSql(scope.courseName)}', '${escapeSql(scope.year)}', '${escapeSql(scope.academicType)}',
         '${escapeSql(day)}', '${escapeSql(combined)}', '${escapeSql(periodList)}', ${periodPerDay},
         '${escapeSql(breakPeriod)}', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE period_config_tb SET period_day='${escapeSql(day)}', period_combine='${escapeSql(combined)}',
         period_list='${escapeSql(periodList)}', period_per_day=${periodPerDay}, period_break='${escapeSql(breakPeriod)}',
         del=1, updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
         WHERE id=${configId}`,
      );
    }

    const periods = Array.isArray(dayRow.periods) ? dayRow.periods : [];
    let pOrder = 1;
    for (const period of periods) {
      const periodListCell = String(period.periodList || '').trim();
      if (!periodListCell || periodListCell.replace(/,/g, '') === '') continue;

      const periodNos = periodListCell.split(',').filter(Boolean);
      const fromTime = normalizeTimeInput(period.fromTime);
      const toTime = normalizeTimeInput(period.toTime);
      const session = String(period.session || 'forenoon').toLowerCase() === 'afternoon' ? 'afternoon' : 'forenoon';
      let pCombined = 0;

      for (const periodNo of periodNos) {
        const existing = await prisma.$queryRawUnsafe(
          `SELECT id FROM period_set_up WHERE del=0 AND course_name='${escapeSql(scope.courseName)}'
             AND academic_year='${escapeSql(scope.year)}' AND academic_type='${escapeSql(scope.academicType)}'
             AND p_days='${escapeSql(day)}' AND period_no='${escapeSql(periodNo)}' LIMIT 1`,
        );
        const prdId = existing[0]?.id ? Number(existing[0].id) : null;

        if (!prdId) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO period_set_up (p_days, course_name, academic_year, academic_type, period_no, from_time,
             to_time, p_order, session, p_combined, created_dt, created_ip, created_by, del)
             VALUES ('${escapeSql(day)}', '${escapeSql(scope.courseName)}', '${escapeSql(scope.year)}',
             '${escapeSql(scope.academicType)}', '${escapeSql(periodNo)}', '${escapeSql(fromTime)}',
             '${escapeSql(toTime)}', ${pOrder}, '${escapeSql(session)}', ${pCombined},
             NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)`,
          );
        } else {
          await prisma.$executeRawUnsafe(
            `UPDATE period_set_up SET p_days='${escapeSql(day)}', period_no='${escapeSql(periodNo)}',
             from_time='${escapeSql(fromTime)}', to_time='${escapeSql(toTime)}', p_order=${pOrder},
             session='${escapeSql(session)}', p_combined=${pCombined}, del=1,
             updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
             WHERE id=${prdId}`,
          );
        }
        pCombined = 1;
        pOrder += 1;
      }
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', periodCourseKey(scope.courseName, scope.year, scope.academicType), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadPeriodSetup(memberId, {
      courseKey: periodCourseKey(scope.courseName, scope.year, scope.academicType),
      selectedDays,
      periodPerDay,
      breakPeriod,
    }, { ...audit, skipLog: true })),
  };
}

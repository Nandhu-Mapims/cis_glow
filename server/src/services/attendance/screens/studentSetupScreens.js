import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, formatDateDisplay, toIsoDate } from '../setupAudit.js';
import { logStudentAtt } from '../studentAttendanceShared.js';

const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function trimTime(value) {
  const s = String(value || '');
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function parseCourseKey(courseKey) {
  if (!courseKey) return null;
  const [courseId, academicYear, academicType] = String(courseKey).split('___');
  if (!courseId || !academicYear) return null;
  return { courseId, academicYear, academicType: academicType || 'regular' };
}

async function loadRoomOptions() {
  const blocks = await prisma.$queryRawUnsafe(
    'SELECT id, block_name FROM blocks_tb WHERE del = 1 ORDER BY block_name ASC',
  );
  const rooms = await prisma.$queryRawUnsafe(
    'SELECT id, block_id, room_name FROM rooms_tb WHERE del = 1 ORDER BY room_name ASC',
  );
  const blockMap = new Map(blocks.map((b) => [String(b.id), b.block_name]));
  const grouped = [];
  for (const block of blocks) {
    const blockRooms = rooms.filter((r) => String(r.block_id) === String(block.id));
    if (!blockRooms.length) continue;
    grouped.push({
      blockId: String(block.id),
      blockName: block.block_name,
      rooms: blockRooms.map((r) => ({ id: String(r.id), name: r.room_name })),
    });
  }
  const flat = rooms.map((r) => ({
    id: String(r.id),
    name: r.room_name,
    blockName: blockMap.get(String(r.block_id)) || '',
  }));
  return { grouped, flat };
}

async function buildPgCourseOptions() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { pg_academic_year: true },
  });
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name, total_semester FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = 'P.G' ORDER BY c_order ASC`,
  );
  const options = [];
  for (const course of courses) {
    const dept = course.department_name && course.department_name !== '-'
      ? ` - ${course.department_name}`
      : '';
    const baseLabel = `${course.degree_name}${dept}`;
    const totalSemester = Number(course.total_semester) || 1;
    if (setup?.pg_academic_year) {
      options.push({
        value: `${course.id}___${setup.pg_academic_year}___regular`,
        label: `${baseLabel} | ${setup.pg_academic_year} (Regular)`,
        courseId: String(course.id),
        academicYear: setup.pg_academic_year,
        academicType: 'regular',
        totalSemester,
      });
    }
  }
  return options;
}

async function loadPgGroups(courseId, academicYear, currentYear, academicType) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT att_group,
            CAST(MIN(from_date) AS CHAR) AS from_date,
            CAST(MIN(to_date) AS CHAR) AS to_date,
            CAST(MIN(from_time) AS CHAR) AS from_time,
            CAST(MIN(to_time) AS CHAR) AS to_time,
            MIN(room_no) AS room_no,
            GROUP_CONCAT(days ORDER BY FIELD(days, 'sunday','monday','tuesday','wednesday','thursday','friday','saturday') SEPARATOR ',') AS days,
            GROUP_CONCAT(id ORDER BY FIELD(days, 'sunday','monday','tuesday','wednesday','thursday','friday','saturday') SEPARATOR ',') AS row_ids
     FROM student_pgatt_time
     WHERE del = 1
       AND course_id = '${escapeSql(String(courseId))}'
       AND academic_year = '${escapeSql(String(academicYear))}'
       AND current_year = '${escapeSql(String(currentYear))}'
       AND academic_type = '${escapeSql(String(academicType))}'
     GROUP BY att_group
     ORDER BY att_group ASC`,
  );
  return rows.map((row) => {
    const days = String(row.days || '').split(',').filter(Boolean);
    const ids = String(row.row_ids || '').split(',');
    const dayRows = days.map((day, index) => ({
      day,
      id: ids[index] ? Number(ids[index]) : null,
    }));
    return {
      att_group: Number(row.att_group),
      from_date: formatDateDisplay(row.from_date),
      to_date: formatDateDisplay(row.to_date),
      from_time: trimTime(row.from_time),
      to_time: trimTime(row.to_time),
      room_no: String(row.room_no || ''),
      days,
      dayRows,
    };
  });
}

export async function loadSmrSetupScreen(memberId, fields = {}, audit = {}) {
  const courseType = fields.course_type || 'U.G';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, course_type, od_type, leave_apply_days FROM stu_leave_setup_tb
     WHERE del=1 AND course_type='${escapeSql(courseType)}' LIMIT 1`,
  );
  await logStudentAtt('stu_leave_approval_setup.php', 'View', 'Successful', courseType, memberId, audit);
  return {
    course_type: courseType,
    setup: rows[0] ? {
      id: Number(rows[0].id),
      courseType: rows[0].course_type,
      odType: rows[0].od_type,
      leaveApplyDays: rows[0].leave_apply_days,
    } : null,
  };
}

export async function saveSmrSetupScreen(payload, memberId, audit = {}) {
  const { update, create } = auditFields(memberId, audit);
  const courseType = escapeSql(payload.course_type || 'U.G');
  const odType = escapeSql(payload.od_type || '');
  const leaveApply = Number(payload.leave_apply || payload.leave_apply_days || 0) || 0;
  const rid = payload.r_id || payload.id || payload.setup?.id;

  if (rid) {
    await prisma.$executeRawUnsafe(
      `UPDATE stu_leave_setup_tb SET course_type='${courseType}', od_type='${odType}',
       leave_apply_days=${leaveApply}, updated_by='${escapeSql(memberId)}',
       updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW() WHERE id=${Number(rid)}`,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO stu_leave_setup_tb (staff_id, course_type, payroll_start, od_type, leave_apply_days,
        created_dt, created_ip, created_by, del)
       VALUES ('', '${courseType}', '', '${odType}', ${leaveApply},
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)`,
    );
  }
  await logStudentAtt('stu_leave_approval_setup.php', 'Update', 'Successful', courseType, memberId, audit);
  return { success: true, message: 'SMR setup saved', ...(await loadSmrSetupScreen(memberId, { course_type: courseType }, { ...audit, skipLog: true })) };
}

export async function loadPgAttSetupScreen(memberId, fields = {}, audit = {}) {
  const courseOptions = await buildPgCourseOptions();
  const courseKey = fields.course_name || fields.course_key || courseOptions[0]?.value || '';
  const parsed = parseCourseKey(courseKey);
  const selectedOption = courseOptions.find((o) => o.value === courseKey) || courseOptions[0] || null;
  const currentYear = String(
    fields.semester_name || fields.current_year || fields.tt_cyear || '1',
  );
  const totalSemester = selectedOption?.totalSemester || 1;
  const rooms = await loadRoomOptions();

  let groups = [];
  if (parsed?.courseId && parsed.academicYear && currentYear) {
    groups = await loadPgGroups(
      parsed.courseId,
      parsed.academicYear,
      currentYear,
      parsed.academicType,
    );
  }

  await logStudentAtt('pg_attendance_setup.php', 'View', 'Successful', String(parsed?.courseId || ''), memberId, audit);
  return {
    courseOptions,
    course_key: selectedOption?.value || courseKey,
    course_id: parsed?.courseId || selectedOption?.courseId || '',
    academic_year: parsed?.academicYear || selectedOption?.academicYear || '',
    academic_type: parsed?.academicType || selectedOption?.academicType || 'regular',
    current_year: currentYear,
    total_semester: totalSemester,
    weekDays: WEEK_DAYS,
    rooms,
    groups,
  };
}

export async function savePgAttSetupScreen(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const fields = payload.fields || payload;
  const courseId = fields.tt_course || fields.course_id;
  const academicYear = fields.tt_ayear || fields.academic_year;
  const currentYear = fields.tt_cyear || fields.current_year;
  const academicType = fields.tt_cacademic || fields.academic_type || 'regular';

  if (fields.delete_group && courseId) {
    await prisma.$executeRawUnsafe(
      `UPDATE student_pgatt_time SET del=0, updated_by='${escapeSql(memberId)}',
       updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
       WHERE course_id='${escapeSql(String(courseId))}' AND academic_year='${escapeSql(String(academicYear))}'
         AND current_year='${escapeSql(String(currentYear))}' AND academic_type='${escapeSql(String(academicType))}'
         AND att_group='${escapeSql(String(fields.delete_group))}'`,
    );
    await logStudentAtt('pg_attendance_setup.php', 'Delete', 'Successful', String(fields.delete_group), memberId, audit);
    return {
      success: true,
      message: 'PG setup group deleted',
      ...(await loadPgAttSetupScreen(memberId, {
        course_name: `${courseId}___${academicYear}___${academicType}`,
        semester_name: currentYear,
      }, { ...audit, skipLog: true })),
    };
  }

  const groups = fields.groups || [];
  if (!courseId || !academicYear || !currentYear || !groups.length) {
    return { error: 'Course, year, and at least one schedule row are required' };
  }

  for (const group of groups) {
    let attGroup = group.att_group || group.group_id;
    if (!attGroup) {
      const maxRow = await prisma.$queryRawUnsafe(
        'SELECT MAX(att_group) AS m FROM student_pgatt_time WHERE del=1',
      );
      attGroup = Number(maxRow[0]?.m || 0) + 1;
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE student_pgatt_time SET del=0, updated_by='${escapeSql(memberId)}',
         updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
         WHERE course_id='${escapeSql(String(courseId))}' AND academic_year='${escapeSql(String(academicYear))}'
           AND current_year='${escapeSql(String(currentYear))}' AND academic_type='${escapeSql(String(academicType))}'
           AND att_group='${escapeSql(String(attGroup))}'`,
      );
    }

    const fromDate = toIsoDate(group.from_date) || '2000-01-01';
    const toDate = toIsoDate(group.to_date) || '2000-01-01';
    const fromTime = trimTime(group.from_time) || '08:30';
    const toTime = trimTime(group.to_time) || '15:30';
    const roomNo = String(group.room_no || '');
    const dayRows = group.dayRows || (group.days || []).map((day, index) => ({
      day,
      id: group.row_ids?.[index] ? Number(group.row_ids[index]) : null,
    }));

    for (const entry of dayRows) {
      const day = String(entry.day || '').toLowerCase();
      if (!day) continue;
      if (entry.id) {
        await prisma.$executeRawUnsafe(
          `UPDATE student_pgatt_time SET
            course_id='${escapeSql(String(courseId))}',
            academic_year='${escapeSql(String(academicYear))}',
            current_year='${escapeSql(String(currentYear))}',
            academic_type='${escapeSql(String(academicType))}',
            att_group=${Number(attGroup)},
            from_date='${escapeSql(fromDate)}',
            to_date='${escapeSql(toDate)}',
            days='${escapeSql(day)}',
            from_time='${escapeSql(fromTime)}:00',
            to_time='${escapeSql(toTime)}:00',
            room_no='${escapeSql(roomNo)}',
            del=1,
            updated_by='${escapeSql(memberId)}',
            updated_ip='${escapeSql(update.updated_ip)}',
            updated_dt=NOW()
           WHERE id=${Number(entry.id)}`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO student_pgatt_time (course_id, academic_year, current_year, academic_type, att_group,
            from_date, to_date, days, from_time, to_time, room_no,
            created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
           VALUES ('${escapeSql(String(courseId))}', '${escapeSql(String(academicYear))}',
            '${escapeSql(String(currentYear))}', '${escapeSql(String(academicType))}',
            ${Number(attGroup)}, '${escapeSql(fromDate)}', '${escapeSql(toDate)}', '${escapeSql(day)}',
            '${escapeSql(fromTime)}:00', '${escapeSql(toTime)}:00', '${escapeSql(roomNo)}',
            NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
            NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)`,
        );
      }
    }
  }

  await logStudentAtt('pg_attendance_setup.php', 'Update', 'Successful', String(courseId), memberId, audit);
  return {
    success: true,
    message: 'PG setup saved',
    ...(await loadPgAttSetupScreen(memberId, {
      course_name: `${courseId}___${academicYear}___${academicType}`,
      semester_name: currentYear,
    }, { ...audit, skipLog: true })),
  };
}

export async function loadInternAttSetupScreen(memberId, fields = {}, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id,
            CAST(permission_time AS CHAR) AS permission_time,
            CAST(late_time AS CHAR) AS late_time,
            CAST(sat_time AS CHAR) AS sat_time,
            od_type, leave_apply_days, defaulter_apply, inc_lr_holiday
     FROM basic_setup_stuatt WHERE del = 1 AND id = 1 LIMIT 1`,
  );
  await logStudentAtt('intern_att_setup.php', 'View', 'Successful', '', memberId, audit);
  const row = rows[0];
  return {
    setup: row ? {
      id: Number(row.id),
      permissionTime: trimTime(row.permission_time),
      lateTime: trimTime(row.late_time),
      satTime: trimTime(row.sat_time),
      odType: row.od_type || '',
      leaveApplyDays: row.leave_apply_days != null ? String(row.leave_apply_days) : '',
      defaulterApply: row.defaulter_apply != null ? String(row.defaulter_apply) : '',
      incLrHoliday: Number(row.inc_lr_holiday) === 1,
    } : null,
  };
}

export async function saveInternAttSetupScreen(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const permissionTime = escapeSql(String(payload.p_time || payload.permission_time || '01:00').slice(0, 5));
  const lateTime = escapeSql(String(payload.l_time || payload.late_time || '00:10').slice(0, 5));
  const satTime = escapeSql(String(payload.s_time || payload.sat_time || '12:45').slice(0, 5));
  const odType = escapeSql(payload.od_type || '');
  const leaveApply = Number(payload.leave_apply || payload.leave_apply_days || 0) || 0;
  const defaulterApply = Number(payload.defaulter_apply || 0) || 0;
  const incLrHoliday = payload.inc_lr_holiday ? 1 : 0;
  const setupId = Number(payload.r_id || payload.id || 1);

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM basic_setup_stuatt WHERE del = 1 AND id = ${setupId} LIMIT 1`,
  );

  if (existing.length) {
    await prisma.$executeRawUnsafe(
      `UPDATE basic_setup_stuatt SET
        permission_time='${permissionTime}:00',
        late_time='${lateTime}:00',
        sat_time='${satTime}:00',
        od_type='${odType}',
        leave_apply_days=${leaveApply},
        defaulter_apply=${defaulterApply},
        inc_lr_holiday=${incLrHoliday},
        updated_by='${escapeSql(memberId)}',
        updated_ip='${escapeSql(update.updated_ip)}',
        updated_dt=NOW()
       WHERE id=${setupId}`,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO basic_setup_stuatt (minimum_permission, permission_time, p_lop, p_lop_type, minimum_late,
        late_time, late_deduct, l_lop, l_lop_type, sat_time, od_type, leave_apply_days, defaulter_apply,
        inc_lr_holiday, created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
       VALUES (0, '${permissionTime}:00', '', '', '', '${lateTime}:00', '', '', '', '${satTime}:00',
        '${odType}', ${leaveApply}, ${defaulterApply}, ${incLrHoliday},
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
        NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)`,
    );
  }

  await logStudentAtt('intern_att_setup.php', 'Update', 'Successful', String(setupId), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadInternAttSetupScreen(memberId, {}, { ...audit, skipLog: true })),
  };
}

const YEAR_INCHARGE_LABELS = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
const ATT_EOS = 2016;

function parseYearInchargeCourseKey(courseKey) {
  if (!courseKey) return null;
  const [courseId, academicYear, academicBatch] = String(courseKey).split('___');
  if (!courseId || !academicYear) return null;
  return {
    courseId,
    academicYear,
    academicBatch: academicBatch || 'regular',
  };
}

function yearInchargeAcademicYears(setupYear, yearOfStart, batch) {
  const floor = Math.max(Number(yearOfStart) || ATT_EOS, ATT_EOS);
  const base = parseInt(String(setupYear || '').split('-')[0], 10);
  if (!base) return [];
  const years = [];
  for (let i = base; i >= floor; i -= 1) {
    years.push(batch === 'additional' ? `${i}-${i + 1}` : `${i + 1}-${i + 2}`);
  }
  return years;
}

function academicYearStart(academicYear) {
  return parseInt(String(academicYear || '').split('-')[0], 10) || 0;
}

function mergeYearInchargeAcademicYears(setupYear, yearOfStart, batch, availableYears) {
  const floor = Math.max(Number(yearOfStart) || ATT_EOS, ATT_EOS);
  const generated = yearInchargeAcademicYears(setupYear, yearOfStart, batch);
  const merged = new Set(generated);
  for (const year of availableYears || []) {
    if (year) merged.add(String(year));
  }
  return [...merged]
    .filter((year) => academicYearStart(year) >= floor)
    .sort((a, b) => academicYearStart(b) - academicYearStart(a));
}

function pushYearInchargeOptions(options, course, batch, setupYear, availableYears) {
  if (!setupYear) return;
  const dept = course.department_name && course.department_name !== '-'
    ? ` - ${course.department_name}`
    : '';
  const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
  const degreeLabel = `${course.degree_name}${dept}`;
  const groupLabel = `${course.course_name} | ${degreeLabel} | ${ft} | ${batch === 'additional' ? 'Additional' : 'Regular'}`;
  const totalSemester = course.course_name === 'U.G'
    ? 5
    : (Number(course.total_semester) || 1);
  const batchLabel = batch === 'additional' ? 'Additional' : 'Regular';
  const yearFloor = Math.max(Number(course.year_of_start) || ATT_EOS, ATT_EOS);

  for (const acYear of mergeYearInchargeAcademicYears(setupYear, yearFloor, batch, availableYears)) {
    options.push({
      value: `${course.id}___${acYear}___${batch}`,
      label: `${degreeLabel} | ${acYear}${batch === 'additional' ? ` | ${batchLabel}` : ''}`,
      groupLabel,
      courseId: String(course.id),
      academicYear: acYear,
      academicBatch: batch,
      totalSemester,
    });
  }
}

async function buildYearInchargeCourseOptions() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { ug_academic_year: true, uga_academic_year: true, pg_academic_year: true },
  });
  const academicRows = await prisma.$queryRawUnsafe(
    `SELECT course_name, academic_year, academic_batch
     FROM basic_setup_academic WHERE del = 1`,
  );
  const availableByCourseBatch = new Map();
  for (const row of academicRows) {
    const batch = String(row.academic_batch || 'regular').toLowerCase();
    const key = `${row.course_name}:${batch}`;
    if (!availableByCourseBatch.has(key)) availableByCourseBatch.set(key, new Set());
    availableByCourseBatch.get(key).add(String(row.academic_year));
  }
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, total_semester, full_part_time, year_of_start
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
  );
  const options = [];
  for (const course of courses) {
    if (course.course_name === 'U.G') {
      pushYearInchargeOptions(
        options,
        course,
        'regular',
        setup?.ug_academic_year,
        availableByCourseBatch.get('U.G:regular'),
      );
      pushYearInchargeOptions(
        options,
        course,
        'additional',
        setup?.uga_academic_year,
        availableByCourseBatch.get('U.G:additional'),
      );
    } else if (course.course_name === 'P.G') {
      pushYearInchargeOptions(
        options,
        course,
        'regular',
        setup?.pg_academic_year,
        availableByCourseBatch.get('P.G:regular'),
      );
    }
  }
  return options;
}

async function loadInchargeStaffOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_name, staff_initial, staff_title, staff_id FROM staff_profile_tb
     WHERE del = 1 AND job_category IN ('255', '271')
       AND (CAST(releaving_date AS CHAR) = '0000-00-00' OR releaving_date > CURDATE())
     ORDER BY staff_name ASC`,
  );
  return rows.map((row) => {
    const title = row.staff_title ? `${row.staff_title}.` : '';
    const name = `${title}${row.staff_name || ''} ${row.staff_initial || ''}`.trim();
    return {
      id: String(row.id),
      label: `${row.staff_id} | ${name}`,
    };
  });
}

export async function loadYearInchargeScreen(memberId, fields = {}, audit = {}) {
  const courseOptions = await buildYearInchargeCourseOptions();
  const staffOptions = await loadInchargeStaffOptions();
  const courseKey = fields.course_name || fields.course_key || '';
  const parsed = parseYearInchargeCourseKey(courseKey);
  const selected = courseOptions.find((opt) => opt.value === courseKey) || null;

  let yearRows = [];
  if (parsed) {
    const totalSemester = selected?.totalSemester || 5;
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, current_year, incharge_staff FROM student_incharge_tb
       WHERE del = 1 AND course_id = ${Number(parsed.courseId)}
         AND academic_year = '${escapeSql(parsed.academicYear)}'
         AND (academic_batch = '${escapeSql(parsed.academicBatch)}'
              OR (academic_batch = '' AND '${escapeSql(parsed.academicBatch)}' = 'regular'))`,
    );
    const byYear = new Map(existing.map((row) => [String(row.current_year), row]));
    for (let year = 1; year <= totalSemester; year += 1) {
      const row = byYear.get(String(year));
      yearRows.push({
        id: row ? Number(row.id) : null,
        current_year: String(year),
        year_label: YEAR_INCHARGE_LABELS[year] || String(year),
        incharge_staff: row ? String(row.incharge_staff) : '',
      });
    }
  }

  await logStudentAtt('staff_incharge_setup.php', 'View', 'Successful', String(parsed?.courseId || ''), memberId, audit);
  return {
    courseOptions,
    staffOptions,
    course_key: courseKey,
    course_id: parsed?.courseId || '',
    academic_year: parsed?.academicYear || '',
    academic_batch: parsed?.academicBatch || 'regular',
    yearRows,
  };
}

export async function saveYearInchargeScreen(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const fields = payload.fields || payload;
  const courseId = fields.hd_course_id || fields.course_id;
  const academicYear = fields.hd_academic_year || fields.academic_year;
  const academicBatch = fields.academic_batch || 'regular';
  const rows = fields.rows || [];

  if (!courseId || !academicYear) {
    return { error: 'Course and academic year are required' };
  }

  for (const row of rows) {
    const inchargeStaff = String(row.incharge_staff || '');
    if (row.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE student_incharge_tb SET incharge_staff='${escapeSql(inchargeStaff)}',
         updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
         WHERE id=${Number(row.id)}`,
      );
    } else if (inchargeStaff) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO student_incharge_tb (course_id, academic_year, academic_batch, current_year, incharge_staff,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, test, del)
         VALUES (${Number(courseId)}, '${escapeSql(String(academicYear))}',
          '${escapeSql(String(academicBatch))}', '${escapeSql(String(row.current_year))}',
          '${escapeSql(inchargeStaff)}', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', '', 1)`,
      );
    }
  }

  await logStudentAtt('staff_incharge_setup.php', 'Update', 'Successful', String(courseId), memberId, audit);
  return {
    success: true,
    message: 'Year incharge saved',
    ...(await loadYearInchargeScreen(memberId, {
      course_name: `${courseId}___${academicYear}___${academicBatch}`,
    }, { ...audit, skipLog: true })),
  };
}

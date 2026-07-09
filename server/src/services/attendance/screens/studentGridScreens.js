import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, formatDateDisplay, toIsoDate } from '../setupAudit.js';
import { logStudentAtt } from '../studentAttendanceShared.js';

const ROSTER_LIST_PAGE_SIZE = 20;
const ATT_EOS = 2016;

function internRosterAcademicYears(setupYear, yearOfStart) {
  const floor = Math.max(Number(yearOfStart) || ATT_EOS, ATT_EOS);
  const base = parseInt(String(setupYear || '').split('-')[0], 10);
  if (!base) return [];
  const years = [];
  for (let i = base; i >= floor; i -= 1) {
    years.push(`${i}-${i + 1}`);
  }
  return years;
}

function rosterListPagination(page, limit, total) {
  const pageSize = Math.max(1, Math.min(100, Number(limit) || ROSTER_LIST_PAGE_SIZE));
  const totalCount = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const pageNum = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const offset = (pageNum - 1) * pageSize;
  return {
    page: pageNum,
    pageSize,
    total: totalCount,
    totalPages,
    from: totalCount ? offset + 1 : 0,
    to: Math.min(offset + pageSize, totalCount),
    offset,
  };
}

function trimTime(value) {
  const s = String(value || '');
  return s.length >= 5 ? s.slice(0, 5) : s;
}

async function loadRoomOptions() {
  const blocks = await prisma.$queryRawUnsafe(
    'SELECT id, block_name FROM blocks_tb WHERE del = 1 ORDER BY block_name ASC',
  );
  const rooms = await prisma.$queryRawUnsafe(
    'SELECT id, block_id, room_name FROM rooms_tb WHERE del = 1 ORDER BY room_name ASC',
  );
  const roomNameById = new Map(rooms.map((r) => [String(r.id), r.room_name]));
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
  return { grouped, roomNameById };
}

async function buildPgRosterCourseOptions() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { pg_academic_year: true },
  });
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name, course_duration FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = 'P.G' ORDER BY c_order ASC`,
  );
  const options = [];
  for (const course of courses) {
    const dept = course.department_name && course.department_name !== '-'
      ? ` - ${course.department_name}`
      : '';
    const groupLabel = `${course.degree_name}${dept} | ${setup?.pg_academic_year || ''}`;
    const duration = Number(course.course_duration) || 1;
    for (let year = 1; year <= duration; year += 1) {
      options.push({
        value: `${course.id}___${setup?.pg_academic_year || ''}___${year}`,
        label: `${groupLabel} — Year ${year}`,
        groupLabel,
      });
    }
  }
  return options;
}

async function resolveStudentListForCourses(courseKeys = []) {
  const rolls = [];
  for (const key of courseKeys) {
    const [courseId, academicYear, currentYear] = String(key).split('___');
    if (!courseId || !academicYear || !currentYear) continue;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT register_no FROM student_academic_tb
       WHERE del = 1 AND course_id = '${escapeSql(courseId)}'
         AND academic_year = '${escapeSql(academicYear)}'
         AND current_year = '${escapeSql(currentYear)}'`,
    );
    rolls.push(...rows.map((r) => r.register_no).filter(Boolean));
  }
  return [...new Set(rolls)].join(',');
}

async function buildInternRosterCourseOptions() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { ug_academic_year: true, uga_academic_year: true },
  });
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name, full_part_time, year_of_start, course_duration
     FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = 'U.G' ORDER BY c_order ASC`,
  );
  const options = [];
  for (const course of courses) {
    const dept = course.department_name && course.department_name !== '-'
      ? ` - ${course.department_name}`
      : '';
    const duration = String(course.course_duration || '5');
    const yearFloor = Math.max(Number(course.year_of_start) || ATT_EOS, ATT_EOS);

    for (const [academicType, setupYear] of [
      ['regular', setup?.ug_academic_year],
      ['additional', setup?.uga_academic_year],
    ]) {
      if (!setupYear) continue;
      const typeLabel = academicType === 'regular' ? 'Regular' : 'Additional';
      for (const academicYear of internRosterAcademicYears(setupYear, yearFloor)) {
        const batchRow = await prisma.$queryRawUnsafe(
          `SELECT batch_no FROM basic_subject_batch_tb
           WHERE del = 1 AND course_id = '${escapeSql(String(course.id))}'
             AND academic_year = '${escapeSql(academicYear)}'
             AND current_year = '${escapeSql(duration)}'
             AND academic_type = '${escapeSql(academicType)}'
           ORDER BY batch_no + 0 DESC LIMIT 1`,
        );
        const totalBatch = Math.max(1, Number(batchRow[0]?.batch_no) || 0);
        const groupLabel = `U.G | ${course.degree_name}${dept} | ${academicYear} | ${typeLabel}`;
        for (let batch = 1; batch <= totalBatch; batch += 1) {
          const batchLabel = String.fromCharCode(64 + batch);
          options.push({
            value: `${course.id}___${academicYear}___${academicType}___${batch}`,
            label: `${course.degree_name}${dept} | ${academicType === 'regular' ? 'Reg' : 'Add'} | ${academicYear} | ${batchLabel}`,
            groupLabel,
          });
        }
      }
    }
  }
  return options;
}

async function resolveStudentListForInternCourses(courseKeys = []) {
  const rolls = [];
  for (const key of courseKeys) {
    const [courseId, academicYear, academicType, batchNo] = String(key).split('___');
    if (!courseId || !academicYear || !academicType || !batchNo) continue;
    const course = await prisma.$queryRawUnsafe(
      `SELECT course_duration FROM basic_setup_course_tb
       WHERE del = 1 AND id = '${escapeSql(courseId)}' LIMIT 1`,
    );
    const currentYear = String(course[0]?.course_duration || '5');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT roll_no FROM basic_subject_batch_tb
       WHERE del = 1 AND course_id = '${escapeSql(courseId)}'
         AND academic_year = '${escapeSql(academicYear)}'
         AND academic_type = '${escapeSql(academicType)}'
         AND batch_no = '${escapeSql(batchNo)}'
         AND current_year = '${escapeSql(currentYear)}'
       LIMIT 1`,
    );
    if (rows[0]?.roll_no) {
      rolls.push(...String(rows[0].roll_no).split(',').map((r) => r.trim()).filter(Boolean));
    }
  }
  return [...new Set(rolls)].join(',');
}

async function loadInternDepartmentOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM master_setup
     WHERE category = 'Internship Department' AND del != 0
     ORDER BY category_order ASC`,
  );
  return rows.map((row) => ({
    value: String(row.id),
    label: row.category_name,
  }));
}

function mapRosterGroup(row) {
  return {
    id: Number(row.id),
    ref_id: Number(row.ref_id),
    from_date: formatDateDisplay(row.from_date),
    to_date: formatDateDisplay(row.to_date),
    from_time: trimTime(row.from_time),
    to_time: trimTime(row.to_time),
    room_no: String(row.room_no || ''),
    student_list: row.student_list || '',
    department: row.department || '',
  };
}

async function loadRosterGroups(rosterTable, refId, includeDept = false) {
  if (!refId) return [];
  const deptCol = includeDept ? ', department' : '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, ref_id, CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date,
            CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time,
            room_no, student_list${deptCol}
     FROM ${rosterTable} WHERE del = 1 AND ref_id = ${Number(refId)} ORDER BY id ASC`,
  );
  return rows.map(mapRosterGroup);
}

async function loadPgRosterList(roomNameById, page = 1, limit = ROSTER_LIST_PAGE_SIZE) {
  const countRow = await prisma.$queryRawUnsafe(
    'SELECT COUNT(DISTINCT ref_id) AS total FROM student_pgatt_roster WHERE del = 1',
  );
  const pagination = rosterListPagination(page, limit, countRow[0]?.total);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ref_id,
            GROUP_CONCAT(CONCAT(CAST(from_date AS CHAR), ' - ', CAST(to_date AS CHAR), ' - ', room_no) SEPARATOR ',') AS summary
     FROM student_pgatt_roster
     WHERE del = 1
     GROUP BY ref_id
     ORDER BY MIN(from_date) DESC
     LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`,
  );
  const rosters = rows.map((row) => {
    const parts = String(row.summary || '').split(',').filter(Boolean);
    const unique = [...new Set(parts)];
    const label = unique.map((part) => {
      const [from, to, roomId] = part.split(' - ');
      const roomName = roomNameById.get(String(roomId)) || roomId;
      const fromLabel = formatDateDisplay(from);
      const toLabel = formatDateDisplay(to);
      return `${fromLabel} to ${toLabel} - ${roomName}`;
    }).join(', ');
    return { ref_id: Number(row.ref_id), label };
  });
  return { rosters, pagination };
}

async function loadInternRosterList(roomNameById, deptNameById, page = 1, limit = ROSTER_LIST_PAGE_SIZE) {
  const countRow = await prisma.$queryRawUnsafe(
    'SELECT COUNT(DISTINCT ref_id) AS total FROM internship_att_roster WHERE del = 1',
  );
  const pagination = rosterListPagination(page, limit, countRow[0]?.total);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ref_id,
            GROUP_CONCAT(CONCAT(CAST(from_date AS CHAR), ' - ', CAST(to_date AS CHAR), ' - ', room_no, ' - ', department) SEPARATOR ',') AS summary
     FROM internship_att_roster
     WHERE del = 1
     GROUP BY ref_id
     ORDER BY MIN(from_date) DESC
     LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`,
  );
  const rosters = rows.map((row) => {
    const parts = String(row.summary || '').split(',').filter(Boolean);
    const unique = [...new Set(parts)];
    const label = unique.map((part) => {
      const [from, to, roomId, deptId] = part.split(' - ');
      const roomName = roomNameById.get(String(roomId)) || roomId;
      const deptName = deptNameById.get(String(deptId)) || deptId;
      const fromLabel = formatDateDisplay(from);
      const toLabel = formatDateDisplay(to);
      return `${deptName}: ${fromLabel} to ${toLabel} - ${roomName}`;
    }).join(', ');
    return { ref_id: Number(row.ref_id), label };
  });
  return { rosters, pagination };
}

export async function loadPgHolidayRosterScreen(memberId, fields = {}, audit = {}, mode = 'edit') {
  const legacy = mode === 'add' ? 'pg_holiday_roster_add.php' : 'pg_holiday_roster_edit.php';
  const rooms = await loadRoomOptions();
  const courseOptions = await buildPgRosterCourseOptions();

  if (fields.resolve_students && fields.course_keys?.length) {
    return { student_list: await resolveStudentListForCourses(fields.course_keys) };
  }

  if (mode === 'add') {
    await logStudentAtt(legacy, 'View', 'Successful', 'add', memberId, audit);
    return {
      mode: 'add',
      view: 'detail',
      courseOptions,
      rooms,
      student_list: '',
      course_keys: [],
      groups: [{
        id: null, from_date: '', to_date: '', from_time: '', to_time: '', room_no: '',
      }],
    };
  }

  const refId = fields.ref_id || fields.edit_row_id;
  if (!refId) {
    const { rosters, pagination } = await loadPgRosterList(rooms.roomNameById, fields.page);
    await logStudentAtt(legacy, 'View', 'Successful', 'list', memberId, audit);
    return { mode: 'edit', view: 'list', rosters, pagination, rooms, courseOptions };
  }

  const groups = await loadRosterGroups('student_pgatt_roster', refId);
  const studentRow = await prisma.$queryRawUnsafe(
    `SELECT student_list FROM student_pgatt_roster WHERE del = 1 AND ref_id = ${Number(refId)} LIMIT 1`,
  );
  await logStudentAtt(legacy, 'View', 'Successful', String(refId), memberId, audit);
  return {
    mode: 'edit',
    view: 'detail',
    ref_id: Number(refId),
    courseOptions,
    rooms,
    student_list: studentRow[0]?.student_list || groups[0]?.student_list || '',
    course_keys: fields.course_keys || [],
    groups: groups.length ? groups : [{
      id: null, from_date: '', to_date: '', from_time: '', to_time: '', room_no: '',
    }],
  };
}

export async function savePgHolidayRosterScreen(payload, memberId, audit = {}, mode = 'edit') {
  const legacy = mode === 'add' ? 'pg_holiday_roster_add.php' : 'pg_holiday_roster_edit.php';
  const { create, update } = auditFields(memberId, audit);
  const fields = payload.fields || payload;

  if (fields.delete_ref_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE student_pgatt_roster SET del = 0, updated_by = '${escapeSql(memberId)}',
       updated_ip = '${escapeSql(update.updated_ip)}', updated_dt = NOW()
       WHERE ref_id = ${Number(fields.delete_ref_id)}`,
    );
    await logStudentAtt(legacy, 'Delete', 'Successful', String(fields.delete_ref_id), memberId, audit);
    return {
      success: true,
      message: 'Roster deleted',
      ...(await loadPgHolidayRosterScreen(memberId, { page: fields.page || 1 }, { ...audit, skipLog: true }, 'edit')),
    };
  }

  if (fields.delete_row_id && fields.ref_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE student_pgatt_roster SET del = 0, updated_by = '${escapeSql(memberId)}',
       updated_ip = '${escapeSql(update.updated_ip)}', updated_dt = NOW()
       WHERE ref_id = ${Number(fields.ref_id)} AND id = ${Number(fields.delete_row_id)}`,
    );
    await logStudentAtt(legacy, 'Delete', 'Successful', String(fields.delete_row_id), memberId, audit);
    return {
      success: true,
      message: 'Schedule row deleted',
      ...(await loadPgHolidayRosterScreen(memberId, { ref_id: fields.ref_id }, { ...audit, skipLog: true }, 'edit')),
    };
  }

  const studentList = String(fields.student_list || '');
  const groups = fields.groups || [];
  if (!studentList || !groups.length) {
    return { error: 'Student list and at least one schedule row are required' };
  }

  let refId = Number(fields.ref_id || fields.edit_row_id || 0);
  if (mode === 'add' || !refId) {
    const maxRow = await prisma.$queryRawUnsafe(
      'SELECT MAX(ref_id) AS m FROM student_pgatt_roster',
    );
    refId = Number(maxRow[0]?.m || 0) + 1;
  }

  for (const group of groups) {
    const fromDate = toIsoDate(group.from_date);
    const toDate = toIsoDate(group.to_date);
    const roomNo = String(group.room_no || '');
    if (!fromDate || !toDate || !roomNo) continue;

    const fromTime = trimTime(group.from_time) || '08:30';
    const toTime = trimTime(group.to_time) || '15:30';

    if (group.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE student_pgatt_roster SET
          ref_id = ${refId},
          student_list = '${escapeSql(studentList)}',
          from_date = '${escapeSql(fromDate)}',
          to_date = '${escapeSql(toDate)}',
          from_time = '${escapeSql(fromTime)}:00',
          to_time = '${escapeSql(toTime)}:00',
          room_no = '${escapeSql(roomNo)}',
          del = 1,
          updated_by = '${escapeSql(memberId)}',
          updated_ip = '${escapeSql(update.updated_ip)}',
          updated_dt = NOW()
         WHERE id = ${Number(group.id)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO student_pgatt_roster (ref_id, from_date, to_date, from_time, to_time, room_no, student_list,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
         VALUES (${refId}, '${escapeSql(fromDate)}', '${escapeSql(toDate)}',
          '${escapeSql(fromTime)}:00', '${escapeSql(toTime)}:00', '${escapeSql(roomNo)}',
          '${escapeSql(studentList)}', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)`,
      );
    }
  }

  await logStudentAtt(legacy, 'Update', 'Successful', String(refId), memberId, audit);
  const reloadFields = mode === 'add'
    ? {}
    : { ref_id: refId };
  return {
    success: true,
    message: mode === 'add' ? 'PG holiday roster created' : 'PG holiday roster saved',
    ...(await loadPgHolidayRosterScreen(memberId, reloadFields, { ...audit, skipLog: true }, mode)),
  };
}

export async function loadInternHolidayRosterScreen(memberId, fields = {}, audit = {}, mode = 'edit') {
  const legacy = mode === 'add' ? 'intern_holiday_roster_add.php' : 'intern_holiday_roster_edit.php';
  const rooms = await loadRoomOptions();
  const courseOptions = await buildInternRosterCourseOptions();
  const departmentOptions = await loadInternDepartmentOptions();
  const deptNameById = new Map(departmentOptions.map((opt) => [opt.value, opt.label]));

  if (fields.resolve_students && fields.course_keys?.length) {
    return { student_list: await resolveStudentListForInternCourses(fields.course_keys) };
  }

  if (mode === 'add') {
    await logStudentAtt(legacy, 'View', 'Successful', 'add', memberId, audit);
    return {
      mode: 'add',
      view: 'detail',
      courseOptions,
      departmentOptions,
      rooms,
      student_list: '',
      course_keys: [],
      groups: [{
        id: null, from_date: '', to_date: '', from_time: '', to_time: '', room_no: '', department: '',
      }],
    };
  }

  const refId = fields.ref_id || fields.edit_row_id;
  if (!refId) {
    const { rosters, pagination } = await loadInternRosterList(rooms.roomNameById, deptNameById, fields.page);
    await logStudentAtt(legacy, 'View', 'Successful', 'list', memberId, audit);
    return { mode: 'edit', view: 'list', rosters, pagination, rooms, courseOptions, departmentOptions };
  }

  const groups = await loadRosterGroups('internship_att_roster', refId, true);
  const studentRow = await prisma.$queryRawUnsafe(
    `SELECT student_list FROM internship_att_roster WHERE del = 1 AND ref_id = ${Number(refId)} LIMIT 1`,
  );
  await logStudentAtt(legacy, 'View', 'Successful', String(refId), memberId, audit);
  return {
    mode: 'edit',
    view: 'detail',
    ref_id: Number(refId),
    courseOptions,
    departmentOptions,
    rooms,
    student_list: studentRow[0]?.student_list || groups[0]?.student_list || '',
    course_keys: fields.course_keys || [],
    groups: groups.length ? groups : [{
      id: null, from_date: '', to_date: '', from_time: '', to_time: '', room_no: '', department: '',
    }],
  };
}

export async function saveInternHolidayRosterScreen(payload, memberId, audit = {}, mode = 'edit') {
  const legacy = mode === 'add' ? 'intern_holiday_roster_add.php' : 'intern_holiday_roster_edit.php';
  const { create, update } = auditFields(memberId, audit);
  const fields = payload.fields || payload;

  if (fields.delete_ref_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE internship_att_roster SET del = 0, updated_by = '${escapeSql(memberId)}',
       updated_ip = '${escapeSql(update.updated_ip)}', updated_dt = NOW()
       WHERE ref_id = ${Number(fields.delete_ref_id)}`,
    );
    await logStudentAtt(legacy, 'Delete', 'Successful', String(fields.delete_ref_id), memberId, audit);
    return {
      success: true,
      message: 'Roster deleted',
      ...(await loadInternHolidayRosterScreen(memberId, { page: fields.page || 1 }, { ...audit, skipLog: true }, 'edit')),
    };
  }

  if (fields.delete_row_id && fields.ref_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE internship_att_roster SET del = 0, updated_by = '${escapeSql(memberId)}',
       updated_ip = '${escapeSql(update.updated_ip)}', updated_dt = NOW()
       WHERE ref_id = ${Number(fields.ref_id)} AND id = ${Number(fields.delete_row_id)}`,
    );
    await logStudentAtt(legacy, 'Delete', 'Successful', String(fields.delete_row_id), memberId, audit);
    return {
      success: true,
      message: 'Schedule row deleted',
      ...(await loadInternHolidayRosterScreen(memberId, { ref_id: fields.ref_id }, { ...audit, skipLog: true }, 'edit')),
    };
  }

  const studentList = String(fields.student_list || '');
  const groups = fields.groups || [];
  if (!studentList || !groups.length) {
    return { error: 'Student list and at least one schedule row are required' };
  }

  let refId = Number(fields.ref_id || fields.edit_row_id || 0);
  if (mode === 'add' || !refId) {
    const maxRow = await prisma.$queryRawUnsafe(
      'SELECT MAX(ref_id) AS m FROM internship_att_roster',
    );
    refId = Number(maxRow[0]?.m || 0) + 1;
  }

  for (const group of groups) {
    const fromDate = toIsoDate(group.from_date);
    const toDate = toIsoDate(group.to_date);
    const roomNo = String(group.room_no || '');
    const department = String(group.department || '');
    if (!fromDate || !toDate || !roomNo || !department) continue;

    const fromTime = trimTime(group.from_time) || '08:30';
    const toTime = trimTime(group.to_time) || '15:30';

    if (group.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE internship_att_roster SET
          ref_id = ${refId},
          student_list = '${escapeSql(studentList)}',
          department = '${escapeSql(department)}',
          from_date = '${escapeSql(fromDate)}',
          to_date = '${escapeSql(toDate)}',
          from_time = '${escapeSql(fromTime)}:00',
          to_time = '${escapeSql(toTime)}:00',
          room_no = '${escapeSql(roomNo)}',
          del = 1,
          updated_by = '${escapeSql(memberId)}',
          updated_ip = '${escapeSql(update.updated_ip)}',
          updated_dt = NOW()
         WHERE id = ${Number(group.id)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO internship_att_roster (ref_id, student_list, department, from_date, to_date, from_time, to_time, room_no,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
         VALUES (${refId}, '${escapeSql(studentList)}', '${escapeSql(department)}',
          '${escapeSql(fromDate)}', '${escapeSql(toDate)}',
          '${escapeSql(fromTime)}:00', '${escapeSql(toTime)}:00', '${escapeSql(roomNo)}',
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)`,
      );
    }
  }

  await logStudentAtt(legacy, 'Update', 'Successful', String(refId), memberId, audit);
  const reloadFields = mode === 'add' ? {} : { ref_id: refId };
  return {
    success: true,
    message: mode === 'add' ? 'Intern holiday roster created' : 'Intern holiday roster saved',
    ...(await loadInternHolidayRosterScreen(memberId, reloadFields, { ...audit, skipLog: true }, mode)),
  };
}

import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import {
  loadAcademicEvents,
  loadCalendarEventTypes,
  loadReportAuthorities,
  loadStaffCategories,
  searchStaffByCategory,
} from '../staffAttendanceShared.js';
import { auditFields, formatDateDisplay, logStaffAttSetup, toIsoDate } from '../setupAudit.js';

const PAGE_ADD = 'staff_calendar_add.php';
const PAGE_EDIT = 'staff_calendar_edit.php';

export async function loadCalendarAddSetup(memberId, fields = {}, audit = {}) {
  const [categories, authorities, events] = await Promise.all([
    loadStaffCategories(),
    loadReportAuthorities(),
    loadAcademicEvents(),
  ]);
  await logStaffAttSetup(PAGE_ADD, 'View', 'Successful', '', memberId, audit);
  return {
    categories,
    authorities,
    events,
    form: {
      from_date: fields.from_date || formatDateDisplay(new Date()),
      to_date: fields.to_date || formatDateDisplay(new Date()),
      staff_category: fields.staff_category || [],
      staff_id: fields.staff_id || '',
      authority: fields.authority || '',
      a_event: fields.a_event || '',
      comments: fields.comments || '',
      from_time: fields.from_time || '09:00',
      to_time: fields.to_time || '17:00',
      permission_time: fields.permission_time || '00:30',
    },
  };
}

export async function saveCalendarAddSetup(payload, memberId, audit = {}) {
  const fromDate = toIsoDate(payload.from_date);
  const toDate = toIsoDate(payload.to_date);
  if (!fromDate || !toDate) return { success: false, message: 'From and to dates are required' };

  const categories = Array.isArray(payload.staff_category) ? payload.staff_category : [];
  const staffCategoryList = categories.filter((c) => c && c !== 'All').join(',');

  const { create } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    INSERT INTO staff_calendar_tb (
      from_academic_date, to_academic_date, authority, academic_events, comments,
      p_time, from_time, to_time, staff_category, staff_id,
      created_dt, created_by, created_ip, del
    ) VALUES (
      '${escapeSql(fromDate)}', '${escapeSql(toDate)}',
      '${escapeSql(String(payload.authority || ''))}',
      '${escapeSql(String(payload.a_event || ''))}',
      '${escapeSql(String(payload.comments || ''))}',
      '${escapeSql(String(payload.permission_time || '00:30'))}',
      '${escapeSql(String(payload.from_time || '09:00'))}:00',
      '${escapeSql(String(payload.to_time || '17:00'))}:00',
      '${escapeSql(staffCategoryList)}',
      '${escapeSql(String(payload.staff_id || ''))}',
      NOW(), '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}', 1
    )
  `);
  await logStaffAttSetup(PAGE_ADD, 'Add', 'Successful', staffCategoryList, memberId, audit);
  return { success: true, message: 'Calendar event added.', ...(await loadCalendarAddSetup(memberId, {}, { ...audit, skipLog: true })) };
}

export async function loadCalendarEditSetup(memberId, fields = {}, audit = {}) {
  const eid = parseOptionalId(fields.eid || fields.id);
  let record = null;
  if (eid) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id,
              IF(from_academic_date='0000-00-00','',CAST(from_academic_date AS CHAR)) AS from_date,
              IF(to_academic_date='0000-00-00','',CAST(to_academic_date AS CHAR)) AS to_date,
              authority, academic_events, comments, p_time,
              CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time,
              staff_category, staff_id
       FROM staff_calendar_tb WHERE del=1 AND id=${eid} LIMIT 1`,
    );
    if (rows[0]) {
      record = {
        ...rows[0],
        from_date: formatDateDisplay(rows[0].from_date),
        to_date: formatDateDisplay(rows[0].to_date),
        from_time: String(rows[0].from_time || '').slice(0, 5),
        to_time: String(rows[0].to_time || '').slice(0, 5),
        staff_category: rows[0].staff_category ? String(rows[0].staff_category).split(',') : [],
      };
    }
  }

  const recent = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id,
            IF(from_academic_date='0000-00-00','',CAST(from_academic_date AS CHAR)) AS from_date,
            IF(to_academic_date='0000-00-00','',CAST(to_academic_date AS CHAR)) AS to_date,
            academic_events, comments
     FROM staff_calendar_tb WHERE del=1 ORDER BY id DESC LIMIT 50`,
  );

  const [categories, authorities, events] = await Promise.all([
    loadStaffCategories(),
    loadReportAuthorities(),
    loadAcademicEvents(),
  ]);

  await logStaffAttSetup(PAGE_EDIT, 'View', 'Successful', String(eid || ''), memberId, audit);
  return { categories, authorities, events, record, recent, eid };
}

export async function saveCalendarEditSetup(payload, memberId, audit = {}) {
  const eid = parseId(payload.eid || payload.id);
  if (payload.delete && eid) {
    const { update } = auditFields(memberId, audit);
    await prisma.$executeRawUnsafe(
      `UPDATE staff_calendar_tb SET del=0, updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}' WHERE id=${eid}`,
    );
    await logStaffAttSetup(PAGE_EDIT, 'Delete', 'Successful', String(eid), memberId, audit);
    return { success: true, message: 'Record deleted.', ...(await loadCalendarEditSetup(memberId, {}, { ...audit, skipLog: true })) };
  }

  if (!eid) return { success: false, message: 'Record id is required' };
  const fromDate = toIsoDate(payload.from_date);
  const toDate = toIsoDate(payload.to_date);
  const categories = Array.isArray(payload.staff_category) ? payload.staff_category : [];
  const staffCategoryList = categories.filter((c) => c && c !== 'All').join(',');
  const { update } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(`
    UPDATE staff_calendar_tb SET
      from_academic_date='${escapeSql(fromDate)}',
      to_academic_date='${escapeSql(toDate)}',
      authority='${escapeSql(String(payload.authority || ''))}',
      academic_events='${escapeSql(String(payload.a_event || payload.academic_events || ''))}',
      comments='${escapeSql(String(payload.comments || ''))}',
      p_time='${escapeSql(String(payload.permission_time || payload.p_time || '00:30'))}',
      from_time='${escapeSql(String(payload.from_time || '09:00'))}:00',
      to_time='${escapeSql(String(payload.to_time || '17:00'))}:00',
      staff_category='${escapeSql(staffCategoryList)}',
      staff_id='${escapeSql(String(payload.staff_id || ''))}',
      updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
    WHERE id=${eid}
  `);
  await logStaffAttSetup(PAGE_EDIT, 'Update', 'Successful', String(eid), memberId, audit);
  return { success: true, message: 'Calendar event updated.', ...(await loadCalendarEditSetup(memberId, { eid }, { ...audit, skipLog: true })) };
}

export async function calendarMoreSetup(query = {}) {
  const flag = Number(query.flag || 1);
  if (flag === 3) {
    const staff = await searchStaffByCategory(query.category, query.term);
    return { staff };
  }
  if (flag === 2) {
    const eid = parseOptionalId(query.eid);
    if (!eid) return { error: 'Invalid id' };
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM staff_calendar_tb WHERE del=1 AND id=${eid} LIMIT 1`,
    );
    return { record: rows[0] || null };
  }
  const fromDate = toIsoDate(query.from_date);
  const toDate = toIsoDate(query.to_date);
  const staffId = escapeSql(String(query.staff_id || ''));
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_calendar_tb WHERE del=1 AND staff_id='${staffId}'
     AND from_academic_date<='${escapeSql(toDate)}' AND to_academic_date>='${escapeSql(fromDate)}' LIMIT 5`,
  );
  return { overlap: rows.length > 0, count: rows.length };
}

export async function loadWorkingDaySetup(memberId, fields = {}, audit = {}) {
  const month = fields.calendar_month || new Date().toISOString().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const eventTypes = await loadCalendarEventTypes();

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id,
            IF(academic_date='0000-00-00','',CAST(academic_date AS CHAR)) AS academic_date,
            academic_events, academic_category, comments
     FROM calendar_tb WHERE del=1 AND academic_date LIKE '${escapeSql(month)}%' ORDER BY academic_date ASC`,
  );
  const byDate = Object.fromEntries(rows.map((r) => [r.academic_date, r]));

  const days = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const row = byDate[iso];
    days.push({
      id: row?.id || '',
      academic_date: iso,
      academic_events: row?.academic_events || '',
      academic_category: row?.academic_category ? String(row.academic_category).split(',,,') : [],
      comments: row?.comments || '',
    });
  }

  await logStaffAttSetup('staff_academic_calendar.php', 'View', 'Successful', month, memberId, audit);
  return { calendar_month: month, eventTypes, days };
}

export async function saveWorkingDaySetup(payload, memberId, audit = {}) {
  const days = payload.days || [];
  const { create, update } = auditFields(memberId, audit);
  for (const day of days) {
    const events = day.academic_events?.trim() ? day.academic_events : '-';
    const category = Array.isArray(day.academic_category) ? day.academic_category.join(',,,') : '';
    const comments = escapeSql(String(day.comments || ''));
    const date = escapeSql(toIsoDate(day.academic_date) || day.academic_date);
    if (day.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE calendar_tb SET academic_date='${date}', academic_events='${escapeSql(events)}',
          academic_category='${escapeSql(category)}', comments='${comments}',
          updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
        WHERE id=${Number(day.id)}
      `);
    } else if (events !== '-' || category || comments) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO calendar_tb (academic_date, academic_events, academic_category, comments,
          created_dt, created_ip, created_by, del)
        VALUES ('${date}', '${escapeSql(events)}', '${escapeSql(category)}', '${comments}',
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
      `);
    }
  }
  await logStaffAttSetup('staff_academic_calendar.php', 'Update', 'Successful', payload.calendar_month || '', memberId, audit);
  return { success: true, message: 'Working day calendar saved.', ...(await loadWorkingDaySetup(memberId, { calendar_month: payload.calendar_month }, { ...audit, skipLog: true })) };
}

export async function loadAttTimeSetup(memberId, fields = {}, audit = {}) {
  const staffId = fields.staff_id || '';
  let staff = null;
  let schedules = [];
  let authRow = null;
  let payrollCategories = await prisma.$queryRawUnsafe(
    `SELECT id, payroll_type FROM basic_setup_payroll_tb WHERE del=1 ORDER BY id ASC`,
  );

  if (staffId) {
    const profile = await prisma.$queryRawUnsafe(
      `SELECT id, staff_id, staff_name, att_category FROM staff_profile_tb WHERE del=1 AND staff_id='${escapeSql(String(staffId))}' LIMIT 1`,
    );
    staff = profile[0] || null;
    if (staff) {
      schedules = await prisma.$queryRawUnsafe(
        `SELECT id, att_group,
                IF(from_date='0000-00-00','',CAST(from_date AS CHAR)) AS from_date,
                IF(to_date='0000-00-00','',CAST(to_date AS CHAR)) AS to_date,
                days, CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time
         FROM staff_att_time WHERE del=1 AND staff_id='${escapeSql(String(staff.id))}' ORDER BY from_date DESC`,
      );
      const auth = await prisma.$queryRawUnsafe(
        `SELECT id, defaulter_auth FROM staff_att_auth WHERE del=1 AND staff_id='${escapeSql(String(staff.id))}' LIMIT 1`,
      );
      authRow = auth[0] || null;
    }
  }

  await logStaffAttSetup('staff_att_time.php', 'View', 'Successful', staffId, memberId, audit);
  return { staffId, staff, schedules, authRow, payrollCategories };
}

export async function saveAttTimeSetup(payload, memberId, audit = {}) {
  const staffRowId = parseId(payload.staff_row_id || payload.sid);
  if (!staffRowId) return { success: false, message: 'Staff is required' };

  const { create, update } = auditFields(memberId, audit);

  if (payload.att_category != null) {
    await prisma.$executeRawUnsafe(
      `UPDATE staff_profile_tb SET att_category='${escapeSql(String(payload.att_category))}',
        updated_dt=NOW(), updated_by='${escapeSql(memberId)}' WHERE id=${staffRowId}`,
    );
  }

  if (payload.defaulter_auth != null) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM staff_att_auth WHERE del=1 AND staff_id='${staffRowId}' LIMIT 1`,
    );
    if (existing[0]?.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE staff_att_auth SET defaulter_auth='${escapeSql(String(payload.defaulter_auth))}',
          updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
         WHERE id=${Number(existing[0].id)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO staff_att_auth (staff_id, defaulter_auth, created_dt, created_by, created_ip, del)
         VALUES (${staffRowId}, '${escapeSql(String(payload.defaulter_auth))}', NOW(), '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}', 1)`,
      );
    }
  }

  if (payload.delete_schedule_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE staff_att_time SET del=0, updated_dt=NOW(), updated_by='${escapeSql(memberId)}' WHERE id=${Number(payload.delete_schedule_id)}`,
    );
  } else if (payload.schedule) {
    const s = payload.schedule;
    const fromDate = toIsoDate(s.from_date);
    const toDate = toIsoDate(s.to_date);
    if (s.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE staff_att_time SET att_group='${escapeSql(String(s.att_group || ''))}',
          from_date='${escapeSql(fromDate)}', to_date='${escapeSql(toDate)}',
          days='${escapeSql(String(s.days || ''))}',
          from_time='${escapeSql(String(s.from_time || '09:00'))}:00',
          to_time='${escapeSql(String(s.to_time || '17:00'))}:00',
          updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
        WHERE id=${Number(s.id)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO staff_att_time (staff_id, att_group, from_date, to_date, days, from_time, to_time,
          created_dt, created_by, created_ip, del)
        VALUES (${staffRowId}, '${escapeSql(String(s.att_group || ''))}',
          '${escapeSql(fromDate)}', '${escapeSql(toDate)}', '${escapeSql(String(s.days || ''))}',
          '${escapeSql(String(s.from_time || '09:00'))}:00', '${escapeSql(String(s.to_time || '17:00'))}:00',
          NOW(), '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}', 1)
      `);
    }
  }

  await logStaffAttSetup('staff_att_time.php', 'Update', 'Successful', String(staffRowId), memberId, audit);
  const staffId = payload.staff_id || '';
  return { success: true, message: 'Attendance time saved.', ...(await loadAttTimeSetup(memberId, { staff_id: staffId }, { ...audit, skipLog: true })) };
}

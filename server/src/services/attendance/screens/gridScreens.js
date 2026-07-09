import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import { auditFields, formatDateDisplay, logStaffAttSetup, toIsoDate } from '../setupAudit.js';
import { loadActiveStaffList, loadStaffCategories, searchStaffByCategory } from '../staffAttendanceShared.js';

export async function loadHolidayRosterScreen(memberId, fields = {}, audit = {}) {
  const configs = await prisma.$queryRawUnsafe(
    `SELECT id,
            IF(from_date='0000-00-00','',CAST(from_date AS CHAR)) AS from_date,
            IF(to_date='0000-00-00','',CAST(to_date AS CHAR)) AS to_date
     FROM staff_hroster_config WHERE del=1 ORDER BY from_date DESC LIMIT 50`,
  );

  const refId = parseOptionalId(fields.academic_date || fields.ref_id) || configs[0]?.id;
  let groups = [];
  if (refId) {
    groups = await prisma.$queryRawUnsafe(
      `SELECT id, att_group, category, staff_id, days,
              CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time,
              off_cal, total_working
       FROM staff_hroster WHERE del=1 AND ref_id=${refId} ORDER BY att_group ASC`,
    );
  }

  await logStaffAttSetup('staff_holiday_roster.php', 'View', 'Successful', String(refId || ''), memberId, audit);
  return {
    configs: configs.map((c) => ({
      id: Number(c.id),
      from_date: formatDateDisplay(c.from_date),
      to_date: formatDateDisplay(c.to_date),
      label: `${formatDateDisplay(c.from_date)} — ${formatDateDisplay(c.to_date)}`,
    })),
    ref_id: refId,
    groups,
    categories: await loadStaffCategories(),
    h_from_date: fields.h_from_date || '',
    h_to_date: fields.h_to_date || '',
  };
}

export async function saveHolidayRosterScreen(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.delete_group_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE staff_hroster SET del=0, updated_dt=NOW(), updated_by='${escapeSql(memberId)}' WHERE id=${Number(payload.delete_group_id)}`,
    );
  } else if (payload.config) {
    const c = payload.config;
    const fromDate = toIsoDate(c.from_date || c.h_from_date);
    const toDate = toIsoDate(c.to_date || c.h_to_date);
    let refId = parseId(c.id);
    if (refId) {
      await prisma.$executeRawUnsafe(`
        UPDATE staff_hroster_config SET from_date='${escapeSql(fromDate)}', to_date='${escapeSql(toDate)}',
          updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
        WHERE id=${refId}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO staff_hroster_config (from_date, to_date, created_dt, created_by, created_ip, del)
        VALUES ('${escapeSql(fromDate)}', '${escapeSql(toDate)}', NOW(), '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}', 1)
      `);
      const inserted = await prisma.$queryRawUnsafe(`SELECT LAST_INSERT_ID() AS id`);
      refId = Number(inserted[0]?.id);
    }

    if (payload.group && refId) {
      const g = payload.group;
      if (g.id) {
        await prisma.$executeRawUnsafe(`
          UPDATE staff_hroster SET att_group='${escapeSql(String(g.att_group || ''))}',
            category='${escapeSql(String(g.category || ''))}', staff_id='${escapeSql(String(g.staff_id || ''))}',
            days='${escapeSql(String(g.days || ''))}',
            from_time='${escapeSql(String(g.from_time || '09:00'))}:00',
            to_time='${escapeSql(String(g.to_time || '17:00'))}:00',
            off_cal=${Number(g.off_cal || 0)}, total_working=${Number(g.total_working || 0)},
            updated_dt=NOW(), updated_by='${escapeSql(memberId)}'
          WHERE id=${Number(g.id)}
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO staff_hroster (ref_id, att_group, category, staff_id, days, from_time, to_time, off_cal, total_working,
            created_dt, created_by, created_ip, del)
          VALUES (${refId}, '${escapeSql(String(g.att_group || ''))}', '${escapeSql(String(g.category || ''))}',
            '${escapeSql(String(g.staff_id || ''))}', '${escapeSql(String(g.days || ''))}',
            '${escapeSql(String(g.from_time || '09:00'))}:00', '${escapeSql(String(g.to_time || '17:00'))}:00',
            ${Number(g.off_cal || 0)}, ${Number(g.total_working || 0)},
            NOW(), '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}', 1)
        `);
      }
    }
  }

  await logStaffAttSetup('staff_holiday_roster.php', 'Update', 'Successful', String(payload.ref_id || ''), memberId, audit);
  return { success: true, message: 'Holiday roster saved.', ...(await loadHolidayRosterScreen(memberId, { academic_date: payload.ref_id }, { ...audit, skipLog: true })) };
}

export async function holidayRosterMore(query = {}) {
  const categoryId = query.category || query.job_category;
  const staff = await searchStaffByCategory(categoryId, query.term);
  return { staff };
}

export async function loadCompensationScreen(memberId, fields = {}, audit = {}) {
  const staffId = fields.staff_id || '';
  let rows = [];
  let staff = null;
  if (staffId) {
    staff = (await prisma.$queryRawUnsafe(
      `SELECT id, staff_id, staff_name FROM staff_profile_tb WHERE del=1 AND staff_id='${escapeSql(String(staffId))}' LIMIT 1`,
    ))[0];
    if (staff) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id,
                IF(comp_date='0000-00-00','',CAST(comp_date AS CHAR)) AS comp_date,
                IF(att_date='0000-00-00','',CAST(att_date AS CHAR)) AS att_date,
                CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time
         FROM staff_att_comp WHERE del=1 AND staff_id='${escapeSql(String(staff.id))}' ORDER BY comp_date DESC`,
      );
    }
  }

  await logStaffAttSetup('staff_compensation.php', 'View', 'Successful', staffId, memberId, audit);
  return { staff_id: staffId, staff, rows };
}

export async function saveCompensationScreen(payload, memberId, audit = {}) {
  const staffRowId = parseId(payload.staff_row_id || payload.sid);
  if (!staffRowId) return { success: false, message: 'Staff is required' };
  const { create, update } = auditFields(memberId, audit);

  if (payload.delete_id) {
    await prisma.$executeRawUnsafe(
      `UPDATE staff_att_comp SET del=0, updated_dt=NOW(), updated_by='${escapeSql(memberId)}' WHERE id=${Number(payload.delete_id)}`,
    );
  } else if (payload.row) {
    const r = payload.row;
    const compDate = toIsoDate(r.comp_date);
    const attDate = toIsoDate(r.att_date);
    if (r.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE staff_att_comp SET comp_date='${escapeSql(compDate)}', att_date='${escapeSql(attDate)}',
          from_time='${escapeSql(String(r.from_time || '09:00'))}:00', to_time='${escapeSql(String(r.to_time || '17:00'))}:00',
          updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
        WHERE id=${Number(r.id)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO staff_att_comp (staff_id, comp_date, att_date, from_time, to_time, created_dt, created_by, created_ip, del)
        VALUES (${staffRowId}, '${escapeSql(compDate)}', '${escapeSql(attDate)}',
          '${escapeSql(String(r.from_time || '09:00'))}:00', '${escapeSql(String(r.to_time || '17:00'))}:00',
          NOW(), '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}', 1)
      `);
    }
  }

  await logStaffAttSetup('staff_compensation.php', 'Update', 'Successful', String(staffRowId), memberId, audit);
  return { success: true, message: 'Compensation saved.', ...(await loadCompensationScreen(memberId, { staff_id: payload.staff_id }, { ...audit, skipLog: true })) };
}

export async function compensationMore(query = {}) {
  const flag = Number(query.flag || 1);
  if (flag <= 2) {
    const staff = await searchStaffByCategory(query.category, query.term, 30);
    return { staff };
  }
  const staffId = query.staff_id;
  if (!staffId) return { rows: [] };
  const profile = (await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_profile_tb WHERE del=1 AND staff_id='${escapeSql(String(staffId))}' LIMIT 1`,
  ))[0];
  if (!profile) return { rows: [] };
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, IF(comp_date='0000-00-00','',CAST(comp_date AS CHAR)) AS comp_date,
            IF(att_date='0000-00-00','',CAST(att_date AS CHAR)) AS att_date,
            CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time
     FROM staff_att_comp WHERE del=1 AND staff_id='${escapeSql(String(profile.id))}' ORDER BY comp_date DESC`,
  );
  return { rows };
}

export async function loadClElScreen(memberId, fields = {}, audit = {}) {
  const page = Number(fields.page || 1);
  const { rows, total, limit } = await loadActiveStaffList({ page, limit: 50 });

  const enriched = [];
  for (const s of rows) {
    const clRows = await prisma.$queryRawUnsafe(
      `SELECT id, comp_cl, comp_el, comp_od FROM staff_att_cl WHERE del=1 AND staff_id='${escapeSql(String(s.id))}' LIMIT 1`,
    );
    enriched.push({
      sid: Number(s.id),
      staff_id: s.staff_id,
      staff_name: s.staff_name,
      rid: clRows[0]?.id || '',
      comp_cl: clRows[0]?.comp_cl ?? '',
      comp_el: clRows[0]?.comp_el ?? '',
      comp_od: clRows[0]?.comp_od ?? '',
    });
  }

  await logStaffAttSetup('staff_cl_el.php', 'View', 'Successful', String(page), memberId, audit);
  return { page, total, limit, rows: enriched };
}

export async function saveClElScreen(payload, memberId, audit = {}) {
  const items = payload.items || [];
  const { create, update } = auditFields(memberId, audit);
  for (const item of items) {
    const sid = parseId(item.s_id || item.sid);
    if (!sid) continue;
    const rid = parseId(item.r_id || item.rid);
    const cl = escapeSql(String(item.comp_cl ?? ''));
    const el = escapeSql(String(item.comp_el ?? ''));
    const od = escapeSql(String(item.comp_od ?? ''));
    if (rid) {
      await prisma.$executeRawUnsafe(`
        UPDATE staff_att_cl SET comp_cl='${cl}', comp_el='${el}', comp_od='${od}',
          updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
        WHERE id=${rid}
      `);
    } else if (cl || el || od) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO staff_att_cl (staff_id, comp_cl, comp_el, comp_od, created_dt, created_by, created_ip, del)
        VALUES (${sid}, '${cl}', '${el}', '${od}', NOW(), '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}', 1)
      `);
    }
  }
  await logStaffAttSetup('staff_cl_el.php', 'Update', 'Successful', String(items.length), memberId, audit);
  return { success: true, message: 'CL/EL balances updated.', ...(await loadClElScreen(memberId, { page: payload.page }, { ...audit, skipLog: true })) };
}

export async function loadAttTransportScreen(memberId, fields = {}, audit = {}) {
  const attendanceDate = toIsoDate(fields.attendance_date) || new Date().toISOString().slice(0, 10);
  const transports = await prisma.$queryRawUnsafe(
    `SELECT id, transport_number, transport_route FROM transport_tb WHERE del=1 ORDER BY transport_number ASC`,
  );
  const transportNumber = fields.transport_number || transports[0]?.transport_number || '';

  const rows = transportNumber ? await prisma.$queryRawUnsafe(
    `SELECT id, transport_number,
            CAST(arrival_time AS CHAR) AS arrival_time, CAST(departure_time AS CHAR) AS departure_time,
            arrival_driver, arrival_staff, departure_driver, departure_staff
     FROM staff_att_transport_tb WHERE del=1 AND attendance_date='${escapeSql(attendanceDate)}'
       AND transport_number='${escapeSql(String(transportNumber))}'`,
  ) : [];

  await logStaffAttSetup('staff_att_transport.php', 'View', 'Successful', attendanceDate, memberId, audit);
  return {
    attendance_date: formatDateDisplay(attendanceDate),
    transport_number: transportNumber,
    transports,
    row: rows[0] || null,
  };
}

export async function saveAttTransportScreen(payload, memberId, audit = {}) {
  const attendanceDate = toIsoDate(payload.attendance_date);
  const transportNumber = String(payload.transport_number || '');
  if (!attendanceDate || !transportNumber) return { success: false, message: 'Date and transport required' };

  const { create, update } = auditFields(memberId, audit);
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_att_transport_tb WHERE del=1 AND attendance_date='${escapeSql(attendanceDate)}'
     AND transport_number='${escapeSql(transportNumber)}' LIMIT 1`,
  );

  const fields = {
    arrival: escapeSql(String(payload.arrival_time || '')),
    departure: escapeSql(String(payload.departure_time || '')),
    arrivalDriver: escapeSql(String(payload.arrival_driver || '')),
    arrivalStaff: escapeSql(String(payload.arrival_staff || '')),
    departureDriver: escapeSql(String(payload.departure_driver || '')),
    departureStaff: escapeSql(String(payload.departure_staff || '')),
  };

  if (existing[0]?.id) {
    await prisma.$executeRawUnsafe(`
      UPDATE staff_att_transport_tb SET arrival_time='${fields.arrival}', departure_time='${fields.departure}',
        arrival_driver='${fields.arrivalDriver}', arrival_staff='${fields.arrivalStaff}',
        departure_driver='${fields.departureDriver}', departure_staff='${fields.departureStaff}',
        updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}'
      WHERE id=${Number(existing[0].id)}
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO staff_att_transport_tb (attendance_date, transport_number, arrival_time, departure_time,
        arrival_driver, arrival_staff, departure_driver, departure_staff, created_dt, created_by, created_ip, del)
      VALUES ('${escapeSql(attendanceDate)}', '${escapeSql(transportNumber)}',
        '${fields.arrival}', '${fields.departure}', '${fields.arrivalDriver}', '${fields.arrivalStaff}',
        '${fields.departureDriver}', '${fields.departureStaff}',
        NOW(), '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}', 1)
    `);
  }

  await logStaffAttSetup('staff_att_transport.php', 'Update', 'Successful', transportNumber, memberId, audit);
  return { success: true, message: 'Transport attendance saved.', ...(await loadAttTransportScreen(memberId, payload, { ...audit, skipLog: true })) };
}

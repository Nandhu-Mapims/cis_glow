import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import { listActiveStaff, searchStaff } from '../staffShared.js';

const PAGE = 'staff_transport_setup.php';

function toDateInput(val) {
  if (!val || String(val).startsWith('0000-00-00')) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function mapTrip(row) {
  return {
    id: Number(row.id),
    busNo: row.bus_no || '',
    tripNo: Number(row.trip_no) || 0,
    stopName: row.stoping_name || '',
    journeyUp: Number(row.journey_up) === 1,
    journeyDown: Number(row.journey_down) === 1,
    enabled: Number(row.enable_disable) === 1,
    discontinued: Number(row.journey_discontinue) === 1,
    discDate: toDateInput(row.disc_date),
  };
}

function emptyTrip() {
  return {
    busNo: '',
    tripNo: '',
    stopName: '',
    journeyUp: false,
    journeyDown: false,
    enabled: true,
    discontinued: false,
    discDate: '',
  };
}

async function loadTripsForStaff(staffRowId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, bus_no, trip_no, stoping_name, journey_up, journey_down,
            enable_disable, journey_discontinue,
            CASE
              WHEN disc_date IS NULL OR disc_date = '0000-00-00' THEN ''
              ELSE DATE_FORMAT(disc_date, '%Y-%m-%d')
            END AS disc_date_text
     FROM staff_transport_setup_tb
     WHERE del = 1 AND staff_id = '${String(staffRowId)}'
     ORDER BY id ASC`,
  );
  return rows.map((row) => mapTrip({ ...row, disc_date: row.disc_date_text }));
}

async function loadTransportMeta() {
  const [transports, stops] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT transport_number, transport_route, stoping_details, trip_count
       FROM transport_tb WHERE del = 1 ORDER BY transport_number ASC`,
    ),
    prisma.$queryRawUnsafe(
      'SELECT id, stopping_name FROM transport_stopping_tb WHERE del = 1 ORDER BY stopping_order ASC, stopping_name ASC',
    ),
  ]);
  return {
    transports: transports.map((t) => ({
      number: t.transport_number,
      route: t.transport_route,
      tripCount: Number(t.trip_count) || 0,
      stopIds: String(t.stoping_details || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })),
    stops: stops.map((s) => ({ id: Number(s.id), name: s.stopping_name })),
  };
}

export async function loadTransportSetupSetup(memberId, fields = {}, audit = {}) {
  const staffId = fields.staffId ? parseId(fields.staffId) : null;
  let staff = null;
  let trips = [];
  if (staffId) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, staff_id, staff_name, staff_initial, staff_title
       FROM staff_profile_tb WHERE del = 1 AND id = ${staffId} LIMIT 1`,
    );
    if (rows.length) {
      staff = rows[0];
      trips = await loadTripsForStaff(staffId);
    }
  }

  const { transports, stops } = await loadTransportMeta();
  const searchResults = fields.q
    ? await searchStaff({ by: fields.by || 'name', q: fields.q })
    : await listActiveStaff(50);

  await logStaffModule(PAGE, 'View', 'Successful', String(staffId || ''), memberId, audit);
  return {
    staff: staff
      ? {
          id: Number(staff.id),
          staffId: staff.staff_id,
          name: `${staff.staff_title ? `${staff.staff_title}. ` : ''}${staff.staff_name} ${staff.staff_initial}`.trim(),
        }
      : null,
    trips: trips.length ? trips : [emptyTrip()],
    transports,
    stops,
    searchResults,
  };
}

export async function saveTransportSetupSetup(payload, memberId, audit = {}) {
  const staffRowId = parseId(payload.staffId);
  if (!staffRowId) return { success: false, message: 'Staff is required' };
  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_profile_tb WHERE del = 1 AND id = ${staffRowId} LIMIT 1`,
  );
  if (!staffRows.length) return { success: false, message: 'Staff not found' };
  const staffKey = String(staffRowId);
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    await prisma.$executeRawUnsafe(
      `UPDATE staff_transport_setup_tb SET del = 0,
        updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}', updated_by = '${escapeSql(update.updated_by)}'
       WHERE staff_id = '${staffKey}' AND del = 1`,
    );
    await logStaffModule(PAGE, 'Delete', 'Successful', staffKey, memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadTransportSetupSetup(memberId, { staffId: staffRowId }, { ...audit, skipLog: true })),
    };
  }

  const rows = Array.isArray(payload.trips) ? payload.trips : [];
  for (const row of rows) {
    const busNo = String(row.busNo || '').trim();
    const stopName = String(row.stopName || '').trim();
    if (!busNo || !stopName) {
      if (row.id) {
        await prisma.$executeRawUnsafe(
          `UPDATE staff_transport_setup_tb SET del = 0,
            updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}', updated_by = '${escapeSql(update.updated_by)}'
           WHERE id = ${Number(row.id)}`,
        );
      }
      continue;
    }

    const discDate = row.discontinued && row.discDate ? row.discDate : '0000-00-00';
    const data = {
      staff_id: staffKey,
      bus_no: busNo,
      trip_no: Number(row.tripNo) || 0,
      stoping_name: stopName,
      journey_up: row.journeyUp ? 1 : 0,
      journey_down: row.journeyDown ? 1 : 0,
      enable_disable: row.enabled ? 1 : 0,
      journey_discontinue: row.discontinued ? 1 : 0,
      disc_date: discDate,
      join_reason: '',
      from_month: '1970-01-01',
      to_month: '1970-01-01',
      discontinue_reason: '',
      del: 1,
      ...update,
    };

    if (row.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE staff_transport_setup_tb SET
          staff_id = '${escapeSql(data.staff_id)}',
          bus_no = '${escapeSql(data.bus_no)}',
          trip_no = ${data.trip_no},
          stoping_name = '${escapeSql(data.stoping_name)}',
          journey_up = ${data.journey_up},
          journey_down = ${data.journey_down},
          enable_disable = ${data.enable_disable},
          journey_discontinue = ${data.journey_discontinue},
          disc_date = '${discDate}',
          updated_dt = NOW(),
          updated_ip = '${escapeSql(data.updated_ip)}',
          updated_by = '${escapeSql(data.updated_by)}',
          del = 1
         WHERE id = ${Number(row.id)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO staff_transport_setup_tb (
          staff_id, enable_disable, join_reason, bus_no, trip_no, stoping_name,
          journey_up, journey_down, from_month, to_month, journey_discontinue, disc_date,
          discontinue_reason, created_dt, created_ip, created_by, del
        ) VALUES (
          '${escapeSql(data.staff_id)}',
          ${data.enable_disable},
          '',
          '${escapeSql(data.bus_no)}',
          ${data.trip_no},
          '${escapeSql(data.stoping_name)}',
          ${data.journey_up},
          ${data.journey_down},
          '${data.from_month}',
          '${data.to_month}',
          ${data.journey_discontinue},
          '${discDate}',
          '',
          NOW(),
          '${escapeSql(create.created_ip)}',
          '${escapeSql(create.created_by)}',
          1
        )`,
      );
    }
  }

  await logStaffModule(PAGE, 'Update', 'Successful', staffKey, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadTransportSetupSetup(memberId, { staffId: staffRowId }, { ...audit, skipLog: true })),
  };
}

export async function transportSetupMore(query = {}) {
  const q = String(query.q || '').trim();
  if (!q) return listActiveStaff(50);
  return searchStaff({
    by: query.by || 'name',
    q,
    staffId: query.staffId,
  });
}

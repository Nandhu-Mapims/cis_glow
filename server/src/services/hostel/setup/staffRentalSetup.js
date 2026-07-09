import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import {
  loadHostelBlockGroups,
  loadHostelRoomsForBlock,
  loadHostelRooms,
} from '../hostelShared.js';
import { auditFields, logHostelSetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'staff_rental_hostel.php';

function fmtDateExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d')) AS ${a}`;
}

async function loadStaffCategories() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT B.id, B.category_name
    FROM staff_profile_tb AS A
    INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
    WHERE A.del = 1 AND B.category = 'Category'
    ORDER BY B.category_name ASC
  `);
  return rows.map((row) => ({ id: Number(row.id), name: row.category_name || '' }));
}

async function searchStaffList({ searchBy, searchInput }) {
  const relDt = new Date();
  relDt.setDate(relDt.getDate() - 50);
  const relDate = relDt.toISOString().slice(0, 10);
  let extra = '';

  if (searchBy === 'staff_id' && searchInput) {
    const ids = String(searchInput).split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return [];
    extra = `AND (${ids.map((id) => `staff_id = '${escapeSql(id)}'`).join(' OR ')})`;
  } else if (searchBy === 'category' && searchInput) {
    extra = `AND job_category = '${escapeSql(String(searchInput))}'`;
  } else if (searchBy === 'name' && searchInput) {
    extra = `AND staff_name LIKE '%${escapeSql(String(searchInput))}%'`;
  }

  const limit = extra ? 200 : 50;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, staff_id, staff_name, staff_initial, staff_title
    FROM staff_profile_tb
    WHERE del = 1
      AND (releaving_date = '0000-00-00' OR releaving_date > DATE(NOW()) OR releaving_date > '${relDate}')
      ${extra}
    ORDER BY staff_name ASC, staff_initial ASC
    LIMIT ${limit}
  `);

  const withHostel = await Promise.all(rows.map(async (row) => {
    const cnt = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS cnt FROM staff_hostel_tb WHERE del = 1 AND s_id = '${escapeSql(String(row.id))}'
    `);
    return {
      id: Number(row.id),
      staffId: row.staff_id || '',
      name: `${row.staff_title ? `${row.staff_title}. ` : ''}${row.staff_name || ''} ${row.staff_initial || ''}`.trim(),
      hasHostel: Number(cnt[0]?.cnt || 0) > 0,
    };
  }));
  return withHostel;
}

async function loadStaffHostelStays(staffPk) {
  const sid = escapeSql(String(staffPk));
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, stay_type, block_no, room_no, join_reason, rental_fee, hostel_discontinue, discontinue_reason,
      ${fmtDateExpr('from_month', 'from_month')},
      ${fmtDateExpr('to_month', 'to_month')}
    FROM staff_hostel_tb
    WHERE del = 1 AND s_id = '${sid}'
    ORDER BY from_month ASC
  `);
  return rows.map((row) => ({
    id: Number(row.id),
    stayType: row.stay_type || 'Hostel',
    blockNo: row.block_no || '',
    roomNo: row.room_no || '',
    fromMonth: toIsoDate(row.from_month) || '',
    toMonth: toIsoDate(row.to_month) || '',
    joinReason: row.join_reason || '',
    rentalFee: Number(row.rental_fee) === 1,
    hostelDiscontinue: Number(row.hostel_discontinue) === 1,
    discontinueReason: row.discontinue_reason || '',
  }));
}

export async function loadStaffRentalSetup(memberId, fields = {}, audit = {}) {
  const staffPk = String(fields.staffId || '').trim();
  const searchBy = String(fields.searchBy || 'name');
  const searchInput = String(fields.searchInput || '').trim();
  const [blockGroups, categories, staffList, rooms] = await Promise.all([
    loadHostelBlockGroups(),
    loadStaffCategories(),
    searchStaffList({ searchBy, searchInput: fields.searchInput !== undefined ? searchInput : '' }),
    loadHostelRooms(false),
  ]);

  let staff = null;
  let stays = [];
  if (staffPk) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, staff_id, staff_name, staff_initial, staff_title
      FROM staff_profile_tb WHERE del = 1 AND id = '${escapeSql(staffPk)}' LIMIT 1
    `);
    const row = rows[0];
    if (row) {
      staff = {
        id: Number(row.id),
        staffId: row.staff_id || '',
        name: `${row.staff_title ? `${row.staff_title}. ` : ''}${row.staff_name || ''} ${row.staff_initial || ''}`.trim(),
      };
      stays = await loadStaffHostelStays(staffPk);
    }
  }

  await logHostelSetup(PAGE, 'View', 'Successful', staffPk || searchInput, memberId, audit);
  return {
    searchBy,
    searchInput,
    staffId: staffPk,
    staff,
    stays: stays.length ? stays : [{
      stayType: 'Hostel',
      rentalFee: false,
      hostelDiscontinue: false,
    }],
    staffList,
    categories,
    blockGroups,
    rooms,
  };
}

export async function saveStaffRentalSetup(payload, memberId, audit = {}) {
  const staffPk = String(payload.staffId || '').trim();
  if (!staffPk) return { success: false, message: 'Staff is required' };

  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    await prisma.$executeRawUnsafe(`
      UPDATE staff_hostel_tb SET del = 0,
        updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${id} AND s_id = '${escapeSql(staffPk)}'
    `);
    await logHostelSetup(PAGE, 'Delete', 'Successful', `${staffPk} - ${id}`, memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadStaffRentalSetup(memberId, {
        staffId: staffPk,
        searchBy: payload.searchBy,
        searchInput: payload.searchInput,
      }, { ...audit, skipLog: true })),
    };
  }

  await prisma.$executeRawUnsafe(`
    UPDATE staff_hostel_tb SET del = 0,
      updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE s_id = '${escapeSql(staffPk)}' AND del = 1
  `);

  const stays = Array.isArray(payload.stays) ? payload.stays : [];
  for (const stay of stays) {
    if (!stay.blockNo && !stay.roomNo && !stay.id) continue;

    const fromMonth = stay.fromMonth || new Date().toISOString().slice(0, 10);
    const toMonth = stay.toMonth || fromMonth;
    const fields = {
      stay_type: escapeSql(String(stay.stayType || 'Hostel')),
      block_no: escapeSql(String(stay.blockNo || '')),
      room_no: escapeSql(String(stay.roomNo || '')),
      from_month: escapeSql(fromMonth),
      to_month: escapeSql(toMonth),
      join_reason: escapeSql(String(stay.joinReason || '')),
      rental_fee: stay.rentalFee ? 1 : 0,
      hostel_discontinue: stay.hostelDiscontinue ? 1 : 0,
      discontinue_reason: escapeSql(String(stay.discontinueReason || '')),
    };

    if (stay.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE staff_hostel_tb SET
          stay_type = '${fields.stay_type}',
          block_no = '${fields.block_no}',
          room_no = '${fields.room_no}',
          from_month = '${fields.from_month}',
          to_month = '${fields.to_month}',
          join_reason = '${fields.join_reason}',
          rental_fee = ${fields.rental_fee},
          hostel_discontinue = ${fields.hostel_discontinue},
          discontinue_reason = '${fields.discontinue_reason}',
          del = 1, updated_dt = NOW(),
          updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
        WHERE id = ${Number(stay.id)}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO staff_hostel_tb (
          s_id, stay_type, block_no, room_no, from_month, to_month,
          join_reason, hostel_discontinue, discontinue_reason, rental_fee,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
        ) VALUES (
          '${escapeSql(staffPk)}', '${fields.stay_type}', '${fields.block_no}', '${fields.room_no}',
          '${fields.from_month}', '${fields.to_month}', '${fields.join_reason}',
          ${fields.hostel_discontinue}, '${fields.discontinue_reason}', ${fields.rental_fee},
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
        )
      `);
    }
  }

  await logHostelSetup(PAGE, 'Update', 'Successful', staffPk, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadStaffRentalSetup(memberId, {
      staffId: staffPk,
      searchBy: payload.searchBy,
      searchInput: payload.searchInput,
    }, { ...audit, skipLog: true })),
  };
}

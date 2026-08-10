import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup, toIsoDate } from '../setupAudit.js';

// Legacy: library_att_entry.php (menu_enable=0). Manual back-office grid for
// a single day's library_image_att_tb In/Out rows (CISFLOW/library-module.md §16).
const PAGE = 'library_att_entry.php';

// mysql2 returns DATETIME columns as a Date object whose UTC fields hold the
// raw stored wall-clock value (it does not re-interpret the DB's timezone),
// but the Node process runs in Asia/Kolkata — so plain getHours()/getMinutes()
// silently adds +5:30 on top of the already-correct stored value. Read the
// UTC fields instead to get back exactly what was stored/typed.
function hhmm(dateValue) {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function blankRow(sn) {
  return { sn, regNo: '', inTime: '', inId: '', outTime: '', outId: '' };
}

/** mysql2 formats outgoing Date params using local getters, but
 * `.toISOString()` gives *UTC* digits — on this box (Asia/Kolkata, DB session
 * tz=SYSTEM) that silently wrote the wrong wall-clock time into created_dt/
 * updated_dt. Build the wall-clock string from local getters instead. */
function localSqlDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function localSqlDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function loadAttEntrySetup(memberId, fields = {}, audit = {}) {
  const attDate = toIsoDate(fields.attDate) || localSqlDate(new Date());

  // Explicit columns — SELECT * pulls updated_dt, which can be a zero date
  // (0000-00-00 00:00:00) that Prisma's raw DateTime decoding rejects.
  const inRows = await prisma.$queryRawUnsafe(
    `SELECT id, s_id, entry_date_time FROM library_image_att_tb WHERE del = 1 AND DATE(entry_date_time) = '${escapeSql(attDate)}'
       AND entry_in_out = 'In' AND manual_entry = 1 ORDER BY entry_date_time ASC`,
  );

  let rows;
  if (!inRows.length) {
    rows = [blankRow(1)];
  } else {
    rows = [];
    let sn = 1;
    for (const inRow of inRows) {
      const outRows = await prisma.$queryRawUnsafe(
        `SELECT id, entry_date_time FROM library_image_att_tb WHERE del = 1 AND DATE(entry_date_time) = '${escapeSql(attDate)}'
           AND entry_date_time >= '${escapeSql(String(inRow.entry_date_time))}' AND id != ${Number(inRow.id)}
           AND entry_in_out = 'Out' AND s_id = '${escapeSql(inRow.s_id)}' AND manual_entry = 1
           ORDER BY entry_date_time ASC LIMIT 1`,
      );
      const outRow = outRows[0];
      rows.push({
        sn,
        regNo: inRow.s_id || '',
        inTime: hhmm(inRow.entry_date_time),
        inId: String(inRow.id),
        outTime: outRow ? hhmm(outRow.entry_date_time) : '',
        outId: outRow ? String(outRow.id) : '',
      });
      sn += 1;
    }
  }

  await logLibrarySetup(PAGE, 'View', 'Successful', attDate, memberId, audit);
  return { attDate, rows };
}

export async function saveAttEntrySetup(payload, memberId, audit = {}) {
  const attDate = toIsoDate(payload.attDate);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!attDate) {
    return { success: false, message: 'Date is required' };
  }

  const { create, update } = auditFields(memberId, audit);

  // Legacy's pre-save cleanup UPDATE has a duplicated `AND AND` with nothing
  // between them (`WHERE del=1 AND DATE(entry_date_time)='$att_date' AND  AND
  // manual_entry='1'`) — almost certainly a broken/no-op statement in
  // production. Per CISFLOW/library-module.md §16 this must NOT be ported
  // literally; the intended logic ("soft-delete existing manual rows for this
  // date") is implemented correctly here instead.
  await prisma.$executeRawUnsafe(
    `UPDATE library_image_att_tb SET
       del = 0,
       updated_by = '${escapeSql(memberId)}',
       updated_ip = '${escapeSql(update.updated_ip)}',
       updated_dt = '${localSqlDateTime(update.updated_dt)}'
     WHERE del = 1 AND DATE(entry_date_time) = '${escapeSql(attDate)}' AND manual_entry = 1`,
  );

  const createdDt = localSqlDateTime(create.created_dt);
  let wroteAny = false;

  for (const row of rows) {
    const regNo = String(row.regNo || '').trim();
    if (!regNo) continue;

    const inTime = String(row.inTime || '').trim();
    if (inTime) {
      const entryDateTime = `${attDate} ${inTime}:00`;
      if (!row.inId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO library_image_att_tb(s_id, job_category, staff_image, entry_date_time, entry_in_out, manual_entry, created_dt, created_ip, created_by, updated_by, updated_ip, updated_dt)
           VALUES ('${escapeSql(regNo)}', '', '', '${escapeSql(entryDateTime)}', 'In', 1, '${createdDt}', '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', '', '', '0000-00-00 00:00:00')`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE library_image_att_tb SET
             s_id = '${escapeSql(regNo)}',
             entry_date_time = '${escapeSql(entryDateTime)}',
             del = 1,
             updated_by = '${escapeSql(memberId)}',
             updated_ip = '${escapeSql(update.updated_ip)}',
             updated_dt = '${localSqlDateTime(update.updated_dt)}'
           WHERE id = ${Number(row.inId)}`,
        );
      }
      wroteAny = true;
    }

    const outTime = String(row.outTime || '').trim();
    if (outTime) {
      const entryDateTime = `${attDate} ${outTime}:00`;
      if (!row.outId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO library_image_att_tb(s_id, job_category, staff_image, entry_date_time, entry_in_out, manual_entry, created_dt, created_ip, created_by, updated_by, updated_ip, updated_dt)
           VALUES ('${escapeSql(regNo)}', '', '', '${escapeSql(entryDateTime)}', 'Out', 1, '${createdDt}', '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', '', '', '0000-00-00 00:00:00')`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE library_image_att_tb SET
             s_id = '${escapeSql(regNo)}',
             entry_date_time = '${escapeSql(entryDateTime)}',
             del = 1,
             updated_by = '${escapeSql(memberId)}',
             updated_ip = '${escapeSql(update.updated_ip)}',
             updated_dt = '${localSqlDateTime(update.updated_dt)}'
           WHERE id = ${Number(row.outId)}`,
        );
      }
      wroteAny = true;
    }
  }

  if (wroteAny) {
    await logLibrarySetup(PAGE, 'Update', 'Successful', attDate, memberId, audit);
  }

  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadAttEntrySetup(memberId, { attDate }, { ...audit, skipLog: true })),
  };
}

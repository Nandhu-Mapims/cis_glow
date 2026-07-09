import { existsSync } from 'fs';
import { join } from 'path';
import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields } from '../fees/setup/setupAudit.js';

export async function punchStaffLiveAttendance(payload, memberId, meta) {
  const staffId = String(payload.staffId || '').trim().toUpperCase();
  if (!staffId) return { error: 'staffId is required' };

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT * FROM staff_profile_tb WHERE del=1 AND staff_id='${escapeSql(staffId)}'
       AND (releaving_date='0000-00-00' OR releaving_date > CURDATE()) ORDER BY created_dt DESC LIMIT 1`,
  );
  if (!staffRows.length) {
    return { error: `Invalid ID: ${staffId}` };
  }

  const row = staffRows[0];
  const staffIdRef = row.staff_id;
  const staffName = `${row.staff_name || ''} ${row.staff_initial || ''}`.trim();
  const jobCategory = row.job_category;
  const legacyRoot = process.env.LEGACY_CIS_PATH || '/home/mapims/cis/cis';
  let photoUrl = join(legacyRoot, 'files/staff_idcard', `${staffIdRef}.png`);
  if (!existsSync(photoUrl)) {
    photoUrl = join(legacyRoot, 'images/empty_image.jpg');
  }

  const { create } = auditFields(memberId, meta);
  const nowStr = create.created_dt.toISOString().slice(0, 19).replace('T', ' ');
  const tDate = create.created_dt.toISOString().slice(0, 10);

  const lastRows = await prisma.$queryRawUnsafe(
    `SELECT entry_in_out FROM staff_image_att_tb WHERE del=1 AND staff_id='${escapeSql(staffIdRef)}'
       AND DATE(entry_date_time)='${escapeSql(tDate)}' ORDER BY entry_date_time DESC LIMIT 1`,
  );
  let entryInOut = 'In';
  if (lastRows.length && lastRows[0].entry_in_out && lastRows[0].entry_in_out !== 'Out') {
    entryInOut = 'Out';
  }

  const photoMsg = payload.photoMsg && payload.photoMsg !== '-' ? payload.photoMsg : photoUrl;
  await prisma.$executeRawUnsafe(
    `INSERT INTO staff_image_att_tb(staff_id, staff_image, entry_date_time, entry_in_out, created_dt, created_ip, created_by)
     VALUES ('${escapeSql(staffIdRef)}', '${escapeSql(photoMsg)}', '${escapeSql(nowStr)}', '${escapeSql(entryInOut)}',
       '${escapeSql(nowStr)}', '${escapeSql(create.created_ip)}', '${escapeSql(String(memberId))}')`,
  );

  const timestamp = create.created_dt.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return {
    success: true,
    name: `${staffName} (${staffIdRef})`,
    designation: String(jobCategory || ''),
    timestamp,
    inOut: entryInOut,
    photoUrl: photoMsg,
  };
}

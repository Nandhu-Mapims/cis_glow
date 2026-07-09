import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId, sqlDateOrNull } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';
import { uploadStaffAttachmentFile } from './staffAttachments.js';
import { getStaffProfile } from './staffProfile.js';

export async function updateStaffStatus(staffRowId, body, meta) {
  const sid = parseId(staffRowId, 'staff id');

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_profile_tb WHERE del = 1 AND id = ${sid} LIMIT 1`,
  );
  if (!existing.length) return { error: 'Staff not found' };

  let releavingAttachment = body.releavingAttachment;
  if (body.releavingAttachmentUpload?.dataBase64) {
    const uploaded = await uploadStaffAttachmentFile(
      body.releavingAttachmentUpload.filename || 'resignation.pdf',
      body.releavingAttachmentUpload.dataBase64,
    );
    if (uploaded.error) return { error: uploaded.error };
    releavingAttachment = uploaded.filename;
  }

  const sets = [];
  if (body.releavingDate !== undefined) {
    sets.push(`releaving_date='${sqlDateOrNull(body.releavingDate)}'`);
  }
  if (body.releavingInfo !== undefined) {
    sets.push(`releaving_info='${escapeSql(body.releavingInfo)}'`);
  }
  if (releavingAttachment !== undefined) {
    sets.push(`releaving_attachment='${escapeSql(releavingAttachment)}'`);
  }

  if (!sets.length) {
    return { error: 'No status fields to update' };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE staff_profile_tb SET ${sets.join(', ')},
      updated_dt=NOW(),
      updated_ip='${escapeSql(meta.ip || '')}',
      updated_by='${escapeSql(meta.username || '')}'
     WHERE id=${sid}`,
  );

  await insertLog(
    ['staff_profile_edit', 'Status', 'Successful', `id=${sid}`, new Date(), meta.ip, '', meta.username],
    '',
  );

  return { success: true, profile: await getStaffProfile(sid) };
}

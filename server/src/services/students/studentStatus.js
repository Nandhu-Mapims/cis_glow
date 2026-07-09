import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId, sqlDateOrNull } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';
import { getStudentProfile } from './studentProfile.js';

/**
 * Update releaving / discontinue status (legacy student_profile_edit fields).
 */
export async function updateStudentStatus(studentId, body, meta) {
  const sid = parseId(studentId, 'student id');

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM student_profile_tb WHERE del = 1 AND id = ${sid} LIMIT 1`,
  );
  if (!existing.length) return { error: 'Student not found' };

  const releavingDate = body.releavingDate !== undefined
    ? sqlDateOrNull(body.releavingDate)
    : null;
  const releavingInfo = body.releavingInfo !== undefined
    ? escapeSql(body.releavingInfo)
    : null;
  const releavingYear = body.releavingYear !== undefined
    ? Number(body.releavingYear) || 0
    : null;

  const sets = [];
  if (body.releavingDate !== undefined) {
    sets.push(`releaving_date='${releavingDate}'`);
  }
  if (body.releavingInfo !== undefined) {
    sets.push(`releaving_info='${releavingInfo}'`);
  }
  if (body.releavingYear !== undefined) {
    sets.push(`releaving_year=${releavingYear}`);
  }

  if (!sets.length) {
    return { error: 'No status fields to update' };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE student_profile_tb SET ${sets.join(', ')},
      updated_dt=NOW(),
      updated_ip='${escapeSql(meta.ip || '')}',
      updated_by='${escapeSql(meta.username || '')}'
    WHERE id=${sid}`,
  );

  await insertLog(
    ['student_profile_edit', 'Status', 'Successful', `id=${sid}`, new Date(), meta.ip, '', meta.username],
    '',
  );

  return { success: true, profile: await getStudentProfile(sid) };
}

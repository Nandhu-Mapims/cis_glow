import { prisma } from '../../config/prisma.js';

/**
 * Dept-scoped access from dept_authentication (legacy dashboard_more.php helpers).
 */
export async function getDeptAuthentication(userId) {
  const row = await prisma.dept_authentication.findFirst({
    where: { user_id: String(userId), del: 1 },
  });
  return row || null;
}

export function buildStaffIdFilter(staffIds, prefix = 'A.') {
  if (!staffIds?.length) return '';
  const clauses = staffIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => ` ${prefix}id="${id}"`);
  if (!clauses.length) return '';
  return ` AND (${clauses.join(' OR')}) `;
}

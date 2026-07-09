import { getDeptAuthentication } from './deptAuth.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { prisma } from '../../config/prisma.js';

async function resolveUserId(memberId) {
  const user = await prisma.web_account_setup.findFirst({
    where: { member_id: memberId, del: 1 },
    select: { id: true },
  });
  return user?.id ?? null;
}

function buildOrFilter(prefix, fieldName, ids) {
  if (!ids?.length) return '';
  const clauses = ids
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => ` ${prefix}${fieldName}="${escapeSql(id)}"`);
  if (!clauses.length) return '';
  return ` AND (${clauses.join(' OR')}) `;
}

function buildStudFilter(prefix, fieldName, ids) {
  if (!ids?.length) return '';
  const clauses = [];
  ids.forEach((raw) => {
    const id = raw.trim();
    if (!id) return;
    const e = escapeSql(id);
    clauses.push(
      ` ${prefix}${fieldName}="${e}"`,
      ` ${prefix}${fieldName} LIKE "${e},%"`,
      ` ${prefix}${fieldName} LIKE "%,${e}"`,
      ` ${prefix}${fieldName} LIKE "%,${e},%"`,
    );
  });
  if (!clauses.length) return '';
  return ` AND (${clauses.join(' OR')}) `;
}

/**
 * Legacy dashboard_more.php staffAuthentication($preTxt)
 */
export async function staffAuthentication(memberId, prefix = 'A.') {
  const userId = await resolveUserId(memberId);
  if (!userId) return '';
  const dept = await getDeptAuthentication(userId);
  if (!dept?.dept_staff) return '';
  const ids = String(dept.dept_staff).split(',');
  return buildOrFilter(prefix, 'id', ids);
}

/**
 * Legacy internAuthentication($preTxt)
 */
export async function internAuthentication(memberId, prefix) {
  if (!prefix) return '';
  const userId = await resolveUserId(memberId);
  if (!userId) return '';
  const dept = await getDeptAuthentication(userId);
  if (!dept?.dept_intern) return '';
  const ids = String(dept.dept_intern).split(',');
  return buildEqualsFilter(prefix, ids);
}

function buildEqualsFilter(prefix, ids) {
  if (!prefix || !ids?.length) return '';
  const clauses = ids
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => ` ${prefix}="${escapeSql(id)}"`);
  if (!clauses.length) return '';
  return ` AND (${clauses.join(' OR')}) `;
}

/**
 * Legacy pgAuthentication — returns [csv, list]
 */
export async function pgAuthentication(memberId) {
  const userId = await resolveUserId(memberId);
  if (!userId) return ['', []];
  const dept = await getDeptAuthentication(userId);
  const csv = dept?.dept_pg ? String(dept.dept_pg) : '';
  return [csv, csv ? csv.split(',').map((s) => s.trim()).filter(Boolean) : []];
}

/**
 * Legacy studAuthentication($preTxt)
 */
export async function studAuthentication(memberId, prefix) {
  if (!prefix) return '';
  const userId = await resolveUserId(memberId);
  if (!userId) return '';
  const dept = await getDeptAuthentication(userId);
  if (!dept?.dept_student) return '';
  const ids = String(dept.dept_student).split(',');
  return buildStudFilter('', prefix, ids);
}

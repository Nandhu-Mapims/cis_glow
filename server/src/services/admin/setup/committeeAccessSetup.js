import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE = 'committee_access.php';

function splitCsv(value) {
  if (!value) return [];
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function normalizeMultiField(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') return Object.values(value).map(String);
  if (value) return [String(value)];
  return [];
}

async function loadUserOptions(selectedId = '') {
  const configured = await prisma.dept_authentication.findMany({
    where: { del: 1 },
    select: { user_id: true },
  });
  const configuredSet = new Set(configured.map((r) => String(r.user_id)));

  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, member_id: { not: 'iGrapix1' } },
    orderBy: { member_id: 'asc' },
    select: { id: true, member_id: true, member_name: true },
  });

  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.member_id} (${row.member_name})${configuredSet.has(String(row.id)) ? '*' : ''}`,
    selected: String(row.id) === String(selectedId),
  }));
}

async function loadCommitteeOptions(selectedIds = []) {
  const selected = new Set(selectedIds.map(String));
  const rows = await prisma.t_committee.findMany({
    where: { del: 1 },
    orderBy: { title: 'asc' },
    select: { id: true, title: true },
  });
  return rows.map((row) => ({
    value: String(row.id),
    label: row.title,
    selected: selected.has(String(row.id)),
  }));
}

export async function loadCommitteeAccess(memberId, fields = {}, query = {}, audit = {}) {
  const selectedUser = String(fields.user_name_ref || query.uid || '').trim();
  const copyFromUser = String(fields.copy_from_user || '').trim();
  const isCopying = Boolean(copyFromUser && copyFromUser !== selectedUser);

  const users = await loadUserOptions(selectedUser);
  let recordId = null;
  let committeeOptions = await loadCommitteeOptions([]);

  if (selectedUser) {
    // recordId always comes from the TARGET's own row -- Save uses it to
    // decide update-vs-create and must always act on the target, never a
    // copy source.
    const targetAuth = await prisma.dept_authentication.findFirst({
      where: { del: 1, user_id: selectedUser },
    });
    recordId = targetAuth?.id || null;

    const sourceAuth = isCopying
      ? await prisma.dept_authentication.findFirst({ where: { del: 1, user_id: copyFromUser } })
      : targetAuth;
    if (sourceAuth) {
      committeeOptions = await loadCommitteeOptions(splitCsv(sourceAuth.event_committee));
    }
  }

  if (!audit.skipLog) {
    const description = isCopying
      ? `User id->${selectedUser} (previewing committees copied from user id->${copyFromUser})`
      : selectedUser || 'form';
    await logAdminSetup(PAGE, 'View', 'Successful', description, memberId, audit);
  }

  return {
    users,
    selectedUser,
    copiedFromUser: isCopying ? copyFromUser : null,
    recordId,
    committeeOptions,
  };
}

export async function saveCommitteeAccess(fields, memberId, audit = {}) {
  const userId = String(fields.user_name_ref || '').trim();
  if (!userId) {
    return { success: false, message: 'Select a user first.' };
  }

  const committees = normalizeMultiField(fields.event_committee).join(',');
  const { create, update } = auditFields(memberId, audit);
  const recordId = fields.r_id ? Number(fields.r_id) : null;

  try {
    if (recordId && Number.isInteger(recordId) && recordId > 0) {
      await prisma.dept_authentication.update({
        where: { id: recordId },
        data: {
          event_committee: committees,
          ...update,
        },
      });
    } else {
      await prisma.dept_authentication.create({
        data: {
          user_id: userId,
          dept_id: '0',
          dept_hod: 0,
          dept_staff: '',
          dept_student: '0',
          dept_intern: '',
          dept_pg: '',
          course_id: '',
          event_committee: committees,
          ...create,
        },
      });
    }

    await logAdminSetup(PAGE, 'Update', 'Successful', userId, memberId, audit);
    const reload = await loadCommitteeAccess(
      memberId,
      { user_name_ref: userId },
      {},
      { ...audit, skipLog: true },
    );
    return { success: true, message: 'Your details are Updated...', ...reload };
  } catch {
    await logAdminSetup(PAGE, 'Update', 'Unsuccessful', userId, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}

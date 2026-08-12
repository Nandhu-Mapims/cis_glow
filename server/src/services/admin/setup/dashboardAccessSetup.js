import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE = 'dashboard_access.php';

export const DASHBOARD_WIDGETS = {
  staff_attendance: 'Staff Attendance',
  staff_attendance_incampus: 'Staff Attendance (Incampus)',
  staff_leave_absent: 'Staff Leave/Absent',
  staff_permission: 'Staff Permission',
  ug_attendance: 'U.G Attendance (Reg.)',
  ug_attendance_add: 'U.G Attendance (Add.)',
  pg_attendance: 'P.G Attendance',
  pg_attendance_dept: 'P.G Attendance (Dept)',
  pg_leave_absent: 'P.G Leave/Absent',
  pg_permission: 'P.G Permission',
  internship_attendance: 'Internship Attendance',
  internship_attendance_batch: 'Internship Attendance (Batch)',
  internship_leave_absent: 'Internship Leave/Absent',
  internship_permission: 'Internship Permission',
  staff_details: 'Staff Details',
  staff_unit: 'Faculty Structure',
  staff_unit_1: 'Faculty - Unit I',
  staff_unit_2: 'Faculty - Unit II',
  student_details: 'Student Details (Reg.)',
  student_add_details: 'Student Details (Add.)',
  staff_current: 'Staff Current',
  student_hostel: 'Hostel',
  gents_hostel_attendance: 'Gents Hostel Attendance',
  ladies_hostel_attendance: 'Ladies Hostel Attendance',
  student_scholarship: 'Scholarship',
  feedback_analyasis: 'Feedback Analysis',
  student_ghostel: 'Gents Hostel Att.',
  student_lhostel: 'Ladies Hostel Att.',
};

async function loadUserOptions(actorMemberId, selectedId = '') {
  const actor = await prisma.web_account_setup.findFirst({
    where: { member_id: actorMemberId, del: 1 },
    select: { access_type: true },
  });
  const isGlobal = actor?.access_type?.toLowerCase() === 'global';

  const configured = await prisma.dashboard_access.findMany({
    where: { del: 1 },
    select: { user_id: true },
    distinct: ['user_id'],
  });
  const configuredSet = new Set(configured.map((r) => String(r.user_id)));

  const where = { del: 1 };
  if (!isGlobal) {
    where.access_type = { not: 'global' };
  }

  const rows = await prisma.web_account_setup.findMany({
    where,
    orderBy: { member_id: 'asc' },
    select: { id: true, member_id: true, member_name: true },
  });

  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.member_id} - ${row.member_name}${configuredSet.has(String(row.id)) ? ' *' : ''}`,
    selected: String(row.id) === String(selectedId),
  }));
}

function buildWidgetRows(userId, sourceUserId = '') {
  const isCopying = Boolean(sourceUserId && sourceUserId !== String(userId));
  // Explicit `select` (rather than fetching full rows) so Prisma never has
  // to deserialize this table's updated_dt/created_dt columns -- some rows
  // carry legacy zero-date ("0000-00-00...") values there that the typed
  // Client API can't parse, even though nothing here reads those columns.
  const widgetSelect = { id: true, widget_name: true, widget_order: true, status: true };
  const targetPromise = userId
    ? prisma.dashboard_access.findMany({
      where: { del: 1, user_id: String(userId) },
      orderBy: { widget_order: 'asc' },
      select: widgetSelect,
    })
    : Promise.resolve([]);
  const sourcePromise = isCopying
    ? prisma.dashboard_access.findMany({
      where: { del: 1, user_id: String(sourceUserId) },
      orderBy: { widget_order: 'asc' },
      select: widgetSelect,
    })
    : targetPromise;

  return Promise.all([targetPromise, sourcePromise]).then(([targetRows, sourceRows]) => {
    // rowId always comes from the TARGET's own rows -- Save uses rowId to
    // decide update-vs-create and must always act on the target, never a
    // copy source.
    const rowIdByName = new Map(targetRows.map((r) => [r.widget_name, r.id]));
    const widgets = [];
    const seen = new Set();

    for (const row of sourceRows) {
      if (!DASHBOARD_WIDGETS[row.widget_name]) continue;
      seen.add(row.widget_name);
      widgets.push({
        rowId: rowIdByName.get(row.widget_name) || null,
        widgetName: row.widget_name,
        label: DASHBOARD_WIDGETS[row.widget_name],
        order: row.widget_order,
        enabled: row.status === 1,
      });
    }

    for (const [widgetName, label] of Object.entries(DASHBOARD_WIDGETS)) {
      if (seen.has(widgetName)) continue;
      widgets.push({
        rowId: rowIdByName.get(widgetName) || null,
        widgetName,
        label,
        order: '',
        enabled: false,
      });
    }

    return widgets;
  });
}

export async function loadDashboardAccess(memberId, fields = {}, query = {}, audit = {}) {
  const selectedUser = String(fields.a_id || query.uid || '').trim();
  const copyFromUser = String(fields.copy_from_user || '').trim();
  const isCopying = Boolean(copyFromUser && copyFromUser !== selectedUser);
  const users = await loadUserOptions(memberId, selectedUser);
  const widgets = selectedUser ? await buildWidgetRows(selectedUser, copyFromUser) : [];

  if (!audit.skipLog) {
    const description = isCopying
      ? `User id->${selectedUser} (previewing widgets copied from user id->${copyFromUser})`
      : selectedUser || 'form';
    await logAdminSetup(PAGE, 'View', 'Successful', description, memberId, audit);
  }
  return {
    users,
    selectedUser,
    copiedFromUser: isCopying ? copyFromUser : null,
    widgets,
  };
}

export async function saveDashboardAccess(fields, memberId, audit = {}) {
  const userId = String(fields.a_id || '').trim();
  if (!userId) {
    return { success: false, message: 'Select a user first.' };
  }

  const dashboardList = fields.dashboard_list || {};
  const boxOrder = fields.box_order || {};
  const enableDisable = fields.enable_disable || {};
  const rowIds = fields.row_id || {};

  const indices = new Set([
    ...Object.keys(dashboardList),
    ...Object.keys(boxOrder),
    ...Object.keys(enableDisable),
  ]);

  const { create, update } = auditFields(memberId, audit);
  let saved = false;

  try {
    await prisma.dashboard_access.updateMany({
      where: { user_id: userId, del: 1 },
      data: { del: 0, ...update },
    });

    for (const idx of indices) {
      const widgetName = dashboardList[idx];
      if (!widgetName || !DASHBOARD_WIDGETS[widgetName]) continue;
      const enabled = enableDisable[idx] === '1' || enableDisable[idx] === 1;
      const order = Number(boxOrder[idx]) || 0;
      const rowId = rowIds[idx] ? Number(rowIds[idx]) : null;

      if (!enabled && !rowId) continue;

      if (!rowId && enabled) {
        await prisma.dashboard_access.create({
          data: {
            user_id: userId,
            widget_name: widgetName,
            widget_order: order,
            status: 1,
            ...create,
          },
        });
        saved = true;
      } else if (rowId) {
        await prisma.dashboard_access.update({
          where: { id: rowId },
          data: {
            widget_name: widgetName,
            widget_order: order,
            status: enabled ? 1 : 0,
            del: 1,
            ...update,
          },
        });
        saved = true;
      }
    }

    await logAdminSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
    const reload = await loadDashboardAccess(memberId, { a_id: userId }, {}, { ...audit, skipLog: true });
    return {
      success: saved,
      message: saved ? 'Your details are Updated...' : 'No widgets selected',
      ...reload,
    };
  } catch {
    await logAdminSetup(PAGE, 'Update', 'Unsuccessful', '', memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}

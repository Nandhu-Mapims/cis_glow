import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const COLOUR_PAGE = 'task_colour_setup.php';
const TIMESHEET_PAGE = 'task_time_sheet_setup.php';

const COLOUR_GROUPS = [
  { key: 'status', fields: ['status_color_1', 'status_color_2', 'status_color_3'] },
  { key: 'astatus', fields: ['astatus_color_1', 'astatus_color_2', 'astatus_color_3'] },
  { key: 'ostatus', fields: ['ostatus_color_1', 'ostatus_color_2', 'ostatus_color_3', 'ostatus_color_4'] },
  { key: 'pstatus', fields: ['pstatus_color_1', 'pstatus_color_2', 'pstatus_color_3'] },
  { key: 'dstatus', fields: ['dstatus_color_1', 'dstatus_color_2', 'dstatus_color_3'] },
];

async function loadProjectSetup() {
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM t_project_setup WHERE id=1 LIMIT 1`);
  return rows[0] || {};
}

export async function loadCommitteeColour(memberId, _fields, audit = {}) {
  const row = await loadProjectSetup();
  const colours = {};
  for (const group of COLOUR_GROUPS) {
    colours[group.key] = group.fields.map((f) => row[f] || '#ffffff');
  }
  await logModulePage(COLOUR_PAGE, 'View', 'Successful', '', memberId, audit);
  return { success: true, colours, groups: COLOUR_GROUPS.map((g) => g.key) };
}

export async function saveCommitteeColour(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const sets = [];
  for (const group of COLOUR_GROUPS) {
    const values = payload[group.key] || [];
    group.fields.forEach((field, i) => {
      sets.push(`${field}='${escapeSql(String(values[i] || '#ffffff'))}'`);
    });
  }
  await prisma.$executeRawUnsafe(`
    UPDATE t_project_setup SET ${sets.join(',')},
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=1
  `);
  await logModulePage(COLOUR_PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Colours saved.', ...(await loadCommitteeColour(memberId, {}, { ...audit, skipLog: true })) };
}

export async function loadCommitteeTimesheet(memberId, _fields, audit = {}) {
  const row = await loadProjectSetup();
  await logModulePage(TIMESHEET_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    form: {
      memberLabel: row.member_name || '',
      miscellaneous: Number(row.miscellaneous) || 0,
      workingHour: Number(row.working_hour) || 0,
      workingComments: Number(row.working_comments) || 0,
      workingInout: Number(row.working_inout) || 0,
    },
  };
}

export async function saveCommitteeTimesheet(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE t_project_setup SET
      member_name='${escapeSql(payload.memberLabel || '')}',
      miscellaneous=${Number(payload.miscellaneous) || 0},
      working_hour=${Number(payload.workingHour) || 0},
      working_comments=${Number(payload.workingComments) || 0},
      working_inout=${Number(payload.workingInout) || 0},
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=1
  `);
  await logModulePage(TIMESHEET_PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Timesheet settings saved.', ...(await loadCommitteeTimesheet(memberId, {}, { ...audit, skipLog: true })) };
}

import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const CONFIGS = {
  'task-type': {
    page: 'task_type_setup.php',
    table: 't_task_type',
    where: "t_type='report'",
    typeValue: 'report',
    fields: ['title', 'format'],
    dbMap: { title: 'title', format: 't_format' },
    orderCol: 't_order',
  },
  'task-wtype': {
    page: 'task_wtype_setup.php',
    table: 't_task_type',
    where: "t_type='worktype'",
    typeValue: 'worktype',
    fields: ['title', 'shortName'],
    dbMap: { title: 'title', shortName: 's_name' },
    orderCol: 't_order',
  },
  'task-participator': {
    page: 'task_participator_setup.php',
    table: 't_participator_setup',
    where: "t_type='worktype'",
    typeValue: 'worktype',
    fields: ['title', 'shortName'],
    dbMap: { title: 'title', shortName: 's_name' },
    orderCol: 't_order',
  },
  'task-budget-expenses': {
    page: 'task_budget_expenses.php',
    table: 't_budget_expenses',
    where: '1=1',
    typeValue: '',
    fields: ['title', 'shortName'],
    dbMap: { title: 'title', shortName: 's_name' },
    orderCol: 't_order',
  },
  'task-event-org': {
    page: 'task_event_organization.php',
    table: 't_organization_setup',
    where: '1=1',
    typeValue: '',
    fields: ['title', 'shortName'],
    dbMap: { title: 'title', shortName: 's_name' },
    orderCol: 't_order',
  },
  'task-misc': {
    page: 'task_miscellaneous_setup.php',
    table: 't_project_misc',
    where: '1=1',
    fields: ['title'],
    dbMap: { title: 'title' },
    orderCol: null,
  },
  'task-doc-type': {
    page: 'task_document_type.php',
    table: 't_doc_type',
    where: '1=1',
    fields: ['title', 'order'],
    dbMap: { title: 'title', order: 't_order' },
    orderCol: 't_order',
  },
};

function mapRow(cfg, row) {
  const out = { id: Number(row.id) };
  for (const key of cfg.fields) {
    const col = cfg.dbMap[key];
    out[key] = row[col] ?? '';
  }
  if (cfg.orderCol && !cfg.fields.includes('order')) {
    out.order = row[cfg.orderCol] ?? '';
  }
  return out;
}

function selectCols(cfg) {
  const cols = ['id', ...Object.values(cfg.dbMap)];
  if (cfg.orderCol && !cols.includes(cfg.orderCol)) cols.push(cfg.orderCol);
  return [...new Set(cols)].join(', ');
}

const INSERT_AUDIT_COLS = 'updated_dt, updated_ip, updated_by, del';
const INSERT_AUDIT_VALS = `'0000-00-00 00:00:00', '', '', 1`;
const TABLES_WITH_EMPTY_TYPE = new Set(['t_budget_expenses', 't_organization_setup']);

async function insertRow(cfg, row, create, memberId) {
  const title = escapeSql(row.title || '');
  const order = Number(row.order) || 0;
  const shortName = escapeSql(row.shortName || '');
  const { table, typeValue } = cfg;
  if (table === 't_project_misc') {
    await prisma.$executeRawUnsafe(`
      INSERT INTO t_project_misc (title, c_disable, created_dt, created_ip, created_by, ${INSERT_AUDIT_COLS})
      VALUES ('${title}', 0, NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', ${INSERT_AUDIT_VALS})
    `);
    return;
  }
  if (table === 't_doc_type') {
    await prisma.$executeRawUnsafe(`
      INSERT INTO t_doc_type (title, t_order, created_dt, created_ip, created_by, ${INSERT_AUDIT_COLS})
      VALUES ('${title}', ${order}, NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', ${INSERT_AUDIT_VALS})
    `);
    return;
  }
  if (table === 't_task_type') {
    const format = escapeSql(row.format || '');
    const shortName = escapeSql(row.shortName || '');
    await prisma.$executeRawUnsafe(`
      INSERT INTO t_task_type (t_type, title, s_name, t_format, t_order, created_dt, created_ip, created_by, ${INSERT_AUDIT_COLS})
      VALUES ('${escapeSql(typeValue)}', '${title}', '${shortName}', '${format}', ${order},
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', ${INSERT_AUDIT_VALS})
    `);
    return;
  }
  if (TABLES_WITH_EMPTY_TYPE.has(table)) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO ${table} (t_type, title, s_name, t_format, t_order, created_dt, created_ip, created_by, ${INSERT_AUDIT_COLS})
      VALUES ('', '${title}', '${shortName}', '', ${order},
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', ${INSERT_AUDIT_VALS})
    `);
    return;
  }
  const typeCol = typeValue ? 't_type, ' : '';
  const typeVal = typeValue ? `'${escapeSql(typeValue)}', ` : '';
  await prisma.$executeRawUnsafe(`
    INSERT INTO ${table} (${typeCol}title, s_name, t_format, t_order, created_dt, created_ip, created_by, ${INSERT_AUDIT_COLS})
    VALUES (${typeVal}'${title}', '${shortName}', '', ${order},
      NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', ${INSERT_AUDIT_VALS})
  `);
}

async function updateRow(cfg, row, update, memberId) {
  const title = escapeSql(row.title || '');
  const order = Number(row.order) || 0;
  const { table } = cfg;
  if (table === 't_project_misc') {
    await prisma.$executeRawUnsafe(`
      UPDATE t_project_misc SET title='${title}', del=1,
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${Number(row.id)}
    `);
    return;
  }
  if (table === 't_doc_type') {
    await prisma.$executeRawUnsafe(`
      UPDATE t_doc_type SET title='${title}', t_order=${order}, del=1,
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${Number(row.id)}
    `);
    return;
  }
  if (table === 't_task_type') {
    const format = escapeSql(row.format || '');
    const shortName = escapeSql(row.shortName || '');
    await prisma.$executeRawUnsafe(`
      UPDATE t_task_type SET title='${title}', s_name='${shortName}', t_format='${format}', t_order=${order}, del=1,
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${Number(row.id)}
    `);
    return;
  }
  const shortName = escapeSql(row.shortName || '');
  await prisma.$executeRawUnsafe(`
    UPDATE ${table} SET title='${title}', s_name='${shortName}', t_order=${order}, del=1,
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=${Number(row.id)}
  `);
}

export async function loadCommitteeRowSetup(screen, memberId, _fields, audit = {}) {
  const cfg = CONFIGS[screen];
  if (!cfg) return { error: 'Unknown row setup screen' };
  const order = cfg.orderCol ? `ORDER BY ${cfg.orderCol} ASC` : 'ORDER BY id ASC';
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${selectCols(cfg)} FROM ${cfg.table} WHERE del=1 AND ${cfg.where} ${order}
  `);
  await logModulePage(cfg.page, 'View', 'Successful', '', memberId, audit);
  return { success: true, rows: rows.map((r) => mapRow(cfg, r)), fields: cfg.fields };
}

export async function saveCommitteeRowSetup(screen, payload, memberId, audit = {}) {
  const cfg = CONFIGS[screen];
  if (!cfg) return { error: 'Unknown row setup screen' };
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    await prisma.$executeRawUnsafe(`
      UPDATE ${cfg.table} SET del=0, updated_by='${escapeSql(memberId)}',
        updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW() WHERE id=${id}
    `);
    await logModulePage(cfg.page, 'Delete', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Deleted.', ...(await loadCommitteeRowSetup(screen, memberId, {}, { ...audit, skipLog: true })) };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    if (!row.title) continue;
    if (row.id) await updateRow(cfg, row, update, memberId);
    else await insertRow(cfg, row, create, memberId);
  }

  await logModulePage(cfg.page, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Saved.', ...(await loadCommitteeRowSetup(screen, memberId, {}, { ...audit, skipLog: true })) };
}

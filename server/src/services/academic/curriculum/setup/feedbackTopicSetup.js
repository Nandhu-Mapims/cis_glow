import { prisma } from '../../../../config/prisma.js';
import { escapeSql, parseId } from '../../../../utils/sqlSafe.js';
import { auditFields, logAcademicSetup } from '../../setup/setupAudit.js';

const PAGE = 'feedback_topic.php';

const CATEGORY_OPTIONS = [
  { value: 'Theory', label: 'Theory' },
  { value: 'Practical', label: 'Practical' },
  { value: 'Online', label: 'Online' },
  { value: 'PG-Clinical', label: 'PG-Clinical' },
];

function mapRow(row) {
  return {
    id: Number(row.id),
    order: Number(row.t_order) || 0,
    name: row.topic_name || '',
  };
}

function emptyRow(order = 1) {
  return { id: null, order, name: '' };
}

async function fetchRows(category) {
  if (!category) return [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, topic_name, t_order FROM feedback_topic
     WHERE category='${escapeSql(category)}' AND del != 0
     ORDER BY t_order ASC`,
  );
  return rows.map(mapRow);
}

export async function loadFeedbackTopic(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || '').trim();
  const rows = category ? await fetchRows(category) : [];

  await logAcademicSetup(PAGE, 'View', 'Successful', category, memberId, audit);
  return {
    categoryOptions: CATEGORY_OPTIONS,
    category,
    rows: rows.length ? rows : (category ? [emptyRow(1)] : []),
  };
}

export async function saveFeedbackTopic(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    const category = String(payload.category || '').trim();
    const { update } = auditFields(memberId, audit);
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE feedback_topic SET del=0, updated_by='${escapeSql(memberId)}',
         updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW() WHERE id=${id}`,
      );
      await logAcademicSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadFeedbackTopic(memberId, { category }, { ...audit, skipLog: true })),
      };
    } catch {
      await logAcademicSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const category = String(payload.category || '').trim();
  if (!category) {
    return { success: false, message: 'Category is required' };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    if (!row.id) {
      if (!name) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO feedback_topic (category, topic_name, t_order, created_dt, created_ip, created_by, del)
         VALUES ('${escapeSql(category)}', '${escapeSql(name)}', ${order}, NOW(),
         '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE feedback_topic SET category='${escapeSql(category)}', topic_name='${escapeSql(name)}',
         t_order=${order}, del=1, updated_by='${escapeSql(memberId)}',
         updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW() WHERE id=${Number(row.id)}`,
      );
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', category, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadFeedbackTopic(memberId, { category }, { ...audit, skipLog: true })),
  };
}

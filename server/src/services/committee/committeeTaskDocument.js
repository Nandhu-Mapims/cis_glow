import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { config } from '../../config/index.js';

const DOCUMENT_PAGE = 'task_document.php';
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif']);
const MAX_BYTES = 51201 * 1024;

function formatProgramDate(value) {
  if (!value || String(value).startsWith('0000-00-00')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function attachmentUrl(relativePath) {
  if (!relativePath) return '';
  return `/legacy/files/task_document/${relativePath}`;
}

async function loadClientMap() {
  const rows = await prisma.$queryRawUnsafe(`SELECT id, client_name FROM t_client_master WHERE del=1`);
  return Object.fromEntries(rows.map((r) => [Number(r.id), r.client_name || '']));
}

async function uploadTaskDocumentFile(taskId, file, memberId, audit) {
  if (!file?.data || !file?.name) return { error: 'No file provided' };
  const ext = String(file.name).split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXT.has(ext)) return { error: 'Allowed types: jpg, jpeg, png, gif' };

  const raw = file.data.includes(',') ? file.data.split(',')[1] : file.data;
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > MAX_BYTES) return { error: 'File size should be less than 50mb' };

  const now = new Date();
  const attachFolder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}01`;
  const baseTitle = String(file.name).replace(/\.[^.]+$/, '').replace(/[ ,()]/g, '_');
  let safeName = String(file.name).replace(/[ ,()]/g, '_');
  const dir = path.join(config.legacyFilesPath, 'task_document', attachFolder);
  await fs.mkdir(dir, { recursive: true });

  let target = path.join(dir, safeName);
  try {
    await fs.access(target);
    safeName = `${now.toISOString().slice(2, 10).replace(/-/g, '')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}${safeName}`;
    target = path.join(dir, safeName);
  } catch {
    // file does not exist
  }

  await fs.writeFile(target, buffer);
  const relativePath = `${attachFolder}/${safeName}`;

  const countRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS total FROM t_document WHERE del=1 AND t_id=${Number(taskId)}
  `);
  const dOrder = Number(countRows[0]?.total || 0) + 1;
  const { create, update } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(`
    INSERT INTO t_document (
      t_id, title, d_type, d_attach, d_order,
      created_dt, created_ip, created_by,
      updated_dt, updated_ip, updated_by, del
    )
    VALUES (
      ${Number(taskId)}, '${escapeSql(baseTitle)}', 0, '${escapeSql(relativePath)}', ${dOrder},
      NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
      NOW(), '${escapeSql(update.updated_ip)}', '${escapeSql(memberId)}', 1
    )
  `);

  return { relativePath, title: baseTitle, order: dOrder };
}

function mapDocument(row) {
  return {
    id: Number(row.id),
    title: row.title || '',
    typeId: row.d_type ? String(row.d_type) : '',
    typeName: row.type_name || '',
    order: Number(row.d_order) || 0,
    attachment: row.d_attach || '',
    attachmentUrl: attachmentUrl(row.d_attach),
  };
}

export async function loadCommitteeTaskDocument(memberId, fields = {}, audit = {}) {
  const taskId = fields.taskId ? String(fields.taskId) : '';
  const [clientMap, docTypes] = await Promise.all([
    loadClientMap(),
    prisma.$queryRawUnsafe(`SELECT id, title FROM t_doc_type WHERE del=1 ORDER BY t_order ASC`),
  ]);

  if (!taskId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT A.id, A.task_name, A.client_id,
        IF(A.start_date='0000-00-00 00:00:00', NULL, A.start_date) AS start_date
      FROM t_task_allocation A
      WHERE A.del=1 AND A.status='Open'
        AND A.id IN (SELECT ref_id FROM tv_academic_event WHERE del=1 AND ref_id!=0)
      ORDER BY A.start_date ASC
    `);

    if (!audit.skipLog) {
      await logModulePage(DOCUMENT_PAGE, 'View', 'Successful', 'list', memberId, audit);
    }

    return {
      success: true,
      view: 'list',
      items: rows.map((r) => ({
        taskId: Number(r.id),
        title: r.task_name || '',
        categoryName: clientMap[Number(r.client_id)] || '',
        programDate: formatProgramDate(r.start_date),
      })),
    };
  }

  const taskRows = await prisma.$queryRawUnsafe(`
    SELECT id, task_name FROM t_task_allocation WHERE del=1 AND id=${Number(taskId)} LIMIT 1
  `);
  if (!taskRows[0]) {
    return { success: false, message: 'Task not found.' };
  }

  const docRows = await prisma.$queryRawUnsafe(`
    SELECT d.id, d.title, d.d_type, d.d_order, d.d_attach, dt.title AS type_name
    FROM t_document d
    LEFT JOIN t_doc_type dt ON dt.id=d.d_type
    WHERE d.del=1 AND d.t_id=${Number(taskId)}
    ORDER BY d.d_order ASC
  `);

  if (!audit.skipLog) {
    await logModulePage(DOCUMENT_PAGE, 'View', 'Successful', taskId, memberId, audit);
  }

  return {
    success: true,
    view: 'detail',
    taskId,
    taskName: taskRows[0].task_name || '',
    docTypes: docTypes.map((t) => ({ id: String(t.id), title: t.title })),
    documents: docRows.map(mapDocument),
  };
}

export async function saveCommitteeTaskDocument(payload, memberId, files = [], audit = {}) {
  const taskId = Number(payload.taskId);
  if (!taskId) return { success: false, message: 'Select a task.' };

  const { update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const docId = parseId(payload.docId);
    await prisma.$executeRawUnsafe(`
      UPDATE t_document SET del=0, updated_by='${escapeSql(memberId)}',
        updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${docId} AND t_id=${taskId}
    `);
    await logModulePage(DOCUMENT_PAGE, 'Delete', 'Successful', String(docId), memberId, audit);
    return {
      success: true,
      message: 'Document deleted.',
      ...(await loadCommitteeTaskDocument(memberId, { taskId: String(taskId) }, { ...audit, skipLog: true })),
    };
  }

  for (const file of files) {
    const uploaded = await uploadTaskDocumentFile(taskId, file, memberId, audit);
    if (uploaded.error) return { success: false, message: uploaded.error };
  }

  const rows = Array.isArray(payload.documents) ? payload.documents : [];
  for (const doc of rows) {
    if (!doc.id) continue;
    await prisma.$executeRawUnsafe(`
      UPDATE t_document SET title='${escapeSql(doc.title || '')}',
        d_type=${Number(doc.typeId) || 0},
        d_order=${Number(doc.order) || 0},
        updated_by='${escapeSql(memberId)}',
        updated_ip='${escapeSql(update.updated_ip)}',
        updated_dt=NOW()
      WHERE id=${Number(doc.id)} AND t_id=${taskId}
    `);
  }

  await logModulePage(DOCUMENT_PAGE, 'Update', 'Successful', String(taskId), memberId, audit);
  return {
    success: true,
    message: files.length ? 'Document uploaded.' : 'Documents saved.',
    ...(await loadCommitteeTaskDocument(memberId, { taskId: String(taskId) }, { ...audit, skipLog: true })),
  };
}

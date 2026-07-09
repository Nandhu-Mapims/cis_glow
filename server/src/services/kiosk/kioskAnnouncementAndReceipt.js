import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadJobCategories, RECEIPT_TYPES } from './kioskShared.js';

const ADD_PAGE = 'announcement_add.php';
const EDIT_PAGE = 'announcement_edit.php';
const RECEIPT_PAGE = 'm_recepit_setup.php';

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    fromDate: row.from_date ? String(row.from_date).slice(0, 10) : '',
    toDate: row.to_date ? String(row.to_date).slice(0, 10) : '',
    audience: row.a_for || '',
    tvWidget: row.tv_widget === 1,
    tvFlash: row.tv_flash === 1,
  };
}

export async function loadKioskAnnouncementAdd(memberId, _fields, audit = {}) {
  await logModulePage(ADD_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    form: {
      title: '', description: '', fromDate: new Date().toISOString().slice(0, 10),
      toDate: new Date().toISOString().slice(0, 10), audience: 'all', tvWidget: false, tvFlash: false,
    },
  };
}

export async function saveKioskAnnouncementAdd(payload, memberId, audit = {}) {
  const { create } = auditFields(memberId, audit);
  const title = String(payload.title || '').trim();
  if (!title) return { success: false, message: 'Title is required.' };
  await prisma.$executeRawUnsafe(`
    INSERT INTO staff_announcement
      (title, description, from_date, to_date, a_for, tv_widget, tv_flash,
       created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
    VALUES ('${escapeSql(title)}', '${escapeSql(payload.description || '')}',
      ${payload.fromDate ? `'${escapeSql(payload.fromDate)}'` : 'NULL'},
      ${payload.toDate ? `'${escapeSql(payload.toDate)}'` : 'NULL'},
      '${escapeSql(payload.audience || 'all')}',
      ${payload.tvWidget ? 1 : 0}, ${payload.tvFlash ? 1 : 0},
      NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
      NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)
  `);
  await logModulePage(ADD_PAGE, 'Update', 'Successful', title, memberId, audit);
  return { success: true, message: 'Announcement added.' };
}

export async function loadKioskAnnouncementEdit(memberId, fields = {}, audit = {}) {
  const announcementId = fields.announcementId ? parseId(fields.announcementId) : null;
  const list = await prisma.$queryRawUnsafe(`
    SELECT id, title, from_date, to_date FROM staff_announcement WHERE del=1
    ORDER BY from_date DESC, id DESC LIMIT 100
  `);
  let form = null;
  if (announcementId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, title, description, from_date, to_date, a_for, tv_widget, tv_flash
      FROM staff_announcement WHERE del=1 AND id=${announcementId} LIMIT 1
    `);
    if (rows[0]) form = mapAnnouncement(rows[0]);
  }
  await logModulePage(EDIT_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    announcements: list.map((r) => ({
      id: r.id,
      title: r.title,
      fromDate: r.from_date ? String(r.from_date).slice(0, 10) : '',
      toDate: r.to_date ? String(r.to_date).slice(0, 10) : '',
    })),
    announcementId,
    form: form || {
      title: '', description: '', fromDate: '', toDate: '', audience: 'all', tvWidget: false, tvFlash: false,
    },
  };
}

export async function saveKioskAnnouncementEdit(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  if (payload.action === 'delete') {
    const id = parseId(payload.announcementId);
    await prisma.$executeRawUnsafe(`
      UPDATE staff_announcement SET del=0,
        updated_dt=NOW(),
        updated_ip='${escapeSql(update.updated_ip)}',
        updated_by='${escapeSql(memberId)}'
      WHERE id=${id}
    `);
    await logModulePage(EDIT_PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Announcement deleted.' };
  }
  const id = parseId(payload.announcementId);
  await prisma.$executeRawUnsafe(`
    UPDATE staff_announcement SET
      title='${escapeSql(payload.title || '')}',
      description='${escapeSql(payload.description || '')}',
      from_date=${payload.fromDate ? `'${escapeSql(payload.fromDate)}'` : 'NULL'},
      to_date=${payload.toDate ? `'${escapeSql(payload.toDate)}'` : 'NULL'},
      a_for='${escapeSql(payload.audience || 'all')}',
      tv_widget=${payload.tvWidget ? 1 : 0},
      tv_flash=${payload.tvFlash ? 1 : 0},
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=${id} AND del=1
  `);
  await logModulePage(EDIT_PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Announcement updated.',
    ...(await loadKioskAnnouncementEdit(memberId, { announcementId: id }, { ...audit, skipLog: true })),
  };
}

export async function loadKioskReceiptSetup(memberId, fields = {}, audit = {}) {
  const jobCategory = fields.jobCategory ? String(fields.jobCategory) : '';
  const receiptType = fields.receiptType || '';
  const categories = [{ id: 'all', name: 'All' }, ...(await loadJobCategories())];

  let setup = null;
  let signatures = [];
  if (jobCategory && receiptType) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, job_category, receipt_type, task_assign, task_row, task_rheight, receipt_message
      FROM att_receipt_setup WHERE del=1
        AND job_category='${escapeSql(jobCategory)}' AND receipt_type='${escapeSql(receiptType)}' LIMIT 1
    `);
    if (rows[0]) {
      setup = {
        id: rows[0].id,
        taskAssign: rows[0].task_assign,
        taskRow: rows[0].task_row,
        taskRowHeight: rows[0].task_rheight,
        receiptMessage: rows[0].receipt_message || '',
      };
      signatures = await prisma.$queryRawUnsafe(`
        SELECT id, staff_name, staff_designation, staff_order, staff_row
        FROM att_receipt_sign WHERE del=1 AND receipt_id='${rows[0].id}' ORDER BY staff_order ASC
      `);
    }
  }

  await logModulePage(RECEIPT_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    categories,
    receiptTypes: RECEIPT_TYPES,
    jobCategory,
    receiptType,
    setup: setup || { taskAssign: 0, taskRow: 1, taskRowHeight: 20, receiptMessage: '' },
    signatures: signatures.map((s) => ({
      id: s.id,
      name: s.staff_name || '',
      designation: s.staff_designation || '',
      order: s.staff_order,
      row: s.staff_row,
    })),
  };
}

export async function saveKioskReceiptSetup(payload, memberId, audit = {}) {
  const jobCategory = String(payload.jobCategory || '').trim();
  const receiptType = String(payload.receiptType || '').trim();
  if (!jobCategory || !receiptType) return { success: false, message: 'Category and receipt type required.' };
  const { create, update } = auditFields(memberId, audit);
  let receiptId = payload.setup?.id ? Number(payload.setup.id) : null;

  if (receiptId) {
    await prisma.$executeRawUnsafe(`
      UPDATE att_receipt_setup SET
        task_assign=${Number(payload.setup.taskAssign) || 0},
        task_row=${Number(payload.setup.taskRow) || 1},
        task_rheight=${Number(payload.setup.taskRowHeight) || 20},
        receipt_message='${escapeSql(payload.setup.receiptMessage || '')}',
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${receiptId}
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO att_receipt_setup
        (job_category, receipt_type, task_assign, task_row, task_rheight, receipt_message,
         created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
      VALUES ('${escapeSql(jobCategory)}', '${escapeSql(receiptType)}',
        ${Number(payload.setup?.taskAssign) || 0}, ${Number(payload.setup?.taskRow) || 1},
        ${Number(payload.setup?.taskRowHeight) || 20}, '${escapeSql(payload.setup?.receiptMessage || '')}',
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
        NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)
    `);
    const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
    receiptId = Number(idRows[0]?.id);
  }

  const signatures = Array.isArray(payload.signatures) ? payload.signatures : [];
  for (const sig of signatures) {
    if (sig.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE att_receipt_sign SET
          staff_name='${escapeSql(sig.name || '')}',
          staff_designation='${escapeSql(sig.designation || '')}',
          staff_order=${Number(sig.order) || 0},
          staff_row=${Number(sig.row) || 0},
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${Number(sig.id)}
      `);
    } else if (sig.name) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO att_receipt_sign
          (receipt_id, staff_name, staff_designation, staff_order, staff_row,
           created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
        VALUES ('${receiptId}', '${escapeSql(sig.name)}', '${escapeSql(sig.designation || '')}',
          ${Number(sig.order) || 0}, ${Number(sig.row) || 0},
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)
      `);
    }
  }

  await logModulePage(RECEIPT_PAGE, 'Update', 'Successful', String(receiptId), memberId, audit);
  return {
    success: true,
    message: 'Receipt setup saved.',
    ...(await loadKioskReceiptSetup(memberId, { jobCategory, receiptType }, { ...audit, skipLog: true })),
  };
}

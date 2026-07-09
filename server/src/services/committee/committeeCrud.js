import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { saveLegacyBinaryFile } from '../web/webUpload.js';
import { loadEventCategories, loadCommitteeOptions, categoryMatchSql } from './committeeShared.js';

const ADD_PAGE = 'event_committee_add.php';
const EDIT_PAGE = 'event_committee_edit.php';
const REPORT_PAGE = 'event_committee_report.php';

function mapCommittee(row) {
  const logo = row.c_logo || '';
  return {
    id: Number(row.id),
    title: row.title || '',
    description: row.description || '',
    logo,
    logoUrl: logo ? `/legacy/files/committee/${logo}` : '',
    categories: String(row.c_category || '').split(',').map((v) => v.trim()).filter(Boolean),
  };
}

export async function loadCommitteeAdd(memberId, _fields, audit = {}) {
  const categories = await loadEventCategories();
  await logModulePage(ADD_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    categories,
    form: { title: '', description: '', categories: [], logo: '' },
  };
}

export async function saveCommitteeAdd(payload, memberId, files = [], audit = {}) {
  const title = String(payload.title || '').trim();
  if (!title) return { success: false, message: 'Name is required.' };
  const { create } = auditFields(memberId, audit);
  let logo = payload.logo || '';
  if (files[0]) {
    const uploaded = await saveLegacyBinaryFile({ folder: 'committee', file: files[0], maxBytes: 2 * 1024 * 1024 });
    if (uploaded.error) return { success: false, message: uploaded.error };
    logo = uploaded.filename;
  }
  const cats = Array.isArray(payload.categories) ? payload.categories.join(',') : String(payload.categories || '');
  await prisma.$executeRawUnsafe(`
    INSERT INTO t_committee (title, description, c_logo, c_category,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
    VALUES ('${escapeSql(title)}', '${escapeSql(payload.description || '')}', '${escapeSql(logo)}',
      '${escapeSql(cats)}', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
      '0000-00-00 00:00:00', '', '', 1)
  `);
  await logModulePage(ADD_PAGE, 'Update', 'Successful', title, memberId, audit);
  return { success: true, message: 'Committee added.' };
}

export async function loadCommitteeEdit(memberId, fields = {}, audit = {}) {
  const committeeId = fields.committeeId ? parseId(fields.committeeId) : null;
  const list = await prisma.$queryRawUnsafe(`SELECT id, title FROM t_committee WHERE del=1 ORDER BY title ASC LIMIT 200`);
  let form = { title: '', description: '', categories: [], logo: '' };
  if (committeeId) {
    const rows = await prisma.$queryRawUnsafe(`SELECT id, title, description, c_logo, c_category FROM t_committee WHERE del=1 AND id=${committeeId} LIMIT 1`);
    if (rows[0]) form = mapCommittee(rows[0]);
  }
  await logModulePage(EDIT_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    categories: await loadEventCategories(),
    committees: list.map((r) => ({ id: Number(r.id), title: r.title })),
    committeeId,
    form,
  };
}

export async function saveCommitteeEdit(payload, memberId, files = [], audit = {}) {
  const { update } = auditFields(memberId, audit);
  if (payload.action === 'delete') {
    const id = parseId(payload.committeeId);
    await prisma.$executeRawUnsafe(`
      UPDATE t_committee SET del=0, updated_dt=NOW(),
        updated_ip='${escapeSql(update.updated_ip)}', updated_by='${escapeSql(memberId)}'
      WHERE id=${id}
    `);
    await logModulePage(EDIT_PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Committee deleted.', ...(await loadCommitteeEdit(memberId, {}, { ...audit, skipLog: true })) };
  }
  const id = parseId(payload.committeeId);
  const title = String(payload.title || '').trim();
  if (!title) return { success: false, message: 'Name is required.' };
  let logo = String(payload.logo || '');
  if (files[0]) {
    const uploaded = await saveLegacyBinaryFile({ folder: 'committee', file: files[0], maxBytes: 2 * 1024 * 1024 });
    if (uploaded.error) return { success: false, message: uploaded.error };
    logo = uploaded.filename;
  } else if (!logo) {
    const existing = await prisma.$queryRawUnsafe(`SELECT c_logo FROM t_committee WHERE del=1 AND id=${id} LIMIT 1`);
    logo = existing[0]?.c_logo ? String(existing[0].c_logo) : '';
  }
  const cats = Array.isArray(payload.categories) ? payload.categories.join(',') : String(payload.categories || '');
  await prisma.$executeRawUnsafe(`
    UPDATE t_committee SET title='${escapeSql(title)}', description='${escapeSql(payload.description || '')}',
      c_logo='${escapeSql(logo)}', c_category='${escapeSql(cats)}',
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=${id} AND del=1
  `);
  await logModulePage(EDIT_PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return { success: true, message: 'Committee updated.', ...(await loadCommitteeEdit(memberId, { committeeId: id }, { ...audit, skipLog: true })) };
}

export async function loadCommitteeReport(memberId, fields = {}, audit = {}) {
  const committeeId = fields.committeeId ? String(fields.committeeId) : '';
  let committee = null;
  let members = [];

  if (committeeId) {
    const [committeeRows, clientRows] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT id, title, description, c_logo, c_category
        FROM t_committee WHERE del=1 AND id=${Number(committeeId)} LIMIT 1
      `),
      prisma.$queryRawUnsafe(`SELECT id, client_name FROM t_client_master WHERE del=1`),
    ]);
    const clientMap = Object.fromEntries(clientRows.map((r) => [String(r.id), r.client_name || '']));

    if (committeeRows[0]) {
      const row = committeeRows[0];
      const categoryIds = String(row.c_category || '').split(',').map((v) => v.trim()).filter(Boolean);
      committee = {
        id: Number(row.id),
        title: row.title || '',
        description: row.description || '',
        logoUrl: row.c_logo ? `/legacy/files/committee/${row.c_logo}` : '',
        categories: categoryIds.map((id) => clientMap[id]).filter(Boolean).join(', '),
      };
    }

    const rows = await prisma.$queryRawUnsafe(`
      SELECT m.id, m.staff_id, m.designation, m.s_order,
        s.staff_id AS sid, s.staff_name, s.staff_title, s.staff_initial,
        d.category_name AS designation_name
      FROM t_committee_member m
      LEFT JOIN staff_profile_tb s ON s.id=m.staff_id AND s.del=1
      LEFT JOIN master_setup d ON d.id=m.designation AND d.del=1
      WHERE m.del=1 AND m.committee_id=${Number(committeeId)}
        AND m.from_date<=DATE(NOW())
        AND (m.to_date='0000-00-00' OR m.to_date>=DATE(NOW()))
      ORDER BY m.s_order ASC
    `);

    members = rows.map((r) => {
      const sid = String(r.sid || '').trim();
      const staffCode = sid || String(r.staff_id || '');
      return {
        id: Number(r.id),
        staffId: staffCode,
        staffName: [r.staff_title, r.staff_name, r.staff_initial].filter(Boolean).join(' ').trim(),
        designation: r.designation_name || '',
        photoUrl: staffCode ? `/legacy/files/staff_idcard/${staffCode}.png` : '',
        photoUrlAlt: staffCode ? `/legacy/files/staff_idcard/${staffCode}.JPG` : '',
      };
    });
  }

  await logModulePage(REPORT_PAGE, 'View', 'Successful', committeeId, memberId, audit);
  return {
    success: true,
    committees: await loadCommitteeOptions(),
    committeeId,
    committee,
    members,
  };
}

export async function saveCommitteeReport(_payload, _memberId, _files, _audit = {}) {
  return { success: false, message: 'Report is read-only.' };
}

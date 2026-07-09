import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { saveLegacyBinaryFile } from '../web/webUpload.js';

const ADD_PAGE = 't_client_add.php';
const EDIT_PAGE = 't_client_edit.php';

function mapClient(row) {
  return {
    id: Number(row.id),
    clientId: row.client_id || '',
    name: row.client_name || '',
    type: row.client_type || '',
    startDate: row.client_start ? String(row.client_start).slice(0, 10) : '',
    email: row.client_email || '',
    phone: row.client_phone || '',
    address: row.client_address || '',
    about: row.client_about || '',
    logo: row.client_logo || '',
  };
}

export async function loadCommitteeClientAdd(memberId, _fields, audit = {}) {
  await logModulePage(ADD_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    form: {
      clientId: '', name: '', type: '', startDate: new Date().toISOString().slice(0, 10),
      email: '', phone: '', address: '', about: '', logo: '',
    },
  };
}

export async function saveCommitteeClientAdd(payload, memberId, files = [], audit = {}) {
  const name = String(payload.name || '').trim();
  if (!name) return { success: false, message: 'Client name required.' };
  const { create } = auditFields(memberId, audit);
  let logo = payload.logo || '';
  if (files[0]) {
    const uploaded = await saveLegacyBinaryFile({ folder: 'client', file: files[0] });
    if (uploaded.error) return { success: false, message: uploaded.error };
    logo = uploaded.filename;
  }
  const clientId = payload.clientId || `${Date.now()}`.slice(-8);
  await prisma.$executeRawUnsafe(`
    INSERT INTO t_client_master
      (client_start, client_type, client_id, client_name, client_logo, client_email, client_phone,
       client_address, client_about, created_dt, created_ip, created_by, del)
    VALUES (${payload.startDate ? `'${escapeSql(payload.startDate)}'` : 'DATE(NOW())'},
      '${escapeSql(payload.type || '')}', '${escapeSql(clientId)}', '${escapeSql(name)}',
      '${escapeSql(logo)}', '${escapeSql(payload.email || '')}', '${escapeSql(payload.phone || '')}',
      '${escapeSql(payload.address || '')}', '${escapeSql(payload.about || '')}',
      NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
  `);
  await logModulePage(ADD_PAGE, 'Update', 'Successful', name, memberId, audit);
  return { success: true, message: 'Client added.' };
}

export async function loadCommitteeClientEdit(memberId, fields = {}, audit = {}) {
  const clientId = fields.clientId ? parseId(fields.clientId) : null;
  const list = await prisma.$queryRawUnsafe(`
    SELECT id, client_id, client_name FROM t_client_master WHERE del=1 ORDER BY client_name ASC LIMIT 200
  `);
  let form = mapClient({});
  if (clientId) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM t_client_master WHERE del=1 AND id=${clientId} LIMIT 1`);
    if (rows[0]) form = mapClient(rows[0]);
  }
  await logModulePage(EDIT_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    clients: list.map((r) => ({ id: Number(r.id), clientId: r.client_id, name: r.client_name })),
    clientId,
    form,
  };
}

export async function saveCommitteeClientEdit(payload, memberId, files = [], audit = {}) {
  const id = parseId(payload.clientId);
  const { update } = auditFields(memberId, audit);
  let logo = payload.logo || '';
  if (files[0]) {
    const uploaded = await saveLegacyBinaryFile({ folder: 'client', file: files[0] });
    if (uploaded.error) return { success: false, message: uploaded.error };
    logo = uploaded.filename;
  }
  await prisma.$executeRawUnsafe(`
    UPDATE t_client_master SET client_name='${escapeSql(payload.name || '')}',
      client_type='${escapeSql(payload.type || '')}',
      client_email='${escapeSql(payload.email || '')}', client_phone='${escapeSql(payload.phone || '')}',
      client_address='${escapeSql(payload.address || '')}', client_about='${escapeSql(payload.about || '')}',
      client_logo='${escapeSql(logo)}',
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=${id}
  `);
  await logModulePage(EDIT_PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return { success: true, message: 'Client updated.', ...(await loadCommitteeClientEdit(memberId, { clientId: id }, { ...audit, skipLog: true })) };
}

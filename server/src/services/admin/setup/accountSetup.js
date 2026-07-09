import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../../config/prisma.js';
import { config } from '../../../config/index.js';
import { encrypt, decrypt } from '../../password.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE_ADD = 'account_add.php';
const PAGE_EDIT = 'account_edit.php';
const PHOTO_EXT = new Set(['jpeg', 'jpg', 'gif', 'png']);
const LIST_LIMIT = 20;

async function uploadMemberPhoto(file) {
  if (!file?.data || !file?.name) return { error: 'No photo file provided' };
  const ext = String(file.name).split('.').pop()?.toLowerCase() || '';
  if (!PHOTO_EXT.has(ext)) {
    return { error: 'Please upload jpeg, gif, jpg, or png only.' };
  }
  const raw = file.data.includes(',') ? file.data.split(',')[1] : file.data;
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > 1024 * 1024) {
    return { error: 'Please upload less than 1 MB file.' };
  }
  const now = new Date();
  const stamp = [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getFullYear()).slice(-2),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const filename = `${stamp}${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
  const dir = path.join(config.legacyImgPath, 'member');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return { filename };
}

async function duplicateCheck({ username, email, excludeId = null }) {
  const clauses = [`member_id='${escapeSql(username)}'`];
  if (email) clauses.push(`address_email='${escapeSql(email)}'`);
  let sql = `SELECT id FROM web_account_setup WHERE del=1 AND (${clauses.join(' OR ')})`;
  if (excludeId) sql += ` AND id!=${Number(excludeId)}`;
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.length > 0;
}

async function emailDuplicateCheck(email, excludeId = null) {
  if (!email) return false;
  let sql = `SELECT id FROM web_account_setup WHERE del=1 AND address_email='${escapeSql(email)}'`;
  if (excludeId) sql += ` AND id!=${Number(excludeId)}`;
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.length > 0;
}

function mapListRow(row) {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
  };
}

function mapEditRow(row) {
  let currentPassword = '';
  try {
    currentPassword = decrypt(row.password || '').trim();
  } catch {
    currentPassword = '';
  }
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    addressMobile: row.address_mobile || '',
    addressEmail: row.address_email || '',
    photo: row.photo || '',
    photoUrl: row.photo ? `/legacy/img/member/${row.photo}` : null,
    currentPassword,
  };
}

export async function loadAccountAdd(memberId, audit = {}) {
  if (!audit.skipLog) {
    await logAdminSetup(PAGE_ADD, 'View', 'Successful', '', memberId, audit);
  }
  return {
    mode: 'add',
    form: {
      memberName: '',
      addressMobile: '',
      addressEmail: '',
      username: '',
    },
  };
}

export async function saveAccountAdd(fields, memberId, audit = {}) {
  const username = String(fields.username || '').trim();
  const password = String(fields.password || '').trim();
  const confirmPassword = String(fields.confirm_password || '').trim();
  const memberName = String(fields.member_name || '').trim();
  const addressMobile = String(fields.address_mobile || '').trim();
  const addressEmail = String(fields.address_email || '').trim();

  if (!username || !memberName || !password) {
    return { success: false, message: 'Member name, username, and password are required.' };
  }
  if (password !== confirmPassword) {
    await logAdminSetup(PAGE_ADD, 'Add', 'Unsuccessful', username, memberId, audit);
    return { success: false, message: 'Invalid Password...' };
  }
  if (await duplicateCheck({ username, email: addressEmail })) {
    await logAdminSetup(PAGE_ADD, 'Add', 'Unsuccessful', addressEmail || username, memberId, audit);
    return { success: false, message: 'Email ID already exists...' };
  }

  const { create } = auditFields(memberId, audit);
  const encrypted = encrypt(password);
  const { created_dt: createdDt, created_ip: createdIp, created_by: createdBy } = create;

  try {
    const created = await prisma.web_account_setup.create({
      data: {
        member_id: username,
        member_name: memberName,
        address_mobile: addressMobile,
        address_email: addressEmail,
        password: encrypted,
        reset_password: '',
        photo: '',
        acc_gender: '',
        ...create,
      },
    });

    await prisma.$executeRaw`
      INSERT INTO access_tb (
        user_id, local_access, random_id, random_id_1, random_id_2, random_id_3, random_id_4,
        date_base, from_date, to_date, day_base, allow_day, allow_from_time, allow_to_time,
        created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
      ) VALUES (
        ${String(created.id)}, 0, '', '', '', '', '',
        0, ${createdDt}, '0000-00-00 00:00:00', 1, '1,2,3,4,5,6,7', '00:00:00', '23:59:00',
        ${createdDt}, ${createdIp}, ${createdBy}, ${createdDt}, ${createdIp}, ${createdBy}, 1
      )
    `;

    await logAdminSetup(PAGE_ADD, 'Add', 'Successful', username, memberId, audit);
    const reload = await loadAccountAdd(memberId, { ...audit, skipLog: true });
    return {
      success: true,
      message: 'Your details are updated...',
      ...reload,
    };
  } catch {
    await logAdminSetup(PAGE_ADD, 'Add', 'Unsuccessful', username, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}

export async function loadAccountEdit(memberId, fields = {}, query = {}, audit = {}) {
  const editId = fields.edit_row_id
    || fields.update?.[0]
    || query.editId
    || null;

  if (editId) {
    const id = parseId(editId);
    const row = await prisma.web_account_setup.findFirst({
      where: { id, del: 1 },
    });
    if (!row) {
      return { error: 'User not found' };
    }
    await logAdminSetup(PAGE_EDIT, 'View', 'Successful', String(id), memberId, audit);
    return {
      mode: 'edit',
      user: mapEditRow(row),
      listContext: {
        search: query.search || fields.search || '',
        page: Number(query.page || fields.page) || 1,
      },
    };
  }

  const search = String(query.search || fields.search || '').trim();
  const page = Math.max(1, Number(query.page || fields.page) || 1);
  const skip = (page - 1) * LIST_LIMIT;

  const where = { del: 1, member_id: { not: 'igrapix' } };
  if (search) {
    where.OR = [
      { member_id: { contains: search } },
      { member_name: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.web_account_setup.count({ where }),
    prisma.web_account_setup.findMany({
      where,
      orderBy: { member_id: 'asc' },
      skip,
      take: LIST_LIMIT,
      select: { id: true, member_id: true, member_name: true },
    }),
  ]);

  if (!audit.skipLog) {
    await logAdminSetup(PAGE_EDIT, 'View', 'Successful', search || 'list', memberId, audit);
  }

  return {
    mode: 'list',
    search,
    page,
    limit: LIST_LIMIT,
    total,
    users: rows.map(mapListRow),
  };
}

export async function saveAccountEdit(fields, memberId, files = [], audit = {}) {
  if (fields.delete === 'Confirm' && fields.confirm) {
    const id = parseId(fields.confirm);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.web_account_setup.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logAdminSetup(PAGE_EDIT, 'Delete', 'Successful', String(id), memberId, audit);
      const reload = await loadAccountEdit(memberId, {}, { search: fields.search, page: fields.page }, audit);
      return { success: true, message: 'Your details are deleted...', ...reload };
    } catch {
      await logAdminSetup(PAGE_EDIT, 'Delete', 'Unsuccessful', String(fields.confirm), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  if (fields.Submit3 === 'Save') {
    const id = parseId(fields.edit_row_id);
    const password = String(fields.password || '').trim();
    const confirmPassword = String(fields.confirm_password || '').trim();
    if (password !== confirmPassword) {
      await logAdminSetup(PAGE_EDIT, 'Update', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Password not match...' };
    }
    const { update } = auditFields(memberId, audit);
    try {
      await prisma.web_account_setup.update({
        where: { id },
        data: { password: encrypt(password), ...update },
      });
      await logAdminSetup(PAGE_EDIT, 'Update', 'Successful', String(id), memberId, audit);
      const reload = await loadAccountEdit(memberId, { edit_row_id: id }, {}, { ...audit, skipLog: true });
      return { success: true, message: 'Your details are updated...', ...reload };
    } catch {
      await logAdminSetup(PAGE_EDIT, 'Update', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  if (fields.Submit0 === 'Save') {
    const id = parseId(fields.edit_row_id);
    const memberName = String(fields.member_name || '').trim();
    const addressMobile = String(fields.address_mobile || '').trim();
    const addressEmail = String(fields.address_email || '').trim();

    if (await emailDuplicateCheck(addressEmail, id)) {
      await logAdminSetup(PAGE_EDIT, 'Update', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Email ID already exists...' };
    }

    let photo = String(fields.hd_photo || '');
    const photoFile = files.find((f) => f.field === 'photo' || f.name === 'photo');
    if (photoFile) {
      const uploaded = await uploadMemberPhoto(photoFile);
      if (uploaded.error) {
        return { success: false, message: uploaded.error };
      }
      photo = uploaded.filename;
    } else if (fields.remove_photo === '1') {
      photo = '';
    }

    const { update } = auditFields(memberId, audit);
    try {
      await prisma.web_account_setup.update({
        where: { id },
        data: {
          member_name: memberName,
          address_mobile: addressMobile,
          address_email: addressEmail,
          photo,
          ...update,
        },
      });
      await logAdminSetup(PAGE_EDIT, 'Update', 'Successful', String(id), memberId, audit);
      const reload = await loadAccountEdit(memberId, { edit_row_id: id }, {}, { ...audit, skipLog: true });
      return { success: true, message: 'Your details are updated...', ...reload };
    } catch {
      await logAdminSetup(PAGE_EDIT, 'Update', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  return { success: false, message: 'Unknown save action' };
}

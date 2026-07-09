import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { legacyPublicFileUrl } from '../../utils/fileUrls.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import {
  loadAllAttachmentMsCategories,
  loadAllAttachmentSubCategories,
  loadAttachmentMainCategories,
} from './staffShared.js';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'pdf']);

function sanitizeFilename(name) {
  return String(name).replace(/[()[\] ]/g, '_');
}

async function getActiveDeptDesignation(staffRowId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT department, designation
     FROM staff_designation_tb
     WHERE del = 1 AND staff_id = ${staffRowId}
       AND CAST(from_date AS CHAR) NOT LIKE '0000-00-00%' AND from_date <= CURDATE()
       AND (CAST(to_date AS CHAR) LIKE '0000-00-00%' OR to_date >= CURDATE())
     ORDER BY id ASC
     LIMIT 1`,
  );
  if (!rows.length) return null;
  return {
    department: String(rows[0].department),
    designation: String(rows[0].designation),
  };
}

async function resolveDeptDesignationNames(departmentId, designationId) {
  const [deptRows, desgRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT name FROM staff_dept_master WHERE del = 1 AND id = '${escapeSql(departmentId)}' LIMIT 1`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT name FROM staff_desg_master WHERE del = 1 AND id = '${escapeSql(designationId)}' LIMIT 1`,
    ),
  ]);
  return {
    departmentName: deptRows[0]?.name || departmentId,
    designationName: desgRows[0]?.name || designationId,
  };
}

export async function getStaffAttachmentCatalog(staffRowId) {
  const sid = parseId(staffRowId, 'staff id');
  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id FROM staff_profile_tb WHERE del = 1 AND id = ${sid} LIMIT 1`,
  );
  if (!staffRows.length) return null;

  const mapping = await getActiveDeptDesignation(sid);
  if (!mapping) {
    return {
      staffId: sid,
      staffCode: staffRows[0].staff_id,
      types: [],
      message: 'No active department/designation mapping found for this staff member.',
    };
  }

  const { departmentName, designationName } = await resolveDeptDesignationNames(
    mapping.department,
    mapping.designation,
  );

  const [mcategoryRows, scategoryRows, mscategoryRows, setupRows, existingRows] = await Promise.all([
    loadAttachmentMainCategories(),
    loadAllAttachmentSubCategories(),
    loadAllAttachmentMsCategories(),
    prisma.$queryRawUnsafe(
      `SELECT id, mandatory, mcategory, scategory, mscategory, notes
       FROM staff_attachment_setup
       WHERE del = 1
         AND department = '${escapeSql(String(mapping.department))}'
         AND designation = '${escapeSql(String(mapping.designation))}'
       ORDER BY mcategory ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, attach_id, attach_no, attach_file
       FROM staff_attachment_tb
       WHERE del = 1 AND s_id = ${sid}`,
    ),
  ]);

  const mcat = Object.fromEntries(mcategoryRows.map((r) => [Number(r.id), r.name]));
  const scat = Object.fromEntries(scategoryRows.map((r) => [Number(r.id), r.name]));
  const mscat = Object.fromEntries(mscategoryRows.map((r) => [Number(r.id), r.name]));
  const byAttachId = Object.fromEntries(existingRows.map((r) => [Number(r.attach_id), r]));

  const types = setupRows.map((t) => {
    const row = byAttachId[Number(t.id)];
    return {
      attachId: Number(t.id),
      mandatory: Number(t.mandatory) === 1,
      mainCategory: mcat[Number(t.mcategory)] || '',
      subCategory: scat[Number(t.scategory)] || '',
      docCategory: mscat[Number(t.mscategory)] || '',
      notes: Number(t.notes) === 0 ? 'Xerox' : 'Original',
      recordId: row ? Number(row.id) : null,
      attachNo: row?.attach_no || '',
      attachFile: row?.attach_file || '',
      fileUrl: row?.attach_file ? legacyPublicFileUrl(`staff_documents/${row.attach_file}`) : null,
    };
  });

  return {
    staffId: sid,
    staffCode: staffRows[0].staff_id,
    departmentId: mapping.department,
    designationId: mapping.designation,
    departmentName,
    designationName,
    types,
    message: types.length
      ? ''
      : `No attachment document types are configured for ${departmentName} / ${designationName}. Configure them in Staff attachment setup.`,
  };
}

export async function uploadStaffAttachmentFile(filename, base64Data) {
  const parts = String(filename).split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  if (!ALLOWED_EXT.has(ext)) {
    return { error: 'File type not allowed. Use jpg, png, gif, doc, docx, or pdf.' };
  }

  const safeName = sanitizeFilename(filename);
  const dir = path.join(config.legacyFilesPath, 'staff_documents');
  await fs.mkdir(dir, { recursive: true });

  let finalName = safeName;
  let target = path.join(dir, finalName);
  try {
    await fs.access(target);
    finalName = `${Math.floor(1000 + Math.random() * 9000)}${safeName}`;
    target = path.join(dir, finalName);
  } catch {
    // file does not exist
  }

  const raw = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  await fs.writeFile(target, Buffer.from(raw, 'base64'));
  return { filename: finalName, url: legacyPublicFileUrl(`staff_documents/${finalName}`) };
}

export async function saveStaffAttachments(staffRowId, items, meta) {
  const sid = parseId(staffRowId, 'staff id');
  if (!Array.isArray(items) || !items.length) {
    return { error: 'No attachment data provided' };
  }

  for (const item of items) {
    const attachId = parseId(item.attachId, 'attach id');
    const attachNo = escapeSql(item.attachNo || '');
    const attachFile = escapeSql(item.attachFile || '');

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM staff_attachment_tb
       WHERE del = 1 AND s_id = ${sid} AND attach_id = ${attachId} LIMIT 1`,
    );

    if (existing.length) {
      await prisma.$executeRawUnsafe(
        `UPDATE staff_attachment_tb SET
          attach_no='${attachNo}',
          attach_file='${attachFile}',
          updated_dt=NOW(),
          updated_ip='${escapeSql(meta.ip || '')}',
          updated_by='${escapeSql(meta.username || '')}'
         WHERE id = ${Number(existing[0].id)}`,
      );
    } else if (attachFile) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO staff_attachment_tb
          (s_id, attach_id, attach_no, attach_file, created_dt, created_ip, created_by)
         VALUES (${sid}, ${attachId}, '${attachNo}', '${attachFile}', NOW(),
           '${escapeSql(meta.ip || '')}', '${escapeSql(meta.username || '')}')`,
      );
    }
  }

  return { success: true, catalog: await getStaffAttachmentCatalog(sid) };
}

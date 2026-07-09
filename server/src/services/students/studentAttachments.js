import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { legacyPublicFileUrl } from '../../utils/fileUrls.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'pdf']);

function courseTypeCode(courseName) {
  if (courseName === 'U.G') return 1;
  if (courseName === 'P.G') return 2;
  return 0;
}

function sanitizeFilename(name) {
  return String(name).replace(/[()[\] ]/g, '_');
}

export async function getStudentAttachmentCatalog(studentId) {
  const sid = parseId(studentId, 'student id');
  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT p.id, c.course_name
     FROM student_profile_tb p
     LEFT JOIN basic_setup_course_tb c ON c.id = CAST(p.course_id AS UNSIGNED)
     WHERE p.del = 1 AND p.id = ${sid} LIMIT 1`,
  );
  if (!courseRows.length) return null;

  const ugpg = courseTypeCode(courseRows[0].course_name);
  const types = await prisma.$queryRawUnsafe(
    `SELECT id, category_name, category_sname, ug, pg
     FROM master_setup
     WHERE category = 'Attachment' AND del != 0
     ORDER BY category_order ASC`,
  );

  const filtered = types.filter((t) => Number(t.ug) === ugpg || Number(t.pg) === ugpg);

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id, attach_id, attach_no, attach_file
     FROM student_attachment_tb
     WHERE del = 1 AND s_id = ${sid}`,
  );

  const byAttachId = Object.fromEntries(
    existing.map((row) => [Number(row.attach_id), row]),
  );

  return {
    studentId: sid,
    types: filtered.map((t) => {
      const row = byAttachId[Number(t.id)];
      return {
        attachId: Number(t.id),
        name: t.category_name,
        shortName: t.category_sname,
        recordId: row ? Number(row.id) : null,
        attachNo: row?.attach_no || '',
        attachFile: row?.attach_file || '',
        fileUrl: row?.attach_file
          ? legacyPublicFileUrl(`student_attachment/${row.attach_file}`)
          : null,
      };
    }),
  };
}

export async function uploadStudentAttachmentFile(filename, base64Data) {
  const parts = String(filename).split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  if (!ALLOWED_EXT.has(ext)) {
    return { error: 'File type not allowed. Use jpg, png, gif, doc, docx, or pdf.' };
  }

  const safeName = sanitizeFilename(filename);
  const dir = path.join(config.legacyFilesPath, 'student_attachment');
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
  return { filename: finalName, url: legacyPublicFileUrl(`student_attachment/${finalName}`) };
}

export async function saveStudentAttachments(studentId, items, meta) {
  const sid = parseId(studentId, 'student id');
  if (!Array.isArray(items) || !items.length) {
    return { error: 'No attachment data provided' };
  }

  for (const item of items) {
    const attachId = Number(item.attachId);
    const recordId = item.recordId ? Number(item.recordId) : null;
    const attachNo = escapeSql(item.attachNo || '');
    const attachFile = escapeSql(item.attachFile || '');

    if (!attachId) continue;

    if (!recordId && (attachFile || attachNo)) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO student_attachment_tb (
          s_id, attach_id, attach_no, attach_file, created_dt, created_ip, created_by
        ) VALUES (
          ${sid}, ${attachId}, '${attachNo}', '${attachFile}',
          NOW(), '${escapeSql(meta.ip || '')}', '${escapeSql(meta.username || '')}'
        )`,
      );
    } else if (recordId) {
      await prisma.$executeRawUnsafe(
        `UPDATE student_attachment_tb SET
          attach_no='${attachNo}',
          attach_file='${attachFile}',
          del=1,
          updated_dt=NOW(),
          updated_ip='${escapeSql(meta.ip || '')}',
          updated_by='${escapeSql(meta.username || '')}'
        WHERE id=${recordId} AND s_id=${sid}`,
      );
    }
  }

  return { success: true, catalog: await getStudentAttachmentCatalog(sid) };
}

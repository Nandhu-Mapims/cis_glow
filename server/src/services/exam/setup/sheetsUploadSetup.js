import fs from 'fs';
import path from 'path';
import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { config } from '../../../config/index.js';
import { auditFields, logExamSetup } from './setupAudit.js';

const PAGE = 'term_sheets_upload.php';

function sanitizeFilename(name) {
  return String(name || '').replace(/[\s\-()[\]%_<> '"\\]/g, '');
}

function omrSubdir(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

async function nextBatchId(existingBatchId) {
  if (existingBatchId) return Number(existingBatchId);
  const rows = await prisma.$queryRawUnsafe(
    'SELECT batch_id FROM cia_omr_log_tb WHERE del=1 ORDER BY batch_id DESC LIMIT 1',
  );
  return Number(rows?.[0]?.batch_id || 0) + 1;
}

export async function loadSheetsUpload(memberId, fields = {}, audit = {}) {
  await logExamSetup(PAGE, 'View', 'Successful', String(fields.batchId || ''), memberId, audit);
  return {
    batchId: fields.batchId ? Number(fields.batchId) : null,
    note: 'Upload *.gif, *.jpg format files only. Individual files should be less than 10 MB.',
  };
}

export async function saveSheetsUpload(payload, memberId, files = [], audit = {}) {
  if (!files.length) {
    return { success: false, message: 'Please attach at least one sheet image' };
  }

  const { create } = auditFields(memberId, audit);
  const ip = create.created_ip || '';
  const by = create.created_by || memberId;
  let batchId = await nextBatchId(payload.batchId);
  const subdir = omrSubdir();
  const omrDir = path.join(config.legacyFilesPath, 'omr', subdir);
  fs.mkdirSync(omrDir, { recursive: true });

  const results = [];
  for (const file of files) {
    const ext = path.extname(file.filename || '.jpg').toLowerCase() || '.jpg';
    if (!['.jpg', '.jpeg', '.gif'].includes(ext)) {
      results.push({ filename: file.filename, success: false, message: 'Unsupported file type' });
      continue;
    }

    const buffer = Buffer.from(file.content, 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      results.push({ filename: file.filename, success: false, message: 'File is too big, it should be less than 10 MB.' });
      continue;
    }

    const uploadName = sanitizeFilename(file.filename || `sheet${Date.now()}${ext}`);
    let storeName = `${subdir}_${uploadName}`;
    let fullPath = path.join(omrDir, storeName);
    if (fs.existsSync(fullPath)) {
      const randomDigit = `${Date.now()}`.slice(-6);
      storeName = `${subdir}_${randomDigit}${uploadName}`;
      fullPath = path.join(omrDir, storeName);
    }
    fs.writeFileSync(fullPath, buffer);

    await prisma.$executeRawUnsafe(
      `INSERT INTO cia_omr_log_tb
       (batch_id, exam_name, course_id, academic_year, current_year, academic_type,
        subject_id, schedule_id, mark_type, page_no, foil_sheet_no,
        upload_sheet, store_sheet, status, c_flag, created_dt, created_ip, created_by, del)
       VALUES ('${batchId}', '', '', '', '', '', '', 0, '', '', '',
         '${escapeSql(uploadName)}', '${escapeSql(storeName)}', '', 1,
         NOW(), '${escapeSql(ip)}', '${escapeSql(by)}', 1)`,
    );

    results.push({ filename: file.filename, success: true, stored: storeName });
  }

  const uploaded = results.filter((r) => r.success).length;
  await logExamSetup(PAGE, 'Upload', 'Successful', String(uploaded), memberId, audit);
  const allOk = results.every((r) => r.success);
  return {
    success: allOk,
    message: allOk ? `${uploaded} files uploaded.` : 'Some files failed',
    batchId,
    results,
    statusUrl: `/exam/reports/sheets-status?batchId=${batchId}`,
    ...(await loadSheetsUpload(memberId, { batchId }, { ...audit, skipLog: true })),
  };
}

import fs from 'fs';
import path from 'path';
import { prisma } from '../../../config/prisma.js';
import { config } from '../../../config/index.js';
import { auditFields, logExamSetup } from './setupAudit.js';

const PAGE = 'term_marks_upload.php';

export async function loadMarksUpload(memberId, _fields = {}, audit = {}) {
  await logExamSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { uploads: [] };
}

export async function saveMarksUpload(payload, memberId, files = [], audit = {}) {
  if (!files.length) {
    return { success: false, message: 'Please attach at least one marksheet image' };
  }

  const { create } = auditFields(memberId, audit);
  const results = [];
  const omrDir = path.join(config.legacyFilesPath, 'omr', new Date().toISOString().slice(2, 7).replace('-', ''));
  fs.mkdirSync(omrDir, { recursive: true });

  for (const file of files) {
    const ext = path.extname(file.filename || '.jpg').toLowerCase() || '.jpg';
    if (!['.jpg', '.jpeg', '.gif'].includes(ext)) {
      results.push({ filename: file.filename, success: false, message: 'Please Upload jpg Formats...' });
      continue;
    }
    const stored = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const fullPath = path.join(omrDir, stored);
    const buffer = Buffer.from(file.content, 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      results.push({ filename: file.filename, success: false, message: 'File too large (max 10MB)' });
      continue;
    }
    fs.writeFileSync(fullPath, buffer);

    await prisma.cia_omr_log_tb.create({
      data: {
        batch_id: 0,
        exam_name: '',
        course_id: '',
        academic_year: '',
        current_year: '',
        academic_type: '',
        subject_id: '',
        schedule_id: 0,
        mark_type: '',
        page_no: '',
        foil_sheet_no: '',
        upload_sheet: file.filename || stored,
        store_sheet: stored,
        status: 'Uploaded — pending OMR decode',
        c_flag: 0,
        ...create,
      },
    });

    results.push({
      filename: file.filename,
      success: true,
      message: `${file.filename} stored. OMR mark extraction runs when QR/sheet metadata is decoded from the image.`,
      storedPath: stored,
    });
  }

  await logExamSetup(PAGE, 'Upload', 'Successful', String(files.length), memberId, audit);
  const allOk = results.every((r) => r.success);
  return {
    success: allOk,
    message: allOk ? 'Upload completed' : 'Some files failed',
    results,
    uploads: results,
  };
}

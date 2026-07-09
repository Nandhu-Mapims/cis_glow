import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { logWebSetup } from './webAudit.js';
import { listLegacyFolderFiles, saveLegacyBinaryFile } from './webUpload.js';

const PAGE = 'website_doc_upload.php';
const PDF_EXT = new Set(['pdf']);
const FOLDER = 'documents';

export async function loadWebDocUploadSetup(_memberId, _fields, _query, audit) {
  const files = await listLegacyFolderFiles(FOLDER);
  await logWebSetup(_memberId, audit, PAGE, 'load');
  return {
    success: true,
    files: files.map((f) => ({
      name: f.name,
      size: f.size,
      modified: f.modified,
      url: f.publicUrl,
    })),
    overwrite: false,
  };
}

export async function saveWebDocUploadSetup(memberId, fields, _query, audit) {
  const uploads = Array.isArray(fields.files) ? fields.files : [];
  const overwrite = fields.overwrite === true;
  const saved = [];
  const errors = [];

  for (const file of uploads) {
    if (!file?.data || !file?.name) continue;
    const ext = String(file.name).split('.').pop()?.toLowerCase() || '';
    if (!PDF_EXT.has(ext)) {
      errors.push(`${file.name}: PDF only`);
      continue;
    }

    if (!overwrite) {
      const target = path.join(config.legacyFilesPath, FOLDER, file.name);
      try {
        await fs.access(target);
        errors.push(`${file.name}: already exists (enable overwrite)`);
        continue;
      } catch {
        // ok
      }
    }

    const result = await saveLegacyBinaryFile({
      folder: FOLDER,
      file: { ...file, name: file.name },
      maxBytes: 20 * 1024 * 1024,
      allowedExt: PDF_EXT,
      preserveName: true,
    });
    if (result.error) {
      errors.push(`${file.name}: ${result.error}`);
    } else {
      saved.push(result.filename);
    }
  }

  await logWebSetup(memberId, audit, PAGE, 'save');
  if (!saved.length && errors.length) {
    return { success: false, message: errors.join('; ') };
  }
  return {
    success: true,
    message: saved.length
      ? `Uploaded ${saved.length} file(s).${errors.length ? ` Skipped: ${errors.join('; ')}` : ''}`
      : 'No files uploaded.',
    saved,
    errors,
  };
}

import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';

export async function saveLegacyBinaryFile({
  folder,
  file,
  maxBytes = 10 * 1024 * 1024,
  allowedExt = null,
  preserveName = false,
}) {
  if (!file?.data || !file?.name) return { error: 'No file provided' };
  const ext = String(file.name).split('.').pop()?.toLowerCase() || '';
  if (allowedExt && !allowedExt.has(ext)) {
    return { error: `Allowed types: ${[...allowedExt].join(', ')}` };
  }
  const raw = file.data.includes(',') ? file.data.split(',')[1] : file.data;
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > maxBytes) {
    return { error: `File must be under ${Math.round(maxBytes / 1024)} KB` };
  }
  const safeBase = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = preserveName
    ? safeBase
    : `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
  const dir = path.join(config.legacyFilesPath, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return { filename, publicUrl: `/legacy/files/${folder}/${filename}` };
}

export async function listLegacyFolderFiles(folder) {
  const dir = path.join(config.legacyFilesPath, folder);
  try {
    const names = await fs.readdir(dir);
    const files = [];
    for (const name of names) {
      const stat = await fs.stat(path.join(dir, name));
      if (stat.isFile()) {
        files.push({
          name,
          size: stat.size,
          modified: stat.mtime,
          publicUrl: `/legacy/files/${folder}/${name}`,
        });
      }
    }
    return files.sort((a, b) => b.modified - a.modified);
  } catch {
    return [];
  }
}

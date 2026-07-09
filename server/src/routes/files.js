import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { FILE_STORAGE_MAP, IMG_STORAGE_NOTE } from '../config/fileStorageMap.js';

const router = Router();

function resolveSafeFile(relativePath) {
  const base = path.resolve(config.legacyFilesPath);
  const resolved = path.resolve(base, relativePath || '');
  if (!resolved.startsWith(base)) {
    return null;
  }
  return resolved;
}

router.get('/map', authMiddleware, (_req, res) => {
  return res.json({
    basePath: config.legacyFilesPath,
    legacyStaticPrefix: '/legacy/files/',
    secureApiPrefix: '/api/files/',
    folders: FILE_STORAGE_MAP,
    imgStorage: IMG_STORAGE_NOTE,
    rules: [
      'Do not delete or rename legacy folders',
      'DB stores filenames only; full path is resolved at runtime',
      'Browser links use /legacy/files/ (static); /api/files/ requires JWT',
    ],
  });
});

router.get(/.*/, authMiddleware, (req, res) => {
  const relativePath = decodeURIComponent(req.path.replace(/^\//, ''));
  const filePath = resolveSafeFile(relativePath);
  if (!filePath) {
    return res.status(403).json({ message: 'Invalid file path' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found' });
  }
  return res.sendFile(filePath);
});

export default router;

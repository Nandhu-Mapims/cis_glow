import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  allowedClientOrigins: [...new Set([
    ...(process.env.CLIENT_URLS || '').split(',').map((value) => value.trim()).filter(Boolean),
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL.trim()] : []),
    'http://localhost:5173',
    'http://localhost:5174',
  ])],
  legacyImgPath: process.env.LEGACY_IMG_PATH || '/home/mapims/cis/cis/img',
  legacyFilesPath: process.env.LEGACY_FILES_PATH || '/home/mapims/cis/cis/files',
  legacyCisPath: process.env.LEGACY_CIS_PATH || '/home/mapims/cis/cis',
};

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from '../../server/node_modules/dotenv/lib/main.js';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../server');
let envLoaded = false;

function loadServerEnv() {
  if (envLoaded) return;
  dotenv.config({ path: resolve(serverRoot, '.env') });
  envLoaded = true;
}

/** Return one active student internal id for read tests. */
export async function sampleStudentId() {
  loadServerEnv();
  const { prisma } = await import('../../server/src/config/prisma.js');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM student_profile_tb WHERE del = 1 ORDER BY id DESC LIMIT 1`,
  );
  return rows[0]?.id ? String(rows[0].id) : null;
}

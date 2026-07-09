import { PrismaClient } from '@prisma/client';

function withPoolParams(url) {
  if (!url || /connection_limit=/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=10&pool_timeout=20`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: { url: withPoolParams(process.env.DATABASE_URL) },
  },
});

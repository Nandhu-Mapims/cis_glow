import { prisma } from '../config/prisma.js';

function extractPageName(pageRef) {
  const withoutQuery = String(pageRef || '').split('?')[0];
  const parts = withoutQuery.split('/');
  return parts[parts.length - 1] || 'index';
}

export function normalizeIp(ip) {
  const value = String(ip || '').split(',')[0].trim();
  if (value.length <= 15) return value;
  return value.slice(0, 15);
}

export async function insertLog(logObject, sessionId = '') {
  const page = extractPageName(logObject[0] || 'index');

  await prisma.log_tb.create({
    data: {
      log_page: page,
      log_operation: String(logObject[1] || ''),
      log_status: String(logObject[2] || ''),
      log_description: String(logObject[3] || ''),
      log_timestamp: logObject[4] ? new Date(logObject[4]) : new Date(),
      log_ipaddress: normalizeIp(logObject[5]),
      log_os: String(logObject[6] || '').slice(0, 500),
      log_username: String(logObject[7] || '').slice(0, 155),
      log_session: sessionId || '',
      del: 1,
    },
  });
}

export async function countRecentFailedLogins(ipAddress, minutes = 5) {
  const past = new Date(Date.now() - minutes * 60 * 1000);
  return prisma.log_tb.count({
    where: {
      log_ipaddress: ipAddress,
      log_page: 'index',
      log_status: { not: 'Successful' },
      log_timestamp: { gte: past },
    },
  });
}

export async function getLastSuccessfulLogin(username) {
  return prisma.log_tb.findFirst({
    where: {
      del: 1,
      log_username: username,
      log_page: 'index',
      log_operation: 'login',
      log_status: 'Successful',
    },
    orderBy: { log_timestamp: 'desc' },
    skip: 1,
  });
}

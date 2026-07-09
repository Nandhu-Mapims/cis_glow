import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';

const PAGE = 'log_details.php';

function getBetween(content, start, end) {
  const parts = String(content || '').split(start);
  if (parts.length < 2) return content || '';
  return parts[1].split(end)[0] || '';
}

function parseDateRange(fromDateStr) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const defaultFrom = `${pad(today.getDate())}-${pad(today.getMonth() + 1)}-${today.getFullYear()}`;
  const raw = String(fromDateStr || `${defaultFrom} to ${defaultFrom}`).trim();
  const [fromPart, toPart] = raw.split(' to ').map((s) => s.trim());
  const toIso = (part) => {
    if (!part) return '';
    const m = part.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
  };
  return { from: toIso(fromPart), to: toIso(toPart || fromPart), label: raw };
}

async function resolvePageTitle(logPage) {
  const row = await prisma.basic_admin_menu_tb.findFirst({
    where: { sub_menu_link: logPage, del: 1 },
    select: { main_menu_name: true, sub_menu_name: true },
  });
  if (row && (row.main_menu_name || row.sub_menu_name)) {
    return `${row.main_menu_name} - ${row.sub_menu_name}`;
  }
  return String(logPage || '').replace('.php', '');
}

async function loadUserOptions() {
  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, member_id: { not: 'igrapix' } },
    orderBy: { member_id: 'asc' },
    select: { member_id: true, member_name: true },
  });
  return rows
    .filter((row) => String(row.member_id || '').trim())
    .map((row) => ({
      value: row.member_id,
      label: `${row.member_id} (${row.member_name})`,
    }));
}

function buildSearchSummary(filters) {
  const summary = {
    user: filters.userName || 'All Users',
    os: filters.osName || null,
    ip: filters.ipAddress || null,
    operation: filters.operation || null,
    date: filters.dateLabel,
  };
  return summary;
}

async function searchLogDetails(filters) {
  const clauses = [
    "del = 1",
    "log_page = 'index'",
    "log_operation = 'login'",
    "log_username != 'igrapix'",
  ];

  if (filters.userName) {
    clauses.push(`log_username = '${escapeSql(filters.userName)}'`);
  }
  if (filters.osName) {
    clauses.push(`log_os LIKE '%${escapeSql(filters.osName)}%'`);
  }
  if (filters.ipAddress) {
    clauses.push(`log_ipaddress LIKE '${escapeSql(filters.ipAddress)}'`);
  }
  if (filters.from) {
    clauses.push(`DATE(log_timestamp) >= '${escapeSql(filters.from)}'`);
  }
  if (filters.to) {
    clauses.push(`DATE(log_timestamp) <= '${escapeSql(filters.to)}'`);
  }

  const sql = `
    SELECT * FROM log_tb
    WHERE ${clauses.join(' AND ')}
    ORDER BY log_timestamp ASC
  `;
  const logins = await prisma.$queryRawUnsafe(sql);
  const rows = [];
  const nameCache = new Map();

  const resolveName = async (memberId) => {
    if (nameCache.has(memberId)) return nameCache.get(memberId);
    const user = await prisma.web_account_setup.findFirst({
      where: { del: 1, member_id: memberId },
      select: { member_name: true },
    });
    const label = user?.member_name ? ` (${user.member_name})` : '';
    nameCache.set(memberId, label);
    return label;
  };

  for (const login of logins) {
    const status = String(login.log_status || '');
    const operationFilter = filters.operation ? String(filters.operation).trim().toLowerCase() : '';

    if (status.toLowerCase() !== 'successful') {
      if (operationFilter && operationFilter !== String(login.log_operation || '').trim().toLowerCase()) {
        continue;
      }
      const nameSuffix = await resolveName(login.log_username);
      rows.push({
        date: new Date(login.log_timestamp).toLocaleDateString('en-GB').replace(/\//g, '-'),
        user: `${login.log_username}${nameSuffix}`,
        loginTime: new Date(login.log_timestamp).toLocaleTimeString('en-GB', { hour12: false }),
        status: 'F',
        logoutTime: '',
        processes: [{ page: login.log_description || '', time: '', operation: login.log_operation || '' }],
        ip: login.log_ipaddress || '',
        device: getBetween(login.log_os, '(', ')') || login.log_os || '',
      });
      continue;
    }

    const sessionClauses = [
      `del = 1`,
      `id >= ${Number(login.id)}`,
      `log_username = '${escapeSql(login.log_username)}'`,
      `log_timestamp >= '${escapeSql(new Date(login.log_timestamp).toISOString().slice(0, 19).replace('T', ' '))}'`,
      `log_session = '${escapeSql(login.log_session || '')}'`,
      `log_os = '${escapeSql(login.log_os || '')}'`,
    ];
    if (filters.to) {
      sessionClauses.push(`DATE(log_timestamp) <= '${escapeSql(filters.to)}'`);
    }

    const sessionSql = `
      SELECT * FROM log_tb
      WHERE ${sessionClauses.join(' AND ')}
      ORDER BY log_timestamp ASC
    `;
    const sessionRows = await prisma.$queryRawUnsafe(sessionSql);

    let loginCounter = 0;
    const processes = [];
    let logoutTime = '';
    let processIp = login.log_ipaddress || '';
    let processDevice = getBetween(login.log_os, '(', ')') || login.log_os || '';

    for (const entry of sessionRows) {
      if (
        entry.log_page === 'index'
        && String(entry.log_operation).toLowerCase() === 'login'
        && String(entry.log_status).toLowerCase() === 'successful'
        && loginCounter !== 0
      ) {
        break;
      }

      if (loginCounter === 0) {
        processIp = entry.log_ipaddress || processIp;
        processDevice = getBetween(entry.log_os, '(', ')') || entry.log_os || processDevice;
      }

      if (entry.log_page === 'logout') {
        logoutTime = new Date(entry.log_timestamp).toLocaleTimeString('en-GB', { hour12: false });
      } else if (entry.log_page === 'index' && String(entry.log_status).toLowerCase() === 'successful') {
        processes.push({
          page: `${entry.log_page}-${entry.log_status}`,
          time: new Date(entry.log_timestamp).toLocaleTimeString('en-GB', { hour12: false }),
          operation: String(entry.log_operation || '').replace(/\s/g, ''),
        });
      } else if (entry.log_page !== 'index') {
        const op = String(entry.log_operation || '').trim().toLowerCase();
        if (!operationFilter || operationFilter === op) {
          processes.push({
            page: await resolvePageTitle(entry.log_page),
            time: new Date(entry.log_timestamp).toLocaleTimeString('en-GB', { hour12: false }),
            operation: String(entry.log_operation || '').replace(/\s/g, ''),
          });
        }
      }
      loginCounter += 1;
    }

    if (operationFilter && !processes.some((p) => p.operation.toLowerCase() === operationFilter)) {
      continue;
    }

    const nameSuffix = await resolveName(login.log_username);
    rows.push({
      date: new Date(login.log_timestamp).toLocaleDateString('en-GB').replace(/\//g, '-'),
      user: `${login.log_username}${nameSuffix}`,
      loginTime: new Date(login.log_timestamp).toLocaleTimeString('en-GB', { hour12: false }),
      status: 'S',
      logoutTime,
      processes,
      ip: processIp,
      device: processDevice,
    });
  }

  return rows;
}

export async function loadLogDetailsData(memberId, fields = {}, audit = {}) {
  const users = await loadUserOptions();
  const range = parseDateRange(fields.from_date);
  const filters = {
    userName: String(fields.user_name || '').trim(),
    osName: String(fields.os_name || '').trim(),
    ipAddress: String(fields.ip_address || '').trim(),
    operation: String(fields.operation || '').trim(),
    from: range.from,
    to: range.to,
    dateLabel: range.label,
  };

  const searched = fields.Submit === 'Search';
  let rows = [];
  if (searched) {
    rows = await searchLogDetails(filters);
    try {
      await insertLog(
        [PAGE, 'Search', 'Successful', JSON.stringify(filters), new Date(), audit.ip || '', audit.userAgent || '', memberId],
        audit.sessionId || '',
      );
    } catch {
      // Search results should still return when audit logging fails.
    }
  } else {
    try {
      await insertLog(
        [PAGE, 'View', 'Successful', JSON.stringify(fields || {}), new Date(), audit.ip || '', audit.userAgent || '', memberId],
        audit.sessionId || '',
      );
    } catch {
      // Non-blocking view log.
    }
  }

  return {
    users,
    filters: {
      userName: filters.userName,
      fromDate: range.label,
      osName: filters.osName,
      ipAddress: filters.ipAddress,
      operation: filters.operation,
    },
    searchSummary: buildSearchSummary({ ...filters, dateLabel: range.label }),
    searched,
    rows,
  };
}

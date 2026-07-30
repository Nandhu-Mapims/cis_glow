import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';

const PAGE = 'log_dashboard.php';

function formatDisplayDate(isoDate) {
  const d = new Date(isoDate);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const str = String(value).trim();
  const dmy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function dayStart(isoDate) {
  return `${escapeSql(isoDate)} 00:00:00`;
}

function dayEndExclusive(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${escapeSql(d.toISOString().slice(0, 10))} 00:00:00`;
}

function buildPeriods(todayIso) {
  const today = new Date(`${todayIso}T12:00:00`);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayBefore = new Date(today);
  dayBefore.setDate(dayBefore.getDate() - 2);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(today);
  monthStart.setMonth(monthStart.getMonth() - 1);

  const iso = (d) => d.toISOString().slice(0, 10);

  return {
    activity: [
      { label: formatDisplayDate(iso(today)), from: iso(today), to: iso(today) },
      { label: formatDisplayDate(iso(yesterday)), from: iso(yesterday), to: iso(yesterday) },
      { label: formatDisplayDate(iso(dayBefore)), from: iso(dayBefore), to: iso(dayBefore) },
      { label: 'Last 7 Days', from: iso(weekStart), to: iso(today) },
      { label: 'Last 30 Days', from: iso(monthStart), to: iso(today) },
    ],
    active: [
      { label: formatDisplayDate(iso(today)), from: iso(today), to: iso(today) },
      { label: formatDisplayDate(iso(yesterday)), from: iso(yesterday), to: iso(yesterday) },
      { label: 'Last 7 Days', from: iso(weekStart), to: iso(today) },
      { label: 'Last 30 Days', from: iso(monthStart), to: iso(today) },
    ],
  };
}

function periodTimestampClause(alias, period) {
  const a = alias ? `${alias}.` : '';
  const start = dayStart(period.from);
  const end = dayEndExclusive(period.to);
  return `${a}log_timestamp >= '${start}' AND ${a}log_timestamp < '${end}'`;
}

function parseSections(fields = {}) {
  const raw = fields.sections;
  if (!raw || raw === 'all') return ['panels', 'activities'];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
}

function parseRoles(fields = {}) {
  const raw = fields.roles;
  if (!raw || raw === 'all') return ['admin', 'staff', 'student'];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
}

const ROLE_CONFIG = {
  admin: {
    logTable: 'log_tb',
    profileTable: 'web_account_setup',
    profileKey: 'member_id',
    totalKey: 'adminTotal',
    activeKey: 'adminActive',
    liveKey: 'adminLive',
  },
  staff: {
    logTable: 'staff_log_tb',
    profileTable: 'staff_profile_tb',
    profileKey: 'staff_id',
    totalKey: 'staffTotal',
    activeKey: 'staffActive',
    liveKey: 'staffLive',
  },
  student: {
    logTable: 'student_log_tb',
    profileTable: 'student_profile_tb',
    profileKey: 'register_no',
    totalKey: 'studentTotal',
    activeKey: 'studentActive',
    liveKey: 'studentLive',
  },
};

async function countRaw(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.cnt || 0);
}

/**
 * One indexed scan per log table (all periods via CASE) — avoids query-pool saturation.
 */
async function activeCountsForRole({ logTable, profileTable, profileKey, periods }) {
  const earliest = periods[periods.length - 1].from;
  const latestEnd = dayEndExclusive(periods[0].to);
  const key = escapeSql(profileKey);
  const caseExprs = periods.map((period, index) => (
    `COUNT(DISTINCT CASE WHEN ${periodTimestampClause('l', period)} THEN l.log_username END) AS p${index}`
  )).join(', ');

  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${caseExprs}
    FROM ${logTable} AS l
    WHERE l.del = 1
      AND l.log_timestamp >= '${dayStart(earliest)}'
      AND l.log_timestamp < '${latestEnd}'
      AND l.log_username IN (
        SELECT ${key} FROM ${profileTable} WHERE del = 1
      )
  `);

  const row = rows[0] || {};
  return periods.map((_, index) => Number(row[`p${index}`] || 0));
}

async function loginActivityForTable(table, periods) {
  const earliest = periods[periods.length - 1].from;
  const latestEnd = dayEndExclusive(periods[0].to);
  const caseExprs = periods.flatMap((period, index) => {
    const clause = periodTimestampClause('l', period);
    return [
      `SUM(CASE WHEN ${clause} AND LOWER(l.log_status) = 'successful' THEN 1 ELSE 0 END) AS s${index}`,
      `SUM(CASE WHEN ${clause} AND LOWER(l.log_status) != 'successful' THEN 1 ELSE 0 END) AS f${index}`,
    ];
  }).join(', ');

  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${caseExprs}
    FROM ${table} AS l
    WHERE l.del = 1
      AND l.log_page = 'index'
      AND l.log_operation = 'login'
      AND l.log_timestamp >= '${dayStart(earliest)}'
      AND l.log_timestamp < '${latestEnd}'
  `);

  const row = rows[0] || {};
  return periods.map((_, index) => ({
    success: Number(row[`s${index}`] || 0),
    failed: Number(row[`f${index}`] || 0),
  }));
}

async function liveUserCount(table) {
  const lastFiveMin = new Date(Date.now() - 5 * 60 * 1000);
  const ts = escapeSql(lastFiveMin.toISOString().slice(0, 19).replace('T', ' '));
  return countRaw(`
    SELECT COUNT(DISTINCT log_username) AS cnt
    FROM ${table}
    WHERE del = 1 AND log_timestamp >= '${ts}'
  `);
}

let profileTotalsCache = { at: 0, data: null };
const PROFILE_CACHE_MS = 300_000;

async function loadProfileTotals() {
  if (profileTotalsCache.data && Date.now() - profileTotalsCache.at < PROFILE_CACHE_MS) {
    return profileTotalsCache.data;
  }
  const [adminTotal, staffTotal, studentTotal] = await Promise.all([
    countRaw('SELECT COUNT(id) AS cnt FROM web_account_setup WHERE del = 1'),
    countRaw('SELECT COUNT(id) AS cnt FROM staff_profile_tb WHERE del = 1'),
    countRaw('SELECT COUNT(id) AS cnt FROM student_profile_tb WHERE del = 1'),
  ]);
  const data = { adminTotal, staffTotal, studentTotal };
  profileTotalsCache = { at: Date.now(), data };
  return data;
}

async function getLastView() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT log_timestamp, log_username
    FROM log_tb
    WHERE del = 1 AND log_page = '${escapeSql(PAGE)}' AND log_operation = 'View'
    ORDER BY log_timestamp DESC
    LIMIT 1 OFFSET 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    by: row.log_username,
    at: row.log_timestamp,
  };
}

const dashboardCache = new Map();
const inflightLoads = new Map();
const CACHE_TTL_MS = 300_000;

function dashboardCacheKey(memberId, fields) {
  return `${memberId}:${toIsoDate(fields.s_date)}`;
}

function inflightKey(cacheKey, sections, roles = []) {
  const rolePart = roles.length ? roles.slice().sort().join(',') : 'all';
  return `${cacheKey}:${sections.slice().sort().join(',')}:${rolePart}`;
}

function buildPanelsPayload({
  selectedDate,
  isToday,
  lastView,
  periods,
  adminTotal,
  staffTotal,
  studentTotal,
  adminActive,
  staffActive,
  studentActive,
  adminLive,
  staffLive,
  studentLive,
  rolesLoaded = ['admin', 'staff', 'student'],
}) {
  const activeOrEmpty = (active, role) => (
    rolesLoaded.includes(role)
      ? periods.active.map((p, i) => ({ label: p.label, active: active[i] }))
      : periods.active.map((p) => ({ label: p.label, active: null }))
  );

  return {
    selectedDate,
    selectedDateLabel: formatDisplayDate(selectedDate),
    isToday,
    lastView,
    rolesLoaded,
    panels: {
      admin: {
        total: adminTotal,
        periods: activeOrEmpty(adminActive, 'admin'),
        live: rolesLoaded.includes('admin') ? adminLive : null,
        loading: !rolesLoaded.includes('admin'),
      },
      staff: {
        total: staffTotal,
        periods: activeOrEmpty(staffActive, 'staff'),
        live: rolesLoaded.includes('staff') ? staffLive : null,
        loading: !rolesLoaded.includes('staff'),
      },
      student: {
        total: studentTotal,
        periods: activeOrEmpty(studentActive, 'student'),
        live: rolesLoaded.includes('student') ? studentLive : null,
        loading: !rolesLoaded.includes('student'),
      },
    },
  };
}

function buildActivitiesPayload(periods, adminActivity, staffActivity, studentActivity) {
  return {
    activities: {
      admin: periods.activity.map((p, i) => ({
        label: p.label,
        success: adminActivity[i].success,
        failed: adminActivity[i].failed,
      })),
      staff: periods.activity.map((p, i) => ({
        label: p.label,
        success: staffActivity[i].success,
        failed: staffActivity[i].failed,
      })),
      student: periods.activity.map((p, i) => ({
        label: p.label,
        success: studentActivity[i].success,
        failed: studentActivity[i].failed,
      })),
    },
  };
}

async function loadPanelsSection(selectedDate, isToday, periods, roles = ['admin', 'staff', 'student']) {
  const totals = await loadProfileTotals();
  const lastViewPromise = getLastView();

  const roleTasks = roles.map(async (role) => {
    const cfg = ROLE_CONFIG[role];
    if (!cfg) return { role, active: [], live: 0 };

    const [active, live] = await Promise.all([
      activeCountsForRole({
        logTable: cfg.logTable,
        profileTable: cfg.profileTable,
        profileKey: cfg.profileKey,
        periods: periods.active,
      }),
      isToday ? liveUserCount(cfg.logTable) : Promise.resolve(0),
    ]);

    return { role, active, live };
  });

  const roleResults = await Promise.all(roleTasks);
  const lastView = await lastViewPromise;

  const activeByRole = Object.fromEntries(roleResults.map((r) => [r.role, r.active]));
  const liveByRole = Object.fromEntries(roleResults.map((r) => [r.role, r.live]));

  return buildPanelsPayload({
    selectedDate,
    isToday,
    lastView,
    periods,
    adminTotal: totals.adminTotal,
    staffTotal: totals.staffTotal,
    studentTotal: totals.studentTotal,
    adminActive: activeByRole.admin || periods.active.map(() => 0),
    staffActive: activeByRole.staff || periods.active.map(() => 0),
    studentActive: activeByRole.student || periods.active.map(() => 0),
    adminLive: liveByRole.admin ?? 0,
    staffLive: liveByRole.staff ?? 0,
    studentLive: liveByRole.student ?? 0,
    rolesLoaded: roles,
  });
}

async function loadActivitiesSection(periods) {
  const [adminActivity, staffActivity, studentActivity] = await Promise.all([
    loginActivityForTable('log_tb', periods.activity),
    loginActivityForTable('staff_log_tb', periods.activity),
    loginActivityForTable('student_log_tb', periods.activity),
  ]);

  return buildActivitiesPayload(periods, adminActivity, staffActivity, studentActivity);
}

function mergePanels(existingPanels = {}, partialPanels = {}, rolesLoaded = []) {
  if (!partialPanels || rolesLoaded.length === 0) return existingPanels;

  const next = { ...existingPanels };
  for (const role of rolesLoaded) {
    if (partialPanels[role]) {
      next[role] = partialPanels[role];
    }
  }
  return next;
}

function mergeDashboardData(existing = {}, partial = {}) {
  const rolesLoaded = partial.rolesLoaded || [];
  return {
    ...existing,
    ...partial,
    panels: partial.panels
      ? mergePanels(existing.panels, partial.panels, rolesLoaded.length ? rolesLoaded : ['admin', 'staff', 'student'])
      : existing.panels,
    activities: partial.activities ?? existing.activities,
    rolesLoaded: [...new Set([...(existing.rolesLoaded || []), ...rolesLoaded])],
  };
}

async function loadLogDashboardDataInner(memberId, fields) {
  const sections = parseSections(fields);
  const roles = parseRoles(fields);
  const selectedDate = toIsoDate(fields.s_date);
  const todayIso = new Date().toISOString().slice(0, 10);
  const isToday = selectedDate === todayIso;
  const periods = buildPeriods(selectedDate);

  let payload = {
    selectedDate,
    selectedDateLabel: formatDisplayDate(selectedDate),
    isToday,
  };

  if (sections.includes('panels')) {
    payload = mergeDashboardData(payload, await loadPanelsSection(selectedDate, isToday, periods, roles));
  }

  if (sections.includes('activities')) {
    payload = mergeDashboardData(payload, await loadActivitiesSection(periods));
  }

  return payload;
}

function getCachedPayload(cacheKey, sections, roles = []) {
  const cached = dashboardCache.get(cacheKey);
  if (!cached || Date.now() - cached.at >= CACHE_TTL_MS) return null;

  const { data } = cached;
  const hasPanels = Boolean(data?.panels);
  const hasActivities = Boolean(data?.activities);
  const rolesLoaded = data?.rolesLoaded || [];
  const hasAllRoles = roles.every((role) => rolesLoaded.includes(role));

  if (sections.includes('panels') && sections.includes('activities')) {
    return hasPanels && hasActivities && hasAllRoles ? data : null;
  }
  if (sections.includes('panels') && hasPanels && hasAllRoles) {
    return mergeDashboardData({}, {
      selectedDate: data.selectedDate,
      selectedDateLabel: data.selectedDateLabel,
      isToday: data.isToday,
      lastView: data.lastView,
      panels: data.panels,
    });
  }
  if (sections.includes('activities') && hasActivities) {
    return { activities: data.activities };
  }
  return null;
}

export async function loadLogDashboardData(memberId, fields = {}, audit = {}) {
  const sections = parseSections(fields);
  const roles = parseRoles(fields);
  const cacheKey = dashboardCacheKey(memberId, fields);
  const bypassCache = fields.Submit === 'Refresh';
  const loadKey = inflightKey(cacheKey, sections, roles);

  if (!bypassCache) {
    const cached = getCachedPayload(cacheKey, sections, roles);
    if (cached) return cached;

    if (inflightLoads.has(loadKey)) {
      return inflightLoads.get(loadKey);
    }
  }

  const loadPromise = loadLogDashboardDataInner(memberId, fields)
    .then((partial) => {
      if (!bypassCache) {
        const existing = dashboardCache.get(cacheKey)?.data || {};
        const merged = mergeDashboardData(existing, partial);
        dashboardCache.set(cacheKey, { at: Date.now(), data: merged });
      }

      if (sections.includes('panels')) {
        insertLog(
          [PAGE, 'View', 'Successful', JSON.stringify(fields || {}), new Date(), audit.ip || '', audit.userAgent || '', memberId],
          audit.sessionId || '',
        ).catch((err) => console.error('Log dashboard audit write failed:', err));
      }

      return partial;
    })
    .finally(() => {
      inflightLoads.delete(loadKey);
    });

  if (!bypassCache) inflightLoads.set(loadKey, loadPromise);
  return loadPromise;
}

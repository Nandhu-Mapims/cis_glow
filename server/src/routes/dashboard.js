import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { getLastSuccessfulLogin } from '../services/logService.js';
import { fetchWidgets } from '../services/dashboard/widgetDispatcher.js';
import { DASHBOARD_WIDGET_LABELS, groupWidgets } from '../services/dashboard/dashboardMeta.js';
import {
  loadStudentDashboardShell,
  loadStaffPatternShell,
} from '../services/dashboard/dashboardScreens.js';
import { loadOverallStrengthReport } from '../services/dashboard/studentStrengthOverall.js';
import { loadCommunityStrengthReport } from '../services/dashboard/studentCommunityStrength.js';
import { isGlobalAccessType } from '../utils/accessType.js';

const router = Router();

export { DASHBOARD_WIDGET_LABELS, groupWidgets };

function parseAttendanceDate(query) {
  if (query.d) {
    const asNum = Number(query.d);
    if (!Number.isNaN(asNum) && asNum > 1000000000) {
      return { iso: new Date(asNum * 1000).toISOString().slice(0, 10), unix: asNum };
    }
    const parsed = new Date(query.d);
    if (!Number.isNaN(parsed.getTime())) {
      const unix = Math.floor(parsed.getTime() / 1000);
      return { iso: parsed.toISOString().slice(0, 10), unix };
    }
  }
  const now = new Date();
  return { iso: now.toISOString().slice(0, 10), unix: Math.floor(now.getTime() / 1000) };
}

async function resolveAcademicYears(query) {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
  return {
    ugr: query.ugr || setup?.ug_academic_year || '',
    uga: query.uga || setup?.uga_academic_year || '',
    pgr: query.pgr || setup?.pg_academic_year || '',
  };
}

async function loadDashboardWidgetRows(user) {
  const userId = String(user.id);

  const fetchRows = (id) =>
    prisma.$queryRaw`
      SELECT widget_name, widget_order
      FROM dashboard_access
      WHERE del = 1 AND status = 1 AND user_id = ${id}
      ORDER BY widget_order ASC
    `;

  let rows = await fetchRows(userId);

  if (rows.length === 0 && isGlobalAccessType(user.access_type)) {
    rows = await fetchRows('1');
  }

  if (rows.length === 0 && isGlobalAccessType(user.access_type)) {
    rows = Object.keys(DASHBOARD_WIDGET_LABELS).map((widgetName, index) => ({
      widget_name: widgetName,
      widget_order: index,
    }));
  }

  return rows;
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.web_account_setup.findFirst({
      where: { id: req.user.id, del: 1 },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const widgets = await loadDashboardWidgetRows(user);

    const widgetItems = widgets.map((row) => ({
      id: row.widget_name,
      label: DASHBOARD_WIDGET_LABELS[row.widget_name] || row.widget_name,
      order: row.widget_order,
    }));

    const lastLogin = await getLastSuccessfulLogin(user.member_id);
    const { iso: attendanceDate } = parseAttendanceDate(req.query);
    const academicYears = await resolveAcademicYears(req.query);

    return res.json({
      title: 'Dashboard',
      username: user.member_id,
      memberName: user.member_name,
      accessType: user.access_type,
      attendanceDate,
      academicYears,
      lastLoginAt: lastLogin?.log_timestamp || null,
      widgets: widgetItems,
      widgetGroups: groupWidgets(widgetItems.map((w) => w.id)),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load dashboard' });
  }
});

router.get('/widgets', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.web_account_setup.findFirst({
      where: { id: req.user.id, del: 1 },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const widgetParam = req.query.w;
    if (!widgetParam || typeof widgetParam !== 'string') {
      return res.status(400).json({ message: 'Query parameter w (widget names) is required' });
    }

    const widgetNames = widgetParam.split(',').map((s) => s.trim()).filter(Boolean);
    const { unix: dateUnix } = parseAttendanceDate(req.query);
    const academicYears = await resolveAcademicYears(req.query);
    const cFlag = req.query.c === '1' ? '1' : '';
    const time = req.query.t || '';
    const cRefresh = Number(req.query.cRefresh) || 0;

    const hasStaffCurrent = widgetNames.includes('staff_current');
    const dateArg = hasStaffCurrent && cFlag === '1'
      ? (req.query.d || new Date().toISOString().slice(0, 10))
      : dateUnix;

    const result = await fetchWidgets({
      memberId: user.member_id,
      widgetNames,
      dateUnix: dateArg,
      cFlag: hasStaffCurrent ? cFlag || '1' : cFlag,
      time: time || new Date().toTimeString().slice(0, 5),
      cRefresh,
      academicYears,
    });

    return res.json(result);
  } catch (error) {
    console.error('Dashboard widgets error:', error);
    return res.status(500).json({ message: 'Unable to load dashboard widgets' });
  }
});

router.get('/student', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.web_account_setup.findFirst({
      where: { id: req.user.id, del: 1 },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(await loadStudentDashboardShell(user, req.query));
  } catch (error) {
    console.error('Student dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load student dashboard' });
  }
});

router.get('/staff-pattern', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.web_account_setup.findFirst({
      where: { id: req.user.id, del: 1 },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(await loadStaffPatternShell(user, req.query));
  } catch (error) {
    console.error('Staff pattern dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load staff pattern dashboard' });
  }
});

router.get('/overall-strength', authMiddleware, async (req, res) => {
  try {
    return res.json(await loadOverallStrengthReport(req.user.memberId));
  } catch (error) {
    console.error('Overall strength error:', error);
    return res.status(500).json({ message: 'Unable to load overall strength report' });
  }
});

router.get('/community-strength', authMiddleware, async (req, res) => {
  try {
    return res.json(await loadCommunityStrengthReport(req.user.memberId));
  } catch (error) {
    console.error('Community strength error:', error);
    return res.status(500).json({ message: 'Unable to load community strength report' });
  }
});

export default router;

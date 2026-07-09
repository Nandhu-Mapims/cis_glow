import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { getStaffCategoryOptions } from '../services/staff/staffCategories.js';
import {
  generateStaffAttendanceReport,
  getStaffAttendanceCalendar,
  punchStaffLiveAttendance,
} from '../services/attendance/attendanceStaff.js';
import {
  loadStaffAttSetupScreen,
  saveStaffAttSetupScreen,
  staffAttSetupMore,
} from '../services/attendance/staffAttendanceSetup.js';
import {
  loadStaffAttScreen,
  saveStaffAttScreen,
  staffAttScreenMore,
} from '../services/attendance/staffAttendanceScreens.js';
import {
  generatePgAttendanceReport,
  generateStudentAttendanceReport,
  getStudentAttendanceFilters,
  getStudentDailyAttendanceSheet,
  getStudentReportAcademicYears,
  getStudentReportFilters,
  saveStudentDailyAttendance,
  setupPgAttendanceReportScreen,
  setupStudentAttendanceReport,
} from '../services/attendance/attendanceStudent.js';
import {
  loadStudentAttScreen,
  saveStudentAttScreen,
} from '../services/attendance/studentAttendanceScreens.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('attendance'));

function handleError(res, error, fallbackMessage) {
  if (error?.message?.startsWith('Invalid ')) {
    return res.status(400).json({ message: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/staff/categories', async (_req, res) => {
  try {
    const categories = await getStaffCategoryOptions();
    return res.json({ categories });
  } catch (error) {
    return handleError(res, error, 'Unable to load staff categories');
  }
});

router.post('/staff/calendar', async (req, res) => {
  try {
    const result = await getStaffAttendanceCalendar(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load staff attendance calendar');
  }
});

router.post('/staff/punch', async (req, res) => {
  try {
    const result = await punchStaffLiveAttendance(req.body || {}, req.user.memberId, {
      ip: req.ip,
    });
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to record staff punch');
  }
});

router.post('/staff/report', async (req, res) => {
  try {
    const result = await generateStaffAttendanceReport(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate staff attendance report');
  }
});

router.post('/staff/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadStaffAttSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.query || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load staff attendance setup');
  }
});

router.post('/staff/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveStaffAttSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save staff attendance setup');
  }
});

router.post('/staff/setup/:screen/more', async (req, res) => {
  try {
    const result = await staffAttSetupMore(req.params.screen, req.body?.query || req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load staff attendance setup more');
  }
});

router.post('/staff/:screen', async (req, res) => {
  try {
    const result = await loadStaffAttScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load staff attendance screen');
  }
});

router.post('/staff/:screen/save', async (req, res) => {
  try {
    const result = await saveStaffAttScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save staff attendance screen');
  }
});

router.post('/staff/:screen/more', async (req, res) => {
  try {
    const result = await staffAttScreenMore(req.params.screen, req.body?.query || req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load staff attendance more');
  }
});

router.get('/students/filters', async (_req, res) => {
  try {
    return res.json(getStudentAttendanceFilters());
  } catch (error) {
    return handleError(res, error, 'Unable to load student attendance filters');
  }
});

router.post('/students/daily', async (req, res) => {
  try {
    const result = await getStudentDailyAttendanceSheet(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load student attendance sheet');
  }
});

router.put('/students/daily', async (req, res) => {
  try {
    const result = await saveStudentDailyAttendance(req.body || {}, req.user.memberId, {
      ip: req.ip,
    });
    if (result.error || result.success === false) {
      return res.status(400).json({ message: result.error || result.message || 'Save failed' });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save student attendance');
  }
});

router.get('/students/report/years', async (_req, res) => {
  try {
    return res.json(await getStudentReportAcademicYears());
  } catch (error) {
    return handleError(res, error, 'Unable to load academic years');
  }
});

router.post('/students/report/filters', async (req, res) => {
  try {
    const result = await getStudentReportFilters(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load report filters');
  }
});

router.post('/students/report/setup', async (req, res) => {
  try {
    const result = await setupStudentAttendanceReport(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to set up student attendance report');
  }
});

router.post('/students/report/generate', async (req, res) => {
  try {
    const result = await generateStudentAttendanceReport(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate student attendance report');
  }
});

router.post('/students/pg-report/setup', async (req, res) => {
  try {
    const result = await setupPgAttendanceReportScreen(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to set up PG attendance report');
  }
});

router.post('/students/pg-report/generate', async (req, res) => {
  try {
    const result = await generatePgAttendanceReport(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate PG attendance report');
  }
});

router.post('/students/:screen/load', async (req, res) => {
  try {
    const result = await loadStudentAttScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditContextFromRequest(req),
    );
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load student attendance screen');
  }
});

router.post('/students/:screen/save', async (req, res) => {
  try {
    const result = await saveStudentAttScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditContextFromRequest(req),
    );
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save student attendance screen');
  }
});

export default router;

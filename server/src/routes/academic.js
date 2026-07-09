import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { listCourses } from '../services/academic/academicCourses.js';
import { loadAcademicSetupScreen, saveAcademicSetupScreen } from '../services/academic/academicSetup.js';
import { runTtConfigMore, runTtConfigMoreV3 } from '../services/academic/academicTtConfig.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('academic'));

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/courses', async (req, res) => {
  try {
    return res.json(await listCourses({
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    }));
  } catch (error) {
    return handleError(res, error, 'Unable to load courses');
  }
});

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadAcademicSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.query || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load academic setup form');
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveAcademicSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.files || [],
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save academic setup');
  }
});

router.get('/tt-config/more', async (req, res) => {
  try {
    const raw = await runTtConfigMore(req.user.memberId, { query: req.query }, auditContextFromRequest(req));
    return res.type('text/plain').send(raw);
  } catch (error) {
    return handleError(res, error, 'Unable to load timetable detail');
  }
});

router.post('/tt-config/more', async (req, res) => {
  try {
    const body = typeof req.body?.body === 'string'
      ? req.body.body
      : new URLSearchParams(req.body).toString();
    const raw = await runTtConfigMore(req.user.memberId, { body }, auditContextFromRequest(req));
    return res.type('text/plain').send(raw);
  } catch (error) {
    return handleError(res, error, 'Unable to save timetable');
  }
});

router.get('/tt-config-v3/more', async (req, res) => {
  try {
    const raw = await runTtConfigMoreV3(req.user.memberId, { query: req.query }, auditContextFromRequest(req));
    return res.type('text/plain').send(raw);
  } catch (error) {
    return handleError(res, error, 'Unable to load timetable detail');
  }
});

router.post('/tt-config-v3/more', async (req, res) => {
  try {
    const body = typeof req.body?.body === 'string'
      ? req.body.body
      : new URLSearchParams(req.body).toString();
    const raw = await runTtConfigMoreV3(req.user.memberId, { body }, auditContextFromRequest(req));
    return res.type('text/plain').send(raw);
  } catch (error) {
    return handleError(res, error, 'Unable to save timetable');
  }
});

export default router;

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { loadExamDashboard } from '../services/exam/examDashboard.js';
import { printExamMarksheet } from '../services/exam/examMarksheet.js';
import { loadExamStudentStatement } from '../services/exam/examStudentStatement.js';
import { loadExamSetupScreen, saveExamSetupScreen } from '../services/exam/examSetup.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('exam'));

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/dashboard', async (req, res) => {
  try {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const result = await loadExamDashboard(req.user.memberId, { refresh });
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load exam dashboard');
  }
});

router.post('/student-statement', async (req, res) => {
  try {
    const result = await loadExamStudentStatement(
      req.user.memberId,
      req.body?.registerNo,
      req.body?.fields || {},
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load student exam statement');
  }
});

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadExamSetupScreen(
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
    return handleError(res, error, 'Unable to load exam form');
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveExamSetupScreen(
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
    return handleError(res, error, 'Unable to save exam form');
  }
});

router.get('/marksheet/print', async (req, res) => {
  try {
    const html = await printExamMarksheet(req.user.memberId, req.query);
    return res.type('text/html').send(html);
  } catch (error) {
    return handleError(res, error, 'Unable to print marksheet');
  }
});

export default router;

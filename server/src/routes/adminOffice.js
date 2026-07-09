import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import {
  loadAdminOfficeSetupScreen,
  lookupActivityParticipants,
  saveAdminOfficeSetupScreen,
} from '../services/adminOffice/adminOfficeSetup.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('adminOffice'));

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadAdminOfficeSetupScreen(
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
    return handleError(res, error, 'Unable to load admin office form');
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveAdminOfficeSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.files || [],
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save admin office form');
  }
});

router.post('/lookup-participants', async (req, res) => {
  try {
    const eventFor = String(req.body?.eventFor || 'student');
    const ids = String(req.body?.ids || '');
    return res.json(await lookupActivityParticipants(eventFor, ids));
  } catch (error) {
    return handleError(res, error, 'Unable to resolve participants');
  }
});

export default router;

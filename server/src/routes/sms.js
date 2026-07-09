import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadSmsScreen, saveSmsScreen } from '../services/sms/smsSetup.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('sms'));

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadSmsScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.query || {},
      auditContextFromRequest(req),
    );
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load SMS screen');
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveSmsScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.files || [],
      auditContextFromRequest(req),
    );
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save SMS screen');
  }
});

export default router;

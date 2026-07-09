import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadWebScreen, saveWebScreen } from '../services/web/webSetup.js';

const router = Router();
router.use(authMiddleware, menuAuthForModule('web'));

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadWebScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.query || {},
      auditContextFromRequest(req),
    );
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    console.error('Web load error:', error);
    return res.status(500).json({ message: 'Unable to load web screen' });
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveWebScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.files || [],
      auditContextFromRequest(req),
    );
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    console.error('Web save error:', error);
    return res.status(500).json({ message: 'Unable to save web screen' });
  }
});

export default router;

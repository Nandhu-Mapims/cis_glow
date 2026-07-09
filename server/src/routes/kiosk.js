import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadKioskScreen, saveKioskScreen } from '../services/kiosk/kioskSetup.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';

const router = Router();
router.use(authMiddleware, menuAuthForModule('kiosk'));

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadKioskScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.query || {}, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('Kiosk load error:', error);
    return res.status(500).json({ message: 'Unable to load kiosk screen' });
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveKioskScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.files || [], auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    if (result.success === false) {
      return res.status(400).json({ message: result.message || 'Save failed' });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('Kiosk save error:', error);
    return res.status(500).json({ message: 'Unable to save kiosk screen' });
  }
});

export default router;

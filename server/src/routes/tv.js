import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadTvDashboard, loadTvScreen, saveTvScreen } from '../services/tv/tvSetup.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';

const router = Router();
router.use(authMiddleware, menuAuthForModule('tv'));

router.get('/dashboard', async (req, res) => {
  try {
    const result = await loadTvDashboard(req.user.memberId, auditContextFromRequest(req));
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('TV dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load TV dashboard' });
  }
});

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadTvScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.query || {}, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('TV load error:', error);
    return res.status(500).json({ message: 'Unable to load TV screen' });
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveTvScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.files || [], auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('TV save error:', error);
    return res.status(500).json({ message: 'Unable to save TV screen' });
  }
});

export default router;

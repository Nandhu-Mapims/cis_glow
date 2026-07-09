import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadElearnDashboard, loadElearningScreen, saveElearningScreen } from '../services/elearning/elearningSetup.js';

const router = Router();
router.use(authMiddleware, menuAuthForModule('elearning'));

router.get('/dashboard', async (req, res) => {
  try {
    const result = await loadElearnDashboard(req.user.memberId, req.query || {}, auditContextFromRequest(req));
    return res.json(result);
  } catch (error) {
    console.error('E-learning dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load e-learning dashboard' });
  }
});

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadElearningScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.query || {}, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    console.error('E-learning load error:', error);
    return res.status(500).json({ message: 'Unable to load e-learning screen' });
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveElearningScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.files || [], auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    console.error('E-learning save error:', error);
    return res.status(500).json({ message: 'Unable to save e-learning screen' });
  }
});

export default router;

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadNaacScreen, saveNaacScreen } from '../services/naac/naacSetup.js';

const router = Router();
router.use(authMiddleware, menuAuthForModule('naac'));

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadNaacScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.query || {}, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    console.error('NAAC load error:', error);
    return res.status(500).json({ message: 'Unable to load NAAC screen' });
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveNaacScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.files || [], auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    console.error('NAAC save error:', error);
    return res.status(500).json({ message: 'Unable to save NAAC screen' });
  }
});

export default router;

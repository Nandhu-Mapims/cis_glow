import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadCommitteeScreen, saveCommitteeScreen } from '../services/committee/committeeSetup.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';

const router = Router();
router.use(authMiddleware, menuAuthForModule('committee'));

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadCommitteeScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.query || {}, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('Committee load error:', error);
    return res.status(500).json({ message: 'Unable to load committee screen' });
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveCommitteeScreen(req.params.screen, req.body?.fields || {}, req.user.memberId, req.body?.files || [], auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('Committee save error:', error);
    return res.status(500).json({ message: 'Unable to save committee screen' });
  }
});

export default router;

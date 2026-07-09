import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadCertificateScreen, saveCertificateScreen } from '../services/certificate/certificateSetup.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';

const router = Router();
router.use(authMiddleware, menuAuthForModule('certificates'));

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadCertificateScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.query || {},
      auditContextFromRequest(req),
    );
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('Certificate load error:', error);
    return res.status(500).json({ message: 'Unable to load certificate screen' });
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveCertificateScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.files || [],
      auditContextFromRequest(req),
    );
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    console.error('Certificate save error:', error);
    return res.status(500).json({ message: 'Unable to save certificate screen' });
  }
});

export default router;

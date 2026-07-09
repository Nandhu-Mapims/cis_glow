import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadLibrarySetupScreen, saveLibrarySetupScreen } from '../services/library/librarySetup.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('library'));

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadLibrarySetupScreen(
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
    return handleError(res, error, 'Unable to load library form');
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveLibrarySetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.files || [],
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    if (result.success === false) {
      return res.status(400).json({ message: result.message || 'Save failed' });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save library form');
  }
});

export default router;

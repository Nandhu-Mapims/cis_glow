import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { loadAdminSetupScreen, saveAdminSetupScreen } from '../services/admin/adminSetup.js';
import { listUsers } from '../services/admin/adminUsers.js';
import { loadLogDashboard, loadLogDetails } from '../services/admin/logDashboard.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { isGlobalAccessType } from '../utils/accessType.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('admin'));

// Admin module is view-only for everyone except true super-admin (accessType 'Global').
// Users with admin menu access (e.g. an "admin" role account that isn't Global) can open
// and load every screen here, but only Global can actually persist a change — mirrors the
// requested split between "can see the admin module" and "can create/edit users & access".
function requireGlobalWrite(req, res, next) {
  if (!isGlobalAccessType(req.user?.accessType)) {
    return res.status(403).json({ message: 'Only Super Admin can save changes here. You have view-only access to this module.' });
  }
  return next();
}

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/users', async (req, res) => {
  try {
    return res.json(await listUsers({
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    }));
  } catch (error) {
    return handleError(res, error, 'Unable to load users');
  }
});

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadAdminSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.query || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load admin form');
  }
});

router.get('/log-dashboard', async (req, res) => {
  try {
    const result = await loadLogDashboard(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load login dashboard');
  }
});

router.post('/log-dashboard', async (req, res) => {
  try {
    const result = await loadLogDashboard(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load login dashboard');
  }
});

router.get('/log-details', async (req, res) => {
  try {
    const result = await loadLogDetails(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load log details');
  }
});

router.post('/log-details', async (req, res) => {
  try {
    const result = await loadLogDetails(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load log details');
  }
});

router.post('/setup/:screen/save', requireGlobalWrite, async (req, res) => {
  try {
    const result = await saveAdminSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.files || [],
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save admin form');
  }
});

export default router;

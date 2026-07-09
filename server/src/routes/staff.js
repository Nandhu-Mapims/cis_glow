import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { searchStaff } from '../services/staff/staffSearch.js';
import { getStaffCategoryOptions } from '../services/staff/staffCategories.js';
import {
  getStaffProfile,
  updateStaffProfile,
} from '../services/staff/staffProfile.js';
import {
  getStaffProfileOptions,
  saveProfileRecords,
} from '../services/staff/staffProfileExtras.js';
import { updateStaffStatus } from '../services/staff/staffStatus.js';
import {
  getStaffAttachmentCatalog,
  saveStaffAttachments,
  uploadStaffAttachmentFile,
} from '../services/staff/staffAttachments.js';
import { insertLog } from '../services/logService.js';
import {
  createStaffAdmission,
  getDesignationsByDepartment,
  getStaffAdmissionOptions,
  isStaffIdAvailable,
} from '../services/staff/staffAdmission.js';
import {
  generateStaffReport,
  getStaffReportFields,
  getStaffReportFilters,
} from '../services/staff/staffReport.js';
import {
  loadStaffSetupScreen,
  saveStaffSetupScreen,
  staffSetupMore,
} from '../services/staff/staffModuleSetup.js';
import {
  loadStaffScreen,
  saveStaffScreen,
  staffScreenMore,
  uploadCertificatesFile,
} from '../services/staff/staffModuleScreens.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';
import { normalizeLegacyIp } from '../utils/sqlSafe.js';

const router = Router();

function auditFromReq(req) {
  return { ip: normalizeLegacyIp(req.ip), userAgent: req.get('user-agent') || '' };
}

function staffAudit(req) {
  return { ip: normalizeLegacyIp(req.ip), username: req.user.memberId };
}

router.use(authMiddleware, menuAuthForModule('staff'));

function handleError(res, error, fallbackMessage) {
  if (error?.message?.startsWith('Invalid ')) {
    return res.status(400).json({ message: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/admission/options', async (_req, res) => {
  try {
    const data = await getStaffAdmissionOptions();
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Unable to load admission options');
  }
});

router.get('/admission/designations', async (req, res) => {
  try {
    const departmentId = String(req.query.departmentId || '').trim();
    if (!departmentId) {
      return res.status(400).json({ message: 'departmentId is required' });
    }
    const designations = await getDesignationsByDepartment(departmentId);
    return res.json({ designations });
  } catch (error) {
    return handleError(res, error, 'Unable to load designations');
  }
});

router.get('/admission/check-id', async (req, res) => {
  try {
    const result = await isStaffIdAvailable(req.query.staffId);
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to check staff ID');
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await createStaffAdmission(req.body || {}, staffAudit(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    await insertLog(
      ['staff_profile_add', 'Add', 'Successful', `id=${result.profile.id}`, new Date(), normalizeLegacyIp(req.ip), '', req.user.memberId],
      '',
    );
    return res.status(201).json({
      ...result.profile,
      tempPassword: result.tempPassword,
      tempPin: result.tempPin,
    });
  } catch (error) {
    return handleError(res, error, 'Unable to create staff admission');
  }
});

router.get('/reports/fields', async (_req, res) => {
  try {
    return res.json(await getStaffReportFields());
  } catch (error) {
    return handleError(res, error, 'Unable to load report fields');
  }
});

router.get('/reports/filters', async (_req, res) => {
  try {
    return res.json(await getStaffReportFilters());
  } catch (error) {
    return handleError(res, error, 'Unable to load report filters');
  }
});

router.post('/reports/generate', async (req, res) => {
  try {
    const result = await generateStaffReport(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate staff report');
  }
});

router.get('/profile-options', async (_req, res) => {
  try {
    return res.json(await getStaffProfileOptions());
  } catch (error) {
    return handleError(res, error, 'Unable to load profile options');
  }
});

router.get('/categories', async (_req, res) => {
  try {
    const categories = await getStaffCategoryOptions();
    return res.json({ categories });
  } catch (error) {
    return handleError(res, error, 'Unable to load staff categories');
  }
});

router.get('/search', async (req, res) => {
  try {
    const by = ['name', 'staff_id', 'category'].includes(req.query.by)
      ? req.query.by
      : 'name';
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ message: 'Search query q is required' });
    }

    const staff = await searchStaff({
      by,
      q,
      staffId: req.query.staffId,
    });

    return res.json({ staff, count: staff.length });
  } catch (error) {
    return handleError(res, error, 'Unable to search staff');
  }
});

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const { fields = {}, query = {} } = req.body || {};
    const result = await loadStaffSetupScreen(
      req.params.screen,
      fields,
      req.user.memberId,
      query,
      auditFromReq(req),
    );
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load staff setup screen');
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveStaffSetupScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditFromReq(req),
    );
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save staff setup screen');
  }
});

router.get('/setup/:screen/more', async (req, res) => {
  try {
    const result = await staffSetupMore(req.params.screen, req.query);
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load staff setup more data');
  }
});

router.post('/screens/:screen/load', async (req, res) => {
  try {
    const result = await loadStaffScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditFromReq(req),
    );
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load staff screen');
  }
});

router.post('/screens/:screen/save', async (req, res) => {
  try {
    const result = await saveStaffScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditFromReq(req),
    );
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save staff screen');
  }
});

router.get('/screens/:screen/more', async (req, res) => {
  try {
    const result = await staffScreenMore(req.params.screen, req.query);
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load staff screen more data');
  }
});

router.post('/screens/certificates/upload', async (req, res) => {
  try {
    const result = await uploadCertificatesFile(req.body || {});
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to upload certificate file');
  }
});

router.get('/:id/attachments', async (req, res) => {
  try {
    const catalog = await getStaffAttachmentCatalog(req.params.id);
    if (!catalog) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    return res.json(catalog);
  } catch (error) {
    return handleError(res, error, 'Unable to load staff attachments');
  }
});

router.post('/:id/attachments/upload', async (req, res) => {
  try {
    const { filename, dataBase64 } = req.body || {};
    if (!filename || !dataBase64) {
      return res.status(400).json({ message: 'filename and dataBase64 are required' });
    }
    const result = await uploadStaffAttachmentFile(filename, dataBase64);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to upload attachment');
  }
});

router.put('/:id/attachments', async (req, res) => {
  try {
    const result = await saveStaffAttachments(
      req.params.id,
      req.body?.items || [],
      staffAudit(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    await insertLog(
      ['staff_attachments', 'Update', 'Successful', `id=${req.params.id}`, new Date(), normalizeLegacyIp(req.ip), '', req.user.memberId],
      '',
    );
    return res.json(result.catalog);
  } catch (error) {
    return handleError(res, error, 'Unable to save attachments');
  }
});

router.put('/:id/records', async (req, res) => {
  try {
    const result = await saveProfileRecords(req.params.id, req.body || {}, staffAudit(req));
    if (result.error) {
      const status = result.error === 'Staff not found' ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }
    const profile = await getStaffProfile(req.params.id);
    return res.json(profile);
  } catch (error) {
    return handleError(res, error, 'Unable to save staff profile records');
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const result = await updateStaffStatus(req.params.id, req.body, staffAudit(req));
    if (result.error) {
      const status = result.error === 'Staff not found' ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }
    return res.json(result.profile);
  } catch (error) {
    return handleError(res, error, 'Unable to update staff status');
  }
});

router.get('/:id/legacy-form', async (req, res) => {
  return res.status(410).json({
    message: 'Legacy PHP staff form removed. Use native profile APIs instead.',
    note: 'View profile with GET /api/staff/:id and update fields with PUT /api/staff/:id (PATCH status via /api/staff/:id/status).',
    endpoints: {
      get: `/api/staff/${req.params.id}`,
      update: `/api/staff/${req.params.id}`,
      status: `/api/staff/${req.params.id}/status`,
    },
  });
});

router.get('/:id', async (req, res) => {
  try {
    const profile = await getStaffProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    return res.json(profile);
  } catch (error) {
    return handleError(res, error, 'Unable to load staff profile');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const result = await updateStaffProfile(req.params.id, req.body, staffAudit(req));

    if (result.error) {
      const status = result.error === 'Staff not found' ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }

    return res.json(result.profile);
  } catch (error) {
    return handleError(res, error, 'Unable to update staff profile');
  }
});

export default router;

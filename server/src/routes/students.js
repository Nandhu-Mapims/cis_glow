import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { searchStudents } from '../services/students/studentSearch.js';
import { getStudentCourseOptions } from '../services/students/studentCourses.js';
import {
  getStudentProfile,
  updateStudentProfile,
} from '../services/students/studentProfile.js';
import {
  createStudentAdmission,
  getAdmissionDegreeOptions,
} from '../services/students/studentAdmission.js';
import { insertLog } from '../services/logService.js';
import {
  getStudentAttachmentCatalog,
  saveStudentAttachments,
  uploadStudentAttachmentFile,
} from '../services/students/studentAttachments.js';
import { updateStudentStatus } from '../services/students/studentStatus.js';
import {
  generateStudentReport,
  getStudentReportFields,
  getStudentReportFilters,
} from '../services/students/studentReport.js';
import {
  loadStudentScreen,
  saveStudentScreen,
  studentScreenMore,
} from '../services/students/studentModuleScreens.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';
import { normalizeLegacyIp } from '../utils/sqlSafe.js';

const router = Router();

function auditFromReq(req) {
  return {
    ip: normalizeLegacyIp(req.ip),
    userAgent: req.get('user-agent') || '',
    sessionId: req.sessionID || '',
  };
}

router.use(authMiddleware, menuAuthForModule('students'));

function handleError(res, error, fallbackMessage) {
  if (error?.message?.startsWith('Invalid ')) {
    return res.status(400).json({ message: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/courses', async (_req, res) => {
  try {
    const courses = await getStudentCourseOptions();
    return res.json({ courses });
  } catch (error) {
    return handleError(res, error, 'Unable to load course options');
  }
});

router.get('/admission/degrees', async (req, res) => {
  try {
    const academicYear = String(req.query.academicYear || '').trim();
    const courseName = String(req.query.courseName || '').trim();
    if (!academicYear || !courseName) {
      return res.status(400).json({ message: 'academicYear and courseName are required' });
    }
    const data = await getAdmissionDegreeOptions(academicYear, courseName);
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Unable to load degree options');
  }
});

router.get('/reports/fields', async (_req, res) => {
  try {
    const data = await getStudentReportFields();
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Unable to load report fields');
  }
});

router.get('/reports/filters', async (_req, res) => {
  try {
    const data = await getStudentReportFilters();
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Unable to load report filters');
  }
});

router.post('/reports/generate', async (req, res) => {
  try {
    const result = await generateStudentReport(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate student report');
  }
});

router.post('/screens/:screen/load', async (req, res) => {
  try {
    const result = await loadStudentScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditFromReq(req),
    );
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load student screen');
  }
});

router.post('/screens/:screen/save', async (req, res) => {
  try {
    const result = await saveStudentScreen(
      req.params.screen,
      req.body?.fields || req.body || {},
      req.user.memberId,
      auditFromReq(req),
    );
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save student screen');
  }
});

router.get('/screens/:screen/more', async (req, res) => {
  try {
    const result = await studentScreenMore(req.params.screen, req.query);
    if (result?.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load student screen more data');
  }
});

router.get('/search', async (req, res) => {
  try {
    const by = req.query.by === 'batch' ? 'batch' : 'roll';
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ message: 'Search query q is required' });
    }

    const students = await searchStudents({
      by,
      q,
      studentId: req.query.studentId,
    });

    return res.json({ students, count: students.length });
  } catch (error) {
    return handleError(res, error, 'Unable to search students');
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await createStudentAdmission(req.body, {
      ip: normalizeLegacyIp(req.ip),
      username: req.user.memberId,
    });

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    await insertLog(
      ['student_profile_add', 'Add', 'Successful', `id=${result.profile.id}`, new Date(), req.ip, '', req.user.memberId],
      '',
    );

    return res.status(201).json(result.profile);
  } catch (error) {
    return handleError(res, error, 'Unable to create student admission');
  }
});

router.get('/:id/attachments', async (req, res) => {
  try {
    const catalog = await getStudentAttachmentCatalog(req.params.id);
    if (!catalog) {
      return res.status(404).json({ message: 'Student not found' });
    }
    return res.json(catalog);
  } catch (error) {
    return handleError(res, error, 'Unable to load student attachments');
  }
});

router.post('/:id/attachments/upload', async (req, res) => {
  try {
    const { filename, dataBase64 } = req.body || {};
    if (!filename || !dataBase64) {
      return res.status(400).json({ message: 'filename and dataBase64 are required' });
    }
    const result = await uploadStudentAttachmentFile(filename, dataBase64);
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
    const result = await saveStudentAttachments(
      req.params.id,
      req.body?.items || [],
      { ip: req.ip, username: req.user.memberId },
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    await insertLog(
      ['student_attachments', 'Update', 'Successful', `id=${req.params.id}`, new Date(), req.ip, '', req.user.memberId],
      '',
    );
    return res.json(result.catalog);
  } catch (error) {
    return handleError(res, error, 'Unable to save attachments');
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const result = await updateStudentStatus(req.params.id, req.body, {
      ip: req.ip,
      username: req.user.memberId,
    });
    if (result.error) {
      const status = result.error === 'Student not found' ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }
    return res.json(result.profile);
  } catch (error) {
    return handleError(res, error, 'Unable to update student status');
  }
});

router.get('/:id/legacy-form', async (req, res) => {
  return res.status(410).json({
    message: 'Legacy PHP student form removed. Use native profile APIs instead.',
    note: 'View profile with GET /api/students/:id and update fields with PUT /api/students/:id (PATCH status via /api/students/:id/status).',
    endpoints: {
      get: `/api/students/${req.params.id}`,
      update: `/api/students/${req.params.id}`,
      status: `/api/students/${req.params.id}/status`,
    },
  });
});

router.get('/:id', async (req, res) => {
  try {
    const profile = await getStudentProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Student not found' });
    }
    return res.json(profile);
  } catch (error) {
    return handleError(res, error, 'Unable to load student profile');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const result = await updateStudentProfile(req.params.id, req.body, {
      ip: req.ip,
      username: req.user.memberId,
    });

    if (result.error) {
      const status = result.error === 'Student not found' ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }

    return res.json(result.profile);
  } catch (error) {
    return handleError(res, error, 'Unable to update student profile');
  }
});

export default router;

import { Router } from 'express';
import path from 'path';
import { prisma } from '../config/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadSettingsSetupScreen, saveSettingsSetupScreen } from '../services/settings/settingsSetup.js';

const router = Router();

function handleSetupError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/public', async (_req, res) => {
  try {
    const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
    if (!setup) {
      return res.status(404).json({ message: 'Institution settings not found' });
    }

    const logoPath = setup.institution_logo
      ? path.join('img/global_images', setup.institution_logo)
      : null;

    return res.json({
      institutionShortName: setup.institution_short_name,
      institutionLogoUrl: logoPath ? `/legacy/${logoPath}` : null,
      adminTitle: setup.institution_short_name,
    });
  } catch (error) {
    console.error('Public settings error:', error);
    return res.status(500).json({ message: 'Unable to load settings' });
  }
});

router.get('/basic', authMiddleware, async (_req, res) => {
  try {
    const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
    if (!setup) {
      return res.status(404).json({ message: 'Institution settings not found' });
    }

    const logoPath = setup.institution_logo
      ? path.join('img/global_images', setup.institution_logo)
      : null;

    return res.json({
      institutionName: setup.institution_name,
      institutionName2: setup.institution_name_2,
      institutionShortName: setup.institution_short_name,
      institutionLogo: setup.institution_logo,
      institutionLogoUrl: logoPath ? `/legacy/${logoPath}` : null,
      institutionAddress: setup.instution_address,
      institutionPhone: setup.instution_phone,
      institutionEmail: setup.instution_email,
      siteUrl: setup.site_url,
      timeZone: setup.time_zone,
      ugAcademicYear: setup.ug_academic_year,
      ugaAcademicYear: setup.uga_academic_year,
      ugOddEvenSem: setup.ug_odd_even_sem,
      pgAcademicYear: setup.pg_academic_year,
      pgOddEvenSem: setup.pg_odd_even_sem,
      adminTitle: setup.institution_short_name,
      adminLargeTitle: `${setup.institution_name} ${setup.institution_name_2}`.trim(),
    });
  } catch (error) {
    console.error('Settings error:', error);
    return res.status(500).json({ message: 'Unable to load settings' });
  }
});

const setupRouter = Router();
setupRouter.use(authMiddleware, menuAuthForModule('settings'));

setupRouter.post('/:screen/load', async (req, res) => {
  try {
    const result = await loadSettingsSetupScreen(
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
    return handleSetupError(res, error, 'Unable to load settings form');
  }
});

setupRouter.post('/:screen/save', async (req, res) => {
  try {
    const result = await saveSettingsSetupScreen(
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
    return handleSetupError(res, error, 'Unable to save settings form');
  }
});

router.use('/setup', setupRouter);

export default router;

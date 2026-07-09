import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadPortfolioDashboard } from '../services/portfolio/portfolioDashboard.js';
import {
  loadPortfolioIndividualReport,
  loadPortfolioStudentDetail,
} from '../services/portfolio/portfolioIndividualReport.js';

const router = Router();
router.use(authMiddleware, menuAuthForModule('portfolio'));

router.post('/dashboard/load', async (req, res) => {
  try {
    const result = await loadPortfolioDashboard(req.user.memberId, req.body?.fields || {}, auditContextFromRequest(req));
    return res.json(result);
  } catch (error) {
    console.error('Portfolio dashboard error:', error);
    return res.status(500).json({ message: 'Unable to load portfolio dashboard' });
  }
});

router.post('/individual-report/load', async (req, res) => {
  try {
    const result = await loadPortfolioIndividualReport(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    return res.json(result);
  } catch (error) {
    console.error('Portfolio individual report error:', error);
    return res.status(500).json({ message: 'Unable to load portfolio report' });
  }
});

router.get('/individual-report/student/:studentId', async (req, res) => {
  try {
    const result = await loadPortfolioStudentDetail(
      req.user.memberId,
      req.params.studentId,
      auditContextFromRequest(req),
    );
    if (result.error) return res.status(404).json(result);
    return res.json(result);
  } catch (error) {
    console.error('Portfolio student detail error:', error);
    return res.status(500).json({ message: 'Unable to load student portfolio' });
  }
});

export default router;

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import { loadPayrollDashboard } from '../services/payroll/payrollDashboard.js';
import { loadPayrollConsolidatedReport } from '../services/payroll/payrollConsolidatedReport.js';
import { loadPayrollIndividualBundle } from '../services/payroll/payrollIndividualBundle.js';
import {
  exportPayrollIndividualExcel,
  loadPayrollIndividualReport,
} from '../services/payroll/payrollIndividualReport.js';
import { loadSalarySummary } from '../services/payroll/salarySummary.js';
import { loadSalaryStatement } from '../services/payroll/salaryStatement.js';
import {
  loadPayrollLegacyReport,
  loadStipendAttReport,
  loadStipendGeneratePayroll,
  runStipendAttReportMore,
  runStipendGeneratePayrollMore,
} from '../services/payroll/payrollLegacyReports.js';
import { loadGeneratePayroll, runGeneratePayrollMore } from '../services/payroll/generatePayrollCore.js';
import { loadStipendIndividualPdfReport } from '../services/payroll/stipendIndividualPdfReport.js';
import { loadPayrollAttReport } from '../services/payroll/payrollAttReportCore.js';
import { loadPayrollMonthlyReport } from '../services/payroll/payrollMonthlyReportCore.js';
import { loadPayrollTaxReport } from '../services/payroll/payrollTaxReportCore.js';
import { loadPayrollSetupScreen, savePayrollSetupScreen } from '../services/payroll/payrollSetup.js';
import { toJsonSafe } from '../utils/toJsonSafe.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('payroll'));

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/dashboard', async (req, res) => {
  try {
    const result = await loadPayrollDashboard(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll dashboard');
  }
});

router.post('/dashboard', async (req, res) => {
  try {
    const result = await loadPayrollDashboard(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll dashboard');
  }
});

router.get('/individual-report', async (req, res) => {
  try {
    const result = await loadPayrollIndividualReport(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll individual report');
  }
});

router.post('/individual-report', async (req, res) => {
  try {
    const result = await loadPayrollIndividualReport(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll individual report');
  }
});

router.get('/consolidated-report', async (req, res) => {
  try {
    const result = await loadPayrollConsolidatedReport(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll consolidated report');
  }
});

router.post('/consolidated-report', async (req, res) => {
  try {
    const result = await loadPayrollConsolidatedReport(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll consolidated report');
  }
});

router.get('/individual-bundle', async (req, res) => {
  try {
    const result = await loadPayrollIndividualBundle(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll individual bundle');
  }
});

router.post('/individual-bundle', async (req, res) => {
  try {
    const result = await loadPayrollIndividualBundle(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll individual bundle');
  }
});

function mountPayrollFormRoute(path, loader, errorMessage) {
  router.get(path, async (req, res) => {
    try {
      const result = await loader(req.user.memberId, {}, auditContextFromRequest(req));
      if (result.error) {
        return res.status(400).json({ message: result.error });
      }
      return res.json(result);
    } catch (error) {
      return handleError(res, error, errorMessage);
    }
  });

  router.post(path, async (req, res) => {
    try {
      const result = await loader(
        req.user.memberId,
        req.body?.fields || {},
        auditContextFromRequest(req),
      );
      if (result.error) {
        return res.status(400).json({ message: result.error });
      }
      return res.json(result);
    } catch (error) {
      return handleError(res, error, errorMessage);
    }
  });
}

mountPayrollFormRoute('/salary-summary', loadSalarySummary, 'Unable to load salary summary');
mountPayrollFormRoute('/salary-statement', loadSalaryStatement, 'Unable to load salary statement');

function mountLegacyReportRoute(path, reportKey, errorMessage) {
  const loader = (memberId, fields, audit) => loadPayrollLegacyReport(reportKey, memberId, fields, audit);
  mountPayrollFormRoute(path, loader, errorMessage);
}

mountLegacyReportRoute('/group-report', 'group-report', 'Unable to load payroll group report');
mountLegacyReportRoute('/stipend/report', 'stipend-report', 'Unable to load stipend payroll report');
mountLegacyReportRoute('/stipend/statement', 'stipend-statement', 'Unable to load stipend salary statement');
mountLegacyReportRoute('/stipend/individual-report', 'stipend-individual-report', 'Unable to load stipend individual report');

router.get('/stipend/individual-pdf', async (req, res) => {
  try {
    const result = await loadStipendIndividualPdfReport(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load stipend PDF report');
  }
});

router.post('/stipend/individual-pdf', async (req, res) => {
  try {
    const result = await loadStipendIndividualPdfReport(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate stipend PDF report');
  }
});

router.get('/stipend/generate-payroll', async (req, res) => {
  try {
    const result = await loadStipendGeneratePayroll(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load stipend generate payroll');
  }
});

router.post('/stipend/generate-payroll', async (req, res) => {
  try {
    const result = await loadStipendGeneratePayroll(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load stipend generate payroll');
  }
});

router.get('/stipend/att-report', async (req, res) => {
  try {
    const result = await loadStipendAttReport(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load stipend attendance report');
  }
});

router.post('/stipend/att-report', async (req, res) => {
  try {
    const result = await loadStipendAttReport(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load stipend attendance report');
  }
});

router.get('/stipend/att-report/more', async (req, res) => {
  try {
    const result = await runStipendAttReportMore(req.user.memberId, req.query);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.type('application/json').send(result.body);
  } catch (error) {
    return handleError(res, error, 'Unable to run stipend attendance report step');
  }
});

router.get('/stipend/generate-payroll/more', async (req, res) => {
  try {
    const result = await runStipendGeneratePayrollMore(req.user.memberId, req.query, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.type('application/json').send(result.body);
  } catch (error) {
    return handleError(res, error, 'Unable to run stipend generate step');
  }
});

router.get('/generate-payroll', async (req, res) => {
  try {
    const result = await loadGeneratePayroll(req.user.memberId, {}, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load generate payroll');
  }
});

router.post('/generate-payroll', async (req, res) => {
  try {
    const result = await loadGeneratePayroll(
      req.user.memberId,
      req.body?.fields || {},
      auditContextFromRequest(req),
    );
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load generate payroll');
  }
});

router.get('/generate-payroll/more', async (req, res) => {
  try {
    const result = await runGeneratePayrollMore(req.user.memberId, req.query, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.type('application/json').send(result.body);
  } catch (error) {
    return handleError(res, error, 'Unable to run generate payroll step');
  }
});

mountPayrollFormRoute('/att-report', loadPayrollAttReport, 'Unable to load payroll attendance report');
mountPayrollFormRoute('/monthly-report', loadPayrollMonthlyReport, 'Unable to load payroll monthly report');
mountPayrollFormRoute('/tax-report', loadPayrollTaxReport, 'Unable to load payroll tax report');

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadPayrollSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to load payroll setup form');
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await savePayrollSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      req.body?.files || [],
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(toJsonSafe(result));
  } catch (error) {
    return handleError(res, error, 'Unable to save payroll setup');
  }
});

router.get('/individual-report/export', async (req, res) => {
  try {
    const result = await exportPayrollIndividualExcel(req.user.memberId, req.query);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to export payroll Excel');
  }
});

export default router;

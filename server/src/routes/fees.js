import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { menuAuthForModule } from '../middleware/menuAuth.js';
import { loadStudentFeeCollectionSheet, saveStudentFeeSlip } from '../services/fees/feeCollection.js';
import { approveFeeSlip, loadFeeSlipApproval } from '../services/fees/feeApproval.js';
import { getPendingFeeSlips } from '../services/fees/feePending.js';
import { getFeeFilterOptions } from '../services/fees/feeFilters.js';
import { getStudentFeeHistory } from '../services/fees/feeHistory.js';
import { generateFeeCollectionReport } from '../services/fees/feeReport.js';
import { loadFeeDashboard, loadFeeDashboardReport } from '../services/fees/feeDashboard.js';
import { loadFeeSetupScreen, saveFeeSetupScreen } from '../services/fees/feeSetup.js';
import { auditContextFromRequest } from '../services/bridgeAuditLog.js';
import {
  deleteApprovedFeeSlip,
  listApprovedFeeSlips,
  reprintFeeReceipt,
} from '../services/fees/feeSlipApproved.js';
import {
  approveFeeDeleteRequest,
  generateFeeDeleteReport,
  listMyFeeDeleteRequests,
  listPendingFeeDeleteApprovals,
  loadPendingDeleteApprovalDetail,
  lookupReceiptForDelete,
  submitFeeDeleteRequest,
} from '../services/fees/feeDelete.js';
import { generatePendingSms, loadPendingSmsClasses, sendPendingFeeSms } from '../services/fees/feePendingSms.js';
import { generatePendingLetters, loadPendingLetterForm } from '../services/fees/feePendingLetter.js';
import { loadDmeSetup, saveDmeSetup } from '../services/fees/feeDmeSetup.js';
import { loadScholarshipSetup, saveScholarshipSetup } from '../services/fees/feeScholarshipSetup.js';
import { loadAcmecScholarshipSetup, saveAcmecScholarshipSetup } from '../services/fees/feeAcmecScholarshipSetup.js';
import { loadAcmecConfig, saveAcmecConfig } from '../services/fees/feeAcmecConfig.js';

const router = Router();

router.use(authMiddleware, menuAuthForModule('fees'));

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

router.get('/filters', async (_req, res) => {
  try {
    return res.json(await getFeeFilterOptions());
  } catch (error) {
    return handleError(res, error, 'Unable to load fee filters');
  }
});

router.post('/setup/scholarship/load', async (req, res) => {
  try {
    const result = await loadScholarshipSetup(req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load scholarship setup');
  }
});

router.post('/setup/scholarship/save', async (req, res) => {
  try {
    const result = await saveScholarshipSetup(req.body || {}, req.user.memberId, { ip: req.ip });
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save scholarship setup');
  }
});

router.post('/setup/dme/load', async (req, res) => {
  try {
    const result = await loadDmeSetup(req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load DME setup');
  }
});

router.post('/setup/dme/save', async (req, res) => {
  try {
    const result = await saveDmeSetup(req.body || {}, req.user.memberId, { ip: req.ip });
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save DME setup');
  }
});

router.post('/setup/acmec-scholarship/load', async (req, res) => {
  try {
    return res.json(await loadAcmecScholarshipSetup(req.body?.fields || req.body || {}));
  } catch (error) {
    return handleError(res, error, 'Unable to load ACMEC scholarship setup');
  }
});

router.post('/setup/acmec-scholarship/save', async (req, res) => {
  try {
    const result = await saveAcmecScholarshipSetup(req.body || {}, req.user.memberId, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save ACMEC scholarship setup');
  }
});

router.post('/setup/:screen/load', async (req, res) => {
  try {
    const result = await loadFeeSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load fee setup form');
  }
});

router.post('/setup/:screen/save', async (req, res) => {
  try {
    const result = await saveFeeSetupScreen(
      req.params.screen,
      req.body?.fields || {},
      req.user.memberId,
      auditContextFromRequest(req),
    );
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save fee setup');
  }
});

router.post('/dashboard', async (req, res) => {
  try {
    const result = await loadFeeDashboard(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load fee dashboard');
  }
});

router.post('/dashboard/report', async (req, res) => {
  try {
    const result = await loadFeeDashboardReport(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load fee dashboard report');
  }
});

router.post('/report/collection', async (req, res) => {
  try {
    const result = await generateFeeCollectionReport(req.body || {}, req.user.memberId, { ip: req.ip });
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate fee collection report');
  }
});

router.get('/students/:registerNo/history', async (req, res) => {
  try {
    const result = await getStudentFeeHistory(req.params.registerNo);
    if (result.error) {
      return res.status(404).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load student fee history');
  }
});

router.post('/collection/sheet', async (req, res) => {
  try {
    const result = await loadStudentFeeCollectionSheet(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load fee collection sheet');
  }
});

router.put('/collection/sheet', async (req, res) => {
  try {
    const result = await saveStudentFeeSlip(req.body || {}, req.user.memberId, { ip: req.ip });
    if (result.error || result.success === false) {
      return res.status(400).json({ message: result.error || result.message || 'Save failed' });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate fee slip');
  }
});

router.get('/delete/lookup/:receiptNo', async (req, res) => {
  try {
    const result = await lookupReceiptForDelete(req.params.receiptNo, req.user.memberId);
    if (result.error) {
      return res.status(404).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to lookup receipt');
  }
});

router.get('/delete/requests/mine', async (req, res) => {
  try {
    return res.json(await listMyFeeDeleteRequests(req.user.memberId));
  } catch (error) {
    return handleError(res, error, 'Unable to load delete requests');
  }
});

router.get('/delete/requests/pending', async (req, res) => {
  try {
    return res.json(await listPendingFeeDeleteApprovals());
  } catch (error) {
    return handleError(res, error, 'Unable to load pending delete requests');
  }
});

router.get('/delete/approve/:receiptNo', async (req, res) => {
  try {
    const result = await loadPendingDeleteApprovalDetail(req.params.receiptNo, req.user.memberId);
    if (result.error) {
      return res.status(404).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load delete approval detail');
  }
});

router.post('/delete/requests', async (req, res) => {
  try {
    const result = await submitFeeDeleteRequest(
      req.body?.receiptNo,
      req.body?.remarks,
      req.user.memberId,
      { ip: req.ip },
    );
    if (!result.success) {
      return res.status(400).json({ message: result.error || result.message || 'Request failed' });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to submit delete request');
  }
});

router.post('/delete/approve', async (req, res) => {
  try {
    const result = await approveFeeDeleteRequest(req.body?.receiptNo, req.user.memberId, { ip: req.ip });
    if (!result.success) {
      return res.status(400).json({ message: result.error || result.message || 'Approve failed' });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to approve delete request');
  }
});

router.post('/delete/report', async (req, res) => {
  try {
    const result = await generateFeeDeleteReport(req.body || {}, req.user.memberId, { ip: req.ip });
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate delete report');
  }
});

router.get('/slips/approved', async (req, res) => {
  try {
    return res.json(await listApprovedFeeSlips(req.query || {}));
  } catch (error) {
    return handleError(res, error, 'Unable to load approved slips');
  }
});

router.delete('/slips/approved/:groupId', async (req, res) => {
  try {
    const result = await deleteApprovedFeeSlip(req.params.groupId, req.user.memberId, { ip: req.ip });
    if (!result.success) {
      return res.status(400).json({ message: result.error || result.message || 'Delete failed' });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to delete approved slip');
  }
});

router.post('/receipts/reprint', async (req, res) => {
  try {
    const result = await reprintFeeReceipt(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(404).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to reprint receipt');
  }
});

router.get('/slips/pending', async (req, res) => {
  try {
    return res.json(await getPendingFeeSlips(req.query || {}));
  } catch (error) {
    return handleError(res, error, 'Unable to load pending slips');
  }
});

router.post('/slips/approve/load', async (req, res) => {
  try {
    const result = await loadFeeSlipApproval(req.body || {}, req.user.memberId);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to load slip for approval');
  }
});

router.post('/slips/approve', async (req, res) => {
  try {
    const result = await approveFeeSlip(req.body || {}, req.user.memberId, { ip: req.ip });
    if (result.error || result.success === false) {
      return res.status(400).json({ message: result.error || result.message || 'Approval failed' });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to approve fee slip');
  }
});

router.get('/pending-sms/classes', async (_req, res) => {
  try {
    const data = await loadPendingSmsClasses();
    return res.json({
      classGroups: data.groups,
      classOptions: data.classOptions,
    });
  } catch (error) {
    return handleError(res, error, 'Unable to load pending SMS classes');
  }
});

router.post('/pending-sms/generate', async (req, res) => {
  try {
    const result = await generatePendingSms(req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate pending fee SMS list');
  }
});

router.post('/pending-sms/send', async (req, res) => {
  try {
    const result = await sendPendingFeeSms(req.body || {}, req.user.memberId, auditContextFromRequest(req));
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to send pending fee SMS');
  }
});

router.post('/acmec-config/load', async (req, res) => {
  try {
    return res.json(await loadAcmecConfig(req.user.memberId, req.body?.fields || {}, auditContextFromRequest(req)));
  } catch (error) {
    return handleError(res, error, 'Unable to load ACMEC config');
  }
});

router.post('/acmec-config/save', async (req, res) => {
  try {
    const result = await saveAcmecConfig(req.body?.fields || req.body || {}, req.user.memberId, auditContextFromRequest(req));
    if (result.error) return res.status(400).json({ message: result.error });
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to save ACMEC config');
  }
});

router.get('/pending-letter/form', async (_req, res) => {
  try {
    return res.json(await loadPendingLetterForm());
  } catch (error) {
    return handleError(res, error, 'Unable to load pending letter form');
  }
});

router.post('/pending-letter/generate', async (req, res) => {
  try {
    const result = await generatePendingLetters(req.body || {});
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json(result);
  } catch (error) {
    return handleError(res, error, 'Unable to generate pending letters');
  }
});

export default router;

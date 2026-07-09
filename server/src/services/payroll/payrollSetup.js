import { logBridgeSave, logBridgeView } from '../bridgeAuditLog.js';
import { loadCronSetup, saveCronSetup } from './setup/cronSetup.js';
import { loadIndividualSetup, saveIndividualSetup } from './setup/individualSetup.js';
import { loadStipendAmountSetup, saveStipendAmountSetup } from './setup/stipendAmountSetup.js';
import { loadStipendDeductionSetup, saveStipendDeductionSetup } from './setup/stipendDeductionSetup.js';
import { loadStipendPayrollClose, saveStipendPayrollClose } from './setup/stipendPayrollClose.js';
import { loadPayrollConfigSetup, savePayrollConfigSetup } from './setup/payrollConfigSetup.js';
import { loadPfEsiSetup, savePfEsiSetup } from './setup/pfEsiSetup.js';
import {
  loadSalaryAddSetup,
  loadSalaryReportSetup,
  saveSalaryAddSetup,
} from './setup/salaryAddSetup.js';
import {
  loadSalaryAdvanceAddSetup,
  loadSalaryAdvanceCloseSetup,
  saveSalaryAdvanceAddSetup,
  saveSalaryAdvanceCloseSetup,
} from './setup/salaryAdvanceSetup.js';
import {
  loadSalaryArrearAddSetup,
  loadSalaryArrearReleaseSetup,
  saveSalaryArrearAddSetup,
  saveSalaryArrearReleaseSetup,
} from './setup/salaryArrearSetup.js';
import {
  loadChequePaymentSetup,
  loadLopDeductionSetup,
  loadOtherDeductionSetup,
  loadTdsAddSetup,
  saveChequePaymentSetup,
  saveLopDeductionSetup,
  saveOtherDeductionSetup,
  saveTdsAddSetup,
} from './setup/monthlyGridSetups.js';
import {
  loadSecurityDepositAddSetup,
  loadSecurityDepositCloseSetup,
  saveSecurityDepositAddSetup,
  saveSecurityDepositCloseSetup,
} from './setup/securityDepositSetup.js';
import { loadPayrollCloseSetup, savePayrollCloseSetup } from './setup/payrollCloseSetup.js';

const VALID_SCREENS = new Set([
  'individual-setup',
  'cron-setup',
  'stipend-amount-setup',
  'stipend-deduction-add',
  'stipend-payroll-close',
  'payroll-config',
  'pf-esi-setup',
  'salary-add',
  'salary-report',
  'salary-advance-add',
  'salary-advance-close',
  'salary-arrear-add',
  'salary-arrear-release',
  'other-deduction',
  'lop-deduction',
  'tds-add',
  'cheque-payment',
  'security-deposit-add',
  'security-deposit-close',
  'payroll-close',
]);

const LOADERS = {
  'individual-setup': (memberId, fields, audit) => loadIndividualSetup(memberId, audit),
  'cron-setup': (memberId, fields, audit) => loadCronSetup(fields, memberId, audit),
  'stipend-amount-setup': (memberId, fields, audit) => loadStipendAmountSetup(fields, memberId, audit),
  'stipend-deduction-add': (memberId, fields, audit) => loadStipendDeductionSetup(fields, memberId, audit),
  'stipend-payroll-close': (memberId, fields, audit) => loadStipendPayrollClose(fields, memberId, audit),
  'payroll-config': (memberId, fields, audit) => loadPayrollConfigSetup(fields, memberId, audit),
  'pf-esi-setup': (memberId, fields, audit) => loadPfEsiSetup(fields, memberId, audit),
  'salary-add': (memberId, fields, audit) => loadSalaryAddSetup(fields, memberId, audit),
  'salary-report': (memberId, fields, audit) => loadSalaryReportSetup(fields, memberId, audit),
  'salary-advance-add': (memberId, fields, audit) => loadSalaryAdvanceAddSetup(fields, memberId, audit),
  'salary-advance-close': (memberId, fields, audit) => loadSalaryAdvanceCloseSetup(fields, memberId, audit),
  'salary-arrear-add': (memberId, fields, audit) => loadSalaryArrearAddSetup(fields, memberId, audit),
  'salary-arrear-release': (memberId, fields, audit) => loadSalaryArrearReleaseSetup(fields, memberId, audit),
  'other-deduction': (memberId, fields, audit) => loadOtherDeductionSetup(fields, memberId, audit),
  'lop-deduction': (memberId, fields, audit) => loadLopDeductionSetup(fields, memberId, audit),
  'tds-add': (memberId, fields, audit) => loadTdsAddSetup(fields, memberId, audit),
  'cheque-payment': (memberId, fields, audit) => loadChequePaymentSetup(fields, memberId, audit),
  'security-deposit-add': (memberId, fields, audit) => loadSecurityDepositAddSetup(fields, memberId, audit),
  'security-deposit-close': (memberId, fields, audit) => loadSecurityDepositCloseSetup(fields, memberId, audit),
  'payroll-close': (memberId, fields, audit) => loadPayrollCloseSetup(fields, memberId, audit),
};

const SAVERS = {
  'individual-setup': (fields, memberId, files, audit) => saveIndividualSetup(fields, memberId, files, audit),
  'cron-setup': (fields, memberId, _files, audit) => saveCronSetup(fields, memberId, audit),
  'stipend-amount-setup': (fields, memberId, _files, audit) => saveStipendAmountSetup(fields, memberId, audit),
  'stipend-deduction-add': (fields, memberId, _files, audit) => saveStipendDeductionSetup(fields, memberId, audit),
  'stipend-payroll-close': (fields, memberId, _files, audit) => saveStipendPayrollClose(fields, memberId, audit),
  'payroll-config': (fields, memberId, _files, audit) => savePayrollConfigSetup(fields, memberId, audit),
  'pf-esi-setup': (fields, memberId, _files, audit) => savePfEsiSetup(fields, memberId, audit),
  'salary-add': (fields, memberId, _files, audit) => saveSalaryAddSetup(fields, memberId, audit),
  'salary-report': (fields, memberId, _files, audit) => loadSalaryReportSetup(fields, memberId, audit),
  'salary-advance-add': (fields, memberId, files, audit) => saveSalaryAdvanceAddSetup(fields, memberId, files, audit),
  'salary-advance-close': (fields, memberId, files, audit) => saveSalaryAdvanceCloseSetup(fields, memberId, files, audit),
  'salary-arrear-add': (fields, memberId, files, audit) => saveSalaryArrearAddSetup(fields, memberId, files, audit),
  'salary-arrear-release': (fields, memberId, files, audit) => saveSalaryArrearReleaseSetup(fields, memberId, files, audit),
  'other-deduction': (fields, memberId, _files, audit) => saveOtherDeductionSetup(fields, memberId, audit),
  'lop-deduction': (fields, memberId, _files, audit) => saveLopDeductionSetup(fields, memberId, audit),
  'tds-add': (fields, memberId, _files, audit) => saveTdsAddSetup(fields, memberId, audit),
  'cheque-payment': (fields, memberId, _files, audit) => saveChequePaymentSetup(fields, memberId, audit),
  'security-deposit-add': (fields, memberId, files, audit) => saveSecurityDepositAddSetup(fields, memberId, files, audit),
  'security-deposit-close': (fields, memberId, files, audit) => saveSecurityDepositCloseSetup(fields, memberId, files, audit),
  'payroll-close': (fields, memberId, _files, audit) => savePayrollCloseSetup(fields, memberId, audit),
};

export function assertPayrollSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown payroll setup screen' };
  }
  return null;
}

export async function loadPayrollSetupScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertPayrollSetupScreen(screen);
  if (invalid) return invalid;

  const loader = LOADERS[screen];
  const result = await loader(memberId, fields || {}, audit);
  await logBridgeView({
    module: 'payroll',
    screen,
    fields: fields || {},
    memberId,
    ...audit,
  });
  return result;
}

export async function savePayrollSetupScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertPayrollSetupScreen(screen);
  if (invalid) return invalid;

  const saver = SAVERS[screen];
  const result = await saver(fields || {}, memberId, files || [], audit);
  if (!result.error) {
    await logBridgeSave({
      module: 'payroll',
      screen,
      fields: fields || {},
      success: Boolean(result.success),
      memberId,
      ...audit,
    });
  }
  return result;
}

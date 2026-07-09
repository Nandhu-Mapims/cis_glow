import { loadLibraryDashboard, saveLibraryDashboard } from './setup/dashboardSetup.js';
import { loadBookCategorySetup, saveBookCategorySetup } from './setup/bookCategorySetup.js';
import { loadBookAddSetup, saveBookAddSetup } from './setup/bookAddSetup.js';
import { loadBookEditSetup, saveBookEditSetup } from './setup/bookEditSetup.js';
import { loadBookReportSetup, saveBookReportSetup } from './setup/bookReportSetup.js';
import { loadTransactionIssueSetup, saveTransactionIssueSetup } from './setup/transactionIssueSetup.js';
import { loadTransactionReturnSetup, saveTransactionReturnSetup } from './setup/transactionReturnSetup.js';
import { loadEntryReportSetup, saveEntryReportSetup } from './setup/entryReportSetup.js';
import { loadAttendanceSetup, saveAttendanceSetup } from './setup/attendanceSetup.js';
import { loadAttEntrySetup, saveAttEntrySetup } from './setup/attEntrySetup.js';
import { loadAttReportSetup, saveAttReportSetup } from './setup/attReportSetup.js';
import { loadTransactionSetupSetup, saveTransactionSetupSetup } from './setup/transactionSetupSetup.js';
import { loadSupplierAddSetup, saveSupplierAddSetup } from './setup/supplierAddSetup.js';
import { loadSupplierEditSetup, saveSupplierEditSetup } from './setup/supplierEditSetup.js';
import { loadTransactionReportSetup, saveTransactionReportSetup } from './setup/transactionReportSetup.js';
import { loadResourcesReportSetup, saveResourcesReportSetup } from './setup/resourcesReportSetup.js';
import { loadResourcesBarcodeSetup, saveResourcesBarcodeSetup } from './setup/resourcesBarcodeSetup.js';
import { loadResourceTransferSetup, saveResourceTransferSetup } from './setup/resourceTransferSetup.js';

const VALID_SCREENS = new Set([
  'dashboard',
  'book-category',
  'book-add',
  'book-edit',
  'book-report',
  'transaction-issue',
  'transaction-return',
  'transaction-setup',
  'transaction-report',
  'entry-report',
  'attendance',
  'att-entry',
  'att-report',
  'supplier-add',
  'supplier-edit',
  'resources-report',
  'resources-barcode',
  'resource-transfer',
]);

const LOADERS = {
  dashboard: loadLibraryDashboard,
  'book-category': loadBookCategorySetup,
  'book-add': loadBookAddSetup,
  'book-edit': loadBookEditSetup,
  'book-report': loadBookReportSetup,
  'transaction-issue': loadTransactionIssueSetup,
  'transaction-return': loadTransactionReturnSetup,
  'transaction-setup': loadTransactionSetupSetup,
  'transaction-report': loadTransactionReportSetup,
  'entry-report': loadEntryReportSetup,
  attendance: loadAttendanceSetup,
  'att-entry': loadAttEntrySetup,
  'att-report': loadAttReportSetup,
  'supplier-add': loadSupplierAddSetup,
  'supplier-edit': loadSupplierEditSetup,
  'resources-report': loadResourcesReportSetup,
  'resources-barcode': loadResourcesBarcodeSetup,
  'resource-transfer': loadResourceTransferSetup,
};

const SAVERS = {
  dashboard: saveLibraryDashboard,
  'book-category': saveBookCategorySetup,
  'book-add': saveBookAddSetup,
  'book-edit': saveBookEditSetup,
  'book-report': saveBookReportSetup,
  'transaction-issue': saveTransactionIssueSetup,
  'transaction-return': saveTransactionReturnSetup,
  'transaction-setup': saveTransactionSetupSetup,
  'transaction-report': saveTransactionReportSetup,
  'entry-report': saveEntryReportSetup,
  attendance: saveAttendanceSetup,
  'att-entry': saveAttEntrySetup,
  'att-report': saveAttReportSetup,
  'supplier-add': saveSupplierAddSetup,
  'supplier-edit': saveSupplierEditSetup,
  'resources-report': saveResourcesReportSetup,
  'resources-barcode': saveResourcesBarcodeSetup,
  'resource-transfer': saveResourceTransferSetup,
};

export function assertLibrarySetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown library screen' };
  }
  return null;
}

export async function loadLibrarySetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertLibrarySetupScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, { ...fields, ...query }, audit);
}

export async function saveLibrarySetupScreen(screen, fields, memberId, _files = [], audit = {}) {
  const invalid = assertLibrarySetupScreen(screen);
  if (invalid) return invalid;
  return SAVERS[screen](fields || {}, memberId, audit);
}

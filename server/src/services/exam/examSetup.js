import { unportedSetupScreen } from '../shared/unportedScreen.js';
import { loadExamNameSetup, saveExamNameSetup } from './setup/examNameSetup.js';
import { loadOmrConfig, saveOmrConfig } from './setup/omrConfigSetup.js';
import { loadTermExamSetup, saveTermExamSetup } from './setup/termExamSetup.js';
import { loadMarkEntry, saveMarkEntry } from './setup/markEntrySetup.js';
import { loadExamBatch, saveExamBatch } from './setup/examBatchSetup.js';
import { loadExamSchedule, saveExamSchedule } from './setup/examScheduleSetup.js';
import { loadMarkSheet, saveMarkSheet } from './setup/markSheetSetup.js';
import { loadMarksUpload, saveMarksUpload } from './setup/marksUploadSetup.js';
import { loadTermReport } from './reports/termReportCore.js';
import { loadTermStatement } from './reports/termStatementCore.js';
import { loadProgressCard } from './reports/progressCardCore.js';
import { loadSchedulePrint } from './reports/schedulePrintCore.js';
import { loadInvigilatorPrint } from './reports/invigilatorPrintCore.js';
import { loadReportAnalysis } from './reports/reportAnalysisCore.js';
import { loadExamGenericScreen, saveExamGenericScreen } from './setup/examGenericScreen.js';
import { loadExamNodue, saveExamNodue } from './setup/examNodueSetup.js';
import { loadExamExaminers, saveExamExaminers } from './setup/examExaminersSetup.js';
import { loadAttendanceEntry, saveAttendanceEntry } from './setup/attendanceEntrySetup.js';
import { loadExaminerSetup, saveExaminerSetup } from './setup/examinerSetup.js';
import { loadAttendanceReport, saveAttendanceReport } from './reports/attendanceReportCore.js';
import { loadExamAttendanceCertificate, saveExamAttendanceCertificate } from './reports/attendanceCertificateCore.js';
import { loadSheetsStatus, saveSheetsStatus } from './reports/sheetsStatusCore.js';
import {
  loadMarkSheetStatus,
  loadMarkSheetReceived,
  saveMarkSheetStatus,
  saveMarkSheetReceived,
} from './reports/markSheetReportCore.js';
import { loadReportAnalysisV1, saveReportAnalysisV1 } from './reports/reportAnalysisV1Core.js';
import { loadExamSms, saveExamSms } from './setup/examSmsSetup.js';
import { loadSheetsUpload, saveSheetsUpload } from './setup/sheetsUploadSetup.js';
import {
  loadCampActivityType,
  saveCampActivityType,
  loadCampActivityAdd,
  saveCampActivityAdd,
  loadCampActivityEdit,
  saveCampActivityEdit,
} from './setup/campActivitySetup.js';

const VALID_SCREENS = new Set([
  'exam-names',
  'exam-setup',
  'mark-entry',
  'exam-batch',
  'term-report',
  'term-statement',
  'progress-card',
  'mark-sheet',
  'exam-schedule',
  'marks-upload',
  'schedule-print',
  'invigilator-print',
  'report-analysis',
  'omr-config',
  'exam-nodue',
  'exam-examiners',
  'exam-attendance-certificate',
  'examiner-setup',
  'camp-activity-add',
  'camp-activity-edit',
  'camp-activity-type',
  'attendance-entry',
  'attendance-report',
  'sheets-upload',
  'sheets-status',
  'mark-sheet-status',
  'mark-sheet-received',
  'exam-sms',
  'report-analysis-v1',
]);

const NATIVE_SCREENS = new Set([
  'exam-names',
  'exam-setup',
  'omr-config',
  'mark-entry',
  'exam-batch',
  'exam-schedule',
  'marks-upload',
  'mark-sheet',
  'term-report',
  'term-statement',
  'progress-card',
  'schedule-print',
  'invigilator-print',
  'report-analysis',
  'exam-nodue',
  'exam-examiners',
  'exam-attendance-certificate',
  'examiner-setup',
  'camp-activity-add',
  'camp-activity-edit',
  'camp-activity-type',
  'attendance-entry',
  'attendance-report',
  'sheets-upload',
  'sheets-status',
  'mark-sheet-status',
  'mark-sheet-received',
  'exam-sms',
  'report-analysis-v1',
]);

const LOADERS = {
  'exam-names': (memberId, fields, _query, audit) => loadExamNameSetup(memberId, fields, audit),
  'exam-setup': (memberId, fields, _query, audit) => loadTermExamSetup(memberId, fields, audit),
  'omr-config': (memberId, _fields, _query, audit) => loadOmrConfig(memberId, {}, audit),
  'mark-entry': (memberId, fields, _query, audit) => loadMarkEntry(memberId, fields, audit),
  'exam-batch': (memberId, fields, _query, audit) => loadExamBatch(memberId, fields, audit),
  'exam-schedule': (memberId, fields, _query, audit) => loadExamSchedule(memberId, fields, audit),
  'marks-upload': (memberId, fields, _query, audit) => loadMarksUpload(memberId, fields, audit),
  'mark-sheet': (memberId, fields, _query, audit) => loadMarkSheet(memberId, fields, audit),
  'term-report': (memberId, fields, _query, audit) => loadTermReport(memberId, fields, audit),
  'term-statement': (memberId, fields, _query, audit) => loadTermStatement(memberId, fields, audit),
  'progress-card': (memberId, fields, _query, audit) => loadProgressCard(memberId, fields, audit),
  'schedule-print': (memberId, fields, _query, audit) => loadSchedulePrint(memberId, fields, audit),
  'invigilator-print': (memberId, fields, _query, audit) => loadInvigilatorPrint(memberId, fields, audit),
  'report-analysis': (memberId, fields, _query, audit) => loadReportAnalysis(memberId, fields, audit),
  'exam-nodue': (memberId, fields, _query, audit) => loadExamNodue(memberId, fields, audit),
  'exam-examiners': (memberId, fields, _query, audit) => loadExamExaminers(memberId, fields, audit),
  'attendance-entry': (memberId, fields, _query, audit) => loadAttendanceEntry(memberId, fields, audit),
  'examiner-setup': (memberId, fields, _query, audit) => loadExaminerSetup(memberId, fields, audit),
  'attendance-report': (memberId, fields, _query, audit) => loadAttendanceReport(memberId, fields, audit),
  'exam-attendance-certificate': (memberId, fields, _query, audit) => loadExamAttendanceCertificate(memberId, fields, audit),
  'camp-activity-add': (memberId, fields, _query, audit) => loadCampActivityAdd(memberId, fields, audit),
  'camp-activity-edit': (memberId, fields, _query, audit) => loadCampActivityEdit(memberId, fields, audit),
  'camp-activity-type': (memberId, fields, _query, audit) => loadCampActivityType(memberId, fields, audit),
  'sheets-upload': (memberId, fields, _query, audit) => loadSheetsUpload(memberId, fields, audit),
  'sheets-status': (memberId, fields, _query, audit) => loadSheetsStatus(memberId, fields, audit),
  'mark-sheet-status': (memberId, fields, _query, audit) => loadMarkSheetStatus(memberId, fields, audit),
  'mark-sheet-received': (memberId, fields, _query, audit) => loadMarkSheetReceived(memberId, fields, audit),
  'exam-sms': (memberId, fields, _query, audit) => loadExamSms(memberId, fields, audit),
  'report-analysis-v1': (memberId, fields, _query, audit) => loadReportAnalysisV1(memberId, fields, audit),
};

const SAVERS = {
  'exam-names': (fields, memberId, _files, audit) => saveExamNameSetup(fields, memberId, audit),
  'exam-setup': (fields, memberId, _files, audit) => saveTermExamSetup(fields, memberId, audit),
  'omr-config': (fields, memberId, _files, audit) => saveOmrConfig(fields, memberId, audit),
  'mark-entry': (fields, memberId, _files, audit) => saveMarkEntry(fields, memberId, audit),
  'exam-batch': (fields, memberId, _files, audit) => saveExamBatch(fields, memberId, audit),
  'exam-schedule': (fields, memberId, _files, audit) => saveExamSchedule(fields, memberId, audit),
  'marks-upload': (fields, memberId, files, audit) => saveMarksUpload(fields, memberId, files, audit),
  'mark-sheet': (fields, memberId, _files, audit) => saveMarkSheet(fields, memberId, audit),
  'exam-nodue': (fields, memberId, _files, audit) => saveExamNodue(fields, memberId, audit),
  'exam-examiners': (fields, memberId, _files, audit) => saveExamExaminers(fields, memberId, audit),
  'attendance-entry': (fields, memberId, _files, audit) => saveAttendanceEntry(fields, memberId, audit),
  'examiner-setup': (fields, memberId, _files, audit) => saveExaminerSetup(fields, memberId, audit),
  'camp-activity-add': (fields, memberId, files, audit) => saveCampActivityAdd(fields, memberId, files, audit),
  'camp-activity-edit': (fields, memberId, files, audit) => saveCampActivityEdit(fields, memberId, files, audit),
  'camp-activity-type': (fields, memberId) => saveCampActivityType(fields, memberId),
  'sheets-upload': (fields, memberId, files, audit) => saveSheetsUpload(fields, memberId, files, audit),
  'exam-sms': (fields, memberId, _files, audit) => saveExamSms(fields, memberId, audit),
};

export function assertExamSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown exam screen' };
  }
  return null;
}

export async function loadExamSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertExamSetupScreen(screen);
  if (invalid) return invalid;

  if (NATIVE_SCREENS.has(screen)) {
    const loader = LOADERS[screen];
    return loader(memberId, fields || {}, query || {}, audit);
  }

  return unportedSetupScreen('exam', screen);
}

export async function saveExamSetupScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertExamSetupScreen(screen);
  if (invalid) return invalid;

  if (NATIVE_SCREENS.has(screen)) {
    const saver = SAVERS[screen];
    if (!saver) {
      return { success: false, message: 'This screen is read-only' };
    }
    return saver(fields || {}, memberId, files || [], audit);
  }

  return unportedSetupScreen('exam', screen);
}

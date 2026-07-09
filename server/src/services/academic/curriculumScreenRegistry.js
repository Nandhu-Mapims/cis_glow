import { loadBatchColor, saveBatchColor } from './curriculum/setup/batchColorSetup.js';
import { loadFeedbackTopic, saveFeedbackTopic } from './curriculum/setup/feedbackTopicSetup.js';
import { loadPeriodSetup, savePeriodSetup } from './curriculum/setup/periodSetupSetup.js';
import { loadInternshipSchedule, saveInternshipSchedule } from './curriculum/setup/internshipScheduleSetup.js';
import {
  loadFeedbackConfigUg,
  saveFeedbackConfigUg,
  loadFeedbackConfigPg,
  saveFeedbackConfigPg,
} from './curriculum/setup/feedbackConfigSetup.js';
import { loadTtConfigV3, saveTtConfigV3 } from './curriculum/setup/ttConfigV3Setup.js';
import { loadSubjectDashboardReport, saveSubjectDashboardReport } from './curriculum/reports/subjectDashboardReport.js';
import { loadSubjectScheduleReportSetup, saveSubjectScheduleReportSetup } from './curriculum/reports/subjectScheduleReportSetup.js';
import { loadSubjectTimingReport, saveSubjectTimingReport } from './curriculum/reports/subjectTimingReport.js';
import { loadFeedbackDashboardReport, saveFeedbackDashboardReport } from './curriculum/reports/feedbackDashboardReport.js';
import { loadClassTimetableReport, saveClassTimetableReport } from './curriculum/reports/classTimetableReport.js';
import { loadClassTimetableV3Report, saveClassTimetableV3Report } from './curriculum/reports/classTimetableV3Report.js';
import { loadFeedbackReportUg, saveFeedbackReportUg } from './curriculum/reports/feedbackReportUg.js';
import { loadFeedbackReportPg, saveFeedbackReportPg } from './curriculum/reports/feedbackReportPg.js';
import { loadSubjectHandleReport, saveSubjectHandleReport } from './curriculum/reports/subjectHandleReport.js';
import { loadStaffPeriodCompletedReport, saveStaffPeriodCompletedReport } from './curriculum/reports/staffPeriodCompletedReport.js';
import { loadDepartmentPeriodCompletedReport, saveDepartmentPeriodCompletedReport } from './curriculum/reports/departmentPeriodCompletedReport.js';
import { loadSubjectHandleGridReport, saveSubjectHandleGridReport } from './curriculum/reports/subjectHandleGridReport.js';

export const CURRICULUM_SCREEN_SLUGS = [
  'batch-color',
  'feedback-topics',
  'period-setup',
  'internship-schedule',
  'feedback-config-ug',
  'feedback-config-pg',
  'tt-config-v3',
  'subject-dashboard',
  'subject-schedule-report',
  'subject-timing',
  'feedback-dashboard',
  'class-timetable',
  'class-timetable-v3',
  'feedback-report-ug',
  'feedback-report-pg',
  'subject-handle',
  'staff-period-completed',
  'department-period-completed',
  'subject-handle-grid',
];

export const CURRICULUM_LOADERS = {
  'batch-color': (m, f, _q, a) => loadBatchColor(m, f, a),
  'feedback-topics': (m, f, _q, a) => loadFeedbackTopic(m, f, a),
  'period-setup': (m, f, _q, a) => loadPeriodSetup(m, f, a),
  'internship-schedule': (m, f, _q, a) => loadInternshipSchedule(m, f, a),
  'feedback-config-ug': (m, f, _q, a) => loadFeedbackConfigUg(m, f, a),
  'feedback-config-pg': (m, f, _q, a) => loadFeedbackConfigPg(m, f, a),
  'tt-config-v3': (m, f, _q, a) => loadTtConfigV3(m, f, a),
  'subject-dashboard': (m, f, _q, a) => loadSubjectDashboardReport(m, f, a),
  'subject-schedule-report': (m, f, _q, a) => loadSubjectScheduleReportSetup(m, f, a),
  'subject-timing': (m, f, _q, a) => loadSubjectTimingReport(m, f, a),
  'feedback-dashboard': (m, f, _q, a) => loadFeedbackDashboardReport(m, f, a),
  'class-timetable': (m, f, _q, a) => loadClassTimetableReport(m, f, a),
  'class-timetable-v3': (m, f, _q, a) => loadClassTimetableV3Report(m, f, a),
  'feedback-report-ug': (m, f, _q, a) => loadFeedbackReportUg(m, f, a),
  'feedback-report-pg': (m, f, _q, a) => loadFeedbackReportPg(m, f, a),
  'subject-handle': (m, f, _q, a) => loadSubjectHandleReport(m, f, a),
  'staff-period-completed': (m, f, _q, a) => loadStaffPeriodCompletedReport(m, f, a),
  'department-period-completed': (m, f, _q, a) => loadDepartmentPeriodCompletedReport(m, f, a),
  'subject-handle-grid': (m, f, _q, a) => loadSubjectHandleGridReport(m, f, a),
};

export const CURRICULUM_SAVERS = {
  'batch-color': (f, m, _files, a) => saveBatchColor(f, m, a),
  'feedback-topics': (f, m, _files, a) => saveFeedbackTopic(f, m, a),
  'period-setup': (f, m, _files, a) => savePeriodSetup(f, m, a),
  'internship-schedule': (f, m, _files, a) => saveInternshipSchedule(f, m, a),
  'feedback-config-ug': (f, m, _files, a) => saveFeedbackConfigUg(f, m, a),
  'feedback-config-pg': (f, m, _files, a) => saveFeedbackConfigPg(f, m, a),
  'tt-config-v3': (f, m, _files, a) => saveTtConfigV3(f, m, a),
  'subject-dashboard': (f, m, _files, a) => saveSubjectDashboardReport(m, f, a),
  'subject-schedule-report': (f, m, _files, a) => saveSubjectScheduleReportSetup(m, f, a),
  'subject-timing': (f, m, _files, a) => saveSubjectTimingReport(m, f, a),
  'feedback-dashboard': (f, m, _files, a) => saveFeedbackDashboardReport(m, f, a),
  'class-timetable': (f, m, _files, a) => saveClassTimetableReport(m, f, a),
  'class-timetable-v3': (f, m, _files, a) => saveClassTimetableV3Report(m, f, a),
  'feedback-report-ug': (f, m, _files, a) => saveFeedbackReportUg(m, f, a),
  'feedback-report-pg': (f, m, _files, a) => saveFeedbackReportPg(m, f, a),
  'subject-handle': (f, m, _files, a) => saveSubjectHandleReport(m, f, a),
  'staff-period-completed': (f, m, _files, a) => saveStaffPeriodCompletedReport(m, f, a),
  'department-period-completed': (f, m, _files, a) => saveDepartmentPeriodCompletedReport(m, f, a),
  'subject-handle-grid': (f, m, _files, a) => saveSubjectHandleGridReport(m, f, a),
};

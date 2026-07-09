import { loadCommitteeDashboard, loadCommitteeDashboardDetails, saveCommitteeDashboard } from './committeeDashboard.js';
import { loadCommitteeAdd, saveCommitteeAdd, loadCommitteeEdit, saveCommitteeEdit, loadCommitteeReport, saveCommitteeReport } from './committeeCrud.js';
import { loadCommitteeMember, saveCommitteeMember } from './committeeMember.js';
import { loadCommitteeDesignation, saveCommitteeDesignation, loadCommitteeEventType, saveCommitteeEventType } from './committeeMasterSetup.js';
import { loadCommitteeRowSetup, saveCommitteeRowSetup } from './committeeRowSetup.js';
import { loadCommitteeTaskCategory, saveCommitteeTaskCategory } from './committeeCategory.js';
import { loadCommitteeColour, saveCommitteeColour, loadCommitteeTimesheet, saveCommitteeTimesheet } from './committeeProjectSetup.js';
import { loadCommitteeClientAdd, saveCommitteeClientAdd, loadCommitteeClientEdit, saveCommitteeClientEdit } from './committeeClient.js';
import {
  loadCommitteeApproveEvent, saveCommitteeApproveEvent,
  loadCommitteeApproveReschedule, saveCommitteeApproveReschedule,
  loadCommitteeApproveEventReport, saveCommitteeApproveEventReport,
  loadCommitteeTvEvent, saveCommitteeTvEvent,
  loadCommitteeTvPrint, saveCommitteeTvPrint,
} from './committeeEvents.js';
import {
  loadCommitteeTaskDashboard, saveCommitteeTaskDashboard,
  loadCommitteeTaskAllocation, saveCommitteeTaskAllocation,
  loadCommitteeTaskDocument, saveCommitteeTaskDocument,
  loadCommitteeTaskBudget, saveCommitteeTaskBudget,
} from './committeeTasks.js';
import { loadCommitteeTaskManageReport, saveCommitteeTaskManageReport } from './committeeTaskManageReport.js';

const VALID_SCREENS = new Set([
  'dashboard',
  'committee-report',
  'committee-add',
  'committee-edit',
  'committee-member',
  'designation',
  'event-type',
  'task-category',
  'client-add',
  'client-edit',
  'task-colour',
  'task-type',
  'task-wtype',
  'task-participator',
  'task-misc',
  'task-doc-type',
  'task-time-sheet',
  'task-budget-expenses',
  'task-event-org',
  'task-dashboard',
  'task-allocation',
  'task-allocation-v2',
  'task-manage-report',
  'task-document',
  'task-budget-approved',
  'approve-event',
  'approve-event-report',
  'approve-reschedule',
  'tv-academic-event',
  'tv-academic-print',
]);

export const NATIVE_SCREENS = VALID_SCREENS;

const LOADERS = {
  dashboard: (m, f, _q, a) => (f.flag ? loadCommitteeDashboardDetails(m, f, a) : loadCommitteeDashboard(m, f, a)),
  'committee-report': loadCommitteeReport,
  'committee-add': loadCommitteeAdd,
  'committee-edit': loadCommitteeEdit,
  'committee-member': loadCommitteeMember,
  designation: loadCommitteeDesignation,
  'event-type': loadCommitteeEventType,
  'task-category': loadCommitteeTaskCategory,
  'client-add': loadCommitteeClientAdd,
  'client-edit': loadCommitteeClientEdit,
  'task-colour': loadCommitteeColour,
  'task-type': (m, f, _q, a) => loadCommitteeRowSetup('task-type', m, f, a),
  'task-wtype': (m, f, _q, a) => loadCommitteeRowSetup('task-wtype', m, f, a),
  'task-participator': (m, f, _q, a) => loadCommitteeRowSetup('task-participator', m, f, a),
  'task-misc': (m, f, _q, a) => loadCommitteeRowSetup('task-misc', m, f, a),
  'task-doc-type': (m, f, _q, a) => loadCommitteeRowSetup('task-doc-type', m, f, a),
  'task-budget-expenses': (m, f, _q, a) => loadCommitteeRowSetup('task-budget-expenses', m, f, a),
  'task-event-org': (m, f, _q, a) => loadCommitteeRowSetup('task-event-org', m, f, a),
  'task-time-sheet': loadCommitteeTimesheet,
  'task-dashboard': loadCommitteeTaskDashboard,
  'task-allocation': loadCommitteeTaskAllocation,
  'task-allocation-v2': loadCommitteeTaskAllocation,
  'task-manage-report': (m, f, _q, a) => loadCommitteeTaskManageReport(m, f, a),
  'task-document': loadCommitteeTaskDocument,
  'task-budget-approved': loadCommitteeTaskBudget,
  'approve-event': loadCommitteeApproveEvent,
  'approve-event-report': loadCommitteeApproveEventReport,
  'approve-reschedule': loadCommitteeApproveReschedule,
  'tv-academic-event': loadCommitteeTvEvent,
  'tv-academic-print': loadCommitteeTvPrint,
};

const SAVERS = {
  dashboard: saveCommitteeDashboard,
  'committee-report': saveCommitteeReport,
  'committee-add': (f, m, files, a) => saveCommitteeAdd(f, m, files, a),
  'committee-edit': (f, m, files, a) => saveCommitteeEdit(f, m, files, a),
  'committee-member': saveCommitteeMember,
  designation: saveCommitteeDesignation,
  'event-type': saveCommitteeEventType,
  'task-category': saveCommitteeTaskCategory,
  'client-add': (f, m, files, a) => saveCommitteeClientAdd(f, m, files, a),
  'client-edit': (f, m, files, a) => saveCommitteeClientEdit(f, m, files, a),
  'task-colour': saveCommitteeColour,
  'task-type': (f, m, _files, a) => saveCommitteeRowSetup('task-type', f, m, a),
  'task-wtype': (f, m, _files, a) => saveCommitteeRowSetup('task-wtype', f, m, a),
  'task-participator': (f, m, _files, a) => saveCommitteeRowSetup('task-participator', f, m, a),
  'task-misc': (f, m, _files, a) => saveCommitteeRowSetup('task-misc', f, m, a),
  'task-doc-type': (f, m, _files, a) => saveCommitteeRowSetup('task-doc-type', f, m, a),
  'task-budget-expenses': (f, m, _files, a) => saveCommitteeRowSetup('task-budget-expenses', f, m, a),
  'task-event-org': (f, m, _files, a) => saveCommitteeRowSetup('task-event-org', f, m, a),
  'task-time-sheet': saveCommitteeTimesheet,
  'task-dashboard': saveCommitteeTaskDashboard,
  'task-allocation': saveCommitteeTaskAllocation,
  'task-allocation-v2': saveCommitteeTaskAllocation,
  'task-manage-report': saveCommitteeTaskManageReport,
  'task-document': (f, m, files, a) => saveCommitteeTaskDocument(f, m, files, a),
  'task-budget-approved': saveCommitteeTaskBudget,
  'approve-event': saveCommitteeApproveEvent,
  'approve-event-report': saveCommitteeApproveEventReport,
  'approve-reschedule': saveCommitteeApproveReschedule,
  'tv-academic-event': saveCommitteeTvEvent,
  'tv-academic-print': saveCommitteeTvPrint,
};

export function assertCommitteeScreen(screen) {
  if (!VALID_SCREENS.has(screen)) return { error: 'Unknown committee screen' };
  return null;
}

export async function loadCommitteeScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertCommitteeScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, fields, query, audit);
}

export async function saveCommitteeScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertCommitteeScreen(screen);
  if (invalid) return invalid;
  return SAVERS[screen](fields, memberId, files, audit);
}

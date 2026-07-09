import { createSetupApi } from '../../hooks/createSetupApi';
import { createModuleHub, createModuleSetupHub, createModuleSetupPage } from '../../components/ModuleSetupFactory';
import { COMMITTEE_SCREEN_META } from './committeeSetupMeta';
import {
  ApproveEventReportScreen,
  ApproveEventScreen,
  ApproveRescheduleScreen,
  ClientFormScreen,
  ColourSetupScreen,
  CommitteeAddScreen,
  CommitteeDashboardScreen,
  CommitteeEditScreen,
  CommitteeMemberScreen,
  CommitteeReportScreen,
  DesignationScreen,
  EventTypeScreen,
  TaskAllocationScreen,
  TaskBudgetExpensesScreen,
  TaskBudgetScreen,
  TaskCategoryScreen,
  TaskDashboardScreen,
  TaskDocTypeScreen,
  TaskDocumentScreen,
  TaskEventOrgScreen,
  TaskManageReportScreen,
  TaskMiscScreen,
  TaskParticipatorScreen,
  TaskTypeScreen,
  TaskWtypeScreen,
  TimesheetSetupScreen,
  TvAcademicEventScreen,
  TvAcademicPrintScreen,
} from './setup/CommitteeScreens';

export const useCommitteeSetupApi = createSetupApi('/api/committee');

const COMPONENTS = {
  dashboard: CommitteeDashboardScreen,
  'committee-report': CommitteeReportScreen,
  'committee-add': CommitteeAddScreen,
  'committee-edit': CommitteeEditScreen,
  'committee-member': CommitteeMemberScreen,
  designation: DesignationScreen,
  'event-type': EventTypeScreen,
  'task-category': TaskCategoryScreen,
  'client-add': (props) => <ClientFormScreen {...props} isEdit={false} />,
  'client-edit': (props) => <ClientFormScreen {...props} isEdit />,
  'task-colour': ColourSetupScreen,
  'task-type': TaskTypeScreen,
  'task-wtype': TaskWtypeScreen,
  'task-participator': TaskParticipatorScreen,
  'task-misc': TaskMiscScreen,
  'task-doc-type': TaskDocTypeScreen,
  'task-time-sheet': TimesheetSetupScreen,
  'task-budget-expenses': TaskBudgetExpensesScreen,
  'task-event-org': TaskEventOrgScreen,
  'task-dashboard': TaskDashboardScreen,
  'task-allocation': TaskAllocationScreen,
  'task-allocation-v2': TaskAllocationScreen,
  'task-manage-report': TaskManageReportScreen,
  'task-document': TaskDocumentScreen,
  'task-budget-approved': TaskBudgetScreen,
  'approve-event': ApproveEventScreen,
  'approve-event-report': ApproveEventReportScreen,
  'approve-reschedule': ApproveRescheduleScreen,
  'tv-academic-event': TvAcademicEventScreen,
  'tv-academic-print': TvAcademicPrintScreen,
};

export const CommitteeSetupPage = createModuleSetupPage({
  moduleTitle: 'Committee',
  hubPath: '/committee/setup',
  metaMap: COMMITTEE_SCREEN_META,
  components: COMPONENTS,
  useSetupApi: useCommitteeSetupApi,
});

export const CommitteeHub = createModuleHub({ title: 'Committee', basePath: '/committee', metaMap: COMMITTEE_SCREEN_META });
export const CommitteeSetupHub = createModuleSetupHub({ title: 'Committee', basePath: '/committee', metaMap: COMMITTEE_SCREEN_META, parentPath: '/committee' });

export default CommitteeSetupPage;

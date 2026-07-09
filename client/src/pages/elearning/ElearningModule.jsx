import { createSetupApi } from '../../hooks/createSetupApi';
import { createModuleHub, createModuleSetupHub, createModuleSetupPage } from '../../components/ModuleSetupFactory';
import { ELEARNING_SCREEN_META } from './elearningSetupMeta';
import {
  ElearnReportScreen,
  ElearnSetupScreen,
  SubjectReportScreen,
  SubjectTestScreen,
} from './setup/ElearningScreens';

export const useElearningSetupApi = createSetupApi('/api/elearning');

const COMPONENTS = {
  'elearn-dashboard': ElearnReportScreen,
  'elearn-setup': ElearnSetupScreen,
  'elearn-report': ElearnReportScreen,
  'subject-test': SubjectTestScreen,
  'subject-report': SubjectReportScreen,
};

export const ElearningSetupPage = createModuleSetupPage({
  moduleTitle: 'E-Learning',
  hubPath: '/elearning/setup',
  metaMap: ELEARNING_SCREEN_META,
  components: COMPONENTS,
  useSetupApi: useElearningSetupApi,
});

export const ElearningHub = createModuleHub({
  title: 'E-Learning',
  basePath: '/elearning',
  metaMap: ELEARNING_SCREEN_META,
  dashboardPath: '/elearning/dashboard',
});

export const ElearningSetupHub = createModuleSetupHub({
  title: 'E-Learning',
  basePath: '/elearning',
  metaMap: ELEARNING_SCREEN_META,
  parentPath: '/elearning',
});

export { ElearnDashboardPage } from './setup/ElearningScreens';
export default ElearningSetupPage;

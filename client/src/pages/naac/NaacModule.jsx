import { createSetupApi } from '../../hooks/createSetupApi';
import { createModuleHub, createModuleSetupHub, createModuleSetupPage } from '../../components/ModuleSetupFactory';
import { NAAC_SCREEN_META } from './naacSetupMeta';
import { NaacQualScreen, NaacQuanDetailedReportScreen, NaacQuanReportScreen, NaacQuanScreen } from './setup/NaacScreens';

export const useNaacSetupApi = createSetupApi('/api/naac');

const COMPONENTS = {
  qual: NaacQualScreen,
  quan: NaacQuanScreen,
  'quan-report': NaacQuanReportScreen,
  'quan-detailed-report': NaacQuanDetailedReportScreen,
};

export const NaacSetupPage = createModuleSetupPage({
  moduleTitle: 'NAAC',
  hubPath: '/naac/setup',
  metaMap: NAAC_SCREEN_META,
  components: COMPONENTS,
  useSetupApi: useNaacSetupApi,
});

export const NaacHub = createModuleHub({ title: 'NAAC', basePath: '/naac', metaMap: NAAC_SCREEN_META });
export const NaacSetupHub = createModuleSetupHub({ title: 'NAAC', basePath: '/naac', metaMap: NAAC_SCREEN_META, parentPath: '/naac' });

export default NaacSetupPage;

import { createSetupApi } from '../../hooks/createSetupApi';
import { createModuleHub, createModuleSetupHub, createModuleSetupPage } from '../../components/ModuleSetupFactory';
import { WEB_SCREEN_META } from './webSetupMeta';
import WebPageScreen from './setup/WebPageScreen';
import WebSliderScreen from './setup/WebSliderScreen';
import WebStaffDisplayScreen from './setup/WebStaffDisplayScreen';
import WebPhotosAddScreen from './setup/WebPhotosAddScreen';
import WebPhotosEditScreen from './setup/WebPhotosEditScreen';
import WebDocUploadScreen from './setup/WebDocUploadScreen';
import { WebResearchAddScreen, WebResearchEditScreen } from './setup/WebResearchScreen';
import { WebEventAddScreen, WebEventEditScreen, WebEventTypeScreen } from './setup/WebEventsScreen';

export const useWebSetupApi = createSetupApi('/api/web');

const COMPONENTS = {
  'about-us': WebPageScreen,
  departments: WebPageScreen,
  lms: WebPageScreen,
  journal: WebPageScreen,
  facilities: WebPageScreen,
  aaadar: WebPageScreen,
  research: WebPageScreen,
  academic: WebPageScreen,
  iqac: WebPageScreen,
  outreach: WebPageScreen,
  'slider-animation': WebSliderScreen,
  'photos-add': WebPhotosAddScreen,
  'photos-edit': WebPhotosEditScreen,
  'staff-display-order': WebStaffDisplayScreen,
  'doc-upload': WebDocUploadScreen,
  'research-program-add': WebResearchAddScreen,
  'research-program-edit': WebResearchEditScreen,
  'event-add': WebEventAddScreen,
  'event-edit': WebEventEditScreen,
  'event-type': WebEventTypeScreen,
};

export const WebSetupPage = createModuleSetupPage({
  moduleTitle: 'Web CMS',
  hubPath: '/web/setup',
  metaMap: WEB_SCREEN_META,
  components: COMPONENTS,
  useSetupApi: useWebSetupApi,
});

export const WebHub = createModuleHub({ title: 'Web CMS', basePath: '/web', metaMap: WEB_SCREEN_META });
export const WebSetupHub = createModuleSetupHub({ title: 'Web CMS', basePath: '/web', metaMap: WEB_SCREEN_META, parentPath: '/web' });

export default WebSetupPage;

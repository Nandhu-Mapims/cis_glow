import { createSetupApi } from '../../hooks/createSetupApi';
import { createModuleHub, createModuleSetupHub, createModuleSetupPage } from '../../components/ModuleSetupFactory';
import { TV_SCREEN_META } from './tvSetupMeta';
import {
  TvAccessScreen,
  TvApiGalleryScreen,
  TvLiveVideoScreen,
  TvPhotoGalleryScreen,
  TvPrintStyleScreen,
  TvSliderAccessScreen,
  TvSliderConfigScreen,
  TvSliderWidgetScreen,
  TvVideoScreen,
  TvYoutubeScreen,
} from './setup/TvScreens';

export const useTvSetupApi = createSetupApi('/api/tv');

const COMPONENTS = {
  'slider-widget': TvSliderWidgetScreen,
  'slider-config': TvSliderConfigScreen,
  'dashboard-access': TvAccessScreen,
  'slider-access': TvSliderAccessScreen,
  'photo-gallery': TvPhotoGalleryScreen,
  'video-gallery': TvVideoScreen,
  'api-gallery': TvApiGalleryScreen,
  'youtube-gallery': TvYoutubeScreen,
  'live-video': TvLiveVideoScreen,
  'print-style': TvPrintStyleScreen,
};

export const TvSetupPage = createModuleSetupPage({
  moduleTitle: 'TV',
  hubPath: '/tv/setup',
  metaMap: TV_SCREEN_META,
  components: COMPONENTS,
  useSetupApi: useTvSetupApi,
});

export const TvHub = createModuleHub({ title: 'TV', basePath: '/tv', metaMap: TV_SCREEN_META, dashboardPath: '/tv/dashboard' });
export const TvSetupHub = createModuleSetupHub({ title: 'TV', basePath: '/tv', metaMap: TV_SCREEN_META, parentPath: '/tv' });

export default TvSetupPage;

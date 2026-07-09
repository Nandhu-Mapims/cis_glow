import { loadTvDashboard } from './tvDashboard.js';
import { loadTvSliderWidget, saveTvSliderWidget } from './tvSliderWidget.js';
import { loadTvSliderConfig, saveTvSliderConfig } from './tvSliderConfig.js';
import { loadTvDashboardAccess, saveTvDashboardAccess } from './tvDashboardAccess.js';
import { loadTvSliderAccess, saveTvSliderAccess } from './tvSliderAccess.js';
import { loadTvVideoGallery, saveTvVideoGallery } from './tvVideoGallery.js';
import { loadTvPhotoGallery, saveTvPhotoGallery } from './tvPhotoGallery.js';
import { loadTvApiGallery, saveTvApiGallery } from './tvApiGallery.js';
import {
  loadTvYoutubeGallery,
  saveTvYoutubeGallery,
  loadTvLiveVideo,
  saveTvLiveVideo,
  loadTvPrintStyle,
  saveTvPrintStyle,
} from './tvExtraSetup.js';

const VALID_SCREENS = new Set([
  'slider-widget',
  'slider-config',
  'dashboard-access',
  'slider-access',
  'photo-gallery',
  'video-gallery',
  'api-gallery',
  'youtube-gallery',
  'live-video',
  'print-style',
]);

export const NATIVE_SCREENS = VALID_SCREENS;

const LOADERS = {
  'slider-widget': (m, f, _q, a) => loadTvSliderWidget(m, f, a),
  'slider-config': (m, f, _q, a) => loadTvSliderConfig(m, f, a),
  'dashboard-access': (m, f, _q, a) => loadTvDashboardAccess(m, f, a),
  'slider-access': (m, f, _q, a) => loadTvSliderAccess(m, f, a),
  'photo-gallery': (m, f, _q, a) => loadTvPhotoGallery(m, f, a),
  'video-gallery': (m, f, _q, a) => loadTvVideoGallery(m, f, a),
  'api-gallery': (m, f, _q, a) => loadTvApiGallery(m, f, a),
  'youtube-gallery': (m, f, _q, a) => loadTvYoutubeGallery(m, f, a),
  'live-video': (m, f, _q, a) => loadTvLiveVideo(m, f, a),
  'print-style': (m, f, _q, a) => loadTvPrintStyle(m, f, a),
};

const SAVERS = {
  'slider-widget': (f, m, files, a) => saveTvSliderWidget(f, m, a),
  'slider-config': (f, m, files, a) => saveTvSliderConfig({ ...f, files }, m, a),
  'dashboard-access': (f, m, _files, a) => saveTvDashboardAccess(f, m, a),
  'slider-access': (f, m, _files, a) => saveTvSliderAccess(f, m, a),
  'photo-gallery': (f, m, files, a) => saveTvPhotoGallery({ ...f, files: files.length ? files : f.files }, m, a),
  'video-gallery': (f, m, _files, a) => saveTvVideoGallery(f, m, a),
  'api-gallery': (f, m, _files, a) => saveTvApiGallery(f, m, a),
  'youtube-gallery': (f, m, _files, a) => saveTvYoutubeGallery(f, m, a),
  'live-video': (f, m, files, a) => saveTvLiveVideo({ ...f, files: files.length ? files : f.files }, m, a),
  'print-style': (f, m, _files, a) => saveTvPrintStyle(f, m, a),
};

export function assertTvScreen(screen) {
  if (!VALID_SCREENS.has(screen)) return { error: 'Unknown TV screen' };
  return null;
}

export async function loadTvScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertTvScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, fields, query, audit);
}

export async function saveTvScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertTvScreen(screen);
  if (invalid) return invalid;
  return SAVERS[screen](fields, memberId, files, audit);
}

export { loadTvDashboard };

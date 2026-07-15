import {
  DEFAULT_SIDEBAR_MODE,
  DEFAULT_THEME_ID,
  SIDEBAR_MODES,
  THEME_PRESETS,
  THEME_STORAGE_KEY,
} from './themePresets.js';
import {
  buildCustomThemeVars,
  CUSTOM_THEME_ID,
  DEFAULT_CUSTOM_COLORS,
  sanitizeCustomColors,
} from './themeColorUtils.js';

export function readStoredTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return {
        themeId: DEFAULT_THEME_ID,
        sidebarMode: DEFAULT_SIDEBAR_MODE,
        customColors: { ...DEFAULT_CUSTOM_COLORS },
      };
    }
    const parsed = JSON.parse(raw);
    const themeId = parsed.themeId === CUSTOM_THEME_ID || THEME_PRESETS[parsed.themeId]
      ? parsed.themeId
      : DEFAULT_THEME_ID;
    const sidebarMode = parsed.sidebarMode === 'light' ? 'light' : 'dark';
    const customColors = sanitizeCustomColors(parsed.custom || DEFAULT_CUSTOM_COLORS);
    return { themeId, sidebarMode, customColors };
  } catch {
    return {
      themeId: DEFAULT_THEME_ID,
      sidebarMode: DEFAULT_SIDEBAR_MODE,
      customColors: { ...DEFAULT_CUSTOM_COLORS },
    };
  }
}

export function writeStoredTheme(themeId, sidebarMode, customColors) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({
      themeId,
      sidebarMode,
      custom: sanitizeCustomColors(customColors),
    }));
  } catch {
    // ignore quota errors
  }
}

function resolveThemeVars(themeId, customColors) {
  if (themeId === CUSTOM_THEME_ID) {
    return buildCustomThemeVars(customColors);
  }
  const preset = THEME_PRESETS[themeId] || THEME_PRESETS[DEFAULT_THEME_ID];
  return preset.vars;
}

export function applyThemeToDocument(themeId, sidebarMode, customColors = DEFAULT_CUSTOM_COLORS) {
  const root = document.documentElement;
  const mode = sidebarMode === 'light' ? 'light' : 'dark';
  const vars = resolveThemeVars(themeId, customColors);

  root.setAttribute('data-cis-theme', themeId);
  root.setAttribute('data-cis-sidebar', mode);

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  Object.entries(SIDEBAR_MODES[mode]).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function initThemeFromStorage() {
  const { themeId, sidebarMode, customColors } = readStoredTheme();
  applyThemeToDocument(themeId, sidebarMode, customColors);
}

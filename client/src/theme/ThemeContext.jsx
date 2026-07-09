import {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';
import { applyThemeToDocument, readStoredTheme, writeStoredTheme } from './applyTheme.js';
import {
  CUSTOM_THEME_ID,
  DEFAULT_CUSTOM_COLORS,
  sanitizeCustomColors,
} from './themeColorUtils.js';
import { DEFAULT_SIDEBAR_MODE, DEFAULT_THEME_ID, THEME_PRESETS } from './themePresets.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const stored = readStoredTheme();
  const [themeId, setThemeId] = useState(stored.themeId || DEFAULT_THEME_ID);
  const [sidebarMode, setSidebarMode] = useState(stored.sidebarMode || DEFAULT_SIDEBAR_MODE);
  const [customColors, setCustomColorsState] = useState(
    stored.customColors || { ...DEFAULT_CUSTOM_COLORS },
  );

  const applyAll = useCallback((nextThemeId, nextSidebarMode, nextCustomColors) => {
    const id = nextThemeId === CUSTOM_THEME_ID || THEME_PRESETS[nextThemeId]
      ? nextThemeId
      : DEFAULT_THEME_ID;
    const mode = nextSidebarMode === 'light' ? 'light' : 'dark';
    const colors = sanitizeCustomColors(nextCustomColors);
    setThemeId(id);
    setSidebarMode(mode);
    setCustomColorsState(colors);
    applyThemeToDocument(id, mode, colors);
    writeStoredTheme(id, mode, colors);
  }, []);

  const setTheme = useCallback((id) => {
    applyAll(id, sidebarMode, customColors);
  }, [applyAll, sidebarMode, customColors]);

  const setSidebar = useCallback((mode) => {
    applyAll(themeId, mode, customColors);
  }, [applyAll, themeId, customColors]);

  const setCustomColors = useCallback((partial) => {
    const next = sanitizeCustomColors({ ...customColors, ...partial });
    applyAll(CUSTOM_THEME_ID, sidebarMode, next);
  }, [applyAll, customColors, sidebarMode]);

  const resetTheme = useCallback(() => {
    applyAll(DEFAULT_THEME_ID, DEFAULT_SIDEBAR_MODE, { ...DEFAULT_CUSTOM_COLORS });
  }, [applyAll]);

  const preset = useMemo(() => {
    if (themeId === CUSTOM_THEME_ID) {
      return {
        id: CUSTOM_THEME_ID,
        label: 'Custom theme',
        description: 'Your personalized colors',
        swatches: [
          customColors.primary,
          customColors.accent,
          customColors.shellBg,
          customColors.pageBg,
        ],
      };
    }
    return THEME_PRESETS[themeId];
  }, [themeId, customColors]);

  const value = useMemo(() => ({
    themeId,
    sidebarMode,
    customColors,
    preset,
    isCustom: themeId === CUSTOM_THEME_ID,
    setTheme,
    setSidebar,
    setCustomColors,
    resetTheme,
  }), [
    themeId,
    sidebarMode,
    customColors,
    preset,
    setTheme,
    setSidebar,
    setCustomColors,
    resetTheme,
  ]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

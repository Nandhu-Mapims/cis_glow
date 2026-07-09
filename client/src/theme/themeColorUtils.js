export const CUSTOM_THEME_ID = 'custom';

export const DEFAULT_CUSTOM_COLORS = {
  primary: '#a61a1a',
  accent: '#f5d15f',
  pageBg: '#fafaf8',
  shellBg: '#f0efec',
};

function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
  return h.toLowerCase();
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return { r: 166, g: 26, b: 26 };
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(hex, targetHex, weight) {
  const a = hexToRgb(hex);
  const b = hexToRgb(targetHex);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    a.r + (b.r - a.r) * w,
    a.g + (b.g - a.g) * w,
    a.b + (b.b - a.b) * w,
  );
}

export function darkenHex(hex, amount = 0.12) {
  return mixHex(hex, '#000000', amount);
}

export function lightenHex(hex, amount = 0.12) {
  return mixHex(hex, '#ffffff', amount);
}

export function sanitizeCustomColors(input = {}) {
  return {
    primary: normalizeHex(input.primary) || DEFAULT_CUSTOM_COLORS.primary,
    accent: normalizeHex(input.accent) || DEFAULT_CUSTOM_COLORS.accent,
    pageBg: normalizeHex(input.pageBg) || DEFAULT_CUSTOM_COLORS.pageBg,
    shellBg: normalizeHex(input.shellBg) || DEFAULT_CUSTOM_COLORS.shellBg,
  };
}

/** Build full CSS variable map from a few user-picked colors. */
export function buildCustomThemeVars(colors) {
  const c = sanitizeCustomColors(colors);
  const primaryRgb = hexToRgb(c.primary);
  const accentRgb = hexToRgb(c.accent);

  return {
    '--cis-primary': c.primary,
    '--cis-primary-hover': darkenHex(c.primary, 0.14),
    '--cis-primary-soft': mixHex(c.primary, '#ffffff', 0.92),
    '--cis-primary-rgb': `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`,
    '--cis-accent': c.accent,
    '--cis-accent-hover': darkenHex(c.accent, 0.1),
    '--cis-accent-soft': mixHex(c.accent, '#ffffff', 0.88),
    '--cis-accent-rgb': `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`,
    '--cis-peach-soft': mixHex(c.primary, '#ffffff', 0.94),
    '--cis-bg': c.pageBg,
    '--cis-bg-subtle': mixHex(c.accent, '#ffffff', 0.9),
    '--cis-shell-bg': c.shellBg,
    '--cis-border': mixHex(c.shellBg, '#000000', 0.08),
    '--cis-border-strong': mixHex(c.shellBg, '#000000', 0.16),
    '--bs-primary-rgb': `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`,
  };
}

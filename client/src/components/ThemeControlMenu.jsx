import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { CUSTOM_THEME_ID } from '../theme/themeColorUtils';
import { THEME_PRESET_LIST } from '../theme/themePresets';

const CUSTOM_FIELDS = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, links, active menu' },
  { key: 'accent', label: 'Accent', hint: 'Highlights, chips, table headers' },
  { key: 'pageBg', label: 'Page background', hint: 'Main content area' },
  { key: 'shellBg', label: 'Shell background', hint: 'Outer canvas behind cards' },
];

function ColorField({ field, value, onChange }) {
  return (
    <label className="cis-theme-color-field">
      <span className="cis-theme-color-field-head">
        <span className="cis-theme-color-field-label">{field.label}</span>
        <span className="cis-theme-color-field-hint">{field.hint}</span>
      </span>
      <span className="cis-theme-color-field-inputs">
        <input
          type="color"
          className="cis-theme-color-picker"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          aria-label={`${field.label} color picker`}
        />
        <input
          type="text"
          className="form-control form-control-sm cis-theme-color-hex"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          spellCheck={false}
          aria-label={`${field.label} hex code`}
        />
      </span>
    </label>
  );
}

export default function ThemeControlMenu() {
  const {
    themeId,
    sidebarMode,
    customColors,
    isCustom,
    setTheme,
    setSidebar,
    setCustomColors,
    resetTheme,
  } = useTheme();
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(isCustom);
  const rootRef = useRef(null);

  useEffect(() => {
    if (isCustom) setCustomOpen(true);
  }, [isCustom]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleCustomChange = (key, value) => {
    setCustomColors({ [key]: value });
  };

  const customSwatches = [
    customColors.primary,
    customColors.accent,
    customColors.shellBg,
    customColors.pageBg,
  ];

  return (
    <div className="cis-theme-control" ref={rootRef}>
      <button
        type="button"
        className="cis-theme-control-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Theme master control"
        title="Theme"
      >
        <i className="fa fa-paint-brush" aria-hidden="true" />
        <span className="d-none d-md-inline">Theme</span>
      </button>

      {open && (
        <div className="cis-theme-control-panel" role="dialog" aria-label="Theme settings">
          <div className="cis-theme-control-head">
            <div>
              <h2 className="cis-theme-control-title">Theme control</h2>
              <p className="cis-theme-control-sub">Presets or custom colors · saved in this browser</p>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
          </div>

          <div className="cis-theme-control-scroll">
            <section className="cis-theme-control-section">
              <h3 className="cis-theme-control-label">Color palette</h3>
              <div className="cis-theme-preset-grid">
                <button
                  type="button"
                  className={`cis-theme-preset${isCustom ? ' is-active' : ''}`}
                  onClick={() => {
                    setCustomOpen(true);
                    setTheme(CUSTOM_THEME_ID);
                  }}
                  aria-pressed={isCustom}
                >
                  <span className="cis-theme-preset-swatches" aria-hidden="true">
                    {customSwatches.map((color) => (
                      <span key={color} className="cis-theme-swatch" style={{ background: color }} />
                    ))}
                  </span>
                  <span className="cis-theme-preset-name">Custom</span>
                  <span className="cis-theme-preset-desc">Pick your own primary, accent &amp; backgrounds</span>
                  {isCustom && <span className="cis-theme-preset-check"><i className="fa fa-check" /></span>}
                </button>

                {THEME_PRESET_LIST.map((preset) => {
                  const active = !isCustom && preset.id === themeId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`cis-theme-preset${active ? ' is-active' : ''}`}
                      onClick={() => setTheme(preset.id)}
                      aria-pressed={active}
                    >
                      <span className="cis-theme-preset-swatches" aria-hidden="true">
                        {preset.swatches.map((color) => (
                          <span key={color} className="cis-theme-swatch" style={{ background: color }} />
                        ))}
                      </span>
                      <span className="cis-theme-preset-name">{preset.label}</span>
                      <span className="cis-theme-preset-desc">{preset.description}</span>
                      {active && <span className="cis-theme-preset-check"><i className="fa fa-check" /></span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="cis-theme-control-section">
              <button
                type="button"
                className="cis-theme-custom-toggle"
                onClick={() => setCustomOpen((v) => !v)}
                aria-expanded={customOpen}
              >
                <span>
                  <i className="fa fa-sliders" aria-hidden="true" />
                  {' '}
                  Customize colors
                </span>
                <i className={`fa fa-chevron-${customOpen ? 'up' : 'down'}`} aria-hidden="true" />
              </button>

              {customOpen && (
                <div className="cis-theme-custom-panel">
                  <p className="cis-theme-custom-note">
                    Changes apply live. Selecting a preset above keeps these values for when you switch back to Custom.
                  </p>
                  <div className="cis-theme-custom-preview" aria-hidden="true">
                    <span style={{ background: customColors.primary }} />
                    <span style={{ background: customColors.accent }} />
                    <span style={{ background: customColors.shellBg }} />
                    <span style={{ background: customColors.pageBg }} />
                  </div>
                  <div className="cis-theme-color-grid">
                    {CUSTOM_FIELDS.map((field) => (
                      <ColorField
                        key={field.key}
                        field={field}
                        value={customColors[field.key]}
                        onChange={handleCustomChange}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary w-100"
                    onClick={() => setTheme(CUSTOM_THEME_ID)}
                  >
                    Use custom theme
                  </button>
                </div>
              )}
            </section>

            <section className="cis-theme-control-section">
              <h3 className="cis-theme-control-label">Top nav</h3>
              <div className="cis-theme-toggle-group" role="group" aria-label="Top nav style">
                <button
                  type="button"
                  className={`cis-theme-toggle-btn${sidebarMode === 'dark' ? ' is-active' : ''}`}
                  onClick={() => setSidebar('dark')}
                  aria-pressed={sidebarMode === 'dark'}
                >
                  <i className="fa fa-moon-o" aria-hidden="true" />
                  Dark
                </button>
                <button
                  type="button"
                  className={`cis-theme-toggle-btn${sidebarMode === 'light' ? ' is-active' : ''}`}
                  onClick={() => setSidebar('light')}
                  aria-pressed={sidebarMode === 'light'}
                >
                  <i className="fa fa-sun-o" aria-hidden="true" />
                  Light
                </button>
              </div>
            </section>
          </div>

          <div className="cis-theme-control-foot">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetTheme}>
              Reset to default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const JQUERY_SRC = '/legacy/js/jquery.js';
const STYLESHEET = '/legacy/assets/dtpicker/css/bootstrap-datetimepicker.min.css';
const PICKER_SRC = '/legacy/assets/dtpicker/js/bootstrap-datetimepicker.min.js';

let loadPromise;

function loadStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load ${href}`));
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export function ensureLegacyDateTimePicker() {
  if (window.jQuery?.fn?.datetimepicker) {
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = loadScript(JQUERY_SRC)
      .then(() => loadStyle(STYLESHEET))
      .then(() => loadScript(PICKER_SRC))
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

function addStylesheet(href, key) {
  if (document.querySelector(`link[data-payroll="${key}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.payroll = key;
  document.head.appendChild(link);
}

function addScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load ${src}`));
    document.body.appendChild(script);
  });
}

export function loadPayrollAssets() {
  addStylesheet('/legacy/css/salary.css', 'salary');
  addStylesheet('/legacy/assets/dropdown/multiple-select.css', 'ms-css');
  return Promise.all([
    addScript('/legacy/js/jquery.js'),
    addScript('/legacy/js/bootstrap.min.js'),
    addScript('/legacy/assets/dropdown/multiple-select.js'),
  ]);
}

/**
 * Placeholder card for widgets not yet ported from PHP.
 */
export function renderPlaceholder(widgetName) {
  return `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <h3>${widgetName}</h3>
  </div>
  <div class="dashboard-panel">
    <p class="class_name" style="padding:12px;">Widget ${widgetName} — native migration in progress</p>
  </div>
  </section>
</div>`;
}

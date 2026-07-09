export const TASK_MANAGE_PRINT_STYLES = `<style>
.div_a4 { min-height: 842px; }
body { margin: 0 40px 0 60px; font-family: Arial, Helvetica, sans-serif; }
.title_1 {
  font-size: 36px;
  text-align: right;
  border-top: 4px solid #000;
  border-bottom: 8px solid #000;
  line-height: 80px;
}
.title_2 { font-size: 18px; text-align: right; line-height: 50px; }
.table_1 { margin-left: 10px; width: 98%; }
.table_3 { width: 98%; text-align: right; margin-top: 30px; }
.pbody {
  width: 94% !important;
  border-bottom: none;
  font-family: Arial, Helvetica, sans-serif;
  line-height: 20px;
  height: auto;
  min-height: 500px;
  font-size: 13px !important;
  margin-top: 30px;
  margin-left: 20px;
}
.pbody h3 { font-size: 16px; margin: 16px 0 8px; }
.signature {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 20px;
  margin-top: 100px;
  margin-left: 30px;
}
@media print {
  @page { margin: 40px; }
  body { width: 800px !important; }
}
</style>`;

export function buildLegacyPrintShell({ headerLine, title, bodyHtml }) {
  return `<div class="div_a4">
<table valign="bottom" class="table_3"><tfoot><tr><th><span id="print_page_no">&nbsp;</span></th></tr></tfoot></table>
<table class="table_1">
<tr><td class="title_2">${headerLine}</td></tr>
<tr><td class="title_1">${title}</td></tr>
</table>
<div class="pbody">${bodyHtml || ''}</div>
<table cellpadding="0" class="signature" cellspacing="0" border="0" width="94%"><tr><td width="250px">Process Owner</td><td>Principal</td></tr></table>
</div>`;
}

export function formatEventDateStr(fromValue, toValue) {
  const from = fromValue && !String(fromValue).startsWith('0000-00-00') ? new Date(fromValue) : null;
  const to = toValue && !String(toValue).startsWith('0000-00-00') ? new Date(toValue) : null;
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!from || Number.isNaN(from.getTime())) return '';
  if (!to || Number.isNaN(to.getTime())) return fmt(from);
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return fmt(from);
  return `${fmt(from)} - ${fmt(to)}`;
}

export function formatReviewDate(value) {
  if (!value || String(value).startsWith('0000-00-00')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

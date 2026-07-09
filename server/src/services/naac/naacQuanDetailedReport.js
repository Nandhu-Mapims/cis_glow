import { logModulePage } from '../shared/moduleAudit.js';
import { loadNaacQuanItemsDetailed, loadNaacQuanSections } from './naacQuanShared.js';

const PAGE = 'naac_quan_detailed_report.php';
const DOC_TYPE_OPTIONS = ['QN', 'QL', 'DOC'];

function formatUser(user) {
  const name = String(user || '').trim();
  if (!name) return '';
  return name === 'igrapix' ? 'NAACSUPPORT' : name;
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function attachmentUrl(filename) {
  const file = String(filename || '').trim();
  if (!file) return '';
  return `/legacy/naac/${encodeURIComponent(file).replace(/%2F/g, '/')}`;
}

export async function loadNaacQuanDetailedReport(memberId, fields = {}, audit = {}) {
  const deptRef = String(fields.deptRef || '');
  const docType = String(fields.docType || '');

  const sections = await loadNaacQuanSections();
  const items = await loadNaacQuanItemsDetailed({ deptRef, docType });
  const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s.name]));

  await logModulePage(PAGE, 'View', 'Successful', `${deptRef}-${docType}`, memberId, audit);

  return {
    sections: sections.map((s) => ({ id: s.id, name: s.name })),
    deptRef,
    docType,
    docTypeOptions: DOC_TYPE_OPTIONS,
    rows: items.map((row, index) => ({
      sno: index + 1,
      id: row.id,
      section: sectionMap[row.d_id] || '',
      title: row.name || '',
      attachment: row.attachment || '',
      attachmentSize: row.attachment_size || '',
      attachmentUrl: attachmentUrl(row.attachment),
      docType: row.doc_type || '',
      createdBy: formatUser(row.created_by),
      createdAt: formatDateTime(row.created_dt),
      updatedBy: formatUser(row.updated_by),
      updatedAt: formatDateTime(row.updated_dt),
    })),
  };
}

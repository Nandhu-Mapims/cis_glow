import { logModulePage } from '../shared/moduleAudit.js';
import { loadNaacQuanItemsFiltered, loadNaacQuanSections } from './naacQuanShared.js';

const PAGE = 'naac_quan_report.php';

export async function loadNaacQuanReport(memberId, fields = {}, audit = {}) {
  const deptRef = String(fields.deptRef || '');
  const docType = String(fields.docType || '');

  const sections = await loadNaacQuanSections();
  const items = await loadNaacQuanItemsFiltered({ deptRef, docType });

  const sectionMap = Object.fromEntries(sections.map((s) => [s.id, s.name]));
  await logModulePage(PAGE, 'View', 'Successful', `${deptRef}-${docType}`, memberId, audit);

  return {
    sections: sections.map((s) => ({ id: s.id, name: s.name })),
    deptRef,
    docType,
    docTypes: [...new Set(items.map((i) => i.doc_type).filter(Boolean))],
    rows: items.map((row) => ({
      id: row.id,
      section: sectionMap[row.d_id] || '',
      name: row.name,
      docNumber: row.doc_number,
      docType: row.doc_type,
      attachment: row.attachment,
    })),
  };
}

import { loadBookCategoryOptions, searchBooks } from '../libraryShared.js';
import { logLibrarySetup } from '../setupAudit.js';

const PAGE = 'resources_barcode.php';

export async function loadResourcesBarcodeSetup(memberId, fields = {}, audit = {}) {
  const [resourceTypes, departments] = await Promise.all([
    loadBookCategoryOptions('Resource'),
    loadBookCategoryOptions('Department'),
  ]);

  const filters = {
    search: fields.search || '',
    resourceType: fields.resourceType || '',
    department: fields.department || '',
    fromAccession: fields.fromAccession || '',
    toAccession: fields.toAccession || '',
  };
  const copiesPerLabel = Number(fields.copiesPerLabel) || 4;

  const rows = (filters.search || filters.fromAccession || filters.resourceType || filters.department)
    ? await searchBooks(filters, { limit: 200 })
    : [];

  await logLibrarySetup(PAGE, fields.search ? 'Generate' : 'View', 'Successful', filters.search, memberId, audit);
  return { filters, resourceTypes, departments, copiesPerLabel, rows };
}

export async function saveResourcesBarcodeSetup(payload, memberId, audit = {}) {
  return loadResourcesBarcodeSetup(memberId, payload, audit);
}

import { loadBookCategoryOptions, searchBooks } from '../libraryShared.js';
import { logLibrarySetup } from '../setupAudit.js';

const PAGE = 'resources_report.php';

const SEARCH_FIELDS = [
  { value: '', label: 'All' },
  { value: 'resource_name', label: 'Title' },
  { value: 'accession_no', label: 'Accession No.' },
  { value: 'convert_name', label: 'Convert Title' },
  { value: 'call_number', label: 'Call Number' },
  { value: 'author_name', label: 'Author' },
  { value: 'publisher_name', label: 'Publisher' },
];

export async function loadResourcesReportSetup(memberId, fields = {}, audit = {}) {
  const [resourceTypes, departments] = await Promise.all([
    loadBookCategoryOptions('Resource'),
    loadBookCategoryOptions('Department'),
  ]);

  const filters = {
    search: fields.search || '',
    searchBy: fields.searchBy || '',
    resourceType: fields.resourceType || '',
    department: fields.department || '',
  };

  const rows = fields.search || fields.resourceType || fields.department
    ? await searchBooks(filters)
    : [];

  await logLibrarySetup(PAGE, 'View', 'Successful', filters.search, memberId, audit);
  return { filters, searchFields: SEARCH_FIELDS, resourceTypes, departments, rows };
}

export async function saveResourcesReportSetup(payload, memberId, audit = {}) {
  return loadResourcesReportSetup(memberId, payload, audit);
}

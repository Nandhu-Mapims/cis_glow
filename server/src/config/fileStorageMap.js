/**
 * Legacy CIS file folder mapping under `files/` (LEGACY_FILES_PATH).
 * DB columns store filenames only; paths are resolved at runtime.
 */
export const FILE_STORAGE_MAP = [
  {
    folder: 'student_attachment',
    purpose: 'Student profile attachments (certificates, ID proofs, etc.)',
    dbTable: 'student_attachment_tb',
    dbColumn: 'attach_file',
    modernUpload: 'POST /api/students/:id/attachments/upload',
    publicUrl: '/legacy/files/student_attachment/{filename}',
    secureUrl: '/api/files/student_attachment/{filename}',
  },
  {
    folder: 'staff_documents',
    purpose: 'Staff HR documents and relieving letters',
    dbTable: 'staff_attachment_tb',
    dbColumn: 'attach_file',
    modernUpload: 'POST /api/staff/:id/attachments/upload',
    publicUrl: '/legacy/files/staff_documents/{filename}',
    secureUrl: '/api/files/staff_documents/{filename}',
  },
  {
    folder: 'staff_documents/{staff_id}',
    purpose: 'Per-staff subfolder (legacy staff_profile_edit_more.php)',
    dbTable: 'staff_attachment_tb',
    dbColumn: 'attach_file',
    publicUrl: '/legacy/files/staff_documents/{staff_id}/{filename}',
    secureUrl: '/api/files/staff_documents/{staff_id}/{filename}',
  },
  {
    folder: 'staff_images',
    purpose: 'Staff profile photos (legacy references; also see img/)',
    dbTable: 'staff_profile_tb',
    dbColumn: 'staff_photo',
    publicUrl: '/legacy/files/staff_images/{filename}',
    secureUrl: '/api/files/staff_images/{filename}',
  },
  {
    folder: 'task_document',
    purpose: 'Task/event management uploads (photos, PDFs, logos)',
    dbTable: 'task_manage_tb (various attach columns)',
    modernUpload: 'Legacy PHP only (task_document_more.php)',
    publicUrl: '/legacy/files/task_document/{filename}',
    secureUrl: '/api/files/task_document/{filename}',
  },
  {
    folder: 'student_idcard',
    purpose: 'Generated student ID card images',
    dbTable: 'student_profile_tb',
    dbColumn: 'idcard_file',
    publicUrl: '/legacy/files/student_idcard/{filename}',
    secureUrl: '/api/files/student_idcard/{filename}',
  },
  {
    folder: 'staff_idcard',
    purpose: 'Generated staff ID card images',
    publicUrl: '/legacy/files/staff_idcard/{filename}',
    secureUrl: '/api/files/staff_idcard/{filename}',
  },
  {
    folder: 'circular',
    purpose: 'Circular / notice attachments',
    publicUrl: '/legacy/files/circular/{filename}',
    secureUrl: '/api/files/circular/{filename}',
  },
  {
    folder: 'certificate',
    purpose: 'Certificate generation assets',
    publicUrl: '/legacy/files/certificate/{filename}',
    secureUrl: '/api/files/certificate/{filename}',
  },
  {
    folder: 'omr',
    purpose: 'OMR scan sheets and mark upload images',
    publicUrl: '/legacy/files/omr/{filename}',
    secureUrl: '/api/files/omr/{filename}',
  },
  {
    folder: 'excel',
    purpose: 'Generated Excel export cache files',
    publicUrl: '/legacy/files/excel/{filename}',
    secureUrl: '/api/files/excel/{filename}',
  },
  {
    folder: 'pcard',
    purpose: 'Progress card PDF/image output',
    publicUrl: '/legacy/files/pcard/{filename}',
    secureUrl: '/api/files/pcard/{filename}',
  },
  {
    folder: 'publication_docs',
    purpose: 'Staff publication document uploads',
    publicUrl: '/legacy/files/publication_docs/{filename}',
    secureUrl: '/api/files/publication_docs/{filename}',
  },
  {
    folder: 'payroll_reports',
    purpose: 'Payroll report exports',
    publicUrl: '/legacy/files/payroll_reports/{filename}',
    secureUrl: '/api/files/payroll_reports/{filename}',
  },
  {
    folder: 'documents',
    purpose: 'General document store',
    publicUrl: '/legacy/files/documents/{filename}',
    secureUrl: '/api/files/documents/{filename}',
  },
  {
    folder: 'library_ebook',
    purpose: 'Library E-Book PDF uploads (legacy library_book_add.php / library_book_edit.php)',
    dbTable: 'book_tb',
    dbColumn: 'ebook_attachment',
    modernUpload: 'POST /api/library/setup/book-add|book-edit/save (ebookFile base64)',
    publicUrl: '/legacy/files/library_ebook/{filename}',
    secureUrl: '/api/files/library_ebook/{filename}',
  },
];

export const IMG_STORAGE_NOTE = {
  path: 'img/ (served via /legacy/img/)',
  purpose: 'Member photos, logos, UI assets — not under files/',
  examples: ['img/member/{photo}', 'img/profile-avatar.jpg'],
};

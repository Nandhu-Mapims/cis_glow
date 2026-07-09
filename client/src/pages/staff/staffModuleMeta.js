export const STAFF_CORE_LINKS = [
  { to: '/staff', label: 'Staff List', legacy: 'staff_profile_edit.php' },
  { to: '/staff/new', label: 'Staff Admission', legacy: 'staff_profile_add.php' },
  { to: '/staff/reports', label: 'Staff Export', legacy: 'staff_profile_export.php' },
  { to: '/staff/certificates', label: 'Staff Certificates', legacy: 'staff_attachments.php' },
];

export const STAFF_SETUP_META = {
  'designation-edit': { title: 'Designation Edit', legacy: 'staff_designation_edit.php' },
  'attachment-category': { title: 'Attachment Category', legacy: 'staff_attachment_category.php' },
  'attachment-scategory': { title: 'Attachment Sub-Category', legacy: 'staff_attachment_scategory.php' },
  'attachment-setup': { title: 'Attachment Setup', legacy: 'staff_attachment_setup.php' },
  'org-chart-config': { title: 'Org Chart Config', legacy: 'org_chart_config.php' },
  'inspection-config': { title: 'Inspection Config', legacy: 'inspection_config.php' },
  'inspection-name': { title: 'Inspection Name', legacy: 'inspection_name.php' },
  'transport-setup': { title: 'Transport Setup', legacy: 'staff_transport_setup.php' },
  'login-help': { title: 'Staff Login Help', legacy: 'staff_help.php' },
};

export const STAFF_SCREEN_META = {
  'appoint-order': { title: 'Appointment Order', legacy: 'staff_appoint_order.php', type: 'staff-search-report' },
  'salary-note': { title: 'Salary Note', legacy: 'staff_salary_note.php', type: 'date-category-report' },
  'id-card': { title: 'ID Card', legacy: 'staff_id_card.php', type: 'staff-search-report' },
  'photo-empty': { title: 'Photo Empty Report', legacy: 'staff_photo_empty.php', type: 'category-report' },
  'photo-upload': { title: 'Photo Upload', legacy: 'staff_photo_upload.php', type: 'upload' },
  'org-structure': { title: 'Org Structure', legacy: 'org_structure.php', type: 'org-structure' },
  transport: { title: 'Staff Transport', legacy: 'staff_transport.php', type: 'transport-grid' },
  certificates: { title: 'Staff Certificates', legacy: 'staff_attachments.php', type: 'certificates' },
  photos: { title: 'Staff Photos', legacy: 'staff_photos.php', type: 'auto-report' },
  'inspection-details': { title: 'Inspection Details', legacy: 'inspection_details.php', type: 'inspection-grid' },
  'inspection-attn-sheet': { title: 'Inspection Attn Sheet', legacy: 'staff_attendance_sign_with_photo.php', type: 'attn-sheet' },
  'inspection-attn-cert': { title: 'Inspection Attn Certificate', legacy: 'inspection_attn_certificate.php', type: 'staff-search-report' },
  'dci-report': { title: 'DCI Report', legacy: 'staff_dci_report.php', type: 'dept-report' },
  'tnmgr-report': { title: 'TNMGR Report', legacy: 'staff_tnmgr_report.php', type: 'dept-report' },
  'affidavit-dci': { title: 'Affidavit DCI', legacy: 'staff_affidavit_dci.php', type: 'staff-search-report' },
  'affidavit-tnmgrmu': { title: 'Affidavit TNMGRMU', legacy: 'staff_affidavit_TNMGRMU.php', type: 'staff-search-report' },
  'attach-print': { title: 'Attach Print', legacy: 'staff_attach_print.php', type: 'staff-search-report' },
  'publication-dci': { title: 'Publication DCI', legacy: 'dci_staff_publication_report.php', type: 'dept-report' },
  'publication-tnmgrmu': { title: 'Publication TNMGRMU', legacy: 'tnmgrmu_staff_publication_report.php', type: 'dept-report' },
};

export const STAFF_SETUP_LINKS = Object.entries(STAFF_SETUP_META).map(([slug, meta]) => ({
  to: `/staff/setup/${slug}`,
  label: meta.title,
  legacy: meta.legacy,
}));

export const STAFF_SCREEN_LINKS = Object.entries(STAFF_SCREEN_META).map(([slug, meta]) => ({
  to: `/staff/${slug}`,
  label: meta.title,
  legacy: meta.legacy,
}));

export const STAFF_HUB_LINKS = [
  ...STAFF_CORE_LINKS,
  { to: '/hostel/setup/staff-rental', label: 'Staff Rental Hostel', legacy: 'staff_rental_hostel.php' },
  ...STAFF_SCREEN_LINKS.filter((l) => l.to !== '/staff/certificates'),
  ...STAFF_SETUP_LINKS,
];

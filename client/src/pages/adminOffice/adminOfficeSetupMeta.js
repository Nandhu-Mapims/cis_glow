export const ADMIN_OFFICE_SCREEN_META = {
  'student-activities-add': { title: 'Student Activities — Add', section: 'Activities' },
  'student-activities-edit': { title: 'Student Activities — Edit', section: 'Activities' },
  'staff-activities-add': { title: 'Staff Activities — Add', section: 'Activities' },
  'staff-activities-edit': { title: 'Staff Activities — Edit', section: 'Activities' },
  'courier-add': { title: 'Courier Add', section: 'Courier' },
  'courier-edit': { title: 'Courier Edit', section: 'Courier' },
  'courier-report': { title: 'Courier Report', section: 'Courier' },
  'incident-add': { title: 'Incident Add', section: 'Incident' },
  'incident-edit': { title: 'Incident Edit', section: 'Incident' },
  'incident-report': { title: 'Incident Report', section: 'Incident' },
  'events-group-add': { title: 'Events Group', section: 'Events' },
};

export const ADMIN_OFFICE_HUB_LINKS = Object.entries(ADMIN_OFFICE_SCREEN_META).map(([screen, meta]) => ({
  to: `/admin-office/setup/${screen}`,
  title: meta.title,
  desc: meta.section,
  icon: 'fa fa-angle-right',
  section: meta.section,
}));

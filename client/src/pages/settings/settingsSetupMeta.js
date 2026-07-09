export const SETTINGS_SCREEN_META = {
  designation: { title: 'Department & Designation', legacy: 'staff_dept_setup.php', section: 'Staff' },
  'd-order': { title: 'Designation Order', legacy: 'staff_dept_order.php', section: 'Staff' },
  'staff-master': { title: 'Staff Profile Master', legacy: 'staff_profile_setup.php', section: 'Staff' },
  'staff-edu-master': { title: 'Staff Education Allied', legacy: 'staff_edu_allied.php', section: 'Staff' },
  approval: { title: 'Approval Setup', legacy: 'approval_setup.php', section: 'Workflow' },
  college: { title: 'College SMS Config', legacy: 'sms_approval_setup.php', section: 'SMS' },
  hospital: { title: 'Hospital SMS Config', legacy: 'hospital_sms_approval.php', section: 'SMS' },
  budget: { title: 'Budget Task SMS', legacy: 'task_sms_approval.php', section: 'SMS' },
  'print-setup': { title: 'Print Setup', legacy: 'print_setup.php', section: 'Print' },
  'print-style': { title: 'Print Style (CSS)', legacy: 'print_style.php', section: 'Print' },
  'lesson-plan': { title: 'Lesson Plan Setup', legacy: 'lession_plan_setup.php', section: 'Academic' },
  signature: { title: 'Salary Signature', legacy: 'salary_signature.php', section: 'Payroll' },
  'payroll-emailer': { title: 'Payroll Cron Email', legacy: 'payroll_cron_setup.php', section: 'Cron' },
  'sms-cron': { title: 'SMS Cron', legacy: 'sms_cron_setup.php', section: 'Cron' },
};

export const ACADEMIC_SETTINGS_LINKS = [
  { to: '/academic/setup/academic-years', title: 'Academic Years', desc: 'Institution and UG/PG year setup (academic.php)', icon: 'fa fa-calendar', section: 'Academic (ported)' },
  { to: '/academic/setup/course-add', title: 'Add Course', desc: 'Create courses (course_add.php)', icon: 'fa fa-plus', section: 'Academic (ported)' },
  { to: '/academic/setup/course-edit', title: 'Edit Course', desc: 'Edit courses (course_edit.php)', icon: 'fa fa-pencil', section: 'Academic (ported)' },
  { to: '/academic/setup/master-setup', title: 'Master Setup', desc: 'Lookup categories (master_setup.php)', icon: 'fa fa-cog', section: 'Academic (ported)' },
  { to: '/academic/setup/subject-master', title: 'Subject Categories', desc: 'Subject master (subject_master.php)', icon: 'fa fa-tags', section: 'Academic (ported)' },
  { to: '/admin/setup/dashboard-access', title: 'Dashboard Access', desc: 'Widget permissions (dashboard_access.php)', icon: 'fa fa-th-large', section: 'Academic (ported)' },
];

export const SMS_SCREEN_META = {
  'student-sms': { title: 'Student SMS', legacy: 'student_sms.php', section: 'Send', icon: 'fa fa-graduation-cap', desc: 'Send SMS to students by class/batch' },
  'staff-sms': { title: 'Staff SMS', legacy: 'staff_sms.php', section: 'Send', icon: 'fa fa-briefcase', desc: 'Send SMS to staff by job category' },
  'group-sms': { title: 'Group SMS', legacy: 'group_sms.php', section: 'Send', icon: 'fa fa-users', desc: 'Send SMS to custom groups' },
  'group-add': { title: 'Add Group', legacy: 'group_add.php', section: 'Groups', icon: 'fa fa-plus', desc: 'Create SMS recipient group' },
  'group-edit': { title: 'Edit Group', legacy: 'group_edit.php', section: 'Groups', icon: 'fa fa-pencil', desc: 'Search, edit, and delete groups' },
  'parent-meeting-sms': { title: 'Parent Message', legacy: 'parent_meeting_sms.php', section: 'Send', icon: 'fa fa-handshake-o', desc: 'Parent-teacher meeting notifications' },
  'sms-template-add': { title: 'Add Template', legacy: 'sms_template_add.php', section: 'Templates', icon: 'fa fa-plus', desc: 'Create a new SMS template' },
  'sms-template-edit': { title: 'Edit Template', legacy: 'sms_template_edit.php', section: 'Templates', icon: 'fa fa-pencil', desc: 'Search, edit, and delete templates' },
  'sms-history': { title: 'SMS Report', legacy: 'student_sms_history.php', section: 'Reports', icon: 'fa fa-list-alt', desc: 'Search sent SMS history' },
};

export const SMS_HUB_LINKS = [
  ...Object.entries(SMS_SCREEN_META).map(([screen, meta]) => ({
    to: `/sms/setup/${screen}`,
    title: meta.title,
    desc: meta.desc,
    icon: meta.icon || 'fa fa-comment',
    section: meta.section,
  })),
  { to: '/settings/setup/sms-cron', title: 'SMS Cron', desc: 'Scheduled SMS jobs', icon: 'fa fa-clock-o', section: 'Settings' },
];

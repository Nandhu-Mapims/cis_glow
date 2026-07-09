export const STAFF_ATT_LINKS = [
  { to: '/attendance/staff', title: 'Staff Calendar', desc: 'Monthly attendance calendar', icon: 'fa fa-calendar', legacy: 'individual_calendar.php' },
  { to: '/attendance/staff/report', title: 'Staff Report', desc: 'Date-range attendance report', icon: 'fa fa-file-text-o', legacy: 'staff_att_report.php' },
  { to: '/attendance/staff/punch', title: 'Live Punch', desc: 'Biometric live punch', icon: 'fa fa-hand-pointer-o', legacy: 'staff_live_attendance.php' },
  { to: '/attendance/staff/daily-attendance', title: 'Daily Attendance', desc: 'Daily grid by dept/category', icon: 'fa fa-th', legacy: 'staff_daily_attendance.php' },
  { to: '/attendance/staff/biometric-report', title: 'Biometric Report', desc: 'Raw punch log viewer', icon: 'fa fa-clock-o', legacy: 'biomertic_att.php' },
  { to: '/attendance/staff/setup/calendar-add', title: 'Calendar Add', desc: 'Manual calendar events', icon: 'fa fa-plus', legacy: 'staff_calendar_add.php' },
  { to: '/attendance/staff/setup/calendar-edit', title: 'Calendar Edit', desc: 'Edit manual calendar events', icon: 'fa fa-edit', legacy: 'staff_calendar_edit.php' },
  { to: '/attendance/staff/smr-acknowledge', title: 'SMR Acknowledge', desc: 'L/P/D acknowledgement log', icon: 'fa fa-check', legacy: 'staff_leave_acknowledge.php' },
  { to: '/attendance/staff/smr-leave-approve', title: 'Leave Approve', desc: 'Leave approval workflow', icon: 'fa fa-check-square-o', legacy: 'staff_leave_approve.php' },
  { to: '/attendance/staff/smr-permission-approve', title: 'Permission Approve', desc: 'Permission approval', icon: 'fa fa-check-square', legacy: 'staff_permission_approve.php' },
  { to: '/attendance/staff/smr-defaulter-approve', title: 'Defaulter Approve', desc: 'Defaulter approval', icon: 'fa fa-exclamation-triangle', legacy: 'staff_defaulter_approve.php' },
  { to: '/attendance/staff/smr-lpd-report', title: 'L/P/D Report', desc: 'Leave permission defaulter report', icon: 'fa fa-list-alt', legacy: 'staff_lpd_report.php' },
  { to: '/attendance/staff/holiday-roster', title: 'Holiday Roster', desc: 'Holiday roster CRUD', icon: 'fa fa-sun-o', legacy: 'staff_holiday_roster.php' },
  { to: '/attendance/staff/compensation', title: 'Compensation', desc: 'Attendance compensation', icon: 'fa fa-exchange', legacy: 'staff_compensation.php' },
  { to: '/attendance/staff/attendance-report', title: 'Attendance Report', desc: 'Category-wise summary', icon: 'fa fa-bar-chart', legacy: 'staff_attendance_report.php' },
  { to: '/attendance/staff/teaching-month-report', title: 'Teaching Month Report', desc: 'Teaching staff monthly report', icon: 'fa fa-graduation-cap', legacy: 'teaching_staff_att_report.php' },
  { to: '/attendance/staff/yearly-report', title: 'Yearly Report', desc: 'Single-staff yearly calendar', icon: 'fa fa-calendar-check-o', legacy: 'staff_yearly_report.php' },
  { to: '/attendance/staff/clear-icache', title: 'Clear ICache', desc: 'Refresh attendance cache', icon: 'fa fa-refresh', legacy: 'clear_icache.php' },
  { to: '/attendance/staff/att-chart', title: 'Att Chart', desc: 'Actual attendance chart', icon: 'fa fa-line-chart', legacy: 'staff_att_chart.php' },
  { to: '/attendance/staff/att-chart-modified', title: 'Att Chart Modified', desc: 'Modified attendance chart', icon: 'fa fa-area-chart', legacy: 'staff_att_chart_modified.php' },
  { to: '/attendance/staff/att-chart-combined', title: 'Att Chart Combined', desc: 'Combined attendance chart', icon: 'fa fa-pie-chart', legacy: 'staff_att_chart_combine.php' },
  { to: '/attendance/staff/setup/working-day', title: 'Working Day Setup', desc: 'Institution calendar', icon: 'fa fa-calendar-o', legacy: 'staff_academic_calendar.php' },
  { to: '/attendance/staff/setup/att-time', title: 'Att Time Setup', desc: 'Attendance time schedule', icon: 'fa fa-clock-o', legacy: 'staff_att_time.php' },
  { to: '/attendance/staff/att-time-report', title: 'Att Time Report', desc: 'Time schedule report', icon: 'fa fa-table', legacy: 'staff_att_time_report.php' },
  { to: '/attendance/staff/available-cl', title: 'Available CL/EL', desc: 'Manual CL/EL/OD balances', icon: 'fa fa-leaf', legacy: 'staff_cl_el.php' },
  { to: '/attendance/staff/att-transport', title: 'Att Transport', desc: 'Transport attendance', icon: 'fa fa-bus', legacy: 'staff_att_transport.php' },
  { to: '/attendance/staff/available-leave', title: 'Available Leave', desc: 'Available leave report', icon: 'fa fa-balance-scale', legacy: 'available_leave.php' },
];

export const STAFF_ATT_SETUP_META = {
  'calendar-add': { title: 'Calendar Add', legacy: 'staff_calendar_add.php' },
  'calendar-edit': { title: 'Calendar Edit', legacy: 'staff_calendar_edit.php' },
  'working-day': { title: 'Working Day Setup', legacy: 'staff_academic_calendar.php' },
  'att-time': { title: 'Attendance Time Setup', legacy: 'staff_att_time.php' },
};

export const STAFF_ATT_SCREEN_META = Object.fromEntries(
  STAFF_ATT_LINKS
    .filter((l) => l.to.startsWith('/attendance/staff/') && !['/attendance/staff', '/attendance/staff/report', '/attendance/staff/punch'].includes(l.to) && !l.to.includes('/setup/'))
    .map((l) => {
      const slug = l.to.replace('/attendance/staff/', '');
      return [slug, { title: l.title, legacy: l.legacy, route: l.to }];
    }),
);

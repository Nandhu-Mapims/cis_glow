/** Widgets that need full width (wide tables / KPI strips). */
const WIDE_WIDGET_IDS = new Set([
  'staff_unit',
  'staff_attendance',
  'staff_attendance_incampus',
  'staff_leave_absent',
  'ug_attendance',
  'ug_attendance_add',
  'pg_attendance',
  'pg_attendance_dept',
  'pg_leave_absent',
  'pg_permission',
  'internship_attendance',
  'internship_attendance_batch',
  'internship_leave_absent',
  'internship_permission',
  'student_hostel',
  'gents_hostel_attendance',
  'ladies_hostel_attendance',
  'student_ghostel',
  'student_lhostel',
]);

const DCI_WIDGET_IDS = new Set(['staff_unit']);

const ROSTER_WIDGET_IDS = new Set(['staff_unit_1', 'staff_unit_2']);

/**
 * Modern grid modifiers for dashboard widget slots.
 */
export function getWidgetSlotClassName(widgetId) {
  const parts = ['cis-widget-slot'];

  if (WIDE_WIDGET_IDS.has(widgetId)) {
    parts.push('cis-widget-slot--wide');
  }

  if (widgetId === 'staff_attendance') {
    parts.push('cis-widget-slot--kpi');
  }

  if (DCI_WIDGET_IDS.has(widgetId)) {
    parts.push('cis-widget-slot--dci');
  }

  if (ROSTER_WIDGET_IDS.has(widgetId)) {
    parts.push('cis-widget-slot--roster');
  }

  return parts.join(' ');
}

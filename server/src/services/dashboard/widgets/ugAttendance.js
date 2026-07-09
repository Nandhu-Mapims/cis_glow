import { buildStudentAttendanceWidgets } from './studentAttendanceWidgets.js';

/**
 * Legacy dashboard_more.php attendance_details() — U.G Attendance (Reg.) widget (index 2).
 * @deprecated Prefer buildStudentAttendanceWidgets via widgetDispatcher cache.
 */
export async function renderUgAttendance(ctx) {
  const widgets = await buildStudentAttendanceWidgets(ctx);
  return widgets[2];
}

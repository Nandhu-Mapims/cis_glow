import { prisma } from '../../config/prisma.js';
import { DASHBOARD_WIDGET_LABELS, groupWidgets } from './dashboardMeta.js';
import { isGlobalAccessType } from '../../utils/accessType.js';

export const STUDENT_DASHBOARD_WIDGETS = new Set([
  'ug_attendance', 'ug_attendance_add', 'pg_attendance', 'internship_attendance',
  'internship_attendance_batch', 'internship_leave_absent', 'internship_permission',
  'pg_attendance_dept', 'pg_leave_absent', 'pg_permission',
  'student_details', 'student_hostel', 'gents_hostel_attendance', 'ladies_hostel_attendance',
  'student_ghostel', 'student_lhostel', 'student_scholarship', 'student_add_details',
  'feedback_analyasis',
]);

export const STAFF_PATTERN_WIDGETS = new Set(['staff_unit', 'staff_unit_1', 'staff_unit_2']);

function buildYearOptions(startYear, endYear, format = 'long') {
  const options = [];
  for (let i = startYear; i >= endYear; i -= 1) {
    const value = format === 'long' ? `${i}-${i + 1}` : `${i}-${i + 1}`;
    options.push({ value, label: value });
  }
  return options;
}

async function loadDashboardWidgetRows(user) {
  const userId = String(user.id);
  const fetchRows = (id) =>
    prisma.$queryRaw`
      SELECT widget_name, widget_order
      FROM dashboard_access
      WHERE del = 1 AND status = 1 AND user_id = ${id}
      ORDER BY widget_order ASC
    `;

  let rows = await fetchRows(userId);
  if (rows.length === 0 && isGlobalAccessType(user.access_type)) {
    rows = await fetchRows('1');
  }
  return rows;
}

function mapWidgetItems(rows, allowedSet = null) {
  return rows
    .filter((row) => !allowedSet || allowedSet.has(row.widget_name))
    .map((row) => ({
      id: row.widget_name,
      label: DASHBOARD_WIDGET_LABELS[row.widget_name] || row.widget_name,
      order: row.widget_order,
    }));
}

export async function loadStudentDashboardShell(user, query = {}) {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
  const rows = await loadDashboardWidgetRows(user);
  const widgetItems = mapWidgetItems(rows, STUDENT_DASHBOARD_WIDGETS);

  const ugrDefault = setup?.ug_academic_year || '';
  const ugaDefault = setup?.uga_academic_year || '';
  const pgrDefault = setup?.pg_academic_year || '';

  return {
    title: 'Student Dashboard',
    legacy: 'dashboard_student.php',
    attendanceDate: query.attendanceDate || new Date().toISOString().slice(0, 10),
    academicYears: {
      ugr: query.ugr || ugrDefault,
      uga: query.uga || ugaDefault,
      pgr: query.pgr || pgrDefault,
    },
    yearOptions: {
      ugRegular: buildYearOptions(
        Number(String(ugrDefault).slice(0, 4)) || new Date().getFullYear(),
        2017,
      ),
      ugAdditional: buildYearOptions(
        Number(String(ugaDefault).slice(0, 4)) || new Date().getFullYear(),
        2018,
      ),
      pgRegular: buildYearOptions(
        Number(String(pgrDefault).slice(0, 4)) || new Date().getFullYear(),
        2018,
      ),
    },
    widgets: widgetItems,
    widgetGroups: groupWidgets(widgetItems.map((w) => w.id)),
  };
}

export async function loadStaffPatternShell(user, query = {}) {
  const rows = await loadDashboardWidgetRows(user);
  const widgetItems = mapWidgetItems(rows, STAFF_PATTERN_WIDGETS);

  return {
    title: 'Staff Pattern',
    legacy: 'dashboard_v5.php',
    attendanceDate: query.attendanceDate || new Date().toISOString().slice(0, 10),
    widgets: widgetItems,
    widgetGroups: groupWidgets(widgetItems.map((w) => w.id)),
  };
}

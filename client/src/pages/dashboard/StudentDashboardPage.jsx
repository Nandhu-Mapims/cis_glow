import DashboardWidgetShell from './DashboardWidgetShell';

export default function StudentDashboardPage() {
  return (
    <DashboardWidgetShell
      shellPath="/api/dashboard/student"
      title="Student Dashboard"
      legacy="dashboard_student.php"
      breadcrumbLabel="Student Dashboard"
      showYearPickers
    />
  );
}

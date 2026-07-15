import DashboardWidgetShell from './DashboardWidgetShell';

export default function StudentDashboardPage() {
  return (
    <DashboardWidgetShell
      shellPath="/api/dashboard/student"
      title="Student Dashboard"
      breadcrumbLabel="Student Dashboard"
      showYearPickers
    />
  );
}

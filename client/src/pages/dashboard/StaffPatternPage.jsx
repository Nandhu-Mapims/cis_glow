import DashboardWidgetShell from './DashboardWidgetShell';

export default function StaffPatternPage() {
  return (
    <DashboardWidgetShell
      shellPath="/api/dashboard/staff-pattern"
      title="Staff Pattern"
      breadcrumbLabel="Staff Pattern"
    />
  );
}

import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const LINKS = [
  { to: '/circular/setup/dashboard', title: 'Circular Dashboard', desc: 'Pending, approved, and recent circulars', icon: 'fa fa-file-text-o' },
  { to: '/circular/setup/setup', title: 'Circular Setup', desc: 'Copy-to and signature setup', icon: 'fa fa-file-text-o' },
  { to: '/circular/setup/add', title: 'Add Circular', desc: 'Create a new circular', icon: 'fa fa-file-text-o' },
  { to: '/circular/setup/edit', title: 'Edit Circular', desc: 'Search, edit, or delete circulars', icon: 'fa fa-file-text-o' },
  { to: '/circular/setup/approve', title: 'Approve Circular', desc: 'Approve pending circulars', icon: 'fa fa-file-text-o' },
  { to: '/circular/setup/report', title: 'Circular Report', desc: 'Circular listing report with filters', icon: 'fa fa-file-text-o' },
  { to: '/circular/setup/print-student', title: 'Print Student', desc: 'Approved student circulars for printing', icon: 'fa fa-file-text-o' },
  { to: '/circular/setup/print-staff', title: 'Print Staff', desc: 'Approved staff circulars for printing', icon: 'fa fa-file-text-o' },
  { to: '/circular/setup/print-department', title: 'Print Department', desc: 'Approved department circulars for printing', icon: 'fa fa-file-text-o' },
];

export default function CircularHub() {
  const { settings, menu, loading, error, reload } = useShellData();
  return (
    <ModuleHub
      title="Circular Module"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Circular' }]}
      links={LINKS}
      dashboardTitle="Circular"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}

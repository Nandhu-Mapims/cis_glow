import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const LINKS = [
  { to: '/hostel/setup/dashboard', title: 'Hostel Dashboard', desc: 'Blocks, rooms, students, and pass stats', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/block-setup', title: 'Block Setup', desc: 'Hostel and quarters block master', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/room-setup-add', title: 'Room Add', desc: 'Add hostel and quarters rooms', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/room-setup-edit', title: 'Room Edit', desc: 'Search, edit, and delete rooms', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/room-rental-setup', title: 'Rental Config', desc: 'Room rental amounts by block', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/transport-add', title: 'Transport Add', desc: 'Add school transport vehicles', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/transport-edit', title: 'Transport Edit', desc: 'Edit transport vehicles and routes', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/transport-stopping-setup', title: 'Stopping Setup', desc: 'Bus stop master list', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/transport-fee-config', title: 'Transport Fee Config', desc: 'Fee amounts per stopping point', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/student-hostel', title: 'Student Hostel', desc: 'Allocate students to hostel rooms', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/att-setup', title: 'Attendance Setup', desc: 'In/out time windows for hostel attendance', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/attendance-report', title: 'Attendance Report', desc: 'Hostel gate attendance report', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/pass-approval', title: 'Pass Approval', desc: 'Approve or reject hostel pass requests', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/pass-report', title: 'Pass Report', desc: 'Hostel pass request report', icon: 'fa fa-file-text-o' },
  { to: '/hostel/setup/staff-rental', title: 'Staff Rental', desc: 'Staff quarters rental amounts', icon: 'fa fa-file-text-o' },
];

export default function HostelHub() {
  const { settings, menu, loading, error, reload } = useShellData();
  return (
    <ModuleHub
      title="Hostel Module"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Hostel' }]}
      links={LINKS}
      dashboardTitle="Hostel"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}

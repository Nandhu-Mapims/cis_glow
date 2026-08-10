import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';

const LINKS = [
  { to: '/admin/users', title: 'User Directory', desc: 'Browse accounts and open edit', icon: 'fa fa-users' },
  { to: '/admin/setup/account-add', title: 'Add User', desc: 'Create web login account', icon: 'fa fa-user-plus' },
  { to: '/admin/setup/account-edit', title: 'Edit User', desc: 'Search, edit, disable, reset password', icon: 'fa fa-pencil' },
  { to: '/admin/setup/access-restriction', title: 'Login Restrictions', desc: 'Time/day/IP access rules', icon: 'fa fa-lock' },
  { to: '/admin/setup/dept-auth', title: 'Department Auth', desc: 'Dept/course scope per user', icon: 'fa fa-building' },
  { to: '/admin/setup/menu-auth', title: 'Menu Permissions', desc: 'Sidebar menu checkboxes', icon: 'fa fa-list' },
  { to: '/admin/setup/role-manager', title: 'Role Manager', desc: 'Define reusable permission roles', icon: 'fa fa-id-badge' },
  { to: '/admin/setup/assign-roles', title: 'Assign Roles', desc: 'Grant a user one or more roles', icon: 'fa fa-user-circle' },
  { to: '/admin/setup/dashboard-access', title: 'Dashboard Widgets', desc: 'Per-user dashboard boxes', icon: 'fa fa-th-large' },
  { to: '/admin/setup/change-password', title: 'Change Password', desc: 'Update your profile and password', icon: 'fa fa-key' },
  { to: '/admin/setup/otp-reset', title: 'Reset Account', desc: 'Bulk reset passwords to default', icon: 'fa fa-refresh' },
  { to: '/admin/setup/committee-access', title: 'Committee Access', desc: 'Event committee permissions', icon: 'fa fa-users' },
  { to: '/admin/setup/dept-auth-v1', title: 'Staff Dept Auth', desc: 'HOD department scope (v1)', icon: 'fa fa-sitemap' },
  { to: '/admin/setup/staff-auth-hod', title: 'HOD Page Auth', desc: 'Staff portal menu for HODs', icon: 'fa fa-id-badge' },
  { to: '/admin/setup/staff-auth-page', title: 'Staff Page Auth', desc: 'Staff portal menu permissions', icon: 'fa fa-id-card' },
  { to: '/admin/log-dashboard', title: 'Login Dashboard', desc: 'Admin/staff/student login stats', icon: 'fa fa-bar-chart' },
  { to: '/admin/log-details', title: 'Log Details', desc: 'Search login sessions and page activity', icon: 'fa fa-file-text-o' },
];

export default function AdminHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="User & Account Management"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Admin' }]}
      links={LINKS}
      dashboardTitle="Administration"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}

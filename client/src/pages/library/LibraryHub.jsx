import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';

const LINKS = [
  { to: '/library/setup/dashboard', title: 'Library Dashboard', desc: 'Book counts, issues, returns, and visitor stats', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/book-category', title: 'Categories', desc: 'Department, resource type, course type, subject', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/book-add', title: 'Resources Add', desc: 'Add library books and resources', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/book-edit', title: 'Resources Edit', desc: 'Search and edit resources', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/book-report', title: 'Resources Report', desc: 'Filter and list library resources', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/resources-report', title: 'OPAC', desc: 'Online public access catalog search', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/resources-barcode', title: 'Barcode', desc: 'Generate barcode labels for resources', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/resource-transfer', title: 'Transfer', desc: 'Transfer resources between libraries', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/supplier-add', title: 'Supplier Add', desc: 'Add book suppliers', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/supplier-edit', title: 'Supplier Edit', desc: 'Edit and delete suppliers', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/transaction-setup', title: 'Limit Setup', desc: 'Issue limits and loan duration', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/transaction-issue', title: 'Book Issue', desc: 'Issue books to students or staff', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/transaction-return', title: 'Book Return', desc: 'Return issued books', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/transaction-report', title: 'Transactions Report', desc: 'Issue, return, and due reports', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/entry-report', title: 'Daily Summary', desc: 'Issue and return summary by date', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/attendance', title: 'Library Attendance', desc: 'Device attendance for a date', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/att-entry', title: 'Manual Entry', desc: 'Manual staff attendance entry', icon: 'fa fa-file-text-o' },
  { to: '/library/setup/att-report', title: 'Attendance Report', desc: 'Attendance report by date range', icon: 'fa fa-file-text-o' },
];

export default function LibraryHub() {
  const { settings, menu } = useOutletContext();
  return (
    <ModuleHub
      title="Library Module"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Library' }]}
      links={LINKS}
      dashboardTitle="Library"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}

import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
import { LIBRARY_SCREEN_META } from './librarySetupMeta';
import { useLibrarySetupApi } from './useLibrarySetupApi';
import DashboardSetup from './setup/DashboardSetup';
import BookCategorySetup from './setup/BookCategorySetup';
import BookAddSetup from './setup/BookAddSetup';
import BookEditSetup from './setup/BookEditSetup';
import BookReportSetup from './setup/BookReportSetup';
import TransactionIssueSetup from './setup/TransactionIssueSetup';
import TransactionReturnSetup from './setup/TransactionReturnSetup';
import EntryReportSetup from './setup/EntryReportSetup';
import AttendanceSetup from './setup/AttendanceSetup';
import AttEntrySetup from './setup/AttEntrySetup';
import AttReportSetup from './setup/AttReportSetup';
import TransactionSetupSetup from './setup/TransactionSetupSetup';
import TransactionReportSetup from './setup/TransactionReportSetup';
import SupplierAddSetup from './setup/SupplierAddSetup';
import SupplierEditSetup from './setup/SupplierEditSetup';
import ResourcesReportSetup from './setup/ResourcesReportSetup';
import ResourcesBarcodeSetup from './setup/ResourcesBarcodeSetup';
import ResourceTransferSetup from './setup/ResourceTransferSetup';

const SETUP_COMPONENTS = {
  'dashboard': DashboardSetup,
  'book-category': BookCategorySetup,
  'book-add': BookAddSetup,
  'book-edit': BookEditSetup,
  'book-report': BookReportSetup,
  'resources-report': ResourcesReportSetup,
  'resources-barcode': ResourcesBarcodeSetup,
  'resource-transfer': ResourceTransferSetup,
  'supplier-add': SupplierAddSetup,
  'supplier-edit': SupplierEditSetup,
  'transaction-setup': TransactionSetupSetup,
  'transaction-issue': TransactionIssueSetup,
  'transaction-return': TransactionReturnSetup,
  'transaction-report': TransactionReportSetup,
  'entry-report': EntryReportSetup,
  'attendance': AttendanceSetup,
  'att-entry': AttEntrySetup,
  'att-report': AttReportSetup,
};

export default function LibrarySetupPage() {
  const { screen } = useParams();
  const meta = LIBRARY_SCREEN_META[screen];
  const { data, busy, error, notice, load, save } = useLibrarySetupApi(screen);
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!meta) { setLoading(false); return; }
      try {
        await load();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [meta, load]);

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Library"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Library', to: '/library' },
          { label: 'Unknown' },
        ]}
        backTo="/library"
      >
        <p className="text-danger mb-0">Unknown library screen.</p>
      </SetupPageShell>
    );
  }

  const SetupComponent = SETUP_COMPONENTS[screen];

  return (
    <SetupPageShell
      settings={settings}
      menu={menu}
      title={meta.title}
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Library', to: '/library' },
        { label: meta.title },
      ]}
      backTo="/library"
      loading={loading}
      alerts={<SetupAlerts notice={notice} error={error} busy={busy} />}
    >
      {SetupComponent ? (
        <SetupComponent data={data} busy={busy} onLoad={load} onSave={save} />
      ) : (
        <p className="text-muted mb-0">Form not available.</p>
      )}
    </SetupPageShell>
  );
}

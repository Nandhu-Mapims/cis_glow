import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
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
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!meta) { setLoading(false); return; }
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        await load();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [meta, load]);

  if (!meta) {
    return (
      <div className="p-4">
        <p className="text-danger">Unknown library screen.</p>
        <Link to="/library">Back</Link>
      </div>
    );
  }

  if (loading) return <div className="p-4 text-muted">Loading...</div>;

  const SetupComponent = SETUP_COMPONENTS[screen];

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/library">Library</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">{meta.title}</h3>
          <p className="text-muted small mb-0">Legacy: {meta.legacy}</p>
        </div>
        <Link to="/library" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card shadow-sm">
        <div className="card-body">
          {SetupComponent ? (
            <SetupComponent data={data} busy={busy} onLoad={load} onSave={save} />
          ) : (
            <p className="text-muted mb-0">Form not available.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

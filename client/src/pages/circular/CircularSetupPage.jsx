import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { CIRCULAR_SCREEN_META } from './circularSetupMeta';
import { useCircularSetupApi } from './useCircularSetupApi';
import DashboardSetup from './setup/DashboardSetup';
import SetupSetup from './setup/SetupSetup';
import AddSetup from './setup/AddSetup';
import EditSetup from './setup/EditSetup';
import ApproveSetup from './setup/ApproveSetup';
import ReportSetup from './setup/ReportSetup';
import PrintStudentSetup from './setup/PrintStudentSetup';
import PrintStaffSetup from './setup/PrintStaffSetup';
import PrintDepartmentSetup from './setup/PrintDepartmentSetup';

const SETUP_COMPONENTS = {
  'dashboard': DashboardSetup,
  'setup': SetupSetup,
  'add': AddSetup,
  'edit': EditSetup,
  'approve': ApproveSetup,
  'report': ReportSetup,
  'print-student': PrintStudentSetup,
  'print-staff': PrintStaffSetup,
  'print-department': PrintDepartmentSetup,
};

export default function CircularSetupPage() {
  const { screen } = useParams();
  const meta = CIRCULAR_SCREEN_META[screen];
  const { data, busy, error, notice, load, save } = useCircularSetupApi(screen);
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
        <p className="text-danger">Unknown circular screen.</p>
        <Link to="/circular">Back</Link>
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
          <li className="breadcrumb-item"><Link to="/circular">Circular</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">{meta.title}</h3>
          <p className="text-muted small mb-0">Legacy: {meta.legacy}</p>
        </div>
        <Link to="/circular" className="btn btn-outline-secondary btn-sm">Back</Link>
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

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../../../layouts/DashboardLayout';
import { useShellData } from '../../../hooks/useShellData';
import { STAFF_ATT_SETUP_META } from './staffAttSetupMeta';
import { useStaffAttSetupApi } from './useStaffAttSetupApi';
import CalendarAddSetup from './setup/CalendarAddSetup';
import CalendarEditSetup from './setup/CalendarEditSetup';
import WorkingDaySetup from './setup/WorkingDaySetup';
import AttTimeSetup from './setup/AttTimeSetup';

const SETUP_COMPONENTS = {
  'calendar-add': CalendarAddSetup,
  'calendar-edit': CalendarEditSetup,
  'working-day': WorkingDaySetup,
  'att-time': AttTimeSetup,
};

export default function StaffAttSetupPage() {
  const { screen } = useParams();
  const meta = STAFF_ATT_SETUP_META[screen];
  const { data, busy, error, notice, load, save } = useStaffAttSetupApi(screen);
  const { settings, menu, loading, error: shellError } = useShellData();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!meta) { setReady(true); return; }
    load().finally(() => setReady(true));
  }, [meta, load]);

  if (!meta) {
    return <div className="p-4"><p className="text-danger">Unknown staff attendance setup screen.</p><Link to="/attendance/staff/hub">Back</Link></div>;
  }
  if (loading || !ready) return <div className="p-4 text-muted">Loading...</div>;

  const SetupComponent = SETUP_COMPONENTS[screen];

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/attendance">Attendance</Link></li>
          <li className="breadcrumb-item"><Link to="/attendance/staff/hub">Staff Att</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div><h3 className="dashboard-title mb-0">{meta.title}</h3><p className="text-muted small mb-0">Legacy: {meta.legacy}</p></div>
        <Link to="/attendance/staff/hub" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>
      {shellError && <div className="alert alert-warning">{shellError}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card shadow-sm"><div className="card-body">
        {SetupComponent ? <SetupComponent data={data} busy={busy} onLoad={load} onSave={save} /> : <p className="text-muted">Form not available.</p>}
      </div></div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
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
        title="Circular"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Circular', to: '/circular' },
          { label: 'Unknown' },
        ]}
        backTo="/circular"
      >
        <p className="text-danger mb-0">Unknown circular screen.</p>
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
        { label: 'Circular', to: '/circular' },
        { label: meta.title },
      ]}
      backTo="/circular"
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

import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { SetupPageShell } from '../../../components/PageShell';
import SetupAlerts from '../../../components/SetupAlerts';
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
  const { settings, menu } = useOutletContext();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!meta) { setReady(true); return; }
    load().finally(() => setReady(true));
  }, [meta, load]);

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Staff attendance"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Attendance', to: '/attendance' },
          { label: 'Staff Att', to: '/attendance/staff/hub' },
          { label: 'Unknown' },
        ]}
        backTo="/attendance/staff/hub"
      >
        <p className="text-danger mb-0">Unknown staff attendance setup screen.</p>
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
        { label: 'Attendance', to: '/attendance' },
        { label: 'Staff Att', to: '/attendance/staff/hub' },
        { label: meta.title },
      ]}
      backTo="/attendance/staff/hub"
      loading={!ready}
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

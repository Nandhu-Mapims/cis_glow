import { useEffect, useRef } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
import { HOSTEL_SCREEN_META } from './hostelSetupMeta';
import { useHostelSetupApi } from './useHostelSetupApi';
import DashboardSetup from './setup/DashboardSetup';
import StudentHostelSetup from './setup/StudentHostelSetup';
import AttSetupSetup from './setup/AttSetupSetup';
import AttendanceReportSetup from './setup/AttendanceReportSetup';
import PassApprovalSetup from './setup/PassApprovalSetup';
import PassReportSetup from './setup/PassReportSetup';
import StaffRentalSetup from './setup/StaffRentalSetup';
import BlockSetupSetup from './setup/BlockSetupSetup';
import RoomSetupAddSetup from './setup/RoomSetupAddSetup';
import RoomSetupEditSetup from './setup/RoomSetupEditSetup';
import RoomRentalSetupSetup from './setup/RoomRentalSetupSetup';
import TransportAddSetup from './setup/TransportAddSetup';
import TransportEditSetup from './setup/TransportEditSetup';
import TransportStoppingSetup from './setup/TransportStoppingSetup';
import TransportFeeConfigSetup from './setup/TransportFeeConfigSetup';

const SETUP_COMPONENTS = {
  'dashboard': DashboardSetup,
  'block-setup': BlockSetupSetup,
  'room-setup-add': RoomSetupAddSetup,
  'room-setup-edit': RoomSetupEditSetup,
  'room-rental-setup': RoomRentalSetupSetup,
  'transport-add': TransportAddSetup,
  'transport-edit': TransportEditSetup,
  'transport-stopping-setup': TransportStoppingSetup,
  'transport-fee-config': TransportFeeConfigSetup,
  'student-hostel': StudentHostelSetup,
  'att-setup': AttSetupSetup,
  'attendance-report': AttendanceReportSetup,
  'pass-approval': PassApprovalSetup,
  'pass-report': PassReportSetup,
  'staff-rental': StaffRentalSetup,
};

export default function HostelSetupPage() {
  const { screen } = useParams();
  const meta = HOSTEL_SCREEN_META[screen];
  const { data, busy, error, notice, clearNotice, load, save } = useHostelSetupApi(screen);
  const { settings, menu } = useOutletContext();
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!meta || didInitRef.current) return;
    didInitRef.current = true;
    load();
  }, [meta, load]);

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Hostel"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Hostel', to: '/hostel' },
          { label: 'Unknown' },
        ]}
        backTo="/hostel"
      >
        <p className="text-danger mb-0">Unknown hostel screen.</p>
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
        { label: 'Hostel', to: '/hostel' },
        { label: meta.title },
      ]}
      backTo="/hostel"
      alerts={(
        <SetupAlerts
          notice={notice}
          error={error}
          busy={busy}
          onDismissNotice={clearNotice}
        />
      )}
    >
      {SetupComponent ? (
        <SetupComponent data={data} busy={busy} onLoad={load} onSave={save} />
      ) : (
        <p className="text-muted mb-0">Form not available.</p>
      )}
    </SetupPageShell>
  );
}

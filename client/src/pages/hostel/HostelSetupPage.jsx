import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useShellData } from '../../hooks/useShellData';
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
  const { settings, menu, loading: shellLoading } = useShellData();
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!meta || didInitRef.current) return;
    didInitRef.current = true;
    load();
  }, [meta, load]);

  if (!meta) {
    return (
      <div className="p-4">
        <p className="text-danger">Unknown hostel screen.</p>
        <Link to="/hostel">Back</Link>
      </div>
    );
  }

  if (shellLoading && !settings) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  const SetupComponent = SETUP_COMPONENTS[screen];

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/hostel">Hostel</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">{meta.title}</h3>
          <p className="text-muted small mb-0">Legacy: {meta.legacy}</p>
        </div>
        <Link to="/hostel" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>
      {notice && (
        <div className="alert alert-success alert-dismissible fade show">
          {notice}
          <button type="button" className="btn-close" aria-label="Close" onClick={clearNotice} />
        </div>
      )}
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

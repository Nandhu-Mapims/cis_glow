import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
import { SETTINGS_SCREEN_META } from './settingsSetupMeta';
import { useSettingsSetupApi } from './useSettingsSetupApi';
import ApprovalSetup from './setup/ApprovalSetup';
import BudgetSmsSetup from './setup/BudgetSmsSetup';
import CollegeSmsSetup from './setup/CollegeSmsSetup';
import DesignationSetup from './setup/DesignationSetup';
import DOrderSetup from './setup/DOrderSetup';
import HospitalSmsSetup from './setup/HospitalSmsSetup';
import LessonPlanSetup from './setup/LessonPlanSetup';
import PayrollEmailerSetup from './setup/PayrollEmailerSetup';
import PrintSetupSetup from './setup/PrintSetupSetup';
import PrintStyleSetup from './setup/PrintStyleSetup';
import SignatureSetup from './setup/SignatureSetup';
import SmsCronSetup from './setup/SmsCronSetup';
import StaffEduMasterSetup from './setup/StaffEduMasterSetup';
import StaffMasterSetup from './setup/StaffMasterSetup';
import '../admin/AdminSetupPage.css';

const SETUP_COMPONENTS = {
  designation: DesignationSetup,
  'd-order': DOrderSetup,
  'staff-master': StaffMasterSetup,
  'staff-edu-master': StaffEduMasterSetup,
  approval: ApprovalSetup,
  college: CollegeSmsSetup,
  hospital: HospitalSmsSetup,
  budget: BudgetSmsSetup,
  'print-setup': PrintSetupSetup,
  'print-style': PrintStyleSetup,
  'lesson-plan': LessonPlanSetup,
  signature: SignatureSetup,
  'payroll-emailer': PayrollEmailerSetup,
  'sms-cron': SmsCronSetup,
};

export default function SettingsSetupPage({ screen: screenProp, initialFields = null }) {
  const { screen: routeScreen } = useParams();
  const screen = screenProp || routeScreen;
  const meta = SETTINGS_SCREEN_META[screen];
  const initialFieldsRef = useRef(initialFields);

  const { data, busy, error, notice, setError, setNotice, load, save } = useSettingsSetupApi(screen);
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!meta) {
        setLoading(false);
        return;
      }
      try {
        await load(initialFieldsRef.current || {});
        initialFieldsRef.current = null;
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [meta, load]);

  const handleLoad = useCallback(async (fields = {}, query = {}) => {
    setError(null);
    return load(fields, query);
  }, [load, setError]);

  const handleSave = useCallback(async (fields, files = []) => {
    setError(null);
    return save(fields, files);
  }, [save, setError]);

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Settings"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Settings', to: '/settings' },
          { label: 'Setup', to: '/settings/setup' },
          { label: 'Unknown' },
        ]}
        backTo="/settings/setup"
      >
        <p className="text-danger mb-0">Unknown settings screen.</p>
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
        { label: 'Settings', to: '/settings' },
        { label: 'Setup', to: '/settings/setup' },
        { label: meta.title },
      ]}
      backTo="/settings/setup"
      loading={loading}
      alerts={(
        <SetupAlerts
          notice={notice}
          error={error}
          busy={busy}
          onDismissNotice={setNotice ? () => setNotice(null) : undefined}
        />
      )}
      cardClassName="cis-setup-card admin-setup-card"
      rootClassName="cis-setup-root admin-setup-root admin-native-root"
    >
      {SetupComponent ? (
        <SetupComponent
          data={data}
          busy={busy}
          onLoad={handleLoad}
          onSave={handleSave}
        />
      ) : (
        <p className="text-muted mb-0">No form available for this screen.</p>
      )}
    </SetupPageShell>
  );
}

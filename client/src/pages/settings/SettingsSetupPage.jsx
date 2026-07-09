import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import { Breadcrumbs, PageHeader, PageLoading } from '../../components/PageShell';
import DashboardLayout from '../../layouts/DashboardLayout';
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

  const { data, busy, error, notice, setError, load, save } = useSettingsSetupApi(screen);
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!meta) {
        setLoading(false);
        return;
      }
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
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
      <div className="p-4">
        <p className="text-danger">Unknown settings screen.</p>
        <Link to="/settings/setup">Back</Link>
      </div>
    );
  }

  if (loading) {
    return <PageLoading />;
  }

  const SetupComponent = SETUP_COMPONENTS[screen];

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <div className="cis-page">
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/dashboard' },
            { label: 'Settings', to: '/settings' },
            { label: 'Setup', to: '/settings/setup' },
            { label: meta.title },
          ]}
        />

        <PageHeader
          title={meta.title}
          subtitle={`Legacy reference: ${meta.legacy}`}
          actions={<Link to="/settings/setup" className="btn btn-outline-secondary btn-sm">Back</Link>}
        />

        {notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="card admin-setup-card">
          <div className="card-body admin-setup-root admin-native-root">
            {SetupComponent ? (
              <SetupComponent
                data={data}
                busy={busy}
                onLoad={handleLoad}
                onSave={handleSave}
              />
            ) : (
              <p className="text-muted mb-0">No native form available for this screen.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

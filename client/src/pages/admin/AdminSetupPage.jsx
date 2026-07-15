import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
import { ADMIN_SCREEN_META } from './adminSetupMeta';
import { useAdminSetupApi } from './setup/useAdminSetupApi';
import AccountAddForm from './setup/AccountAddForm';
import AccountEditSetup from './setup/AccountEditSetup';
import AccessRestrictionSetup from './setup/AccessRestrictionSetup';
import DeptAuthSetup from './setup/DeptAuthSetup';
import MenuAuthSetup from './setup/MenuAuthSetup';
import DashboardAccessSetup from './setup/DashboardAccessSetup';
import ChangePasswordSetup from './setup/ChangePasswordSetup';
import OtpResetSetup from './setup/OtpResetSetup';
import CommitteeAccessSetup from './setup/CommitteeAccessSetup';
import StaffAuthSetup from './setup/StaffAuthSetup';
import DeptAuthV1Setup from './setup/DeptAuthV1Setup';
import './AdminSetupPage.css';

const SETUP_COMPONENTS = {
  'account-add': AccountAddForm,
  'account-edit': AccountEditSetup,
  'access-restriction': AccessRestrictionSetup,
  'dept-auth': DeptAuthSetup,
  'menu-auth': MenuAuthSetup,
  'dashboard-access': DashboardAccessSetup,
  'change-password': ChangePasswordSetup,
  'otp-reset': OtpResetSetup,
  'committee-access': CommitteeAccessSetup,
  'staff-auth-hod': StaffAuthSetup,
  'staff-auth-page': StaffAuthSetup,
  'dept-auth-v1': DeptAuthV1Setup,
};

export default function AdminSetupPage({ screen: screenProp, initialFields = null }) {
  const { screen: routeScreen } = useParams();
  const [searchParams] = useSearchParams();
  const screen = screenProp || routeScreen;
  const meta = ADMIN_SCREEN_META[screen];
  const initialFieldsRef = useRef(initialFields);

  const { data, busy, error, notice, setError, setNotice, load, save } = useAdminSetupApi(screen);
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!meta) {
        setLoading(false);
        return;
      }
      try {
        const query = {};
        const uid = searchParams.get('uid');
        if (uid) query.uid = uid;
        await load(initialFieldsRef.current || {}, query);
        initialFieldsRef.current = null;
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [meta, load, searchParams]);

  const handleLoad = useCallback(async (fields = {}, query = {}) => {
    setError(null);
    const uid = searchParams.get('uid');
    const mergedQuery = uid ? { ...query, uid } : query;
    return load(fields, mergedQuery);
  }, [load, searchParams, setError]);

  const handleSave = useCallback(async (fields, files = []) => {
    setError(null);
    return save(fields, files);
  }, [save, setError]);

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Admin"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Admin', to: '/admin' },
          { label: 'Unknown' },
        ]}
        backTo="/admin"
      >
        <p className="text-danger mb-0">Unknown admin screen.</p>
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
        { label: 'Admin', to: '/admin' },
        { label: meta.title },
      ]}
      actions={(
        <>
          {screen === 'account-edit' && (
            <Link to="/admin/users" className="btn btn-outline-primary btn-sm">User list</Link>
          )}
          <Link to="/admin" className="btn btn-outline-secondary btn-sm">Back</Link>
        </>
      )}
      loading={loading}
      alerts={(
        <SetupAlerts
          notice={notice}
          error={error}
          busy={busy}
          onDismissNotice={() => setNotice(null)}
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

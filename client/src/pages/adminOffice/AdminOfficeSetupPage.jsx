import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Breadcrumbs, PageHeader, PageLoading } from '../../components/PageShell';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ADMIN_OFFICE_SCREEN_META } from './adminOfficeSetupMeta';
import { useAdminOfficeSetupApi } from './useAdminOfficeSetupApi';
import ActivitiesAddSetup from './setup/ActivitiesAddSetup';
import ActivitiesEditSetup from './setup/ActivitiesEditSetup';
import CourierAddSetup from './setup/CourierAddSetup';
import CourierEditSetup from './setup/CourierEditSetup';
import CourierReportSetup from './setup/CourierReportSetup';
import IncidentAddSetup from './setup/IncidentAddSetup';
import IncidentEditSetup from './setup/IncidentEditSetup';
import IncidentReportSetup from './setup/IncidentReportSetup';
import EventsGroupSetup from './setup/EventsGroupSetup';

const SETUP_COMPONENTS = {
  'student-activities-add': ActivitiesAddSetup,
  'student-activities-edit': ActivitiesEditSetup,
  'staff-activities-add': ActivitiesAddSetup,
  'staff-activities-edit': ActivitiesEditSetup,
  'courier-add': CourierAddSetup,
  'courier-edit': CourierEditSetup,
  'courier-report': CourierReportSetup,
  'incident-add': IncidentAddSetup,
  'incident-edit': IncidentEditSetup,
  'incident-report': IncidentReportSetup,
  'events-group-add': EventsGroupSetup,
};

export default function AdminOfficeSetupPage() {
  const { screen } = useParams();
  const meta = ADMIN_OFFICE_SCREEN_META[screen];
  const { data, busy, error, notice, setError, load, save } = useAdminOfficeSetupApi(screen);
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!meta) {
        setLoading(false);
        return;
      }
      try {
        await load();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [meta, load]);

  const handleLoad = useCallback((fields, query) => {
    setError(null);
    return load(fields, query);
  }, [load, setError]);

  const handleSave = useCallback((fields) => {
    setError(null);
    return save(fields);
  }, [save, setError]);

  if (!meta) {
    return (
      <DashboardLayout settings={settings} menu={menu}>
        <div className="alert alert-warning">Unknown screen.</div>
        <Link to="/admin-office">Back</Link>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout settings={settings} menu={menu}>
        <PageLoading />
      </DashboardLayout>
    );
  }

  const SetupComponent = SETUP_COMPONENTS[screen];

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <div className="cis-page">
        <Breadcrumbs items={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Admin Office', to: '/admin-office' },
          { label: meta.title },
        ]} />
        <PageHeader
          title={meta.title}
          actions={<Link to="/admin-office" className="btn btn-outline-secondary btn-sm">Back</Link>}
        />
        {notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        {busy && <div className="text-muted small mb-2">Working…</div>}
        <div className="card shadow-sm">
          <div className="card-body">
            {SetupComponent ? (
              <SetupComponent data={data} busy={busy} onLoad={handleLoad} onSave={handleSave} />
            ) : (
              <p className="text-muted mb-0">Form not available.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

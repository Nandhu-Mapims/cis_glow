import { useEffect, useState } from 'react';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Breadcrumbs, PageLoading } from '../../components/PageShell';
import { printReportHtml } from '../../utils/printReport';

function StrengthReportPage({ apiPath, title, legacy, widgetClass = 'strength-report' }) {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, menuRes, reportRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          api.get(apiPath),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        setData(reportRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load report');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiPath]);

  if (loading) return <PageLoading message="Loading report…" />;

  return (
    <DashboardLayout settings={settings} dashboard={{ title }} menu={menu}>
      <div className="cis-page cis-dash-page">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard/hub' }, { label: title }]} />

        <section className="cis-dash-hero cis-dash-hero--compact">
          <div className="cis-dash-hero-copy">
            <h1 className="cis-dash-hero-title">{title}</h1>
            <p className="cis-dash-hero-subtitle">
              Legacy:
              {' '}
              <code>{legacy}</code>
              {data?.referenceYear && (
                <>
                  {' '}
                  · Reference year
                  {' '}
                  <strong>{data.referenceYear}</strong>
                </>
              )}
              {data?.overallStrength != null && (
                <>
                  {' '}
                  · Total strength
                  {' '}
                  <strong>{data.overallStrength}</strong>
                </>
              )}
            </p>
          </div>
        </section>

        {error && <div className="alert alert-danger">{error}</div>}

        <section className="cis-dash-section">
          <div className="cis-dash-section-head">
            <div>
              <h2 className="cis-dash-section-title">Strength matrix</h2>
              <p className="cis-dash-section-subtitle">
                Course-wise counts by admission year (legacy report layout).
              </p>
            </div>
            <div className="cis-dash-toolbar">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => printReportHtml(`<h3>${title}</h3>${data?.tableHtml || ''}`)}
              >
                Print
              </button>
            </div>
          </div>

          <div className="row dashboard-widgets-row">
            <div className={`col-12 widget-slot widget-slot--wide widget-slot--strength widget-slot--${widgetClass}`}>
              <div className={`legacy-widget-root legacy-widget-root--${widgetClass}`}>
                <div className="col-sm-12 dashboard-container">
                  <section className="panel">
                    <div className="revenue-head">
                      <span aria-hidden="true" />
                      <h3>{title}</h3>
                    </div>
                    <div
                      className="dashboard-panel-unit"
                      dangerouslySetInnerHTML={{ __html: data?.tableHtml || '' }}
                    />
                  </section>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

export function OverallStrengthPage() {
  return (
    <StrengthReportPage
      apiPath="/api/dashboard/overall-strength"
      title="Overall Strength"
      legacy="student_strength_overall.php"
      widgetClass="overall-strength"
    />
  );
}

export function CommunityStrengthPage() {
  return (
    <StrengthReportPage
      apiPath="/api/dashboard/community-strength"
      title="Community Strength"
      legacy="student_community_strength.php"
      widgetClass="community-strength"
    />
  );
}

export default OverallStrengthPage;

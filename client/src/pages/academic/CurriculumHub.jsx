import { Link } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import { CURRICULUM_HUB_LINKS } from './curriculumMeta';

export default function CurriculumHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Curriculum Module"
      subtitle="Periods, timetables, feedback, internship, and curriculum reports — grouped by workflow."
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Academic', to: '/academic' },
        { label: 'Curriculum' },
      ]}
      links={CURRICULUM_HUB_LINKS}
      dashboardTitle="Curriculum"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
      actions={(
        <Link to="/academic" className="btn btn-outline-secondary btn-sm">
          Back to Academic
        </Link>
      )}
    />
  );
}

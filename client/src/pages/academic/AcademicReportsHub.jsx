import { Link } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import { ACADEMIC_SCREEN_META } from './academicSetupMeta';
import { isCurriculumScreen } from './curriculumMeta';

const REPORT_LINKS = Object.entries(ACADEMIC_SCREEN_META)
  .filter(([, meta]) => meta.hub === 'reports')
  .filter(([screen]) => !isCurriculumScreen(screen))
  .map(([screen, meta]) => ({
    to: `/academic/reports/${screen}`,
    title: meta.title,
    desc: `Legacy: ${meta.legacy}`,
    icon: 'fa fa-file-text-o',
  }));

export default function AcademicReportsHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Academic Reports"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Academic', to: '/academic' },
        { label: 'Reports' },
      ]}
      links={REPORT_LINKS}
      dashboardTitle="Academic Reports"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
      actions={<Link to="/academic" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}

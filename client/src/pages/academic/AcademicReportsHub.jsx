import { Link, useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { ACADEMIC_SCREEN_META } from './academicSetupMeta';
import { isCurriculumScreen } from './curriculumMeta';

const REPORT_LINKS = Object.entries(ACADEMIC_SCREEN_META)
  .filter(([, meta]) => meta.hub === 'reports')
  .filter(([screen]) => !isCurriculumScreen(screen))
  .map(([screen, meta]) => ({
    to: `/academic/reports/${screen}`,
    title: meta.title,
    icon: 'fa fa-file-text-o',
  }));

export default function AcademicReportsHub() {
  const { settings, menu } = useOutletContext();

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
      loading={false}
      error={null}
      actions={<Link to="/academic" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}

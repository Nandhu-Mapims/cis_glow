import { Link, useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { ACADEMIC_SCREEN_META } from './academicSetupMeta';
import { isCurriculumScreen } from './curriculumMeta';

const SETUP_LINKS = Object.entries(ACADEMIC_SCREEN_META)
  .filter(([, meta]) => meta.hub === 'setup')
  .filter(([screen]) => !isCurriculumScreen(screen))
  .map(([screen, meta]) => ({
    to: `/academic/setup/${screen}`,
    title: meta.title,
    icon: 'fa fa-cog',
  }));

export default function AcademicSetupHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="Academic Setup"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Academic', to: '/academic' },
        { label: 'Setup' },
      ]}
      links={SETUP_LINKS}
      dashboardTitle="Academic Setup"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
      actions={<Link to="/academic" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}

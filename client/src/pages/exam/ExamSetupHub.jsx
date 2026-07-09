import { Link } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const LINKS = [
  { to: '/exam/setup/exam-names', title: 'Exam Names', desc: 'CIA exam name master', icon: 'fa fa-tag' },
  { to: '/exam/setup/exam-setup', title: 'Term Exam Setup', desc: 'Course-wise exam configuration', icon: 'fa fa-cog' },
  { to: '/exam/setup/exam-batch', title: 'Exam Batches', desc: 'Student exam batch allocation', icon: 'fa fa-users' },
  { to: '/exam/setup/mark-entry', title: 'Mark Entry', desc: 'Internal/viva/external marks', icon: 'fa fa-pencil-square-o' },
  { to: '/exam/setup/exam-schedule', title: 'Exam Schedule', desc: 'Exam date/session scheduling', icon: 'fa fa-calendar' },
  { to: '/exam/setup/mark-sheet', title: 'Mark Sheet Print', desc: 'Generate OMR mark sheets', icon: 'fa fa-print' },
  { to: '/exam/setup/marks-upload', title: 'OMR Mark Upload', desc: 'Scan and upload filled mark sheets', icon: 'fa fa-upload' },
  { to: '/exam/setup/omr-config', title: 'OMR Layout Config', desc: 'Mark sheet margins and QR positioning', icon: 'fa fa-sliders' },
  { to: '/exam/setup/exam-nodue', title: 'No Due Verification', desc: 'Track no-due clearance status', icon: 'fa fa-check-square-o' },
  { to: '/exam/setup/exam-examiners', title: 'Exam Examiners', desc: 'Examiner assignment overview', icon: 'fa fa-user-md' },
  { to: '/exam/setup/examiner-setup', title: 'Examiner Setup', desc: 'Configure examiner mappings', icon: 'fa fa-user-plus' },
  { to: '/exam/setup/camp-activity-add', title: 'Camp Activity Add', desc: 'Add exam camp activities', icon: 'fa fa-plus-circle' },
  { to: '/exam/setup/camp-activity-edit', title: 'Camp Activity Edit', desc: 'Update camp activities', icon: 'fa fa-pencil' },
  { to: '/exam/setup/camp-activity-type', title: 'Camp Activity Type', desc: 'Activity type master', icon: 'fa fa-tags' },
  { to: '/exam/setup/attendance-entry', title: 'Attendance Entry', desc: 'Term attendance data capture', icon: 'fa fa-list' },
  { to: '/exam/setup/sheets-upload', title: 'Term Sheets Upload', desc: 'Upload term sheets', icon: 'fa fa-cloud-upload' },
  { to: '/exam/setup/exam-sms', title: 'Exam SMS', desc: 'Exam-related messaging settings', icon: 'fa fa-commenting' },
];

export default function ExamSetupHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Exam Setup"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Examination', to: '/exam' },
        { label: 'Setup' },
      ]}
      links={LINKS}
      dashboardTitle="Exam Setup"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
      actions={<Link to="/exam" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}

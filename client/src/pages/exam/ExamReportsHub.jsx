import { Link } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const LINKS = [
  { to: '/exam/reports/term-report', title: 'Term Report', desc: 'Class-wise term exam report', icon: 'fa fa-file-text-o' },
  { to: '/exam/reports/term-statement', title: 'Result Statement', desc: 'Student result statement', icon: 'fa fa-list-alt' },
  { to: '/exam/reports/progress-card', title: 'Progress Card', desc: 'Individual progress card', icon: 'fa fa-id-card-o' },
  { to: '/exam/reports/schedule-print', title: 'Exam Schedule Print', desc: 'Printable exam timetable', icon: 'fa fa-print' },
  { to: '/exam/reports/invigilator-print', title: 'Invigilator Schedule', desc: 'Invigilation duty roster', icon: 'fa fa-user-secret' },
  { to: '/exam/reports/report-analysis', title: 'Report Analysis', desc: 'Pass/fail and subject analysis', icon: 'fa fa-bar-chart' },
  { to: '/exam/reports/report-analysis-v1', title: 'Report Analysis v1', desc: 'Legacy analysis variant in native view', icon: 'fa fa-area-chart' },
  { to: '/exam/reports/exam-attendance-certificate', title: 'Attendance Certificate', desc: 'Exam attendance certificate data', icon: 'fa fa-certificate' },
  { to: '/exam/reports/attendance-report', title: 'Attendance Report', desc: 'Term attendance report view', icon: 'fa fa-file-text' },
  { to: '/exam/reports/sheets-status', title: 'Term Sheets Status', desc: 'Upload and verification status', icon: 'fa fa-tasks' },
  { to: '/exam/reports/mark-sheet-status', title: 'Mark Sheet Status', desc: 'Mark sheet generation status', icon: 'fa fa-table' },
  { to: '/exam/reports/mark-sheet-received', title: 'Mark Sheet Received', desc: 'Received sheet acknowledgement list', icon: 'fa fa-inbox' },
  { to: '/exam/student-statement', title: 'Student Exam Statement', desc: 'Individual student marks by exam', icon: 'fa fa-user' },
];

export default function ExamReportsHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Exam Reports"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Examination', to: '/exam' },
        { label: 'Reports' },
      ]}
      links={LINKS}
      dashboardTitle="Exam Reports"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
      actions={<Link to="/exam" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}

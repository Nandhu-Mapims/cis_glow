import { useOutletContext, useParams } from 'react-router-dom';
import { SetupPageShell } from '../../components/PageShell';
import { EXAM_SCREEN_META } from './examSetupMeta';
import ExamNameSetup from './setup/ExamNameSetup';
import OmrConfigSetup from './setup/OmrConfigSetup';
import TermExamSetup from './setup/TermExamSetup';
import MarkEntrySetup from './setup/MarkEntrySetup';
import ExamBatchSetup from './setup/ExamBatchSetup';
import ExamScheduleSetup from './setup/ExamScheduleSetup';
import MarksUploadSetup from './setup/MarksUploadSetup';
import MarkSheetSetup from './setup/MarkSheetSetup';
import TermReportSetup from './setup/TermReportSetup';
import TermStatementSetup from './setup/TermStatementSetup';
import ProgressCardSetup from './setup/ProgressCardSetup';
import SchedulePrintSetup from './setup/SchedulePrintSetup';
import InvigilatorPrintSetup from './setup/InvigilatorPrintSetup';
import ReportAnalysisSetup from './setup/ReportAnalysisSetup';
import ExamNodueSetup from './setup/ExamNodueSetup';
import ExamExaminersSetup from './setup/ExamExaminersSetup';
import AttendanceEntrySetup from './setup/AttendanceEntrySetup';
import ExaminerSetupSetup from './setup/ExaminerSetupSetup';
import AttendanceReportSetup from './setup/AttendanceReportSetup';
import ExamAttendanceCertificateSetup from './setup/ExamAttendanceCertificateSetup';
import CampActivityTypeSetup from './setup/CampActivityTypeSetup';
import CampActivityAddSetup from './setup/CampActivityAddSetup';
import CampActivityEditSetup from './setup/CampActivityEditSetup';
import SheetsUploadSetup from './setup/SheetsUploadSetup';
import SheetsStatusSetup from './setup/SheetsStatusSetup';
import MarkSheetStatusSetup from './setup/MarkSheetStatusSetup';
import MarkSheetReceivedSetup from './setup/MarkSheetReceivedSetup';
import ReportAnalysisV1Setup from './setup/ReportAnalysisV1Setup';
import ExamSmsSetup from './setup/ExamSmsSetup';
import './ExamSetupPage.css';

const NATIVE_SCREENS = {
  'exam-names': ExamNameSetup,
  'exam-setup': TermExamSetup,
  'omr-config': OmrConfigSetup,
  'mark-entry': MarkEntrySetup,
  'exam-batch': ExamBatchSetup,
  'exam-schedule': ExamScheduleSetup,
  'marks-upload': MarksUploadSetup,
  'mark-sheet': MarkSheetSetup,
  'term-report': TermReportSetup,
  'term-statement': TermStatementSetup,
  'progress-card': ProgressCardSetup,
  'schedule-print': SchedulePrintSetup,
  'invigilator-print': InvigilatorPrintSetup,
  'report-analysis': ReportAnalysisSetup,
  'exam-nodue': ExamNodueSetup,
  'exam-examiners': ExamExaminersSetup,
  'attendance-entry': AttendanceEntrySetup,
  'exam-attendance-certificate': ExamAttendanceCertificateSetup,
  'examiner-setup': ExaminerSetupSetup,
  'camp-activity-add': CampActivityAddSetup,
  'camp-activity-edit': CampActivityEditSetup,
  'camp-activity-type': CampActivityTypeSetup,
  'attendance-report': AttendanceReportSetup,
  'sheets-upload': SheetsUploadSetup,
  'sheets-status': SheetsStatusSetup,
  'mark-sheet-status': MarkSheetStatusSetup,
  'mark-sheet-received': MarkSheetReceivedSetup,
  'exam-sms': ExamSmsSetup,
  'report-analysis-v1': ReportAnalysisV1Setup,
};

export default function ExamSetupPage({ screen: screenProp }) {
  const { screen: routeScreen } = useParams();
  const screen = screenProp || routeScreen;
  const meta = EXAM_SCREEN_META[screen];
  const NativeComponent = NATIVE_SCREENS[screen];
  const hubPath = meta?.hub === 'reports' ? '/exam/reports' : '/exam/setup';
  const hubLabel = meta?.hub === 'reports' ? 'Reports' : 'Setup';

  const { settings, menu } = useOutletContext();

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Examination"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Examination', to: '/exam' },
          { label: 'Setup', to: '/exam/setup' },
          { label: 'Unknown' },
        ]}
        backTo="/exam/setup"
      >
        <p className="text-danger mb-0">Unknown exam screen.</p>
      </SetupPageShell>
    );
  }

  return (
    <SetupPageShell
      settings={settings}
      menu={menu}
      title={meta.title}
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Examination', to: '/exam' },
        { label: hubLabel, to: hubPath },
        { label: meta.title },
      ]}
      backTo={hubPath}
      cardClassName="cis-setup-card exam-setup-card"
      rootClassName="cis-setup-root exam-setup-root"
    >
      {NativeComponent ? <NativeComponent readOnly={meta.readOnly} /> : <p className="text-muted mb-0">Screen not available.</p>}
    </SetupPageShell>
  );
}

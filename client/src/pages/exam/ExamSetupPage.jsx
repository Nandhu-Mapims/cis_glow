import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useShellData } from '../../hooks/useShellData';
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
import GenericExamScreen from './setup/GenericExamScreen';
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

export default function ExamSetupPage({ screen: screenProp, initialFields = null, initialQuery = null }) {
  const { screen: routeScreen } = useParams();
  const screen = screenProp || routeScreen;
  const meta = EXAM_SCREEN_META[screen];
  const NativeComponent = NATIVE_SCREENS[screen];
  const hubPath = meta?.hub === 'reports' ? '/exam/reports' : '/exam/setup';

  const { settings, menu, loading: shellLoading } = useShellData();

  if (!meta) {
    return (
      <div className="p-4">
        <p className="text-danger">Unknown exam screen.</p>
        <Link to={hubPath}>Back</Link>
      </div>
    );
  }

  if (shellLoading && !settings) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/exam">Examination</Link></li>
          <li className="breadcrumb-item"><Link to={hubPath}>{meta.hub === 'reports' ? 'Reports' : 'Setup'}</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">{meta.title}</h3>
          <p className="text-muted small mb-0">Legacy: {meta.legacy}</p>
        </div>
        <Link to={hubPath} className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      <div className="card shadow-sm exam-setup-card">
        <div className="card-body exam-setup-root">
          {NativeComponent ? <NativeComponent readOnly={meta.readOnly} /> : <p className="text-muted mb-0">Screen not available.</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}

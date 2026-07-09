import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppShellLayout from '../layouts/AppShellLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import DashboardHub from '../pages/dashboard/DashboardHub';
import StudentDashboardPage from '../pages/dashboard/StudentDashboardPage';
import StaffPatternPage from '../pages/dashboard/StaffPatternPage';
import { OverallStrengthPage, CommunityStrengthPage } from '../pages/dashboard/StrengthReportPages';
import StudentList from '../pages/students/StudentList';
import StudentProfile from '../pages/students/StudentProfile';
import StudentAdmission from '../pages/students/StudentAdmission';
import StudentReport from '../pages/students/StudentReport';
import StudentHub from '../pages/students/StudentHub';
import StudentScreenPage from '../pages/students/StudentScreenPage';
import { STUDENT_SCREEN_META } from '../pages/students/studentModuleMeta';
import StaffList from '../pages/staff/StaffList';
import StaffProfile from '../pages/staff/StaffProfile';
import StaffAdmission from '../pages/staff/StaffAdmission';
import StaffReport from '../pages/staff/StaffReport';
import StaffHub from '../pages/staff/StaffHub';
import StaffSetupPage from '../pages/staff/StaffSetupPage';
import StaffScreenPage from '../pages/staff/StaffScreenPage';
import AttendanceHub from '../pages/attendance/AttendanceHub';
import StaffAttendanceCalendar from '../pages/attendance/StaffAttendanceCalendar';
import StaffAttendanceReport from '../pages/attendance/StaffAttendanceReport';
import StudentDailyAttendance from '../pages/attendance/StudentDailyAttendance';
import StudentAttendanceReport from '../pages/attendance/StudentAttendanceReport';
import StudentAttHub from '../pages/attendance/students/StudentAttHub';
import StudentAttScreenPage from '../pages/attendance/students/StudentAttScreenPage';
import { STUDENT_ATT_SCREEN_META } from '../pages/attendance/students/studentAttMeta';
import StaffLivePunch from '../pages/attendance/StaffLivePunch';
import StaffAttHub from '../pages/attendance/staff/StaffAttHub';
import StaffAttSetupPage from '../pages/attendance/staff/StaffAttSetupPage';
import StaffAttScreenPage from '../pages/attendance/staff/StaffAttScreenPage';
import FeeHub from '../pages/fees/FeeHub';
import FeeCollection from '../pages/fees/FeeCollection';
import FeeCollectionReport from '../pages/fees/FeeCollectionReport';
import StudentFeeHistory from '../pages/fees/StudentFeeHistory';
import FeePendingSlips from '../pages/fees/FeePendingSlips';
import FeeSlipApprove from '../pages/fees/FeeSlipApprove';
import FeeDashboard from '../pages/fees/FeeDashboard';
import FeeSetupHub from '../pages/fees/FeeSetupHub';
import FeeSetupPage from '../pages/fees/FeeSetupPage';
import FeeApprovedSlips from '../pages/fees/FeeApprovedSlips';
import FeeDeleteHub from '../pages/fees/FeeDeleteHub';
import FeeDeleteRequest from '../pages/fees/FeeDeleteRequest';
import FeeDeleteApprove from '../pages/fees/FeeDeleteApprove';
import FeeDeleteReport from '../pages/fees/FeeDeleteReport';
import FeePendingSms from '../pages/fees/FeePendingSms';
import FeePendingLetter from '../pages/fees/FeePendingLetter';
import FeeAcmecConfigPage from '../pages/fees/FeeAcmecConfigPage';
import AcademicHub from '../pages/academic/AcademicHub';
import AcademicSetupHub from '../pages/academic/AcademicSetupHub';
import AcademicSetupPage from '../pages/academic/AcademicSetupPage';
import AcademicCourseList from '../pages/academic/AcademicCourseList';
import AcademicCourseEditPage from '../pages/academic/AcademicCourseEditPage';
import AcademicReportsHub from '../pages/academic/AcademicReportsHub';
import CurriculumHub from '../pages/academic/CurriculumHub';
import ExamHub from '../pages/exam/ExamHub';
import ExamSetupHub from '../pages/exam/ExamSetupHub';
import ExamSetupPage from '../pages/exam/ExamSetupPage';
import ExamReportsHub from '../pages/exam/ExamReportsHub';
import ExamDashboard from '../pages/exam/ExamDashboard';
import ExamStudentStatement from '../pages/exam/ExamStudentStatement';
import ReportsHub from '../pages/reports/ReportsHub';
import AdminHub from '../pages/admin/AdminHub';
import AdminSetupPage from '../pages/admin/AdminSetupPage';
import AdminUserList from '../pages/admin/AdminUserList';
import AdminUserEditPage from '../pages/admin/AdminUserEditPage';
import AdminLogDashboard from '../pages/admin/AdminLogDashboard';
import AdminLogDetails from '../pages/admin/AdminLogDetails';
import PayrollHub from '../pages/payroll/PayrollHub';
import PayrollDashboard from '../pages/payroll/PayrollDashboard';
import PayrollConsolidatedReport from '../pages/payroll/PayrollConsolidatedReport';
import PayrollIndividualBundle from '../pages/payroll/PayrollIndividualBundle';
import PayrollIndividualReport from '../pages/payroll/PayrollIndividualReport';
import PayrollGroupReport from '../pages/payroll/PayrollGroupReport';
import PayrollSetupHub from '../pages/payroll/PayrollSetupHub';
import PayrollSetupPage from '../pages/payroll/PayrollSetupPage';
import StipendAttReport from '../pages/payroll/StipendAttReport';
import StipendGeneratePayroll from '../pages/payroll/StipendGeneratePayroll';
import StipendHub from '../pages/payroll/StipendHub';
import StipendSetupPage from '../pages/payroll/StipendSetupPage';
import StipendIndividualReport from '../pages/payroll/StipendIndividualReport';
import StipendIndividualPdfReport from '../pages/payroll/StipendIndividualPdfReport';
import StipendPayrollReport from '../pages/payroll/StipendPayrollReport';
import StipendSalaryStatement from '../pages/payroll/StipendSalaryStatement';
import SalaryStatement from '../pages/payroll/SalaryStatement';
import SalarySummary from '../pages/payroll/SalarySummary';
import GeneratePayroll from '../pages/payroll/GeneratePayroll';
import { PayrollAttReport, PayrollMonthlyReport, PayrollTaxReport } from '../pages/payroll/PayrollReportPages';
import SettingsHub from '../pages/settings/SettingsHub';
import SettingsSetupHub from '../pages/settings/SettingsSetupHub';
import SettingsSetupPage from '../pages/settings/SettingsSetupPage';
import LibraryHub from '../pages/library/LibraryHub';
import LibrarySetupPage from '../pages/library/LibrarySetupPage';
import HostelHub from '../pages/hostel/HostelHub';
import HostelSetupPage from '../pages/hostel/HostelSetupPage';
import CircularHub from '../pages/circular/CircularHub';
import CircularSetupPage from '../pages/circular/CircularSetupPage';
import { SmsHub, SmsSetupHub, SmsSetupPage } from '../pages/sms/SmsModule';
import { WebHub, WebSetupHub, WebSetupPage } from '../pages/web/WebModule';
import { TvHub, TvSetupHub, TvSetupPage } from '../pages/tv/TvModule';
import TvDashboardPage from '../pages/tv/TvDashboardPage';
import { KioskHub, KioskSetupHub, KioskSetupPage } from '../pages/kiosk/KioskModule';
import { CommitteeHub, CommitteeSetupHub, CommitteeSetupPage } from '../pages/committee/CommitteeModule';
import { CertificateHub, CertificateSetupHub, CertificateSetupPage } from '../pages/certificate/CertificateModule';
import { NaacHub, NaacSetupHub, NaacSetupPage } from '../pages/naac/NaacModule';
import { PortfolioHub } from '../pages/portfolio/PortfolioModule';
import PortfolioDashboardPage from '../pages/portfolio/PortfolioDashboardPage';
import PortfolioIndividualReportPage from '../pages/portfolio/PortfolioIndividualReportPage';
import AdminOfficeHub from '../pages/adminOffice/AdminOfficeHub';
import AdminOfficeSetupPage from '../pages/adminOffice/AdminOfficeSetupPage';
import { ElearningHub, ElearningSetupHub, ElearningSetupPage, ElearnDashboardPage } from '../pages/elearning/ElearningModule';

function StudentAttScreenRoute() {
  const location = useLocation();
  return <StudentAttScreenPage key={location.pathname} />;
}

const STUDENT_ATT_SCREEN_SLUGS = Object.keys(STUDENT_ATT_SCREEN_META)
  .sort((a, b) => b.length - a.length);

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShellLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/hub" element={<DashboardHub />} />
        <Route path="/dashboard/student" element={<StudentDashboardPage />} />
        <Route path="/dashboard/overall-strength" element={<OverallStrengthPage />} />
        <Route path="/dashboard/community-strength" element={<CommunityStrengthPage />} />
        <Route path="/dashboard/log" element={<AdminLogDashboard />} />
        <Route path="/dashboard/staff-pattern" element={<StaffPatternPage />} />
        <Route path="/students" element={<StudentList />} />
        <Route path="/students/hub" element={<StudentHub />} />
        <Route path="/students/reports" element={<StudentReport />} />
        <Route path="/students/new" element={<StudentAdmission />} />
        {Object.keys(STUDENT_SCREEN_META).map((slug) => (
          <Route key={slug} path={`/students/${slug}`} element={<StudentScreenPage />} />
        ))}
        <Route path="/students/:id" element={<StudentProfile />} />
        <Route path="/staff" element={<StaffList />} />
        <Route path="/staff/hub" element={<StaffHub />} />
        <Route path="/staff/reports" element={<StaffReport />} />
        <Route path="/staff/new" element={<StaffAdmission />} />
        <Route path="/staff/setup/:screen" element={<StaffSetupPage />} />
        <Route path="/staff/appoint-order" element={<StaffScreenPage />} />
        <Route path="/staff/salary-note" element={<StaffScreenPage />} />
        <Route path="/staff/id-card" element={<StaffScreenPage />} />
        <Route path="/staff/photo-empty" element={<StaffScreenPage />} />
        <Route path="/staff/photo-upload" element={<StaffScreenPage />} />
        <Route path="/staff/org-structure" element={<StaffScreenPage />} />
        <Route path="/staff/transport" element={<StaffScreenPage />} />
        <Route path="/staff/certificates" element={<StaffScreenPage />} />
        <Route path="/staff/photos" element={<StaffScreenPage />} />
        <Route path="/staff/login-help" element={<StaffSetupPage />} />
        <Route path="/staff/inspection-details" element={<StaffScreenPage />} />
        <Route path="/staff/inspection-attn-sheet" element={<StaffScreenPage />} />
        <Route path="/staff/inspection-attn-cert" element={<StaffScreenPage />} />
        <Route path="/staff/dci-report" element={<StaffScreenPage />} />
        <Route path="/staff/tnmgr-report" element={<StaffScreenPage />} />
        <Route path="/staff/affidavit-dci" element={<StaffScreenPage />} />
        <Route path="/staff/affidavit-tnmgrmu" element={<StaffScreenPage />} />
        <Route path="/staff/attach-print" element={<StaffScreenPage />} />
        <Route path="/staff/publication-dci" element={<StaffScreenPage />} />
        <Route path="/staff/publication-tnmgrmu" element={<StaffScreenPage />} />
        <Route path="/staff/:id" element={<StaffProfile />} />
        <Route path="/attendance" element={<AttendanceHub />} />
        <Route path="/attendance/staff/hub" element={<StaffAttHub />} />
        <Route path="/attendance/staff/report" element={<StaffAttendanceReport />} />
        <Route path="/attendance/staff/punch" element={<StaffLivePunch />} />
        <Route path="/attendance/staff/setup/:screen" element={<StaffAttSetupPage />} />
        <Route path="/attendance/staff/:screen" element={<StaffAttScreenPage />} />
        <Route path="/attendance/staff" element={<StaffAttendanceCalendar />} />
        <Route path="/attendance/students/daily" element={<StudentDailyAttendance />} />
        <Route path="/attendance/students/hub" element={<StudentAttHub />} />
        <Route path="/attendance/students/report/quarterly" element={<StudentAttendanceReport variant="quarterly" />} />
        <Route path="/attendance/students/report" element={<StudentAttendanceReport />} />
        {STUDENT_ATT_SCREEN_SLUGS.map((slug) => (
          <Route key={slug} path={`/attendance/students/${slug}`} element={<StudentAttScreenRoute />} />
        ))}
        <Route path="/fees" element={<FeeHub />} />
        <Route path="/fees/dashboard" element={<FeeDashboard />} />
        <Route path="/fees/setup" element={<FeeSetupHub />} />
        <Route path="/fees/setup/:screen" element={<FeeSetupPage />} />
        <Route path="/fees/collection" element={<FeeCollection />} />
        <Route path="/fees/report/collection" element={<FeeCollectionReport />} />
        <Route path="/fees/history" element={<StudentFeeHistory />} />
        <Route path="/fees/slips/pending" element={<FeePendingSlips />} />
        <Route path="/fees/slips/approved" element={<FeeApprovedSlips />} />
        <Route path="/fees/pending-sms" element={<FeePendingSms />} />
        <Route path="/fees/pending-letter" element={<FeePendingLetter />} />
        <Route path="/fees/acmec-config" element={<FeeAcmecConfigPage />} />
        <Route path="/fees/delete" element={<FeeDeleteHub />} />
        <Route path="/fees/delete/request" element={<FeeDeleteRequest />} />
        <Route path="/fees/delete/approve" element={<FeeDeleteApprove />} />
        <Route path="/fees/delete/report" element={<FeeDeleteReport />} />
        <Route path="/fees/slips/:groupId/approve" element={<FeeSlipApprove />} />
        <Route path="/academic" element={<AcademicHub />} />
        <Route path="/academic/curriculum" element={<CurriculumHub />} />
        <Route path="/academic/setup" element={<AcademicSetupHub />} />
        <Route path="/academic/setup/:screen" element={<AcademicSetupPage />} />
        <Route path="/academic/courses" element={<AcademicCourseList />} />
        <Route path="/academic/courses/:courseId/edit" element={<AcademicCourseEditPage />} />
        <Route path="/academic/reports" element={<AcademicReportsHub />} />
        <Route path="/academic/reports/:screen" element={<AcademicSetupPage />} />
        <Route path="/exam" element={<ExamHub />} />
        <Route path="/exam/dashboard" element={<ExamDashboard />} />
        <Route path="/exam/student-statement" element={<ExamStudentStatement />} />
        <Route path="/exam/setup" element={<ExamSetupHub />} />
        <Route path="/exam/setup/:screen" element={<ExamSetupPage />} />
        <Route path="/exam/reports" element={<ExamReportsHub />} />
        <Route path="/exam/reports/:screen" element={<ExamSetupPage />} />
        <Route path="/reports" element={<ReportsHub />} />
        <Route path="/settings" element={<SettingsHub />} />
        <Route path="/settings/setup" element={<SettingsSetupHub />} />
        <Route path="/settings/setup/:screen" element={<SettingsSetupPage />} />
        <Route path="/admin" element={<AdminHub />} />
        <Route path="/admin/users" element={<AdminUserList />} />
        <Route path="/admin/users/:userId/edit" element={<AdminUserEditPage />} />
        <Route path="/admin/setup/:screen" element={<AdminSetupPage />} />
        <Route path="/admin/log-dashboard" element={<AdminLogDashboard />} />
        <Route path="/admin/log-details" element={<AdminLogDetails />} />
        <Route path="/admin-office" element={<AdminOfficeHub />} />
        <Route path="/admin-office/setup/:screen" element={<AdminOfficeSetupPage />} />
        <Route path="/payroll" element={<PayrollHub />} />
        <Route path="/payroll/dashboard" element={<PayrollDashboard />} />
        <Route path="/payroll/individual-report" element={<PayrollIndividualReport />} />
        <Route path="/payroll/individual-bundle" element={<PayrollIndividualBundle />} />
        <Route path="/payroll/consolidated-report" element={<PayrollConsolidatedReport />} />
        <Route path="/payroll/salary-summary" element={<SalarySummary />} />
        <Route path="/payroll/salary-statement" element={<SalaryStatement />} />
        <Route path="/payroll/setup" element={<PayrollSetupHub />} />
        <Route path="/payroll/setup/:screen" element={<PayrollSetupPage />} />
        <Route path="/payroll/group-report" element={<PayrollGroupReport />} />
        <Route path="/payroll/generate-payroll" element={<GeneratePayroll />} />
        <Route path="/payroll/att-report" element={<PayrollAttReport />} />
        <Route path="/payroll/monthly-report" element={<PayrollMonthlyReport />} />
        <Route path="/payroll/tax-report" element={<PayrollTaxReport />} />
        <Route path="/payroll/stipend" element={<StipendHub />} />
        <Route path="/payroll/stipend/report" element={<StipendPayrollReport />} />
        <Route path="/payroll/stipend/statement" element={<StipendSalaryStatement />} />
        <Route path="/payroll/stipend/individual-report" element={<StipendIndividualReport />} />
        <Route path="/payroll/stipend/individual-pdf" element={<StipendIndividualPdfReport />} />
        <Route path="/payroll/stipend/generate-payroll" element={<StipendGeneratePayroll />} />
        <Route path="/payroll/stipend/att-report" element={<StipendAttReport />} />
        <Route path="/payroll/stipend/setup/:screen" element={<StipendSetupPage />} />
        <Route path="/library" element={<LibraryHub />} />
        <Route path="/library/setup/:screen" element={<LibrarySetupPage />} />
        <Route path="/hostel" element={<HostelHub />} />
        <Route path="/hostel/setup/:screen" element={<HostelSetupPage />} />
        <Route path="/circular" element={<CircularHub />} />
        <Route path="/circular/setup/:screen" element={<CircularSetupPage />} />
        <Route path="/sms" element={<SmsHub />} />
        <Route path="/sms/setup" element={<SmsSetupHub />} />
        <Route path="/sms/setup/:screen" element={<SmsSetupPage />} />
        <Route path="/web" element={<WebHub />} />
        <Route path="/web/setup" element={<WebSetupHub />} />
        <Route path="/web/setup/:screen" element={<WebSetupPage />} />
        <Route path="/tv" element={<TvHub />} />
        <Route path="/tv/dashboard" element={<TvDashboardPage />} />
        <Route path="/tv/setup" element={<TvSetupHub />} />
        <Route path="/tv/setup/:screen" element={<TvSetupPage />} />
        <Route path="/kiosk" element={<KioskHub />} />
        <Route path="/kiosk/setup" element={<KioskSetupHub />} />
        <Route path="/kiosk/setup/:screen" element={<KioskSetupPage />} />
        <Route path="/committee" element={<CommitteeHub />} />
        <Route path="/committee/setup" element={<CommitteeSetupHub />} />
        <Route path="/committee/setup/:screen" element={<CommitteeSetupPage />} />
        <Route path="/certificates" element={<CertificateHub />} />
        <Route path="/certificates/setup" element={<CertificateSetupHub />} />
        <Route path="/certificates/setup/:screen" element={<CertificateSetupPage />} />
        <Route path="/naac" element={<NaacHub />} />
        <Route path="/naac/setup" element={<NaacSetupHub />} />
        <Route path="/naac/setup/:screen" element={<NaacSetupPage />} />
        <Route path="/portfolio" element={<PortfolioHub />} />
        <Route path="/portfolio/dashboard" element={<PortfolioDashboardPage />} />
        <Route path="/portfolio/individual-report" element={<PortfolioIndividualReportPage />} />
        <Route path="/elearning" element={<ElearningHub />} />
        <Route path="/elearning/dashboard" element={<ElearnDashboardPage />} />
        <Route path="/elearning/setup" element={<ElearningSetupHub />} />
        <Route path="/elearning/setup/:screen" element={<ElearningSetupPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

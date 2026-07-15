import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppShellLayout from '../layouts/AppShellLayout';
import Login from '../pages/Login';
import { STUDENT_SCREEN_META } from '../pages/students/studentModuleMeta';
import { STUDENT_ATT_SCREEN_META } from '../pages/attendance/students/studentAttMeta';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const DashboardHub = lazy(() => import('../pages/dashboard/DashboardHub'));
const StudentDashboardPage = lazy(() => import('../pages/dashboard/StudentDashboardPage'));
const StaffPatternPage = lazy(() => import('../pages/dashboard/StaffPatternPage'));
const OverallStrengthPage = lazy(() => import('../pages/dashboard/StrengthReportPages').then((m) => ({ default: m.OverallStrengthPage })));
const CommunityStrengthPage = lazy(() => import('../pages/dashboard/StrengthReportPages').then((m) => ({ default: m.CommunityStrengthPage })));
const StudentList = lazy(() => import('../pages/students/StudentList'));
const StudentProfile = lazy(() => import('../pages/students/StudentProfile'));
const StudentAdmission = lazy(() => import('../pages/students/StudentAdmission'));
const StudentReport = lazy(() => import('../pages/students/StudentReport'));
const StudentHub = lazy(() => import('../pages/students/StudentHub'));
const StudentScreenPage = lazy(() => import('../pages/students/StudentScreenPage'));
const StaffList = lazy(() => import('../pages/staff/StaffList'));
const StaffProfile = lazy(() => import('../pages/staff/StaffProfile'));
const StaffAdmission = lazy(() => import('../pages/staff/StaffAdmission'));
const StaffReport = lazy(() => import('../pages/staff/StaffReport'));
const StaffHub = lazy(() => import('../pages/staff/StaffHub'));
const StaffSetupPage = lazy(() => import('../pages/staff/StaffSetupPage'));
const StaffScreenPage = lazy(() => import('../pages/staff/StaffScreenPage'));
const AttendanceHub = lazy(() => import('../pages/attendance/AttendanceHub'));
const StaffAttendanceCalendar = lazy(() => import('../pages/attendance/StaffAttendanceCalendar'));
const StaffAttendanceReport = lazy(() => import('../pages/attendance/StaffAttendanceReport'));
const StudentDailyAttendance = lazy(() => import('../pages/attendance/StudentDailyAttendance'));
const StudentAttendanceReport = lazy(() => import('../pages/attendance/StudentAttendanceReport'));
const StudentAttHub = lazy(() => import('../pages/attendance/students/StudentAttHub'));
const StudentAttScreenPage = lazy(() => import('../pages/attendance/students/StudentAttScreenPage'));
const StaffLivePunch = lazy(() => import('../pages/attendance/StaffLivePunch'));
const StaffAttHub = lazy(() => import('../pages/attendance/staff/StaffAttHub'));
const StaffAttSetupPage = lazy(() => import('../pages/attendance/staff/StaffAttSetupPage'));
const StaffAttScreenPage = lazy(() => import('../pages/attendance/staff/StaffAttScreenPage'));
const FeeHub = lazy(() => import('../pages/fees/FeeHub'));
const FeeCollection = lazy(() => import('../pages/fees/FeeCollection'));
const FeeCollectionReport = lazy(() => import('../pages/fees/FeeCollectionReport'));
const StudentFeeHistory = lazy(() => import('../pages/fees/StudentFeeHistory'));
const FeePendingSlips = lazy(() => import('../pages/fees/FeePendingSlips'));
const FeeSlipApprove = lazy(() => import('../pages/fees/FeeSlipApprove'));
const FeeDashboard = lazy(() => import('../pages/fees/FeeDashboard'));
const FeeSetupHub = lazy(() => import('../pages/fees/FeeSetupHub'));
const FeeSetupPage = lazy(() => import('../pages/fees/FeeSetupPage'));
const FeeApprovedSlips = lazy(() => import('../pages/fees/FeeApprovedSlips'));
const FeeDeleteHub = lazy(() => import('../pages/fees/FeeDeleteHub'));
const FeeDeleteRequest = lazy(() => import('../pages/fees/FeeDeleteRequest'));
const FeeDeleteApprove = lazy(() => import('../pages/fees/FeeDeleteApprove'));
const FeeDeleteReport = lazy(() => import('../pages/fees/FeeDeleteReport'));
const FeePendingSms = lazy(() => import('../pages/fees/FeePendingSms'));
const FeePendingLetter = lazy(() => import('../pages/fees/FeePendingLetter'));
const FeeAcmecConfigPage = lazy(() => import('../pages/fees/FeeAcmecConfigPage'));
const AcademicHub = lazy(() => import('../pages/academic/AcademicHub'));
const AcademicSetupHub = lazy(() => import('../pages/academic/AcademicSetupHub'));
const AcademicSetupPage = lazy(() => import('../pages/academic/AcademicSetupPage'));
const AcademicCourseList = lazy(() => import('../pages/academic/AcademicCourseList'));
const AcademicCourseEditPage = lazy(() => import('../pages/academic/AcademicCourseEditPage'));
const AcademicReportsHub = lazy(() => import('../pages/academic/AcademicReportsHub'));
const CurriculumHub = lazy(() => import('../pages/academic/CurriculumHub'));
const ExamHub = lazy(() => import('../pages/exam/ExamHub'));
const ExamSetupHub = lazy(() => import('../pages/exam/ExamSetupHub'));
const ExamSetupPage = lazy(() => import('../pages/exam/ExamSetupPage'));
const ExamReportsHub = lazy(() => import('../pages/exam/ExamReportsHub'));
const ExamDashboard = lazy(() => import('../pages/exam/ExamDashboard'));
const ExamStudentStatement = lazy(() => import('../pages/exam/ExamStudentStatement'));
const ReportsHub = lazy(() => import('../pages/reports/ReportsHub'));
const AdminHub = lazy(() => import('../pages/admin/AdminHub'));
const AdminSetupPage = lazy(() => import('../pages/admin/AdminSetupPage'));
const AdminUserList = lazy(() => import('../pages/admin/AdminUserList'));
const AdminUserEditPage = lazy(() => import('../pages/admin/AdminUserEditPage'));
const AdminLogDashboard = lazy(() => import('../pages/admin/AdminLogDashboard'));
const AdminLogDetails = lazy(() => import('../pages/admin/AdminLogDetails'));
const PayrollHub = lazy(() => import('../pages/payroll/PayrollHub'));
const PayrollDashboard = lazy(() => import('../pages/payroll/PayrollDashboard'));
const PayrollConsolidatedReport = lazy(() => import('../pages/payroll/PayrollConsolidatedReport'));
const PayrollIndividualBundle = lazy(() => import('../pages/payroll/PayrollIndividualBundle'));
const PayrollIndividualReport = lazy(() => import('../pages/payroll/PayrollIndividualReport'));
const PayrollGroupReport = lazy(() => import('../pages/payroll/PayrollGroupReport'));
const PayrollSetupHub = lazy(() => import('../pages/payroll/PayrollSetupHub'));
const PayrollSetupPage = lazy(() => import('../pages/payroll/PayrollSetupPage'));
const StipendAttReport = lazy(() => import('../pages/payroll/StipendAttReport'));
const StipendGeneratePayroll = lazy(() => import('../pages/payroll/StipendGeneratePayroll'));
const StipendHub = lazy(() => import('../pages/payroll/StipendHub'));
const StipendSetupPage = lazy(() => import('../pages/payroll/StipendSetupPage'));
const StipendIndividualReport = lazy(() => import('../pages/payroll/StipendIndividualReport'));
const StipendIndividualPdfReport = lazy(() => import('../pages/payroll/StipendIndividualPdfReport'));
const StipendPayrollReport = lazy(() => import('../pages/payroll/StipendPayrollReport'));
const StipendSalaryStatement = lazy(() => import('../pages/payroll/StipendSalaryStatement'));
const SalaryStatement = lazy(() => import('../pages/payroll/SalaryStatement'));
const SalarySummary = lazy(() => import('../pages/payroll/SalarySummary'));
const GeneratePayroll = lazy(() => import('../pages/payroll/GeneratePayroll'));
const PayrollAttReport = lazy(() => import('../pages/payroll/PayrollReportPages').then((m) => ({ default: m.PayrollAttReport })));
const PayrollMonthlyReport = lazy(() => import('../pages/payroll/PayrollReportPages').then((m) => ({ default: m.PayrollMonthlyReport })));
const PayrollTaxReport = lazy(() => import('../pages/payroll/PayrollReportPages').then((m) => ({ default: m.PayrollTaxReport })));
const SettingsHub = lazy(() => import('../pages/settings/SettingsHub'));
const SettingsSetupHub = lazy(() => import('../pages/settings/SettingsSetupHub'));
const SettingsSetupPage = lazy(() => import('../pages/settings/SettingsSetupPage'));
const LibraryHub = lazy(() => import('../pages/library/LibraryHub'));
const LibrarySetupPage = lazy(() => import('../pages/library/LibrarySetupPage'));
const HostelHub = lazy(() => import('../pages/hostel/HostelHub'));
const HostelSetupPage = lazy(() => import('../pages/hostel/HostelSetupPage'));
const CircularHub = lazy(() => import('../pages/circular/CircularHub'));
const CircularSetupPage = lazy(() => import('../pages/circular/CircularSetupPage'));
const SmsHub = lazy(() => import('../pages/sms/SmsModule').then((m) => ({ default: m.SmsHub })));
const SmsSetupHub = lazy(() => import('../pages/sms/SmsModule').then((m) => ({ default: m.SmsSetupHub })));
const SmsSetupPage = lazy(() => import('../pages/sms/SmsModule').then((m) => ({ default: m.SmsSetupPage })));
const WebHub = lazy(() => import('../pages/web/WebModule').then((m) => ({ default: m.WebHub })));
const WebSetupHub = lazy(() => import('../pages/web/WebModule').then((m) => ({ default: m.WebSetupHub })));
const WebSetupPage = lazy(() => import('../pages/web/WebModule').then((m) => ({ default: m.WebSetupPage })));
const TvHub = lazy(() => import('../pages/tv/TvModule').then((m) => ({ default: m.TvHub })));
const TvSetupHub = lazy(() => import('../pages/tv/TvModule').then((m) => ({ default: m.TvSetupHub })));
const TvSetupPage = lazy(() => import('../pages/tv/TvModule').then((m) => ({ default: m.TvSetupPage })));
const TvDashboardPage = lazy(() => import('../pages/tv/TvDashboardPage'));
const KioskHub = lazy(() => import('../pages/kiosk/KioskModule').then((m) => ({ default: m.KioskHub })));
const KioskSetupHub = lazy(() => import('../pages/kiosk/KioskModule').then((m) => ({ default: m.KioskSetupHub })));
const KioskSetupPage = lazy(() => import('../pages/kiosk/KioskModule').then((m) => ({ default: m.KioskSetupPage })));
const CommitteeHub = lazy(() => import('../pages/committee/CommitteeModule').then((m) => ({ default: m.CommitteeHub })));
const CommitteeSetupHub = lazy(() => import('../pages/committee/CommitteeModule').then((m) => ({ default: m.CommitteeSetupHub })));
const CommitteeSetupPage = lazy(() => import('../pages/committee/CommitteeModule').then((m) => ({ default: m.CommitteeSetupPage })));
const CertificateHub = lazy(() => import('../pages/certificate/CertificateModule').then((m) => ({ default: m.CertificateHub })));
const CertificateSetupHub = lazy(() => import('../pages/certificate/CertificateModule').then((m) => ({ default: m.CertificateSetupHub })));
const CertificateSetupPage = lazy(() => import('../pages/certificate/CertificateModule').then((m) => ({ default: m.CertificateSetupPage })));
const NaacHub = lazy(() => import('../pages/naac/NaacModule').then((m) => ({ default: m.NaacHub })));
const NaacSetupHub = lazy(() => import('../pages/naac/NaacModule').then((m) => ({ default: m.NaacSetupHub })));
const NaacSetupPage = lazy(() => import('../pages/naac/NaacModule').then((m) => ({ default: m.NaacSetupPage })));
const PortfolioHub = lazy(() => import('../pages/portfolio/PortfolioModule').then((m) => ({ default: m.PortfolioHub })));
const PortfolioDashboardPage = lazy(() => import('../pages/portfolio/PortfolioDashboardPage'));
const PortfolioIndividualReportPage = lazy(() => import('../pages/portfolio/PortfolioIndividualReportPage'));
const AdminOfficeHub = lazy(() => import('../pages/adminOffice/AdminOfficeHub'));
const AdminOfficeSetupPage = lazy(() => import('../pages/adminOffice/AdminOfficeSetupPage'));
const ElearningHub = lazy(() => import('../pages/elearning/ElearningModule').then((m) => ({ default: m.ElearningHub })));
const ElearningSetupHub = lazy(() => import('../pages/elearning/ElearningModule').then((m) => ({ default: m.ElearningSetupHub })));
const ElearningSetupPage = lazy(() => import('../pages/elearning/ElearningModule').then((m) => ({ default: m.ElearningSetupPage })));
const ElearnDashboardPage = lazy(() => import('../pages/elearning/ElearningModule').then((m) => ({ default: m.ElearnDashboardPage })));

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

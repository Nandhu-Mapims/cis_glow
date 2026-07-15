import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import api from '../../api/client';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
import {
  collectLegacyFormFiles,
  isAcademicReportScreen,
  isAcademicSetupSaveAction,
  serializeLegacyForm,
} from '../../utils/legacyFormSerialize';
import { printReportHtml } from '../../utils/printReport';
import { ACADEMIC_SCREEN_META } from './academicSetupMeta';
import { isCurriculumScreen } from './curriculumMeta';
import AcademicCalendarSetup from './setup/AcademicCalendarSetup';
import AcademicYearsSetup from './setup/AcademicYearsSetup';
import AdmissionExamSetup from './setup/AdmissionExamSetup';
import BatchTimetableReportSetup from './setup/BatchTimetableReportSetup';
import CourseAddSetup from './setup/CourseAddSetup';
import CourseEditSetup from './setup/CourseEditSetup';
import MasterSetupSetup from './setup/MasterSetupSetup';
import SubjectBatchSetup from './setup/SubjectBatchSetup';
import SubjectMasterSetup from './setup/SubjectMasterSetup';
import SubjectReportSetup from './setup/SubjectReportSetup';
import SubjectScheduleSetup from './setup/SubjectScheduleSetup';
import SubjectSetupSetup from './setup/SubjectSetupSetup';
import SubjectUnitSetup from './setup/SubjectUnitSetup';
import TimetableReportSetup from './setup/TimetableReportSetup';
import TtConfigSetup from './setup/TtConfigSetup';
import TtConfigV3Setup from './setup/TtConfigV3Setup';
import BatchColorSetup from './setup/BatchColorSetup';
import FeedbackTopicSetup from './setup/FeedbackTopicSetup';
import PeriodSetupSetup from './setup/PeriodSetupSetup';
import InternshipScheduleSetup from './setup/InternshipScheduleSetup';
import FeedbackConfigSetup from './setup/FeedbackConfigSetup';
import CurriculumReportScreen from './setup/CurriculumReportScreen';
import { CURRICULUM_REPORT_SCREENS } from './curriculumReportConfig';
import './AcademicSetupPage.css';

function makeReportScreen(screen) {
  return function CurriculumReportWrapper() {
    return <CurriculumReportScreen screen={screen} />;
  };
}

const REPORT_NATIVE_SCREENS = Object.fromEntries(
  [...CURRICULUM_REPORT_SCREENS].map((screen) => [screen, makeReportScreen(screen)]),
);

const NATIVE_SCREENS = {
  'subject-master': SubjectMasterSetup,
  'course-add': CourseAddSetup,
  'course-edit': CourseEditSetup,
  'academic-years': AcademicYearsSetup,
  'master-setup': MasterSetupSetup,
  'admission-exam': AdmissionExamSetup,
  'academic-calendar': AcademicCalendarSetup,
  'subject-setup': SubjectSetupSetup,
  'subject-batch': SubjectBatchSetup,
  'subject-unit': SubjectUnitSetup,
  'subject-schedule': SubjectScheduleSetup,
  'tt-config': TtConfigSetup,
  'tt-config-v3': TtConfigV3Setup,
  'batch-color': BatchColorSetup,
  'feedback-topics': FeedbackTopicSetup,
  'period-setup': PeriodSetupSetup,
  'internship-schedule': InternshipScheduleSetup,
  'feedback-config-ug': () => <FeedbackConfigSetup screen="feedback-config-ug" />,
  'feedback-config-pg': () => <FeedbackConfigSetup screen="feedback-config-pg" />,
  'subject-report': SubjectReportSetup,
  'timetable-report': TimetableReportSetup,
  'batch-timetable-report': BatchTimetableReportSetup,
  ...REPORT_NATIVE_SCREENS,
};

function findLegacyForm(root) {
  return root.querySelector('#signupForm') || root.querySelector('#fm_validation');
}

export default function AcademicSetupPage({
  screen: screenProp,
  initialFields = null,
  initialQuery = null,
}) {
  const { screen: routeScreen } = useParams();
  const screen = screenProp || routeScreen;
  const meta = ACADEMIC_SCREEN_META[screen];
  const NativeComponent = NATIVE_SCREENS[screen];
  const containerRef = useRef(null);
  const scriptRef = useRef(null);
  const initialFieldsRef = useRef(initialFields);
  const initialQueryRef = useRef(initialQuery);
  const isReport = isAcademicReportScreen(screen);
  const isCurriculum = isCurriculumScreen(screen);
  const hubPath = isCurriculum
    ? '/academic/curriculum'
    : (meta?.hub === 'reports' ? '/academic/reports' : '/academic/setup');
  const hubLabel = isCurriculum ? 'Curriculum' : (meta?.hub === 'reports' ? 'Reports' : 'Setup');

  const { settings, menu } = useOutletContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [html, setHtml] = useState('');
  const [scripts, setScripts] = useState('');

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const applyScripts = useCallback((code) => {
    if (scriptRef.current) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }
    if (!code || !containerRef.current) return;

    const script = document.createElement('script');
    script.textContent = code;
    containerRef.current.appendChild(script);
    scriptRef.current = script;
  }, []);

  const loadForm = useCallback(async (fields = {}, query = {}) => {
    if (!meta || NativeComponent) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/academic/setup/${screen}/load`, { fields, query });
      if (res.data.code === 'NOT_PORTED') {
        setError(res.data.error || 'This screen is not yet ported to the native API.');
        setHtml('');
        setScripts('');
        return;
      }
      setHtml(res.data.html || '');
      setScripts(res.data.scripts || '');
      if (res.data.message) {
        setNotice(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load academic form');
      setHtml('');
      setScripts('');
    } finally {
      setBusy(false);
    }
  }, [meta, screen, NativeComponent]);

  const printReport = useCallback(() => {
    const panel = containerRef.current?.querySelector('#form_details_panel');
    if (panel) {
      printReportHtml(panel.innerHTML);
      return;
    }
    if (containerRef.current) {
      printReportHtml(containerRef.current.innerHTML);
    }
  }, []);

  useEffect(() => {
    if (!meta || NativeComponent) return;
    const bootFields = initialFieldsRef.current;
    const bootQuery = initialQueryRef.current;
    loadForm(bootFields || {}, bootQuery || {});
    initialFieldsRef.current = null;
    initialQueryRef.current = null;
  }, [meta, NativeComponent, loadForm]);

  useEffect(() => {
    applyScripts(scripts);
    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
    };
  }, [html, scripts, applyScripts]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !html) return undefined;

    const form = findLegacyForm(root);
    if (!form) return undefined;

    const onSubmit = async (event) => {
      event.preventDefault();
      const fields = serializeLegacyForm(form, event.submitter);
      setNotice(null);
      setError(null);
      setBusy(true);
      try {
        if (isAcademicSetupSaveAction(fields)) {
          const files = await collectLegacyFormFiles(form);
          const res = await api.post(`/api/academic/setup/${screen}/save`, { fields, files });
          setHtml(res.data.html || '');
          setScripts(res.data.scripts || '');
          if (res.data.success) {
            setNotice(res.data.message || 'Saved.');
          } else {
            setError(res.data.message || 'Could not save — check the form and try again.');
          }
        } else {
          await loadForm(fields);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Request failed');
      } finally {
        setBusy(false);
      }
    };

    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [html, screen, loadForm]);

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Academic"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Academic', to: '/academic' },
          { label: 'Setup', to: '/academic/setup' },
          { label: 'Unknown' },
        ]}
        backTo="/academic/setup"
      >
        <p className="text-danger mb-0">Unknown academic screen.</p>
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
        { label: 'Academic', to: '/academic' },
        { label: hubLabel, to: hubPath },
        { label: meta.title },
      ]}
      actions={(
        <div className="d-flex gap-2 flex-wrap">
          {isReport && html && !NativeComponent && (
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={printReport}>
              Print report
            </button>
          )}
          {screen === 'course-edit' && (
            <Link to="/academic/courses" className="btn btn-outline-primary btn-sm">Course list</Link>
          )}
          <Link to={hubPath} className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      )}
      alerts={(
        <SetupAlerts
          notice={notice}
          error={error}
          busy={busy}
          onDismissNotice={() => setNotice(null)}
        />
      )}
      cardClassName="cis-setup-card academic-setup-card"
      rootClassName="cis-setup-root academic-setup-root"
      bodyRef={containerRef}
    >
      {NativeComponent ? (
        <NativeComponent />
      ) : html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        !busy && <p className="text-muted mb-0">No form content returned.</p>
      )}
    </SetupPageShell>
  );
}

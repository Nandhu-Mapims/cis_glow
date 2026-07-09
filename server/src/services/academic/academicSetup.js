import { unportedSetupScreen } from '../shared/unportedScreen.js';
import { loadBatchTimetableReport, saveBatchTimetableReport } from './reports/batchTimetableReportSetup.js';
import { loadSubjectReport, saveSubjectReport } from './reports/subjectReportSetup.js';
import { loadTimetableReport, saveTimetableReport } from './reports/timetableReportSetup.js';
import { loadAcademicCalendar, saveAcademicCalendar } from './setup/academicCalendarSetup.js';
import { loadAdmissionExam, saveAdmissionExam } from './setup/admissionExamSetup.js';
import { loadAcademicYears, saveAcademicYears } from './setup/academicYearsSetup.js';
import { loadCourseAdd, saveCourseAdd } from './setup/courseAddSetup.js';
import { loadCourseEdit, saveCourseEdit } from './setup/courseEditSetup.js';
import { loadMasterSetup, saveMasterSetup } from './setup/masterSetupSetup.js';
import { loadSubjectBatch, saveSubjectBatch } from './setup/subjectBatchSetup.js';
import { loadSubjectSchedule, saveSubjectSchedule } from './setup/subjectScheduleSetup.js';
import { loadSubjectSetup, saveSubjectSetup } from './setup/subjectSetupSetup.js';
import { loadSubjectMaster, saveSubjectMaster } from './setup/subjectMasterSetup.js';
import { loadSubjectUnit, saveSubjectUnit } from './setup/subjectUnitSetup.js';
import { loadTtConfig, saveTtConfig } from './setup/ttConfigSetup.js';
import {
  CURRICULUM_LOADERS,
  CURRICULUM_SAVERS,
  CURRICULUM_SCREEN_SLUGS,
} from './curriculumScreenRegistry.js';

const BASE_SCREENS = [
  'subject-master',
  'course-add',
  'course-edit',
  'academic-years',
  'subject-setup',
  'subject-batch',
  'academic-calendar',
  'subject-schedule',
  'subject-unit',
  'admission-exam',
  'master-setup',
  'subject-report',
  'timetable-report',
  'batch-timetable-report',
  'tt-config',
];

const VALID_SCREENS = new Set([...BASE_SCREENS, ...CURRICULUM_SCREEN_SLUGS]);

const NATIVE_SCREENS = new Set([...BASE_SCREENS, ...CURRICULUM_SCREEN_SLUGS]);

const LOADERS = {
  'subject-master': (memberId, fields, _query, audit) => loadSubjectMaster(memberId, fields, audit),
  'course-add': (memberId, _fields, _query, audit) => loadCourseAdd(memberId, {}, audit),
  'course-edit': (memberId, fields, _query, audit) => loadCourseEdit(memberId, fields, audit),
  'academic-years': (memberId, _fields, _query, audit) => loadAcademicYears(memberId, {}, audit),
  'master-setup': (memberId, fields, _query, audit) => loadMasterSetup(memberId, fields, audit),
  'admission-exam': (memberId, fields, _query, audit) => loadAdmissionExam(memberId, fields, audit),
  'academic-calendar': (memberId, fields, _query, audit) => loadAcademicCalendar(memberId, fields, audit),
  'subject-setup': (memberId, fields, _query, audit) => loadSubjectSetup(memberId, fields, audit),
  'subject-batch': (memberId, fields, _query, audit) => loadSubjectBatch(memberId, fields, audit),
  'subject-unit': (memberId, fields, _query, audit) => loadSubjectUnit(memberId, fields, audit),
  'subject-schedule': (memberId, fields, _query, audit) => loadSubjectSchedule(memberId, fields, audit),
  'tt-config': (memberId, fields, _query, audit) => loadTtConfig(memberId, fields, audit),
  'subject-report': (memberId, fields, _query, audit) => loadSubjectReport(memberId, fields, audit),
  'timetable-report': (memberId, fields, _query, audit) => loadTimetableReport(memberId, fields, audit),
  'batch-timetable-report': (memberId, fields, _query, audit) => loadBatchTimetableReport(memberId, fields, audit),
  ...CURRICULUM_LOADERS,
};

const SAVERS = {
  'subject-master': (fields, memberId, _files, audit) => saveSubjectMaster(fields, memberId, audit),
  'course-add': (fields, memberId, _files, audit) => saveCourseAdd(fields, memberId, audit),
  'course-edit': (fields, memberId, _files, audit) => saveCourseEdit(fields, memberId, audit),
  'academic-years': (fields, memberId, _files, audit) => saveAcademicYears(fields, memberId, audit),
  'master-setup': (fields, memberId, _files, audit) => saveMasterSetup(fields, memberId, audit),
  'admission-exam': (fields, memberId, _files, audit) => saveAdmissionExam(fields, memberId, audit),
  'academic-calendar': (fields, memberId, _files, audit) => saveAcademicCalendar(fields, memberId, audit),
  'subject-setup': (fields, memberId, _files, audit) => saveSubjectSetup(fields, memberId, audit),
  'subject-batch': (fields, memberId, _files, audit) => saveSubjectBatch(fields, memberId, audit),
  'subject-unit': (fields, memberId, _files, audit) => saveSubjectUnit(fields, memberId, audit),
  'subject-schedule': (fields, memberId, _files, audit) => saveSubjectSchedule(fields, memberId, audit),
  'tt-config': (fields, memberId, _files, audit) => saveTtConfig(fields, memberId, audit),
  'subject-report': (fields, memberId, _files, audit) => saveSubjectReport(fields, memberId, audit),
  'timetable-report': (fields, memberId, _files, audit) => saveTimetableReport(fields, memberId, audit),
  'batch-timetable-report': (fields, memberId, _files, audit) => saveBatchTimetableReport(fields, memberId, audit),
  ...CURRICULUM_SAVERS,
};

export function assertAcademicSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown academic setup screen' };
  }
  return null;
}

export async function loadAcademicSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertAcademicSetupScreen(screen);
  if (invalid) return invalid;

  if (NATIVE_SCREENS.has(screen)) {
    const loader = LOADERS[screen];
    return loader(memberId, fields || {}, query || {}, audit);
  }

  return unportedSetupScreen('academic', screen);
}

export async function saveAcademicSetupScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertAcademicSetupScreen(screen);
  if (invalid) return invalid;

  if (NATIVE_SCREENS.has(screen)) {
    const saver = SAVERS[screen];
    return saver(fields || {}, memberId, files || [], audit);
  }

  return unportedSetupScreen('academic', screen);
}

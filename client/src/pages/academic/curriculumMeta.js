import { CURRICULUM_REPORT_SCREENS } from './curriculumReportConfig';
import { ACADEMIC_SCREEN_META } from './academicSetupMeta';

export const CURRICULUM_SETUP_SLUGS = [
  'batch-color',
  'feedback-topics',
  'period-setup',
  'internship-schedule',
  'feedback-config-ug',
  'feedback-config-pg',
  'tt-config-v3',
];

export const CURRICULUM_SCREEN_SLUGS = new Set([
  ...CURRICULUM_SETUP_SLUGS,
  ...CURRICULUM_REPORT_SCREENS,
]);

const SECTIONS = [
  {
    section: 'Time & periods',
    icon: 'fa fa-clock-o',
    slugs: ['period-setup', 'batch-color', 'tt-config-v3'],
  },
  {
    section: 'Feedback',
    icon: 'fa fa-comments-o',
    slugs: ['feedback-topics', 'feedback-config-ug', 'feedback-config-pg', 'feedback-dashboard', 'feedback-report-ug', 'feedback-report-pg'],
  },
  {
    section: 'Clinical & internship',
    icon: 'fa fa-hospital-o',
    slugs: ['internship-schedule'],
  },
  {
    section: 'Live status',
    icon: 'fa fa-dashboard',
    slugs: ['subject-dashboard', 'subject-schedule-report', 'subject-timing'],
  },
  {
    section: 'Timetables',
    icon: 'fa fa-calendar',
    slugs: ['class-timetable', 'class-timetable-v3'],
  },
  {
    section: 'Completion & attendance',
    icon: 'fa fa-check-square-o',
    slugs: ['subject-handle', 'staff-period-completed', 'department-period-completed', 'subject-handle-grid'],
  },
];

function screenPath(slug) {
  const meta = ACADEMIC_SCREEN_META[slug];
  if (!meta) return `/academic/setup/${slug}`;
  return meta.hub === 'reports' ? `/academic/reports/${slug}` : `/academic/setup/${slug}`;
}

function buildHubLink(slug, section, defaultIcon) {
  const meta = ACADEMIC_SCREEN_META[slug];
  if (!meta) return null;
  return {
    to: screenPath(slug),
    title: meta.title,
    desc: `Legacy: ${meta.legacy}`,
    section,
    icon: defaultIcon,
  };
}

export function isCurriculumScreen(screen) {
  return CURRICULUM_SCREEN_SLUGS.has(screen);
}

export function buildCurriculumHubLinks() {
  const links = [];
  for (const { section, icon, slugs } of SECTIONS) {
    for (const slug of slugs) {
      const link = buildHubLink(slug, section, icon);
      if (link) links.push(link);
    }
  }
  return links;
}

export const CURRICULUM_HUB_LINKS = buildCurriculumHubLinks();

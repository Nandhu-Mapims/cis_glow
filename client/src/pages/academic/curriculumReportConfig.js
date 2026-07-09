/** Filter UI types for curriculum report screens */
export const CURRICULUM_REPORT_SCREENS = new Set([
  'subject-dashboard',
  'subject-schedule-report',
  'subject-timing',
  'feedback-dashboard',
  'class-timetable',
  'class-timetable-v3',
  'feedback-report-ug',
  'feedback-report-pg',
  'subject-handle',
  'staff-period-completed',
  'department-period-completed',
  'subject-handle-grid',
]);

export const CURRICULUM_REPORT_CONFIG = {
  'subject-dashboard': { type: 'datetime', goLabel: 'Go' },
  'subject-schedule-report': { type: 'course-cyear-month', goLabel: 'Generate' },
  'subject-timing': { type: 'course-semester', goLabel: 'Go' },
  'feedback-dashboard': { type: 'feedback', goLabel: 'Generate' },
  'class-timetable': { type: 'course-semester-batch', goLabel: 'Go' },
  'class-timetable-v3': { type: 'course-semester-batch', goLabel: 'Go' },
  'feedback-report-ug': { type: 'feedback-course', goLabel: 'Generate' },
  'feedback-report-pg': { type: 'feedback-course', goLabel: 'Generate' },
  'subject-handle': { type: 'course-cyear-range', goLabel: 'Generate' },
  'staff-period-completed': { type: 'staff-range', goLabel: 'Generate' },
  'department-period-completed': { type: 'dept-range', goLabel: 'Generate' },
  'subject-handle-grid': { type: 'course-cyear-range', goLabel: 'Generate' },
};

export const CURRICULUM_REPORT_EMPTY = {
  'subject-dashboard': {
    title: 'No staff periods found for the selected date and time.',
    hint: 'Try Now, Today 09:00, or pick another date/time.',
  },
  'subject-schedule-report': {
    title: 'No schedule data for the selected course and month.',
    hint: 'Try a different course/year or month.',
  },
  'subject-timing': {
    title: 'No subject timing data found.',
    hint: 'Select another course or semester.',
  },
  'feedback-dashboard': {
    title: 'No feedback status data found.',
    hint: 'Try another feedback round.',
  },
  'class-timetable': {
    title: 'No class timetable found.',
    hint: 'Select another course or semester.',
  },
  'class-timetable-v3': {
    title: 'No class timetable found.',
    hint: 'Select another course or semester.',
  },
  'feedback-report-ug': {
    title: 'No feedback report data found.',
    hint: 'Change feedback round, type, course, or subjects.',
  },
  'feedback-report-pg': {
    title: 'No feedback report data found.',
    hint: 'Change feedback round, type, course, or subjects.',
  },
  'subject-handle': {
    title: 'No period completion records found.',
    hint: 'Try a different course/year or date range.',
  },
  'staff-period-completed': {
    title: 'No staff period records found.',
    hint: 'Try another staff member or date range.',
  },
  'department-period-completed': {
    title: 'No department period records found.',
    hint: 'Try another department or date range.',
  },
  'subject-handle-grid': {
    title: 'No subject attendance grid found.',
    hint: 'Try a different course/year or date range.',
  },
};

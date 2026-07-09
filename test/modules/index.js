import { foundationTests } from './foundation.js';
import { dashboardTests } from './dashboard.js';
import { studentTests } from './students.js';
import { staffTests } from './staff.js';
import { attendanceTests } from './attendance.js';
import { feesTests } from './fees.js';
import { academicTests } from './academic.js';
import { examTests } from './exam.js';
import { payrollTests } from './payroll.js';
import { hostelTests } from './hostel.js';
import { libraryTests } from './library.js';
import { adminTests } from './admin.js';
import { settingsTests } from './settings.js';
import { webTests } from './web.js';
import {
  elearningTests,
  portfolioTests,
  smsTests,
  committeeTests,
  certificateTests,
  circularTests,
  naacTests,
  adminOfficeTests,
  tvTests,
  kioskTests,
} from './others.js';

/** All CRUD verification tests, grouped by module. */
export const allTests = [
  ...foundationTests,
  ...dashboardTests,
  ...studentTests,
  ...staffTests,
  ...attendanceTests,
  ...feesTests,
  ...academicTests,
  ...examTests,
  ...payrollTests,
  ...hostelTests,
  ...libraryTests,
  ...adminTests,
  ...settingsTests,
  ...webTests,
  ...elearningTests,
  ...portfolioTests,
  ...smsTests,
  ...committeeTests,
  ...certificateTests,
  ...circularTests,
  ...naacTests,
  ...adminOfficeTests,
  ...tvTests,
  ...kioskTests,
];

export const modules = [...new Set(allTests.map((t) => t.module))];

# 09 — Academic Module

> Deep-dive companion to [`../userstory.md`](../userstory.md). Everything here is grounded in the
> real code under `client/src/pages/academic/`, `server/src/routes/academic.js`, and
> `server/src/services/academic/**` — file paths and table names are cited so each story can be
> verified against the repo. Legacy source of truth: `/home/mapims/cis/cis/*.php`.

## 1. Module overview

The Academic module is the registrar/academic-office surface for **courses, subjects, the
institution academic calendar, timetables (two generations — legacy `tt_config` and newer
`tt_config_v3`), subject batches, period/time-slot configuration, feedback rounds, internship
scheduling, and curriculum reports**. It is the largest single-module surface in the app: one
route dispatcher (`AcademicSetupPage.jsx`) fans out to **33 native React screens**, all backed by
one generic `POST /api/academic/setup/:screen/load|save` contract.

**Actors**

- **Registrar / academic office staff** — configure courses, academic years, calendar, master
  data, subject setup, subject batches.
- **HOD / department coordinator** — configure subject batches, internship schedules, period
  timing, feedback topics.
- **Timetable coordinator / faculty scheduler** — allocate staff/subjects into the weekly
  timetable grid (`tt-config`, `tt-config-v3`), subject-wise monthly schedule
  (`subject-schedule`).
- **Faculty / staff** — indirectly, as the people assigned into timetable cells and feedback
  subject rows.
- **Admin/back-office viewers** — run curriculum reports (dashboards, feedback status, period
  completion) for oversight.

**Legacy `.php` files this module replaces** (from `client/src/pages/academic/academicSetupMeta.js`):

`subject_master.php`, `course_add.php`, `course_edit.php`, `academic.php`, `subject_setup.php`,
`subject_batch.php`, `academic_calendar.php`, `subject_schedule.php`,
`subject_unit_setup_v2.php`, `academic_admission_setup.php`, `master_setup.php`,
`subject_report.php`, `timetable_class_report.php`, `class_time_table_batch_report.php`,
`tt_config.php`, `batch_color_setup.php`, `feedback_topic.php`, `period_setup.php`,
`internship_schedule.php`, `feedback_config.php`, `feedback_config_pg.php`, `tt_config_v3.php`,
`subject_dashboard.php`, `subject_schedule_report.php`, `subject_timing.php`,
`feedback_dashboard.php`, `class_time_table.php`, `class_time_table_v3.php`,
`feedback_report.php`, `feedback_report_pg.php`, `subject_handle.php`,
`staff_period_completed.php`, `department_period_completed.php`, `subject_handle1.php`.

All 33 screens in `ACADEMIC_SCREEN_META` (`client/src/pages/academic/academicSetupMeta.js`) have a
**native React component** registered in `NATIVE_SCREENS` / `REPORT_NATIVE_SCREENS`
(`AcademicSetupPage.jsx`); none currently fall back to the legacy-HTML-injection path
(`dangerouslySetInnerHTML` on a PHP-bridge response) — that code path exists in
`AcademicSetupPage.jsx` (`loadForm`, `findLegacyForm`) but is effectively dead for this module
today since every meta entry has a native component.

## 2. Screen inventory

| Route | Component file | Legacy `.php` counterpart |
|---|---|---|
| `/academic` | `client/src/pages/academic/AcademicHub.jsx` | (hub, no direct legacy page) |
| `/academic/curriculum` | `client/src/pages/academic/CurriculumHub.jsx` | (hub) |
| `/academic/setup` | `client/src/pages/academic/AcademicSetupHub.jsx` | (hub) |
| `/academic/reports` | `client/src/pages/academic/AcademicReportsHub.jsx` | (hub) |
| `/academic/courses` | `client/src/pages/academic/AcademicCourseList.jsx` | (course directory, no single legacy page) |
| `/academic/courses/:courseId/edit` | `client/src/pages/academic/AcademicCourseEditPage.jsx` (wraps `course-edit`) | `course_edit.php` |
| `/academic/setup/subject-master` | `setup/SubjectMasterSetup.jsx` | `subject_master.php` |
| `/academic/setup/course-add` | `setup/CourseAddSetup.jsx` | `course_add.php` |
| `/academic/setup/course-edit` | `setup/CourseEditSetup.jsx` | `course_edit.php` |
| `/academic/setup/academic-years` | `setup/AcademicYearsSetup.jsx` | `academic.php` |
| `/academic/setup/subject-setup` | `setup/SubjectSetupSetup.jsx` | `subject_setup.php` |
| `/academic/setup/subject-batch` | `setup/SubjectBatchSetup.jsx` | `subject_batch.php` |
| `/academic/setup/academic-calendar` | `setup/AcademicCalendarSetup.jsx` | `academic_calendar.php` |
| `/academic/setup/subject-schedule` | `setup/SubjectScheduleSetup.jsx` | `subject_schedule.php` |
| `/academic/setup/subject-unit` | `setup/SubjectUnitSetup.jsx` | `subject_unit_setup_v2.php` |
| `/academic/setup/admission-exam` | `setup/AdmissionExamSetup.jsx` | `academic_admission_setup.php` |
| `/academic/setup/master-setup` | `setup/MasterSetupSetup.jsx` | `master_setup.php` |
| `/academic/reports/subject-report` | `setup/SubjectReportSetup.jsx` | `subject_report.php` |
| `/academic/reports/timetable-report` | `setup/TimetableReportSetup.jsx` | `timetable_class_report.php` |
| `/academic/reports/batch-timetable-report` | `setup/BatchTimetableReportSetup.jsx` | `class_time_table_batch_report.php` |
| `/academic/setup/tt-config` | `setup/TtConfigSetup.jsx` | `tt_config.php` |
| `/academic/setup/batch-color` | `setup/BatchColorSetup.jsx` | `batch_color_setup.php` |
| `/academic/setup/feedback-topics` | `setup/FeedbackTopicSetup.jsx` | `feedback_topic.php` |
| `/academic/setup/period-setup` | `setup/PeriodSetupSetup.jsx` | `period_setup.php` |
| `/academic/setup/internship-schedule` | `setup/InternshipScheduleSetup.jsx` | `internship_schedule.php` |
| `/academic/setup/feedback-config-ug` | `setup/FeedbackConfigSetup.jsx` (`screen="feedback-config-ug"`) | `feedback_config.php` |
| `/academic/setup/feedback-config-pg` | `setup/FeedbackConfigSetup.jsx` (`screen="feedback-config-pg"`) | `feedback_config_pg.php` |
| `/academic/setup/tt-config-v3` | `setup/TtConfigV3Setup.jsx` | `tt_config_v3.php` |
| `/academic/reports/subject-dashboard` | `setup/CurriculumReportScreen.jsx` (`screen="subject-dashboard"`) | `subject_dashboard.php` |
| `/academic/reports/subject-schedule-report` | `CurriculumReportScreen` (`subject-schedule-report`) | `subject_schedule_report.php` |
| `/academic/reports/subject-timing` | `CurriculumReportScreen` (`subject-timing`) | `subject_timing.php` |
| `/academic/reports/feedback-dashboard` | `CurriculumReportScreen` (`feedback-dashboard`) | `feedback_dashboard.php` |
| `/academic/reports/class-timetable` | `CurriculumReportScreen` (`class-timetable`) | `class_time_table.php` |
| `/academic/reports/class-timetable-v3` | `CurriculumReportScreen` (`class-timetable-v3`) | `class_time_table_v3.php` |
| `/academic/reports/feedback-report-ug` | `CurriculumReportScreen` (`feedback-report-ug`) | `feedback_report.php` |
| `/academic/reports/feedback-report-pg` | `CurriculumReportScreen` (`feedback-report-pg`) | `feedback_report_pg.php` |
| `/academic/reports/subject-handle` | `CurriculumReportScreen` (`subject-handle`) | `subject_handle.php` |
| `/academic/reports/staff-period-completed` | `CurriculumReportScreen` (`staff-period-completed`) | `staff_period_completed.php` |
| `/academic/reports/department-period-completed` | `CurriculumReportScreen` (`department-period-completed`) | `department_period_completed.php` |
| `/academic/reports/subject-handle-grid` | `CurriculumReportScreen` (`subject-handle-grid`) | `subject_handle1.php` |

Routes come from `client/src/routes/AppRoutes.jsx` (lines ~225-232): `/academic`,
`/academic/curriculum`, `/academic/setup`, `/academic/setup/:screen`, `/academic/courses`,
`/academic/courses/:courseId/edit`, `/academic/reports`, `/academic/reports/:screen`. The
`:screen` param is resolved against `ACADEMIC_SCREEN_META` in `AcademicSetupPage.jsx`. Menu
mapping lives in `client/src/utils/legacyRoutes.js` (lines 157-214), one entry per legacy `.php`
file above.

All setup/report screens share one generic API surface:
`POST /api/academic/setup/:screen/load` and `POST /api/academic/setup/:screen/save`
(`server/src/routes/academic.js`), dispatched by `loadAcademicSetupScreen` /
`saveAcademicSetupScreen` in `server/src/services/academic/academicSetup.js`, which look up
`screen` in `LOADERS`/`SAVERS` (base screens) or `CURRICULUM_LOADERS`/`CURRICULUM_SAVERS`
(`curriculumScreenRegistry.js`, for the 7 curriculum-setup + 12 curriculum-report slugs). An
unknown screen returns `{ error: 'Unknown academic setup screen' }` → HTTP 400 on the route.

## 3. Pixel-level flow per screen

### 3.1 Course Directory — `/academic/courses` (`AcademicCourseList.jsx`)

Not in `academicSetupMeta.js` — a browse-only screen listing `basic_setup_course_tb` rows, used as
an entry point into `course-edit`.

- Breadcrumb: Home / Academic / Courses.
- Header: "Course Directory" title, **Add course** button (→ `/academic/setup/course-add`),
  **Back** button (→ `/academic`).
- Search form: `<input type="search" placeholder="Search course or degree name">` + **Search**
  button.
- Table: columns "Course" (label built server-side as
  `"${courseName} | ${degreeName} - ${departmentName} | ${fullPartTime} (${courseDuration} Years)"`)
  and "Actions" → **Edit** button linking to `/academic/courses/:id/edit`.
- Empty state row: "No courses found."
- Pagination footer: `Page {page} of {totalPages} ({total} courses)` with **Previous**/**Next**
  buttons, shown only when `total > limit`.
- Request: `GET /api/academic/courses?search=&page=` → `listCourses()` in
  `server/src/services/academic/academicCourses.js`, `WHERE del=1` with `OR` on `course_name`,
  `degree_name`, `department_name` (case-sensitive `contains`, no `LOWER()`).
- Response: `{ total, page, limit, courses: [{ id, fullPartTime, courseName, degreeName,
  departmentName, courseDuration, order, label }] }`.

### 3.2 Add Course — `course-add` (`CourseAddSetup.jsx`)

- Fields (row layout, in DOM order):
  1. **Course** `<select>` — options from `data.courseNameOptions`, default `U.G`.
  2. **Full Time / Part Time** radio pair, default "Full Time".
  3. **Degree** `<input required>`.
  4. **Degree Short Name** `<input>` (not required).
  5. **Major** `<input required>` (`departmentName`).
  6. **Major Short Name** `<input required>` (`departmentShortName`).
  7. **Department Name** `<select>` — `data.departmentOptions`, `--Select--` default
     (`departmentRef`).
  8. **Year of Start** `<input required>`.
  9. **Duration (years)** `<input required>` (`courseDuration`).
  10. **Total Semester** `<input required>`.
  11. **Semester Per Year** `<input required>`.
  12. **Display Order** `<input required>`.
  13. Submit button: **Add Course** (`btn-danger`), disabled while `busy`.
- Load: `load()` with no fields → server returns `{ courseNameOptions, departmentOptions,
  defaults }`; `defaults` seeds the form.
- Save: `save(form)` → `saveCourseAdd` (`server/src/services/academic/setup/courseAddSetup.js`)
  → `prisma.basic_setup_course_tb.create(...)`. On missing required fields, returns
  `{ success: false, message: 'Please fill all required fields' }`; on unexpected error,
  `{ success: false, message: 'Please try again...' }`.

### 3.3 Edit / Delete Course — `course-edit` (`CourseEditSetup.jsx`)

Two-mode screen: list mode and edit mode, both driven by one `load()` call.

- **List mode** (`data.mode !== 'edit'`): search `<input placeholder="Search courses...">` +
  **Search** button; text `Showing {from} to {to} of {total}` or `Showing 0 entries`; table
  "Courses" | action column with **Edit** button per row; **Prev**/**Next** pager (`Page X of Y`).
- **Edit mode** (opened via `openCourse(courseId)` → `load({ courseId, search, page })`, server
  returns `data.mode === 'edit'`): same 12 fields as Add Course (Course, Full/Part Time, Degree,
  Degree Short Name, Major, Major Short Name, Department Name, Year of Start, Duration, Total
  Semester, Semester Per Year, Display Order), plus:
  - **Back to list** link button (top-right).
  - **Delete** button (`btn-warning`) → opens `ConfirmModal` with message
    "Are you sure to delete...".
  - **Save** button (`btn-danger`).
- Save (update): fields + `search`/`page` from `data.listContext` → `saveCourseEdit` in
  `server/src/services/academic/setup/courseEditSetup.js` → validates required fields
  (`{ success: false, message: 'Please fill all required fields' }`), then
  `prisma.basic_setup_course_tb.update(...)`.
- Delete: `save({ action: 'delete', id, search, page })` → same service, soft-deletes the course
  row (requires `id`, else `{ success: false, message: 'Course id is required' }`), then returns
  to list via `onBack()`.
- `AcademicCourseEditPage.jsx` (route `/academic/courses/:courseId/edit`) mounts
  `AcademicSetupPage` with `screen="course-edit"` and `initialFields={{ update: [courseId] }}` to
  deep-link straight into edit mode.
- `AcademicSetupPage.jsx` adds a **Course list** button in the header actions when
  `screen === 'course-edit'`.

### 3.4 Academic Year Setup — `academic-years` (`AcademicYearsSetup.jsx`)

- Three `YearSlotCard`s in a row — **U.G**, **U.G Additional**, **P.G** — each with:
  - **Academic Year** `<select required>` (U.G/U.G Additional share `data.ugYearOptions`; P.G
    uses `data.pgYearOptions`).
  - **From**/**To** date range (`<input type="date">`), with `updateFrom`/`updateTo`
    auto-correcting so `from ≤ to`.
  - **Odd/Even Semester** radio (U.G and P.G cards only, not U.G Additional).
- **Exam Academic Year** card: `ChipMultiSelect` over `data.examYearOptions`, label "Select all
  academic years to include for exams.", placeholder "Search academic years...", empty text "No
  academic years selected".
- **Institution Details** card: Institution Name, Institution Name (line 2), Institution Short
  Name, Institution Address (`<textarea>`), Phone, Email.
- **Save** button (`btn-danger`).
- Server: `loadAcademicYears` / `saveAcademicYears`
  (`server/src/services/academic/setup/academicYearsSetup.js`) — reads/writes
  `prisma.basic_setup_tb` (id=1, single institution row) plus per-course-type rows in
  `basic_setup_academic` (raw `$executeRaw` `UPDATE`/`INSERT`, then re-`SELECT id` to confirm).
  On missing years, `{ success: false, message: 'Academic years are required' }`; on missing
  setup row, `{ success: false, message: 'Institution setup not found' }`.

### 3.5 Admission Exam Mapping — `admission-exam` (`AdmissionExamSetup.jsx`)

- **Course & Academic year** `<select>` — `data.courseYearOptions` (course_name-based key, per
  `parseCourseYearKey` in `ciaSetupHelpers.js`), `--Select Course--` default.
- Table (shown once a course/year is selected): columns `#`, Exam Name, Internal, Viva, Theory,
  "Marks Same as Config", Completed, and a delete column. Each row: Exam Name `<select>` from
  `data.examNameOptions`; 5 checkboxes (`examInternal`, `examViva`, `examExternal`, `markOption`,
  `examStatus`), each rendered `<label><input type="checkbox"/> Yes</label>`.
- **+** button adds a blank row (`emptyRow()` defaults all checkboxes `true` except `examStatus`
  `false`).
- Per-row **Delete** button (only for saved rows, `row.id` truthy) → `ConfirmModal` "Are you sure
  to delete...".
- **Save** button (`btn-danger`).
- Save request: `{ action: 'update', courseName, academicYear, academicType, courseYearKey, rows:
  [{ id, examNameId, examInternal, examViva, examExternal, markOption, examStatus }] }`.
- Server: `loadAdmissionExam`/`saveAdmissionExam`
  (`server/src/services/academic/setup/admissionExamSetup.js`) reads/writes `prisma.cia_setup`
  (create on new row, update on existing). Delete action:
  `{ success: false, message: 'Please try again...' }` on failure.

### 3.6 Batch Color — `batch-color` (`BatchColorSetup.jsx`)

- Single card "Batch Color" with a table: Batch | Background | Foreground, one row per batch
  number (`data.rows`, from `batch_color_tb` joined against the current max
  `basic_subject_batch_tb.batch_no`).
- Each color cell is a `<input type="color">` + a 6-char hex `<input maxLength={6}>` styled with
  the live color as background and a contrast-computed (luminance-based) text color.
- **Save** button (`btn-primary`).
- Save request: `{ rows: [{ batchNo, batchLabel, backColor, foreColor }] }` (hex normalized
  client-side to `[0-9A-F]{6}` before send).
- Server: `curriculum/setup/batchColorSetup.js` — soft-deletes existing `batch_color_tb` rows
  (`UPDATE ... SET del=0`) then re-inserts with `del=1` (standard soft-delete-then-recreate
  pattern per `CLAUDE.md`).

### 3.7 Feedback Topics — `feedback-topics` (`FeedbackTopicSetup.jsx`)

- **Category** pills (`OptionPills`, `data.categoryOptions`) — pick a feedback category to load
  its topic rows.
- Card "Feedback topics": table Order | Name | delete, editable inline; **Add topic** button
  appends a blank row; per-row **Del** button (only for saved rows) opens `ConfirmModal` "Delete
  this topic?".
- **Save** button (`btn-primary`).
- Save (update): `{ action: 'update', category, rows: [{ id, order, name }] }`; delete:
  `{ action: 'delete', id, category }`.
- Server: `curriculum/setup/feedbackTopicSetup.js` — `feedback_topic` table, soft-delete-then-
  recreate pattern identical to batch color.

### 3.8 Period Setup — `period-setup` (`PeriodSetupSetup.jsx`)

- **Category** `<select>` grouped by `data.courseOptions` group.
- Once a course is selected: **Days** toggle-button group (`data.dayOptions`), **Period per day**
  numeric input, **Break period** input (placeholder "E.g. 3,6,9", helper text
  "Comma-separated slot numbers"), **Preview** button (`btn-info`, disabled unless
  `courseKey && selectedDays.length && periodPerDay > 0`).
- Preview builds a **Period Timetable** grid: Day column, "Combined" column (helper text
  "E.g. (1,2,3)"), then one column per period slot. Each period cell shows `P: {periodList}`,
  an FN/AN session radio pair, and From/To `HH:MM` text inputs; break-period cells render a
  plain "Break" label.
- **Save All** and **Change** (re-preview) buttons appear once `dayRows.length > 0`.
- Preview request: `load({ courseKey, selectedDays, periodPerDay, breakPeriod, action: 'change',
  preview: true, dayRows })`.
- Save request: `save({ courseKey, selectedDays, periodPerDay, breakPeriod, dayRows })`.
- Server: `curriculum/setup/periodSetupSetup.js` — writes `period_config_tb` (course/day/combine
  config) and `period_set_up` (per-period from/to times), both soft-delete-then-recreate on save.

### 3.9 Internship Schedule — `internship-schedule` (`InternshipScheduleSetup.jsx`)

- **Course** `<select>` (`data.courseOptions`, grouped).
- **Batch** pills (`data.batchOptions`) shown once a course is picked.
- Table (once a batch is picked): Department (`<select>`, `data.departmentOptions`), From/To date
  inputs, From/To time text inputs (dash-separated), Room No. (`<select>` grouped by
  `data.roomGroups`), per-row **Delete** button.
- **Add row** and **Save** buttons.
- Save request: `{ courseKey, batchNo: Number(batchNo), rows }`.
- Server: `curriculum/setup/internshipScheduleSetup.js` — `internship_timetable` table,
  soft-delete-then-recreate.

### 3.10 Feedback Setup (UG/PG) — `feedback-config-ug` / `feedback-config-pg` (`FeedbackConfigSetup.jsx`)

Single component parameterized by `screen` prop.

- **Feedback** `<select>` (`data.feedbackOptions`) picks/creates a feedback round.
- Once selected: **Title** input, **Course** `GroupedSelect` (`data.courseOptions`), **From/To**
  `LegacyDateTimeInput` pair.
- Subject table (once a course is chosen): `#`, Type, Subject, Staff — Staff cell is a checkbox
  list per row (`row.staffOptions`) toggled via `toggleStaff`.
- Text "No subjects found for the selected course and year." if a course is chosen but
  `subjectRows` is empty.
- **Save** button (`btn-danger`).
- Save request sends both camelCase and legacy-style duplicate keys:
  `{ feedbackId, category: feedbackId, courseKey, course_name: courseKey, title, feedback_title:
  title, fromDate, from_date: fromDate, toDate, to_date: toDate, subjectRows }`.
- Server: `curriculum/setup/feedbackConfigSetup.js` — `feedback_master` (the round) and
  `feedback_subject` (course/subject/staff mapping) tables, soft-delete-then-recreate.

### 3.11 Subject Categories — `subject-master` (`SubjectMasterSetup.jsx`)

- **Category** `<select>` (`data.categoryOptions`).
- Table: Order, Name, Short Name, "Sub Name List", delete column — editable inline.
- **+** button adds a row; **Save** (`btn-danger`); per-row **Delete** → `ConfirmModal`
  "Are you sure to delete...".
- Save: `{ action: 'update', category, rows: [{ id, order, name, shortName, subCategory }] }`.
- Server: `setup/subjectMasterSetup.js` — `prisma.subject_master`, soft-delete-then-recreate.

### 3.12 Master Setup — `master-setup` (`MasterSetupSetup.jsx`)

- Same shape as Subject Categories but the **Category** `<select>` is grouped into "Student" and
  "Other" `<optgroup>`s (`groups = ['Student', 'Other']`), and the table conditionally shows a
  **Degree** column (U.G/P.G checkboxes) when `data.showDegree || category === 'Attachment'`.
- Save: `{ action: 'update', category, rows: [{ id, order, name, shortName, subCategory, ug, pg
  }] }`.
- Server: `setup/masterSetupSetup.js` — `prisma.master_setup`, soft-delete-then-recreate.

### 3.13 Subject Setup — `subject-setup` (`SubjectSetupSetup.jsx`)

The most complex non-timetable screen: a master subject row table with two nested per-row
sub-editors.

- **Course & Year** filter: `CourseYearSelector` (shared with the exam module, from
  `client/src/pages/exam/setup/ExamSelectors.jsx`) using `data.courseYearOptions`; then a **Year**
  radio group (1..`data.totalSemester`).
- Subject table columns: E (enabled checkbox), Order, Category (`<select>`,
  `data.categoryOptions`), Basic (`<select>`, `data.subTypeOptions`), Subject Id, Subject Name,
  Short Name, **Exam** button, **Time Table** button, delete column.
- **Exam** button expands a nested "Marks" table per subject row (`row.markRows`): Category
  (`data.typeOptions`), Subject ID (read-only, auto-suffixed `A`, `B`, …), Title, Short Name,
  Department (`ChipMultiSelect`), I.Mark, V.Mark, T.Mark, P.Mark, Room No. (grouped `<select>`,
  `data.roomGroups`).
- **Time Table** button expands a nested "Time Table" table per subject row (`row.ttRows`):
  Category (`data.ttCategoryOptions`), Subject Id (read-only), Subject Name, Short Name,
  Department (`ChipMultiSelect`), Room No. (grouped), Batch (checkbox `batchSplit`).
- Child subject IDs auto-derive as `${parentSubjectId}${suffix}` where suffix cycles through
  `A`-`Z` (`nextSuffix`, `syncChildSubjectIds` in the component).
- **Add Subject** button (bottom-left); **Save** (`btn-danger`, bottom-right); per-row **Delete**
  → `ConfirmModal`.
- Save: `{ action: 'update', courseYearKey, scope, rows: [{ id, enabled, order, categoryId,
  subTypeId, subjectId, name, shortName, ttRows, markRows }] }`.
- Server: `setup/subjectSetupSetup.js` — three tables: `basic_setup_subject_tb` (parent subject),
  `basic_subject_tt_tb` (timetable child rows, `rid` FK), `basic_subject_marks_tb` (marks child
  rows, `rid` FK) — all soft-delete-then-recreate per parent id.

### 3.14 Student Batch Allocation — `subject-batch` (`SubjectBatchSetup.jsx`)

- **Course & Academic year** `<select>` grouped by degree (`data.courseYearOptions`).
- **Year** radio group (1..`data.totalSemester`).
- **Batch count** input + **Go** button (`btn-info`) — sets `totalBatch` and reloads student
  roster.
- Assignment table: `#`, Roll No., Student Name, then one column per batch letter
  (`Batch {A/B/C…}`) with a header checkbox to bulk-assign/unassign all students to that batch,
  and per-student/per-batch checkboxes (mutually exclusive — checking one clears any other batch
  for that student, via `setStudentBatch`).
- `ReportPrintBar` with client-built print HTML (`buildSubjectBatchPrintHtml` in
  `client/src/utils/subjectBatchPrint.js`), `printMode="academic-subject-batch"`.
- **Save** button (`btn-danger`).
- Save: `{ scope, totalBatch: batchCount, assignments: { [registerNo]: batchNo }, courseYearKey
  }`.
- Server: `setup/subjectBatchSetup.js` — reads active students via raw SQL on
  `student_profile_tb`, existing assignments from `basic_subject_batch_tb`
  (`batch_no, roll_no`), writes with soft-delete-then-recreate (`updateMany` del=0, then
  `create`/`update` with del=1).

### 3.15 Academic Calendar — `academic-calendar` (`AcademicCalendarSetup.jsx`)

- **Month** `<select>` grouped by year (`data.monthOptions`), `--Select Month--` default.
- Once a month is picked: month label heading (`data.monthLabel`), then a table Date | Event |
  Course | Comment for each day (`data.rows`). Event is a `<select>` (`data.eventOptions`);
  Course is a set of checkboxes over `data.courseTypeOptions` (multi-select via
  `toggleCourseType`); Comment is a text `<input maxLength={155}>`.
- **Save** button (`btn-danger`).
- Save: `{ calendarMonth, rows: [{ id, date, event, courseTypes, comment }] }`.
- Server: `setup/academicCalendarSetup.js` — reads/writes `academic_calender_tb` (legacy
  double-consonant-missing spelling per `CLAUDE.md` pitfall #6) and cross-references
  `basic_cal_event` for the event list; soft-delete-then-recreate per date/month.

### 3.16 Subject Timetable (monthly) — `subject-schedule` (`SubjectScheduleSetup.jsx`)

- **Course & Academic year** `<select>` grouped.
- **Subject** `<select>` (`data.subjectOptions`) once a course/year is chosen.
- Month navigator: **Prev**/**Next** buttons around a formatted month label, plus
  `ReportPrintBar` (client-built HTML via `buildSubjectSchedulePrintHtml`,
  `printMode="academic-subject-schedule"`).
- Info banner (blue, `alert-info`) when `data.monthAligned`: "Showing {month} — the first month
  with timetable templates for this subject." plus template date range if present.
- Warning banner (`alert-warning`) when there are no rows but a template date range exists:
  "No periods in {month}. Template data runs from {from} to {to || 'open'}. Use Prev/Next to find
  a month with scheduled periods."
- Table: Date, Day, Period, Batch, Staff (`<select>`, `data.staffOptions`), Topic (`<select>`,
  `data.topicOptions`).
- **Save** button (`btn-danger`), disabled if `!rows.length`.
- Save: `{ scope, courseYearKey, month, rows }`.
- Server: `setup/subjectScheduleSetup.js` — reads/writes `timetable_tb` (legacy) directly with raw
  SQL (`UPDATE timetable_tb SET del=0...`, `INSERT INTO timetable_tb (...)`, and a clearing
  `UPDATE ... SET staff_id='', pg_std_id='', topic_id=''` for unassigned slots), cross-references
  `basic_setup_subject_tb`, `basic_subject_tt_tb`, `basic_subject_new_unit`/`_chapter` for topics,
  and `timetable_tb_new` for v3-generation data.

### 3.17 Subject Unit / Chapter — `subject-unit` (`SubjectUnitSetup.jsx`)

- **Department** `<select>` (`data.departmentOptions`).
- **Course** `<select>` grouped, shown once department chosen.
- **Unit** `<select>` (`data.unitOptions`, plus a synthetic `+ Add new unit` option), shown once
  a course is chosen.
- New-unit mode: Unit Name `<select>` from `data.unitPresets` (auto-fills `unitOrder` from the
  preset); existing-unit mode: plain text `<input>` for unit name. Order `<input type="number">`.
- Chapters table: S.No., Topic (`<input>`), Order (`<input>`), delete column (**Delete** button
  for saved chapters with `ConfirmModal`; plain **×** remove for unsaved local rows).
- **+ Topic** button; **Save** button.
- Save: `{ scope, courseUnitKey, unitId, unitName, unitOrder, chapters: [{ id, name, order,
  materialLink }] }`.
- Server: `setup/subjectUnitSetup.js` — `basic_subject_new_unit` (unit) and
  `basic_subject_new_chapter` (chapters, `u_id` FK), soft-delete-then-recreate.

### 3.18 Subject Report — `subject-report` (`SubjectReportSetup.jsx`)

- **Course** `GroupedSelect` (`data.courseYearOptions`).
- **Year** `SemesterPills` (1..`totalSemester`), shown once a course is picked.
- **Category** `SegmentedControl` — Time Table / Exam (`reportType`), shown once a course/year
  give `totalSemester > 0`.
- **Go** button, spinner "Loading…" while `generating`.
- Report panel: `ReportPrintBar` (`printMode="academic-subject-report"`), skeleton loader while
  generating with no HTML yet, empty state "No subject report data found." / "Try another course,
  year, or subject category." when the generated HTML has 0 data rows.
- Load-time fields sent: `{ course_name, semester_name, report_type, generate: true }`.
- Server: `reports/subjectReportSetup.js` — builds print-ready HTML server-side by joining
  `basic_setup_subject_tb`, `basic_subject_tt_tb` (timetable), `basic_subject_marks_tb` (exam),
  and `timetable_tb`.

### 3.19 Class Timetable Report — `timetable-report` (`TimetableReportSetup.jsx`)

- **Date** `<input type="date">`.
- **Type** radio: Theory / Clinical/Practical.
- **Go** button (`btn-danger`), disabled until a date is chosen.
- `ReportPrintBar` (`printMode="academic-timetable-class-report"`), raw HTML rendered via
  `dangerouslySetInnerHTML`.
- Load fields: `{ attendance_date, a_pass_type, generate: true }`.
- Server: `reports/timetableReportSetup.js` — builds an HTML timetable-by-room grid from
  `timetable_tb`, `period_set_up`, `rooms_tb`/`blocks_tb`, `staff_profile_tb`,
  `basic_subject_unit`.

### 3.20 Batch Timetable Report — `batch-timetable-report` (`BatchTimetableReportSetup.jsx`)

- **Exam** `<select>` (`data.examOptions`, label `{group} — {label}`).
- **Subject category** radio: Theory / Clinical.
- **Print** button (`btn-danger`), disabled until an exam is chosen.
- `ReportPrintBar`, raw HTML render.
- Load fields: `{ exam_name, a_pass_type, generate: true }`.
- Server: `reports/batchTimetableReportSetup.js` — reads `cia_setup` (selected exam),
  `cia_exam_name`, `basic_setup_course_tb`, and `cia_schedule_tb` for the batch/room schedule.

### 3.21 Weekly Timetable Grid (legacy) — `tt-config` (`TtConfigSetup.jsx`)

- **Course & Academic year** `<select>` (`data.courseYearOptions`, ungrouped flat list here).
- **Year** radio group once course selected.
- **Go** button — local validation: "Select course and academic year first." if no course,
  "Select year, then click Go." if no year (both shown via `SetupAlerts` `localError`).
- Warning `alert-warning` "No timetable grid found for this selection." when `data.loaded &&
  !data.grid`.
- Grid table: header row of period time ranges (`data.grid.headers`, `{from} – {to}`), one row
  per day (`data.grid.rows`), each cell clickable (unless `cell.isBreak`, which renders "Break")
  to open an **allocation modal**.
- Allocation modal ("Timetable allocation"): loads HTML from
  `GET /api/academic/tt-config/more?flag=2&pday=&pno=&tcourse=&tayear=&tcyear=&tcacademic=...`
  (raw legacy-shaped HTML injected via `dangerouslySetInnerHTML`), wired by
  `wireAllocationEditor` (`ttConfigEditorShared.js`) which listens for subject `<select>` changes
  and re-fetches batch/department/topic sub-selects via
  `GET /api/academic/tt-config/more?flag=1&sid=<subjectId>`. Modal footer: **Back** and **Save**
  buttons. Save posts URL-encoded form fields (including all `tsub_*[]`/`ttopic_*[]` multi-selects)
  to `POST /api/academic/tt-config/more`; on `parsed[0] !== 1` shows "Unable to save timetable
  allocation. Check subject, staff, and dates."
- Server dispatch: `runTtConfigMore` (`server/src/services/academic/academicTtConfig.js`, thin
  wrapper — see file for exact bridge target) for the modal; grid load/save via
  `setup/ttConfigSetup.js` reading `timetable_tb` (subject_id/batch_no/staff_id) and
  `subject_master`/`basic_setup_subject_tb`.

### 3.22 Weekly Timetable Grid (New) — `tt-config-v3` (`TtConfigV3Setup.jsx`)

Same interaction pattern as `tt-config` but styled with the `CurriculumFilterCard` /
`SemesterPills` shared curriculum UI, and its allocation modal hits
`/api/academic/tt-config-v3/more` instead. Grid card title "Weekly Timetable Grid" with helper
text "Click a period cell to edit allocations." Server: `curriculum/setup/ttConfigV3Setup.js`
reads `timetable_tb_new` (the "new" generation table) instead of `timetable_tb`.

### 3.23 Curriculum report screens (12 screens, one shared component)

`CurriculumReportScreen.jsx` renders all 12 curriculum-report slugs, keyed by
`CURRICULUM_REPORT_CONFIG` (`client/src/pages/academic/curriculumReportConfig.js`) which assigns
each a filter `type` and Go-button label:

| Screen | Filter type | Go label | Empty-state copy |
|---|---|---|---|
| `subject-dashboard` | `datetime` | Go | "No staff periods found for the selected date and time." / "Try Now, Today 09:00, or pick another date/time." |
| `subject-schedule-report` | `course-cyear-month` | Generate | "No schedule data for the selected course and month." |
| `subject-timing` | `course-semester` | Go | "No subject timing data found." |
| `feedback-dashboard` | `feedback` | Generate | "No feedback status data found." |
| `class-timetable` / `class-timetable-v3` | `course-semester-batch` | Go | "No class timetable found." |
| `feedback-report-ug` / `feedback-report-pg` | `feedback-course` | Generate | "No feedback report data found." |
| `subject-handle` / `subject-handle-grid` | `course-cyear-range` | Generate | "No period completion records found." / "No subject attendance grid found." |
| `staff-period-completed` | `staff-range` | Generate | "No staff period records found." |
| `department-period-completed` | `dept-range` | Generate | "No department period records found." |

Filter types (rendered by `renderFilters()` in `CurriculumReportScreen.jsx`):
- **datetime**: `LegacyDateTimeInput` + `DateTimeQuickChips` (**Now**, **Today 09:00**,
  **Today 14:00** buttons).
- **course-semester(-batch)**: `GroupedSelect` course + `SemesterPills` year; `-batch` variant adds
  a "Show date & batch" switch.
- **feedback**: single Feedback `<select>` (`data.feedbackOptions`).
- **feedback-course**: Feedback `<select>` → Type `SegmentedControl` (UG: Subject/Overall/
  Theory/Practical/Online; PG: Subject/PG Clinical) → Course `GroupedSelect` → Subject
  `ChipMultiSelect` (only when type is "subject"), each step cascading-reloads the next.
- **course-cyear-range / course-cyear-month**: `GroupedSelect` course/year + either a `<input
  type=month>` or a `LegacyDateInput` from/to pair.
- **staff-range**: Staff `<select>` (`data.staffOptions`) + date range.
- **dept-range**: Department `<select>` (`data.departmentOptions`) + date range.

Generate button validation (client-side, `generate()` in `CurriculumReportScreen.jsx`): blocks the
call silently (no request sent) if `course-semester(-batch)` has no `semester_name`, if
`feedback`/`feedback-course` has no `category`, or if `feedback-course` type is "subject" but
`course_name`/`subject_name` are empty.

Report panel: `ReportPrintBar` with a per-screen `printMode` (`academic-class-timetable`,
`academic-feedback-dashboard`, `academic-subject-timing`, `academic-staff-period-completed`, or
`default`), a skeleton loader while generating with no HTML, and the shared empty-state pattern
(`countReportRows` counts `<tr` minus 1 header row; empty state shows when `hasGenerated && !
generating && html && dataRowCount === 0`).

Server-side these are backed by `curriculum/reports/*.js` (13 files, ~3,500 lines total),
reading (per screen): `subject-dashboard` → `timetable_tb`, `period_set_up`,
`basic_setup_course_tb`, `staff_profile_tb`; `feedback-dashboard`/`feedback-report-ug/pg` →
`feedback_subject`, `feedback_tb`, `feedback_rate_tb`, `feedback_topic`, `student_profile_tb`;
`class-timetable`/`class-timetable-v3` → `timetable_tb` / `timetable_tb_new`; `subject-handle` /
`subject-handle-grid` → `timetable_tb`, `basic_setup_subject_tb`, `basic_subject_tt_tb`,
`rooms_tb`; `staff-period-completed` → `staff_profile_tb`, `timetable_tb`;
`department-period-completed` → `basic_subject_tt_tb`.

## 4. Primary user stories

1. **As registrar staff**, I want to add a new course via **Add Course**
   (`course-add`, fields Course/Full-Part-Time/Degree/Major/Year of Start/Duration/Total
   Semester/Semester Per Year/Display Order), so that the course appears in every downstream
   course-year dropdown across Academic/Exam/Fees.
   *Acceptance:* submitting with all required fields filled calls
   `saveCourseAdd` → `basic_setup_course_tb.create`; the new course then appears in
   `/academic/courses` and in `buildCourseIdYearOptions`/`buildCourseYearOptions`-driven
   dropdowns.

2. **As registrar staff**, I want to search and edit an existing course
   (`/academic/courses` → **Edit** → `course-edit`), so that I can correct a degree/department
   name or duration without re-creating the course.
   *Acceptance:* editing and clicking **Save** persists via `saveCourseEdit`; clicking **Delete**
   confirms via the modal and soft-deletes (`del=0`) the course row.

3. **As academic office staff**, I want to set the **U.G**, **U.G Additional**, and **P.G**
   academic years, their from/to date ranges, and odd/even semester (`academic-years`), so that
   every course-year dropdown in the system (exam batches, fee setup, subject setup) reflects the
   current academic session.
   *Acceptance:* saving with all three year selects populated updates `basic_setup_tb` (id=1) and
   `basic_setup_academic`; the `Exam Academic Year` `ChipMultiSelect` selections extend the years
   shown in `EXAM`-list-aware dropdowns per `loadAcademicConfig()`.

4. **As a department coordinator**, I want to configure subject categories/rows for a
   course-year-semester (`subject-setup`), including nested Exam mark configs and Time Table
   allocations per subject, so that exam mark entry and timetable allocation have the correct
   subject universe to draw from.
   *Acceptance:* adding a subject row, expanding **Exam**/**Time Table**, filling child rows, and
   clicking **Save** persists to `basic_setup_subject_tb` + `basic_subject_marks_tb` +
   `basic_subject_tt_tb` with the auto-derived child subject IDs (`{parentId}A`, `{parentId}B`,
   …).

5. **As a department coordinator**, I want to split a course-year-semester's students into
   batches (`subject-batch`), assigning each student to exactly one batch via checkbox, so that
   clinical/practical sessions can be scheduled per batch.
   *Acceptance:* setting **Batch count** and clicking **Go** builds an N-column checkbox grid;
   checking a batch checkbox for a student clears any prior batch for that student
   (`setStudentBatch`); **Save** persists `assignments` to `basic_subject_batch_tb` and the
   **Print** button (`ReportPrintBar`) produces a batch roster.

6. **As a timetable coordinator**, I want to click a cell in the weekly grid
   (`tt-config`/`tt-config-v3`) and allocate a subject/staff/room/batch/topic to that
   day/period, so that the published class timetable reflects real teaching assignments.
   *Acceptance:* clicking a non-break cell opens the allocation modal, loaded from
   `GET /api/academic/tt-config(-v3)/more?flag=2&...`; choosing a subject triggers
   `populateAllocationRow` to fetch batch/department/topic options
   (`?flag=1&sid=`); **Save** posts to the same `/more` endpoint and, on success, closes the
   modal and reloads the grid with the freshly-saved cell summary.

7. **As academic office staff**, I want to enter institution calendar events per month
   (`academic-calendar`) tagging each date with an event and applicable course types, so that
   downstream attendance/holiday logic can read `academic_calender_tb`.
   *Acceptance:* selecting a **Month** loads that month's day rows; setting Event + Course
   checkboxes + Comment (max 155 chars) per date and clicking **Save** persists all rows in one
   call.

8. **As a curriculum coordinator**, I want to run the **Subject Dashboard**
   (`subject-dashboard`) for "Now" or a chosen date/time, so that I can see which staff periods
   are live at that moment.
   *Acceptance:* clicking the **Now** chip fills the datetime input with the current date/time in
   legacy format and immediately reflects in the filter; clicking **Go** calls
   `load({ current_date, generate: true, Submit: 'Go' })` and renders the resulting HTML table,
   with an empty-state message if no periods match.

9. **As academic office staff**, I want to configure a **Feedback Setup (UG/PG)** round
   (`feedback-config-ug`/`-pg`) — title, course, from/to window, and staff assigned per subject —
   so students can later submit feedback tied to the right subjects and staff.
   *Acceptance:* picking/creating a Feedback round, selecting a Course, and checking staff per
   subject row, then **Save**, persists `feedback_master` + `feedback_subject`; the corresponding
   **Feedback Report (UG/PG)** and **Feedback Status** curriculum-report screens can then generate
   non-empty output for that round.

10. **As academic office staff**, I want to view the **Class Timetable Report**
    (`timetable-report`) for a given date/type, so I can print the room-wise attendance-taking
    sheet for that day.
    *Acceptance:* choosing a **Date** and **Type** (Theory/Clinical) and clicking **Go** renders
    HTML that prints via `ReportPrintBar` (`printMode="academic-timetable-class-report"`).

## 5. Rare / edge-case user stories

1. **Timetable room/slot double-booking.** As a timetable coordinator, if I allocate a subject
   into a day/period cell in `tt-config`/`tt-config-v3` that's already used by another
   course/section in the same room at the same time, the grid UI (`TtConfigSetup.jsx`/
   `TtConfigV3Setup.jsx`) has **no client-side conflict check** — the cell click simply opens the
   allocation editor and the "more" bridge endpoint (`runTtConfigMore`) performs the save without
   a cross-course room/staff overlap query visible in the reviewed client code. A double booking
   is only caught if the legacy PHP save endpoint itself validates it server-side (not visible
   from the client contract) — this is a real risk area since two coordinators for different
   courses could allocate the same room+slot independently in `timetable_tb` /
   `timetable_tb_new`.
   *Story:* As a timetable coordinator, I want a warning when the room I pick in the allocation
   modal is already booked for that day/period by another course, so I don't create silent
   double-bookings — **currently not enforced client-side**.

2. **Empty course-year dropdown from key-format mismatch.** Several academic screens use
   **different course-key builders** for the same conceptual "course + academic year" filter:
   `courseIdYearKey` (course_id-based, `buildCourseIdYearOptions`/`buildTtConfigCourseYearOptions`
   — used by `tt-config`, `tt-config-v3`, `internship-schedule`, `subject-timing`) vs.
   `courseYearKey`/`parseCourseYearKey` (course_name-based, `buildCourseYearOptions` in
   `ciaSetupHelpers.js` — used by `admission-exam`) vs. the module-local
   `subjectScheduleCourseKey` (course_id + academic_year + semester, `subject-schedule`) vs.
   `courseIdYearOnlyKey` (course_id + academic_year only, no type suffix, `subject-report`). If a
   future edit to one screen's load service accidentally reuses another screen's key builder, the
   `<select>` renders options whose `value` the *save* handler can't parse
   (`parseCourseIdYearKey`/`parseCourseYearKey` returns `null`), and the dependent Year/Semester
   pills silently show "No semester options found for this course." — exactly the class of bug
   `CLAUDE.md`'s "wrong course dropdown builder" pitfall describes.
   *Story:* As a QA engineer, when I open `tt-config` I want the course dropdown's `value` to be
   parseable by the same key parser the save handler uses, so that selecting any course + clicking
   Go never silently no-ops.

3. **Subject with no assigned batch.** `subject-schedule` shows a batch column per timetable row,
   but a subject configured in `subject-setup` with `batchSplit` left off (or with `ttRows` never
   expanded) has no batch dimension — `SubjectBatchSetup.jsx`'s assignment grid can then show
   "no batches" (`batchCount = 0`) and the whole Save form is hidden (`batchCount > 0 &&
   (data.students||[]).length` gate), silently blocking batch allocation until **Batch count** is
   set and **Go** clicked.
   *Story:* As a department coordinator, if I open Student Batch Allocation for a course/year with
   `total_batch` never set, I want a clear prompt to set a batch count rather than an empty page
   with only a number input and a Go button.

4. **`del=1`/`del=0` soft-delete conflicts on re-save.** Curriculum setup screens (batch color,
   feedback topics, period setup, internship schedule, feedback config) universally follow the
   "soft-delete all existing rows for scope (`del=0`), then insert/update with `del=1`" pattern
   (e.g. `curriculum/setup/batchColorSetup.js`: `UPDATE batch_color_tb SET del=0... WHERE del=1`
   then `INSERT ... del=1`). If two admins save the same scope concurrently, the second save's
   `del=0` sweep can race the first save's inserts, potentially soft-deleting rows the first
   request just created — there's no optimistic-lock/version check visible in these services.
   *Story:* As an academic office admin, if a colleague and I both edit Batch Color at the same
   time, I want the system to prevent one save from silently deleting the other's just-saved rows.

5. **Zero-date calendar entries.** `academic-calendar` reads/writes `academic_calender_tb`, and
   the broader schema uses `0000-00-00` as "empty" (`CLAUDE.md` "Zero dates" rule). The month
   grid in `AcademicCalendarSetup.jsx` renders one row per real calendar date
   (`data.rows[].dateLabel`) rather than reading a stored date field directly, which sidesteps most
   zero-date issues for this screen — but any report or join that filters
   `academic_calender_tb.academic_date` against a zero-date row (e.g. an unset holiday marker)
   would need the same `sqlDateOrNull`/raw-SQL treatment other zero-date screens use.
   *Story:* As a report viewer, when a calendar event row was seeded before the academic date was
   ever set (`0000-00-00`), I want the Subject Schedule Report and Class Timetable reports to
   treat it as "no event" rather than crash or misrender.

6. **Curriculum report "Go" silently no-ops.** `CurriculumReportScreen.generate()` returns early
   with **no user-visible message** (no error, no notice) if required filters are missing (e.g.
   `feedback-course` type "subject" with no subjects picked, or `course-semester` with no
   semester chosen) — the Go button just does nothing.
   *Story:* As a report viewer, when I click **Generate** on Feedback Report without picking any
   subjects, I want a validation message ("Pick at least one subject") instead of the button
   silently doing nothing.

7. **Planning-year courses with no subject setup yet.** `resolveSubjectAcademicYear()` in
   `academicSetupShared.js` falls back up to 10 years back to find a year that actually has
   `basic_subject_tt_tb` rows when the requested (often forward "planning") academic year has
   none — this exists specifically because `buildTtConfigCourseYearOptions` synthesizes a
   not-yet-configured "next year" option (`calYear-calYear+1`) at the top of every course group,
   which would otherwise return a blank grid.
   *Story:* As a timetable coordinator opening the newly-synthesized planning year, I want the
   subject list to fall back to the most recent year that has subjects configured, rather than
   showing an empty grid with no explanation.

8. **Large course lists / pagination edges.** `AcademicCourseList.jsx` and `CourseEditSetup.jsx`
   both cap `limit` implicitly via server defaults (`listCourses` clamps `limit` to
   `Math.min(100, ...)`); a search with zero matches shows "No courses found." /
   an empty `courses` array respectively, and the Prev/Next buttons correctly disable at page
   bounds (`page <= 1` / `page >= totalPages`).

## 6. Future (not implemented)

All items below are explicitly speculative, grounded in [`../mobile.md`](../mobile.md) — none of
this exists in the codebase today.

- **(Future — not implemented) Mobile timetable view.** Per `mobile.md` §6, a mobile "Attendance"
  screen consuming `/api/attendance` is planned for v1, but Academic setup/timetable screens are
  explicitly **out of scope for mobile v1** ("Admin/setup screens... stay on the web app — they're
  desk/desktop workflows, not mobile ones", `mobile.md` §6). A **future** phase could add a
  read-only "My Timetable" mobile screen that renders the same `grid` shape returned by
  `tt-config-v3`'s load endpoint (`data.grid.headers`/`data.grid.rows`), reused read-only exactly
  as `mobile.md` §7.3 describes ("Mobile only ever displays data already resolved by the
  backend... no dropdown building logic needs porting").
- **(Future — not implemented) Push notification for calendar/timetable changes.** `mobile.md` §8
  lists push notifications as an unconfirmed, not-yet-built gap requiring new backend surface
  (`server/src/services/push/`). A plausible future extension: notify affected staff when an
  academic-calendar event or a timetable cell they're allocated into changes — this is explicitly
  flagged in `mobile.md` as needing sign-off before building, not something in progress.
  Currently, `academic-calendar` and `tt-config`/`tt-config-v3` saves are silent to anyone except
  the browser tab that made the change.
- **(Future — not implemented) Automated timetable conflict detection.** Extrapolating from the
  rare-edge-case gap in §5.1 (no client-side double-booking check today): a future save-time
  validation in `runTtConfigMore`/`saveTtConfig`/`saveTtConfigV3` could query `timetable_tb` /
  `timetable_tb_new` for existing allocations sharing the same room/day/period before accepting a
  save, and surface a conflict error back through `SetupAlerts` instead of silently overwriting.
  This does not exist today.
- **(Future — not implemented) Online curriculum feedback via mobile.** `feedback-config-ug`/`-pg`
  currently configure feedback *rounds* for staff to fill in via the desktop `feedback-dashboard`/
  `feedback-report-*` reports. A plausible mobile extension — students submitting feedback ratings
  directly from a phone against the `feedback_tb`/`feedback_rate_tb` tables — is not listed in
  `mobile.md`'s v1 feature table (§6) and is not implemented anywhere in this module; any such
  student-facing feedback flow would be new backend surface, not a reuse of existing academic
  setup endpoints.
- **(Future — not implemented) Print → Share/Export on mobile.** Every report screen in this
  module (`subject-report`, `timetable-report`, `batch-timetable-report`, all 12 curriculum
  reports) currently prints via `ReportPrintBar` → `printReportHtml()` opening a desktop browser
  window (`client/src/utils/printReport.js`). Per `mobile.md` §7.1, a future mobile client would
  reuse the exact same `printHtml`/`html` string these services already return, rendering it in
  `react-native-webview` and offering `expo-print`/`expo-sharing` instead of `window.print()` —
  no backend change needed, but nothing mobile-facing exists yet.

## 7. Traceability table

| Story | Client file | Server file / endpoint | Table(s) |
|---|---|---|---|
| Add course | `setup/CourseAddSetup.jsx` | `POST /api/academic/setup/course-add/save` → `setup/courseAddSetup.js` | `basic_setup_course_tb` |
| Edit/delete course | `setup/CourseEditSetup.jsx`, `AcademicCourseEditPage.jsx` | `.../course-edit/load\|save` → `setup/courseEditSetup.js` | `basic_setup_course_tb`, `master_setup` (dropdown source) |
| Course directory browse | `AcademicCourseList.jsx` | `GET /api/academic/courses` → `academicCourses.js` `listCourses()` | `basic_setup_course_tb` |
| Academic year setup | `setup/AcademicYearsSetup.jsx` | `.../academic-years/load\|save` → `setup/academicYearsSetup.js` | `basic_setup_tb`, `basic_setup_academic` |
| Admission exam mapping | `setup/AdmissionExamSetup.jsx` | `.../admission-exam/load\|save` → `setup/admissionExamSetup.js` | `cia_setup` |
| Batch color | `setup/BatchColorSetup.jsx` | `.../batch-color/load\|save` → `curriculum/setup/batchColorSetup.js` | `batch_color_tb`, `basic_subject_batch_tb` |
| Feedback topics | `setup/FeedbackTopicSetup.jsx` | `.../feedback-topics/load\|save` → `curriculum/setup/feedbackTopicSetup.js` | `feedback_topic` |
| Period setup | `setup/PeriodSetupSetup.jsx` | `.../period-setup/load\|save` → `curriculum/setup/periodSetupSetup.js` | `period_config_tb`, `period_set_up` |
| Internship schedule | `setup/InternshipScheduleSetup.jsx` | `.../internship-schedule/load\|save` → `curriculum/setup/internshipScheduleSetup.js` | `internship_timetable`, `master_setup` |
| Feedback setup UG/PG | `setup/FeedbackConfigSetup.jsx` | `.../feedback-config-ug\|pg/load\|save` → `curriculum/setup/feedbackConfigSetup.js` | `feedback_master`, `feedback_subject` |
| Subject categories | `setup/SubjectMasterSetup.jsx` | `.../subject-master/load\|save` → `setup/subjectMasterSetup.js` | `subject_master` |
| Master setup | `setup/MasterSetupSetup.jsx` | `.../master-setup/load\|save` → `setup/masterSetupSetup.js` | `master_setup` |
| Subject setup (rows + Exam/Time Table) | `setup/SubjectSetupSetup.jsx` | `.../subject-setup/load\|save` → `setup/subjectSetupSetup.js` | `basic_setup_subject_tb`, `basic_subject_tt_tb`, `basic_subject_marks_tb` |
| Student batch allocation | `setup/SubjectBatchSetup.jsx` | `.../subject-batch/load\|save` → `setup/subjectBatchSetup.js` | `basic_subject_batch_tb`, `student_profile_tb` |
| Academic calendar | `setup/AcademicCalendarSetup.jsx` | `.../academic-calendar/load\|save` → `setup/academicCalendarSetup.js` | `academic_calender_tb`, `basic_cal_event` |
| Subject timetable (monthly) | `setup/SubjectScheduleSetup.jsx` | `.../subject-schedule/load\|save` → `setup/subjectScheduleSetup.js` | `timetable_tb`, `basic_setup_subject_tb`, `basic_subject_tt_tb`, `basic_subject_new_unit/_chapter` |
| Subject unit/chapter | `setup/SubjectUnitSetup.jsx` | `.../subject-unit/load\|save` → `setup/subjectUnitSetup.js` | `basic_subject_new_unit`, `basic_subject_new_chapter` |
| Subject report | `setup/SubjectReportSetup.jsx` | `.../subject-report/load\|save` → `reports/subjectReportSetup.js` | `basic_setup_subject_tb`, `basic_subject_tt_tb`, `basic_subject_marks_tb`, `timetable_tb` |
| Class timetable report | `setup/TimetableReportSetup.jsx` | `.../timetable-report/load\|save` → `reports/timetableReportSetup.js` | `timetable_tb`, `period_set_up`, `rooms_tb`, `blocks_tb`, `staff_profile_tb` |
| Batch timetable report | `setup/BatchTimetableReportSetup.jsx` | `.../batch-timetable-report/load\|save` → `reports/batchTimetableReportSetup.js` | `cia_setup`, `cia_exam_name`, `cia_schedule_tb`, `basic_setup_course_tb` |
| Weekly timetable grid (legacy) | `setup/TtConfigSetup.jsx` | `.../tt-config/load\|save`, `GET/POST /api/academic/tt-config/more` → `setup/ttConfigSetup.js`, `academicTtConfig.js` | `timetable_tb`, `subject_master`, `basic_setup_subject_tb` |
| Weekly timetable grid (new) | `setup/TtConfigV3Setup.jsx` | `.../tt-config-v3/load\|save`, `GET/POST /api/academic/tt-config-v3/more` → `curriculum/setup/ttConfigV3Setup.js` | `timetable_tb_new`, `subject_master`, `basic_setup_subject_tb` |
| 12 curriculum reports (dashboard, feedback status/report, class timetable, period completion, etc.) | `setup/CurriculumReportScreen.jsx` | `.../<slug>/load` → `curriculum/reports/*.js` (13 files) | `timetable_tb`/`timetable_tb_new`, `period_set_up`, `feedback_subject`, `feedback_tb`, `feedback_rate_tb`, `feedback_topic`, `staff_profile_tb`, `student_profile_tb`, `basic_setup_subject_tb`, `basic_subject_tt_tb`, `rooms_tb` |
| Course/exam-year key formats | `academicSetupShared.js` re-exports from `exam/setup/examSetupShared.js`; `ciaSetupHelpers.js` | n/a (shared helper) | `basic_setup_course_tb`, `basic_setup_tb` |
| Menu deep-links | `client/src/utils/legacyRoutes.js` (lines 157-214) | n/a | n/a |

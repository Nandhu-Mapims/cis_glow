# 10 — Exam Module

> Deep-dive companion to [../userstory.md](../userstory.md). Every claim below is grounded in the
> actual code under `client/src/pages/exam/`, `server/src/services/exam/`, and
> `server/src/routes/exam.js` as it exists today, plus the legacy PHP under
> `/home/mapims/cis/cis/`. Field labels, button text, and error strings are quoted verbatim from
> the source, not paraphrased.

## 1. Module overview

**Purpose.** The Exam module runs internal/continuous-assessment ("CIA") examinations at the
dental college: exam-name master, per-course exam configuration, student batching for practical/
clinical exams, exam scheduling with invigilator assignment, OMR mark-sheet generation/upload,
mark entry, no-due clearance, examiner management, attendance-during-exam capture, camp/clinical
activity logging tied to exams, SMS notification of results/hall-tickets, and a large family of
print/analysis reports (term report, progress card, result statement, schedule print, invigilator
roster, pass/fail analysis, sheet status tracking).

**Actors:**
- **Exam cell staff / Controller of Examinations office** — configures exam names, term exam
  setup, batches, schedules, OMR layout, and runs most reports. Primary user of nearly every
  screen under `/exam/setup` and `/exam/reports`.
- **Faculty / internal examiners & invigilators** — enter marks (`mark-entry`), enter
  exam-attendance percentages (`attendance-entry`), and appear as selectable invigilators
  (`loadInvigilatorOptions` in `server/src/services/exam/setup/examSetupShared.js`, sourced from
  `staff_profile_tb` where `job_category=255`).
- **External/viva examiners** — configured via Examiner Setup / Exam Examiners screens but do not
  log into CIS themselves; their contact details are entered by staff.
- **Students** — read-only consumers of their own CIA marks via Student Exam Statement
  (`/exam/student-statement`) and (indirectly) marksheet prints.
- **Exam Dashboard viewer** — any staff with module access, viewing the aggregate exam summary
  widget (`/exam/dashboard`).

**Legacy `.php` files replaced** (from `client/src/pages/exam/examSetupMeta.js`):
`exam_name_config.php`, `term_exam_setup.php`, `term_mark_entry.php`, `exam_batch.php`,
`term_report.php`, `term_report_statement.php`, `term_progress_card.php`, `term_mark_sheet.php`,
`term_exam_schedule.php`, `term_marks_upload.php`, `term_exam_sch_print.php`,
`term_exam_Inviliga_sch_print.php`, `term_report_analysis.php`, `omr_style_config.php`,
`term_exam_nodue.php`, `term_exam_examiners.php`, `term_exam_att_certificate.php`,
`term_examiner_setup.php`, `camp_activity_add.php`, `camp_activity_edit.php`,
`camp_activity_type.php`, `term_attendance_entry.php`, `term_attendance_report.php`,
`term_sheets_upload.php`, `term_sheets_status.php`, `term_mark_sheet_status.php`,
`term_mark_sheet_received.php`, `exam_sms.php`, `term_report_analysis_v1.php`, plus
`exam_dashboard.php` and `student/exam_statement.php` (routed outside `examSetupMeta.js`, directly
in `server/src/routes/exam.js`).

## 2. Screen inventory

| Route | Component file | Legacy `.php` counterpart |
|---|---|---|
| `/exam` | `client/src/pages/exam/ExamHub.jsx` | (hub, no direct PHP) |
| `/exam/dashboard` | `client/src/pages/exam/ExamDashboard.jsx` | `exam_dashboard.php` |
| `/exam/student-statement` | `client/src/pages/exam/ExamStudentStatement.jsx` | `student/exam_statement.php` |
| `/exam/setup` | `client/src/pages/exam/ExamSetupHub.jsx` | (hub) |
| `/exam/reports` | `client/src/pages/exam/ExamReportsHub.jsx` | (hub) |
| `/exam/setup/exam-names` | `setup/ExamNameSetup.jsx` | `exam_name_config.php` |
| `/exam/setup/exam-setup` | `setup/TermExamSetup.jsx` | `term_exam_setup.php` |
| `/exam/setup/exam-batch` | `setup/ExamBatchSetup.jsx` | `exam_batch.php` |
| `/exam/setup/mark-entry` | `setup/MarkEntrySetup.jsx` | `term_mark_entry.php` |
| `/exam/setup/exam-schedule` | `setup/ExamScheduleSetup.jsx` | `term_exam_schedule.php` |
| `/exam/setup/mark-sheet` | `setup/MarkSheetSetup.jsx` | `term_mark_sheet.php` |
| `/exam/setup/marks-upload` | `setup/MarksUploadSetup.jsx` | `term_marks_upload.php` |
| `/exam/setup/omr-config` | `setup/OmrConfigSetup.jsx` | `omr_style_config.php` |
| `/exam/setup/exam-nodue` | `setup/ExamNodueSetup.jsx` | `term_exam_nodue.php` |
| `/exam/setup/exam-examiners` | `setup/ExamExaminersSetup.jsx` | `term_exam_examiners.php` |
| `/exam/setup/examiner-setup` | `setup/ExaminerSetupSetup.jsx` | `term_examiner_setup.php` |
| `/exam/setup/camp-activity-add` | `setup/CampActivityAddSetup.jsx` | `camp_activity_add.php` |
| `/exam/setup/camp-activity-edit` | `setup/CampActivityEditSetup.jsx` | `camp_activity_edit.php` |
| `/exam/setup/camp-activity-type` | `setup/CampActivityTypeSetup.jsx` | `camp_activity_type.php` |
| `/exam/setup/attendance-entry` | `setup/AttendanceEntrySetup.jsx` | `term_attendance_entry.php` |
| `/exam/setup/sheets-upload` | `setup/SheetsUploadSetup.jsx` (`readOnly` meta flag set, but component has its own save flow) | `term_sheets_upload.php` |
| `/exam/setup/exam-sms` | `setup/ExamSmsSetup.jsx` | `exam_sms.php` |
| `/exam/reports/term-report` | `setup/TermReportSetup.jsx` → `ExamReportScreen` | `term_report.php` |
| `/exam/reports/term-statement` | `setup/TermStatementSetup.jsx` → `ExamReportScreen` | `term_report_statement.php` |
| `/exam/reports/progress-card` | `setup/ProgressCardSetup.jsx` → `ExamReportScreen` | `term_progress_card.php` |
| `/exam/reports/schedule-print` | `setup/SchedulePrintSetup.jsx` | `term_exam_sch_print.php` |
| `/exam/reports/invigilator-print` | `setup/InvigilatorPrintSetup.jsx` | `term_exam_Inviliga_sch_print.php` |
| `/exam/reports/report-analysis` | `setup/ReportAnalysisSetup.jsx` → `ExamReportScreen` | `term_report_analysis.php` |
| `/exam/reports/report-analysis-v1` | `setup/ReportAnalysisV1Setup.jsx` | `term_report_analysis_v1.php` |
| `/exam/reports/exam-attendance-certificate` | `setup/ExamAttendanceCertificateSetup.jsx` (readOnly meta) | `term_exam_att_certificate.php` |
| `/exam/reports/attendance-report` | `setup/AttendanceReportSetup.jsx` (readOnly meta) | `term_attendance_report.php` |
| `/exam/reports/sheets-status` | `setup/SheetsStatusSetup.jsx` (readOnly meta) | `term_sheets_status.php` |
| `/exam/reports/mark-sheet-status` | `setup/MarkSheetStatusSetup.jsx` (readOnly meta) | `term_mark_sheet_status.php` |
| `/exam/reports/mark-sheet-received` | `setup/MarkSheetReceivedSetup.jsx` (readOnly meta) | `term_mark_sheet_received.php` |

All `/exam/setup/:screen` and `/exam/reports/:screen` routes resolve through the single
`ExamSetupPage.jsx` (`client/src/pages/exam/ExamSetupPage.jsx`), which looks up
`EXAM_SCREEN_META[screen]` for title/breadcrumb/legacy name and `NATIVE_SCREENS[screen]` for the
React component; unmapped screens render `"Screen not available."` and unknown screens (not in
`EXAM_SCREEN_META`) render `"Unknown exam screen."`. Server-side, `server/src/services/exam/examSetup.js`
maintains a parallel `VALID_SCREENS` / `NATIVE_SCREENS` set; any screen not in `NATIVE_SCREENS`
falls through to `unportedSetupScreen('exam', screen)`.

## 3. Pixel-level flow per screen

### 3.1 Exam Hub (`/exam`) — `ExamHub.jsx`
Five `ModuleHub` link cards: "Exam Dashboard" (`/exam/dashboard`), "Exam Setup" (`/exam/setup`),
"Exam Reports" (`/exam/reports`), "Student Statement" (`/exam/student-statement`), "Mark Entry"
(`/exam/setup/mark-entry`, duplicated as a shortcut). No load call — static links only.

### 3.2 Exam Setup Hub (`/exam/setup`) — `ExamSetupHub.jsx`
17 link cards to every setup screen (Exam Names, Term Exam Setup, Exam Batches, Mark Entry, Exam
Schedule, Mark Sheet Print, OMR Mark Upload, OMR Layout Config, No Due Verification, Exam
Examiners, Examiner Setup, Camp Activity Add/Edit/Type, Attendance Entry, Term Sheets Upload, Exam
SMS). "Back" button → `/exam`.

### 3.3 Exam Reports Hub (`/exam/reports`) — `ExamReportsHub.jsx`
13 link cards (Term Report, Result Statement, Progress Card, Exam Schedule Print, Invigilator
Schedule, Report Analysis, Report Analysis v1, Attendance Certificate, Attendance Report, Term
Sheets Status, Mark Sheet Status, Mark Sheet Received, Student Exam Statement).

### 3.4 Exam Dashboard (`/exam/dashboard`) — `ExamDashboard.jsx`
- Loads `GET /api/exam/dashboard` (optional `?refresh=1`) on mount.
- Client-side `sessionStorage` cache key `cis_exam_dashboard_v3`, TTL `600_000` ms (10 min). On
  mount, `readSessionCache()` supplies instant `html`/`bannerUrl`/`printMeta` if present and fresh
  spinner is suppressed (`showSpinner: !cache?.html`).
- Buttons: **Print** (only rendered when `html` present, calls `buildExamDashboardPrintHtml` then
  `printReportHtml(body, 'exam-dashboard')`), **Refresh** (forces `refresh=true`, disabled while
  `busy`), **Back** → `/exam`.
- Loading text: `"Loading exam dashboard…"` (spinner) shown only when `busy && !html`; refresh
  shows `"Refreshing…"` instead.
- Empty state: `"No exam dashboard data returned."` when `!html && !busy && !error`.
- Error messages built from Axios failure: prefers `err.response?.data?.message`, else `"Exam
  dashboard request timed out"` (on `ECONNABORTED`), else `"Could not reach server — is the API
  running?"` (Network Error), else `"Unable to load exam dashboard"`.
- Server: `server/src/services/exam/examDashboard.js` — module-level in-memory cache
  (`dashboardCache`/`dashboardCacheAt`), also `CACHE_MS = 600_000`, plus a `dashboardInflight`
  promise so concurrent requests during a cold cache share one build rather than each rebuilding.
  Returns `{ html, bannerUrl, printMeta: { title: 'Exam Report', subtitleLine1: '', dateRange } }`
  or `{ error: 'No active exam data found' }` if `buildExamDashboardHtml()` returns falsy.

### 3.5 Student Exam Statement (`/exam/student-statement`) — `ExamStudentStatement.jsx`
- Field: **"Register number"** text input (`id="registerNo"`, placeholder `"e.g. 20UG001"`).
- Button: **"Load statement"** (`type="submit"`, disabled while `busy`).
- Validation: empty submit sets error `"Enter a register number"` client-side before the request
  fires (`loadStatement` in the component).
- POST `/api/exam/student-statement` with `{ registerNo, fields }`. Server
  (`server/src/services/exam/examStudentStatement.js`) 404s with `{ error: 'Student not found' }`
  when no active `student_profile_tb` row matches; the route maps that to HTTP 400 with the same
  message.
- The returned `html` is injected verbatim (`dangerouslySetInnerHTML`) and may embed its own
  `<form id="signupForm">` (legacy in-report filter form) — the component wires a native `submit`
  listener via `serializeLegacyForm` to re-POST with extra fields without a full page reload.
  Print button appears only when `html` is present, calling `printReportHtml(html)` — note this
  screen does **not** use the module CSS wrapper functions (`buildExamSchedulePrintHtml` etc.)
  used elsewhere; it prints the raw HTML.
- Empty state: `"Enter a student register number to view their CIA marks statement."`

### 3.6 Exam Names (`/exam/setup/exam-names`) — `ExamNameSetup.jsx`
Table columns: **Order**, **Name**, **Month**, delete column. Each row: `Order` free-text input,
`Name` free-text input, `Month` `<select>` populated from `data.monthOptions` (`January`…
`December`, server hard-codes the 12 months in `examNameSetup.js`). Row-level **Delete** button
(only for persisted rows with `row.id`) opens `ConfirmModal` with message `"Are you sure to
delete..."`. Footer: **"+"** button appends a blank row; **Save** button (`btn-danger`).
- Save payload: `{ action: 'update', rows: [{ id, order, name, month }] }`.
- Server (`server/src/services/exam/setup/examNameSetup.js`, table `cia_exam_name`): soft-deletes
  ALL currently-active rows (`del=1 → del=0`) then re-creates/updates every row in the payload —
  a full-replace pattern, not a diff. Blank `name` on a new row is silently skipped. Save message:
  `"Your details are Updated..."`. Delete message: `"Your details are deleted..."`; delete failure:
  `"Please try again..."`.

### 3.7 Term Exam Setup (`/exam/setup/exam-setup`) — `TermExamSetup.jsx` — **COURSE_NAME-keyed**
- **"Course & Academic year"** `<select>` grouped by `optgroup`, options from
  `data.courseYearOptions` built by `buildCourseYearOptions()` in
  `server/src/services/shared/ciaSetupHelpers.js`. Key format `courseName___academicYear___academicType`
  (e.g. `U.G___2025-2026___regular`), option label `"U.G | 2025-2026 (Regular)"`. This is the
  **course-name-keyed** dropdown per CLAUDE.md — table `cia_setup`.
- Table columns once a course/year is selected: **#**, **Exam Name** (`<select>` from
  `data.examNameOptions`), **Internal**, **Viva**, **Theory**, **Marks Config** (all checkboxes),
  **FN Session**, **AN Session** (free text), **From**, **To** (`type="date"`), **Time** (free
  text), **Done** (checkbox = `exam_status`), delete column.
- Row **Delete** (persisted rows only) → `ConfirmModal` `"Are you sure to delete..."` →
  `save({ action: 'delete', id: deleteId, courseYearKey })`.
- Footer **"+"** appends `emptyRow()`; **Save** (`btn-danger`, disabled while busy).
- Save payload: `{ action: 'update', courseName, academicYear, academicType, courseYearKey, rows: [...] }`
  where each row carries `examNameId, examInternal, examViva, examExternal, markOption, examStatus,
  sessionFn, sessionAn, fromDate, toDate, sessionTime`.
- Server (`server/src/services/exam/setup/termExamSetup.js`): writes to `cia_setup`. Zero/blank
  dates map through `parseInputDate` → stored as `CIA_SETUP_DEFAULTS.pap_eva_frm/to` (`new
  Date('1970-01-01')`) when the client sends nothing — this is a real "zero date" substitute,
  distinct from the DB's literal `0000-00-00` convention, and `formatDisplayDate` treats strings
  starting with `0000-00-00` as empty when displaying. Save success message: `"Your details are
  Updated..."`; delete success: `"Your details are deleted..."`.

### 3.8 Exam Batch Allocation (`/exam/setup/exam-batch`) — `ExamBatchSetup.jsx` — **COURSE_ID-keyed**
- **"Course & Academic year"** `<select>` (wide) grouped by `optgroup`, options from
  `data.courseYearOptions` built by `buildCourseIdYearOptions()` in
  `server/src/services/exam/setup/examSetupShared.js`. Key format
  `courseId___academicYear___academicType` (e.g. `12___2025-2026___regular`), grouped under
  `"${course_name} | ${degree_name}${dept} | FT|PT | Regular|Additional"`, option label
  `"${degree_name}${dept} | ${year} (Regular)"`. This is the **course-id-keyed** dropdown —
  table `cia_batch_tb`.
- Once a course is chosen and `data.selection.courseDuration` is known: **"Year"** row of radio
  buttons `1..courseDuration` (labelled "1 Year", "2 Year", …), each bordered pill; a text summary
  line above showing `degreeName | departmentShortName | academicYear`.
- Once a year/semester is chosen: **"Batch"** row — free-text numeric input (`totalBatch`) plus
  **"Go"** button (`btn-info`).
- On Go, table renders: **#**, **Roll.No.**, **Student Name**, then one **"Batch {letter}"** column
  per batch (`batchLetters` A, B, C…), each cell a checkbox — checking one cell for a student
  unchecks any other batch column for that row (mutual exclusivity enforced client-side in
  `toggleBatch`).
- **Save** button (`btn-danger`) at bottom, disabled while busy.
- `<ReportPrintBar html={data?.printHtml} />` renders when the server built a batch-list print
  HTML (only on `action: 'go'`/`Save: 'Go'`).
- Load response shape (confirmed in `server/src/services/exam/setup/examBatchSetup.js`
  `loadExamBatch`): `{ courseYearOptions, courseKey, selection, semester, totalBatch, students,
  assignments, batchLetters, printHtml }` — exactly matches the shape documented in CLAUDE.md.
  `selection` is the parsed+enriched course-id key (`courseId, academicYear, academicType,
  courseName, courseDuration, totalSemester, degreeName, departmentShortName`).
- Save payload: `{ courseKey, semester, totalBatch, assignments }` where `assignments` is
  `{ [batchNo]: registerNo[] }`.
- Server validation: `if (!selection || !semester || !totalBatch) return { success: false, message:
  'Course, year and batch count are required' }`. Save soft-deletes existing `cia_batch_tb` rows
  for that course/year/semester/type combination, then per-batch either creates a new row (if
  `rollList` non-empty and no existing row owned by this member) or reactivates/updates the
  existing one. Success message: `"Your details are added..."`.

### 3.9 Mark Entry (`/exam/setup/mark-entry`) — `MarkEntrySetup.jsx`
- **"Exam"** `<select>` grouped by `optgroup`, options from `loadActiveExamOptions()`
  (`examSetupShared.js`) — filters `cia_setup` rows with `exam_status=0` (not yet closed), grouped
  `"${courseName} | ${academicYear} (Regular|Additional)"`.
- **Course & semester** radio groups per degree (`CourseSemesterSelector`), keyed
  `courseId___semester`.
- **"Subject"** `<select>` populated once course/exam chosen: option text
  `"${subjectId} | ${categoryName} | ${subjectName}"`, subjects that already have marks entered
  get inline style `background: '#9ABB44'` and a trailing `" *"` marker (`sub.hasMarks`).
- **"Go"** button (disabled unless a subject is picked).
- Marks table columns are conditional on exam config: **Reg.No** (`uregisterNo`), **Roll.No**
  (`registerNo`), **Name**, then conditionally `Int.({iMax})`, `Viva({vMax})`,
  `{categoryName.slice(0,3)}({eMax})`, `Total` (only if `cols.showTotal`, i.e. more than one of
  I/V/E enabled), and always **Result**.
- Mark inputs use `normalizeMarkInput` (`client/src/pages/exam/setup/markEntryUtils.js`): strips
  non-alphanumerics, collapses `"N"+"A"` combos to `"NA"`, a lone `"A"`/`"a"` to `"A"`.
  `maxLength={2}` for internal/viva, `{3}` for external.
- `calculateMarkTotal` (same file, duplicated server-side in
  `server/src/services/exam/setup/examMarkLogic.js`): computes `tMark` and `result` only once all
  three enabled parts (I/V/E) have a value (`calFlag === 3`); result is `'AB'` if any part is `'A'`
  (absent), `'NA'` if any part is `'NA'`, `'FAIL'` if numeric total `< passMin`, else `'PASS'`. If
  a mark exceeds its max, that field is silently cleared rather than accepted.
- **Save** button (`btn-danger`).
- Save payload: `{ examSetupId, courseKey, subjectId, students }`. Server
  (`server/src/services/exam/setup/markEntrySetup.js`) soft-deletes existing `cia_marks_tb` rows
  for the exam/course/subject combo, then re-creates/updates per student. Success message:
  `"Your details are updated..."`.

### 3.10 Exam Schedule (`/exam/setup/exam-schedule`) — `ExamScheduleSetup.jsx`
- **"Exam"** `<select>` (grouped), **course/semester radio pills** per degree
  (`exam-schedule-semester-option` styling, distinct CSS from other screens
  `examScheduleSetup.css`).
- Empty states: `"No subjects found for the selected exam and year."` (exam+course chosen, no
  rows) and `"Select an exam, then choose the course year to schedule subjects."` (nothing chosen
  yet). Loading: `"Loading schedule…"` spinner.
- Once rows load, a card header shows `"{rows.length} subjects"`, `"{scheduledCount} with exam
  date"` (count of rows whose `examDate` is set), and the exam name label; **"Save Schedule"**
  button (label toggles to `"Saving…"` while busy).
- Table columns: **Code**, **Subject**, **Category**, **Date** (`type="date"`), **Session** — a
  custom FN/AN toggle (`SessionToggle`, two buttons, active state styled), **Batch** — a
  `ChipMultiSelect` of `data.batchOptions` (search box shown only if `>6` options), **Invigilator**
  — a `ChipMultiSelect` of `data.invigilatorOptions` (search always shown, placeholder
  `"Search staff…"`), conditionally **I Max**/**V Max**/**E Max** inputs (per exam's
  internal/viva/external flags), **Pass** input, delete column. Mark-max/pass inputs are
  `readOnly` when `row.marksReadonly` (server sets this to `ctx.markOption`, i.e. once exam-name
  master says marks are externally configured).
- Row **Delete** (persisted only) → `ConfirmModal` `"Are you sure to delete this schedule row?"` →
  `save({ action: 'delete', id: deleteId, reloadFields: { exam_name, course_name } })`.
- Save payload: `{ examSetupId, courseKey, rows }`. Server
  (`server/src/services/exam/setup/examScheduleSetup.js`, table `cia_schedule_tb`): rows with no
  parseable `examDate` (`parseInputDate` returns null) are **silently skipped** — a subject with a
  blank date is simply not persisted. `internal_min`/`viva_min`/`external_min` are hard-coded to
  `0` (legacy always writes 0 for minimums). `invigilator` list is joined by comma and
  **truncated to 25 characters** (`scheduleInvigilatorList`), a legacy column-width limit that can
  silently drop invigilators beyond the first couple of IDs for schedules with many invigilators.
  Success message: `"Your details are Updated..."`.

### 3.11 Mark Sheet Print (`/exam/setup/mark-sheet`) — `MarkSheetSetup.jsx`
- Exam + course/semester selectors, then a table of `data.schedules` rows: **Subject**, **Date**,
  **Session**, **Batch**, **I/V/E/Pass** (slash-joined maxima), and a per-row **Print** button.
- Print opens `window.open('/api/exam/marksheet/print?...&flag=1', 'Report', 'scrollbars=1')` —
  a **GET**, unauthenticated-by-window (relies on cookie/shared session context) new window, not
  the `printReportHtml` helper used elsewhere.
- Server print builder: `server/src/services/exam/examMarksheetPrint.js`
  (`buildExamMarksheetHtml`) — requires ALL of `flag=1, exam, course, ayear, cyear, atype, subject,
  mark, scheid` or returns `<p>Invalid marksheet parameters</p>`. Also returns
  `<p>Exam not found</p>`, `<p>Schedule not found</p>`, `<p>No students in batch</p>` for the
  respective missing-data cases. Generates a QR code per OMR page (`QRCode.toDataURL`) encoding
  `${folioId}ZZZ${examId}ZZZ${page}ZZZ${scheduleId}`, paginates students 40 per page, and returns
  raw print-ready HTML with `<body onload="window.print()">` — this is the one exam screen that
  auto-triggers print via `onload` rather than a client button (legacy parity).

### 3.12 OMR Mark Upload (`/exam/setup/marks-upload`) — `MarksUploadSetup.jsx`
- **"Attach Marksheet"** file input, `accept=".jpg,.jpeg,.gif"`, `multiple`.
- **"Upload Mark Sheet"** button (`btn-danger btn-lg`).
- Client validation: no files selected → `"Please attach at least one marksheet image"`.
- Files are read as base64 (`FileReader.readAsDataURL`, stripping the data-URI prefix) and posted
  as `{ field: 'upload[]', index, filename, type, content }[]` alongside `{ Submit: 'Upload' }`.
- Per-file result rows render as `alert-success`/`alert-danger` with `"{filename}: {message}"`.

### 3.13 OMR Layout Config (`/exam/setup/omr-config`) — `OmrConfigSetup.jsx`
Single-record form (table `cia_sheet_config`, `id=1`), two `<h5>` groups **"Design"** and
**"Reader"**: **Page 1 Top (px)**, **Page 2 Top (px)**, **QR Top (px)**, **QR Left (px)**,
**Register No. Top (px)**, **Register No. Left (px)**, **Right Width (px)** (all `required
maxLength={4}` text inputs), **Shaded Percentage (%)**. **Save** button (`btn-danger`). No
delete/list — this is a singleton config screen.

### 3.14 No Due Verification (`/exam/setup/exam-nodue`) — `ExamNodueSetup.jsx`
- **"Exam"** selector (from `loadNodueExamOptions()`, restricted to the *current* configured
  UG/PG academic year — no `EXAM` extra-years list, unlike other exam selectors) then a small text
  line showing `selectedExam.group` (course/year/type context).
- **Course/semester radio pills**, then **"Go"** button plus a `"Showing X to Y of Z entries"`
  summary once `pagination.total` is known.
- Info message when no data: `data.infoMessage`, e.g. `"No subjects found for this exam and year.
  Check exam schedule setup."` or `"No students found in exam batch for this selection. Configure
  Exam Batch first."` (both built server-side).
- Table: **#**, **Roll.No**, **Name**, one column per subject; each cell is a `<select>` populated
  from `data.noDueOptions` (table `master_setup` where `category='No-due'`) — this is a
  categorical clearance-status dropdown, **not** a percentage/free-text field.
- Pagination: page size computed dynamically by `pageSizeForSubjects` (server) —
  `Math.max(10, Math.floor(804 / subjectCount))`, i.e. fewer students per page as subject count
  grows (keeps the printed/rendered table width bounded). Pager shows Prev/page-numbers/Next.
- **Save** button (`btn-danger btn-lg`, centered) — hidden entirely when `readOnly` prop is true
  (meta doesn't mark this screen readOnly by default, but the component supports it).
- Save payload: `{ examSetupId, courseKey, page, students }`. Server
  (`server/src/services/exam/setup/examNodueSetup.js`, table `cia_exam_nodue`) does the standard
  soft-delete-then-recreate per active student row, writing one `cia_exam_nodue` record per
  student×subject with a `nodueId` (update) or none (create if `attPer` non-blank). No fee-status
  cross-check exists anywhere in this code path (see §5 edge cases).

### 3.15 Exam Examiners (`/exam/setup/exam-examiners`) — `ExamExaminersSetup.jsx`
- Exam + course/semester selectors, then **Subject** `<select>` (options highlighted green with a
  trailing `" *"` when `sub.hasExaminers`), **"Go"** button.
- Warning banner `data.infoMessage` when applicable; if `data.notConfigured` is also true, a
  **"Open Examiner Setup"** link button routes to `/exam/setup/examiner-setup` — a direct
  cross-screen nudge when the examiner-type master isn't configured yet.
- Table: **Type**, **Examiner Name**, **Designation**, **College** (a `<textarea>`), **Mobile
  No.**, **E-Mail ID** — all editable inputs (disabled when `readOnly`).
- **Save** button (`btn-danger btn-lg`, centered), hidden when `readOnly`.
- Save payload: `{ examSetupId, courseKey, subjectId, examiners }`.

### 3.16 Examiner Setup (`/exam/setup/examiner-setup`) — `ExaminerSetupSetup.jsx`
- **"Course & Academic year"** `CourseYearSelector` (course-name-keyed, per `data.courseOptions`).
- **"Year"** radio pills (`data.semesterOptions`).
- Table: **#**, **Examiner Type**, one column per batch number, each with a header
  **"Select"** checkbox (select-all for that batch column) and body checkboxes — a cell is
  disabled once a row already has a *different* batch selected (`row.selectedBatch != null &&
  row.selectedBatch !== batchNo`), enforcing one-batch-per-examiner-type.
- Client validation before save: `if (!rows.some(row => row.examinerType && row.selectedBatch))`
  → `"Please select at least one examiner type for a batch"` (shown via the notice/error slot,
  suppressing the server notice while this validation error is active).
- **Save** button (`btn-danger`, centered).
- Save payload: `{ courseKey, semester, totalBatch, rows }`.

### 3.17 Exam Attendance Certificate (`/exam/reports/exam-attendance-certificate`, `readOnly: true`) — `ExamAttendanceCertificateSetup.jsx`
Exam + course/semester + subject selectors, **"Go"** button, `data.infoMessage` info banner, then
a `ReportPrintBar` and raw `dangerouslySetInnerHTML` report body (`#att_report_span`). No save.

### 3.18 Attendance Entry (`/exam/setup/attendance-entry`) — `AttendanceEntrySetup.jsx`
Same paginated exam/course/subject-column table pattern as No Due, but attendance-percentage
inputs are free text normalized by `normalizeAttInput` (strips non `0-9.Aa`, collapses any
`A`/`a` to a lone `'A'`, `maxLength=5`, so e.g. entering `"75%"` becomes `"75"` and any `A`
overrides the whole field to `'A'` for "absent"). **Save** hidden when `readOnly`.

### 3.19 Attendance Report (`/exam/reports/attendance-report`, `readOnly: true`) — `AttendanceReportSetup.jsx`
Exam + course/semester selectors, **"Go"**, `ReportPrintBar`, then a table with subject columns
showing `shortName` / `(categoryShort)` headers and per-student attendance percentages
(`sub.attPer`), no editing.

### 3.20 Invigilator Schedule (`/exam/reports/invigilator-print`) — `InvigilatorPrintSetup.jsx`
Exam selector, **"Subject Category"** radios (`Theory` / `Clinical`), **"Exam Session"** radios
(`Morning` value=`Forenoon`, `Afternoon` value=`Afternoon` — label/value mismatch is intentional,
matching legacy `a_session_type` values), **Print** button using
`buildExamSchedulePrintHtml`/`printReportHtml('exam-schedule-print')`.

### 3.21 Exam Schedule Print (`/exam/reports/schedule-print`) — `SchedulePrintSetup.jsx`
Same Theory/Clinical toggle as Invigilator Schedule but no session split; **Print** button appears
only once `data.reportHtml` exists.

### 3.22 Term Report / Result Statement / Progress Card / Report Analysis — `ExamReportScreen.jsx`
Shared generic component (`screen` prop passed in): Exam + course/semester selectors, a **"Go"**
button (`goLabel` prop, default `"Go"`), `ReportPrintBar`, and raw HTML report body. Save payload
on Go: `{ action: 'go', Submit: 'Update', exam_name, course_name }` — read-only, no `save()` call
is ever invoked (only `load()`).

### 3.23 Report Analysis v1 (`/exam/reports/report-analysis-v1`, `readOnly: true`) — `ReportAnalysisV1Setup.jsx`
Exam + course/semester selectors. On data, renders: **"Individual Department Pass Percentage"**
table (subject columns from `data.subjectColumns`, percent cells suffixed `%` when
`row.isPercent`), **"Overall Pass Percentage"** single-cell table, **"Overall Topper"** table
(Rank/Reg.No./Marks/Name), **"Subject wise Topper"** table, **"Failed Student Details"** table
(S.No/Reg.No./Name/Marks/Failed Subject(s)) — each section only rendered when its backing array is
non-empty.

### 3.24 Term Sheets Upload (`/exam/reports/sheets-upload` under Setup hub; `readOnly: true` in meta but has its own save) — `SheetsUploadSetup.jsx`
- Client-side per-file validation before any request: extension must be `jpg/jpeg/gif` else
  `"Unsupported file type!"`; size `> 10 * 1024 * 1024` bytes → `"File is too big, it should be
  less than 10 MB."`. Valid files are uploaded **one at a time** (sequential `save()` calls),
  updating a `progress` percentage bar after each.
- `batchId` returned from the first successful upload is threaded into subsequent uploads
  (`currentBatch`), and rendered as an info banner: `"Batch #{batchId} — "` with a link to
  `/exam/reports/sheets-status?batchId={batchId}"`.
- Static help block (hard red text, four numbered rules):
  `"1. Upload *.gif, *.jpg format file only."`, `"2. Individual files size should be less than 10
  MB."`, `"3. Sheet should be scanned in 300 dpi, black & white color."`, `"4. Sheet should not be
  skew."` — verbatim legacy copy including the grammatical "should not be skew".

### 3.25 Term Sheets Status (`/exam/reports/sheets-status`, `readOnly: true`) — `SheetsStatusSetup.jsx`
Reads `batchId`/`b` from the URL query string on mount (deep-link target from Sheets Upload).
Filter row: **From**/**To** date pickers, **Batch ID** text input, **"Go"** button. `"Total
sheets: {data.totalCount}"` summary line. Rows grouped by upload date (`Fragment` per
`group.dateLabel`), columns Batch/Course/Exam/Subject/Type/Page/Status (HTML injected via
`row.statusHtml`)/File (link if `row.fileUrl`)/Time.

### 3.26 Mark Sheet Status (`/exam/reports/mark-sheet-status`, `readOnly: true`) — `MarkSheetStatusSetup.jsx`
Exam + course/semester selectors, then **"Marks"** checkboxes (`data.markOptions`) and
**"Status"** checkboxes (`data.processOptions`), **"Go"** button. Summary counters row (label +
count per `processTypes`, suffixed `"Subject"` for `"Not Printed"` else `"Sheet"`). Detail table:
#, Subject ID, Name, Category, Batch, Date, M.Type, Page, Status (badge, clickable link if
`row.fileUrl`), Remarks.

### 3.27 Mark Sheet Received (`/exam/reports/mark-sheet-received`, `readOnly: true`) — `MarkSheetReceivedSetup.jsx`
Same selector pattern with only a **"Marks"** checkbox group (no status filter). Detail table has
many currently-empty tracking columns (OMR Print/Hand Over/Rec/Scan/Upload/Status) rendered as
blank `<td/>` — a UI shell for workflow tracking that isn't wired to data yet.

### 3.28 Exam SMS (`/exam/setup/exam-sms`) — `ExamSmsSetup.jsx`
- Exam + course/semester selectors. Once selected: **"Total No. of Student"** big number
  (`recipients.length`); if `0`, `"No data found"`; otherwise **"Send SMS"** button (`btn-lg
  btn-danger`) opens a confirm modal (title `"Confirm"`, body `"Are you sure to send SMS..."`,
  buttons **Close**/**Send SMS**).
- On confirm, `sendSmsBatch()` first calls `save({ action: 'init', exam_name, course_name })`; on
  failure shows `initRes.message || 'Failed to initialize SMS batch'` and aborts. Otherwise it
  loops `recipients` **one at a time**, calling `save({ action: 'sendOne', mobile, message:
  encodeURIComponent(message), registerNo })`, updating a progress bar (`progress.current /
  progress.total`). Final notice: `"{sent} SMS Sent..."`.
- Recipient preview table: **Reg.No**, **Message** (`white-space: pre-wrap`).

### 3.29 Camp Activity Add (`/exam/setup/camp-activity-add`) — `CampActivityAddSetup.jsx`
Fields: **Camp Name** (required text), **Type** (checkboxes from `data.eventTypes`), **From
Date**/**To Date** (`datetime-local`, both required), **Venue** (required text), **Total Patient
Registration** (required text), **Description** (`<textarea rows={6}>`), **Attachment** (single
file, help text `data.attachmentHelp`), **Gallery** (multiple `image/*`, help text
`data.imagesHelp`), **Web View** radios (**Yes**/**No**, default `'1'`). Buttons: **Save**
(`btn-danger`), **Reset** (`type="reset"`, also manually clears React state).

### 3.30 Camp Activity Edit (`/exam/setup/camp-activity-edit`) — `CampActivityEditSetup.jsx`
Two modes driven by server response `data.mode`:
- **List mode**: search box + **"Search"** button, `"Showing page {page} of {totalPages}
  ({total} entries)"`, table (From Date/To Date/Event Name/actions), per-row **Edit**/**Delete**
  buttons, Prev/Next pager. Empty state: `"No data available"`. Delete → modal `"Are you sure to
  delete..."` → **Close**/**Confirm**.
- **Edit mode**: same field set as Add, plus **Status** radios (`Confirm`/`Not Yet Confirm`/
  `Postpone`/`Cancel`, values `1/4/2/3`), an existing-attachment link, and a **Gallery** section
  below the form listing existing photos (thumbnail, per-photo Order/Title inputs, a select
  checkbox) with **"Update Gallery Title & Order"** and **"Delete Selected Gallery"** buttons.
  **"Back"** link returns to list mode without saving.

### 3.31 Camp Activity Type (`/exam/setup/camp-activity-type`) — `CampActivityTypeSetup.jsx`
Table of existing categories (editable title inputs, per-row Delete → confirm modal) plus dynamic
"add new" rows — typing into the last blank row auto-reveals another blank row via a **"+"**
button. Optional `data.warning` banner. Single **Save** button submits both `updates` (existing
rows) and `newTitles` (non-blank new rows) together.

### 3.32 Unrouted / generic fallback — `GenericExamScreen.jsx`
Not wired into `NATIVE_SCREENS` in `ExamSetupPage.jsx` (dead code path today — no meta entry
routes to it directly), but present in the codebase as a debug/inspection scaffold: academic
year/type filter, summary tiles (Total/Active/Deleted), raw table dump with `data.tableName`
shown as `Data source: <code>{tableName}</code>`, and (when not `readOnly`) a "Quick settings"
note+enabled-flag saver. Exists as a generic placeholder pattern, not a real screen today.

## 4. Primary user stories

**US-1 — Configure exam names.** As exam cell staff, I open **Exam Names**
(`/exam/setup/exam-names`), add a row with **Order** `1`, **Name** `"CIA-1"`, **Month**
`"August"`, click **Save**, and see `"Your details are Updated..."`. *Acceptance:* the row appears
in `cia_exam_name` with `del=1`; every previously-active row is soft-deleted first (full-replace
semantics), so any name/month I don't include in this save disappears from the active list even if
I didn't touch it.

**US-2 — Configure a term exam for U.G Regular 2025-2026.** As exam cell staff, I select
`"U.G | 2025-2026 (Regular)"` from **Course & Academic year** on `/exam/setup/exam-setup`, pick an
**Exam Name**, check **Internal**/**Viva**/**Theory** as applicable, set **From**/**To** dates,
click **Save**. *Acceptance:* a `cia_setup` row is written keyed by `course_name='U.G'`,
`academic_year='2025-2026'`, `academic_type='regular'` — **not** by `course_id`, per the
COURSE_NAME-keyed convention for this screen.

**US-3 — Allocate practical batches.** As exam cell staff, on `/exam/setup/exam-batch` I select
`"BDS - Dental | 2025-2026 (Regular)"` (a course-id-keyed option), pick **Year** `3`, type **Batch**
`4`, click **Go**, then check the appropriate **Batch {letter}** cell for each student, click
**Save**. *Acceptance:* `cia_batch_tb` rows are written keyed by `course_id` (not `course_name`),
one row per batch number holding a comma-joined `roll_no` list; success message `"Your details are
added..."`.

**US-4 — Enter internal marks.** As a faculty member, I open **Mark Entry**, pick the exam, my
course/semester, then a subject showing green highlight if marks already exist. I type internal
and viva marks; **Total** and **Result** auto-compute once all required parts are filled. I click
**Save** and see `"Your details are updated..."`. *Acceptance:* `cia_marks_tb` rows are
created/updated per student for that exam+course+subject; a mark exceeding its configured maximum
is rejected (cleared) client-side before it can be saved.

**US-5 — Schedule an exam subject with invigilators.** As exam cell staff, on
`/exam/setup/exam-schedule` I pick the exam and course/semester, set a **Date**, toggle
**Session** to `AN`, pick batches via the chip selector, pick invigilators via the searchable chip
selector, click **Save Schedule**. *Acceptance:* `cia_schedule_tb` is updated; a subject row left
with no date is not persisted (silently skipped, not an error).

**US-6 — Print an OMR mark sheet.** As exam cell staff, on `/exam/setup/mark-sheet` I select exam
and course/semester, find the scheduled subject row, click **Print**. *Acceptance:* a new window
opens `GET /api/exam/marksheet/print?...&flag=1`, which auto-triggers `window.print()` on load and
embeds a QR code per page encoding exam/schedule/page identifiers for later OMR scan matching.

**US-7 — Clear a student for no-due.** As exam cell staff, on `/exam/setup/exam-nodue` I select
the exam and course/semester, click **Go**, and for each student×subject cell pick a clearance
status from the dropdown (sourced from `master_setup` category `'No-due'`), then **Save**.
*Acceptance:* `cia_exam_nodue` rows are written per student×subject; message
`"Your details are updated..."`.

**US-8 — Send exam SMS to a class.** As exam cell staff, on `/exam/setup/exam-sms` I select exam
and course/semester, see the recipient count and preview table, click **Send SMS**, confirm in the
modal. *Acceptance:* the batch is initialized first (`action: 'init'`), then each recipient is sent
individually with a live progress bar; final notice reports `"{n} SMS Sent..."`.

**US-9 — Check today's exam summary.** As any staff member, I open `/exam/dashboard`.
*Acceptance:* if the server-side cache built within the last 10 minutes, the response returns
instantly from `dashboardCache`; otherwise it builds fresh and caches. I can force-refresh via the
**Refresh** button. I can **Print** the rendered dashboard.

**US-10 — Look up a student's CIA marks.** As exam cell staff (or a front-desk operator answering
a parent query), on `/exam/student-statement` I type a register number and click **Load
statement**. *Acceptance:* if the register number doesn't match an active `student_profile_tb` row,
I see `"Student not found"`; otherwise the CIA statement HTML renders and I can **Print** it.

## 5. Rare / edge-case user stories

**EDGE-1 — Exam Batch Allocation confused with Term Exam Setup (rare but costly mistake).**
`exam_batch.php` (component `ExamBatchSetup.jsx`, screen key `exam-batch`) and `term_exam_setup.php`
(component `TermExamSetup.jsx`, screen key `exam-setup`) look superficially similar — both start
with a "Course & Academic year" style selector — but they target **different tables with
different key formats**:
- `exam_batch.php` → `ExamBatchSetup.jsx` → `server/src/services/exam/setup/examBatchSetup.js` →
  table **`cia_batch_tb`**, key built by `buildCourseIdYearOptions()` /
  parsed by `parseCourseIdYearKey()` in `examSetupShared.js` — format
  `courseId___academicYear___academicType` (e.g. `12___2025-2026___regular`).
- `term_exam_setup.php` → `TermExamSetup.jsx` → `server/src/services/exam/setup/termExamSetup.js`
  → table **`cia_setup`**, key built by `buildCourseYearOptions()` / parsed by
  `parseCourseYearKey()` in `server/src/services/shared/ciaSetupHelpers.js` — format
  `courseName___academicYear___academicType` (e.g. `U.G___2025-2026___regular`).

If an agent or developer copies the course-dropdown logic from one screen to the other (e.g.
wiring `buildCourseYearOptions` into `ExamBatchSetup.jsx`), `parseCourseIdYearKey` on the batch
screen would try to read `Number(parts[0])` from a course *name* like `"U.G"`, yielding `NaN` for
`courseId` — every downstream query (`loadActiveStudentsForBatch`, `loadBatchAssignments`,
`getMaxBatchCount`, all filtering on `course_id='${courseId}'`) would silently return zero rows.
The batch screen would appear to "work" (dropdown populates, Go button responds) but never show
students, and any save would write batch rows with `course_id='NaN'` — a real correctness bug that
would not throw an exception and could go unnoticed until reports downstream (mark sheet print,
exam schedule, no-due) also come up empty for that course/year. Conversely, wiring
`buildCourseIdYearOptions` into `TermExamSetup.jsx` would break `cia_setup` writes because
`course_name` would end up storing a numeric course ID string instead of `"U.G"`/`"P.G"`, silently
corrupting a `course_name` column that every other exam screen (mark entry, schedule, no-due, all
of which resolve exam context via `cia_setup.course_name`) depends on being a clean course name.

**EDGE-2 — Marking a student absent in Mark Entry.** As faculty, I type `"A"` into a student's
**Int.** mark field. `normalizeMarkInput` accepts it as `'A'`; `calculateMarkTotal` treats any
part being `'A'` as making the whole `tMark` `'A'` and `result` `'AB'` once all three enabled
parts have values — the student's other numeric marks (if any were also entered) are overridden
by the absence flag rather than summed. If I type both `"n"` and `"a"` (e.g. paste `"na"`),
`normalizeMarkInput` collapses it to `'NA'` (Not Applicable) rather than `'A'` — a subtly different
status (`result: 'NA'`) from Absent (`result: 'AB'`), and it's easy to fat-finger one for the
other since both are two-character, case-insensitive tokens typed into the same tiny 60px-wide
input.

**EDGE-3 — No-due clearance has no fee-status cross-check.** `ExamNodueSetup.jsx` /
`server/src/services/exam/setup/examNodueSetup.js` present a purely categorical clearance dropdown
per student×subject sourced from `master_setup` (`category='No-due'`) — there is no query against
any `fee_*` table anywhere in the no-due load/save path (confirmed by grep across
`server/src/services/exam/`: `fees` only ever appears as an import of `convertNYear`, a label
helper, never a balance check). If a college process expects "no-due" to mean "fees cleared," that
enforcement is entirely a manual judgment call by the staff member filling in the dropdown — the
system will happily let a student with an outstanding fee balance be marked cleared, and there is
no cross-module warning surfaced on this screen today.

**EDGE-4 — Marksheet print for a student whose DOB (or other legacy zero-date column) is
`0000-00-00`.** Per CLAUDE.md, `0000-00-00` is a real, valid "empty" value in this schema.
`buildExamMarksheetHtml` (`server/src/services/exam/examMarksheetPrint.js`) does construct a
`new Date(row.exam_date)` and call `.toLocaleDateString(...)` directly on it for the exam date
label — if `exam_date` were ever a zero-date (it shouldn't be, since `cia_schedule_tb` rows are
only created with a validated `parseInputDate(row.examDate)` per §3.10), `new Date('0000-00-00')`
produces an `Invalid Date`, and `.toLocaleDateString()` on an Invalid Date returns the literal
string `"Invalid Date"` embedded directly into the printed OMR sheet header — there is no
`formatDisplayDate`/zero-date guard on this particular call, unlike `examSetupShared.js` and
`ciaSetupHelpers.js` which both route dates through `formatDisplayDate`.

**EDGE-5 — Exam dashboard cold-cache first load under concurrent requests.** The first user to hit
`/exam/dashboard` after a server restart (or after the 10-minute `CACHE_MS` window expires) forces
a full `buildExamDashboardHtml()` build. `loadExamDashboard` in
`server/src/services/exam/examDashboard.js` guards this with a module-level `dashboardInflight`
promise: if a second user's request arrives while the first build is still running, it is handed
the *same* in-flight promise rather than triggering a duplicate rebuild — but the client-side
`sessionStorage` cache (`cis_exam_dashboard_v3`, per-browser-tab) has no equivalent coordination,
so on a truly cold browser session the user sees the `"Loading exam dashboard…"` spinner for
however long the server-side build takes (which can be non-trivial since `buildExamDashboardHtml`
pulls aggregate data across active exams), with no partial/skeleton content — a real wait, not
an instant response, contrary to what the 10-minute cache TTL might suggest for subsequent loads.

**EDGE-6 — Term Exam Setup soft-delete blast radius.** `saveExamNameSetup` in
`examNameSetup.js` soft-deletes **every** currently-active `cia_exam_name` row
(`updateMany({ where: { del: 1 }, data: { del: 0, ...update } })`) before re-inserting whatever the
client submitted — this is a global operation, not scoped to any course/year. If a save request is
sent with an incomplete `rows` array (e.g. a client bug drops a row before submit, or a
partially-loaded form is submitted), previously-configured exam names that simply weren't included
in that particular payload are permanently soft-deleted, even though the user never intended to
touch them. Unlike Exam Batch or Term Exam Setup (which scope their soft-delete to a specific
course/year/type/subject combination), this is a table-wide replace.

**EDGE-7 — Invigilator list silently truncated at 25 characters.** `saveExamSchedule`
(`server/src/services/exam/setup/examScheduleSetup.js`) builds `invigilator:
scheduleInvigilatorList(row.invigilators)` which joins comma-separated staff IDs and hard-slices
to 25 characters (`.slice(0, 25)`). For a subject needing many invigilators (large clinical batch
with several supervising staff), the assignment list can be cut mid-ID, and the UI's
`ChipMultiSelect` gives no indication that a selection beyond ~5-6 staff IDs will be truncated on
save — the invigilator schedule print for that subject could then show fewer names than were
actually selected.

**EDGE-8 — Term Sheets Upload rejects a valid-looking file client-side, not server-side.**
`SheetsUploadSetup.jsx` performs extension and size checks (`jpg/jpeg/gif`, `<10MB`) entirely in
the browser before ever calling `save()` — a `.png` scan or an 11 MB `.jpg` never reaches the
server at all; the rejection message (`"Unsupported file type!"` / `"File is too big, it should be
less than 10 MB."`) is appended straight into the same `results` list used for genuine
server-acknowledged upload results, so a user scanning the results list cannot visually distinguish
a client-side rejection from a server-side failure without reading the message text.

## 6. Future (not implemented)

*(Future — not implemented. Grounded in [../mobile.md](../mobile.md) §6, which explicitly scopes
mobile exam access to **"Read-only in v1: schedule + marks/results view. Setup/admin exam screens
stay web-only,"** and in realistic extrapolation of the current architecture — none of the
following exists in the codebase today.)*

- **Mobile read-only exam schedule + results view.** Per `mobile.md` §6, a future Expo app would
  reuse the existing `/api/exam` read endpoints (dashboard, schedule, results) to show students
  their exam timetable and released CIA marks on a phone, with no setup/admin screens ported —
  admin/setup stays web-only per `mobile.md` §6's explicit v1 principle.
- **Push notification when marks are published.** `mobile.md` §8 lists push notifications as an
  unconfirmed, not-yet-built item requiring new backend surface (`server/src/services/push/`)
  triggered from existing services — a natural extension would fire a push when
  `saveMarkEntry`/`saveTermExamSetup` flips a `cia_setup.exam_status` to closed/published, notifying
  affected students. This is speculative; no such trigger exists in `markEntrySetup.js` or
  `termExamSetup.js` today.
- **Online result-publishing portal for parents/students.** Extrapolating from the existing
  Student Exam Statement screen (`/exam/student-statement`, currently a staff-facing lookup tool
  requiring manual register-number entry), a self-service portal where a student logs in directly
  and pulls their own statement is a plausible future extension of the same
  `loadExamStudentStatement` service — not implemented; today's screen has no student-facing auth
  scoping, it's a staff tool.
- **Automated invigilator/seating conflict detection.** Given `EDGE-7`'s invigilator-list
  truncation and the fact that `ExamScheduleSetup.jsx`'s `ChipMultiSelect` currently allows
  assigning the same staff member as invigilator to two subjects scheduled at overlapping
  date/session with no client- or server-side conflict check, a sensible extrapolation is
  automated double-booking detection across `cia_schedule_tb` rows sharing a staff ID and
  overlapping `exam_date`/`exam_session` — not implemented today.
- **OMR upload/status webhook instead of manual polling.** Term Sheets Status
  (`/exam/reports/sheets-status`) is a manual "Go" refresh screen today; a future push-based status
  update (e.g. via the same prospective push infrastructure) could notify exam cell staff the
  moment a batch's sheets finish uploading, rather than requiring them to revisit the status page.

## 7. Traceability table

| Story | Client file(s) | Server file(s) / endpoint | Table(s) |
|---|---|---|---|
| US-1 Exam Names | `setup/ExamNameSetup.jsx` | `POST /api/exam/setup/exam-names/load\|save` → `services/exam/setup/examNameSetup.js` | `cia_exam_name` |
| US-2 Term Exam Setup | `setup/TermExamSetup.jsx` | `POST /api/exam/setup/exam-setup/load\|save` → `services/exam/setup/termExamSetup.js`, `services/shared/ciaSetupHelpers.js` | `cia_setup` |
| US-3 Exam Batch | `setup/ExamBatchSetup.jsx` | `POST /api/exam/setup/exam-batch/load\|save` → `services/exam/setup/examBatchSetup.js`, `services/exam/setup/examSetupShared.js` | `cia_batch_tb`, `student_profile_tb`, `student_academic_tb` |
| US-4 Mark Entry | `setup/MarkEntrySetup.jsx`, `setup/markEntryUtils.js` | `POST /api/exam/setup/mark-entry/load\|save` → `services/exam/setup/markEntrySetup.js`, `services/exam/setup/examMarkLogic.js` | `cia_marks_tb`, `cia_schedule_tb`, `basic_subject_marks_tb` |
| US-5 Exam Schedule | `setup/ExamScheduleSetup.jsx` | `POST /api/exam/setup/exam-schedule/load\|save` → `services/exam/setup/examScheduleSetup.js` | `cia_schedule_tb`, `staff_profile_tb` |
| US-6 Mark Sheet Print | `setup/MarkSheetSetup.jsx` | `GET /api/exam/marksheet/print` → `services/exam/examMarksheet.js`, `services/exam/examMarksheetPrint.js` | `cia_omr_sheet_tb`, `cia_sheet_config`, `cia_schedule_tb` |
| US-7 No Due Verification | `setup/ExamNodueSetup.jsx` | `POST /api/exam/setup/exam-nodue/load\|save` → `services/exam/setup/examNodueSetup.js` | `cia_exam_nodue`, `master_setup`, `cia_batch_new`/`cia_batch_tb` |
| US-8 Exam SMS | `setup/ExamSmsSetup.jsx` | `POST /api/exam/setup/exam-sms/load\|save` → `services/exam/setup/examSmsSetup.js` | (SMS recipients derived from student/course tables) |
| US-9 Exam Dashboard | `ExamDashboard.jsx` | `GET /api/exam/dashboard` → `services/exam/examDashboard.js`, `examDashboardCore.js` | (aggregate across exam tables) |
| US-10 Student Statement | `ExamStudentStatement.jsx` | `POST /api/exam/student-statement` → `services/exam/examStudentStatement.js`, `examStudentStatementCore.js` | `student_profile_tb`, `cia_marks_tb` |
| EDGE-1 Batch/Setup key confusion | `setup/ExamBatchSetup.jsx` vs `setup/TermExamSetup.jsx` | `examSetupShared.js` (`buildCourseIdYearOptions`/`parseCourseIdYearKey`) vs `ciaSetupHelpers.js` (`buildCourseYearOptions`/`parseCourseYearKey`) | `cia_batch_tb` vs `cia_setup` |
| EDGE-2 Absent/NA marks | `setup/markEntryUtils.js` | `services/exam/setup/examMarkLogic.js` (`calculateMarkTotal`) | `cia_marks_tb` |
| EDGE-3 No fee cross-check | `setup/ExamNodueSetup.jsx` | `services/exam/setup/examNodueSetup.js` | `cia_exam_nodue`, `master_setup` (no `fee_*` table joined) |
| EDGE-4 Zero-date marksheet | — | `services/exam/examMarksheetPrint.js` | `cia_schedule_tb.exam_date` |
| EDGE-5 Dashboard cold cache | `ExamDashboard.jsx` (sessionStorage `cis_exam_dashboard_v3`) | `services/exam/examDashboard.js` (`dashboardInflight`, `CACHE_MS`) | — |
| EDGE-6 Exam Names global soft-delete | `setup/ExamNameSetup.jsx` | `services/exam/setup/examNameSetup.js` (`updateMany({ where: { del: 1 } })`) | `cia_exam_name` |
| EDGE-7 Invigilator truncation | `setup/ExamScheduleSetup.jsx` (`ChipMultiSelect`) | `services/exam/setup/examScheduleSetup.js` (`scheduleInvigilatorList`, `.slice(0,25)`) | `cia_schedule_tb.invigilator` |
| EDGE-8 Client-only upload validation | `setup/SheetsUploadSetup.jsx` | `services/exam/setup/sheetsUploadSetup.js` (never reached for rejected files) | — |
| Future: mobile read-only exam | — (not built) | `mobile.md` §6, would reuse `GET /api/exam/dashboard`, exam results/schedule endpoints | — |
| Future: push on marks published | — (not built) | `mobile.md` §8 (`server/src/services/push/`, not present) | — |
| Future: online result portal | — (not built) | extrapolation of `services/exam/examStudentStatement.js` | `student_profile_tb`, `cia_marks_tb` |
| Future: invigilator conflict detection | — (not built) | extrapolation of `services/exam/setup/examScheduleSetup.js` | `cia_schedule_tb` |

# 07 — Attendance

> Deep-dive user stories for the Attendance module. Companion to
> [../userstory.md](../userstory.md). See [../CLAUDE.md](../CLAUDE.md) for
> repo-wide rules (`del=1` = ACTIVE, zero-dates are real, course-key formats,
> soft-delete pattern).

## 1. Module overview

**Purpose.** Attendance covers everything the college tracks about *presence* —
staff biometric/manual attendance, staff leave/permission/defaulter approval
workflows, staff holiday rosters and time schedules, and the parallel set of
screens for students (UG daily/period attendance, PG and Internship period
attendance with their own holiday rosters and punch reports, subject-wise UG
attendance reports, SMR leave/permission/defaulter approval for students, and
year-incharge assignment). It is one of the largest modules in the app: the
staff side alone has 26 screens and the student side 27 (`AttendanceHub.jsx`
comment: *"All 26 staff attendance screens"* / *"All 27 student attendance
screens"*).

**Primary actors**
- **Attendance/HR office staff** — mark manual attendance, run live biometric
  punch entry, generate calendar/report views, refresh the attendance cache.
- **Reporting authority / department head** — approve or reject staff leave,
  permission, and defaulter (late-mark) requests; approve student leave,
  permission, and defaulter requests; assign year incharge staff.
- **Attendance/exam admin** — configure the institution working-day calendar,
  staff/PG/Internship attendance time schedules, holiday rosters, and SMR
  (leave/permission/defaulter) policy setup (allowed OD types, apply windows).
- **Any authenticated staff with menu access to `attendance`** — the whole
  module sits behind `menuAuthForModule('attendance')`
  (`server/src/routes/attendance.js:40`); `accessType === 'Global'` bypasses
  the menu check per `docs/auth-flow.md`.

**Legacy PHP files replaced** (non-exhaustive; every screen below cites its
own `.php`): `individual_calendar.php`, `staff_att_report.php`,
`staff_live_attendance.php`, `staff_daily_attendance.php`,
`biomertic_att.php`, `staff_calendar_add.php`, `staff_calendar_edit.php`,
`staff_leave_acknowledge.php`, `staff_leave_approve.php`,
`staff_permission_approve.php`, `staff_defaulter_approve.php`,
`staff_lpd_report.php`, `staff_holiday_roster.php`, `staff_compensation.php`,
`staff_attendance_report.php`, `teaching_staff_att_report.php`,
`staff_yearly_report.php`, `clear_icache.php`, `staff_att_chart.php`,
`staff_att_chart_modified.php`, `staff_att_chart_combine.php`,
`staff_academic_calendar.php`, `staff_att_time.php`,
`staff_att_time_report.php`, `staff_cl_el.php`, `staff_att_transport.php`,
`available_leave.php`, `student_mattendance.php`, `attendance_report.php`,
`attendance_report_quartely_v1.php`, `student_bio_att.php`,
`holiday_report.php`, `stu_leave_approval.php`,
`student_leave_approval.php`, `stu_permission_approval.php`,
`stu_defaulter_approval.php`, `student_lpd_report.php`,
`stu_leave_approval_setup.php`, `pg_attendance_setup.php`,
`pg_holiday_roster_add.php`, `pg_holiday_roster_edit.php`,
`pg_mattendance.php`, `pg_attendance_report.php`,
`pg_attendance_punch_add.php`, `pg_attendance_punch.php`,
`staff_incharge_setup.php`, `attendance_ug_report.php`,
`intern_att_setup.php`, `intern_holiday_roster_add.php`,
`intern_holiday_roster_edit.php`, `intern_mattendance.php`,
`istudent_att_report.php`, `istudent_att_card.php`.

---

## 2. Screen inventory

All routes are mounted under `/attendance` (`client/src/routes/AppRoutes.jsx`
lines 194–206) and every API call goes through
`server/src/routes/attendance.js`, gated by
`authMiddleware, menuAuthForModule('attendance')`.

### Hub / top-level

| Route | Component file | Legacy counterpart |
|---|---|---|
| `/attendance` | `client/src/pages/attendance/AttendanceHub.jsx` | (hub, no single legacy page) |
| `/attendance/staff/hub` | `client/src/pages/attendance/staff/StaffAttHub.jsx` | (hub) |
| `/attendance/students/hub` | `client/src/pages/attendance/students/StudentAttHub.jsx` | (hub) |
| `/attendance/staff` | `client/src/pages/attendance/StaffAttendanceCalendar.jsx` | `individual_calendar.php` |
| `/attendance/staff/report` | `client/src/pages/attendance/StaffAttendanceReport.jsx` | `staff_att_report.php` |
| `/attendance/staff/punch` | `client/src/pages/attendance/StaffLivePunch.jsx` | `staff_live_attendance.php` |
| `/attendance/students/daily` | `client/src/pages/attendance/StudentDailyAttendance.jsx` | `student_mattendance.php` |
| `/attendance/students/report` | `client/src/pages/attendance/StudentAttendanceReport.jsx` (`variant="standard"`) | `attendance_report.php` |
| `/attendance/students/report/quarterly` | `client/src/pages/attendance/StudentAttendanceReport.jsx` (`variant="quarterly"`) | `attendance_report_quartely_v1.php` |

### Staff attendance — dynamic screen router (`/attendance/staff/:screen`)

Rendered by `client/src/pages/attendance/staff/StaffAttScreenPage.jsx`,
driven by `STAFF_ATT_SCREEN_META` in
`client/src/pages/attendance/staff/staffAttSetupMeta.js`, hitting
`POST /api/attendance/staff/:screen` (load) and
`POST /api/attendance/staff/:screen/save`.

| Slug | Title | Legacy `.php` |
|---|---|---|
| `daily-attendance` | Daily Attendance | `staff_daily_attendance.php` |
| `biometric-report` | Biometric Report | `biomertic_att.php` |
| `smr-acknowledge` | SMR Acknowledge | `staff_leave_acknowledge.php` |
| `smr-leave-approve` | Leave Approve | `staff_leave_approve.php` |
| `smr-permission-approve` | Permission Approve | `staff_permission_approve.php` |
| `smr-defaulter-approve` | Defaulter Approve | `staff_defaulter_approve.php` |
| `smr-lpd-report` | L/P/D Report | `staff_lpd_report.php` |
| `holiday-roster` | Holiday Roster | `staff_holiday_roster.php` |
| `compensation` | Compensation | `staff_compensation.php` |
| `attendance-report` | Attendance Report | `staff_attendance_report.php` |
| `teaching-month-report` | Teaching Month Report | `teaching_staff_att_report.php` |
| `yearly-report` | Yearly Report | `staff_yearly_report.php` |
| `clear-icache` | Clear ICache | `clear_icache.php` |
| `att-chart` | Att Chart | `staff_att_chart.php` |
| `att-chart-modified` | Att Chart Modified | `staff_att_chart_modified.php` |
| `att-chart-combined` | Att Chart Combined | `staff_att_chart_combine.php` |
| `att-time-report` | Att Time Report | `staff_att_time_report.php` |
| `available-cl` | Available CL/EL | `staff_cl_el.php` |
| `att-transport` | Att Transport | `staff_att_transport.php` |
| `available-leave` | Available Leave | `available_leave.php` |

### Staff attendance — setup screens (`/attendance/staff/setup/:screen`)

Rendered by `client/src/pages/attendance/staff/StaffAttSetupPage.jsx` via
`STAFF_ATT_SETUP_META`, hitting
`POST /api/attendance/staff/setup/:screen/load|save|more`.

| Slug | Component | Legacy `.php` |
|---|---|---|
| `calendar-add` | `setup/CalendarAddSetup.jsx` | `staff_calendar_add.php` |
| `calendar-edit` | `setup/CalendarEditSetup.jsx` | `staff_calendar_edit.php` |
| `working-day` | `setup/WorkingDaySetup.jsx` | `staff_academic_calendar.php` |
| `att-time` | `setup/AttTimeSetup.jsx` | `staff_att_time.php` |

### Student attendance — dynamic screen router (`/attendance/students/:screen`)

Rendered by `client/src/pages/attendance/students/StudentAttScreenPage.jsx`,
driven by `STUDENT_ATT_SCREEN_META` in
`client/src/pages/attendance/students/studentAttMeta.js`, hitting
`POST /api/attendance/students/:screen/load` and
`POST /api/attendance/students/:screen/save`.

| Slug | Title | Legacy `.php` | `meta.type` |
|---|---|---|---|
| `biometric-report` | Biometric Reports | `student_bio_att.php` | `date-roll-report` |
| `holiday-report` | Holiday Report | `holiday_report.php` | `date-category-report` |
| `smr-leave-request` | SMR — Leave Request | `stu_leave_approval.php` | `approval` |
| `smr-dept-leave` | SMR — Dept. Leave Request | `student_leave_approval.php` | `approval` |
| `smr-permission` | SMR — Permission | `stu_permission_approval.php` | `approval` |
| `smr-defaulter` | SMR — Defaulter | `stu_defaulter_approval.php` | `approval` |
| `smr-lpd-report` | SMR — L/P/D Report | `student_lpd_report.php` | `lpd-report` |
| `smr-setup` | SMR — Setup | `stu_leave_approval_setup.php` | `smr-setup` |
| `pg-att-setup` | PG Att. Setup | `pg_attendance_setup.php` | `pg-setup` |
| `pg-holiday-roster-add` | PG Holiday Roster — Add | `pg_holiday_roster_add.php` | `roster` |
| `pg-holiday-roster-edit` | PG Holiday Roster — Edit | `pg_holiday_roster_edit.php` | `roster` |
| `pg-manual-att` | PG Manual Attendance | `pg_mattendance.php` | `period-att` |
| `pg-reports-att` | PG Reports Att | `pg_attendance_report.php` | `pg-att-report` |
| `pg-punch-entry` | PG Punch Entry | `pg_attendance_punch_add.php` | `pg-punch-entry` |
| `pg-punch` | PG Attendance Punch | `pg_attendance_punch.php` | `pg-punch` |
| `year-incharge` | UG/PG Year Incharge | `staff_incharge_setup.php` | `incharge-grid` |
| `ug-att-report` | UG Attendance Report | `attendance_ug_report.php` | `student-id-report` |
| `intern-att-setup` | Internship Att. Setup | `intern_att_setup.php` | `intern-setup` |
| `intern-holiday-roster-add` | Intern Holiday Roster — Add | `intern_holiday_roster_add.php` | `roster` |
| `intern-holiday-roster-edit` | Intern Holiday Roster — Edit | `intern_holiday_roster_edit.php` | `roster` |
| `intern-manual-att` | Internship Manual Att. | `intern_mattendance.php` | `period-att` |
| `intern-reports-att` | Internship Reports Att | `istudent_att_report.php` | `date-report` |
| `intern-att-statement` | Intern Att. Statement | `istudent_att_card.php` | `intern-att-statement` |

Every student screen also lives under `/academic/setup/academic-calendar`
(Working Day Config, `academic_calendar.php`) which is documented in the
Academic module, not here — `STUDENT_ATT_CORE_LINKS` links to it for
convenience only.

### Server dispatch map (all under `router.use(authMiddleware, menuAuthForModule('attendance'))`)

| Endpoint | Service function | File |
|---|---|---|
| `GET /api/attendance/staff/categories` | `getStaffCategoryOptions` | `server/src/services/staff/staffCategories.js` |
| `POST /api/attendance/staff/calendar` | `getStaffAttendanceCalendar` → `buildStaffAttendanceCalendar` | `attendanceStaff.js`, `staffCalendar.js` |
| `POST /api/attendance/staff/punch` | `punchStaffLiveAttendance` | `staffLivePunch.js` |
| `POST /api/attendance/staff/report` | `generateStaffAttendanceReport` → `buildStaffAttendanceReport` | `attendanceStaff.js`, `staffReport.js` |
| `POST /api/attendance/staff/setup/:screen/load\|save\|more` | `loadStaffAttSetupScreen` / `saveStaffAttSetupScreen` / `staffAttSetupMore` | `staffAttendanceSetup.js` → `setup/calendarSetup.js` |
| `POST /api/attendance/staff/:screen` (load) / `/save` / `/more` | `loadStaffAttScreen` / `saveStaffAttScreen` / `staffAttScreenMore` | `staffAttendanceScreens.js` → `screens/{approvalScreens,gridScreens,reportScreens,utilityScreens}.js` |
| `GET /api/attendance/students/filters` | `getStudentAttendanceFilters` | `attendanceStudent.js` |
| `POST /api/attendance/students/daily` (load) / `PUT` (save) | `getStudentDailyAttendanceSheet` / `saveStudentDailyAttendance` | `attendanceStudent.js` → `studentDaily.js` |
| `GET /api/attendance/students/report/years` | `getStudentReportAcademicYears` | `attendanceStudent.js` |
| `POST /api/attendance/students/report/filters` | `getStudentReportFilters` | `studentReportFilters.js` |
| `POST /api/attendance/students/report/setup` | `setupStudentAttendanceReport` | `studentAttendanceReportCore.js` |
| `POST /api/attendance/students/report/generate` | `generateStudentAttendanceReport` | `studentAttendanceReportCore.js` |
| `POST /api/attendance/students/pg-report/setup\|generate` | `setupPgAttendanceReportScreen` / `generatePgAttendanceReport` | `pgAttendanceReportCore.js` |
| `POST /api/attendance/students/:screen/load` / `/save` | `loadStudentAttScreen` / `saveStudentAttScreen` | `studentAttendanceScreens.js` → `screens/{studentApprovalScreens,studentGridScreens,studentReportScreens,studentSetupScreens}.js`, `pgAttendanceCore.js`, `internAttStatementCore.js`, `studentPeriodAtt.js` |

---

## 3. Pixel-level flow per screen

### 3.1 Staff Attendance Calendar — `/attendance/staff`
File: `client/src/pages/attendance/StaffAttendanceCalendar.jsx`. Legacy:
`individual_calendar.php`.

- Breadcrumb: Home / Attendance / **Staff Calendar**.
- Heading `Staff Attendance Calendar` + **Back** button (→ `/attendance`).
- Filter card:
  - Label **Staff ID**, plain text `<input>`, bound to `staffId` (pre-filled
    from `?staffId=` query param if present).
  - Submit button labeled **Go** (**Loading...** while `generating`).
- Errors render as `<div className="alert alert-danger">`.
- On submit, `POST /api/attendance/staff/calendar { staffId }` →
  `getStaffAttendanceCalendar` → `buildStaffAttendanceCalendar`
  (`staffCalendar.js`). Renders returned `html` (raw month-grid calendar with
  prev/next‑month legacy links `individual_calendar.php?staff_id=…&m1=…&m2=…`)
  via `dangerouslySetInnerHTML`. Clicking a prev/next link inside the embedded
  HTML is intercepted client-side and re-POSTs with `fromDate`/`toDate`
  instead of navigating away.
- Server validation: `staffId` required → `{ error: 'staffId is required' }`
  (400). Staff must exist, `del=1`, and be currently in service
  (`releaving_date='0000-00-00' OR releaving_date > CURDATE()`), else
  `{ error: 'Staff member not found' }` (400).
- Calendar cells: `X` present, `/` forenoon present, `\` afternoon present,
  `L` leave, `A` absent, `H` holiday (footnote rendered verbatim in the HTML:
  *"X Present | / Forenoon Present | \ Afternoon Present | L Leave | A Absent
  | H Holiday"*). Totals table shows Working Days / Present / Leave / Absent
  / Late / Permission.

### 3.2 Staff Attendance Report — `/attendance/staff/report`
File: `client/src/pages/attendance/StaffAttendanceReport.jsx`. Legacy:
`staff_att_report.php`.

- Breadcrumb: Home / Attendance / **Staff Report**. Heading `Staff Attendance
  Report` + **Back**.
- Categories: label **Categories**, one pill-style checkbox
  (`btn btn-sm btn-outline-secondary`) per row from
  `GET /api/attendance/staff/categories` (`{ categories: [{id,name}] }`).
- **From** / **To**: `type="date"` inputs, default From = one month ago + 1
  day, To = today; each constrains the other via `min`/`max`.
- **Generate** button (`btn btn-danger`, disabled while generating; label
  **Generating...**).
- Client validation: if no category checked → `setError('Select at least one
  category')`, no request sent.
- Save call: `POST /api/attendance/staff/report { categories, fromDate,
  toDate }` (dates sent as `DD-MM-YYYY` via `toDisplayDate`) →
  `generateStaffAttendanceReport` → `buildStaffAttendanceReport`
  (`staffReport.js`). Server: `categories` required
  (`{ error: 'At least one category is required' }`, 400); if no staff match
  the selected job categories, `{ error: 'No staff found for selected
  categories' }` (400). Success returns `{ html, staffCount }` — one card per
  staff member with Working Days / Present / CL / EL / LOP /
  Unauthorized(F/A) / Personal / Official permission / Unauthorized
  permission / OD / Late.
- `<ReportPrintBar html={html} />` renders Print/Download actions once `html`
  is present.

### 3.3 Staff Live Punch — `/attendance/staff/punch`
File: `client/src/pages/attendance/StaffLivePunch.jsx`. Legacy:
`staff_live_attendance.php`.

- Breadcrumb: Home / Attendance / **Staff Live Punch**. Heading `Staff Live
  Attendance Punch` + **Back**.
- Helper text: *"Scan or type a staff ID and press Enter to record an in/out
  punch."*
- Field: label **Staff ID**, `form-control-lg` text input, auto-focused on
  mount and after every punch/clear (`inputRef`), `autoComplete="off"`.
- Buttons: **Punch** (submit, `btn btn-danger`, label **Recording...** while
  busy) and **Clear** (`btn btn-outline-secondary`, resets id/result/error).
- Client validation: empty id → `setError('Staff ID is required')`.
- `POST /api/attendance/staff/punch { staffId }` → `punchStaffLiveAttendance`
  (`staffLivePunch.js`):
  - Staff lookup: `del=1 AND staff_id=<id>` (case-normalized uppercase,
    trimmed) — no in-service date filter here (unlike calendar/report). Not
    found → `{ error: 'Invalid ID: <id>' }` (400).
  - Determines **In**/**Out** by checking the staff member's last punch row
    for today (`staff_image_att_tb`, `del=1`, `DATE(entry_date_time)=today`):
    if the last row's `entry_in_out` is anything but `'Out'`, the next punch
    is recorded as `Out`; otherwise `In`.
  - Inserts a new row into `staff_image_att_tb` (never updates — every punch
    is a new record) with the photo path resolved from
    `LEGACY_CIS_PATH/files/staff_idcard/<staff_id>.png`, falling back to
    `images/empty_image.jpg` if the file doesn't exist on disk.
  - Returns `{ success: true, name: "<name> (<id>)", designation, timestamp,
    inOut, photoUrl }`.
- Result card shows staff name, designation, `<In|Out> — <timestamp>` in
  bold, and the resolved photo (`resolvePhotoUrl` maps relative legacy paths
  to `/legacy/...`).

### 3.4 Staff Attendance Setup — Calendar Add — `/attendance/staff/setup/calendar-add`
File: `client/src/pages/attendance/staff/setup/CalendarAddSetup.jsx`.
Legacy: `staff_calendar_add.php`.

Fields (`row g-3`, all optional except by DB save semantics):
- **From Date** / **To Date** — `type="date"`.
- **Staff ID** — plain text input.
- **Event** — `<select>` populated from `data.events` (option value = `ev.id`,
  label = `ev.name`); placeholder `Select`.
- **Authority** — `<select>` from `data.authorities`; placeholder `Select`.
- **Comments** — text input.
- **Save** button (`btn btn-primary`). Submits
  `{ ...form, Submit: 'Update', fresult: 1 }` to
  `POST /api/attendance/staff/setup/calendar-add/save`.

### 3.5 Staff Attendance Setup — Calendar Edit — `/attendance/staff/setup/calendar-edit`
File: `client/src/pages/attendance/staff/setup/CalendarEditSetup.jsx`.
Legacy: `staff_calendar_edit.php`. Table: `staff_calendar_tb`.

- **Record ID** text input + **Load** button (loads via
  `{ eid }` → `POST /api/attendance/staff/setup/calendar-edit/load`, backed by
  `calendarMoreSetup`/`loadCalendarEditSetup` in `setup/calendarSetup.js`).
- Once a record loads, an edit form appears: **From**, **To** (dates),
  **Staff ID**, **Comments** — each pre-filled from the loaded record.
- Buttons: **Update** (submit, `{ ...form, eid: record.id, Submit: 'Update'
  }`) and **Delete** (`btn btn-outline-danger`, `{ eid: record.id, delete:
  true }`).
- Server (`saveCalendarEditSetup`): delete path does a soft-delete
  (`UPDATE staff_calendar_tb SET del=0 ... WHERE id=<eid>`) and returns
  `{ success: true, message: 'Record deleted.' }`. Update path requires
  `eid` (`{ success: false, message: 'Record id is required' }` if missing)
  and writes `from_academic_date`, `to_academic_date`, `authority`,
  `academic_events`, `comments`, `p_time`, `from_time`/`to_time` (suffixed
  `:00`), `staff_category` (joined list, `'All'` filtered out), `staff_id`;
  returns `{ success: true, message: 'Calendar event updated.' }`.
- Below the form: a table of the 50 most recent records (`id`, `staff_id`,
  `from_date`, `to_date`, `academic_events`) — clicking the ID re-loads that
  record inline.

### 3.6 Staff Attendance Setup — Working Day Setup — `/attendance/staff/setup/working-day`
File: `client/src/pages/attendance/staff/setup/WorkingDaySetup.jsx`. Legacy:
`staff_academic_calendar.php`. Table: `calendar_tb` (note: **not**
`academic_calender_tb` — that table drives the *student* academic calendar
used by `student_mattendance.php`/`intern_mattendance.php`/`pg_mattendance.php`
day checks).

- **Month** — `type="month"` picker; changing it triggers
  `onLoad({ calendar_month: value })`.
- A full table, one row per calendar day of the selected month
  (`loadWorkingDaySetup` builds all days 1..daysInMonth regardless of
  whether a DB row exists):
  - **Date** column — formatted `dd/mm/yyyy, Weekday`.
  - **Event** `<select>` — options come from `data.eventTypes`; defaults to
    `'Working'` when no row exists; a row whose current value doesn't match
    any known event type still renders (kept as an extra `<option>`).
  - **Category** column — `PopoverMultiSelect` of `data.categories`,
    placeholder **All categories**, empty-selection text **Applies to all
    categories**.
  - **Comment** — text input, `maxLength={155}`.
  - Rows whose event starts with `holiday` (case-insensitive) get
    `table-warning` row styling.
- **Save Month** button (`btn btn-danger`) submits **every row** (including
  untouched `Working` days) as `{ calendar_month, days: rows, Submit:
  'Update' }` — comment in the source: *"Saving writes every row — including
  untouched 'Working' days — same as legacy."*
- Server (`saveWorkingDaySetup`): for a day with an existing `id`, updates in
  place; for a day with no `id`, only inserts if the event isn't the default
  placeholder `'-'` (i.e. was actually set to something) or has a category/
  comment — otherwise a still-default "Working" day with no id and no
  content is simply skipped (no INSERT). Returns
  `{ success: true, message: 'Working day calendar saved.' }`.

### 3.7 Staff Attendance Setup — Att Time Setup — `/attendance/staff/setup/att-time`
File: `client/src/pages/attendance/staff/setup/AttTimeSetup.jsx`. Legacy:
`staff_att_time.php`. Tables: `staff_att_time`, `staff_att_auth`.

- **Staff ID** text input + **Load** button
  (`onLoad({ staff_id: staffId })`).
- Once loaded: staff name + attendance category line (`<staff_name> — att
  category: <att_category>`), then a schedule table (**Group / From / To /
  Days / Time**, time truncated to `HH:MM`).
- **Add Default Schedule** button (`btn btn-primary btn-sm`) posts a
  hard-coded schedule: `att_group: 'Default'`, `from_date` = today,
  `to_date: '2099-12-31'`, `days: 'Mon,Tue,Wed,Thu,Fri'`, `from_time: '09:00'`,
  `to_time: '17:00'`.
- Server (`saveAttTimeSetup`): requires `staff_row_id` →
  `{ success: false, message: 'Staff is required' }` if missing. Supports
  updating `att_category` on `staff_profile_tb`, upserting
  `defaulter_auth` on `staff_att_auth`, soft-deleting a schedule
  (`delete_schedule_id`), and insert/update of a `schedule` row on
  `staff_att_time`.

### 3.8 Staff dynamic screen router — shared shell
File: `client/src/pages/attendance/staff/StaffAttScreenPage.jsx`. Every
`/attendance/staff/:screen` route shares this shell:
- Breadcrumb: Home / Attendance / **Staff Att** (→ hub) / `<meta.title>`.
- Header: `<meta.title>` + **Print** button (only when `data.reportHtml` is
  present; calls `printReportHtml(data.reportHtml)`) + **Back** (→
  `/attendance/staff/hub`).
- `notice` (green `alert-success`), `data.infoMessage` (blue `alert-info`,
  shown only when there's no report/rows/dayRows), and `error` (red
  `alert-danger`) all render above the filter card.
- A `busy` banner (`alert-light border`) shows screen-specific copy while
  loading, e.g. for `daily-attendance`: *"Generating daily attendance — this
  can take 1–2 minutes for large staff lists. Please wait…"*; for
  `attendance-report`/`yearly-report`: *"…this can take a minute or more for
  a wide date range. Please wait…"*; for `att-chart*`: *"Generating
  attendance chart — select categories first; this may take a minute. Please
  wait…"*; default *"Loading…"*. These four heavy screens (`daily-attendance`,
  `attendance-report`, `yearly-report`, `att-chart*`) get a **180 s** Axios
  timeout on generate (`useStaffAttScreenApi`) instead of the default.

**Filter fields by screen** (`ReportFilters` component, all in one `<form>`,
submit button labeled **Go** for `clear-icache`, **Search** for
`smr-lpd-report`, else **Generate**):
- `daily-attendance`: **Date** (`type="date"`, default = server
  `current_date_iso`), **Type** `<select>` (`Teaching` / `Non Teaching` /
  `All`, default `Teaching`).
- `biometric-report`: **Staff ID** text, **From Date** / **To Date**.
- `yearly-report`: **Staff ID** text (`required`), **From Date** / **To
  Date**.
- `smr-lpd-report`: **Request** checkboxes (Leave/Permission/Defaulter, all
  checked by default), **From Date**/**To Date**, **Status** checkboxes
  (Pending/Approved/Rejected, all checked by default).
- `smr-acknowledge` and the three approval screens
  (`smr-leave-approve`/`smr-permission-approve`/`smr-defaulter-approve`):
  From Date/To Date; approval screens additionally show a **Status**
  `<select>` (Pending/Approved/Rejected, default Pending).
- `attendance-report` / `teaching-month-report` / `att-chart*`: **Category**
  `ChipMultiSelect` of staff categories; date row is From/To for
  `attendance-report`/`teaching-month-report`, or a single **Month**
  (`type="month"`) picker for `att-chart*`.
- `available-leave`: **As of Date**, **Department** `ChipMultiSelect`.
- `clear-icache`: **Staff ID** text (`required`).
- `compensation`: **Staff ID** text.
- `att-transport`: **Date**, **Transport** `<select>` from `data.transports`.

**Result renderers:**
- `daily-attendance` → `DailyAttendanceTable`: Staff ID / Name / Dept /
  FN-AN / In / Out.
- `att-chart*` → `AttChartTable`: four `AttendanceLineChart` SVG line
  graphs (Leave, Late, Permission, Present) split into "Week 1..5" bands with
  a smoothed moving-average trend line (`AttendanceLineChart.jsx`), plus a
  collapsible `<details>` day-by-day table underneath.
- `smr-lpd-report` → `LpdReportTable`: `# / R.ID / Staff / Date & Request /
  Status / Remarks`, or *"No requests match this filter."* when empty.
- `yearly-report` → `YearlyReportView`: header (name/id/designation/
  department, date range), 3 summary cards (Total Days / Working Days /
  Present), weekly breakdown table + SVG bar chart, consecutive-leave streak
  table (0.5/1/1.5/2/>2 days), approvals table (OD/Defaulter/Pre-approval
  L·Pe/Post-approval L·Pe), and a month-by-month day grid color-coded Present
  / Absent / Leave / Permission / Late / Holiday.
- `available-cl` → `ClElGrid`: editable Comp CL/EL/OD per staff row, **Update**
  button.
- `holiday-roster` → `HolidayRosterEditor` (see 3.9).
- All other screens with `data.reportHtml` → raw HTML dump.

**Approval screens** (`smr-leave-approve`, `smr-permission-approve`,
`smr-defaulter-approve`) render `ApprovalList`: a stats strip (Total /
Pending / Approved / Rejected / Cancelled), a left-hand scrollable list of
request cards (`#<id>`, status badge, `<staffId> · <staffName>`, date
range), and a right-hand detail panel. Selecting a card re-loads with
`{ ...lastFilters, rid }`; the **×** close button reloads with `rid:
undefined`. Detail panel: staff name/id, request id, date range, a
**Status** radio-pill group (Pending/Approved/Rejected), a **Comments**
`<textarea>`, and a **Confirm** button (`att-confirm-btn`, icon
`fa-check`). `smr-leave-approve` and `smr-defaulter-approve` additionally
render an editable per-day type picker:
- **Leave**: `LeaveDaysEditor` — one radio group per request day, options
  `LOP / CL / EL / OD / OFF`; a CL/EL/OD/OFF option disables once the
  running total for that type across the whole request would exceed the
  staff member's available balance (chips show `CL <n> / EL <n> / OD <n> /
  OFF <n>`); half-day (FN/AN) rows count 0.5, full-day rows count 1.
- **Defaulter**: `DefaulterDaysEditor` — one radio group per FN/AN session
  per day, options `P / La / Pe / LOP / HD / CL / EL / OD / OFF`; same
  balance-exceeded disabling logic, each session weighs 0.5.
- Save payload: `{ rid, att_status, l_comments, update: 'Confirm', more:
  [...] }` where `more` carries the per-day/per-session type selections (and
  for defaulter, pre-computed `cl_days`/`el_days`/`od_days`/`lop_days`/
  `off_days`/`h_days`).
- Server messages (`screens/approvalScreens.js`): missing request/status →
  `{ success: false, message: 'Request and status required' }`; success →
  `'Leave request updated.'` / `'Permission request updated.'` /
  `'Defaulter request updated.'` respectively.

### 3.9 Holiday Roster (staff) — `/attendance/staff/holiday-roster`
Component: `HolidayRosterEditor` inside `StaffAttScreenPage.jsx`. Legacy:
`staff_holiday_roster.php`.

- **Select Holiday** `<select>` (`required`) — options `--Select--`, `Add New
  Date`, then existing `data.configs`. Choosing one reloads with
  `{ academic_date: value }`.
- Once a holiday is selected: **From date**/**To date** (both `required`),
  then a repeatable "Group N" card per staff category assignment:
  **Category** `<select>`, **Staffs** `PopoverMultiSelect` (options loaded
  lazily per category via `POST /api/attendance/staff/holiday-roster/more`),
  **From**/**To** (per-row dates), **Working Days** multi-select (Sun–Sat),
  **IN**/**OUT** (`type="time"`), and an **OFF Cal.** switch.
- **+ Add Row** (`btn-outline-primary`) adds an empty group; a group's own
  trash-can button either removes an unsaved row locally or — if it has an
  `attGroup` id — opens a confirm modal (*"Are you sure to delete..."*, with
  **Close**/**Confirm** buttons) before calling
  `save({ ref_id, delete_group_id })`.
- **Save** button (`btn-danger`). Server (`screens/gridScreens.js`):
  missing From/To → `{ success: false, message: 'From date and To date are
  required.' }`; delete → `'Roster group deleted.'`; save →
  `'Holiday roster saved.'`.

### 3.10 Student Daily Attendance — `/attendance/students/daily`
File: `client/src/pages/attendance/StudentDailyAttendance.jsx`. Legacy:
`student_mattendance.php`.

- Filter card: **Date** (`type="date"`, `max` = today), **Course**
  `<select>` from `GET /api/attendance/students/filters` (default
  `'U.G___regular'`), **Go** button (label **Loading...** while generating).
- `POST /api/attendance/students/daily { attendanceDate, attCourse }` →
  `getStudentDailyAttendanceSheet` → `loadStudentDailyAttendance`
  (`studentDaily.js`). Validation, in order:
  1. `attendanceDate` required → `{ error: 'attendanceDate is required' }`.
  2. Date in the future → `{ error: 'Selected date is greater than current
     date', holidays: [...] }`.
  3. Course/academic-year combo not configured in `basic_setup_tb` →
     `{ error: 'Invalid course selection', holidays: [...] }`.
  4. **No row for that date in `academic_calender_tb`** →
     `{ error: 'Selected date is not added in academic calendar', holidays:
     [...] }`.
  5. **The calendar row for that date is a holiday** (`academic_events`
     matches one of `Holiday-Weekly / Holiday-Public / Holiday-Local /
     Holiday-Govt / Holiday-Mgmt / Holiday-Exam / Holiday-Study`) →
     `{ error: 'Selected date is <event>[ - <comments>]', holidays: [...] }`.
  Every error case still returns the last ~9 months of holiday dates
  (`holidays: [dd-mm-yyyy, ...]`) so the client can render *"message"* in a
  yellow `alert-warning` under the form and let the office worker see when
  the next valid date is.
- Success: one card per year/section
  (`<yearLabel> Year — <degreeName><departmentName>`), each with one
  `<textarea>` per teaching period, labeled `Period <n>` (or the merged
  label for combined periods) with `(saved)` appended if a record already
  exists for that period. Helper copy: *"Enter roll numbers separated by
  comma. Saved values are absentees for each period."*
- **Save Attendance** button (`btn-success btn-sm` in the card header):
  `PUT /api/attendance/students/daily { attendanceDate, entries }` →
  `saveStudentDailyAttendance`. Client guards against saving with no loaded
  sheet (`'Load the attendance sheet before saving'`). Success message shown
  in green `alert-success` (server-provided `message`, defaults to
  `'Attendance updated'`).

### 3.11 Student Attendance Report (standard + quarterly) — `/attendance/students/report[/quarterly]`
File: `client/src/pages/attendance/StudentAttendanceReport.jsx`, prop
`variant`. Legacy: `attendance_report.php` (standard) /
`attendance_report_quartely_v1.php` (quarterly).

- **Academic Year** `<select>` from `GET /api/attendance/students/report/years`
  (`{ academicYears, defaultAcademicYear }`).
- **Report Type** `<select>` (`Monthly` / `Consolidated`) — standard variant
  only.
- **From** / **To** dates — default From = 1 month back (quarterly: 2 months
  back) + 1 day, To = today.
- **Courses** — pill checkboxes grouped by `group.groupLabel`, sourced from
  `POST /api/attendance/students/report/filters { academicYear, courses }`
  (re-fetched on every course toggle and on academic-year change).
- **Subjects** — pill checkboxes appearing once ≥1 course is selected; if
  none returned: *"No subjects found for the selected course(s)."*
- **Generate Report** button (`btn-danger`, disabled while
  `generating || loadingFilters`). Client validation: no course or no
  subject selected → `'Select at least one course and one subject'`.
- Generation is a **2-phase, batched** flow to avoid one giant request:
  1. `POST /api/attendance/students/report/setup {...}` →
     `setupStudentAttendanceReport`, returns `{ jobs, headerHtml, printMeta,
     bannerUrl }`. No students match → `'No students found for the selected
     filters'`.
  2. Loop `POST /api/attendance/students/report/generate { setup, offset,
     limit: 10, clearCache: offset===0, variant }` →
     `generateStudentAttendanceReport`, merging `rowsByFlag` into the
     `headerHtml` table body by regex-matching
     `<table id="payroll_<flag>">`, until `truncated` is false.
  Progress banner (`alert-info`) shows *"Preparing report…"* then
  *"Generating report… `<processed>` / `<total>` students"*.
- `<ReportPrintBar html={buildPrintHtml()} printMode="student-attendance-report" />`
  wraps the merged HTML with `buildAttendanceReportPrintHtml` (title,
  subtitle, date range, banner, single/multi-course layout) before print.

### 3.12 Student dynamic screen router — representative field types
File: `client/src/pages/attendance/students/StudentAttScreenPage.jsx`
(2438 lines — the largest single client file in the module). Shared shell
mirrors the staff one: breadcrumb Home / Attendance / **Student Att** /
`<title>`, `notice`/`error` alerts, `Print`/`Back` header buttons.

Representative field sets per `meta.type` (`ScreenFilters` component):
- **`date-roll-report`** (`biometric-report`): From/To as
  `datetime-local` (biometric only), **Roll No** text (placeholder
  *"Comma-separated allowed"*), **Machine ID** text.
- **`roll-report`** (`ug-att-report` variant path): **Register No** text,
  From/To dates (optional — inputs carry `title="Optional — leave blank for
  all dates"`).
- **`date-category-report`** (`holiday-report`): **Category** `<select>`
  (`required`) from `data.categories`, **Letter Date** (`required`).
- **`lpd-report`** (`smr-lpd-report`): **Request** checkboxes (Leave/
  Permission/Defaulter), **Status** checkboxes (Pending/Approved/Rejected),
  From/To (both `required`).
- **`pg-att-report`**: **Academic Year** `<select>`, **Course**
  `RosterCoursePicker` (searchable chip picker grouped by course/year),
  **Show** radio (`Monthly` / `Over All`), **Clear Cache** and **Hide
  Attendance Info** checkboxes.
- **`student-id-report`** (`ug-att-report`): **Student ID** text
  (placeholder *"Register number"*).
- **`period-att`** (`pg-manual-att`, `intern-manual-att`) — see `PeriodAttForm`
  below.
- **`approval`** screens (`smr-leave-request`, `smr-dept-leave`,
  `smr-permission`, `smr-defaulter`): a filter field whose label/placeholder
  come from `meta.approvalFilter` (e.g. Staff/Student ID, Roll No), plus
  From/To.

**`PeriodAttForm`** (PG/Internship manual attendance): **Date**
(`type="date"`, `required`, `min` = 3 months back, `max` = today) + **Load**
button. Loading calls `loadPeriodAttendance('pg'|'intern', ...)`
(`studentPeriodAtt.js`) against `student_pgatt_tb` / `student_iatt_tb`:
  - No date → returns empty entries silently (view-logged).
  - Invalid date string → `message: 'Invalid date'`.
  - Future date → `message: 'Selected date is greater than current date'`.
  - `isWorkingDay()` check against `academic_calender_tb`: no calendar row →
    `'No calendar entry for this date'`; a holiday row →
    `'Selected date is <event>[ - <comments>]'`; any other non-working state
    → `'Selected date is not available (<event or "holiday">)'`.
  Once loaded, a 2-column **Present**/**Absent** `<textarea>` pair per period
  (label: *"Note: Enter present and absent register numbers separated by
  comma (,). E.g. 1516,1506,5189"*), rows tinted `period-att-row-saved` vs
  `period-att-row-new`. **Save** button posts
  `{ attendanceDate, attendance_date, entries }` to
  `savePeriodAttendance` — soft-deletes existing rows for that date
  (`del=0`) then re-inserts/updates per period, uppercasing the roll lists,
  returning `{ success: true, message: 'Attendance updated', ...reload }`.

**`InternAttStatementForm`** (`intern-att-statement`): **From**/**To**
(`max` = yesterday, one day exclusion built in via `internStatementMaxDate`),
**Category** `<select>` (`required`, grouped by `categoryGroups`), **Go**
button (resolves register numbers for the category into the **Roll No.**
`<textarea>`), a **Message** `<textarea>` (free text printed on the
statement), and a **Generate** button (`btn-danger btn-lg`) that calls
`onLoad({ generate_cards: true, roll_list, from_date, to_date, att_message,
search_category })` and shows a striped progress bar with label
*"Generating `<n>` attendance statement(s)…"*. Once generated, a **Print**
button calls `printReportHtml` with `printMode: 'intern-att-statement'`.

**`HolidayRosterForm`** (`pg-holiday-roster-add/edit`,
`intern-holiday-roster-add/edit`): step 1 "Select courses" —
`RosterCoursePicker` (searchable, grouped chip multi-select, "Select all" /
"Deselect all" per group) + **Load students** button; step 2 "Student list" —
editable comma-separated register-number `<textarea>` (`required`); a
per-group schedule table (Department select for Internship only, From/To
dates, IN/OUT times, Room No select grouped by block) with **+ Add row** and
per-row **Delete** (soft-confirm modal for saved rows); **Save**/**Update**
submit button. The non-`-add` edit variant additionally renders a **list**
view first (paginated table of existing rosters with **Edit**/**Delete**
buttons) before the form.

**`PgAttSetupForm`** (`pg-att-setup`): **Course & Academic year** `<select>`,
then a **Year** radio row (1..totalSemester), then a schedule table (From/To
dates, multi-select Working Days, IN/OUT times, Room No) with **+ Add row**
and per-row **Delete** (confirm modal for saved groups: *"Delete schedule
group "`<name>`"? This cannot be undone."*), **Update** submit button.

**`InternAttSetupForm`** (`intern-att-setup`): **Late Time**, **Permission
Time**, **Saturday End Time** (all `type="time"`, `required`), **OD Type
(comma-separated)** text, **Leave Apply Request (days)** number, **Defaulter
Request (previous working days)** number, **Save** button. If no setup row
exists yet: *"Internship attendance setup is not configured yet."*

**`YearInchargeForm`** (`year-incharge`): **Course & Academic year**
`<select>` (`required`, grouped); once selected, a Year/Staff Name table
(`<select>` per year row from `data.staffOptions`) and **Save**. Empty
states: *"No year rows found for the selected course."* /
*"Select a course and academic year to assign year incharge staff."*

**`PgPunchReportForm`** (`pg-punch`, `pg-punch-entry`): header title *"P.G
punch report"* / *"Punch entry report"*, From/To dates (`required`), Course
`RosterCoursePicker`, **Generate report** button; results render as a raw
`report-html` punch matrix (roll/name/day columns).

**`StudentApprovalList`** (student `approval` screens): left list of request
buttons (register no, student name, from–to dates, `pType`/`leaveType`,
status label) — *"No data found. Try clearing the From/To dates to search all
requests."* when `hasDateFilter` and empty. Detail panel: header info, a
Days table with LE/OD radios (single-session requests) or P/La/Pe/AB/OD
radios per FN/AN session (dual-session requests), **Status** `<select>`
(Pending/Approved/Rejected), **Comments** `<textarea>`, **Confirm** submit.
Right rail: `ApprovalReportSummary` (Total/Approve/Pending/Rejected).

---

## 4. Primary user stories

**US-1 — Load a staff member's monthly attendance calendar.**
As an attendance office staff member, I want to enter a Staff ID and press
**Go** on the Staff Attendance Calendar screen, so that I can see that
staff member's full month grid (present/absent/leave/holiday per day) with
working-day totals.
*Acceptance:* Given a valid, currently-in-service staff id, when I submit
the form, then a month calendar renders with a totals row (Working Days /
Present / Leave / Absent / Late / Permission) and prev/next-month links that
reload in place without navigating away.

**US-2 — Generate a category-wise staff attendance summary report.**
As an HR/attendance admin, I want to pick one or more staff categories and a
date range and click **Generate**, so that I get one printable summary card
per staff member showing CL/EL/LOP/unauthorized/permission/OD/late counts.
*Acceptance:* Selecting zero categories blocks submission with *"Select at
least one category"*; a valid selection returns cards for every matching
staff member and enables the print bar.

**US-3 — Record a live biometric-style punch.**
As a front-desk/security staff, I want to type or scan a Staff ID into Live
Punch and hit **Punch**, so that an In/Out record is written immediately and
I see the staff photo and name to confirm identity.
*Acceptance:* First punch of the day for a staff id records `In`; the next
one records `Out`; an unknown id shows *"Invalid ID: `<id>`"* and the input
stays focused for the next scan.

**US-4 — Mark daily UG attendance by period.**
As a class in-charge, I want to select a date and course on Student Daily
Attendance and enter absent roll numbers per period, so that period-wise
attendance is recorded for every active section under that course.
*Acceptance:* Selecting a date not yet configured in the academic calendar,
a future date, or a holiday date blocks the sheet from loading and shows the
specific reason; a valid date renders one textarea per period per
year/section, and **Save Attendance** persists all entries at once.

**US-5 — Generate a subject-wise UG attendance report.**
As an academic office user, I want to pick academic year, courses, subjects,
and a date range on the Student Attendance Report screen, so that I get a
printable monthly or consolidated attendance table.
*Acceptance:* The Generate button is disabled until at least one course and
one subject are selected; generation shows batch progress
(`processed/total students`) and the finished report supports Print/Download
via `ReportPrintBar`.

**US-6 — Approve or reject a staff leave request with per-day leave type.**
As a reporting authority, I want to open Leave Approve, click a pending
request, choose LOP/CL/EL/OD/OFF for each requested day (constrained by the
staff member's available balance), set a status, add comments, and click
**Confirm**, so that the leave is finalized and the staff member's leave
ledger is updated accordingly.
*Acceptance:* Choosing a day-type that would exceed the available CL/EL/OD/
OFF balance is disabled in the UI; submitting without picking a request or
status is rejected server-side with *"Request and status required"*.

**US-7 — Configure the institution's monthly working-day calendar.**
As an attendance admin, I want to pick a month on Working Day Setup and mark
specific dates as holidays (with category scope and comments), so that all
downstream daily-attendance screens correctly block or allow entry for those
dates.
*Acceptance:* Every day of the selected month is shown by default as
"Working"; changing a day's Event to a holiday type highlights the row; Save
Month persists the whole month, including untouched Working days that
previously had a saved override.

**US-8 — Configure a staff member's attendance time schedule.**
As HR admin, I want to load a staff id on Att Time Setup and add a default
09:00–17:00 Mon–Fri schedule, so that the biometric/late-permission logic
has a schedule to compare punches against.
*Acceptance:* **Add Default Schedule** is only visible once a staff record
is loaded; the new schedule appears in the schedule table immediately after
save.

**US-9 — Build and save a staff or student holiday roster group.**
As an attendance admin, I want to select (or create) a holiday date range,
then add one or more category/staff-id groups each with their own working
days, IN/OUT time, and OFF-calendar flag, so that the holiday period's
attendance expectations are correctly scoped per group.
*Acceptance:* From date/To date are required before the row table appears;
removing a saved group prompts a confirm dialog before the delete call is
sent; Save persists every group in one call.

**US-10 — Run a PG/Internship manual attendance entry for a specific date.**
As a PG/Internship coordinator, I want to pick a date, click **Load**, and
enter comma-separated present/absent register numbers per period (In/Out),
so that PG or internship attendance for that day is recorded.
*Acceptance:* Changing the date after loading clears the entries and shows
*"Date changed — click Load to fetch attendance."* until Load is clicked
again; a non-working date shows the specific reason instead of the entry
grid.

---

## 5. Rare / edge-case user stories

**US-11 — Marking attendance for a holiday is blocked with the specific reason.**
As a class in-charge, when I pick a date on Student Daily Attendance (or PG/
Internship Manual Attendance) that `academic_calender_tb` marks as one of
the `Holiday-*` event types, I want the system to refuse to load the
attendance sheet and tell me exactly which holiday it is (and any comments
attached), so that I don't accidentally try to mark attendance on a
non-teaching day.
*Grounded in:* `studentDaily.js` lines 120–131
(`'Selected date is <academicEvent>[ - <comments>]'`) and
`studentAttendanceShared.js` `isWorkingDay()` (used by
`studentPeriodAtt.js` for PG/Internship, message
`'Selected date is not available (<event>)'` for any other non-working
event). Both paths also return the last several months of holiday dates
(`holidays: [...]`) so the UI can suggest valid dates.

**US-12 — A date with no calendar entry at all is treated as unconfigured, not "open."**
As a class in-charge, if I pick a date that has never been added to the
academic calendar (no row in `academic_calender_tb`), the daily attendance
sheet must refuse to load with *"Selected date is not added in academic
calendar"* rather than silently treating it as a normal working day —
because with no calendar row, there's no way to know if it's a holiday,
exam day, or working day.
*Grounded in:* `studentDaily.js:120-122`.

**US-13 — Editing a locked/past attendance date still works, but only through Load-first flows.**
As a PG/Internship coordinator correcting an old date's attendance, the
system does not hard-lock past dates for editing — `PeriodAttForm`'s
`min` date is only 3 months back (a soft UI guard, not a server-enforced
lock) — but every save is a full soft-delete-then-reinsert for that date
(`UPDATE ... SET del=0 WHERE del=1 AND academic_date=<d>` then re-insert),
so re-saving an old date fully replaces its prior record rather than
merging. Coordinators should confirm the entered present/absent lists are
complete before saving an old date, since there is no partial-update path.
*Grounded in:* `studentPeriodAtt.js:71-99`; `PeriodAttForm`'s `pickerMin`
derivation in `StudentAttScreenPage.jsx`.

**US-14 — Biometric punch for an unrecognized or since-relieved staff ID fails clearly.**
As front-desk staff running Live Punch, if I scan/type an ID that doesn't
match any `del=1` row in `staff_profile_tb`, I see *"Invalid ID: `<id>`"*
and no attendance row is written. Unlike the Calendar and Report screens,
Live Punch does **not** filter by `releaving_date` — so a staff member whose
service has ended is still identifiable and can still be "punched" if their
`del=1` record exists, which is a legacy-parity quirk worth knowing rather
than an oversight to "fix."
*Grounded in:* `staffLivePunch.js:8-17` (no `releaving_date` clause) vs.
`staffCalendar.js:87-93` and `staffReport.js:34-38` (both filter
`releaving_date='0000-00-00' OR releaving_date > CURDATE()`).

**US-15 — Duplicate punches within the same day toggle In/Out rather than erroring.**
As front-desk staff, if the same staff ID is punched twice in a row on the
same day, the system does not reject the second punch as a duplicate — it
inspects the most recent `staff_image_att_tb` row for that staff+day and
flips to `Out` (or back to `In` if the last was already `Out`), always
inserting a brand-new row rather than updating. This means a staff member
punching 3+ times in one day (forgotten badge, security recheck, etc.)
produces a full alternating In/Out/In/Out history, all of which is visible
on the Staff Attendance Calendar's per-day In/Out line.
*Grounded in:* `staffLivePunch.js:33-47`.

**US-16 — Half-day (FN/AN) leave/permission counts as 0.5 against balances, full-day counts as 1.**
As a reporting authority approving a leave or defaulter request, when I
choose a leave type for a half-day (forenoon-only or afternoon-only)
request row, the balance-consumption math treats it as 0.5 days, not a full
day — this affects whether CL/EL/OD/OFF options are disabled for remaining
rows in the same request once the running total would exceed the staff
member's available balance.
*Grounded in:* `dayRowWeight()` in `StaffAttScreenPage.jsx`
(`row.r_session !== 'fullday' ? 0.5 : 1`); `computeDefaulterDayTotals()`
sums each FN/AN session at 0.5.

**US-17 — Staff calendar events with zero/empty dates render as blank, not `0000-00-00`.**
As an attendance admin viewing Calendar Edit or Working Day Setup, any
`from_academic_date`/`to_academic_date`/`academic_date` column that is
`'0000-00-00'` or `NULL` is rendered by the server as an empty string
(`IF(col='0000-00-00' OR col IS NULL, '', CAST(col AS CHAR))`), never as the
literal zero-date, matching the repo-wide zero-date display rule.
*Grounded in:* `screens`/`setup/calendarSetup.js` lines 100-101, 188, 256-257;
`setupAudit.js`'s `zeroDateSql()` helper.

**US-18 — Permission denial via menu access.**
As a staff member without `attendance` module menu access (and not
`accessType === 'Global'`), every `/api/attendance/*` call is rejected by
`menuAuthForModule('attendance')` before it reaches any service logic —
none of the screens above are reachable even by direct URL.
*Grounded in:* `server/src/routes/attendance.js:40`; `docs/auth-flow.md`.

**US-19 — Empty result sets show explicit "no data" messaging, not a blank screen.**
As any user running a report/approval screen with filters that match
nothing, the UI shows explicit copy rather than an empty table: *"No
requests match this filter."* (staff L/P/D report and approval lists),
*"No data found. Try clearing the From/To dates to search all requests."*
(student approval list, only shown when a date filter is active),
*"No subjects found for the selected course(s)."* (attendance report),
*"No year rows found for the selected course."* (year incharge).
*Grounded in:* `LpdReportTable`, `ApprovalList`, `StudentApprovalList`,
`StudentAttendanceReport.jsx`, `YearInchargeForm` in the files read above.

**US-20 — Network/API failure surfaces the server message, or a generic fallback.**
As any user, if a save/load call throws (network error, 500, or a service
returning `{ error }`), the UI shows
`err.response?.data?.message || '<screen-specific fallback>'` in a red
`alert-danger` — e.g. *"Unable to load calendar"*, *"Report failed"*,
*"Unable to save attendance"*, *"Unable to load screen"*, *"Save failed"* —
and never silently swallows the failure.
*Grounded in:* every screen's `catch` block (`StaffAttendanceCalendar.jsx`,
`StudentDailyAttendance.jsx`, `useStaffAttSetupApi.js`,
`useStudentAttScreenApi.js`, etc.).

**US-21 — Heavy report generation gets a longer timeout and an explicit "this can take a while" notice.**
As a user generating a wide-date-range Attendance Report, Yearly Report,
Daily Attendance grid, or Att Chart, the client raises the Axios timeout to
180 seconds (instead of the default) and shows a specific "this can take
1–2 minutes / a minute or more" banner, because these screens iterate
day-by-day server-side across potentially hundreds of staff/students.
*Grounded in:* `useStaffAttScreenApi.js` `isHeavy` check; busy-banner copy
in `StaffAttScreenPage.jsx`.

**US-22 — Deleting a saved holiday-roster group or roster row requires confirmation, unsaved rows don't.**
As an attendance admin editing a Holiday Roster (staff, PG, or Internship),
removing a row that has never been saved (`no attGroup`/`no id`) is
immediate and local; removing a row that already exists in the DB always
opens a confirm modal first (staff: *"Are you sure to delete..."*; PG/
Internship: `ConfirmModal` with an explicit *"This cannot be undone."*),
preventing accidental destructive soft-deletes of live schedule groups.
*Grounded in:* `HolidayRosterEditor.removeRow/confirmDelete` in
`StaffAttScreenPage.jsx`; `HolidayRosterForm`'s `pendingDelete` state in
`StudentAttScreenPage.jsx`.

**US-23 — Large batched student reports process incrementally, not in one request.**
As an academic office user generating a UG subject-wise attendance report
for a large cohort, the report is generated in batches of 10 students per
request (`generate`, looped with `offset`/`limit: 10`) rather than one
massive query, with a visible processed/total counter, so the browser tab
doesn't hang or time out on large courses.
*Grounded in:* `StudentAttendanceReport.jsx` `generate()` batching loop.

---

### Future (not implemented)

*The stories below are speculative extrapolations grounded in
[../mobile.md](../mobile.md). No mobile app exists yet — `mobile.md` states
explicitly "This doc is the plan; nothing is implemented yet." None of the
following exists in the codebase today; they describe a possible v1/v2
mobile client per `mobile.md` §6 and §9.*

- **(Future — not implemented)** As a staff member, I want to view my own
  attendance calendar and yearly report on a native mobile app (read-only),
  reusing the same `/api/attendance` endpoints the web client calls today,
  so that I can check my present/absent/leave record without opening a
  browser. Per `mobile.md` §6: *"Attendance (student/staff) | `/api/attendance`
  | Calendar/list view instead of the web's grid; same data shape."* This is
  listed under Phase 1 ("Read-only core").
- **(Future — not implemented)** As a student, I want a read-only mobile view
  of my subject-wise attendance percentage and daily present/absent history,
  mirroring the web's Student Attendance Report but rendered as a native list
  instead of an HTML table. `mobile.md` explicitly scopes mobile Fees/Exam/
  Attendance to "view" first and defers write flows to Phase 3.
  §6 v1 principle: *"ship read + light-write... before any heavy setup/admin
  screens."*
- **(Future — not implemented)** As a reporting authority, I want a mobile
  push notification when a new staff leave/permission/defaulter request is
  submitted for my approval, so that I don't have to poll the Leave Approve
  screen. `mobile.md` §8 flags this explicitly as *not yet built*: "Push
  notifications (circulars, fee due, attendance alerts) — there is no push
  infrastructure today," requiring new backend work
  (`server/src/services/push/`) that is "new backend surface — flag and
  scope separately, get sign-off before building." This is not scheduled
  before Phase 4 in `mobile.md` §9.
  **Explicitly not implemented today: no push infrastructure of any kind
  exists in this codebase for attendance or any other module.**
- **(Future — not implemented)** As a class in-charge, I want to mark
  self/daily attendance from a mobile device while physically walking the
  classroom, described in `mobile.md` §9 Phase 3 ("Light write: Self-
  attendance mark (if legacy supports it)") — explicitly gated ("if legacy
  supports it") and not committed to v1 scope.
- **(Future — not implemented)** As any attendance-report user on mobile, I
  want to Share or Save-as-PDF a generated attendance report instead of
  opening a new browser print window, per `mobile.md` §7.1: reusing the
  existing `printHtml`/`reportHtml` server payloads, rendered via
  `react-native-webview` and exported with `expo-print`
  (`Print.printToFileAsync`) + `expo-sharing`. No such renderer exists yet;
  today's only print/export mechanism is `client/src/utils/printReport.js`
  opening a new desktop browser window.

---

## 6. Traceability

| Story | Client file(s) | Server endpoint(s) | Service file(s) | Table(s) |
|---|---|---|---|---|
| US-1 (calendar) | `StaffAttendanceCalendar.jsx` | `POST /api/attendance/staff/calendar` | `attendanceStaff.js`, `staffCalendar.js` | `staff_profile_tb`, `staff_designation_tb`, `staff_dept_master`, `staff_desg_master` |
| US-2 (staff report) | `StaffAttendanceReport.jsx` | `GET /api/attendance/staff/categories`, `POST /api/attendance/staff/report` | `staff/staffCategories.js`, `attendanceStaff.js`, `staffReport.js` | `staff_profile_tb`, `staff_dept_master`, `staff_desg_master`, `att_leave_request_more`, `att_defaulter`, `att_defaulter_more`, `att_permission_request` |
| US-3 (live punch) | `StaffLivePunch.jsx` | `POST /api/attendance/staff/punch` | `staffLivePunch.js` | `staff_profile_tb`, `staff_image_att_tb` |
| US-4 (daily UG att) | `StudentDailyAttendance.jsx` | `GET /api/attendance/students/filters`, `POST`/`PUT /api/attendance/students/daily` | `attendanceStudent.js`, `studentDaily.js`, `studentDailyParse.js` | `academic_calender_tb`, `basic_setup_tb`, `basic_setup_course_tb`, `student_profile_tb`, `student_academic_tb`, `period_set_up` |
| US-5 (student subject report) | `StudentAttendanceReport.jsx` | `GET /api/attendance/students/report/years`, `POST .../report/filters\|setup\|generate` | `attendanceStudent.js`, `studentReportFilters.js`, `studentAttendanceReportCore.js` | student attendance + subject/period tables |
| US-6 (leave approve) | `StaffAttScreenPage.jsx` (`ApprovalList`) | `POST /api/attendance/staff/smr-leave-approve[/save]` | `staffAttendanceScreens.js`, `screens/approvalScreens.js` | `att_leave_request`, `att_leave_request_more` |
| US-7 (working day setup) | `staff/setup/WorkingDaySetup.jsx` | `POST /api/attendance/staff/setup/working-day/load\|save` | `staffAttendanceSetup.js`, `setup/calendarSetup.js` | `calendar_tb` |
| US-8 (att time setup) | `staff/setup/AttTimeSetup.jsx` | `POST /api/attendance/staff/setup/att-time/load\|save` | `staffAttendanceSetup.js`, `setup/calendarSetup.js` | `staff_profile_tb`, `staff_att_time`, `staff_att_auth` |
| US-9 (holiday roster) | `StaffAttScreenPage.jsx` (`HolidayRosterEditor`), `StudentAttScreenPage.jsx` (`HolidayRosterForm`) | `POST /api/attendance/staff/holiday-roster[/save/more]`, `POST /api/attendance/students/pg-holiday-roster-*[/save]`, `POST /api/attendance/students/intern-holiday-roster-*[/save]` | `screens/gridScreens.js`, `screens/studentGridScreens.js` | staff/PG/Internship holiday roster + schedule tables |
| US-10 (PG/Intern manual att) | `StudentAttScreenPage.jsx` (`PeriodAttForm`) | `POST /api/attendance/students/pg-manual-att\|intern-manual-att[/save]` | `studentPeriodAtt.js`, `studentAttendanceShared.js` | `student_pgatt_tb`, `student_iatt_tb`, `academic_calender_tb` |
| US-11/US-12 (holiday/unconfigured date block) | `StudentDailyAttendance.jsx`, `StudentAttScreenPage.jsx` (`PeriodAttForm`) | `POST /api/attendance/students/daily`, `POST /api/attendance/students/pg-manual-att\|intern-manual-att` | `studentDaily.js`, `studentPeriodAtt.js`, `studentAttendanceShared.js` (`isWorkingDay`) | `academic_calender_tb` |
| US-13 (edit past date) | `StudentAttScreenPage.jsx` (`PeriodAttForm`) | `POST /api/attendance/students/pg-manual-att\|intern-manual-att/save` | `studentPeriodAtt.js` | `student_pgatt_tb`, `student_iatt_tb` |
| US-14/US-15 (punch edge cases) | `StaffLivePunch.jsx` | `POST /api/attendance/staff/punch` | `staffLivePunch.js` | `staff_profile_tb`, `staff_image_att_tb` |
| US-16 (half-day balance math) | `StaffAttScreenPage.jsx` (`LeaveDaysEditor`, `DefaulterDaysEditor`) | `POST /api/attendance/staff/smr-leave-approve\|smr-defaulter-approve/save` | `screens/approvalScreens.js` | `att_leave_request_more`, `att_defaulter_more` |
| US-17 (zero-date display) | `staff/setup/CalendarEditSetup.jsx`, `staff/setup/WorkingDaySetup.jsx` | `POST /api/attendance/staff/setup/calendar-edit\|working-day/load` | `setup/calendarSetup.js`, `setupAudit.js` (`zeroDateSql`) | `staff_calendar_tb`, `calendar_tb` |
| US-18 (menu auth) | (all attendance routes) | all `/api/attendance/*` | `middleware/menuAuth.js` | `authentication_tb`, `basic_admin_menu_tb` |
| US-19 (empty states) | `StaffAttScreenPage.jsx`, `StudentAttScreenPage.jsx`, `StudentAttendanceReport.jsx` | various `/load` endpoints | `screens/*.js` | n/a |
| US-20 (error fallback) | all attendance client files | all `/api/attendance/*` | `routes/attendance.js` `handleError` | n/a |
| US-21 (heavy report timeout) | `useStaffAttSetupApi.js` (`useStaffAttScreenApi`) | `POST /api/attendance/staff/daily-attendance\|attendance-report\|yearly-report\|att-chart*` | `screens/reportScreens.js` | staff attendance tables |
| US-22 (delete confirm) | `StaffAttScreenPage.jsx`, `StudentAttScreenPage.jsx` | `POST /api/attendance/staff/holiday-roster/save`, `POST /api/attendance/students/pg-holiday-roster-*\|intern-holiday-roster-*/save` | `screens/gridScreens.js`, `screens/studentGridScreens.js` | roster/schedule tables |
| US-23 (batched report generation) | `StudentAttendanceReport.jsx` | `POST /api/attendance/students/report/setup\|generate` | `studentAttendanceReportCore.js` | student attendance/subject tables |

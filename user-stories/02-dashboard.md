# 02 — Dashboard

> Deep-dive companion to [../userstory.md](../userstory.md). Pixel-level detail sourced from
> the actual client/server code (paths cited throughout), not paraphrased.

## 1. Module overview

**Purpose.** The Dashboard module is the landing surface after login (`/dashboard` is the
root redirect target — `client/src/routes/AppRoutes.jsx` line `<Route path="/" element={<Navigate to="/dashboard" replace />} />`).
It shows the signed-in user's "attendance register" for a chosen date as a grid of
per-role/per-permission **widgets** (staff attendance, student attendance, hostel,
scholarship, feedback, faculty structure/DCI norms, etc.), plus a handful of standalone
report screens (strength matrices, login audit, staff pattern) reachable from the
**All dashboards** hub.

**Primary actors.**
- Any authenticated `web_account_setup` user (admin, staff, student login) — sees whatever
  widgets are assigned to their `user_id` in `dashboard_access`.
- `Global` access-type accounts (`isGlobalAccessType`, `server/src/utils/accessType.js`) get a
  fallback: if they have no personal widget rows, they inherit user `1`'s rows, and if even
  that is empty, they get *every* widget in `DASHBOARD_WIDGET_LABELS` (superadmin catch-all).
- Dept-scoped staff/admin accounts are further filtered by `dept_authentication` rows
  (`server/src/services/dashboard/deptAuth.js`, `widgetAuth.js`) so e.g. a HOD only sees staff/
  student rows for their department.

**Legacy PHP files replaced** (per code comments and `legacy:` fields returned by services):
- `dashboard_more.php` — the widget-by-widget attendance dashboard (staff_details,
  staff_permission, staff_current, staff attendance/leave/permission tables, student
  attendance/hostel/scholarship, feedback analysis) and its auth helpers
  (`staffAuthentication`, `internAuthentication`, `pgAuthentication`, `studAuthentication`).
- `dashboard_unit_more.php` — `staff_unit` (Faculty - DCI Norms) widget.
- `dashboard_student.php` — Student Dashboard shell (`loadStudentDashboardShell`).
- `dashboard_v5.php` — Staff Pattern shell (`loadStaffPatternShell`).
- `student_strength_overall.php` — Overall Strength report.
- `student_community_strength.php` — Community Strength report.
- Login/audit dashboard (admin module's `log-dashboard`, reachable at `/dashboard/log`).

**No PHP bridge is used for this module today.** Every widget in
`server/src/services/dashboard/widgets/` is a native Prisma/`$queryRawUnsafe` implementation
(`widgetDispatcher.js` → `NATIVE_HANDLERS`); the only "bridge"-flavored artifact is the
`renderPlaceholder(widgetName)` fallback (`widgets/placeholder.js`) shown for any widget id
that has no native handler yet ("Widget `<name>` — native migration in progress").

## 2. Screen inventory

| Route | Component file | Legacy `.php` counterpart |
|---|---|---|
| `/dashboard` | `client/src/pages/Dashboard.jsx` | `dashboard_more.php` (widget-by-widget home board) |
| `/dashboard/hub` | `client/src/pages/dashboard/DashboardHub.jsx` | (new — modern index of dashboard screens, no direct legacy page) |
| `/dashboard/student` | `client/src/pages/dashboard/StudentDashboardPage.jsx` (→ `DashboardWidgetShell`) | `dashboard_student.php` |
| `/dashboard/staff-pattern` | `client/src/pages/dashboard/StaffPatternPage.jsx` (→ `DashboardWidgetShell`) | `dashboard_v5.php` |
| `/dashboard/overall-strength` | `client/src/pages/dashboard/StrengthReportPages.jsx` (`OverallStrengthPage`) | `student_strength_overall.php` |
| `/dashboard/community-strength` | `client/src/pages/dashboard/StrengthReportPages.jsx` (`CommunityStrengthPage`) | `student_community_strength.php` |
| `/dashboard/log` (and `/admin/log-dashboard`) | `client/src/pages/admin/AdminLogDashboard.jsx` | admin login-dashboard PHP (see `10-admin`/`11-admin.md`; documented fully there — noted here only because the Dashboard hub links to it) |

Shared building blocks used by the screens above:
- `client/src/pages/dashboard/DashboardWidgetShell.jsx` — generic shell reused by Student
  Dashboard and Staff Pattern (parameterized by `shellPath`, `title`, `breadcrumbLabel`,
  `showYearPickers`).
- `client/src/components/DashboardWidgetCard.jsx` — the modern card chrome wrapped around
  each widget's raw legacy HTML.
- `client/src/components/DeptStaffingChart.jsx` — HTML/CSS bar chart rendered above the
  `staff_unit` widget's table.
- `client/src/layouts/DashboardLayout.jsx` — outer app chrome (TopNav/Header/CommandPalette).
- `client/src/utils/idbCache.js` — stale-while-revalidate cache (sessionStorage for "today",
  IndexedDB for past dates) used only by `/dashboard` (the plain `DashboardWidgetShell`-based
  screens do not use this cache).
- `client/src/utils/dashboardWidgetLayout.js` — `getWidgetSlotClassName(widgetId)` grid-span
  rules (wide/KPI/DCI/roster widget ids).

## 3. Pixel-level flow per screen

### 3.1 `/dashboard` — Home attendance board (`client/src/pages/Dashboard.jsx`)

**DOM order / fields as rendered:**

1. **Identity strip** (`<header className="cis-dash-identity">`)
   - `<p className="cis-dash-identity-college">{institutionLabel}</p>` — `settings.adminLargeTitle || settings.institutionShortName || 'Campus'`.
   - `<h1>{greeting}, <span>{memberName}</span></h1>` — greeting from `greetingForHour(new Date().getHours())`: `'Good morning'` (< 12), `'Good afternoon'` (< 17), else `'Good evening'`. `memberName` = `user.memberName || dashboard.memberName || 'there'`.
   - `<dl className="cis-dash-identity-meta">` three `<dt>/<dd>` pairs: **ID** → `user.memberId || dashboard.username || '—'`; **Role** → `user.accessType || dashboard.accessType || '—'`; **Panels** → `{loadedWidgetCount}/{widgetCount || 0}`.
2. **Attendance register hero** (`<section className="cis-dash-register">`)
   - Date stamp block (`cis-dash-stamp`, `aria-hidden`): weekday, day, "MONTH YEAR" from `formatStampParts(attendanceDate)`.
   - Kicker text: "Attendance register".
   - Title `<h2>`: `isToday ? 'Today's campus panels' : 'Panels for {formatDisplayDate(attendanceDate)}'`.
   - Hint: "Change the date to reload your assigned widgets. No extra click needed."
   - Controls (`cis-dash-register-controls`):
     - Label "Show panels for" + `<input type="date">` (`value=attendanceDate`, `max=todayIso()`).
     - Button **"Today"** — `onClick={handleUseToday}`; disabled when `widgetLoading && isToday`.
     - Button **"Refresh panels"** / **"Updating…"** while `widgetLoading` — `onClick={handleManualRefresh}`; disabled while `widgetLoading`.
     - Link **"All dashboards"** → `/dashboard/hub`.
   - Live status line (`role="status" aria-live="polite"`): `widgetLoading ? 'Loading panels for {date}…' : statusNotice || 'Showing {loadedWidgetCount} of {widgetCount} assigned panels'`.
3. **Module hubs nav** (`<nav className="cis-dash-jumps">`) — heading "Go to a module", subtitle
   "Open a hub to browse setup and report screens". Grid of 8 links from `MODULE_JUMPS`:
   Students (`/students`), Staff (`/staff/hub`), Attendance (`/attendance`), Fees (`/fees`),
   Academic (`/academic`), Exam (`/exam`), Payroll (`/payroll`), Reports (`/reports`).
4. **Widget deck** (`<section className="cis-dash-section">`)
   - Heading "Your panels", subtitle "Modern live cards for the selected attendance day."
   - Toolbar (only if `widgetCount > 0`): buttons **"Expand all"** (`setExpandAllTick`) and
     **"Collapse all"** (`setCollapseAllTick`).
   - Error banner (`widgetError`) with inline **"Try again"** button → `handleManualRefresh`.
   - Loading strip while `widgetLoading && widgetCount > 0`: pulsing dot + "Updating panels for {date}…".
   - Grid `.cis-widget-grid` of `<DashboardWidgetCard>` per `dashboard.widgets[]`.
   - Empty state (`widgetCount === 0`): inbox icon, "No panels assigned", "Ask an
     administrator to assign widgets in Dashboard widget access.", button **"Open dashboard
     access"** → `/admin/setup/dashboard-access`.

**Load sequence (network + cache):**
- On mount: `GET /api/dashboard` (no params) → `{ title, username, memberName, accessType,
  attendanceDate, academicYears, lastLoginAt, widgets, widgetGroups }`.
- Shell for a given date is fetched/cached via `cachedByDate('dashboard-shell:v1:<date>', date,
  fetcher, { ttlMs, onCache, onFresh })`: today → sessionStorage, TTL 90s
  (`DASHBOARD_TODAY_TTL_MS`); any other date → IndexedDB, long TTL. `peekSessionCache` lets
  today's cached shell paint synchronously before the first effect even runs.
- Widget content is fetched separately per **group** via `GET /api/dashboard/widgets` with
  query params: `w` (comma-joined widget ids in the group), `d` (unix seconds, or the raw
  date string when the group contains `staff_current`), `ugr`/`uga`/`pgr` (academic years);
  when the group has `staff_current`, also `c=1` and `t=<HH:MM current time>`; a forced
  refresh adds `cRefresh=1`. Request timeout is 90000ms. Response:
  `{ count, widgets: [{ id, html, chart? }] }`.
- Widget groups come from `groupWidgets()` (`server/src/services/dashboard/dashboardMeta.js`):
  `student_details/student_scholarship/student_firstgraduate/student_add_details` → group
  `student`; attendance-ish ids → `student_att`; `staff_attendance*`/`staff_leave_absent` →
  `staff_att`; hostel ids → `student_hostel`; everything else is its own singleton group.
  Groups fetch with `Promise.allSettled` — one slow/failed group never blocks the others.
- On widget-group failure: pushed into `failedGroups`; final `widgetError` message =
  `"${n} panel${n>1?'s':''} took too long to load and were skipped — try refreshing."`
- Widget payloads are cached the same stale-while-revalidate way under key
  `dashboard-widgets:v2:<date>` (bumped from v1 because payloads can now carry a `chart` field).
- Changing the date input debounces 400ms (`DATE_DEBOUNCE_MS`) then calls `loadForDate(date, { announce: true })`, which shows a transient `statusNotice` ("Updated panels for …") for ~3.2s.
- **`handleManualRefresh`** → `loadForDate(attendanceDate, { force: true, announce: true })` — `force` sets `ttlMs: 0` (skip cache) and passes `cRefresh=1` to the widgets endpoint (bypasses the 90s server-side widget cache too, see §3.5).
- **`handleUseToday`** — if already on today, force-refreshes; otherwise just flips `attendanceDate` to today (triggers the debounce effect).

**Loading / empty / error states:**
- First paint with no cache: `<PageLoading message="Opening your register…" />`.
- Hard load failure with nothing cached: full-page `alert-danger` with the server message (or
  "Could not load dashboard") plus a **"Retry"** button that does `window.location.reload()`.
- Per-widget: `DashboardWidgetCard` shows a 3-bar skeleton stack while `loading`, or "Nothing
  to show for the selected date." (inbox icon) once loaded with empty HTML.

### 3.2 `DashboardWidgetCard` (`client/src/components/DashboardWidgetCard.jsx`)

- Card header: icon (from `WIDGET_META[widget.id]`, fallback `{icon:'fa fa-th-large', tone:'crimson', kind:'Panel'}`), kicker = `meta.kind`, title = `widget.label` (server-supplied `DASHBOARD_WIDGET_LABELS` text, e.g. "Staff Details", "Faculty - DCI Norms"), status line = `loading ? 'Updating…' : safeHtml ? (rows>0 ? '${rows} rows' : 'Ready') : 'No data'`.
- Optional headline badge extracted from the raw legacy HTML via regex (`extractBadge`): total
  count from `rev-combo` class, "In · Out" pair from two `.degree` classes, single `.degree`
  count, or "Working · N leave" pattern.
- Toggle button (chevron) — hidden for `ALWAYS_EXPANDED_WIDGET_IDS = {'staff_unit'}` — labelled
  via `visually-hidden` span **"Expand panel"** / **"Collapse panel"**; all other widgets start
  collapsed to a scrollable preview.
- If `chart` is present and its `chart.type` matches `CHART_COMPONENTS` (`'dept-staffing'` →
  `DeptStaffingChart`), the chart renders above the table; while collapsed, a button
  **"Show detailed table"** replaces the raw table.
- Body: raw widget HTML injected via `dangerouslySetInnerHTML` (legacy table markup untouched).

### 3.3 `/dashboard/hub` — All dashboards (`client/src/pages/dashboard/DashboardHub.jsx`)

A static `ModuleHub` (no API call, `loading=false`, `error=null`) listing 6 cards grouped by
section, each with icon/title/desc:
- **Boards**: "Attendance dashboard" (`/dashboard`, "Home board — staff and student attendance
  widgets"); "Student dashboard" (`/dashboard/student`, "Student-focused widget board with
  academic year filters").
- **Strength**: "Overall strength" (`/dashboard/overall-strength`, "Course strength by
  admission year"); "Community strength" (`/dashboard/community-strength`, "Course strength by
  community category").
- **Audit**: "Log dashboard" (`/dashboard/log`, "Login statistics for admin, staff, and
  students").
- **Faculty**: "Staff pattern" (`/dashboard/staff-pattern`, "Faculty structure and unit rosters
  (DCI norms)").

### 3.4 `DashboardWidgetShell` — shared shell for Student Dashboard & Staff Pattern

Used by `/dashboard/student` (`shellPath="/api/dashboard/student"`, `title="Student
Dashboard"`, `showYearPickers=true`) and `/dashboard/staff-pattern`
(`shellPath="/api/dashboard/staff-pattern"`, `title="Staff Pattern"`, no year pickers).

**Fields in DOM order:**
1. Breadcrumb: `Dashboard (/dashboard/hub) > {breadcrumbLabel || title}`.
2. Hero: `<h1>{title}</h1>`, subtitle "Review widgets for **{formatDisplayDate(attendanceDate)}**. Pick a date and refresh to load the latest data."
   - Chips: `ID {memberId}`; access-type chip; (if `showYearPickers && academicYears.ugr`) "U.G {ugr}"; institution label (truncated at 42 chars + `…`).
   - Hero actions: **Step 1** "Attendance date" `<input type="date">`; **Step 2** button "Refresh widgets" / "Refreshing…" (`onClick=handleRefresh`, disabled while `widgetLoading`); **More** link "All dashboards" → `/dashboard/hub`.
3. Stat cards (`cis-dash-stats`): "Configured widgets" (`widgetCount`, foot "{loadedWidgetCount} loaded for this view"); "Attendance date" (formatted date, foot "Change date in Step 1 above"); (if `showYearPickers`) "Academic years" (value = `ugr`, foot "Add. {uga} · P.G {pgr}"); "Access role" (`user.accessType`, foot `user.memberName`).
4. Section "Today's widgets" / subtitle "Live panels assigned to your account in dashboard access setup." Toolbar: date input + button "Refresh"/"Loading…".
5. If `showYearPickers && shell.yearOptions`: three `<select>` columns — "U.G (Regular)" (`yearOptions.ugRegular`), "U.G (Additional)" (`yearOptions.ugAdditional`), "P.G" (`yearOptions.pgRegular`) — each `onChange` calls `applyYears({...academicYears, <field>: value})`, which re-fetches the shell + widgets with the new year.
6. Widget grid: same `DashboardWidgetCard` list as `/dashboard`, but **no chart prop** is passed here (`DashboardWidgetShell` doesn't track `widgetCharts`), and no expand/collapse-all toolbar.
7. Empty state: "No panels assigned" / "Ask an administrator to assign widgets in Dashboard widget access." (no CTA button here, unlike `/dashboard`).

**Load calls:**
- Initial: `GET {shellPath}` with no params →
  - `/api/dashboard/student` response: `{ title: 'Student Dashboard', legacy:
    'dashboard_student.php', attendanceDate, academicYears: {ugr,uga,pgr}, yearOptions:
    {ugRegular, ugAdditional, pgRegular} (each an array of {value,label} year-range strings,
    e.g. "2024-2025"), widgets: [{id,label,order}], widgetGroups }` — widgets are filtered to
    `STUDENT_DASHBOARD_WIDGETS` only (`server/src/services/dashboard/dashboardScreens.js`).
  - `/api/dashboard/staff-pattern` response: `{ title: 'Staff Pattern', legacy:
    'dashboard_v5.php', attendanceDate, widgets, widgetGroups }` — widgets filtered to
    `STAFF_PATTERN_WIDGETS = {'staff_unit','staff_unit_1','staff_unit_2'}` (no `yearOptions`/`academicYears`).
- Widget panels: same `GET /api/dashboard/widgets` contract as §3.1, called per group via
  `Promise.allSettled`; **no client-side idbCache here** (each load is a plain `await`, not
  wrapped in `cachedByDate`).
- `applyYears(nextYears)` and `handleRefresh` both re-`fetchShell({attendanceDate, ugr, uga,
  pgr})` then re-run `loadWidgets`.

### 3.5 `/dashboard/overall-strength` and `/dashboard/community-strength` (`StrengthReportPages.jsx`)

Both share the `StrengthReportPage({apiPath, title, widgetClass})` component.

**Fields in DOM order:**
1. Breadcrumb: `Dashboard (/dashboard/hub) > {title}`.
2. Hero (`cis-dash-hero--compact`): `<h1>{title}</h1>`; subtitle: "Reference year **{data.referenceYear}**" and, if present, " · Total strength **{data.overallStrength}**".
3. Error banner if load failed.
4. Section "Strength matrix" / subtitle "Course-wise counts by admission year (legacy report layout)." Toolbar: button **"Print"** → `printReportHtml('<h3>{title}</h3>{data.tableHtml}')`.
5. Legacy-styled panel (`legacy-widget-root--{overall-strength|community-strength}`) with a `<h3>{title}</h3>` head and `data.tableHtml` injected via `dangerouslySetInnerHTML`.

**Load call:** `GET /api/dashboard/overall-strength` or `GET /api/dashboard/community-strength`
(no query params sent by the client, though the server routes accept `req.user.memberId` from
the JWT). Response shape (both):
`{ title, legacy, referenceYear, overallStrength, tableHtml, communities? }` —
`communities` (community category names) is only present on the Community Strength response.

**Server computation detail (both, `server/src/services/dashboard/studentStrengthOverall.js` /
`studentCommunityStrength.js`):**
- `referenceYear` = `basic_setup_tb.ug_academic_year` (`del=1`).
- Overall Strength: distinct `student_profile_tb.academic_year` values become the year
  columns; per U.G/P.G course (`basic_setup_course_tb`, `del=1`), a year column is only shown
  if `regularSem != 0` where `regularSem = (yearDiff * semester_per_year) + (di_semester_enable
  - 1)` and `yearDiff = refStart - admStart` (both < `course_duration`); counts come from
  `COUNT(*) FROM student_profile_tb WHERE del=1 AND course_id=? AND (releaving_date='0000-00-00'
  OR releaving_date > today) AND academic_year=?`.
- Community Strength: community columns come from `master_setup WHERE category='Community' AND
  del != 0 ORDER BY category_order`; counts filtered by `student_community = community.id`
  instead of `academic_year`.
- Both build raw `<table>` HTML server-side (legacy inline-styled markup: `bgcolor`, `nowrap`,
  border styles) rather than returning structured JSON rows — the client renders it as-is.

**Loading/error:** `<PageLoading message="Loading report…" />` while fetching; on failure,
`alert-danger` with `err.response?.data?.message || 'Unable to load report'` (page still
renders the rest of the shell with `data=null`, so the table area is simply empty).

### 3.6 `/dashboard/widgets` payload internals (server: `widgetDispatcher.js`)

- `fetchWidgets({memberId, widgetNames, dateUnix, cFlag, time, academicYears, cRefresh})` is
  the single entry point behind `GET /api/dashboard/widgets`.
- **Server-side cache**: an in-memory `Map` keyed by `memberId + sorted widget names + dateUnix
  + cFlag + timeComponent + JSON(academicYears)`, TTL 90s (`WIDGET_CACHE_TTL_MS`), capped at 500
  entries (`WIDGET_CACHE_MAX_ENTRIES`, oldest evicted first). `cRefresh=1` bypasses read *and*
  overwrites the cache entry with fresh data. `time` is only mixed into the cache key when
  `staff_current` is among the requested widgets (every other widget ignores the caller's
  wall-clock minute so the cache isn't busted every 60s for no reason).
- Widgets are grouped into 4 "batch" builders that each run one shared query pass and split the
  result: `buildStaffAttendanceWidgets` (staff_attendance, staff_attendance_incampus,
  staff_leave_absent), `buildStudentAttendanceWidgets` (internship_attendance,
  internship_attendance_batch, ug_attendance, internship_leave_absent, internship_permission,
  pg_attendance, pg_attendance_dept, pg_leave_absent, pg_permission, ug_attendance_add),
  `buildStudentDetailsWidgets` (student_details, student_add_details), and
  `buildStudentHostelWidgets` (student_hostel + gents/ladies hostel att. + student_ghostel/
  student_lhostel derivatives). All batch builders and all `NATIVE_HANDLERS` run in parallel via
  `Promise.all(preloadTasks)`.
- `NATIVE_HANDLERS`: `staff_details` → `renderStaffDetails`; `staff_permission` →
  `renderStaffPermission`; `staff_unit` → `renderStaffUnit`; `staff_current` →
  `renderStaffCurrent`; `staff_unit_1`/`staff_unit_2` → `renderStaffUnit1`/`renderStaffUnit2`;
  `student_scholarship` → `renderStudentScholarship`; `feedback_analyasis` →
  `renderFeedbackAnalysis`. Any other widget id falls through to `renderPlaceholder(name)`.
- A native handler may return either a plain HTML string or `{html, chart}`; only `staff_unit`
  currently returns a `chart` (`{type:'dept-staffing', rows:[{department, sanctioned,
  available, vacant, surplus}]}`), consumed client-side by `DeptStaffingChart`.
- `staffAuthentication(memberId, prefix)` (`server/src/services/dashboard/widgetAuth.js`) reads
  `dept_authentication.dept_staff` for the caller's `web_account_setup.id` and injects an `AND
  (A.id="x" OR A.id="y" …)` clause into every staff query that supports it — a dept-scoped
  account only ever sees its own department's staff rows, silently (no error, just fewer rows).

**Individual widget content (label → key source, per widget file):**

| Widget id | Card title (`DASHBOARD_WIDGET_LABELS`) | Source table(s) | Notable business rule |
|---|---|---|---|
| `staff_details` | Staff Details | `staff_profile_tb` ⋈ `edu_setup_tb` (category='Category') | Groups by `job_category`, filters active staff (`releaving_date='0000-00-00' OR > date`), applies `staffAuthentication`. Header row literal: `Category` / `#T`. |
| `staff_permission` | Staff Permission | `att_permission_request` ⋈ `staff_profile_tb` | Excludes categories `hostel`, `Teaching Basic Science`, `College Support`. Columns: Cat., #T, Personal (Apply/Approve), Official (Apply/Approve). Rows with `tApply=0` are suppressed; a `Total` row only appears if `total > 0`. |
| `staff_unit` | Faculty Structure | `staff_dept_master`, `staff_dept_unit_master`, `staff_designation_tb`, `staff_desg_master` | Per department/unit: Professor/Reader/Lecturer Norms/Avai./Vacant columns via regex title match (`%Professor%`/`%Principal%`, `%Reader%`/`%Associate%`, `%Lect%`/`%Senior%`); negative `vProf` deficit borrows into `vRead`. Always expanded (no collapse toggle). Emits `chart.rows` for `DeptStaffingChart`. |
| `staff_unit_1` / `staff_unit_2` | Faculty - Unit I / II | `staff_profile_tb` (`job_category=255`) ⋈ `staff_designation_tb` (`unit_type='I'`/`'II'`) | Roster table: Norms(dept header)/S.ID/Staff Name/Designation, ordered by `getStaffOrder()` custom `FIELD()` sort. |
| `staff_current` | Staff Current | `period_set_up`, `timetable_tb_new` ⋈ `basic_subject_tt_tb`, `staff_profile_tb`, `att_leave_task` | Live "who's teaching right now" board for `academicTime`; has its own inline **"Go"** button + `HH:MM` text input (`id="attendance_time"`) that calls client JS `callStaffCurrent()` (legacy `onclick`, not a React handler — inert unless the surrounding legacy JS is loaded). Columns: Staff / Class / Subject & Class Room; rows colored green (on leave, replaced) vs red (absent) vs default (present). |
| `staff_attendance*` / `staff_leave_absent` | Staff Attendance / (Incampus) / Staff Leave/Absent | `buildStaffAttendanceWidgets` (`widgets/staffAttendance.js`) | Batch-computed together (single query pass) since they share the same per-staff attendance resolution logic as `staff_current`. |
| `student_details` / `student_add_details` | Student Details (Reg.) / (Add.) | `buildStudentDetailsWidgets` (`widgets/studentDetails.js`) | Card headers literally "Student Details (Reg.)" / "Student Details (Add.)". |
| `ug_attendance`, `ug_attendance_add`, `pg_attendance`, `pg_attendance_dept`, `pg_leave_absent`, `pg_permission`, `internship_attendance*`, `internship_leave_absent`, `internship_permission` | (see `DASHBOARD_WIDGET_LABELS`) | `buildStudentAttendanceWidgets` (`widgets/studentAttendanceWidgets.js`, 44KB — largest widget file) | Card titles literally "Internship Attendance", "Internship Attendance (Batch)", "Internship Leave/Absent", "Internship Permission", "P.G Attendance", "P.G Attendance (Dept.)", "P.G Leave/Absent", "P.G Permission", plus a shared `buildUgWidgetHtml(title, …)` for the two U.G. variants. |
| `student_hostel`, `gents_hostel_attendance`, `ladies_hostel_attendance`, `student_ghostel`, `student_lhostel` | Hostel / Gents Hostel Attendance / Ladies Hostel Attendance / Gents Hostel Att. / Ladies Hostel Att. | `buildStudentHostelWidgets` (`widgets/studentHostelWidgets.js`) | Card titles "Hostel" (summary), then per-gender detail tables. |
| `student_scholarship` | Scholarship | `renderStudentScholarship` (`widgets/studentScholarshipWidget.js`) | Card title "Scholarship". |
| `feedback_analyasis` | Feedback Analysis | `renderFeedbackAnalysis` (`widgets/feedbackAnalysisWidget.js`) | Card title includes a dynamic sub-label: `Feedback <span>{finalFeedbackTitle}</span>`. |
| any unmapped id | (raw id as label) | `renderPlaceholder` | Card body literally: "Widget `<name>` — native migration in progress". |

## 4. Primary user stories

**US-D1 — See today's attendance register at a glance.**
As a staff/admin user, I want `/dashboard` to open showing today's date and every widget
assigned to me, so that I can review campus attendance without configuring anything first.
- AC: On login redirect to `/dashboard`, the page fires `GET /api/dashboard` with no params;
  `attendanceDate` in the response defaults to today (`server/src/routes/dashboard.js`
  `parseAttendanceDate`); the identity strip shows `ID`, `Role`, and `Panels {loaded}/{total}`.
- AC: Panels render as a grid of `DashboardWidgetCard`s labelled with the exact
  `DASHBOARD_WIDGET_LABELS` text for each assigned `widget_name`.

**US-D2 — Change the attendance date without extra clicks.**
As a user, I want to pick a past date in the "Show panels for" input and have the panels
reload automatically, so that I don't need a separate "Go" button for the common case.
- AC: Changing the `<input type="date">` debounces 400ms then calls `loadForDate(date, {
  announce: true })`; a status line briefly reads "Updated panels for {date}".
- AC: `max` on the date input is `todayIso()` — future dates cannot be selected via the picker.

**US-D3 — Force-refresh stale panels.**
As a user, I want a "Refresh panels" button that bypasses any cache and re-queries the server,
so that I can see the latest data after new attendance is marked elsewhere in the system.
- AC: Clicking "Refresh panels" (button text flips to "Updating…" while in flight) calls
  `loadForDate(date, {force:true, announce:true})`, which sets client cache `ttlMs:0` and sends
  `cRefresh=1` to `/api/dashboard/widgets`, which in turn bypasses (and overwrites) the 90s
  server-side widget cache (`widgetDispatcher.js`).

**US-D4 — Collapse/expand individual panels or all at once.**
As a user reviewing many widgets, I want each panel collapsed to a compact preview by default
with a per-card toggle, plus "Expand all"/"Collapse all" buttons, so the dashboard reads as a
uniform grid instead of a wall of tall tables.
- AC: Every widget except `staff_unit` starts `collapsed=true`; toggle button `aria-expanded`
  flips and label text (visually-hidden) switches "Expand panel"/"Collapse panel".
- AC: "Expand all" increments `expandAllTick`, which every `DashboardWidgetCard` (except
  always-expanded ones) reacts to by setting `collapsed=false`; "Collapse all" is symmetric.

**US-D5 — Jump straight to a module from the dashboard.**
As a user, I want quick links to Students/Staff/Attendance/Fees/Academic/Exam/Payroll/Reports
from the dashboard, so I don't have to open the sidebar for common destinations.
- AC: `MODULE_JUMPS` renders 8 `<Link>` cards with icon + label, routing to `/students`,
  `/staff/hub`, `/attendance`, `/fees`, `/academic`, `/exam`, `/payroll`, `/reports`.

**US-D6 — Browse a curated list of dashboard/report screens.**
As a user, I want "All dashboards" (`/dashboard/hub`) to list every dashboard-family screen
grouped by purpose (Boards/Strength/Audit/Faculty), so I can find the Staff Pattern or Strength
reports without knowing the exact URL.
- AC: `DashboardHub` renders 6 cards from the static `SCREENS` array with exact `title`/`desc`
  text as documented in §3.3, grouped under section headers "Boards", "Strength", "Audit",
  "Faculty".

**US-D7 — View the Student Dashboard filtered by academic year.**
As a student-facing staff user, I want a dashboard scoped to student-only widgets with
U.G (Regular)/U.G (Additional)/P.G year selectors, so I can review a specific batch's
attendance/hostel/scholarship data.
- AC: `/dashboard/student` only ever shows widgets in `STUDENT_DASHBOARD_WIDGETS`; changing any
  of the three `<select>`s calls `applyYears`, which re-fetches shell + widgets with the new
  `ugr`/`uga`/`pgr` values.

**US-D8 — View Faculty Structure / DCI norms via Staff Pattern.**
As an admin/HOD, I want `/dashboard/staff-pattern` to show only `staff_unit`, `staff_unit_1`,
`staff_unit_2` widgets, so I can audit sanctioned-vs-available faculty by department without
noise from attendance widgets.
- AC: `loadStaffPatternShell` filters to `STAFF_PATTERN_WIDGETS`; the DCI norms table's bar
  chart caption reads "Bar is available faculty, the marker is the sanctioned norm. Red means
  short of norms." and short departments get an `is-short` class + "−N short" delta label.

**US-D9 — Print a strength report.**
As an admin, I want a "Print" button on Overall Strength / Community Strength that opens the
legacy-styled table for printing, so paper reports match the old system's layout.
- AC: Button calls `printReportHtml('<h3>{title}</h3>{data.tableHtml}')`
  (`client/src/utils/printReport.js`), which must not use `window.open(...,'noopener')` per
  house rule (breaks `win.print()`).

**US-D10 — See total strength and reference year at a glance.**
As an admin, I want the strength report hero to show the reference academic year and overall
headcount before I scroll into the matrix, so I get the summary number immediately.
- AC: Subtitle renders "Reference year **{data.referenceYear}**" and, when present,
  " · Total strength **{data.overallStrength}**" — both sourced from `basic_setup_tb`
  (`ug_academic_year`) and the computed grand total respectively.

## 5. Rare / edge-case user stories

**US-D11 — No widgets assigned.**
As a newly-created account with no `dashboard_access` rows, I want a clear empty state instead
of a blank grid, so I know this isn't a bug.
- Trigger: `widgetCount === 0`.
- `/dashboard`: "No panels assigned" / "Ask an administrator to assign widgets in Dashboard
  widget access." + button "Open dashboard access" → `/admin/setup/dashboard-access`.
- `DashboardWidgetShell` screens: same copy, but **no** CTA button (student/staff-pattern
  shells omit it).

**US-D12 — Global superadmin with zero personal widget rows.**
As a `Global`-access-type account with nothing in `dashboard_access` for my `user_id`, I want
to fall back to a sensible default instead of an empty dashboard.
- Server logic (`loadDashboardWidgetRows`, `dashboard.js`): first tries `user_id = <me>`; if
  empty and `isGlobalAccessType`, tries `user_id = '1'`; if still empty and still Global,
  synthesizes one row per key in `DASHBOARD_WIDGET_LABELS` (every widget, in declaration
  order) — this only applies to `/api/dashboard` (home board), not `loadStudentDashboardShell`/
  `loadStaffPatternShell`, which have no such fallback and will legitimately render empty for a
  Global user with no rows.

**US-D13 — Dept-scoped account sees a narrower slice silently.**
As a HOD/dept-restricted staff account, my staff/student widgets are pre-filtered by
`dept_authentication` (`dept_staff`, `dept_student`, `dept_intern`, `dept_pg` CSV columns) —
there is no error or notice shown; counts and rows are simply smaller than an unrestricted
user's for the identical widget/date.
- Code: `staffAuthentication`/`studAuthentication`/`internAuthentication`/`pgAuthentication`
  in `widgetAuth.js`, consumed by `staffDetails.js`, `staffPermission.js`, `staffCurrent.js`,
  and (per comment) `student` widget builders.

**US-D14 — One widget group times out; the rest still render.**
As a user with a heavy `staff_attendance` group on a high-enrollment date, I want the other
groups (already arrived) to keep showing while the slow one retries, instead of the whole page
blanking.
- Mechanism: `Promise.allSettled` per group in `loadWidgets` (`Dashboard.jsx` and
  `DashboardWidgetShell.jsx`); a failed group's ids stay in `pendingWidgetIds`→removed but
  never get `widgetHtml`, so their cards show the empty/skeleton state; a red banner reads
  "`N` panel(s) took too long to load and were skipped — try refreshing." with (on `/dashboard`
  only) an inline **"Try again"** button.

**US-D15 — Malformed/stale cached widget payload.**
As a returning user whose IndexedDB/sessionStorage cache holds a widget entry from before the
`chart` field existed (`v1`), I don't want a crash.
- Mitigation: `DASHBOARD_WIDGETS_CACHE_VERSION` was bumped to `'v2'` specifically so old-shape
  cache entries are never replayed (comment in `Dashboard.jsx`); additionally
  `DashboardWidgetCard` guards `safeHtml = typeof html === 'string' ? html : ''` so any
  wrong-shaped payload degrades to "No data" instead of throwing.

**US-D16 — Cache quota / private-browsing failures.**
As a user in a private/incognito tab (or with a full storage quota), caching should silently
degrade to network-only rather than error the page.
- `idbCache.js`: every IndexedDB and `sessionStorage` write/read is wrapped in try/catch that
  swallows quota/availability errors and returns `null`/no-ops — "quota errors are non-fatal,
  just skip caching".

**US-D17 — Total dashboard load failure with nothing cached.**
As a user on first-ever login (nothing cached) when `/api/dashboard` 500s or the network is
down, I want a clear failure screen with a way to retry, not an infinite spinner.
- `Dashboard.jsx`: `loadError && !dashboard` → full-page `alert-danger` with server message (or
  "Could not load dashboard") + **"Retry"** button (`window.location.reload()`).
- `DashboardWidgetShell.jsx`: same pattern but no reload button — just the alert.
- `StrengthReportPages.jsx`: failure still renders the page shell/hero, just with an
  `alert-danger` inline and an empty table area (`data?.tableHtml || ''`).

**US-D18 — `staff_current` live board needs a manual time nudge.**
As a user checking "who is teaching right now" for a time other than the current minute, the
widget renders its own `HH:MM` input + "Go" button — but these use legacy inline `onclick`
handlers (`callStaffCurrent()`), which are **not** wired to any React state; without the
surrounding legacy JS asset loaded, this control is inert and only the initial `academicTime`
snapshot is shown.

**US-D19 — Server-side widget cache cross-user leakage risk is mitigated by keying.**
Because the in-memory `widgetCache` key includes `memberId`, two different users requesting the
same widget/date do **not** share a cache entry (important given dept-scoped filtering) — but
it does mean cache hit-rate is per-user, and the 500-entry cap can evict a legitimately fresh
entry under high concurrent user count (`pruneWidgetCache` evicts oldest-by-insertion-order
when over the cap, not LRU).

**US-D20 — Print button with only a fallback empty table.**
As an admin viewing Overall/Community Strength before the report finished loading or after a
load error, clicking **Print** still opens a print window with `data?.tableHtml || ''` — i.e. a
bare `<h3>{title}</h3>` and no table, rather than being disabled. No client-side guard prevents
printing an empty report.

**US-D21 — Widget id with no native handler.**
As a developer/administrator who has assigned a `widget_name` in `dashboard_access` that
doesn't (yet) have a native handler and isn't one of the batch-covered ids, the card renders
via `renderPlaceholder(name)`: "Widget `<name>` — native migration in progress" instead of
erroring the whole widgets request.

## 6. Future / predicted user stories

### Future (not implemented)

These are speculative, grounded in [../mobile.md](../mobile.md) §6/§9, and not present in the
codebase today.

**US-D22 (Future).** As a mobile app user, I want a read-only Dashboard screen backed by the
same `/api/dashboard` and `/api/dashboard/widgets` endpoints, so the phone shows the same
attendance-register concept as the web app (mobile.md §6: "Dashboard | `/api/dashboard` |
Widget-by-widget; anything backed by PHP bridge just returns JSON same as web" — note: as of
this doc, no dashboard widget is bridge-backed, so this simplifies further for mobile — every
widget already returns plain JSON-friendly HTML/chart data).

**US-D23 (Future).** As a mobile user, I want widget HTML rendered via a WebView with a native
Share/Save-as-PDF action instead of a desktop print window, reusing the server's existing
`tableHtml`/widget `html` payloads unchanged (mobile.md §7.1 — `expo-print` +
`expo-sharing`, no backend change required).

**US-D24 (Future).** As a mobile user, I want the dashboard's date/scope selection to persist
locally (SecureStore or AsyncStorage) between app opens the way the web client's
sessionStorage/IndexedDB cache does today, so re-opening the app doesn't always show a spinner
first (extrapolation of `idbCache.js`'s stale-while-revalidate pattern; mobile.md §6.5 notes
mobile v1 can "cache lightly" for read-mostly screens).

**US-D25 (Future).** As a user, I want push notifications when new circulars or attendance
alerts land, surfaced as a badge on a mobile Dashboard shell — explicitly flagged in mobile.md
§8 as **new backend surface requiring sign-off**, not yet built: "there is no push
infrastructure today."

**US-D26 (Future).** As an admin, I want the "N panels took too long to load" failure banner
to offer a per-widget retry (not just a page-wide "Try again"), so a single slow group (e.g.
`staff_attendance` on a big date) can be retried without re-fetching groups that already
succeeded. Not implemented today — `handleManualRefresh` always re-requests every group.

**US-D27 (Future).** As a HOD, I want the DCI-norms `DeptStaffingChart` bar chart (currently
only wired for `staff_unit`) extended to other widgets with numeric time-series/category data
(e.g. attendance trend over a week), following the same `chart: {type, rows}` contract already
defined in `widgetDispatcher.js`'s `splitResult()`.

## 7. Traceability table

| Story | Client file | Server route / service | Table(s) |
|---|---|---|---|
| US-D1, US-D2, US-D3, US-D5, US-D17 | `client/src/pages/Dashboard.jsx` | `GET /api/dashboard` (`server/src/routes/dashboard.js`) | `web_account_setup`, `dashboard_access`, `basic_setup_tb`, `log_tb` (via `getLastSuccessfulLogin`) |
| US-D1, US-D4, US-D14, US-D15, US-D16, US-D19, US-D21 | `client/src/pages/Dashboard.jsx`, `client/src/components/DashboardWidgetCard.jsx`, `client/src/utils/idbCache.js` | `GET /api/dashboard/widgets` → `fetchWidgets` (`server/src/services/dashboard/widgetDispatcher.js`) | `dashboard_access`, plus per-widget tables below |
| US-D6 | `client/src/pages/dashboard/DashboardHub.jsx` | — (static) | — |
| US-D7 | `client/src/pages/dashboard/StudentDashboardPage.jsx`, `DashboardWidgetShell.jsx` | `GET /api/dashboard/student` → `loadStudentDashboardShell` (`server/src/services/dashboard/dashboardScreens.js`) | `web_account_setup`, `dashboard_access`, `basic_setup_tb` |
| US-D8, US-D27 | `client/src/pages/dashboard/StaffPatternPage.jsx`, `DashboardWidgetShell.jsx`, `client/src/components/DeptStaffingChart.jsx` | `GET /api/dashboard/staff-pattern` → `loadStaffPatternShell`; `staff_unit` → `renderStaffUnit` (`widgets/staffUnit.js`) | `dashboard_access`, `staff_dept_master`, `staff_dept_unit_master`, `staff_designation_tb`, `staff_desg_master`, `staff_profile_tb` |
| US-D9, US-D10, US-D20 | `client/src/pages/dashboard/StrengthReportPages.jsx`, `client/src/utils/printReport.js` | `GET /api/dashboard/overall-strength` → `loadOverallStrengthReport`; `GET /api/dashboard/community-strength` → `loadCommunityStrengthReport` (`server/src/services/dashboard/studentStrengthOverall.js`, `studentCommunityStrength.js`) | `basic_setup_tb`, `basic_setup_course_tb`, `student_profile_tb`, `master_setup` |
| US-D11 | `Dashboard.jsx`, `DashboardWidgetShell.jsx` | `dashboard_access` empty-set path | `dashboard_access` |
| US-D12 | `server/src/routes/dashboard.js` (`loadDashboardWidgetRows`) | `isGlobalAccessType` (`server/src/utils/accessType.js`) | `dashboard_access`, `web_account_setup` |
| US-D13 | — | `server/src/services/dashboard/widgetAuth.js`, `deptAuth.js` | `dept_authentication` |
| US-D18 | `server/src/services/dashboard/widgets/staffCurrent.js` | `renderStaffCurrent` | `period_set_up`, `timetable_tb_new`, `basic_subject_tt_tb`, `staff_profile_tb`, `att_leave_task` |
| US-D22–US-D26 (Future) | *(mobile/ not yet scaffolded)* | Same `/api/dashboard*` endpoints, unchanged per mobile.md §6/§7.2/§7.4 | Same tables as above |

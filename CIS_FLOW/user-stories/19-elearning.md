# 19 — E-learning

## 1. Module overview

**Purpose.** The E-learning module tracks online-class/assignment/test "sessions"
(`activity_task_tb` rows — one row per class/assignment/test session for a subject/period) and
the daily time-slot windows during which each activity type is allowed to run
(`activity_time_tb`). Staff schedule a session (class material links, assignment links, or a
test), students presumably submit answers elsewhere (`activity_answer_tb`, read but never
written by any screen in this module), and staff review participation via a dashboard and two
report screens.

**Primary actors.**
- **Admin/academic staff** — configure daily activity time windows (`elearn-setup`).
- **Subject-teaching staff** — schedule a class/assignment/test session for their subject
  (`subject-test`, legacy path `staff/subject_test.php` — a staff-scoped legacy screen).
- **Admin/reporting staff** — review the day's e-learning activity college-wide
  (`elearn-dashboard`, `elearn-report`) or a specific session's submissions
  (`subject-report`).
- **Students** (indirectly — their `activity_answer_tb` submissions are read by
  `subject-report`; no student-facing screen exists in this module).

**Legacy PHP files replaced:**

| Legacy file | Screen slug |
|---|---|
| `elearn_dashboard.php` | `elearn-dashboard` |
| `elearn_setup.php` | `elearn-setup` |
| `elearn_report.php` | `elearn-report` |
| `staff/subject_test.php` | `subject-test` |
| `staff/subject_report.php` | `subject-report` |

## 2. Screen inventory

Four of the five screens run through the generic setup factory (`elearn-setup`, `elearn-report`,
`subject-test`, `subject-report`); the true Dashboard (as opposed to the `elearn-dashboard` slug
reused inside the factory — see caveat below) is a bespoke page like Portfolio's. Base client
route for factory screens: `/elearning/setup/:screen`; hub `/elearning`; dashboard
`/elearning/dashboard`.

| Screen | Route | Component | Server load/save | Legacy `.php` | Read-only? |
|---|---|---|---|---|---|
| Hub | `/elearning` | `ElearningHub` (`createModuleHub`, `dashboardPath: '/elearning/dashboard'`) | — | — | — |
| **Dashboard (bespoke)** | `/elearning/dashboard` | `ElearnDashboardPage` | `GET /api/elearning/dashboard` | `elearn_dashboard.php` | Yes (no save) |
| `elearn-dashboard` (factory slug — reuses `ElearnReportScreen`, **not** the dashboard component) | `/elearning/setup/elearn-dashboard` | `ElearnReportScreen` | `POST /api/elearning/setup/elearn-dashboard/load` | `elearn_dashboard.php` | Yes (`meta.readOnly: true`) |
| `elearn-setup` | `/elearning/setup/elearn-setup` | `ElearnSetupScreen` | `POST /api/elearning/setup/elearn-setup/load\|save` | `elearn_setup.php` | No |
| `elearn-report` | `/elearning/setup/elearn-report` | `ElearnReportScreen` | `POST /api/elearning/setup/elearn-report/load` | `elearn_report.php` | Yes (`meta.readOnly: true`) |
| `subject-test` | `/elearning/setup/subject-test` | `SubjectTestScreen` | `POST /api/elearning/setup/subject-test/load\|save` | `staff/subject_test.php` | No |
| `subject-report` | `/elearning/setup/subject-report` | `SubjectReportScreen` | `POST /api/elearning/setup/subject-report/load` | `staff/subject_report.php` | Yes (`meta.readOnly: true`) |

**Important quirk to flag if touching this module:** `ELEARNING_SCREEN_META['elearn-dashboard']`
and the `COMPONENTS['elearn-dashboard']` mapping in `ElearningModule.jsx` both point at
`ElearnReportScreen` (the same component used for `elearn-report`), **not** at
`ElearnDashboardPage`. The real dashboard-with-summary-tiles UI (`ElearnDashboardPage`) is only
reachable via the separate bespoke route `/elearning/dashboard` (through `createModuleHub`'s
`dashboardPath`), calling a different endpoint (`GET /api/elearning/dashboard` vs `POST
/api/elearning/setup/elearn-dashboard/load`). Visiting `/elearning/setup/elearn-dashboard`
directly renders the plain report-table UI, not the summary-tile dashboard — this is either an
intentional "setup-screen list also exposes report screens generically" convenience or a
leftover duplicate meta entry; verify against the legacy PHP before assuming either is wrong.

Server routes (`server/src/routes/elearning.js`), gated by `authMiddleware` +
`menuAuthForModule('elearning')`:
- `GET /api/elearning/dashboard` → `loadElearnDashboard` directly (bespoke route, bypasses the
  screen dispatcher).
- `POST /api/elearning/setup/:screen/load` / `/save` → `loadElearningScreen` /
  `saveElearningScreen` in `elearningSetup.js`, which validate against `VALID_SCREENS =
  new Set(['elearn-setup','elearn-dashboard','elearn-report','subject-test','subject-report'])`
  (unknown screen → `{error:'Unknown e-learning screen'}`), and reject saves on screens with no
  `SAVERS` entry (`elearn-dashboard`, `elearn-report`, `subject-report`) with
  `{error:'Screen is read-only'}` — same server-side enforcement pattern as NAAC.

## 3. Pixel-level flow per screen

### 3.0 Shared factory contract

Same `createSetupApi`/`createModuleSetupPage` contract as Certificates — see
`16-certificates.md` §3.0. `useElearningSetupApi = createSetupApi('/api/elearning')`
(`client/src/pages/elearning/ElearningModule.jsx`). No `initialLoadFields` overrides in
`ELEARNING_SCREEN_META`.

### 3.1 Dashboard (bespoke) — `/elearning/dashboard` (`ElearnDashboardPage`, in
`ElearningScreens.jsx`)

Not built through the factory — plain `useState`/`useEffect`, no busy/error/notice pattern beyond
a single `loading` boolean (no error banner at all if the request fails — unlike Portfolio's
Dashboard, there is no `try/catch` around the `api.get` call in `load()`, so a failed request
would surface as an unhandled promise rejection rather than a user-visible error message — a gap
relative to `PortfolioDashboardPage`'s explicit error-message handling).

Fields:
1. **Date `<input type="date">`**, defaults to today (`new Date().toISOString().slice(0,10)`).
2. **"Refresh" submit button** (`btn btn-info`).
3. Three summary cards: **"Classes / Materials"**, **"Assignments"**, **"Tests"** — each a plain
   `<div className="card p-3">` with a bold label and `data.summary.<key>` as a large number
   (`fs-3`).
4. **Sessions table** — columns `Session | Course | Subject | Period | Active`; "Active" renders
   literal text `Yes`/`No` (not a badge/checkmark icon). No empty-state message text — an empty
   `sessions` array just renders an empty `<tbody>`.

Server (`loadElearnDashboard`): queries `activity_task_tb` for the given date (`del:1,
exam_date: <exact date>`), capped at 200 rows (`take: 200`, no pagination UI — a day with more
than 200 sessions silently truncates without any "showing 200 of N" indicator), ordered `id desc`.
`summary.classes` counts tasks with either `handle_link` or `material_link1` set;
`summary.assignments` counts tasks with `assignment_link` set; `summary.tests` counts tasks with
`total_question > 0`. These three categories are **not mutually exclusive** — a single task row
with both a `material_link1` and an `assignment_link` and `total_question > 0` would be counted
in all three tiles simultaneously (the tiles sum "has this attribute," not "session type").

### 3.2 `elearn-setup` — Activity Time Setup (`elearn_setup.php`)

Component: `ElearnSetupScreen`. A table, columns `Type | Year | From | To`, one row per
`activity_time_tb` row (`data.slots`, ordered by `atype, ayear`). "Type" and "Year" cells are
**plain read-only text** (`slot.atype`, `slot.ayear` — no input, cannot be edited or added here;
rows are pre-seeded elsewhere, this screen only edits the From/To time window per existing row).
"From"/"To" are `<input type="time">` with `id={`from-${slot.id}`}`/`id={`to-${slot.id}`}`
and `defaultValue` (**uncontrolled** inputs — React `defaultValue`, not `value`, meaning the
component does not re-render these on state change; the DOM is the source of truth between saves).

**"Save times" button** (`btn btn-primary`) reads current values directly via
`document.getElementById(`from-${slot.id}`).value` / `to-${slot.id}` for every slot (a raw DOM
read, bypassing React state entirely — an unusual pattern versus the rest of the codebase, worth
noting if this screen is ever refactored to controlled inputs) and calls
`onSave({ slots: [...] })`.

Server load (`loadElearnSetup`): `prisma.activity_time_tb.findMany({ where: { del: 1 } })`.
Server save (`saveElearnSetup`): for each slot with an `id`, updates `from_time`/`to_time` by
constructing a `Date` from `1970-01-01T{time}:00` (defaults `08:00`/`18:00` if the submitted time
string is falsy — note: the client always sends a real `HH:MM` string from the `<input
type="time">`, so these defaults only matter if a slot's DOM element is missing (e.g. its id
wasn't found)). Message: `"Activity times updated..."`.

### 3.3 `elearn-report` — E-Learning Report (`elearn_report.php`)

Component: `ElearnReportScreen` (also reused, per the quirk noted above, as the `elearn-dashboard`
factory slug's component). Fields:
1. **Date `<input type="date">`**, default today.
2. **Course `<select>`** — placeholder `"All courses"`, options `data.courseOptions`.
3. **"Go" button** (`btn btn-info`).
4. Table — columns `Session | Course | Subject | Period | Active`; same `Yes`/`No` text pattern
   as the bespoke dashboard.

Server (`loadElearnReport`): filters `activity_task_tb` by exact `exam_date` and optionally
`course_id`; `courseOptions` built from **all** active courses (`basic_setup_course_tb`, no
course-type restriction), label format `` `${course_name} — ${degree_name}` ``. No row cap here
(unlike the 200-row cap on the bespoke dashboard) — but also no pagination, so a date with a very
large number of sessions across all courses renders the entire unpaginated list.

### 3.4 `subject-test` — Subject Test / Session (`staff/subject_test.php`)

Component: `SubjectTestScreen`. Two-column layout.

Left (`col-md-5`) — form fields are **generated generically from an array of raw field-name
keys**, so the visible labels are the literal camelCase property names, not humanized text:
`examName`, `subjectId`, `period`, `scheduleId`, `classInfo`, `materialLink1`, `assignmentLink`
— each rendered as `<label className="form-label">{k}</label><input className="form-control"
value={form[k]||''} .../>`. Below those, one explicitly-labeled field: **"examDate"**
`<input type="date">`, default today. **"Save session"** submit button (`btn btn-primary`).

Right (`col-md-7`) — a table of `data.tasks` (recent sessions filtered by the currently-typed
`scheduleId` — see server notes), columns `Name | Date | Subject` (`examName`, `examDate` sliced
to 10 chars, `subjectId`).

Server load (`loadSubjectTest`): only queries `activity_task_tb` if `fields.scheduleId` is
non-empty (i.e. `data.tasks` is empty until the user has typed something recognizable into the
"scheduleId" field and the screen reloads with it) — filtered by `course_id: scheduleId`, capped
at 50 rows, `orderBy: exam_date desc`. **Note the client never actually calls `onLoad` with a
`scheduleId`** in the read code — `useEffect(() => { onLoad(); }, [onLoad])` only fires once on
mount with no fields, and the form's `scheduleId` input changes are never fed back into a re-load
— so in the current wiring, the right-hand "recent sessions" table is effectively always empty
unless the parent page injects `initialLoadFields` (it doesn't) or a future edit wires the input
to trigger `onLoad({ scheduleId })` on blur/change. Treat this as a UI gap to fix if working on
this screen.

Server save (`saveSubjectTest`): `examName` is required (`"Session name is required"` if blank
after trim). Note the payload the client actually sends only ever includes the 7 raw keys listed
above plus `examDate` — but the server's `saveSubjectTest` maps a much larger set of fields
(`courseName`, `courseId`, `courseType`, `academicYear`, `currentYear`, `semesterNo`, `batchNo`,
`handleLink`, `materialLink2`, `assignmentInfo`, `fromDate`, `toDate`, `isActive`) that the
current form never populates — those all fall back to their defaults (empty string / `new
Date()` / `is_active: 1`) on every save from this screen, meaning fields like `courseName`/
`academicYear`/`batchNo` are never actually set by this UI despite the service supporting them —
another gap worth flagging (the service was clearly built for a richer legacy form than what's
currently wired up). `total_question`/`total_marks` are always hardcoded to `'0'` on save from
this screen — this UI never creates an actual scored test, only a class/assignment/material
session (the "Test" summary tile on the dashboard, which counts `total_question > 0`, can
**never** be incremented by anything created through this screen as currently wired).

### 3.5 `subject-report` — Subject Report (`staff/subject_report.php`)

Component: `SubjectReportScreen`. Fields:
1. **Session `<select>`** — placeholder `"Select session"`, options `data.taskOptions` (label
   `` `${examName} (${examDate sliced to 10 chars})` ``). `onChange` sets local `taskId` and
   immediately calls `onLoad({ taskId: e.target.value })`.
2. If a session is selected and resolved (`data.task`): a summary line
   `**{examName}** — {examDate sliced} — Submitted: {totalSubmitted}`.
3. Table — columns `Register No | Marks | Status`, from `data.answers`.

Server (`loadSubjectReport`): resolves the selected `activity_task_tb` row by numeric id
(`Number(fields.taskId||0)`); if found, loads its `activity_answer_tb` rows (matched by
`exam_id: String(taskId)` — a **string-typed foreign key comparison**, worth double-checking type
coercion if `exam_id` is ever stored inconsistently) ordered by `register_no`. `taskOptions` is
always the 30 most recent tasks overall (`orderBy: exam_date desc, take: 30`) — **not scoped to
the currently logged-in staff member's own sessions**, so any staff with module access sees every
recent session college-wide in this dropdown, not just their own subject's sessions (worth
confirming against legacy `staff/subject_report.php`, whose path suggests a staff-scoped screen —
if legacy actually restricts to the logged-in staff's own sessions, this native port may have
widened visibility unintentionally).

## 4. Primary user stories

**US-19.1 — Review today's (or a chosen day's) e-learning activity college-wide**
As an **admin/reporting staff member**, I want to pick a date on the E-Learning Dashboard and see
summary counts of classes/materials, assignments, and tests, plus a session list, so that I get a
quick daily pulse on online-teaching activity.
*Acceptance criteria:* changing the date and clicking "Refresh" reloads all three tiles and the
table for that date; a session with both material and assignment links contributes to both the
"Classes / Materials" and "Assignments" tiles simultaneously (not mutually exclusive counting).

**US-19.2 — Configure daily activity time windows**
As an **admin/academic staff member**, I want to set the From/To time window for each configured
activity type+year slot on Activity Time Setup, so that e-learning activities are constrained to
approved daily windows.
*Acceptance criteria:* Type and Year are fixed (not editable) per row — only From/To times can be
changed; saving reads live DOM values at click-time (uncontrolled inputs), so a slot whose input
element fails to render would fall back to `08:00`–`18:00` server-side.

**US-19.3 — Schedule a class/assignment/material session for a subject**
As a **subject-teaching staff member**, I want to enter a session name, subject, period, class
info, and material/assignment links with an exam date, and save it as an activity-task session,
so that students have access to that day's material/assignment.
*Acceptance criteria:* saving with a blank session name is rejected
(`"Session name is required"`); the created session always has `total_question: '0'` (never
counted as a "Test" on the dashboard) since this screen has no field for question count.

**US-19.4 — Filter the college-wide e-learning report by date and course**
As an **admin/reporting staff member**, I want to filter the E-Learning Report by date and
(optionally) course, so I can narrow down which departments/courses were active on a given day.
*Acceptance criteria:* leaving Course as "All courses" returns every session for that date across
all active courses; the report has no pagination, so very active days render a long unpaginated
table.

**US-19.5 — Review a specific session's submissions**
As an **admin/reporting staff member**, I want to pick a recent session from a dropdown and see
who submitted, their marks, and status, plus a total-submitted count, so I can verify
participation for that specific test/session.
*Acceptance criteria:* the session dropdown always lists the 30 most recent sessions
college-wide, regardless of which staff member created them.

## 5. Rare / edge-case user stories

**US-19.6 — Resource with a broken or missing link**
As a **student or reviewer**, if a session's `material_link1`/`materialLink1` or
`assignment_link`/`assignmentLink` points to a dead/removed URL, none of the current screens
validate link reachability at save time or render time — the dashboard/report tables don't even
display the link value itself (only session name/course/subject/period/active), and `subject-test`
stores the raw string with zero URL-format validation on save. A broken link is therefore
invisible in the admin UI entirely; it would only surface downstream (wherever the raw
`material_link1`/`assignment_link` value is actually rendered as a clickable link — not in any
screen documented here).

**US-19.7 — Dashboard with zero participation data**
As an **admin/reporting staff member**, if I pick a date with no `activity_task_tb` rows at all
(e.g. a holiday, or before the module was used), the Dashboard renders all three summary tiles as
`0` and an empty sessions table with **no explicit "no sessions today" message** — the `<tbody>`
is simply empty, same as the `elearn-report` screen (see also US-19.4). Users may misread a
"loading forever" state as "zero data" or vice versa if network latency is high, since there's no
distinct empty-state message either way (a UI gap vs. e.g. `NaacQuanDetailedReportScreen`'s
explicit `"No data available"` empty row).

**US-19.8 — `subject-test`'s recent-sessions table effectively never populates**
As a **subject-teaching staff member** using `subject-test`, be aware (per §3.4) that the
right-hand "recent sessions" table stays empty in normal use because the client never re-issues
`onLoad({ scheduleId })` after the initial mount-time `onLoad()` call with no fields — the
`scheduleId` input has no `onBlur`/`onChange` wiring to trigger a reload. If you rely on this
table to check for duplicate/near-duplicate sessions before creating a new one, it will not help
you today; this should be fixed before depending on it operationally.

**US-19.9 — Session with `exam_id`/`taskId` type mismatch in submissions lookup**
As a **developer maintaining `subject-report`**, note the answer lookup filters
`activity_answer_tb` by `exam_id: String(taskId)` — a string comparison against a Prisma field
whose underlying column type was not confirmed in this read. If `exam_id` is ever stored as a
numeric type (or with leading zeros / whitespace differences) in some legacy-inserted rows, the
string-equality filter could silently return zero submissions for a session that actually has
answers recorded — worth a quick schema check (`schema.prisma`) before relying on this report for
an accreditation-facing participation count.

**US-19.10 — Dashboard load failure has no visible error state**
As an **admin/reporting staff member**, if `GET /api/elearning/dashboard` fails (network error,
5xx, auth expiry), `ElearnDashboardPage`'s `load()` function has no `try/catch` — the promise
rejection is unhandled, `loading` never flips back to `false` in the `finally`-equivalent path (it
does — `setLoading(false)` runs unconditionally after `await`, but only if the `await` doesn't
throw first; if it throws, `setLoading(false)` is skipped), so the page would remain stuck
displaying its loading spinner indefinitely rather than showing a retry-capable error banner like
`PortfolioDashboardPage` does. This is a real behavioral gap between the two dashboards worth
fixing for parity.

### Future (not implemented)

- *(Future — not implemented)* **Video streaming / live class integration**: nothing in the
  current schema (`activity_task_tb`'s `handle_link`/`material_link1`/`material_link2` are plain
  URL string fields) or services suggests embedded video playback — a future enhancement could
  add native video hosting/streaming rather than an external link, consistent with `mobile.md`'s
  vision of richer mobile-native features (camera/media modules already called out for other
  modules in §3 of that plan).
- *(Future — not implemented)* **Automatic broken-link detection**, directly addressing US-19.6 —
  a periodic job that HEAD-requests stored `material_link1`/`assignment_link`/`handle_link` values
  and flags dead links on the report/dashboard screens, since no screen today validates link
  reachability.
- *(Future — not implemented)* **Wiring `subject-test`'s scheduleId input to actually query
  recent sessions** (fixing US-19.8), plus surfacing the currently-unused `courseName`/
  `academicYear`/`batchNo`/`semesterNo` fields the server already supports in `saveSubjectTest`
  but the form never populates — turning this into the fuller session-scheduling screen the
  service layer appears to have been designed for.
- *(Future — not implemented)* **Mobile "my e-learning" student view**: per `mobile.md` §6, a
  read-only mobile screen showing a student's own scheduled classes/assignments/tests for the day
  (a student-scoped variant of `elearn-dashboard`/`elearn-report`) would need a new
  student-ownership-scoped query — the current `activity_task_tb`/`activity_answer_tb` queries in
  this module are all staff/admin-facing, not filtered to "sessions relevant to student X."
- *(Future — not implemented)* **Consistent empty-state messaging and load-error handling** across
  `ElearnDashboardPage`, `ElearnReportScreen`, and `SubjectReportScreen` — addressing US-19.7 and
  US-19.10 by adopting the explicit `"No data available"` / retry-banner patterns already used
  elsewhere in the app (NAAC's detailed report, Portfolio's dashboard).

## 6. Traceability

| Story | Client file(s) | Server endpoint | Service file | Table(s) |
|---|---|---|---|---|
| US-19.1 | `ElearningScreens.jsx` (`ElearnDashboardPage`) | `GET /api/elearning/dashboard` | `elearnDashboard.js` | `activity_task_tb` |
| US-19.2 | `ElearningScreens.jsx` (`ElearnSetupScreen`) | `POST /api/elearning/setup/elearn-setup/load\|save` | `elearnSetup.js` | `activity_time_tb` |
| US-19.3 | `ElearningScreens.jsx` (`SubjectTestScreen`) | `POST /api/elearning/setup/subject-test/load\|save` | `subjectTest.js` | `activity_task_tb` |
| US-19.4 | `ElearningScreens.jsx` (`ElearnReportScreen`) | `POST /api/elearning/setup/elearn-report/load` | `elearnReport.js` | `activity_task_tb`, `basic_setup_course_tb` |
| US-19.5 | `ElearningScreens.jsx` (`SubjectReportScreen`) | `POST /api/elearning/setup/subject-report/load` | `subjectReport.js` | `activity_task_tb`, `activity_answer_tb` |
| US-19.6 | `ElearningScreens.jsx` (`SubjectTestScreen`) | `POST /api/elearning/setup/subject-test/save` | `subjectTest.js` | `activity_task_tb` |
| US-19.7 | `ElearningScreens.jsx` (`ElearnDashboardPage`, `ElearnReportScreen`) | `GET /api/elearning/dashboard`, `POST .../elearn-report/load` | `elearnDashboard.js`, `elearnReport.js` | `activity_task_tb` |
| US-19.8 | `ElearningScreens.jsx` (`SubjectTestScreen`) | `POST /api/elearning/setup/subject-test/load` | `subjectTest.js` | `activity_task_tb` |
| US-19.9 | `ElearningScreens.jsx` (`SubjectReportScreen`) | `POST /api/elearning/setup/subject-report/load` | `subjectReport.js` | `activity_answer_tb` |
| US-19.10 | `ElearningScreens.jsx` (`ElearnDashboardPage`) | `GET /api/elearning/dashboard` | `elearnDashboard.js` | `activity_task_tb` |

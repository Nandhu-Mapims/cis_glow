# 07 — Attendance

## 1. Module recap

The Attendance module is the largest in the app: 26 staff screens + 27 student screens covering
staff biometric/manual attendance, leave/permission/defaulter (SMR) approval, holiday rosters and
time-schedule setup, plus the parallel UG/PG/Internship student attendance stack (daily period
marking, subject-wise reports, SMR approvals, PG/Internship punch and manual entry, year-incharge
assignment). Full field-by-field detail — every screen's inputs, validation messages, and save
payloads — is documented in [../user-stories/07-attendance.md](../user-stories/07-attendance.md);
this file builds on that base and only re-states what's needed to justify a UX call.

Two big architectural facts drive most of what follows:
- Staff screens render through one shared shell, `StaffAttScreenPage.jsx`, driven by
  `STAFF_ATT_SCREEN_META`; student screens render through `StudentAttScreenPage.jsx` (2,438
  lines — the largest client file in the module), driven by `STUDENT_ATT_SCREEN_META`.
- Every "pick a category / staff / course" control in this module is a **locally hand-rolled**
  component (`ChipMultiSelect`, `PopoverMultiSelect`, an in-file `RosterCoursePicker`) — the
  module never imports the shared `SearchableSelect` or `CheckListSelect` components at all.

## 2. Frontend control inventory

| Screen / area | Control type(s) used | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Staff Attendance Calendar (`/attendance/staff`) | plain text `<input>` (Staff ID) | No | single value | No | Raw HTML calendar grid injected via `dangerouslySetInnerHTML`; prev/next-month links inside the HTML are intercepted client-side to re-POST instead of navigating |
| Staff Attendance Report (`/attendance/staff/report`) | pill-style checkbox buttons per category (hand-rolled, not `CheckListSelect`) + `type="date"` × 2 | No (categories rendered flat, no filter box) | multi (categories) | No select-all/clear — must click each pill | Client blocks submit with 0 categories selected |
| Staff Live Punch (`/attendance/staff/punch`) | single text `<input>`, auto-focus/re-focus loop | — | — | — | Kiosk-style flow: Enter submits, `Clear` resets and refocuses — effectively a keyboard-driven single-field workflow already |
| Calendar Add / Calendar Edit setup | native `<select>` (Event, Authority) + text/date inputs | No | single | No | Calendar Edit has a 50-row recent-records table where clicking an ID row re-loads it inline (a lightweight master-detail pattern, no pagination) |
| Working Day Setup | native `<select>` per row (Event) + `PopoverMultiSelect` per row (Category) + text (Comment) | `PopoverMultiSelect` → yes, via nested `ChipMultiSelect` | multi (Category), single (Event) | `ChipMultiSelect` inside the popover has Select all/Clear | Renders every day of the month as a row (28-31 rows), each with its own popover — no bulk "mark these 5 days as holiday" action |
| Att Time Setup | text (Staff ID) + `Add Default Schedule` button (hardcoded payload) | — | — | — | "Add Default" is a one-click canned-schedule shortcut, but no way to bulk-apply the same schedule to multiple staff |
| Staff dynamic router — category filters (`attendance-report`, `teaching-month-report`, `att-chart*`) | `ChipMultiSelect` | Yes (built-in search box) | multi, `Shift+click` range-select supported | Select all / Clear | Best-equipped filter in the staff module — has range-select, grouping, and bulk actions |
| Staff dynamic router — department filter (`available-leave`) | `ChipMultiSelect` | Yes | multi | Select all / Clear | Same component reused for a different field |
| Holiday Roster (staff) | native `<select>` (Holiday date, Category) + `PopoverMultiSelect` (Staffs, lazy-loaded per category) + native multi-select (Working Days Sun-Sat) + `type="time"` | `PopoverMultiSelect` → yes | multi (Staffs, Working Days) | Select all/Clear inside the Staffs popover only | Repeatable "Group N" cards with `+ Add Row`; delete on a saved group opens a confirm modal, delete on an unsaved row is instant |
| ClElGrid (`available-cl`) | per-row editable number inputs | — | — | — | Flat editable grid, one `Update` button for the whole grid — no per-row save, no undo |
| Approval screens (staff: `smr-leave-approve`, `smr-permission-approve`, `smr-defaulter-approve`, `smr-acknowledge`) | left list of request cards (click to select) + `Status` radio-pill group + `Comments` textarea | No (no search/filter box on the request list itself, only From/To date filters before load) | single (one request selected at a time) | No | `LeaveDaysEditor`/`DefaulterDaysEditor` render one radio group per day/session — options auto-disable once the running CL/EL/OD/OFF balance would be exceeded (validation baked into the control, not a separate error message) |
| Student Daily Attendance (`/attendance/students/daily`) | native `<select>` (Course) + `type="date"` + one `<textarea>` per period (comma-separated roll numbers) | No | single (course) | No | Free-text comma-separated roll list is the "bulk mark absent" mechanism today — no roster checklist, no click-to-toggle-present grid |
| Student Attendance Report (standard + quarterly) | native `<select>` (Academic Year, Report Type) + pill checkboxes (Courses, Subjects — hand-rolled, same pattern as staff categories) | No | multi (Courses, Subjects) | No select-all/clear on the pill rows | 2-phase batched generation with a live "processed/total students" progress banner — one of the few screens with real progress feedback |
| `RosterCoursePicker` (PG/Internship holiday roster, PG att setup, PG punch reports) | bespoke in-file component (`StudentAttScreenPage.jsx:1030`) | Yes (own search box) | multi, grouped by course | Per-group "Select all" / "Deselect all" | Duplicates ~90% of what `CheckListSelect` already does, reimplemented locally instead of reused |
| PG/Internship Manual Attendance (`PeriodAttForm`) | `type="date"` + Load button + 2-column Present/Absent `<textarea>` pair per period | No | — | No | Same free-text roll-list pattern as Student Daily Attendance; changing the date after loading clears entries and requires an explicit re-Load |
| Intern Att Statement (`InternAttStatementForm`) | native `<select>` (Category, grouped) + `<textarea>` (Roll No., auto-filled by category) + `<textarea>` (Message) | No | single (Category) | No | "Go" auto-resolves a category into a roll-number list — a semi-bulk action, but the result lands in a plain textarea the user must not accidentally edit wrong |
| Holiday Roster (PG/Internship) `HolidayRosterForm` | `RosterCoursePicker` + per-group schedule table (native selects/dates/times) + soft-confirm modal on delete | Yes (picker) | multi (picker) | Select all/Deselect all per group (picker only) | Edit variant shows a paginated-looking list view first, then the form — but the "pagination" is not the shared `DataTable` component, it's bespoke |
| Year Incharge (`YearInchargeForm`) | native `<select>` (Course & Year) + native `<select>` per Year row (Staff Name) | No | single per row | No | One dropdown per year row, no bulk-assign-same-staff-to-all-years shortcut |
| Approval screens (student: `smr-leave-request`, `smr-dept-leave`, `smr-permission`, `smr-defaulter`) | left list of request buttons + native `<select>` (Status) + radio groups per day/session + `<textarea>` (Comments) | No | single (one request at a time) | No | Mirrors the staff approval pattern; empty state explicitly suggests clearing date filters rather than silently showing nothing |

## 3. Advanced feature gaps

1. **Category/staff pill checkboxes have no search or bulk toggle, despite `ChipMultiSelect` already solving this exact problem two screens over.** Staff Attendance Report's category checkboxes and the Student Attendance Report's course/subject pill checkboxes are both hand-rolled flat button lists — no search box, no "select all" / "clear". `ChipMultiSelect` (used for `attendance-report`/`teaching-month-report`/`att-chart*`/`available-leave`) already provides search, grouping, shift-click range-select, and select-all/clear for the identical "pick some categories" interaction. This is a same-module, proven-elsewhere upgrade, not a speculative one.

2. **`RosterCoursePicker` reimplements `CheckListSelect` from scratch.** It's a ~150-line bespoke component with its own search box, grouping, and per-group select-all/deselect-all — functionally almost identical to `CheckListSelect` (search + multi + bulk select-all/clear, already built and used elsewhere in the app per the README's control table). Consolidating onto the shared component would cut duplicate code and give the picker any future fixes/upgrades for free.

3. **Working Day Setup has no bulk holiday-marking.** Every day of the month renders as an individually-editable row; marking a run of days (e.g. a week-long festival break) as `Holiday-*` requires opening the Event select 7 separate times. A "select date range → apply event type" bulk action would directly match how holidays are actually declared (as ranges, not scattered single days).

4. **Approval-screen request lists have no search/filter within the loaded set.** `ApprovalList` (staff) and `StudentApprovalList` both render a flat scrollable list of request cards with no in-list search — only the From/To date range filter applied before load narrows it. For a reporting authority working through a backlog of pending leave requests, a name/ID quick-filter (the same substring-search pattern `SearchableSelect`/`CheckListSelect` already use) would help.

5. **Free-text comma-separated roll numbers are the only "bulk mark" mechanism for daily/period attendance.** Student Daily Attendance and PG/Internship Manual Attendance both rely on typing roll numbers into a plain `<textarea>` to mark absentees. There's no roster checklist (photo + name + toggle), so marking attendance means the class in-charge must already know/transcribe roll numbers correctly — a single typo silently misrecords a real student with no inline validation against the actual roster.

6. **No drag-reorder anywhere in the module**, though `useDragReorder` exists in the codebase (per the README's control table) — not directly relevant here since nothing in Attendance needs manual ordering, but worth noting it wasn't reached for on the Working Day Setup's per-day list.

## 4. User-experience suggestions

- **Roster-grid attendance entry instead of free-text roll lists** (Student Daily Attendance, PG/Internship Manual Attendance). Replace the comma-separated `<textarea>` with a checklist of the actual enrolled roster (register no + name), defaulting to "present," so marking absentees is a click instead of typed digits. This directly removes the single biggest correctness risk in the module — a transposed digit in a textarea currently marks the wrong student absent with zero feedback.
- **Bulk mark-present/absent for a whole class in one click.** On the roster-grid above, add a header-row "Mark all present" / "Mark all absent" toggle (mirroring the `Paid` select-all checkbox pattern already used in Fee Collection's line-item table) — most days the whole class is present except for a handful, so starting from "all present, tap the exceptions" is the common case, not "start from nothing."
- **Autosave for the daily attendance grid.** Given periods can be 6-8 per day per section and the office worker may be interrupted mid-entry, a debounced autosave (or at minimum a "you have unsaved changes" guard on navigation) would prevent losing a half-filled sheet — right now `Save Attendance` is the only persistence point and there's no warning before navigating away.
- **Undo for accidental marks.** Since `saveStudentDailyAttendance`/`savePeriodAttendance` overwrite the day's entries, a brief "Attendance saved — Undo" toast (holding the previous entries client-side for ~10s) would cover the "clicked Save before double-checking" case without needing a server-side history feature.
- **Keyboard-driven roll-call entry (Tab/Enter to move fast through a roster).** If the roster-grid suggestion above ships, make it keyboard-navigable: arrow keys or Tab move between rows, Space/Enter toggles present/absent — this matters most for large UG sections (60+ students) where a mouse-only checklist is still slow.
- **A calendar heatmap view for attendance patterns.** Staff Attendance Calendar already renders a raw HTML month grid with X/present, A/absent, L/leave glyphs — a lightweight color-intensity heatmap (already half-built conceptually, since the data is a day-by-day status) would make patterns (e.g. someone always absent on Mondays) visible at a glance instead of requiring the reader to scan every cell.
- **Search box on approval request lists.** Add a name/ID filter above `ApprovalList`/`StudentApprovalList`'s left-hand card list (same substring pattern as `SearchableSelect`) so a reporting authority working through 30+ pending leave requests can jump straight to a specific staff/student instead of scrolling.
- **Select-all/clear on the Staff Attendance Report category pills.** Even a simple "Select all" link above the pill row (matching `ChipMultiSelect`'s toolbar) removes repetitive clicking when the common case is "run the report for every category."
- **Bulk holiday-range marking on Working Day Setup.** A small "select date range → set event type" control above the day table would turn a 7-click chore into one action for the common case of marking a multi-day festival/exam break.
- **Better empty/guidance state on Student Daily Attendance's blocked-date cases.** The screen already surfaces specific reasons (not-in-calendar, holiday, future date) and a list of recent holiday dates — a small win would be rendering those holiday dates as clickable date-shortcuts instead of plain text, so the office worker can jump straight to a valid date instead of manually re-picking.
- **Progress feedback pattern from Student Attendance Report applied to other heavy screens.** The 2-phase "processed/total students" progress banner on `/attendance/students/report` is the best-in-module feedback pattern; `daily-attendance`, `attendance-report`, `yearly-report`, and `att-chart*` on the staff side currently only show a generic "Generating… this can take 1-2 minutes" banner (per the busy-copy table in the user-stories doc) with no completion percentage, despite already carrying a 180s timeout that implies they're the heaviest screens in the module.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Swap Staff Attendance Report's flat category-checkbox pills for `ChipMultiSelect` (component already exists, already used for the near-identical `attendance-report` filter on the same screen family).
- Swap Student Attendance Report's Course/Subject pill checkboxes for `ChipMultiSelect` in the same way.
- Add a "Select all" / "Clear" toolbar to the category pills if the full `ChipMultiSelect` swap is deferred — a smaller diff that gets 80% of the benefit.
- Add a name/ID search box above the approval-screen request lists (`ApprovalList`, `StudentApprovalList`).
- Add clickable date-shortcuts to the holiday-dates list already returned by the blocked-date error responses on Student Daily Attendance / PG-Intern Manual Attendance.

**Bigger investments (needs design/product buy-in first):**
- Replace the free-text roll-number `<textarea>` attendance entry with a real roster checklist grid (touches the save payload shape, the load response shape, and needs product sign-off on how partial/combined periods render in a grid).
- Consolidate `RosterCoursePicker` onto `CheckListSelect` — safe in isolation but touches every screen that imports it (PG/Internship holiday roster, PG att setup, PG/Internship punch reports), so needs a regression pass across all of them.
- Bulk-mark-present/absent and keyboard-driven entry depend on the roster-grid investment above landing first.
- Autosave/undo for the daily attendance grid needs a product decision on save granularity (autosave per period vs per sheet) and a small new endpoint or debounce strategy — not a pure frontend change.
- A calendar heatmap view is a genuinely new visualization component, not a control swap — worth scoping as its own small project once the roster-grid work is stable.

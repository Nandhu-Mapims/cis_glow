# Redesign checklist — visual/UX pass over every screen

> **Status: planning artifact, nothing here has been executed yet.** This is an inventory to
> review and reprioritize before any page redesign work starts. Do not treat "High priority" as
> "already scheduled" — it's a recommendation.

## What this is

A per-page survey of all ~311 `client/src/pages/**/*.jsx` files, so the redesign (layout, table
structure, UX, UI) can be planned and executed page-by-page instead of attempted as one
unbounded rewrite. Built by reading each file's structure — not by looking at it in a browser
(no browser/screenshot tool is available in this environment), so "Issues" describes what the
*code* suggests is wrong (raw Bootstrap-shaped markup, dense unstyled tables, bespoke one-off
layouts, missing empty/loading states), not a confirmed visual judgment. Treat this as a
starting map, not a verified defect list — worth a quick human eyeball pass per screen before
committing to a rewrite of it.

## Foundation already in place

- Bootstrap (CSS + JS) has been fully removed. A custom framework at
  `client/src/styles/base/` reimplements the same class vocabulary (`btn`, `row`/`col-md-*`,
  `form-control`, `card`, `table`, `dropdown`, `modal`, `pagination`, etc.) against this app's
  own design tokens, so every page still renders correctly today with zero markup changes.
- Tailwind v4 is installed and wired (`client/vite.config.js`, `client/src/styles/tailwind.css`),
  prefixed `tw:` (e.g. `tw:flex`, `tw:bg-primary`) specifically so it can coexist with the
  classes above during an incremental migration — the two frameworks use the same bare class
  names (`p-3`, `rounded`, `gap-2`, ...) for different values, so an unprefixed Tailwind install
  would have silently corrupted spacing on every not-yet-migrated page.
- Tailwind's theme (`@theme` block in `tailwind.css`) points at the same `--cis-*` custom
  properties the rest of the app uses, so `tw:bg-primary`/`tw:text-muted`/etc. stay correct
  when a user switches theme presets at runtime.

## Design system for the redesign

This is the part the survey above didn't cover: *what "modern" actually means* for this app,
concretely, so 311 pages converge on one visual language instead of 311 individual opinions.
It is not a new brand — `theme.css` and `hub.css` already shipped one ("Operations Assistant
style": college crimson `#a61a1a` + pale gold `#f5d15f`, warm cream shell, `DM Sans` body /
`Plus Jakarta Sans` display, 14–18px radii, soft multi-layer shadows) on `PageShell.jsx`,
`DashboardLayout`, `Dashboard.jsx`, and `Login.jsx`. Every pattern below is that identity
extended into tables, cards, forms, and filters — reusing the same `--cis-*` tokens (via
`tw:` classes) rather than introducing new colors, fonts, or radii. Deviating from it on one
page and not another is the thing that would make the app feel unfinished.

### The signature: the accent rule

The one motif already used on hubs (`.cis-hub-hero::before` — a 4px crimson→gold gradient bar
on the leading edge of the hero card) is this app's signature element. Reuse it, don't
reinvent a new one per screen:

- **Hero/summary panels** (dashboards, hub pages — already done): gradient bar on the left edge.
- **Data tables**: a 2px solid `tw:border-b-2 tw:border-primary` under the header row instead of
  a plain 1px `--cis-border` line — the table "opens" the same way a hero panel does.
- **Active/selected states** (selected tab, active sidebar item, focused wizard step): same
  crimson, never a generic blue — this app has exactly one accent-for-attention color and one
  accent-for-highlight color (gold), and mixing in a third (e.g. default browser blue focus
  rings, Bootstrap's `#0d6efd`) is the fastest way to make a page look unmigrated.

Spend novelty on layout and information density per screen type below — not on inventing new
color/type choices per page. That restraint is what makes 311 pages read as one product.

### Token cheat sheet (`tw:` → `--cis-*`)

| Role | Tailwind (`tw:` prefixed) | Use for |
|---|---|---|
| Brand action | `tw:bg-primary tw:text-white`, `tw:hover:bg-primary-hover` | Primary buttons, save/submit, active nav |
| Brand highlight | `tw:bg-accent-soft`, `tw:text-primary` | Selected rows, badges, hover backgrounds |
| Page canvas | `tw:bg-bg` (shell) / `tw:bg-surface` (cards) | Never pure white (`#fff` off-brand) or pure `bg-gray-50` — use these two only |
| Body text | `tw:text-ink` / `tw:text-muted` / `tw:text-subtle` | Primary / secondary / tertiary text — three steps, not five |
| Borders | `tw:border-border` / `tw:border-border-strong` | Default hairlines / emphasized dividers |
| Status | `tw:bg-danger-soft tw:text-danger`, `tw:bg-success-soft tw:text-success`, `tw:bg-warning-soft tw:text-warning`, `tw:bg-info-soft tw:text-info` | Pills, alerts, table status cells — **never** raw `red-500`/`green-500`/etc. |
| Radius | `tw:rounded-md` (14px, inputs/buttons) / `tw:rounded-card` (18px, cards) / `tw:rounded-sm` (8px, chips/badges) | Match `--cis-radius*` scale, not Tailwind's default scale |
| Elevation | `tw:shadow-sm` (resting card) / `tw:shadow-md` (hover/raised) / `tw:shadow-lg` (modal/popover) | Never `tw:shadow-2xl` — this app's shadows are soft, not dramatic |
| Display type | `tw:font-display tw:font-bold tw:tracking-tight` | Titles, hero numbers, section headings — body copy stays `font-sans` |
| Numeric data | `tw:tabular-nums` | Any column of amounts, roll numbers, dates, percentages — legacy tables misalign these constantly; this one line fixes it everywhere |

### Component patterns

Six shapes cover almost everything in the survey (data table, dense entry grid, filter form,
stat/hub card, modal, empty/loading/error state). Get these six right once as shared
components and most of the "High priority" bespoke pages in the survey drop a tier in effort.

**1. Data table (list/report screens — the single most common pattern in the survey)**

```
┌─────────────────────────────────────────────────────────┐
│ Reg. No   Name              Course        Status    ›   │  ← sticky header, border-b-2 primary
├─────────────────────────────────────────────────────────┤
│ 22UG104   K. Meenakshi      BDS · Reg.    ● Active       │  ← zebra row, tabular-nums on codes
│ 22UG105   S. Arvind         BDS · Reg.    ● Active       │
└─────────────────────────────────────────────────────────┘
  Showing 1–20 of 214              ‹ Prev  1 2 3 … 11  Next ›
```

- `tw:sticky tw:top-0 tw:bg-surface` header row, `tw:border-b-2 tw:border-primary` (the
  signature rule), uppercase 12px letter-spaced `tw:text-subtle` column labels.
- Row: `tw:odd:bg-bg` zebra + `tw:hover:bg-accent-soft`, never a full-saturation hover.
- Status/enum columns become pills (`tw:bg-success-soft tw:text-success tw:rounded-sm tw:px-2
  tw:py-0.5 tw:text-xs tw:font-medium`), not raw text — this alone fixes the "raw `Object.keys()`
  dynamic table" cross-cutting issue (pattern #5) once built as one `<DataTable>`/`<Pill>` pair.
- One shared pagination component (`Showing X–Y of N` + numbered pager) replacing the
  ~6 hand-rolled Prev/Next implementations found in the survey (pattern #9).
- Narrow viewport: collapse rows into stacked label/value cards below `tw:sm:` rather than
  horizontal-scrolling a 10+ column table — this is the fix for every "dense unstyled table,
  no responsive handling" entry above.

**2. Dense entry grid (mark entry, timetable, batch assignment — the "High priority" data-entry
screens: `MarkEntrySetup`, `TermExamSetup`, `ExamBatchSetup`, `PeriodSetupSetup`, `TtConfigSetup`)**

Same table shell as #1, plus:
- First column (roll no / day / row label) gets `tw:sticky tw:left-0 tw:bg-surface` so it stays
  visible while scrolling right through 10+ subject/period columns — the actual fix for "wide
  table, no responsive strategy," which reflow can't solve for a grid that's inherently a matrix.
- Focused cell: `tw:focus:ring-2 tw:focus:ring-accent` (gold, not primary — reserve crimson for
  actions/nav so the eye can tell "editable now" from "clickable elsewhere") plus a subtle
  `tw:focus:bg-accent-soft` on the cell.
- Column-group headers (e.g. subject name spanning 3 sub-columns for internal/viva/external
  marks) as a second sticky header row, not a wall of repeated labels.

**3. Filter/search bar** — every list, report, and setup screen opens with one. Standardize to:
a single `tw:rounded-card tw:bg-surface tw:shadow-sm tw:p-4` card, fields on one flex row that
wraps, primary "Search"/"Go" button right-aligned or full-width on mobile. Replace every
`<select multiple>` (pattern #7 — `AddressLabelPanel`, `CommitteeAccessSetup`, `DeptAuthSetup`,
`ParentMeetingSmsScreen`, `WebEventsScreen`, `AcademicYearsSetup`) with the existing
`ChipMultiSelect` component — it already exists and is already on-brand, it's just not applied
consistently. Segmented pill controls (`tw:rounded-full` toggle group, active = primary bg)
replace bare radio-button rows (FN/AN, Theory/Clinical, etc.).

**4. Cards** — three variants, all `tw:rounded-card tw:bg-surface tw:shadow-sm
tw:border tw:border-border`:
- *Hub tile* — already defined in `hub.css`/`PageShell.jsx`'s `HubCard`; don't rebuild it, reuse
  the component.
- *Stat tile* — icon-in-accent-soft-circle + `tw:font-display tw:text-2xl` number +
  `tw:text-xs tw:uppercase tw:tracking-wide tw:text-subtle` label, matching `.cis-hub-hero-stat`.
  Replaces every ad hoc dashboard stat card in exam/hostel/circular/library dashboards (all
  flagged in the survey as "cards feel copy-pasted, not module-specific" — fix is a shared
  `<StatTile icon label value tone />` component, tone drives the accent color per metric).
- *Section card* — a labeled `tw:border-b tw:border-border tw:pb-2 tw:mb-4` group header
  followed by a field grid, for breaking up the flat 30+ field forms flagged as high priority
  (`StudentProfile` edit tab, `StaffProfileSections`, `PrintSetupSetup`, admission forms).
  Group by what the *legacy PHP* already groups by (personal / contact / address / statutory)
  — don't invent new groupings that drift from the source of truth.

**5. Modal** — one modal for every destructive confirm, replacing the hand-rolled Bootstrap
modals and `window.confirm()` calls called out repeatedly in the survey (pattern #2): reuse
`fees/setup/ConfirmModal.jsx` everywhere, or promote it to `client/src/components/` if it's
going to be imported cross-module (it already is, awkwardly, from `library/setup/*`).

**6. Empty / loading / error state** — every list/report screen needs all three, styled once:
- *Loading*: skeleton rows matching the table shape (already exists in
  `academic/setup/curriculumReportUi.jsx` — extend that pattern app-wide instead of spinners).
- *Empty*: an icon + one sentence in the interface's voice stating what to do next ("No students
  match this filter — try a different course or year"), not a blank table.
- *Error*: what failed + a retry action, never a raw stack trace or axios error string.

### Rollout: redesign by page archetype, not by module

The 311-page survey above is organized by module because that's how the codebase is organized,
but almost every page is one of eight archetypes. Redesigning the archetype's shared shell/
component fixes every page that uses it in one pass — this is *why* "Suggested rollout order"
above leads with shared infrastructure. Concretely, in order:

1. **Build the six component patterns above** as real shared components
   (`client/src/components/DataTable.jsx`, `Pill.jsx`, `StatTile.jsx`, `Pagination.jsx`,
   extend existing `ChipMultiSelect`/`ConfirmModal`) before touching individual pages. Every
   later step consumes these instead of hand-rolling markup again.
2. **Hub pages** — already done (`ModuleHub`/`HubCard`); just confirm every module actually
   routes through it rather than a bespoke hub.
3. **List/search pages** (`StudentList`, `StaffList`, and similar) — swap in `DataTable` +
   `Pagination`; these are high-traffic and low-structural-risk (already on `ListSearchPage`).
4. **CRUD grid / master-list setup screens** (the majority of `Low`/`Medium` priority rows in
   the survey — fee/exam/settings master tables) — mechanical `DataTable` + `ConfirmModal`
   swap-in, highest page-count-per-hour of effort.
5. **Filter → report/print screens** — `DataTable` (on-screen only; print HTML stays frozen
   per "Explicitly out of scope" above) + shared empty/loading state.
6. **Dense entry grids** (`MarkEntrySetup`, `TermExamSetup`, `ExamBatchSetup`, timetable
   screens) — pattern #2 above; do these once the sticky-header/sticky-column table shell is
   proven on simpler tables.
7. **Profile / admission forms** (`StudentProfile`, `StaffProfile`, admission forms) — section
   cards (pattern #4) replacing flat field grids.
8. **Mega-file dispatchers** (`StudentAttScreenPage.jsx` and the other 2000+/900+/500+-line
   files) — split into per-screen files *while* applying the archetype patterns above; doing
   the split without the redesign, or the redesign without the split, means touching that code
   twice.

### Quality floor (apply to every page, no exceptions)

Responsive down to a phone width (the app is used on hostel/library kiosk-style devices, not
just office desktops); visible `tw:focus-visible` rings on every interactive element (existing
`--cis-focus-ring`/`--cis-focus-ring-primary` tokens, not the browser default); respect
`prefers-reduced-motion` on the hover/transition transforms already in `hub.css`; and — per
`CLAUDE.md` — the print artifact and the underlying save/load API contract never change as a
side effect of a visual pass.

## How to migrate a page (once this checklist is reviewed and a page is picked)

1. Open the matching legacy PHP file first (per `CLAUDE.md` — behavior parity still applies;
   this is a visual/structural redesign, not a behavior change).
2. Replace `row`/`col-*`/`btn`/`form-control`/etc. classes with real `tw:`-prefixed Tailwind
   utilities, restructuring layout/table/form markup as needed — this is where the actual
   design improvement happens, not a find-and-replace. Reach for the shared component patterns
   in "Design system for the redesign" above instead of hand-rolling table/card/filter markup
   again.
3. Leave data-fetching, save logic, and API contracts untouched unless the checklist entry
   says otherwise.
4. Rebuild (`npx vite build`) to confirm no errors, then ask for a visual spot-check (no
   browser tool here) before moving to the next page.

## Legend

- **Structure**: what the page is built from — data table, filter/search form, modal, print
  button, etc. — and whether it already sits on a shared component (`ModuleSetupFactory`,
  `SetupPageShell`, `createSetupApi`) that gives it consistent structure "for free," vs. a
  large bespoke one-off layout that needs individual attention.
- **Priority**: `High` (bespoke/messy + high daily use), `Medium`, `Low` (simple, already
  factory-based, or a rarely-used/print-parity screen — print output itself is explicitly
  **out of scope**, see below).

## Explicitly out of scope

- Anything rendered inside `printReportHtml`'s popup window (`client/src/utils/printReport.js`)
  or legacy print stylesheets (`att_card.css`, payroll report `*.css`, `examScheduleSetup.css`)
  — these must byte-match legacy paper output per `CLAUDE.md` and are already visually isolated
  from the app shell (separate `window.open` document). A page can still have its *on-screen*
  filter/preview UI redesigned; only the print artifact itself is frozen.
- The shared shell (`PageShell.jsx`, `DashboardLayout.jsx`, `Sidebar`/`TopNav`/`Header`,
  `Dashboard.jsx`, `Login.jsx`) — already redesigned in a prior pass (identity strip, signature
  register-stamp element, hub cards). Not re-surveyed here.

## Survey status

**All 7 of 7 module groups surveyed — full inventory below covers all ~311 pages.**

| Module group | Files | Status |
|---|---|---|
| exam, committee, certificate | 43 | ✅ surveyed below |
| hostel, settings, circular | 46 | ✅ surveyed below |
| payroll, kiosk, tv, naac | 44 | ✅ surveyed below |
| fees, elearning, sms | 43 | ✅ surveyed below |
| academic, adminOffice, portfolio | 45 | ✅ surveyed below |
| library, admin, reports, web | 47 | ✅ surveyed below |
| attendance, students, staff, dashboard (+ Dashboard.jsx/Login.jsx, already redesigned) | 43 | ✅ surveyed below |

---

## Surveyed


### exam

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| exam/ExamDashboard.jsx | Exam dashboard — summary widgets/tables (exam_dashboard equivalent) | Custom DashboardLayout page; server-rendered HTML blob injected via dangerouslySetInnerHTML; sessionStorage cache; print button | Whole body is opaque server HTML (not real React markup), so Tailwind can't restyle it directly — redesign needs server-side HTML/CSS changes too; caching logic adds complexity for a simple summary page | High |
| exam/ExamHub.jsx | Exam module landing hub (links to dashboard/setup/reports) | Uses shared `ModuleHub` from PageShell — consistent card-grid of links | Already consistent/shared component; only content (icons/copy) to touch | Low |
| exam/ExamReportsHub.jsx | Reports sub-hub (13 report links) | `ModuleHub` shared component | Same as ExamHub; low effort, low priority | Low |
| exam/ExamSetupHub.jsx | Setup sub-hub (17 setup links) | `ModuleHub` shared component | Same pattern; fine as-is | Low |
| exam/ExamSetupPage.jsx | Dispatcher — maps `:screen` param to one of 27 native components inside `SetupPageShell` | Thin routing/dispatch file, no own UI besides shell breadcrumbs | Not a screen itself; low priority for direct redesign, but shell here dictates layout consistency for all exam setup screens | Low |
| exam/ExamStudentStatement.jsx | Per-student CIA exam statement viewer | Custom DashboardLayout page; register-no search form; injects server HTML with a legacy `<form id="signupForm">` re-wired via DOM listener; print button | Legacy-form-in-innerHTML + manual JS event rewiring is fragile and hard to theme with Tailwind; mixed React/raw-HTML form pattern | Medium |
| exam/setup/AttendanceEntrySetup.jsx | Term attendance % entry per subject/student | Exam/Course selectors + paginated data-entry table, Go button, custom pagination text | Dense per-student/per-subject grid entry table, no responsive handling for many subject columns; text-only pagination info (no page-size control) | High |
| exam/setup/AttendanceReportSetup.jsx | Attendance report view/print | Selectors + `ReportPrintBar` + read-only wide table | Same wide-subject-column table problem as above; otherwise straightforward report screen | Medium |
| exam/setup/CampActivityAddSetup.jsx | Add exam camp/activity record | Bespoke form: text fields, checkbox group, dual file inputs (attachment + gallery), manual base64 file encode | Raw stacked bootstrap-row form with no visual grouping between core fields vs. media uploads; file-to-base64 client encoding is heavy but not a visual issue | Medium |
| exam/setup/CampActivityEditSetup.jsx | Edit/list camp activities (search, edit, gallery mgmt) | List+search, edit form reusing add-form fields, gallery grid, delete state | Combines list/search/edit/gallery in one component with no clear panel separation; largest of the camp-activity trio | High |
| exam/setup/CampActivityTypeSetup.jsx | CRUD for camp activity type master list | Editable table rows + "add new" row + delete confirm modal (inline, not shared ConfirmModal) | Small, functional CRUD table; modal is hand-rolled Bootstrap markup instead of shared `ConfirmModal` — minor inconsistency | Low |
| exam/setup/ExamAttendanceCertificateSetup.jsx | Attendance-certificate data/report by exam/course/subject | Cascading selectors + subject dropdown (color-highlighted options) + injected report HTML | Inline `style={background:'#9ABB44'}` hardcoded highlight color on `<option>` — will clash with theming/dark mode; otherwise simple filter+report pattern repeated across many exam screens | Medium |
| exam/setup/ExamBatchSetup.jsx | Exam batch allocation (course_id keys, per legacy `exam_batch.php`) | Course/year + year-radio selectors, batch-count input, large student-to-batch assignment table, print bar | Core high-traffic setup screen; big assignment table with per-row batch pickers — needs clear grouping/sticky header for usability at scale | High |
| exam/setup/ExamExaminersSetup.jsx | Examiner assignment by exam/course/subject | Cascading selectors, subject dropdown w/ hardcoded highlight color, editable examiner table, link-out to Examiner Setup when unconfigured | Same hardcoded inline highlight-color issue as attendance-certificate screen; otherwise consistent pattern | Medium |
| exam/setup/ExaminerSetupSetup.jsx | Configure examiner-to-batch mapping | Course/year selector, semester radios, batch checkbox matrix per row, validation banner | Batch-column checkbox matrix is dense and easy to misclick at scale; validation feedback is a plain string, not inline per-row | Medium |
| exam/setup/ExamNameSetup.jsx | CIA exam-name master (order/name/month) | Simple editable table + add row + `ConfirmModal`/`SetupAlerts` (shared) | Clean, small, already uses shared alert/modal helpers — low redesign need | Low |
| exam/setup/ExamNodueSetup.jsx | No-due clearance tracking by exam/course | Same pattern as AttendanceEntrySetup: selectors, paginated per-student/per-subject grid | Same dense grid/pagination concerns as attendance-entry; near-duplicate structure of that screen (redesign once, reuse) | High |
| exam/setup/ExamReportScreen.jsx | Shared generic "exam + course selector → Go → print/report HTML" screen used by 4 thin wrappers (term-report, term-statement, progress-card, report-analysis) | Reusable component: selectors + `ReportPrintBar` + raw HTML report injection | High-leverage shared file — redesigning it fixes 4 screens at once; report body itself is server HTML, so styling is limited without server changes | High |
| exam/setup/ExamScheduleSetup.jsx | Exam date/session scheduling per subject | Bespoke: custom FilterRow/SessionToggle components, own CSS file (`examScheduleSetup.css`), editable schedule table, delete modal | Most "designed" of the exam screens already (custom toggle component, dedicated CSS) — good template to model Tailwind redesign on, but still Bootstrap-flavored | Medium |
| exam/setup/ExamSelectors.jsx | Shared selector building blocks (ExamSelector, CourseSemesterSelector, CourseYearSelector, ExamSetupShell) used by ~20 exam screens | Small shared component library, not a screen itself | Extremely high leverage — redesigning these selectors in Tailwind cascades visual consistency across most of the exam module with minimal duplicated effort | High |
| exam/setup/ExamSmsSetup.jsx | Bulk SMS to exam-related recipients | Selectors + recipient count + batch-send loop with progress state | Sequential per-recipient send loop drives a live progress UI; UX-wise a plain "N of M sent" progress bar/list, no cancel affordance | Medium |
| exam/setup/GenericExamScreen.jsx | Fallback generic CRUD-ish screen for unmapped exam setup screens | Rarely-used fallback: filter form + summary cards + raw table | Rarely reached (only for future/unmapped screens); table/cards are generic and functional | Low |
| exam/setup/InvigilatorPrintSetup.jsx | Invigilator duty roster print | Exam selector + Theory/Clinical + FN/AN radios + print button building custom print HTML | Standard filter+print pattern; radio-based toggle UI duplicated ad hoc rather than reusing SessionToggle from ExamScheduleSetup | Low |
| exam/setup/MarkEntrySetup.jsx | Internal/viva/external mark entry per subject | Selectors, subject dropdown w/ hardcoded highlight color, per-student marks-entry table w/ live total calc | Core high-traffic data-entry screen; dense table with several numeric inputs per row, no sticky header/keyboard-nav affordance for large classes | High |
| exam/setup/MarkSheetReceivedSetup.jsx | Track received mark sheets | Selectors + checkbox filter group + wide report table (`fontSize: 11px` inline) | Inline hardcoded `fontSize: 11px` for density instead of a responsive/scalable table style — typical of legacy-parity screens needing a real redesign pass | Medium |
| exam/setup/MarkSheetSetup.jsx | Generate/print OMR mark sheets per schedule | Selectors + schedule table with per-row "Print" opening a new window | Simple, functional table-with-action-column; low complexity | Low |
| exam/setup/MarkSheetStatusSetup.jsx | Mark sheet generation status | Selectors + two checkbox-filter groups + summary counts + report table | Two parallel checkbox-filter groups stacked vertically — could be consolidated visually; otherwise standard report pattern | Medium |
| exam/setup/MarksUploadSetup.jsx | OMR scan upload (single-batch) | File input + per-file result alerts, base64 client encode | Small, functional; result feed as stacked alert boxes rather than a table — acceptable for low-frequency screen | Low |
| exam/setup/OmrConfigSetup.jsx | OMR layout margin/QR position config | Plain grid form (8 numeric px inputs), no live preview | Numeric layout-position inputs with no visual/preview aid — a diagram or live preview would help a lot in redesign, but screen is rarely used | Low |
| exam/setup/ProgressCardSetup.jsx | Progress card report (wrapper) | 3-line wrapper delegating to `ExamReportScreen` | Trivial; fixed by redesigning ExamReportScreen | Low |
| exam/setup/ReportAnalysisSetup.jsx | Pass/fail report analysis (wrapper) | 3-line wrapper delegating to `ExamReportScreen` | Trivial; fixed by redesigning ExamReportScreen | Low |
| exam/setup/ReportAnalysisV1Setup.jsx | Legacy-variant analysis report (pass %, toppers) | Selectors + `ReportPrintBar` + 3 separate result tables (subject pass%, overall pass%, toppers) | Three stacked tables of different shapes with no card/section separation — visual hierarchy needs work | Medium |
| exam/setup/SchedulePrintSetup.jsx | Printable exam schedule (Theory/Clinical) | Selector + radio toggle + print button + injected report HTML | Standard filter+print screen, low complexity, infrequently used | Low |
| exam/setup/SheetsStatusSetup.jsx | Term-sheet upload/verification status by date range | Date-range + batch-id filter form + grouped (by date) status table with HTML-injected status cell | `dangerouslySetInnerHTML` for a single status cell is a smell but low-impact; grouped table with subheader rows is reasonable already | Medium |
| exam/setup/SheetsUploadSetup.jsx | Term sheet upload (multi-file, progress) | File input w/ validation (type/size), progress bar, per-file result list | Functional multi-file upload with progress bar already present; mostly needs visual polish, not structural rework | Low |
| exam/setup/TermExamSetup.jsx | Course-wise term exam configuration (`term_exam_setup.php`, course_name keys) | Course/year select + large editable config table (11+ columns: sessions/dates/marks toggles) per exam row | Core high-traffic setup screen; very wide table (11+ columns of mixed input types: selects/checkboxes/dates) crammed together, no responsive strategy | High |
| exam/setup/TermReportSetup.jsx | Term report (wrapper) | 3-line wrapper delegating to `ExamReportScreen` | Trivial; fixed by redesigning ExamReportScreen | Low |
| exam/setup/TermStatementSetup.jsx | Result statement (wrapper) | 3-line wrapper delegating to `ExamReportScreen` | Trivial; fixed by redesigning ExamReportScreen | Low |

### committee

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| committee/CommitteeModule.jsx | Route wiring — builds Hub/SetupHub/SetupPage via `ModuleSetupFactory` + `createSetupApi` for ~26 committee screens | Thin config file (component map + factory calls), no own markup | Not a screen; factory means hub/list pages are already consistent — no direct redesign work here beyond factory itself | Low |
| committee/setup/CommitteeScreens.jsx | Single 2700-line file housing ~26 distinct committee/task screens (dashboard, add/edit committee, member mgmt, task allocation, budgets, timesheets, TV academic calendar/print, approvals, etc.) | Mixed bag: several small shared `RowSetupScreen`-based CRUD tables, several large bespoke screens (CommitteeEditScreen w/ RichText+file upload+modal, TaskAllocationScreen ~200 lines, TaskManageReportScreen ~220 lines incl. a modal report preview, TaskBudgetScreen ~210 lines, TvAcademicEventScreen ~370 lines calendar UI) | Single file mixes trivial CRUD tables with genuinely complex bespoke screens (calendar views, budget tables, hand-rolled confirm modals duplicated ~4x instead of shared `ConfirmModal`) — inconsistent visual language across the 26 screens since each was built ad hoc; TV academic calendar/print and task allocation/budget screens are the most complex and highest-traffic, worth splitting out and redesigning first | High |

### certificate

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| certificate/CertificateModule.jsx | Route wiring — builds Hub/SetupHub/SetupPage via `ModuleSetupFactory` for ~15 certificate screens | Thin config file, no own markup | Not a screen; same as committee module wiring | Low |
| certificate/setup/ApproveScreen.jsx | Approve/reject certificate/receipt requests | Filter card (search/date/status radios) + paginated results table + modal-driven approve/reject action | Reasonably well-organized already (card + table + pagination), but modal open/close state duplicates a pattern that could use the shared `ConfirmModal`; high daily-use screen (approvals) worth polishing first | High |
| certificate/setup/CertificateScreens.jsx | 874-line file housing ~14 certificate screens (category/template setup, receipt add/edit/report, cert/TC requests, TC generate, internship schedule/generate/photo upload, implant/laser cert) | Mix of small CRUD-row forms and a few heavier screens: TcDetailsScreen (~150 lines, paginated grouped-course table), InternshipGenerateScreen (~130 lines), InternshipPhotoScreen (~250 lines, multi-file photo upload w/ per-file results) | Same "one file, many unrelated screens with inconsistent structure" issue as CommitteeScreens.jsx but smaller; InternshipPhotoScreen and TcDetailsScreen are the most complex/high-traffic and worth prioritizing; delete-confirm modal here is also hand-rolled instead of shared `ConfirmModal` | Medium |

### hostel

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| hostel/HostelHub.jsx | Module hub landing page | Built on `ModuleHub` factory; static link list | None; consistent factory pattern | Low |
| hostel/HostelSetupPage.jsx | Screen dispatcher/router for hostel setup screens | Built on `SetupPageShell`; thin dispatcher, no bespoke UI | None | Low |
| hostel/setup/AttendanceReportSetup.jsx | Hostel gate attendance report | Bespoke; date filter + generic dynamic table (columns from `Object.keys`) | Raw object-key column headers, no formatting; no pagination for potentially large log | Medium |
| hostel/setup/AttSetupSetup.jsx | Hostel in/out time window config | Bespoke, small single form, no table | Minimal single-purpose form; fine as-is | Low |
| hostel/setup/BlockSetupSetup.jsx | Hostel/quarters block master (add/edit/delete) | Bespoke editable table with inline radio groups per row + delete ConfirmModal | Radio buttons crammed into table cells are visually noisy; no search for long block lists | Medium |
| hostel/setup/DashboardSetup.jsx | Hostel dashboard (stats, dept breakdown, recent) | Bespoke; date filter, stat cards, small breakdown grid, recent table | Dept-count cards feel copy-pasted from circular dashboard, not hostel-specific (e.g. occupancy) | Medium |
| hostel/setup/PassApprovalSetup.jsx | Approve/reject hostel pass requests | Bespoke; plain bordered table, approve/reject buttons | No filter/search/pagination for pending list; bare-bones table styling | Medium |
| hostel/setup/PassReportSetup.jsx | Hostel pass request report | Bespoke; date filter + generic dynamic table | Same raw-column/no-pagination anti-pattern as AttendanceReportSetup | Medium |
| hostel/setup/RoomRentalSetupSetup.jsx | Room rental amount config by block | Bespoke; block select + editable amount table | Reasonably clean/focused; no currency formatting on input | Low |
| hostel/setup/RoomSetupAddSetup.jsx | Add hostel/quarters room | Bespoke simple form; exports shared `BlockSelect` used by 4+ other files | Plain but fine; shared `BlockSelect` styling change ripples across module | Low |
| hostel/setup/RoomSetupEditSetup.jsx | Search/edit/delete rooms | Bespoke, largest file in module; list/edit dual-mode with search, pagination, full edit form, delete modal all in one component | Single component juggling two modes with duplicated field markup; plain `table-hover`, no mobile stacking for many columns | High |
| hostel/setup/StaffRentalSetup.jsx | Staff quarters rental assignment | Bespoke two-column layout: filter sidebar + staff list + repeating "stay" blocks form; most complex file in module | Color-coded staff-list buttons with non-obvious meaning; repeating stay blocks lack clear add/remove affordance | High |
| hostel/setup/StudentHostelSetup.jsx | Allocate student to hostel room(s) | Bespoke; register-no lookup + repeating stay rows | No UI to add a new stay row (only maps existing); inputs use placeholders instead of labels | High |
| hostel/setup/TransportAddSetup.jsx | Add school transport vehicle (bus/van/auto) | Bespoke form; radio group, photo upload, checkbox grid of stops | Flat checkbox grid for stops won't scale with many stops; otherwise organized | Medium |
| hostel/setup/TransportEditSetup.jsx | Search/edit/delete transport vehicles | Bespoke, same list/edit dual-mode as RoomSetupEditSetup plus photo upload + stop checkboxes + delete modal | Large dual-mode component (135+ lines); markup duplicated from TransportAddSetup instead of shared | High |
| hostel/setup/TransportFeeConfigSetup.jsx | Transport fee per stopping point | Bespoke; paginated editable amount table | Already paginated/clean; amount input has no currency affordance | Low |
| hostel/setup/TransportStoppingSetup.jsx | Bus stop master list | Bespoke editable table + add row + delete modal | Consistent with other simple CRUD-grid screens; fine as-is | Low |

### settings

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| settings/SettingsHub.jsx | Module hub (native + academic settings links) | Built on `ModuleHub` factory | None | Low |
| settings/SettingsSetupHub.jsx | Secondary "all setup screens" hub | `ModuleHub` factory, near-duplicate of SettingsHub | Redundant with SettingsHub — two overlapping hub screens, candidate for consolidation | Low |
| settings/SettingsSetupPage.jsx | Screen dispatcher for settings setup screens | `SetupPageShell` dispatcher; pulls in borrowed `AdminSetupPage.css` and admin-specific class names | Relies on another module's legacy CSS rather than its own styling foundation | Medium |
| settings/setup/ApprovalSetup.jsx | Enable/disable approval requirement per page type | Bespoke; simple checkbox table | Minimal, fine as-is | Low |
| settings/setup/BudgetSmsSetup.jsx | Budget SMS notification recipients config | Bespoke; title/enable/mobile table | Clean simple grid | Low |
| settings/setup/CollegeSmsSetup.jsx | College-wide SMS toggles grouped by category | Bespoke; grouped checkboxes with group "select all" | No table, reasonably clear grouping already | Low |
| settings/setup/DesignationSetup.jsx | Department designation master | Bespoke; department select + editable table + delete modal | Inline "add new department" fields only appear conditionally, easy to miss; repeats the CRUD-grid pattern seen across many settings screens | Medium |
| settings/setup/DOrderSetup.jsx | Reorder designations (display order) | Bespoke; simple 2-column table (read-only name + order input) | Minimal, fine as-is | Low |
| settings/setup/HospitalSmsSetup.jsx | Hospital SMS notification recipients config | Bespoke, identical pattern to BudgetSmsSetup | Near-duplicate of BudgetSmsSetup — good candidate to merge into a shared component | Low |
| settings/setup/LessonPlanSetup.jsx | Lesson plan type master + submission day-limit config | Bespoke; one category dropdown switches between two unrelated sub-screens (grid CRUD vs single value edit) + delete modal | Two very different concerns crammed behind one entry dropdown — confusing, worth splitting | Medium |
| settings/setup/PayrollEmailerSetup.jsx | Payroll cron email job + recipient contacts | Bespoke; cron type select + settings row + contacts grid + delete modal | Cron-day picker semantics unexplained in UI; standard grid pattern otherwise | Medium |
| settings/setup/PrintSetupSetup.jsx | Print/report page header-footer template config (drives print layout app-wide) | Bespoke, most field-dense settings screen; flat 20+ field form (text, radios, checkboxes, 3 repeated signatory-role blocks), no sectioning | Raw form dump covering ~5 distinct concerns (titles, pagination, dimensions, toggles, signatories) with no visual grouping; high blast-radius since it configures print sitewide | High |
| settings/setup/PrintStyleSetup.jsx | Raw CSS editor for salary.css print stylesheet | Bespoke; single large plain textarea | No syntax highlighting/validation — easy to break print styles; low traffic screen | Medium |
| settings/setup/SignatureSetup.jsx | Signature block master per category | Bespoke; category select + editable table + delete modal | Existing signature file shown as plain filename text, no thumbnail preview or re-upload control despite being a signature/file screen | Medium |
| settings/setup/SmsCronSetup.jsx | General SMS cron job + recipient contacts | Bespoke; nearly identical structure to PayrollEmailerSetup | Substantial duplicate of PayrollEmailerSetup — consolidate into shared "cron + contacts" component | Medium |
| settings/setup/StaffEduMasterSetup.jsx | Staff education qualification master (cascading degree/major) | Bespoke; two cascading selects + editable grid + delete modal | Standard CRUD-grid, consistent with siblings | Low |
| settings/setup/StaffMasterSetup.jsx | Staff category/subcategory master list | Bespoke; grouped-optgroup select + editable grid + delete modal | Same CRUD-grid duplication as DesignationSetup/StaffEduMasterSetup — prime candidate for a shared "master list editor" component | Low |

### circular

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| circular/CircularHub.jsx | Module hub landing page | Built on `ModuleHub` factory; static link list | None | Low |
| circular/CircularSetupPage.jsx | Screen dispatcher/router for circular setup screens | Built on `SetupPageShell`; thin dispatcher | None | Low |
| circular/setup/AddSetup.jsx | Add Circular form | Bespoke one-off form; file upload, no table | All fields squeezed on one dense row; plain textarea for description despite circulars typically needing rich formatting | Medium |
| circular/setup/ApproveSetup.jsx | Approve/reject pending circulars | Bespoke; plain bordered table, approve/reject buttons | No pagination/filter for pending list; minimal visual hierarchy | Medium |
| circular/setup/CircularPrintSetup.jsx | Shared approved-circular print/preview (backs print-student/staff/department routes) | Bespoke; date filter + table + inline expand-to-preview row + print button; `dangerouslySetInnerHTML` | Expand-in-place preview per row is clunky vs. a modal/side panel; manual string truncation for description column; shared by 3 routes so a redesign here fixes 3 screens at once | Medium |
| circular/setup/DashboardSetup.jsx | Circular dashboard (stats, dept breakdown, recent) | Bespoke; date filter, stat cards, small breakdown grid, recent table | Dept-count cards cramped into `col-md-2`; otherwise reasonable | Low |
| circular/setup/EditSetup.jsx | Search/edit/delete circular | Bespoke; search box + list-group results + inline edit form with delete | No pagination on search results; list+form combined with implicit state transitions, not very discoverable | Medium |
| circular/setup/PrintDepartmentSetup.jsx | Print approved department circulars | Trivial re-export of CircularPrintSetup, no own UI | N/A — fixing CircularPrintSetup covers this | Low |
| circular/setup/PrintStaffSetup.jsx | Print approved staff circulars | Trivial re-export of CircularPrintSetup | N/A | Low |
| circular/setup/PrintStudentSetup.jsx | Print approved student circulars | Trivial re-export of CircularPrintSetup | N/A | Low |
| circular/setup/ReportSetup.jsx | Circular listing report with date filters | Bespoke; date filter + generic dynamic table (columns from `Object.keys`) | Raw object-key headers, no column-specific formatting/styling; easily breaks visual polish | Medium |
| circular/setup/SetupSetup.jsx | Circular "copy-to"/signature recipients setup | Bespoke; category select + editable table rows + add-row button | Add-only grid, no visible delete-row action (inconsistent with sibling grids elsewhere in app) | Low |

### fees

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| fees/FeeHub.jsx | Fees module hub landing page | ModuleHub factory | Already on shared factory — consistent, low priority | Low |
| fees/FeeSetupHub.jsx | Fee setup sub-hub | ModuleHub factory | Already on shared factory | Low |
| fees/FeeSetupPage.jsx | Dispatcher shell that mounts one of 8 setup components by `:screen` param | Thin dispatcher + FeePageShell + card wrapper | Just a switch/dispatcher; no issues itself | Low |
| fees/FeeCollection.jsx | Fee Collection screen wrapper | Thin wrapper around FeeCollectionPanel + FeePageShell | Trivial, fine | Low |
| fees/FeeCollectionPanel.jsx (526 lines) | Core daily fee-collection workspace: search student, tabbed fee-type sheet, editable pay amounts, generate slip/receipt | Bespoke: search form, hero card, nav-tabs, dense editable `<table>` with per-row checkbox+input, totals footer, receipt HTML injection | Dense multi-column editable table crammed with checkboxes/inputs/badges; tab+table+hero+receipt all in one 500-line component with no clear visual hierarchy; heaviest daily-use screen in the module | High |
| fees/FeeCollectionReport.jsx | Collection report by date/account/mode | Filter form (card) + dangerouslySetInnerHTML report + skeleton loader | Straightforward filter→report pattern, reasonably clean | Low |
| fees/FeeDashboard.jsx | Fees dashboard (KPIs, course summary, legacy widget) | Filter form + progressively-loaded raw legacy HTML injected via `dangerouslySetInnerHTML`, global `window.callFeeReport` hooks, sessionStorage cache | Legacy-HTML-injection + global `window` functions is fragile/hard to restyle with Tailwind; multi-phase loading logic adds complexity; daily-use landing screen | High |
| fees/FeeDeleteHub.jsx | Receipt-delete workflow hub | ModuleHub factory | Already on shared factory | Low |
| fees/FeeDeleteReport.jsx | Report of deleted receipts by date range | Filter form + dangerouslySetInnerHTML report | Simple, low-traffic report screen | Low |
| fees/FeeDeleteApprove.jsx | Approve/reject pending receipt-delete requests | Two-column: list-group queue + detail card + confirm via `window.confirm` | `window.confirm` instead of styled modal; otherwise clean two-pane layout | Medium |
| fees/FeeDeleteRequest.jsx | Submit a receipt-delete request | Lookup form + preview card + small history table | Clean, low complexity | Low |
| fees/feeDeleteUi.jsx | Status badge helper (6 lines) | Tiny presentational component | None — trivial | Low |
| fees/FeePageShell.jsx | Shared layout/breadcrumb/back-button helpers for all fee screens | Shared shell component | Good — this is the thing giving fees pages consistency; itself fine | Low |
| fees/ReceiptDetailCard.jsx | Read-only receipt detail table | Simple `<table>` of key/value rows | Fine as-is | Low |
| fees/FeeMultiDropdown.jsx | Custom multi-select dropdown w/ grouping, used across fee screens | Bespoke checkbox-dropdown with manual viewport positioning logic | Hand-rolled positioning/portal logic (getBoundingClientRect, scroll listeners) — brittle and worth replacing with a standard Tailwind-based combobox; but it's a shared utility, not a page | Medium |
| fees/FeePendingLetter.jsx | Generate printable fee-reminder letters by class | Filter (multi-dropdown) + generate + printable letter HTML preview | Clean, single-purpose, decent empty/loading states | Low |
| fees/FeePendingSlips.jsx | List/browse fee slips awaiting approval, links to approve screen | Search form + sortable card grid (no pagination) | Card-grid instead of table is fine visually but sort-only (no pagination) could be an issue at scale; feeds directly into daily approval workflow | Medium |
| fees/FeeSlipApprove.jsx | Approve a single pending fee slip → posts to student_fee | Hero card + editable line table + payment-mode fields + save/print | Core daily approval step; combines table+payment form+receipt print in one screen without strong sectioning | High |
| fees/FeeApprovedSlips.jsx | Browse/search/reprint/delete already-approved slips | Search form + card grid + real pagination (Previous/Next) | Reasonably organized; delete uses `window.confirm` rather than styled modal | Medium |
| fees/FeePendingSms.jsx | Generate & send pending-fee SMS reminders by class | Multi-dropdown filter + results table + progress bar + confirm modal | Home-rolled modal (raw Bootstrap markup) instead of shared ConfirmModal; otherwise fine | Medium |
| fees/FeeAcmecConfigPage.jsx (260 lines) | Per-student ACMEC/scholarship/DME flag configuration | 3-column bespoke layout: search sidebar + big multi-section form (radios/checkboxes/inputs) | Sidebar student list is plain buttons (no pagination/scroll handling for large lists); dense form with checkbox-triggers-conditional-fields pattern repeated 3x | Medium |
| fees/StudentFeeHistory.jsx | Search + view/reprint a student's full fee payment history | Search form + hero + repeated receipt cards each containing a line-item table | Clean, understandable, decent empty state | Low |

### fees/setup

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| fees/setup/ConfirmModal.jsx | Shared delete-confirmation modal used across setup screens | Small reusable modal | Fine — shared utility | Low |
| fees/setup/SetupAlerts.jsx | Re-export shim (`export { default } from '../../../components/SetupAlerts'`) | 1-line shim | None | Low |
| fees/setup/FeeTypeSetup.jsx | CRUD grid for fee type codes | Editable `<table>` rows + add row + ConfirmModal delete | Standard, low-risk CRUD table pattern | Low |
| fees/setup/FeeBankSetup.jsx | CRUD grid for bank/account numbers per fee | Editable `<table>` (7 cols) + add row + ConfirmModal | Same CRUD-table pattern, wide table could use responsive treatment | Low |
| fees/setup/FeeLabelSetup.jsx | CRUD grid for fee labels/short-names + scholarship/valid flags | Editable `<table>` w/ checkboxes + ConfirmModal | Standard CRUD table | Low |
| fees/setup/FeeFineSetup.jsx | Configure due-date/fine-amount per fee-type per course/year | Filter form (year/type radios) + grouped/sectioned editable table | Reasonably organized with section headers; fine | Medium |
| fees/setup/FeeScholarshipSetup.jsx | Configure scholarship amounts for students in a course/year/batch | Course+year select/radio filter + editable amount table | Clean filter→table→save pattern | Medium |
| fees/setup/FeeAcmecScholarshipSetup.jsx | Configure ACMEC scholarship amounts per student | Same filter→table pattern as FeeScholarshipSetup (near-duplicate) | Duplicated logic/markup with FeeScholarshipSetup/FeeDmeSetup — three near-identical screens that could share a component | Medium |
| fees/setup/FeeDmeSetup.jsx | Configure DME receipt approved-amounts per student | Course filter + read-only+editable table | Same duplication concern as above | Medium |
| fees/setup/FeeNameSetup.jsx (360 lines) | Core fee-structure builder: define fee name/type/bank/amount per course/batch/year with many dropdowns per row | Tabbed (by year) 12-column dense editable table combining selects, multi-dropdowns, checkboxes, locked-row states | Very dense 12-column row editor mixing 5+ input types per row; "locked" vs unlocked row states add visual complexity; hardest-to-scan setup screen in fees | High |

### elearning

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| elearning/ElearningModule.jsx | Module dispatcher: hub, setup hub, setup page, dashboard export | ModuleSetupFactory (createModuleHub/createModuleSetupHub/createModuleSetupPage) | Already on shared factory — consistent, low priority | Low |
| elearning/setup/ElearningScreens.jsx | 5 screens in one file: dashboard, slot-time setup, elearn report, subject-test entry, subject-test report | Mix of small bespoke forms/tables per screen; dashboard uses stat-tile cards + table; setup uses raw DOM `document.getElementById` for time inputs instead of React state | `ElearnSetupScreen` reads input values via `document.getElementById` instead of controlled state — anti-pattern or at least inconsistent with rest of app; module has low daily traffic | Medium |

### sms

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| sms/SmsModule.jsx | Module dispatcher: hub, setup hub, setup page, screen-to-component map | ModuleSetupFactory + component map wiring SmsSendScreen variants | Already on shared factory for hub/page chrome; fine | Low |
| sms/setup/SmsSendScreen.jsx (821 lines) | Send SMS to students / staff / groups / custom groups — the main "send" workflow for 3 of the SMS hub's screens | Two large near-duplicate bespoke flows (`GroupSmsFlow` ~350 lines, `StudentSmsFlow` ~360 lines) each with: step wizard (1-2-3), search/filter, checkbox list, recipient table, raw-mobile textarea toggle, template picker, confirm-then-send double-submit, char counter | Largest, most complex file in all 3 modules; `GroupSmsFlow` and `StudentSmsFlow` are ~80% duplicated logic (selection, recipient parsing, confirm-send, template apply) that should be unified; used for student/staff/group SMS which is a high-traffic daily flow | High |
| sms/setup/ParentMeetingSmsScreen.jsx | Send parent-meeting SMS notices by class | Multi-select class list + form fields + preview table (first 50) + send | Reasonably clean, single-purpose; native `<select multiple>` is dated UX vs the FeeMultiDropdown pattern used elsewhere | Medium |
| sms/setup/SmsHistoryScreen.jsx | Browse sent-SMS log with filters | Sidebar filter card + results table | Simple, clean read-only report screen | Low |
| sms/setup/SmsTemplateScreen.jsx | Combined add+list+delete template screen | Form + table side-by-side | Unreferenced anywhere in the app (SmsModule.jsx wires `SmsTemplateAddScreen`/`SmsTemplateEditScreen` instead) — appears to be dead/orphaned code, candidate for removal rather than redesign | Low |
| sms/setup/SmsTemplateAddScreen.jsx | Add a new SMS template | Simple form | Minimal, fine | Low |
| sms/setup/SmsTemplateEditScreen.jsx | Search/list/edit/delete SMS templates | Search form + CRUD table + inline edit form swap + pagination | Standard CRUD-table pattern, reasonably clean | Low |
| sms/setup/SmsGroupAddScreen.jsx | Add a new SMS group (title + mobile list) | Simple form | Minimal, fine | Low |
| sms/setup/SmsGroupEditScreen.jsx | Search/list/edit/delete SMS groups | Search form + CRUD table + inline edit form swap | Standard CRUD-table pattern, no pagination controls shown (unlike the near-identical SmsTemplateEditScreen) — minor inconsistency between two very similar screens | Low |

### payroll

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| payroll/PayrollHub.jsx | Payroll module landing hub | ModuleHub shared shell | Already on shared ModuleHub — consistent, low effort | Low |
| payroll/PayrollSetupHub.jsx | Payroll setup landing hub (17 setup screen links) | ModuleHub shared shell | Consistent; low priority | Low |
| payroll/StipendHub.jsx | Stipend payroll landing hub | ModuleHub shared shell | Consistent; low priority | Low |
| payroll/PayrollReportLoading.jsx | Shared helper module (not a screen) — loading overlay, busy banner, generate button, report-results panel used by ~9 report pages | Pure helper/component library | High leverage — redesigning it once cascades to ~9 report pages | Medium |
| payroll/GeneratePayroll.jsx | Batch generate payroll from attendance (step-by-step per-staff AJAX loop) | Filter form + progress bar + live-built raw-DOM table (rows injected via insertAdjacentHTML) | Progress/table built by direct DOM manipulation rather than React state — brittle and unstyled; dense 13-column table, no responsive handling | High |
| payroll/StipendGeneratePayroll.jsx | Stipend equivalent of GeneratePayroll, resumable step generation | Same DOM-injection pattern plus resume/refresh state, custom CSS file | Same raw-DOM row injection issue; large 350-line bespoke file mixing generation orchestration and layout | High |
| payroll/PayrollLegacyReportPage.jsx | Reusable wrapper injecting raw legacy PHP-bridge HTML/script/styles for a report | Card + dangerouslySetInnerHTML, re-executes injected `<script>`, rebinds legacy `#signupForm` submit | Renders unstyled/legacy-styled markup directly; running injected inline scripts is a code-smell/security surface | High |
| payroll/PayrollReportPages.jsx | Generic filter+report component (`PayrollFilterReport`) reused for Monthly/Tax Report via props | Filter card + PayrollReportLoading panel injecting `reportHtml` | Reasonable shared pattern; report body is raw injected HTML | Medium |
| payroll/PayrollConsolidatedReport.jsx | Multi-month consolidated payroll report | Splits injected reportHtml into header/table/signature via regex string slicing | Regex-based HTML slicing to split report sections is fragile | Medium |
| payroll/PayrollIndividualBundle.jsx | Individual payroll DB + salary statement bundle | PayrollReportLoading pattern | Consistent pattern, print-parity | Low/Medium |
| payroll/PayrollIndividualReport.jsx | Individual payslip report with bank/PF/ESI export | PayrollReportLoading pattern + export filters | More filter fields than most siblings; still consistent | Medium |
| payroll/PayrollGroupReport.jsx | Multi-month group payroll report | PayrollReportLoading pattern | Consistent, low complexity | Low/Medium |
| payroll/PayrollDashboard.jsx | Monthly payroll summary dashboard | Month select + injected reportHtml card | Simple, clean; only issue is raw injected HTML | Low |
| payroll/PayrollSetupPage.jsx | Setup dispatcher for 17 payroll setup screens | SetupPageShell + component map by `:screen` | Good shared shell pattern | Low |
| payroll/StipendSetupPage.jsx | Setup dispatcher for stipend amount/deduction/close screens | SetupPageShell, 2 of 3 forms inlined rather than extracted | Inline forms duplicated instead of extracted components | Medium |
| payroll/SalaryStatement.jsx | Department salary statement report | PayrollReportLoading pattern | Consistent, print-parity | Low/Medium |
| payroll/SalarySummary.jsx | Category comparison summary report | PayrollReportLoading pattern | Consistent; dual-category filter adds complexity | Medium |
| payroll/setup/HoldMonthPicker.jsx | Reusable chip multi-select for hold months | Thin wrapper over shared ChipMultiSelect | Already clean, reusable | Low |
| payroll/setup/IndividualSetup.jsx | Cover-page banner image upload grid + cron email recipient setup | Image upload table + separate cron form with dynamic rows, ConfirmModal | Two unrelated concerns in one file; manual FormData row collection, no drag/drop | Medium |
| payroll/setup/PayrollMonthlyGridSetup.jsx | Generic reusable grid for month+category deduction/LOP/TDS/cheque entry (used by 4 screens) | Filter form + editable table | Good reuse via prop flags — low priority | Low |
| payroll/setup/PayrollSetupScreens.jsx | Barrel: PayrollConfigSetup, PfEsiSetup, SalaryReportSetup, PayrollCloseSetup + advance/arrear/deposit re-exports | Inline forms with manual snake_case→camelCase field-name transforms | Hacky inline string-transform logic hurts readability; plain field-dump forms with no grouping | High |
| payroll/setup/SalaryAddSetup.jsx | Staff salary bands + bank details setup | 435-line: staff search, per-row policy-driven inputs, computed totals | Large bespoke layout; dense multi-column salary table with computed totals, no responsive handling | High |
| payroll/setup/SalaryAdvanceAddSetup.jsx | Add new salary advance/loan | HoldMonthPicker + SuretyStaffPicker + file upload | Reasonably scoped; file upload has no preview/drag-drop | Medium |
| payroll/setup/SalaryAdvanceCloseSetup.jsx | Search/edit/close existing salary advances | 457-line: search+table list + edit/close form with derived calculations | Large file combining list+search+detail-edit+close-calc in one; good candidate to split list vs. detail | High |
| payroll/setup/SalaryArrearAddSetup.jsx | Add arrear entry (with optional inline release) | Compact form, conditional release fields, file upload | Reasonably scoped | Medium |
| payroll/setup/SalaryArrearReleaseSetup.jsx | Search/edit arrear release schedule | Search+table list + edit form with file upload | Duplicated list/search/edit pattern instead of shared component | High |
| payroll/setup/SecurityDepositAddSetup.jsx | Add new security deposit | Near-identical to SalaryAdvanceAddSetup | Near-duplicate — good redesign opportunity to unify | Medium |
| payroll/setup/SecurityDepositCloseSetup.jsx | Search/edit/close security deposits | 460-line, near-identical to SalaryAdvanceCloseSetup | Same complexity/issues as SalaryAdvanceCloseSetup — extraction candidate | High |
| payroll/setup/StipendDeductionSetup.jsx | Monthly stipend deduction entry grid | Filter form + editable table | Compact, reasonably clean | Low/Medium |
| payroll/setup/SuretyStaffPicker.jsx | Reusable chip multi-select for surety staff | Thin wrapper over shared ChipMultiSelect | Already clean, reusable | Low |
| payroll/StipendAjaxReportPage.jsx | Reusable wrapper injecting raw legacy AJAX report HTML/scripts (stipend variant) | dangerouslySetInnerHTML + re-executed injected scripts + style injection | Same legacy-HTML-injection smell as PayrollLegacyReportPage | High |
| payroll/StipendAttReport.jsx | Stipend attendance statement/report with step-generation | 302-line: ChipMultiSelect filters + progress bar + DOM-ref table/signature injection | Same raw-DOM table injection pattern as GeneratePayroll; large bespoke file | High |
| payroll/StipendIndividualReport.jsx | Stipend individual report (month dashboard + statement bundle) | PayrollReportLoading pattern | Consistent shared pattern | Low/Medium |
| payroll/StipendIndividualPdfReport.jsx | Generate password-protected stipend payslip PDF bundle | Small form: month + copy type + long-timeout POST | Long PDF-generation wait has no progress indicator — could feel stuck | Medium |
| payroll/StipendNativeReportPage.jsx | Reusable generic report page (props-driven) for stipend bank/deduction report/statement | Filter form + injected reportHtml | Reasonable shared abstraction | Low |
| payroll/StipendPayrollReport.jsx | Single bank/deduction stipend report by category | PayrollReportLoading pattern + grouped select, custom CSS | Consistent; grouped dropdown adds complexity | Medium |
| payroll/StipendSalaryStatement.jsx | Department stipend statement | PayrollReportLoading pattern, custom CSS | Consistent, print-parity | Low/Medium |

### kiosk

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| kiosk/KioskModule.jsx | Kiosk module wiring: hub/setup-hub/setup-page + 15-screen component map | ModuleSetupFactory | Already on factory — consistent | Low |
| kiosk/setup/KioskScreens.jsx | 14 setup screens: machine access/room CRUD, PIN reset/password, slider/widget style, attendance menu/instruction/statement, announcements CRUD, receipt setup | 606-line bespoke file with many small self-contained screens; reused CategoryPicker helper | Single 600-line file bundling 14 unrelated screens is hard to redesign incrementally; MachineRoomScreen/ReceiptSetupScreen are denser bespoke layouts; MachinePasswordScreen uses `document.getElementById` instead of React state | High (file as a whole); individual screens vary Low–Medium |

### tv

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| tv/TvModule.jsx | TV module wiring: hub/setup-hub/setup-page + 10-screen component map | ModuleSetupFactory | Already on factory — consistent | Low |
| tv/TvDashboardPage.jsx | TV dashboard: widget/video/access counts + recent activity log | 3 stat cards + simple log table | Clean and simple; stat cards are plain but low risk | Low |
| tv/setup/TvScreens.jsx | 10 setup screens: slider widget/config/access, dashboard access, photo/video/API/YouTube galleries, live video, print-style (raw CSS textarea editor) | 559-line bespoke file; reusable ListEditor/GalleryEditor/UserPicker helpers, custom ColorInput, base64 file upload | TvSliderConfigScreen has an extremely dense multi-row-header table (12+ columns, color pickers, size inputs); TvPrintStyleScreen is a raw CSS textarea with no syntax highlighting; GalleryEditor mixes list+detail+file upload in one 90-line block | High (config/gallery screens); Low for simple ones |

### naac

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| naac/NaacModule.jsx | NAAC module wiring: hub/setup-hub/setup-page + 4-screen component map | ModuleSetupFactory | Already on factory — consistent | Low |
| naac/setup/NaacScreens.jsx | Qualitative/Quantitative metric CRUD (category+item grid with attachments), quan report, quan detailed report | Dynamic item-rows table (name/doc number/type radios/attachment), ConfirmModal, plus read-only report screens | NaacQuanScreen table is dense (8 columns incl. radio-button doc-type picker per row); NaacQuanDetailedReportScreen is a plain 9-column unstyled report table with no pagination | Medium |

### academic

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| academic/AcademicCourseEditPage.jsx | Route wrapper: opens course-edit via AcademicSetupPage with courseId param | 12-line pass-through, no own UI | None — trivial wrapper | Low |
| academic/AcademicCourseList.jsx | Course directory list/search | Bespoke layout: breadcrumb, search form, table, prev/next pagination; not on any shared factory | Duplicates CourseEditSetup's own search/list UI with a slightly different bespoke pattern — two list/pagination implementations for overlapping data; plain table, no empty-state styling | Medium |
| academic/AcademicHub.jsx | Academic module landing hub | Uses shared `ModuleHub` | Consistent, nothing bespoke | Low |
| academic/AcademicReportsHub.jsx | Reports sub-hub, auto-built from screen meta | Uses shared `ModuleHub` | Consistent, low priority | Low |
| academic/AcademicSetupHub.jsx | Setup sub-hub, auto-built from screen meta | Uses shared `ModuleHub` | Consistent, low priority | Low |
| academic/CurriculumHub.jsx | Curriculum sub-hub | Uses shared `ModuleHub` | Consistent, low priority | Low |
| academic/AcademicSetupPage.jsx | Dispatcher/router for all academic setup+report screens; also renders legacy-PHP-bridged HTML forms via dangerouslySetInnerHTML for screens without a native React component | `SetupPageShell`; wraps ~25 native components OR raw legacy HTML+script injection fallback | The legacy-HTML fallback path is a real redesign blocker — any screen still on this path looks like unstyled legacy PHP output, not React/Tailwind; worth auditing which screens still hit it | High |
| academic/setup/AcademicCalendarSetup.jsx | Academic calendar event editor by month | Table of days × event/course-type checkboxes/comment, grouped month select | Dense checkbox grid per row (course types), no responsive handling for many columns | Medium |
| academic/setup/AcademicYearsSetup.jsx | Global academic year + institution info setup | 3-card grid layout (YearSlotCard) + multi-select + institution form | Native multi-select for "Exam Academic Year" (hold-Ctrl UX) is dated, worth a chip/checkbox picker; otherwise well-organized into cards | Medium |
| academic/setup/AdmissionExamSetup.jsx | Configure admission exam components per course-year | Filter select + editable table with checkboxes per row, add-row, ConfirmModal delete | 6 boolean columns as separate checkbox cells — could be a compact toggle-group | Medium |
| academic/setup/BatchColorSetup.jsx | Assign background/foreground colors to student batches | Small color-hex-input table | Raw hex text inputs instead of a color picker — low-traffic, functional but dated | Low |
| academic/setup/BatchTimetableReportSetup.jsx | Print batch timetable report | Filter row + `ReportPrintBar` + raw HTML report injection | Simple, already lean | Low |
| academic/setup/CourseAddSetup.jsx | Add new course/degree form | Single flat form, ~10 fields, no table | Plain form-grid dump with no field grouping, but short and low-risk | Low |
| academic/setup/CourseEditSetup.jsx | Course search/list + edit/delete single course | Bespoke list+edit toggle, pagination, ConfirmModal | Overlaps with `AcademicCourseList.jsx` (two different list UIs for the same data) — worth consolidating | Medium |
| academic/setup/CurriculumReportScreen.jsx | Generic curriculum report renderer for ~6 report types via config-driven behavior | 482-line bespoke screen branching into ~6 different filter shapes via `config.type` switch | Largest/most complex file in academic — hard to reason about, high blast radius for a redesign; strong candidate to decompose per report-type | High |
| academic/setup/curriculumReportUi.jsx | Shared UI primitives for curriculum reports (GroupedSelect, SemesterPills, SegmentedControl, filter card, skeleton, empty state) | Pure component library, no page of its own | Not a screen — the design-system seam for curriculum reports; good place to inject Tailwind primitives once redesign starts | Low (infra) |
| academic/setup/FeedbackConfigSetup.jsx | Configure UG/PG feedback windows + subject/staff mapping | Feedback select → title/date-range form → per-subject staff-checkbox table | Per-subject staff checkboxes could get long/dense for big subject lists, no scroll containment | Medium |
| academic/setup/FeedbackTopicSetup.jsx | Manage feedback topic list per category | Shared curriculum UI + small editable table, add/delete | Clean, already using shared curriculum UI helpers | Low |
| academic/setup/InternshipScheduleSetup.jsx | Internship rotation schedule per course/batch | Filter card + editable schedule table | Straightforward CRUD table using shared curriculum UI | Low |
| academic/setup/MasterSetupSetup.jsx | Generic "master data" category editor | Category select + editable table w/ checkboxes, ConfirmModal delete | Same table-heavy CRUD pattern repeated across many academic screens — candidate for one shared "simple CRUD table" component | Medium |
| academic/setup/PeriodSetupSetup.jsx | Define daily period/time-slot structure per course | Complex bespoke grid: day toggles, period-count/break inputs, dynamic day×period grid with radio+2 time inputs per cell, live preview | Genuinely complex bespoke layout (like TtConfig screens) — dense per-cell mini-forms, no visual grouping cues between days | High |
| academic/setup/SubjectBatchSetup.jsx | Assign students to subject batches (checkbox matrix) | Course/year select → batch-count input → student × batch checkbox matrix table, custom print builder | Wide checkbox matrix (one column per batch) doesn't scale past a handful of batches | Medium |
| academic/setup/SubjectMasterSetup.jsx | Manage subject category master list | Category select + editable table, ConfirmModal delete | Near-duplicate of MasterSetupSetup.jsx pattern; low complexity | Low |
| academic/setup/SubjectReportSetup.jsx | Subject-wise timetable/exam report generator | Filter card + print bar + report HTML panel with skeleton/empty states | Well-structured, already uses shared curriculum UI and has loading/empty states | Low |
| academic/setup/SubjectScheduleSetup.jsx | Monthly subject teaching schedule | Course/subject/month filters + editable schedule table, custom print builder | Reasonably clean, standard table CRUD | Medium |
| academic/setup/SubjectSetupSetup.jsx | Master subject setup with nested timetable-rows and mark-rows per subject | 426-line bespoke: category/subtype/subject rows table + expandable `NestedTable` for tt-rows and mark-rows, ChipMultiSelect | Genuinely complex nested-table-in-table UI with nontrivial suffix-generation logic — strong redesign candidate given daily use | High |
| academic/setup/SubjectUnitSetup.jsx | Manage subject unit/chapter syllabus content per course | Dept→course→unit cascading selects, then chapter table with add/delete | 4-level cascading select chain with no visual "wizard" framing | Medium |
| academic/setup/TimetableReportSetup.jsx | Class timetable report by date | Date + type filter, `ReportPrintBar`, raw HTML injection | Simple, lean, fine as-is | Low |
| academic/setup/TtConfigSetup.jsx | Weekly timetable grid config (`timetable_tb`) — click a cell to open allocation editor | Custom grid table (day × period, colspan/rowspan cells), full-screen modal with dangerouslySetInnerHTML'd legacy allocation form inside | Complex bespoke grid+modal; modal renders raw legacy HTML form with manual serialization — heaviest interaction pattern in the module, top redesign target | High |
| academic/setup/TtConfigV3Setup.jsx | Same as TtConfigSetup but for newer `timetable_tb_new` table | Near-identical bespoke grid+modal structure, shared filter components only | Duplicates ~90% of TtConfigSetup.jsx logic — strong candidate to unify into one shared grid+modal component before/during redesign | High |

### adminOffice

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| adminOffice/AdminOfficeHub.jsx | Admin Office module landing hub | Uses shared `ModuleHub` | Consistent, low priority | Low |
| adminOffice/AdminOfficeSetupPage.jsx | Dispatcher for admin-office setup screens (activities, courier, incident) | Thin dispatch page + `SETUP_COMPONENTS` map, wraps each screen in one plain card | Reasonably consistent wrapper, not a true shared factory (each sub-screen hand-rolls its own list/edit toggle) | Low |
| adminOffice/setup/ActivitiesAddSetup.jsx | Add + edit student/staff activity/event records (exports edit variant too) | Bespoke form with dynamic prize/participant rows + name-lookup button; edit mode adds inline search/list table | Two responsibilities (add form + search/list/edit) crammed in one file; unstyled inline "Lookup" button-per-row pattern | Medium |
| adminOffice/setup/ActivitiesEditSetup.jsx | Re-export shim for the edit form defined in ActivitiesAddSetup | 3-line re-export | No UI of its own; signals the underlying file should probably be split | Low |
| adminOffice/setup/CourierAddSetup.jsx | Add courier (in/out mail) record | Thin wrapper form around shared `CourierFields` | Simple, low-risk | Low |
| adminOffice/setup/CourierEditSetup.jsx | Search/list + edit/delete courier records | Search form + table list, then edit form (reuses `CourierFields`) | Same list→edit-in-place pattern repeated across admin-office — candidate for one shared "searchable record list" component | Medium |
| adminOffice/setup/CourierFields.jsx | Shared field set for courier add/edit (conditional fields by courier type) | Pure form-fields component | Conditional field rendering is a nice touch already; low priority | Low |
| adminOffice/setup/CourierReportSetup.jsx | Courier report by date range/search | Filter form + dense 9-column report table | Wide unstyled table with 9 columns, no responsive/mobile handling | Medium |
| adminOffice/setup/EventsGroupSetup.jsx | Placeholder for events-group setup | Static "not available" notice | Not implemented — nothing to redesign until feature exists | Low |
| adminOffice/setup/IncidentAddSetup.jsx | Add incident report (exports shared `IncidentFields`) | Simple flat form incl. textarea | Clean and short | Low |
| adminOffice/setup/IncidentEditSetup.jsx | Search/list + edit/delete incident records | Same search+list+edit pattern as CourierEditSetup/Activities | Third repetition of the same list→edit UI pattern — reinforces case for one shared component | Medium |
| adminOffice/setup/IncidentReportSetup.jsx | Incident report by date range/search | Filter form + 6-column report table | Simple, low-risk | Low |

### portfolio

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| portfolio/PortfolioDashboardPage.jsx | Student portfolio summary dashboard (publication/seminar counts by UG/PG year) | Year filter form, stat-tile row, two summary tables, loading overlay w/ spinner | Stat tiles use inline styles (`style={{ background: 'var(--cis-primary)' }}`) instead of classes — a clear Tailwind-conversion target; otherwise well-structured with good loading/error states | Medium |
| portfolio/PortfolioIndividualReportPage.jsx | Per-student portfolio detail report (seminars + publications) with roll-no/batch search | 2-column layout: left filter/student-picker sidebar, right detail panel with two dense report tables (12-column publications table with rowSpan abstract row) | Dense, hard-to-scan, print-unfriendly 12-column table with merged rowSpan rows; left/right split has no responsive stacking noted | High |
| portfolio/PortfolioModule.jsx | Portfolio hub (links to dashboard + individual report) | Built via `createModuleHub` factory | Already on shared factory — consistent, low priority | Low |

### library

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| library/LibraryHub.jsx | Library module landing hub | ModuleHub factory; static link list | None; consistent with other hubs | Low |
| library/LibrarySetupPage.jsx | Dispatcher/shell for all library setup screens | SetupPageShell + SETUP_COMPONENTS map | Shell itself is fine; consistency depends on child screens | Low |
| library/setup/AttendanceSetup.jsx | Device attendance log by date | Tiny (14 lines); date picker + 3-col table | Minimal, low-traffic; nothing worth flagging | Low |
| library/setup/AttEntrySetup.jsx | Manual staff attendance punch entry | Single-row form, in/out select | Clean, minimal | Low |
| library/setup/AttReportSetup.jsx | Attendance report by date range | Date range filter + fully dynamic table (headers = Object.keys of row) | Column headers are raw camelCase field names, not friendly labels; no styling for wide dynamic tables | Medium |
| library/setup/BookAddSetup.jsx | Add new library resource/book | Looped field list → 4-col form grid | Raw field-name labels (e.g. "accessionNo") shown verbatim instead of human labels | Medium |
| library/setup/BookCategorySetup.jsx | Manage category/dept/type/subject lookup lists | Category select + editable order/name/enabled table + add-row | No delete-row action (add only); no unsaved-change guard when switching category | Medium |
| library/setup/BookEditSetup.jsx | Search a book by accession no, edit/delete | Search bar + conditional edit form, raw field-name labels | Same raw-label issue as BookAddSetup; accession-only search (no name/author) | Medium |
| library/setup/BookReportSetup.jsx | Book/report listing by date range | Date filter + fully dynamic table (headers = row keys) | Same dynamic-column/no-friendly-labels issue as AttReportSetup; no pagination; no print button despite being a report | Medium |
| library/setup/DashboardSetup.jsx | Library dashboard (book/visitor/issue stats) | Date picker + stat cards + dept breakdown chips + recent table | Plain Bootstrap stat cards, no icons/hierarchy; good stat-tile redesign candidate | Medium |
| library/setup/EntryReportSetup.jsx | Daily issue/return summary by date range | Date filter + summary line + 11-column table | Dense 11-col table, small text, poor narrow-viewport handling; otherwise well-structured with good empty states | Medium |
| library/setup/ResourcesBarcodeSetup.jsx | Generate barcode labels for resources | Filter form + copies-per-label radios + card-grid preview | Preview grid is text-only (barcode presumably rendered at print time) | Medium |
| library/setup/ResourcesReportSetup.jsx | OPAC-style resource search/report | Shared ResourceSearchForm + results table | File also duplicates a second `ResourcesBarcodeSetup` export nearly identical to the standalone file — dead/duplicate code to reconcile | Medium |
| library/setup/ResourceTransferSetup.jsx | Transfer/receive library resources between locations | Lookup box + conditional transfer/return sub-forms | Two flows (transfer/return) crammed into one mode-driven component; not visually broken | Low |
| library/setup/SupplierAddSetup.jsx | Add new book supplier | Tiny clean 4-field form | None notable | Low |
| library/setup/SupplierEditSetup.jsx | Search/edit/delete suppliers | List+edit modes; uses shared ConfirmModal (from fees module) for delete | Cross-module import path (`../../fees/setup/ConfirmModal`) is organizationally odd but functions; good reuse example otherwise | Low |
| library/setup/TransactionIssueSetup.jsx | Issue a book to student/staff | Simple form, live member lookup on blur | Lookup errors not surfaced inline; otherwise clean | Low |
| library/setup/TransactionReportSetup.jsx | Issue/return/due transactions report | Filter form + 8-col labeled table | No pagination for large date ranges; otherwise clearer than dynamic-column reports | Medium |
| library/setup/TransactionReturnSetup.jsx | List of issued/due books with Return action | Table-only, no filters | No date/search filter to narrow a potentially long due-list | Medium |
| library/setup/TransactionSetupSetup.jsx | Configure issue limits/durations per member type | 3-row settings table as form | Small, fine as-is | Low |

### admin

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| admin/AdminHub.jsx | Admin module landing hub | ModuleHub factory; static link list | None | Low |
| admin/AdminLogDashboard.jsx | Login/audit dashboard (admin/staff/student active users + activity) | 404-line bespoke DashboardLayout page; custom `cis-log-*` CSS, 3 stat panels, 3 activity tables, sessionStorage caching, custom print via innerHTML | Large bespoke file mixing async caching/multi-stage loading with rendering; heavy custom CSS naming needs Tailwind conversion; dense mini-tables inside stat cards could become cleaner stat tiles | High |
| admin/AdminLogDetails.jsx | Search audit log/session trace (login/logout/page activity) | 341-line bespoke two-column card layout (filters + 10-col results table) | Print bypasses shared `printReportHtml`/CSS system, uses raw `window.open` with hardcoded bootstrap link (inconsistent with rest of app); dense 10-column table with no pagination | High |
| admin/AdminSetupPage.jsx | Dispatcher/shell for admin setup screens | SetupPageShell + SETUP_COMPONENTS map, consistent breadcrumbs/alerts | Shell itself fine; quality varies by wrapped child screen | Low |
| admin/AdminUserEditPage.jsx | Thin route wrapper into AdminSetupPage's account-edit screen | 12-line pass-through, no own UI | None | Low |
| admin/AdminUserList.jsx | User directory (search + paginated table + edit links) | Bespoke DashboardLayout + search form + table + custom prev/next pagination | Pagination hand-rolled per-page (duplicated in AccountEditSetup) instead of shared component; plain 4-col table; high daily traffic | High |
| admin/setup/AccessRestrictionSetup.jsx | Per-user login access restrictions (day/time/date rules) | Bespoke form, 3 parallel mutually-exclusive toggle sections, day checkboxes | Three toggle-groups (key/day/date) have no visual separation — easy to misread which mode is active | Medium |
| admin/setup/AccountAddForm.jsx | Create new web login account | Single clean grouped form, password show/generate | Minor crowding in password row; otherwise clean | Low |
| admin/setup/AccountEditSetup.jsx | Search/edit/delete accounts; photo upload, password subform | 277-line bespoke list+detail modes, base64 file upload, custom pagination | Delete uses native `window.confirm` instead of app's ConfirmModal pattern; pagination reimplemented; single file mixes list+detail+password+photo concerns | High |
| admin/setup/ChangePasswordSetup.jsx | Self-service profile + password change | Two clean sectioned forms | Password-generate logic duplicated across 3 files (code hygiene, not visual) | Low |
| admin/setup/CommitteeAccessSetup.jsx | Assign event committee permissions per user | User select + native multi-select listbox | Native `<select multiple>` is dated UX for picking committees (no search/checkboxes) | Medium |
| admin/setup/DashboardAccessSetup.jsx | Per-user dashboard widget enable/order | User select + checkbox+order-number grid, bulk actions | Reordering via typed numbers, not drag-and-drop | Medium |
| admin/setup/DeptAuthSetup.jsx | Department-scoped auth (HOD/staff/student/PG/course) per user | User+dept selects + 6 native multi-select listboxes | Six raw multi-selects, no search/filter, hard to scan long lists | Medium |
| admin/setup/DeptAuthV1Setup.jsx | Legacy v1 variant of dept auth (HOD staff, grouped) | Same pattern as DeptAuthSetup + optgroup staff select | Same multi-select UX issue; near-duplicate of DeptAuthSetup — consolidation candidate | Medium |
| admin/setup/MenuAuthSetup.jsx | Assign sidebar menu permissions per user | User select + grouped checkbox grid; "check all" via raw DOM query | Bypasses React state (DOM `querySelectorAll` on submit/toggle) — should be controlled state; long ungrouped checkbox list | Medium |
| admin/setup/OtpResetSetup.jsx | Bulk reset passwords to default | Checkbox grid + check-all + submit | Fine, low-frequency utility | Low |
| admin/setup/StaffAuthSetup.jsx | HOD/staff portal menu permissions (hod/page modes) | Card-based picker + toolbar with counts + grouped module cards (custom `staff-auth-*` CSS) | Already the most polished screen in this group — could be the visual reference for redesigning MenuAuthSetup/DeptAuthSetup | Low |

### reports

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| reports/ReportsHub.jsx | Cross-module index of migrated report links (students, staff, attendance, fees, academic, exam, payroll, admin) | ModuleHub factory; large flat grouped LINKS array (~30 links) | Pure link list with no own UI to redesign; could use icons/section visuals given its length, but not broken | Low |

### web

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| web/WebModule.jsx | Dispatcher wiring all Web CMS screens (pages, slider, photos, staff order, doc upload, research, events) | Fully factory-based: createSetupApi + createModuleHub/createModuleSetupHub/createModuleSetupPage | None — exemplary reuse, low priority by construction | Low |
| web/setup/WebPageScreen.jsx | Generic static content-page editor, reused for 9 CMS pages (About Us, Departments, LMS, Journal, Facilities, Research, Academic, IQAC, Outreach) | List-group page picker + form with plain `<textarea>` for HTML content | Raw textarea for hand-written HTML across 9 site pages — no rich text/WYSIWYG editor; highest-value RTE candidate in this survey | High |
| web/setup/WebSliderScreen.jsx | Homepage slider/carousel management (image/video slides, colors, links, toggles) | Repeated per-slide form cards, all slides saved together | No add/remove-slide controls visible; image is a plain filename text input (no real upload/preview) | High |
| web/setup/WebStaffDisplayScreen.jsx | Reorder staff display order on website by department | Dept select + table with numeric order input per row | Reordering via typed numbers rather than drag-and-drop | Medium |
| web/setup/WebDocUploadScreen.jsx | Upload/manage PDF documents for website | Multi-file upload form + simple file listing table | Small and functional; no per-file upload progress/validation feedback | Low |
| web/setup/WebPhotosAddScreen.jsx | Create new photo gallery (cover + multiple images) | Single form, two file inputs (cover + multi gallery) | No image previews before upload for either cover or gallery images | Medium |
| web/setup/WebPhotosEditScreen.jsx | Edit existing photo gallery, replace cover | Gallery list-group picker + edit form + plain link list of existing photos | Existing photos shown as text links only, no thumbnails | Medium |
| web/setup/WebResearchScreen.jsx | Add/edit research program listings (2 screens in one file) | Shared ResearchForm reused for add/edit; list-group picker for edit | Long flat ~15-field form with no visual grouping (event vs presenter vs meta info) | Medium |
| web/setup/WebEventsScreen.jsx | Add/edit web events + event-type category manager (3 screens in one 285-line file) | Shared EventForm w/ list-group picker+search; separate editable-table type manager | Largest/most complex Web file, mixes 3 distinct screens; event-type multi-select is a native listbox; delete uses `window.confirm` instead of app's ConfirmModal pattern | High |

### attendance

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| attendance/AttendanceHub.jsx | Module hub landing page for attendance | Built on `ModuleHub` factory; link cards | Consistent, factory-based; low priority | Low |
| attendance/StaffAttendanceCalendar.jsx | Monthly staff attendance calendar viewer | Single ID input form + `dangerouslySetInnerHTML` legacy calendar HTML block with intercepted link clicks for month nav | Legacy calendar rendered as raw injected HTML, not a real React component | Medium |
| attendance/StaffAttendanceReport.jsx | Date-range staff attendance report by category | Filter form (checkboxes + date range) + `ReportPrintBar` + raw HTML report body | Category checkboxes rendered as plain `btn-outline-secondary` toggle list, no chip/grouping; otherwise clean and small | Low |
| attendance/StaffLivePunch.jsx | Live biometric-style punch in/out kiosk screen | Single big input + result card with photo | Simple and purpose-built (kiosk UX), reasonably fine as-is | Low |
| attendance/staff/setup/AttTimeSetup.jsx | Setup panel: staff attendance time schedule | Small panel in `SetupPageShell` via `StaffAttSetupPage`; schedule table | Factory-based, consistent, low priority | Low |
| attendance/staff/setup/CalendarAddSetup.jsx | Setup panel: add staff calendar/holiday event | Small panel in `SetupPageShell`; plain field grid form | Factory-based, low priority | Low |
| attendance/staff/setup/CalendarEditSetup.jsx | Setup panel: edit staff calendar events | Small panel in `SetupPageShell`; table list | Factory-based, low priority | Low |
| attendance/staff/setup/WorkingDaySetup.jsx | Setup panel: working-day configuration | Small panel in `SetupPageShell`; table | Factory-based, low priority | Low |
| attendance/staff/StaffAttHub.jsx | Sub-hub for staff attendance screens | `ModuleHub` factory | Consistent, low priority | Low |
| attendance/staff/StaffAttScreenPage.jsx | Mega-dispatcher for ~15+ staff attendance report/action screens (daily chart, biometric, yearly, SMR approvals, CL/EL grid, holiday roster, transport, etc.) | Bespoke 318-line file with inline `ReportFilters`/`ApprovalList`/`ClElGrid`/table components switching on `screen` string; several dense Bootstrap tables | One file owns many unrelated screen shapes via string-branching — hard to reason about; dense unstyled tables with no responsive handling | High |
| attendance/staff/StaffAttSetupPage.jsx | Dispatcher wrapper for staff attendance setup screens | `SetupPageShell` + `SETUP_COMPONENTS` map | Clean factory pattern, low priority | Low |
| attendance/StudentAttendanceReport.jsx | Standard/quarterly student attendance report | Multi-step filter form, progressive/batched report generation, `ReportPrintBar`, HTML row-merging via regex | Regex-based HTML row splicing (`mergeReportRows`) is fragile and print-only-oriented, not a real data table | Medium |
| attendance/StudentDailyAttendance.jsx | Mark/edit daily UG student attendance by course+date | Date/course filter form + grouped textarea-per-period editor (comma-separated roll numbers) | Attendance entry via raw comma-separated roll-number textareas is a legacy-style UX with no per-student list/checkbox UI — strong redesign candidate | High |
| attendance/students/StudentAttHub.jsx | Sub-hub for student attendance screens | `ModuleHub` factory | Consistent, low priority | Low |
| attendance/students/StudentAttScreenPage.jsx | Massive dispatcher for ~27 student attendance screens: biometric/PG/intern reports, period attendance, approvals, PG/intern SMR setup, holiday roster + course picker, year-incharge, PG punch batch reports | Bespoke **2281-line** single file with ~15 large internal form/table components; tables, custom pagination, approval workflow list+detail, progressive/chunked report generation | By far the largest and most complex file in the app — 27 distinct screens crammed into one file; prime candidate to split into per-screen files before/alongside any visual redesign | High |

### dashboard

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| dashboard/DashboardHub.jsx | Sub-hub linking to all dashboard boards/reports | `ModuleHub` factory | Consistent, low priority | Low |
| dashboard/DashboardWidgetShell.jsx | Shared shell rendering legacy dashboard widget HTML cards (used by 2 pages) | Date/year picker controls + parallel widget fetch + `DashboardWidgetCard` grid of `dangerouslySetInnerHTML` widget blocks | Widgets are raw injected legacy HTML, so visual redesign is constrained to the shell chrome unless widget HTML itself is touched | Medium |
| dashboard/StaffPatternPage.jsx | Faculty structure / DCI norms board | 11-line thin wrapper around `DashboardWidgetShell` | Trivial, low priority | Low |
| dashboard/StrengthReportPages.jsx | Overall/community strength reports (2 pages, 1 shared component) | Hero header + print button + raw `tableHtml` injection | Report body is raw injected HTML table — fine for parity but not a real styled data table | Low |
| dashboard/StudentDashboardPage.jsx | Student-focused dashboard board with academic year filters | 12-line thin wrapper around `DashboardWidgetShell` | Trivial, low priority | Low |

### staff

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| staff/StaffAdmission.jsx | New staff admission/onboarding form | Bespoke ~425-line form; local `Section` card-grid grouping, education/experience/skills sub-tabs from `StaffProfileSections`, credential result panel | Reasonably grouped into cards already; mainly needs visual polish, not restructuring | Medium |
| staff/StaffHub.jsx | Staff module hub | `ModuleHub` factory | Consistent, low priority | Low |
| staff/StaffList.jsx | **High-traffic**: staff search (by name/staff ID/category) | Built on shared `ListSearchPage`/`ListFilterCard`/`ListResultsPanel`/`ListResultCard` | Already on a shared, fairly clean pattern; low-priority structurally but very high traffic — worth an early pass since it's the front door to staff records | Medium |
| staff/StaffProfile.jsx | **High-traffic**: staff profile view/edit, 9 tabs | Bespoke 337-line tabbed page; classic Bootstrap `nav-tabs`; delegates tab bodies to `StaffProfileSections.jsx` | Plain Bootstrap tab bar (no icons/responsive collapse for 9 tabs); high-traffic core screen — strong redesign candidate | High |
| staff/StaffProfileSections.jsx | Shared field/table/form primitives + tab bodies used by StaffProfile & StaffAdmission | Bespoke 661-line library of `Field`/`FormInput`/`FormSelect` + per-tab record tables with add/remove rows | Flat `col-md-4` field-grid with no visual grouping (contact vs address vs statutory IDs); dense bordered tables — core to both high-traffic profile screens | High |
| staff/StaffReport.jsx | Ad-hoc staff report builder | Field-group picker + selected-field reorder list + preview HTML pane | Custom field-picker/reorder UI has no drag handle beyond up/down buttons; duplicated pattern with StudentReport.jsx (dedup opportunity) | Medium |
| staff/StaffScreenPage.jsx | Mega-dispatcher for ~15 misc staff screens (transport, photo upload, certificates, affidavit/inspection reports, category reports) | Bespoke 520-line file, `ScreenFilters` branching on `screen`/`meta.type`, several table blocks, file upload | Same "one file, many screens via string branching" pattern as StaffAttScreenPage — hard to scan, uneven filter UX per screen | High |
| staff/StaffSetupPage.jsx | Mega-dispatcher for staff setup screens: org chart config, designation edit, transport trip setup, login help, attachment categories, inspection config | Bespoke **933-line** file (largest in staff module) with many internal CRUD-table components, wrapped by `SetupPageShell` | Very large single file mixing several unrelated multi-row CRUD tables/forms with no shared table component — highest complexity in the module, should be split per-screen | High |

### students

| File | Purpose | Structure | Issues | Priority |
|---|---|---|---|---|
| students/AddressLabelPanel.jsx | Generate printable address labels by batch/year | Filter panel; native `<select multiple size=12>` picker | Legacy native multi-select listbox instead of a modern checkbox/chip picker | Medium |
| students/AlumniEditPanel.jsx | Search & edit alumni records | Bespoke 312-line panel; search filter card + alumni list + edit form, reload-on-change logic | Mixes search, list, and edit form in one panel with nontrivial reload logic; no strong visual separation | Medium |
| students/AlumniIdCardPanel.jsx | Generate/print alumni ID cards | Filter card (search by roll/batch + front/back toggles) + print action | Small, focused, functional | Low |
| students/CollageGeneratePanel.jsx | Generate photo-collage layout sheets | Builds HTML grid preview via string concatenation; form fields laid out in a legacy label/value `<table>` | Form fields in a legacy table layout rather than a real form grid; preview built via manual HTML string building | Medium |
| students/CollageImagePanel.jsx | Upload/manage collage image gallery, bulk delete | File upload (multi), checkbox-based multi-select gallery, inline title edit via `getElementById` reads | Reads form values via `document.getElementById` instead of React state (anti-pattern, fragile) | Medium |
| students/PromotePanel.jsx | Promote students between academic years/classes | Cascading year→class selects + promotion mapping table | Functional but dense; no clear "review before promote" step | Medium |
| students/StudentAdmission.jsx | New student admission form | Bespoke ~725-line form; local `Section` card-grid grouping + `Field` wrapper, mark-sheets sub-table | Largest admission form in the app but already grouped into labeled `Section` cards — mainly needs visual/spacing polish | Medium |
| students/StudentHub.jsx | Student module hub | `ModuleHub` factory | Consistent, low priority | Low |
| students/StudentList.jsx | **High-traffic**: student search (by roll number or course/batch) | Built on shared `ListSearchPage`/`ListFilterCard`/`ListResultsPanel`/`ListResultCard`, with request-cancellation handling | Already on the same clean shared search pattern as StaffList; front door to student records, worth an early look despite already being decent | Medium |
| students/StudentPageShell.jsx | Shared page shell (breadcrumbs/header/loading/error) for the student module | Pure shared layout component | Not a screen — infrastructure; redesign here cascades to many pages | Low |
| students/StudentProfile.jsx | **High-traffic**: student profile view/edit (overview, edit, attachments, status tabs) | Bespoke 362-line tabbed page with a nicer custom hero than StaffProfile, but a flat 37-field `EDIT_FIELDS` array rendered as an ungrouped `col-md-4` grid | Edit tab dumps 37 fields (personal, contact, address, guardian all mixed) with no section grouping — core high-traffic screen, prime redesign target for the edit form | High |
| students/StudentReport.jsx | Ad-hoc student report builder | Field-group picker + selected-field reorder + course/year filters + preview HTML pane | Same field-picker/reorder pattern duplicated from StaffReport.jsx (dedup opportunity) | Medium |
| students/StudentScreenPage.jsx | Mega-dispatcher for ~10 misc student screens (photo/attachments upload, temp admission, academic promotion delegation) plus routes to standalone panels (Alumni/Collage/Promote/AddressLabel) | Bespoke 405-line file combining inline `StudentAttachmentsPanel` (dense edit table) with conditional routing | Attachment table mixes read links and inline edit inputs densely; overall dispatcher is smaller/cleaner than staff/attendance counterparts since heavy screens were split out | Medium |

---

## Cross-cutting patterns across all 311 pages

Worth fixing once, centrally, rather than per-page — these show up repeatedly across every
module surveyed:

1. **"One file, N unrelated screens" mega-files.** The most extreme cases:
   `students/attendance/StudentAttScreenPage.jsx` (**2281 lines, ~27 screens**),
   `committee/setup/CommitteeScreens.jsx` (2700 lines/~26 screens),
   `staff/StaffSetupPage.jsx` (933 lines), `payroll/setup/SalaryAdvanceCloseSetup.jsx`-style
   list+detail combos, `certificate/setup/CertificateScreens.jsx` (874 lines/~14 screens),
   `staff/StaffScreenPage.jsx` (520 lines/~15 screens), `tv/setup/TvScreens.jsx`,
   `kiosk/setup/KioskScreens.jsx`. Each inner screen was built ad hoc, so visual language drifts
   screen-to-screen within a single file. These are also the files where "redesign this page"
   really means "redesign 15–27 pages at once" — worth splitting into per-screen files as part
   of (not after) the redesign, not just reskinning in place.
2. **Hand-rolled delete-confirm modals / `window.confirm`** duplicated across dozens of screens
   instead of reusing the shared `ConfirmModal` (`fees/setup/ConfirmModal.jsx`) — seen in exam,
   hostel, settings, circular, committee, certificate, admin (`AccountEditSetup`), web
   (`WebEventsScreen`) screens.
3. **Shared selector/filter building blocks are the highest-leverage redesign targets.**
   `exam/setup/ExamSelectors.jsx` alone backs ~20 exam screens; `academic/setup/curriculumReportUi.jsx`
   backs several curriculum reports; `payroll/PayrollReportLoading.jsx` backs ~9 payroll/stipend
   report pages. Redesigning a handful of these shared pieces visually upgrades dozens of screens
   at a fraction of the per-page cost — do these before individual pages.
4. **Near-duplicate screen pairs/trios** that should be unified before or during redesign rather
   than reskinned twice: `academic/setup/TtConfigSetup.jsx` vs `TtConfigV3Setup.jsx` (~90% identical);
   `payroll/setup/SalaryAdvanceAddSetup.jsx` vs `SecurityDepositAddSetup.jsx` and their matching
   `...CloseSetup.jsx` pair; `fees/setup/FeeScholarshipSetup.jsx` vs `FeeAcmecScholarshipSetup.jsx`
   vs `FeeDmeSetup.jsx`; `admin/setup/DeptAuthSetup.jsx` vs `DeptAuthV1Setup.jsx`;
   `sms/setup/SmsSendScreen.jsx`'s `GroupSmsFlow` vs `StudentSmsFlow` (~80% duplicated logic in
   one file); `settings/setup/BudgetSmsSetup.jsx` vs `HospitalSmsSetup.jsx`; the adminOffice
   trio (`ActivitiesEditSetup`/`CourierEditSetup`/`IncidentEditSetup`) all hand-rolling the same
   search→list→edit pattern.
5. **Raw `Object.keys()`-driven report tables** with no column formatting or friendly labels —
   hostel's `AttendanceReportSetup`/`PassReportSetup`, circular's `ReportSetup`, library's
   `AttReportSetup`/`BookReportSetup`. A single shared, styled dynamic-table component would fix
   all of these at once.
6. **Server-rendered HTML blobs via `dangerouslySetInnerHTML`** for dashboards/reports — exam
   dashboard, exam student statement, circular print, fees dashboard, payroll's
   `PayrollLegacyReportPage`/`StipendAjaxReportPage` (which additionally **re-execute injected
   `<script>` tags**, worth a second look as a code-smell/security surface, not just visual),
   dashboard widget shell, `StrengthReportPages`. These can't be restyled with Tailwind alone —
   redesigning them means touching server-side HTML generation too, so budget more time for these.
7. **Native multi-select listboxes** (`<select multiple>`) for picking several items — a dated,
   low-discoverability pattern seen in `students/AddressLabelPanel.jsx`,
   `admin/setup/CommitteeAccessSetup.jsx`/`DeptAuthSetup.jsx`, `sms/setup/ParentMeetingSmsScreen.jsx`,
   `web/setup/WebEventsScreen.jsx`, `academic/setup/AcademicYearsSetup.jsx`. The app already has a
   better pattern for this (`fees/FeeMultiDropdown.jsx`, `ChipMultiSelect`) — just not applied
   consistently. Swapping these to the existing chip/checkbox pattern is cheap, high-value, and
   doesn't require the full Tailwind conversion to do first.
8. **Reading form state via `document.getElementById`/DOM queries instead of React state** — a
   correctness-adjacent anti-pattern, not just visual: `admin/setup/MenuAuthSetup.jsx`,
   `students/CollageImagePanel.jsx`, `elearning/setup/ElearningScreens.jsx`,
   `kiosk/setup/KioskScreens.jsx`'s `MachinePasswordScreen`. Worth fixing alongside any redesign
   touching these files since the redesign will rewrite the markup anyway.
9. **Hand-rolled pagination**, reimplemented slightly differently per screen instead of a shared
   component — `admin/AdminUserList.jsx`, `admin/setup/AccountEditSetup.jsx`,
   `exam/setup/AttendanceEntrySetup.jsx`, several others.

## Suggested rollout order (informed by the full survey — a recommendation, not a decision)

Weighting daily-traffic + how bespoke/messy the code is, roughly in order:

1. **Shared infrastructure first** — `ConfirmModal` adoption sweep, a shared dynamic-report-table
   component, `ExamSelectors.jsx`/`curriculumReportUi.jsx`/`PayrollReportLoading.jsx`, and
   swapping native multi-selects for the existing chip picker. Cheapest, highest-leverage, touches
   the most pages indirectly.
2. **Highest-traffic core screens**: `students/StudentProfile.jsx`, `staff/StaffProfile.jsx` (+
   `StaffProfileSections.jsx`), `students/StudentList.jsx`/`staff/StaffList.jsx`,
   `fees/FeeCollectionPanel.jsx`, `fees/FeeSlipApprove.jsx`, `fees/FeeDashboard.jsx`,
   `exam/setup/ExamBatchSetup.jsx`, `exam/setup/TermExamSetup.jsx`, `exam/setup/MarkEntrySetup.jsx`,
   `admin/AdminUserList.jsx`.
3. **Mega-file splits**: `StudentAttScreenPage.jsx`, `StaffAttScreenPage.jsx`, `StaffScreenPage.jsx`,
   `StaffSetupPage.jsx`, `CommitteeScreens.jsx`, `CertificateScreens.jsx`, `KioskScreens.jsx`,
   `TvScreens.jsx` — split-then-redesign, since these are currently 15–27 screens each hiding
   behind one file.
4. **Everything else**, roughly in the per-file priority already assigned above, deferring
   print-parity report screens and already-factory-based hub/dispatcher pages (`Low` priority
   throughout this doc) to last.

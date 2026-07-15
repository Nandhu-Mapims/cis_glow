# Redesign status tracker & change log

Companion to [redesign-checklist.md](redesign-checklist.md). The checklist is the
*inventory + design system*; this file tracks **what has actually been implemented**,
page by page, plus the shared components each pass introduced. Update this file whenever a
page is redesigned.

Design authority, tokens, and component patterns: see the **"Design system for the redesign"**
section of [redesign-checklist.md](redesign-checklist.md). All work uses the app's `--cis-*`
tokens (crimson + pale-gold identity) and respects business logic / API contracts / routes /
permissions per `CLAUDE.md`.

## Status legend

- ✅ **Done** — redesigned, builds clean, functionality + permissions preserved.
- 🚧 **In progress**
- ⏳ **Pending**

---

## Shared components (build once, reuse everywhere)

| Component | File | Provides | Used by |
|---|---|---|---|
| DataTable | `client/src/components/DataTable.jsx` (+ `styles/datatable.css`) | Sticky header w/ crimson signature underline, client sort, optional in-table search, client pagination + "showing X–Y of N", responsive **card view** on mobile, built-in **loading skeleton / empty / error** states, keyboard-accessible rows, tabular figures. | StudentList |
| FormShell | `client/src/components/FormShell.jsx` (+ `styles/form.css`) | Long-form scaffolding: `useScrollSpy`, sticky **FormSectionNav** (jump nav), **FormSection** (titled, anchored), sticky **FormActionBar**. Keeps the form a single document so native `required` validation still works. | StudentAdmission |
| ConfirmModal (shared) | `client/src/components/ConfirmModal.jsx` (+ `styles/form.css`) | Promoted, tokenised confirm dialog — tone (danger/warning/primary), Escape-to-close, focus on confirm, overlay click-out. Supersedes the per-module `fees/setup/ConfirmModal.jsx` (sweep pending). | StudentAdmission |
| UserMenu | `client/src/components/UserMenu.jsx` | Account dropdown (avatar/name/role/menu), light+dark variants. | TopNav (desktop), Header (mobile) |
| ModuleHub / HubCard / SetupPageShell / PageHeader / Breadcrumbs | `client/src/components/PageShell.jsx` | Module landing grids, setup/report shells, page chrome. | All hub + setup screens |
| ChipMultiSelect | `client/src/components/ChipMultiSelect.jsx` | Chip/checkbox multi-select (replaces native `<select multiple>`). | payroll, (rollout: SMS/admin/students) |
| ConfirmModal | `client/src/pages/fees/setup/ConfirmModal.jsx` | Destructive-action confirm dialog. | fees, library (rollout: sweep) |

> Next shared pieces on deck (per checklist rollout §1): promote `ConfirmModal` to
> `components/`, add a shared `StatusPill`, and adopt `DataTable` across the CRUD-grid and
> report screens.

---

## Page status

### Shell / entry (previously redesigned)

| Page | File | Status | Notes |
|---|---|---|---|
| Login | `pages/Login.jsx` | ✅ | Register/ledger card, theme-aware, no gradients. |
| App shell (TopNav + Header) | `layouts/TopNav.jsx`, `layouts/Header.jsx` | ✅ | Account menu + last-login consolidated into the top bar; redundant second header strip removed (mobile-only now). |
| Dashboard | `pages/Dashboard.jsx`, `components/DashboardWidgetCard.jsx` | ✅ | Register-stamp hero, compact scrollable dense panels w/ sticky table headers, first real chart (Faculty/DCI staffing, `DeptStaffingChart`). |

### Students

| Page | File | Status | Notes |
|---|---|---|---|
Working through the module in **menu order** (Student hub): Edit Profile → New Profile → Report → …

| Page | File | Status | Notes |
|---|---|---|---|
| 1. Edit Profile (search / list) | `pages/students/StudentList.jsx` | ✅ | Search-first layout + shared DataTable. |
| 2. **New Profile (admission)** | `pages/students/StudentAdmission.jsx` | ✅ | **Redesigned this pass** — see change log. |
| **Student profile (view/edit)** | `pages/students/StudentProfile.jsx` | ✅ | **Redesigned this pass** — see change log. |
| 3. Student Report | `pages/students/StudentReport.jsx` | ✅ | **Redesigned this pass** — FormSection scope + field catalogue/selected two-panel + sticky action bar. |
| Provisional admission add/edit/affidavit, promotion, attachments, ID card, photo, alumni… | `pages/students/StudentScreenPage.jsx`, panels | ✅ | **Redesigned this pass** — labelled filters, shared table styling, consistent empty states across all sub-screens + panels. |

*(All other modules: see the inventory + priorities in redesign-checklist.md — status defaults to ⏳ Pending until listed here.)*

---

## Change log

### 2026-07-14 — Student Report: simpler column picker (UX follow-up)

The first report redesign (accordion-of-chips catalogue + disabled ✓ chips + a
separate numbered panel) read as too busy. Simplified the "Choose columns" step to a
single, calmer pattern:
- **Searchable checklist** — all field groups shown at once (no expand/collapse), a
  search box filters them, and each field is a plain **checkbox** (tick = include,
  untick = remove). Per-group "Select all / Clear group" toggle.
- The **Report columns** order panel sits beside it (numbered, reorder ↑↓, remove),
  with custom-field add moved under the checklist.
- Same `selectedFields` state + `/api/students/reports/generate` payload — purely a
  presentation change. Build clean.

### 2026-07-14 — Student screen dispatcher + standalone panels

Presentational pass over the rest of the Student module — the multi-screen
dispatcher and the six standalone panels — bringing them onto the design system
without touching any logic, API calls, or payload shapes.
- **`StudentScreenPage.jsx`** (drives Provisional Admission add/edit/affidavit,
  Academic Promotion, Attachments upload/view/report, ID Card, Photo empty/upload,
  Address Label): every branch of the shared `ScreenFilters` form now has a proper
  **`<label>`** (was placeholder-only) plus a titled "Filters/Upload" header; the two
  inline tables (attachments, academic records) restyled onto the shared `.cis-dt-table`
  in a rounded `.cis-dt-wrap`.
- **`PromotePanel`**: promotion grid restyled to `.cis-dt-table`.
- **`AddressLabelPanel`**: primary action changed from `btn-danger` → `btn-primary`
  with a busy state; empty state → shared `.cis-report-empty`.
- **`AlumniEditPanel` / `AlumniIdCardPanel` / `CollageGeneratePanel`**: bare
  "search to begin" paragraphs → consistent iconified `.cis-report-empty` blocks.
- New shared CSS: `.cis-screen-filters-head`, `.cis-dt-wrap` (student.css).
- **Preserved unchanged**: all `useStudentScreenApi` load/save/searchMore calls, the
  `SAVE_SCREENS` routing, every field `name`/`onChange`, the collage legacy grid table,
  and all print/report flows.
- *Verification*: `npx vite build` clean. Needs a visual spot-check per sub-screen.

### 2026-07-14 — Student Report redesign + form-nav scroll-jump fix

Fixed a reported bug on **New Profile**: clicking a section in the jump-nav (e.g.
"Admission") scrolled the whole page up and tucked the heading under the sticky top
bar. The nav's `scrollIntoView` assumed the *window* scrolled and used a hardcoded
64px offset; the page actually scrolls inside `.cis-main` behind a taller sticky
chrome bar. `FormSectionNav.jump()` now scrolls the real `.cis-main` container by
the target's offset minus the **measured** `.cis-chrome-sticky` height, so any
section lands just below the bar. Native `required`-validation focus gets a matching
`scroll-margin-top` on section cards + form controls (`FormShell.jsx`, `form.css`).

Redesigned **Student Report** (`StudentReport.jsx`) — the report builder:
- *Scope*: filters (Course / Search-by / Batch-Year / Show / Title / Print options)
  moved onto a tokenised `FormSection` card with descriptions and aligned radio/checkbox rows.
- *Field builder*: two-panel `FormSection` layout — a **field catalogue** (expandable
  groups; a field already added shows a ✓ and is disabled) beside the **selected
  columns** list (numbered order badges, reorder/remove, empty state), with a
  custom-field add (Enter-to-add).
- *Actions*: Print / Export XLS / Clear moved into a sticky `FormActionBar` with a
  live "N columns selected" note.
- **Preserved unchanged**: `/api/students/reports/fields|filters|generate` contracts,
  the batch/year search modes, XLS download + HTML print flow (`printReportHtml`), and
  all payload keys.
- *Verification*: `npx vite build` clean. Needs a visual spot-check of the two-panel
  layout + sticky bar across widths.

### 2026-07-14 — Student Profile (view / edit) redesign

Page: `StudentProfile.jsx` — the highest-traffic student screen (4 tabs: Overview / Edit /
Attachments / Status).
- *Hero*: photo-or-initials avatar (shared `UserAvatar`), name + an **Active / Released status
  pill** (derived from the releaving date, legacy zero-dates treated as active), and a quick-facts
  row (Register No, Admission No, Course, Batch).
- *Tabs*: replaced the Bootstrap `nav-tabs` with a pill **tab bar** (icons); the Edit tab shows an
  **unsaved-changes dot**.
- *Edit tab*: the flagged **flat 37-field grid** is now grouped into meaningful `FormSection`
  cards (Identity / Personal / Family / Contact / Permanent + Communication Address / Guardian)
  with a sticky action bar (Reset + Update). **Unsaved-changes protection**: `beforeunload` guard
  + a discard-confirm `ConfirmModal` when switching tabs with pending edits.
- *Overview / Status*: moved onto the same tokenised `FormSection` cards; academic-records table
  restyled on the shared table classes.
- **Preserved unchanged**: all 37 edit fields, `GET/PUT /api/students/:id`, `PATCH
  /api/students/:id/status`, the attachments panel, and the tab set.
- *Verification*: `npx vite build` clean. Needs a visual spot-check (hero facts wrap, tab bar
  scroll, discard-confirm) across widths.

### 2026-07-14 — New Profile (Student Admission) redesign + shared `FormShell` / `ConfirmModal`

Working the Student module in menu order; page 2 is **New Profile** (`StudentAdmission.jsx`) —
an 80-field, 11-section, 725-line admission form that was one long single-column scroll with the
Save button only reachable at the very bottom.

**New shared components**
- **`FormShell`** (`components/FormShell.jsx`, `styles/form.css`): the reusable long-form
  scaffold — `useScrollSpy`, a sticky **section jump-nav** (numbered, highlights the section in
  view, collapses to a horizontal strip on tablet/mobile), **`FormSection`** (anchored, titled,
  optional description/action, crimson leading edge), and a sticky **`FormActionBar`**.
  Deliberately **not** a wizard: fields never unmount, so the browser's native `required`
  validation still focuses the first invalid control on submit.
- **`ConfirmModal`** (`components/ConfirmModal.jsx`): promoted, tokenised confirm dialog
  (tone, Escape-to-close, focus management, click-outside) — the shared version the checklist
  called for; per-module copies get swept onto it later.

**Redesigned: New Profile (`StudentAdmission.jsx`)**
- *Navigation / orientation*: added the sticky **section nav** (Admission → Identity & Names →
  Personal → Parents → Guardian → Scholarship → Contact → Permanent/Communication Address →
  Bank → Mark Sheets) so an operator can jump straight to any group and always knows where they
  are in a long form.
- *Action placement*: Save/Cancel moved into a **sticky action bar** that's visible at every
  scroll position (was buried at the bottom); primary action recoloured to the brand primary.
- *Data-loss safety*: **unsaved-changes protection** — a `beforeunload` guard on refresh/close
  and a styled **discard-changes ConfirmModal** on Cancel; the guard releases on successful save.
- *Clarity*: relabelled the opaque "Personal 1 / Personal 2" sections to "Identity & Names" /
  "Personal Details"; the action bar states "Fields marked * are required" and flips to an
  "Unsaved changes" indicator once editing starts.
- *Consistency / states*: sections are now consistent tokenised cards (replacing raw Bootstrap
  `card`/`card-header`); loading + submit error states preserved.
- **Preserved unchanged**: every one of the ~80 fields, all option/degree cascades, the
  same-as-permanent-address mirror, the mark-sheet sub-table (add/remove rows), the
  `POST /api/students` payload shape + all native `required` validations, and navigation to the
  new profile on success.
- *Verification*: `npx vite build` clean; fixed a scroll-spy init bug (observer must attach only
  after the form mounts, i.e. once `loading` is false). No browser tool here — needs a visual
  spot-check of the sticky nav highlight + action bar on desktop/tablet/mobile.

### 2026-07-14 — Shared `DataTable` + Student search redesign

**New shared component: `DataTable`** (`components/DataTable.jsx`, `styles/datatable.css`)
The recurring problem across the survey was dense, unstyled, non-responsive tables with no
empty/loading/error states and hand-rolled pagination. Built one ERP table to fix all of them:
sticky header carrying the crimson signature underline, click-to-sort columns, optional
in-table search, client pagination with a "showing X–Y of N" summary, a **card view** that
replaces horizontal scrolling on phones, and built-in loading-skeleton / empty / error states.
Rows are keyboard-accessible (`role=button`, Enter/Space) and numeric columns use tabular
figures. Configured entirely via a `columns` array so every future list/report screen reuses it.

**Redesigned: Student search (`StudentList.jsx`)** — the front door to student records.
- *Layout / hierarchy*: replaced the cramped filter-sidebar + minimal result-card grid with a
  full-width **search panel** (segmented Roll-number / Course-batch toggle, proper labels +
  hints) over a full-width results table — a search-first flow that suits the actual task.
- *Table usability*: results were previously just Register-No + Name cards. Now a real table
  surfaces the data the API already returns — **Register No, Student Name, Course** (resolved
  from `courseId` via the loaded course list), **Admission Year, Admission No** — sortable, with
  an in-table filter once a batch returns >8 rows and pagination at 25/page. Click or keyboard
  on a row opens the profile.
- *States*: distinct empty states for "search to begin" vs "no matches"; loading skeleton;
  inline error with retry.
- *Responsive*: table collapses to stacked cards below 768px (no shrunk-desktop scroll).
- **Preserved unchanged**: `/api/students/courses` + `/api/students/search` contracts, roll
  (comma-separated) + batch search modes, in-flight request abort, auto-navigate on a single
  result, URL search-param state (`by`/`q`/`batch`), and the Module Hub / Export Report /
  New Profile actions.
- *Verification*: `npx vite build` clean; column fields validated against `studentSearch.js`
  and `studentCourses.js` output. (No browser tool in this environment — needs a visual
  spot-check on desktop + mobile widths.)

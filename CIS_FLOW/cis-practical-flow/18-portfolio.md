# 18 — Portfolio: Frontend Control & UX Audit

## 1. Module recap

Portfolio is a **read-only reporting** module (no `/save` route anywhere — every service file only
ever `SELECT`s) surfacing student publication/seminar data entered elsewhere in CIS: a college-wide
aggregate Dashboard by course/academic-year, and a per-student Individual Report for printing a
single student's portfolio. Two bespoke pages (neither uses the generic setup factory — both call
`api.post`/`api.get` directly with local `useState`/`useEffect`). Full field-by-field detail lives
in [`user-stories/18-portfolio.md`](../user-stories/18-portfolio.md) — read that first.

**Typo already flagged there, called out again here because it directly affects the UX
recommendations below**: the legacy PHP filename `student_portfolia_individual_report.php`
misspells "portfolio" as "**portfolia**," and the modern port **reproduces the misspelling
verbatim** in three user-visible places — the hub tile title (`"Portfolia Report"` in
`PortfolioModule.jsx`'s `extraLinks`), the page breadcrumb, and the `<PageHeader title="Portfolia
Report">`. This is not a legacy-parity requirement worth preserving (unlike, say, a database column
name or a save-payload key) — it's a **user-facing label typo** with zero downstream compatibility
cost to fixing, since nothing parses this string; it purely renders as text. Recommended fix:
correct the three occurrences to "Portfolio Report" in `PortfolioModule.jsx` and
`PortfolioIndividualReportPage.jsx`.

Because both screens are read-only, this audit's usual "does this input control support bulk
mutation" question doesn't apply the way it does for Certificates/NAAC/E-learning — the relevant
question here is instead "does this control help staff find and read data efficiently," which is
the lens the rest of this file applies throughout.

## 2. Frontend control inventory

| Screen | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Dashboard (`PortfolioDashboardPage.jsx`) | Two native `<select>`s (U.G year, P.G year) | No | Single per dropdown (one UG year + one PG year simultaneously) | No | "Go" submit button; stale-data-visible refresh overlay (dimmed old content + spinner, not a blanking reload); explicit retry-capable error banner |
| Individual Report (`PortfolioIndividualReportPage.jsx`) | Two radios (Roll No / Batch), text input **or** native `<select optgroup>` (batch mode), clickable button-list of matched students | Yes — roll-no field accepts a comma-separated exact-match list (no substring/fuzzy match) | Multi via comma-separated roll numbers in search; single selection from the resulting match list | No bulk action across matched students (view one student's detail at a time) | Auto-selects first match; per-student `GET .../student/:id` refetch on click (lighter than a full re-search); no pagination on the publications/seminars tables inside student detail |

Neither screen uses `SearchableSelect` or `CheckListSelect`. The Dashboard's two year `<select>`s
are short, bounded lists (a handful of academic years) where a plain native select is genuinely
adequate — this is one of the few dropdowns across all four audited modules where upgrading to a
searchable control would add complexity without real benefit. The Individual Report's batch
`<select optgroup>`, by contrast, groups by course and can contain many batch-year combinations
across all active courses — a better fit for `SearchableSelect` (see §3).

## 3. Advanced feature gaps

- **Individual Report's batch `<select optgroup>` has no search**, and per the user-stories'
  US-18.6, a stale/invalid course-key value in that dropdown fails **silently** (empty result list,
  no error). `SearchableSelect` would address the discoverability half of this directly (faster to
  find the right course+batch group in a long list); the silent-failure half is a server-response
  gap, not a control-type gap (see §4).
- **No pagination or row cap on the Individual Report's publications/seminars tables**
  (US-18.5) — for a highly prolific student (50+ publications), the two-row-per-publication table
  renders unbounded. None of the existing pagination patterns in the app (Certificates'
  `receipt-report`/`tc-details` use `pagination.page`/`pageSize`) are wired up here; this is a
  genuine feature gap, not a UI-polish item.
- **The roll-no search field requires exact comma-separated matches, no partial/fuzzy search** —
  unlike `SearchableSelect`'s substring matching used for dropdown options elsewhere, this is a
  free-text field matched exactly server-side. For staff who don't have the exact roll number
  memorized (e.g. searching by partial name), there's no alternative path in this module at all —
  worth flagging as a real search-capability gap, not just a control-widget swap.
- **No drag/checkbox/multi-select bulk actions anywhere in this module** — expected, given it's
  entirely read-only, but also means there's no way to select multiple students from a batch and
  export/print/compare their portfolios together; every action is single-student.

- **The two screens don't cross-link.** Nothing on the Dashboard's per-course publication/seminar
  breakdown links through to the Individual Report for a specific student or batch — a HOD looking
  at a course's aggregate counts on the Dashboard has no one-click path to drill into "which
  students in this course/year contributed those publications," and would have to separately
  switch screens and re-enter a batch search. A "View students" link from a course row on the
  Dashboard, pre-filling the Individual Report's batch search, would connect the two screens'
  otherwise-siloed data.

## 4. User-experience suggestions

- **Fix the "Portfolia Report" typo** (see §1) — a one-line, zero-risk fix in `PortfolioModule.jsx`
  (hub tile `title`) and `PortfolioIndividualReportPage.jsx` (breadcrumb + `PageHeader`). This is
  the most visible, most trivially-fixed issue in the module and should not wait for any larger
  redesign.
- **Drag-drop file attachment for portfolio evidence.** Today, publications/seminars are entered
  entirely outside this module's scope (this module is read-only), so there's no attachment upload
  UI here at all — but if/when a write-capable entry screen for `student_publication_tb`/
  `student_seminar_tb` is built (as the "Future" section of the user-stories doc already
  anticipates for a student self-service builder), a drag-drop zone for attaching supporting PDFs/
  certificates directly (rather than a plain filename text field, as NAAC's `quan` screen still
  uses today, per `17-naac.md` §3) would meaningfully lower the entry friction versus a bare file
  picker, and is worth designing in from the start rather than retrofitting later the way NAAC's
  `quan` screen now needs to be.
- **A visual portfolio preview / print-friendly layout.** Per US-18.5, the Individual Report has no
  dedicated print stylesheet (unlike Certificates' `printReport.js`/`ReportPrintBar` integration) —
  staff printing a student's portfolio today rely on the browser's default print rendering of the
  live, on-screen table. A dedicated `printHtml`/`ReportPrintBar` treatment (matching the pattern
  already standardized across Exam/Fees/Certificates per CLAUDE.md's "Print / reports" section)
  would let a student's portfolio print as a clean, paginated document — directly useful since this
  report's stated real-world use cases (placement, further-studies applications, NAAC evidence
  gathering) are exactly the scenarios where a polished printed/PDF output matters, not a raw
  on-screen table dump.
- **Pagination on the Individual Report's publication/seminar tables**, directly addressing
  US-18.5 — capping at ~25 rows with a simple page control (reusing the `pagination.page`/
  `pageSize` convention already used by Certificates' `receipt-report`/`tc-details`) prevents a
  highly prolific student's report from becoming an unmanageably long unpaginated table, and pairs
  naturally with the print-preview suggestion above (paginate on screen, but print the full set).
- **Surface an explicit "invalid batch selection" message**, addressing US-18.6 — today a stale
  course-key silently returns an empty student list indistinguishable from "no students in this
  batch." Since the server already has the information to detect this (`if (!courseId ||
  !admissionYear) return [];`), returning a distinct `error`/`message` field the client can render
  (`"This batch selection is no longer valid — please reload the course list."`) removes real
  ambiguity for staff who would otherwise wrongly conclude a batch is empty.
- **A visual flag for out-of-range publication months** (US-18.7) — rather than silently dropping
  to just the year (`-2023` → `2023`), rendering something like `"2023 (month unrecorded)"` when
  `p_month` falls outside 1–12 gives staff an honest signal that the data itself may need
  correction upstream, instead of looking like the field was simply left blank on purpose.

## 4b. Additional UX dimensions (validation, autosave, accessibility, mobile)

- **No autosave concerns (module is entirely read-only)** — worth noting explicitly as a
  contrast with the other three modules in this audit: since Portfolio has no `/save` route at
  all, none of the usual "unsaved changes" risks apply here. The only state worth protecting across
  a reload is the *current filter selection* (year, search mode, matched student) — a small
  `sessionStorage` remember-last-filters would let staff returning to the Dashboard after
  navigating elsewhere land back on the year they were just looking at, rather than resetting to
  the server's computed default every time.
- **Skeleton loading already partially solved.** The Dashboard's refresh-overlay pattern
  (dimmed stale content + spinner, not a full blank) is genuinely good UX and already better than
  most other screens in this audit — worth calling out as a **pattern to copy into other modules'
  dashboards** (e.g. E-learning's bespoke Dashboard, `19-elearning.md` §4, currently has no such
  overlay at all) rather than something Portfolio itself needs more of.
- **Keyboard navigation of the matched-student button list.** The Individual Report's clickable
  student list (`btn-success`/`btn-outline-secondary` rows) is a sequence of real `<button>`
  elements, which is a reasonable accessible baseline — but with no visible "currently focused" ring
  distinct from "selected," a keyboard user tabbing through a long batch result can lose track of
  where focus is versus which student's detail is currently showing. A distinct focus outline (not
  just the selected-state color) would resolve this ambiguity.
- **Accessibility of the photo `<img>`.** The 80×100 student photo needs a meaningful `alt` (e.g.
  `alt="{student name} photo"`) rather than a blank or generic alt — worth a quick check against the
  current implementation since the user-stories doc doesn't confirm the current `alt` text.
- **Mobile responsiveness of the two-column layout.** The Individual Report's filter-card-left,
  detail-cards-right layout (`col-md-8`/`col-md-4`-style split typical of this app's setup screens)
  will stack on narrow viewports by default via Bootstrap, but the Publications table's
  two-row-per-record, 10-plus-column layout is dense even on a laptop screen — on a phone this would
  need either a genuinely different mobile layout (stacked field/value pairs per publication) or an
  explicit "best viewed on larger screens" note, since a responsive table-scroll alone would not make
  this particular table pleasant to read on a small screen.

## 5. Quick wins vs bigger investments

**Quick wins (small diff, immediate win):**
- Fix the "Portfolia Report" typo in three places (`PortfolioModule.jsx`, breadcrumb, `PageHeader`).
- Swap the Individual Report's batch `<select optgroup>` for `SearchableSelect` (drop-in, same
  value/onChange contract, immediately helps with long course/batch lists).
- Return a distinct empty-vs-invalid message from `searchPortfolioStudents` for a malformed batch
  key (US-18.6) instead of a silent empty array.
- Render out-of-range `p_month` values with an explicit "(month unrecorded)" note instead of
  silently dropping to year-only (US-18.7).

**Bigger investments (needs design/product buy-in):**
- Dedicated print/export stylesheet for the Individual Report (`printHtml`/`ReportPrintBar`
  integration), matching the pattern already used by Exam/Fees/Certificates.
- Pagination for the publications/seminars tables inside student detail.
- A drag-drop attachment upload experience for the (not-yet-built) portfolio entry screens, and/or
  a visual portfolio preview layout distinct from the raw data table — both need product sign-off
  on scope, since neither has an existing write-capable screen to build on yet.
- A genuinely mobile-friendly layout for the Publications table (stacked field/value cards per
  publication rather than a scrollable 10-plus-column table) — needs design input on which fields
  are primary vs. secondary on a small screen.
- Propagating the Dashboard's dimmed-refresh-overlay pattern to other modules' dashboards (a
  cross-module consistency investment, tracked here since Portfolio is the module that originated
  the pattern worth copying).

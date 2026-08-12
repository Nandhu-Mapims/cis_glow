# 19 — E-learning: Frontend Control & UX Audit

## 1. Module recap

E-learning tracks online-class/assignment/test "sessions" (`activity_task_tb`) and the daily
time-window slots each activity type is allowed to run in (`activity_time_tb`). Five screens/routes:
a bespoke Dashboard, four factory screens (`elearn-setup`, `elearn-report`, `subject-test`,
`subject-report`). Full field-by-field detail lives in
[`user-stories/19-elearning.md`](../user-stories/19-elearning.md) — read that first.

**Bug already flagged there, directly relevant to the "clearer session/resource browsing"
suggestion below**: `ELEARNING_SCREEN_META['elearn-dashboard']` and `ElearningModule.jsx`'s
`COMPONENTS['elearn-dashboard']` both map the `elearn-dashboard` factory slug to `ElearnReportScreen`
— **the same plain report-table component used for `elearn-report`** — not to the real
`ElearnDashboardPage` with its summary tiles. The actual dashboard UI is only reachable via the
separate bespoke route `/elearning/dashboard`. Visiting `/elearning/setup/elearn-dashboard`
directly renders a plain filtered table, not the tile dashboard, which is confusing if a menu link
or bookmark points at the factory slug expecting dashboard behavior.

Other flagged gaps shaping the suggestions below:
- **US-19.8**: `subject-test`'s "recent sessions" table never populates in normal use — the
  `scheduleId` input has no `onChange`/`onBlur` wiring to re-trigger `onLoad`.
- **US-19.10**: `ElearnDashboardPage` has no `try/catch` around its load call — a failed request
  leaves the page stuck on its loading spinner indefinitely, unlike Portfolio's Dashboard which has
  an explicit retry-capable error banner.

## 2. Frontend control inventory

| Screen | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Dashboard (bespoke, `/elearning/dashboard`) | Native `<input type="date">`, "Refresh" button | No | Single (one date) | No | No error banner on failure (US-19.10); 200-row server cap with no "showing N of M" indicator; three summary tiles are non-mutually-exclusive counts |
| `elearn-dashboard` (factory slug, misrouted) | Same as `elearn-report` below (identical component reused) | — | — | — | See bug note in §1 — not actually a distinct screen today |
| `elearn-setup` (Activity Time Setup) | Read-only text cells (Type/Year) + **uncontrolled** `<input type="time">` per row (`defaultValue`, DOM read on save) | No | Per-row (each slot's From/To independent) | No "apply this window to all rows" | Save reads `document.getElementById(...)` directly, bypassing React state — an outlier pattern in this codebase |
| `elearn-report` | Native `<input type="date">`, native `<select>` (Course, "All courses" default) | No | Single date + single course filter | No | No pagination; no row cap (unlike the bespoke dashboard's 200-row cap) |
| `subject-test` | Seven generic text inputs (labels are raw camelCase field names, not humanized) + native `<input type="date">` | No | Single session being composed | No | Right-hand "recent sessions" table effectively always empty (US-19.8, no reload wiring) |
| `subject-report` | Native `<select>` (Session, `"Select session"` placeholder) | No | Single session | No | Selecting a session immediately reloads (`onChange` → `onLoad`); table has no pagination |

None of the five screens use `SearchableSelect` or `CheckListSelect`, and unlike NAAC there is no
drag-reorder or confirm-modal pattern anywhere in this module either — every control is a plain
native HTML element. `elearn-setup`'s uncontrolled `defaultValue` inputs are the one structurally
unusual pattern in this module relative to the rest of the app (which is otherwise consistently
controlled-component React).

## 3. Advanced feature gaps

- **`subject-test`'s form fields are unlabeled beyond raw property names** (`examName`,
  `subjectId`, `period`, `scheduleId`, `classInfo`, `materialLink1`, `assignmentLink` rendered
  verbatim as `<label>{k}</label>`), and several of them (`subjectId`, `scheduleId`) are almost
  certainly meant to be **selects populated from real subject/schedule data**, not free-text
  inputs — typing a raw numeric subject ID into a plain text box is exactly the kind of picker gap
  `SearchableSelect` exists to fix elsewhere in the app (course/subject pickers throughout
  Exam/Academic already use search-capable selects for this reason per CLAUDE.md's course-key
  table). This is the single biggest control-type gap in the module.
- **`elearn-report`'s Course filter is a plain `<select>` with no search** — for a large
  multi-course institution, this is a smaller-scale version of the same gap flagged in Certificates
  and NAAC's course pickers; `SearchableSelect` is a direct drop-in.
- **No bulk/multi-select anywhere** — e.g. `elearn-setup` cannot apply one From/To window to
  multiple slot rows at once; each of the (typically small, fixed) set of activity-type/year rows
  must be edited individually. Given the row count here is usually small (a handful of activity
  types × years), this is a lower-priority gap than the subject/course picker issues above.
- **`subject-test`'s never-populating "recent sessions" table (US-19.8) is a wiring gap, not a
  control-type gap** — the fix is adding an `onChange`/`onBlur` handler on the `scheduleId` input
  that calls `onLoad({ scheduleId })`, matching the reactive pattern already used by
  `subject-report`'s session `<select>` (`onChange` → immediate `onLoad`) one screen over in the
  same module.

## 4. User-experience suggestions

- **Clearer session/resource browsing.** The most concrete, module-specific gap: sessions across
  `elearn-report`/`subject-report`/the bespoke Dashboard show only `Session | Course | Subject |
  Period | Active` — the actual `material_link1`/`assignment_link`/`handle_link` values (the
  resources students are meant to access) are **never rendered as clickable links in any screen**
  (US-19.6). Adding a "Resources" column or expandable row showing the actual class-material/
  assignment links directly in the report/dashboard tables would let staff (and, per the module's
  future-facing student view idea) actually verify what a session links to, rather than trusting
  that a session "exists" without being able to see what it points at.
- **A progress/participation dashboard.** `subject-report` already shows per-session
  submission counts and per-student marks/status, but only one session at a time via a dropdown —
  there's no aggregate view of participation *trends* (e.g. "which subjects have low submission
  rates this week," "how many sessions has each staff member run"). Given the bespoke Dashboard
  already has the tile-summary pattern (`Classes/Materials`, `Assignments`, `Tests` counts) and
  `subject-report` already computes `totalSubmitted` per session, a combined view — participation
  rate per session plotted over the last N days, or a per-subject rollup — would turn today's
  disconnected "count of sessions" and "one session's submitters" views into something staff can
  actually act on (e.g. flagging a subject with consistently low engagement).
- **Fix the `elearn-dashboard` factory-slug routing bug** (§1). Whether the fix is pointing the
  factory slug at the real `ElearnDashboardPage` component, or removing the redundant slug
  entirely if legacy PHP treats them as genuinely separate screens, this should be resolved before
  any menu link is wired to `/elearning/setup/elearn-dashboard` expecting summary-tile behavior —
  otherwise staff following that link get a plain table with no explanation of why it looks
  different from the "Dashboard" they clicked.
- **Wire `subject-test`'s scheduleId field to actually query recent sessions** (US-19.8) — a small,
  concrete fix: add `onBlur={() => onLoad({ scheduleId: form.scheduleId })}` (or debounce on
  `onChange`), matching `subject-report`'s existing reactive-select pattern. This directly restores
  the screen's stated purpose of helping staff check for duplicate/near-duplicate sessions before
  creating a new one.
- **Give `ElearnDashboardPage` the same error-handling as `PortfolioDashboardPage`** (US-19.10) —
  wrap the load call in try/catch, set an error state, and show a retry-capable banner. This is a
  direct copy of an already-proven pattern one module over (`PortfolioDashboardPage.jsx`), not a
  new design.
- **Add an explicit "No sessions today" empty state** across the bespoke Dashboard and
  `elearn-report` (US-19.7) — both currently render a silently-empty `<tbody>` with no distinct
  message, making a genuinely empty day indistinguishable from a slow-loading one. NAAC's
  `quan-detailed-report` already has the pattern to copy (`"No data available"` in a spanning
  `<td>`).
- **Split the dashboard's "Classes/Materials" and "Assignments" tiles into mutually exclusive
  counts, or clearly label them as overlapping.** Per §3.1 of the user-stories doc, a single
  session with both a material link and an assignment link is counted in both tiles — this is
  arguably correct as "has this attribute" reporting, but a small footnote/tooltip ("counts are not
  mutually exclusive — a session can appear in more than one tile") would prevent staff from
  misreading the tiles as a session-type breakdown that sums to the total session count.
- **Populate `subject-test`'s subject/schedule fields from real pickers instead of raw-ID text
  inputs**, and correct the mismatch between what the current form collects and what
  `saveSubjectTest` actually supports (`courseName`, `courseId`, `academicYear`, `batchNo`,
  `semesterNo`, etc. are all accepted server-side but never populated by this UI). This is the
  single highest-value control upgrade in the module: turning free-text subject-ID entry into a
  `SearchableSelect` sourced from `basic_setup_subject_tb` both prevents typo'd IDs and unlocks the
  richer session metadata the backend already supports but the form doesn't expose.

## 4b. Additional UX dimensions (validation, autosave, accessibility, mobile)

- **Inline validation on `subject-test`'s required `examName` field.** Today the requirement
  (`"Session name is required"`) surfaces only on Save; a red-outline/inline hint on blur for this
  one required field would shorten the feedback loop, and is a natural companion to the picker
  upgrade recommended in §4 for `subjectId`/`scheduleId`.
- **Autosave risk on `elearn-setup`'s uncontrolled time inputs.** Because the From/To `<input
  type="time">` elements use `defaultValue` and are only read via direct DOM access at Save time
  (§2), there is no in-progress state to protect — but this also means a partially-filled edit
  session (some rows changed, not yet saved) leaves **zero** visual indicator of which rows have
  unsaved changes versus which reflect the last-saved value. Converting these to controlled inputs
  (tracking a `dirty` flag per row) would let the UI show "3 unsaved changes" before Save is
  clicked — both a UX clarity win and a prerequisite for any future autosave.
- **Skeleton loading for the report screens.** `elearn-report` and `subject-report` re-run
  frequently within a single staff session (changing date/course/session repeatedly); a
  table-shaped skeleton on filter change, rather than the current full-page spinner, would read as
  more responsive — the same recommendation made for NAAC's and Certificates' report screens,
  worth doing consistently across all three at once given the shared underlying pattern
  (`SetupPageShell`'s `loading` prop).
- **Keyboard/accessibility on the bespoke Dashboard's date input and Refresh button.** No specific
  issues were found in the reviewed markup beyond the missing error-handling (§4), but since this
  screen has no `try/catch`, a keyboard user hitting Refresh during a failed request currently gets
  no accessible error announcement (no `aria-live` region) — worth pairing the error-banner fix with
  an `aria-live="polite"` region so screen-reader users are told about the failure, not just sighted
  users reading a new banner.
- **Mobile responsiveness of `subject-test`'s two-column layout.** The `col-md-5`/`col-md-7` form
  vs. recent-sessions-table split will stack acceptably on mobile via Bootstrap defaults, but once
  the recent-sessions table is actually wired up (§4/§5), consider whether a mobile user would want
  the form or the table prioritized first in the stacked order — likely the form, since data entry
  is this screen's primary purpose and the recent-sessions table is a secondary duplicate-check aid.

## 5. Quick wins vs bigger investments

**Quick wins (small diff, immediate win):**
- Wrap `ElearnDashboardPage`'s load call in try/catch with a retry banner (direct copy of
  `PortfolioDashboardPage`'s existing pattern).
- Add "No sessions today" / "No data available" empty-state text to the bespoke Dashboard and
  `elearn-report` tables.
- Wire `subject-test`'s `scheduleId` field to trigger `onLoad({ scheduleId })` on blur/change,
  fixing the always-empty recent-sessions table (US-19.8).
- Swap `elearn-report`'s Course `<select>` for `SearchableSelect`.
- Add a tooltip/footnote clarifying the dashboard tiles' non-mutually-exclusive counting.

**Bigger investments (needs design/product buy-in):**
- Resolve the `elearn-dashboard` factory-slug vs. real Dashboard routing ambiguity (needs a
  decision: fix the mapping, or remove the redundant slug — check against legacy PHP first).
- Rebuild `subject-test`'s form to use real subject/schedule pickers (`SearchableSelect` sourced
  from `basic_setup_subject_tb`) and expose the currently-unused `courseName`/`academicYear`/
  `batchNo`/`semesterNo` fields the backend already supports.
- Add clickable resource links (material/assignment URLs) to the report/dashboard tables — a
  concrete, scoped version of "clearer session/resource browsing."
- Build a participation/progress dashboard aggregating submission rates across sessions/subjects
  over time, beyond today's single-session `subject-report` view.
- Convert `elearn-setup`'s uncontrolled time inputs to controlled state with per-row dirty tracking
  — a moderate refactor since it changes this screen's one structurally unusual pattern in the
  codebase, but needed as a prerequisite for any future autosave or "unsaved changes" indicator.
- Apply skeleton loading consistently across `elearn-report`/`subject-report` alongside NAAC's and
  Certificates' equivalent report screens — worth scoping as one cross-module pass rather than
  three separate small changes, since the underlying loading state (`SetupPageShell`'s `loading`
  prop) is shared infrastructure.

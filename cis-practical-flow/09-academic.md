# 09 — Academic Module: Frontend Control & UX Audit

## 1. Module recap

The Academic module (`client/src/pages/academic/`) is the registrar/academic-office surface for
courses, subjects, the institution academic calendar, two generations of weekly timetable
(`tt-config` legacy vs `tt-config-v3` newer), subject batches, period/time-slot configuration,
feedback rounds, internship scheduling, and 12 curriculum reports — 33 native screens dispatched by
one `AcademicSetupPage.jsx` router against a generic `POST /api/academic/setup/:screen/load|save`
contract. Full field-by-field detail (every button, table column, save payload, and edge case) lives
in [`../user-stories/09-academic.md`](../user-stories/09-academic.md); this file builds directly on
top of that and does not re-derive screen behavior — it only classifies *which input-control pattern*
each screen uses today and where that pattern is thin.

## 2. Frontend control inventory

Grep confirms: **neither `SearchableSelect` nor `CheckListSelect` is imported anywhere in
`client/src/pages/academic/`.** Every "pick from a long list" control in this module is either a
plain native `<select>`/`<optgroup>`, a native `<select multiple>` (only in the two `tt-config`
screens' legacy-HTML allocation modal), or `ChipMultiSelect` (checkbox-list-with-search, used in
exactly 3 files). This is the least control-upgraded module of the ones audited so far relative to
what already exists in `client/src/components/`.

| Screen (file) | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Course Directory (`AcademicCourseList.jsx`) | text `<input type="search">` + server search | Yes (server-side substring) | n/a (list) | No | Table + Prev/Next pager, "No courses found" empty state |
| Add Course (`CourseAddSetup.jsx`) | Native `<select>` (Course), native `<select>` (Department), radio pair (FT/PT), plain text inputs | No | Single | No | 12-field form, required-field validation only on submit |
| Edit/Delete Course (`CourseEditSetup.jsx`) | Search `<input>` + native `<select>`s (list/edit dual-mode) | Yes (list search) | Single | No | `ConfirmModal` on delete; Prev/Next pager in list mode |
| Academic Years (`AcademicYearsSetup.jsx`) | 3× native `<select>` (year), date inputs, radio (odd/even), **`ChipMultiSelect`** (Exam Academic Year) | Yes, only on the `ChipMultiSelect` (via `showSearch`) | Mixed — selects single, chip picker multi | Select-all/Clear (built into `ChipMultiSelect`) | Only screen in the module giving the newer multi-select treatment |
| Admission Exam Mapping (`AdmissionExamSetup.jsx`) | Native `<select>` (course-name key), per-row native `<select>` (exam name), 5 checkboxes/row | No | Single course; per-row checkboxes are independent toggles, not a set | No | `+` adds row, `ConfirmModal` on delete |
| Batch Color (`BatchColorSetup.jsx`) | `<input type="color">` + hex text input per batch row | No | n/a | No | Live contrast-computed text color preview |
| Feedback Topics (`FeedbackTopicSetup.jsx`) | `OptionPills` (category), inline-editable table | No | Single (pills) | No | `+` adds row, `ConfirmModal` on delete |
| Period Setup (`PeriodSetupSetup.jsx`) | Grouped native `<select>` (category), toggle-button group (Days), numeric inputs | No | Days = multi (toggle group, no search needed — small fixed list) | No (no select-all for days) | Preview → grid → Save All / Change two-step flow |
| Internship Schedule (`InternshipScheduleSetup.jsx`) | Grouped native `<select>` (course), pills (batch), per-row native `<select>`s (dept, room) | No | Single per field | No | Add row / per-row Delete |
| Feedback Setup UG/PG (`FeedbackConfigSetup.jsx`) | Native `<select>` (feedback round), `GroupedSelect` (course), **per-row checkbox list** (Staff, hand-rolled, not `ChipMultiSelect`/`CheckListSelect`) | No | Staff = multi (raw checkboxes via `toggleStaff`) | No | Staff checkbox list has no search — a real gap if a department has many faculty |
| Subject Categories (`SubjectMasterSetup.jsx`) | Native `<select>` (category), inline-editable table | No | Single | No | `+` row, `ConfirmModal` delete |
| Master Setup (`MasterSetupSetup.jsx`) | Native `<select>` (grouped `<optgroup>`), inline table w/ conditional U.G/P.G checkboxes | No | Single | No | Same pattern as Subject Categories plus a 2-checkbox degree toggle per row |
| Subject Setup (`SubjectSetupSetup.jsx`) | `CourseYearSelector` (shared, course_id-keyed), radio (Year), per-row native `<select>`s, nested per-row **`ChipMultiSelect`** (Department in Exam/Time Table sub-tables), checkbox (batchSplit) | Yes, only in the nested `ChipMultiSelect` department picker | Single fields; Department = multi | Select-all/Clear on the department `ChipMultiSelect` only | Most complex screen: 3-level nesting (subject → Exam rows / Time Table rows) |
| Student Batch Allocation (`SubjectBatchSetup.jsx`) | `CourseYearSelector`-style grouped `<select>`, radio (Year), numeric batch-count input, **checkbox grid** (student × batch, hand-rolled) | No | Mutually-exclusive checkbox grid (one batch per student, not a true multi-select) | Per-batch-column **header checkbox** bulk-assigns/unassigns all students to that batch | Print via `ReportPrintBar`; this is a bespoke grid, not `CheckListSelect` |
| Academic Calendar (`AcademicCalendarSetup.jsx`) | Grouped native `<select>` (month), per-date native `<select>` (event), **checkbox set** (course types, hand-rolled `toggleCourseType`), text input (comment) | No | Course types = multi (raw checkboxes) | No select-all for course types | One row per calendar day, no pagination (bounded to ~31 rows) |
| Subject Timetable/monthly (`SubjectScheduleSetup.jsx`) | Grouped `<select>` (course/year), `<select>` (subject), per-row native `<select>`s (staff, topic) | No | Single | No | Prev/Next month navigator; info/warning banners for empty months |
| Subject Unit/Chapter (`SubjectUnitSetup.jsx`) | Native `<select>`s (dept, course, unit incl. synthetic "+ Add new unit"), inline chapter table | No | Single | No | `+ Topic` button, `ConfirmModal` for saved chapters, plain `×` for unsaved |
| Subject Report (`SubjectReportSetup.jsx`) | `GroupedSelect` (course), `SemesterPills` (year), `SegmentedControl` (Time Table/Exam) | No | Single | No | Skeleton loader while generating; empty-state copy |
| Class Timetable Report (`TimetableReportSetup.jsx`) | `<input type="date">`, radio (Theory/Clinical) | No | Single | No | Go disabled until date chosen |
| Batch Timetable Report (`BatchTimetableReportSetup.jsx`) | Native `<select>` (exam), radio (Theory/Clinical) | No | Single | No | Print disabled until exam chosen |
| Weekly Timetable Grid — legacy (`TtConfigSetup.jsx`) | Native `<select>` (course/year, ungrouped-flat), radio (Year), **grid of clickable cells** opening a legacy-HTML modal containing raw `<select multiple>` fields (`tsub_batch_*[]`, `tsub_department_*[]`, `ttopic_*[]`) | No | Cell click = single target; the injected legacy multi-selects inside the modal are OS-native ctrl/cmd-click, no search | No | Modal HTML is server-built and injected via `dangerouslySetInnerHTML` — genuinely legacy, not a React control at all |
| Weekly Timetable Grid — new (`TtConfigV3Setup.jsx`) | Same clickable-grid + legacy-modal pattern as above, styled with `CurriculumFilterCard`/`SemesterPills` for the outer filter | No | Same native `<select multiple>` inside modal | No | Modal endpoint differs (`/tt-config-v3/more`) but same interaction shape |
| 12 Curriculum reports (`CurriculumReportScreen.jsx`) | Mixture per `type`: `LegacyDateTimeInput`+`DateTimeQuickChips`, `GroupedSelect`+`SemesterPills`, native `<select>` (feedback), `SegmentedControl`, **`ChipMultiSelect`** (Subject, feedback-course type only) | Yes, only in the `ChipMultiSelect` subject picker | Single for most filters; Subject = multi | Select-all/Clear on the Subject `ChipMultiSelect` | 9 distinct `filterType` layouts sharing one component; client-side "Generate" validation is silent (see §3) |

### 2a. Control-type frequency (33 screens + course directory)

| Control pattern | Screens using it | Notes |
|---|---|---|
| Plain native `<select>` (single, possibly grouped `<optgroup>`) | 25+ of 34 screens | The dominant pattern across the whole module |
| Native `<select multiple>` (OS-drawn box, ctrl/cmd-click) | 2 (`tt-config`, `tt-config-v3`, inside their legacy-HTML modals) | Worst-in-class control, and the only place raw legacy HTML is injected rather than a React form |
| `ChipMultiSelect` (search + multi, shared component) | 3 (`AcademicYearsSetup.jsx`, `SubjectSetupSetup.jsx`, `CurriculumReportScreen.jsx`) | The module's only genuinely modern multi-select pattern; not used consistently despite being available |
| Hand-rolled checkbox grid (bespoke per screen) | 3 (`SubjectBatchSetup.jsx` batch grid, `AcademicCalendarSetup.jsx` course types, `FeedbackConfigSetup.jsx` staff list) | Each reinvents its own toggle logic; none share code with `CheckListSelect` |
| `SearchableSelect` | 0 | Never imported anywhere in `client/src/pages/academic/` |
| `CheckListSelect` | 0 | Never imported anywhere in `client/src/pages/academic/` |
| `GroupedSelect` (module-local grouped select, distinct from `ExamSelectors.jsx`'s version) | 5 (`CurriculumReportScreen.jsx`, `curriculumReportUi.jsx`, `FeedbackConfigSetup.jsx`, `InternshipScheduleSetup.jsx`, `SubjectReportSetup.jsx`) | A parallel implementation of the same "grouped single select" idea as `CourseYearSelector` in the exam module — two components solving the same problem in two modules |
| Pills (`SemesterPills`/`OptionPills`/`SegmentedControl`) | 6 | Used for small, bounded option sets (years, categories); appropriate use — not a gap |
| `ConfirmModal` (delete confirmation) | 7 screens with row-level delete | Consistently applied wherever a persisted row can be deleted |
| `ReportPrintBar` | 6 report/print screens | Consistently applied across print-producing screens |

This confirms the module-wide pattern: **single-value pickers are almost universally plain
`<select>`s (fine for short lists, weak for long ones), and only 3 of 34 screens have adopted the
newer `ChipMultiSelect` for genuine multi-select needs** — everything else that needs multi-select
either uses the OS-native `<select multiple>` (worst case, `tt-config`) or a bespoke checkbox grid
built once per screen (`SubjectBatchSetup.jsx`, `AcademicCalendarSetup.jsx`,
`FeedbackConfigSetup.jsx`).

## 3. Advanced feature gaps

1. **Feedback Setup UG/PG staff picker (`FeedbackConfigSetup.jsx`) is a raw checkbox list with no
   search**, exactly the situation `CheckListSelect` was built for — a department can easily have
   20-40 faculty, and `data.categoryOptions`-style long-list search already exists two screens over
   (`ChipMultiSelect` in `SubjectSetupSetup.jsx`, `AcademicYearsSetup.jsx`). Swapping the hand-rolled
   `toggleStaff` checkbox grid for `ChipMultiSelect` would add search + select-all/clear for free,
   using the same component already proven in this module.

2. **`tt-config` / `tt-config-v3` allocation modals inject raw legacy `<select multiple>` HTML**
   (`tsub_batch_*[]`, `tsub_department_*[]`, `ttopic_*[]`) via `dangerouslySetInnerHTML` and wire it
   with vanilla DOM listeners (`ttConfigEditorShared.js`). This is the one place in the module that
   isn't even a React component — it's a server-rendered legacy form fragment. Batch/department
   lists here are frequently long (all departments, all batches for a course), and the browser's
   native multi-select box (small, no search, ctrl/cmd-click only) is the worst control pattern in
   the whole audit table. This is the single highest-value target for a `ChipMultiSelect`/
   `CheckListSelect` port — but doing so requires first rewriting the modal as a native React
   component (it currently only exists as bridged legacy HTML), which is a bigger lift than a
   drop-in swap.

3. **Academic Calendar's course-type checkboxes and Student Batch Allocation's batch-assignment
   grid are both hand-rolled, purpose-built widgets** (not reusable). They work correctly for their
   narrow shape (small fixed course-type list; mutually-exclusive batch assignment) but neither
   benefits from `CheckListSelect`'s built-in select-all/clear chrome — Student Batch Allocation
   *does* have bulk-assign via a per-column header checkbox, so it already has bespoke bulk actions;
   Academic Calendar's course-type checkboxes have no bulk toggle at all (see UX suggestion below).

4. **No screen in this module uses `SearchableSelect`** even though several single-value dropdowns
   are built from potentially long lists — e.g. Subject Unit's Unit `<select>`, Subject Schedule's
   Staff `<select>` in the nested topic table, Academic Calendar's Event `<select>`. These are
   currently native `<select>`s relying on browser type-ahead, which only jumps to the option
   starting with the typed letter (not substring search).

5. **`GroupedSelect` and `CourseYearSelector` (from the exam module, re-used here in
   `SubjectSetupSetup.jsx`) are two independently-implemented components solving the same "grouped
   single select" problem.** Academic has its own `GroupedSelect` (used by 5 screens) while also
   importing `CourseYearSelector` from `client/src/pages/exam/setup/ExamSelectors.jsx` for
   `subject-setup` — this cross-module import is itself a minor architectural smell (a shared
   selector living inside a feature module rather than `client/src/components/`), and having two
   near-duplicate implementations means a future upgrade (e.g. adding search) has to happen twice.

6. **No pagination on Academic Calendar's day grid or Period Setup's preview grid** — both are
   naturally bounded (≤31 days, ≤N periods) so this isn't currently a problem, but neither uses the
   `Prev`/`Next` pattern seen in Course Directory/Course Edit, meaning a long list here would have no
   fallback if the row count ever grew (e.g. a future per-week rather than per-month calendar view).

## 4. User-experience suggestions

1. **Visual timetable grid editor with drag-to-place, instead of dropdown-per-slot allocation.**
   Both `tt-config` and `tt-config-v3` already render a proper day×period grid
   (`data.grid.headers`/`data.grid.rows`) — the click-to-open-modal pattern is really "click a cell,
   fill 4-6 selects in a popup, save, close, re-click the next cell." A drag-to-place UI (drag a
   subject/staff chip from a sidebar palette onto a grid cell) would collapse dozens of modal
   round-trips into direct manipulation for a coordinator building out a full week's timetable —
   this screen is exactly the kind of dense, repetitive-allocation workflow that benefits most from
   direct manipulation over per-cell forms.

2. **Conflict highlighting for double-booked rooms/staff in `tt-config`/`tt-config-v3`.** Per
   user-stories EDGE-1 in the academic module (rare/edge-case #1), there is **no client-side or
   visible server-side conflict check** today — two coordinators can independently allocate the same
   room+slot for different courses. Highlighting a cell in red (or showing an inline warning in the
   allocation modal) the moment a chosen room/staff is already booked for that day/period would catch
   this before save, not after a printed timetable reveals the clash. This matters specifically here
   because the grid already has all the day/period/room context loaded client-side to make the
   check cheap.

3. **Bulk subject-batch assignment beyond the existing per-column header checkbox.**
   `SubjectBatchSetup.jsx` already supports "assign all students to Batch A" via the header checkbox,
   but there's no way to bulk-assign an arbitrary *subset* (e.g. "students 1-20 to Batch A, 21-40 to
   Batch B" by roll-number range) — today that's individual checkbox clicks per student. A "select
   roll range → assign to batch" control would speed up the common case of splitting a class
   alphabetically or by roll number into clinical batches, which is exactly the workflow this screen
   exists for.

4. **Search on Feedback Setup's staff checklist and Academic Calendar's course-type checkboxes.**
   Both are small hand-rolled checkbox sets today; swapping the staff list specifically for
   `ChipMultiSelect` (already used 3× in this module) directly addresses gap #1 above — a coordinator
   picking 8 of 35 faculty for a feedback round currently has to visually scan a flat list with no
   filter.

5. **Silent "Generate" no-op in curriculum reports needs a validation message.** Per user-stories
   §5.6, `CurriculumReportScreen.generate()` returns early with zero user feedback when required
   filters are missing (e.g. clicking Generate on Feedback Report without picking a subject). Because
   this module's report screens are used by non-technical academic-office staff running reports under
   time pressure, a silently-inert button reads as "the app is broken," not "you forgot a filter" —
   an inline `SetupAlerts`-style message ("Pick at least one subject") would resolve this with a
   one-line change to `generate()`.

6. **Planning-year fallback needs a visible banner, not a silent substitution.** Per user-stories
   §5.7, `resolveSubjectAcademicYear()` silently falls back up to 10 years to find a year with
   configured subjects when a synthesized "next year" planning option has none yet. A coordinator
   opening the newly-added planning year and seeing last year's subject list with no on-screen
   explanation could easily believe they're editing the *new* year's timetable when they're actually
   viewing/editing a prior year's data.

7. **Course-key-builder mismatch is a silent-failure risk unique to this module's density of key
   formats.** Per user-stories §5.2 and the CLAUDE.md pitfall table, Academic alone uses **four**
   different course-key builders (`courseIdYearKey`, `courseYearKey`, `subjectScheduleCourseKey`,
   `courseIdYearOnlyKey`) across its 33 screens. A lightweight runtime assertion (dev-mode console
   warning when a `<select>`'s emitted value fails the screen's own key parser) would turn "Year
   pills silently show 'No semester options found'" into an immediately-diagnosable error during
   development, without needing a schema redesign.

8. **Concurrent-save protection for the soft-delete-then-recreate pattern.** Per user-stories §5.4,
   Batch Color / Feedback Topics / Period Setup / Internship Schedule / Feedback Config all follow
   "soft-delete everything in scope, then re-insert" with no optimistic lock — a second admin's save
   can race the first's inserts. A simple `updated_at`-based version check (reject save with "this
   was changed by someone else, reload and retry" if the row set changed since load) would close this
   without redesigning the save flow.

9. **Skeleton loading is already partially adopted (Subject Report, curriculum reports) but not
   consistently applied to the setup screens.** `SubjectReportSetup.jsx` and
   `CurriculumReportScreen.jsx` show a skeleton loader while `generating && !html`, but the 20+
   setup screens (Subject Setup, Subject Batch, Timetable Grid, etc.) show no loading affordance
   between clicking a course/year selector and the dependent table/grid appearing — for the heavier
   screens (Subject Setup's 3-level nested tables, the timetable grids) a brief loading skeleton
   would reduce the perceived "did my click register?" uncertainty that a blank interval otherwise
   creates.

10. **Mobile/responsive gaps are structural, not incidental, for this module's densest screens.**
    The weekly timetable grid (`tt-config`/`tt-config-v3`), Subject Setup's nested Exam/Time Table
    tables, and Student Batch Allocation's N-column checkbox grid are all wide, multi-column tables
    that assume desktop width — per `mobile.md` (referenced in the underlying user-stories doc),
    this is explicitly out of scope for mobile v1, which is the right call given how information-
    dense these grids are, but it does mean tablet-width desktop users (a plausible admin-office
    device) get horizontal-scroll tables today with no responsive collapse/card-view fallback.

11. **Accessibility: hand-rolled checkbox grids lack `aria-label`/`role` wiring that the shared
    components already have.** `ChipMultiSelect` and `CheckListSelect` both set
    `role="listbox"`/`aria-multiselectable`/`aria-selected` (per the component source read for this
    audit); the bespoke grids in `SubjectBatchSetup.jsx` and `AcademicCalendarSetup.jsx` are plain
    `<table>`/`<input type="checkbox">` markup with no equivalent ARIA structure, meaning a screen-
    reader user gets a "checkbox, checkbox, checkbox" announcement with no indication of the grid's
    row/column semantics (which student, which batch).

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Swap `FeedbackConfigSetup.jsx`'s hand-rolled staff checkbox list for `ChipMultiSelect` (component
  already imported elsewhere in this module — drop-in swap).
- Add a validation message to `CurriculumReportScreen.generate()`'s silent early-return paths.
- Add a visible "Showing data from {year} — {requestedYear} has no subjects configured yet" banner
  when the planning-year subject fallback fires.
- Add select-all/clear to Academic Calendar's course-type checkbox set (small, bounded list — a
  lightweight bespoke toggle, not a full `CheckListSelect` port).
- Swap a handful of native `<select>`s with genuinely long option lists (Subject Unit's Unit picker,
  Academic Calendar's Event picker) for `SearchableSelect`.

**Bigger investments (needs design/product buy-in first):**
- Rewriting the `tt-config`/`tt-config-v3` allocation modal from legacy-HTML-injection into a native
  React component — a prerequisite for both the `ChipMultiSelect` control upgrade and any drag-to-
  place grid redesign; touches the biggest remaining PHP-bridge-shaped surface in this module.
- A drag-to-place visual timetable editor replacing the click-cell-open-modal flow — a genuine UX
  redesign, not a control swap, and needs product sign-off on the interaction model before build.
- Server-side (or at minimum client-visible) room/staff conflict detection across `timetable_tb`/
  `timetable_tb_new` — requires a new query path and a decision on whether conflicts block save or
  only warn.
- Roll-number-range bulk assignment for Student Batch Allocation — a new UI affordance on top of the
  existing checkbox grid, needs a decision on how ranges interact with the existing per-column
  header-checkbox bulk action.
- Optimistic-lock/versioning across the five soft-delete-then-recreate curriculum setup screens —
  touches the shared save pattern (`del=0`→`del=1` sweep) used across multiple services, so needs a
  consistent approach agreed once rather than five one-off fixes.

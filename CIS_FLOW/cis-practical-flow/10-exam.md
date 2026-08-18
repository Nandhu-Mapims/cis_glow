# 10 — Exam Module: Frontend Control & UX Audit

## 1. Module recap

The Exam module (`client/src/pages/exam/`) runs internal/continuous-assessment exams: exam-name
master, per-course exam configuration (`term_exam_setup.php`-style, **course_name**-keyed), student
batching for practicals (`exam_batch.php`-style, **course_id**-keyed — a distinct, easy-to-confuse
key format per CLAUDE.md), scheduling with invigilator assignment, OMR mark-sheet generation/upload,
mark entry, no-due clearance, examiner management, exam-attendance capture, camp/clinical activity
logging, SMS notification, and a large family of print/analysis reports — roughly 30 native screens
dispatched by `ExamSetupPage.jsx` against `POST /api/exam/setup/:screen/load|save`. Full field-by-
field detail (every table column, save payload, and edge case, including the exact key-format
confusion documented as EDGE-1) lives in
[`../user-stories/10-exam.md`](../user-stories/10-exam.md); this file builds on top of that and
classifies which input-control pattern each screen uses today.

## 2. Frontend control inventory

Grep confirms: **neither `SearchableSelect` nor `CheckListSelect` is imported anywhere in
`client/src/pages/exam/`.** `ChipMultiSelect` appears in exactly one file (`ExamScheduleSetup.jsx`,
for Batch and Invigilator pickers). Every other multi-value need in this module — the examiner
batch grid, the exam-batch student-batch grid — is a hand-rolled checkbox table, not a shared
component. Nearly every screen shares two purpose-built selector components from `ExamSelectors.jsx`:
`ExamSelector` (grouped native `<select>` for exam) and `CourseYearSelector`/`CourseSemesterSelector`
(grouped native `<select>` or radio pills for course/semester) — these are consistent across the
module but are themselves plain native controls, not searchable ones.

| Screen (file) | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Exam Names (`ExamNameSetup.jsx`) | Inline-editable table, per-row native `<select>` (Month) | No | Single per field | No | `+` adds row, `ConfirmModal` delete; **full-replace soft-delete** on every save (EDGE-6) |
| Term Exam Setup (`TermExamSetup.jsx`) — **course_name-keyed** | `CourseYearSelector` (grouped native `<select>`), per-row native `<select>` (exam name), checkboxes, date/text inputs | No | Single | No | `+` row, `ConfirmModal` delete; writes `cia_setup` |
| Exam Batch Allocation (`ExamBatchSetup.jsx`) — **course_id-keyed** | `CourseYearSelector` (wide, grouped), radio (Year), numeric input (Batch) + Go, **checkbox grid** (student × batch letter, hand-rolled, mutually exclusive via `toggleBatch`) | No | Grid = mutually-exclusive single-pick-per-row, not a true multi-select | No column-level bulk-assign (unlike Academic's `SubjectBatchSetup.jsx`, which has a header checkbox) | `ReportPrintBar`; writes `cia_batch_tb` — this is the screen most at risk of the course_id/course_name key-format mix-up (EDGE-1) |
| Mark Entry (`MarkEntrySetup.jsx`) | `ExamSelector`, `CourseSemesterSelector` (radio pills), native `<select>` (Subject, color-coded when marks exist), per-student plain text inputs (I/V/E marks) | No | Single | No | No autosave, no keyboard-driven tab-to-next-roll; marks silently cleared client-side if over max |
| Exam Schedule (`ExamScheduleSetup.jsx`) | `ExamSelector`, course/semester radio pills, `<input type="date">`, custom `SessionToggle` (2-button FN/AN), **`ChipMultiSelect`** ×2 (Batch, Invigilator) | Yes — Invigilator always shows search; Batch only if `>6` options | Batch/Invigilator = multi via `ChipMultiSelect` | Select-all/Clear built into `ChipMultiSelect` | The one screen in this module using the shared multi-select component; invigilator list silently truncated to 25 chars server-side (EDGE-7), not surfaced in the UI |
| Mark Sheet Print (`MarkSheetSetup.jsx`) | `ExamSelector`, course/semester selectors, per-row **Print** button | No | Single | No | Opens a raw `GET` popup window (`window.open(...,'Report',...)`), not `printReportHtml` |
| OMR Mark Upload (`MarksUploadSetup.jsx`) | `<input type="file" multiple accept=".jpg,.jpeg,.gif">` | n/a | Multi-file | No | Per-file base64 read, per-file success/fail alert rows |
| OMR Layout Config (`OmrConfigSetup.jsx`) | Plain text inputs (pixel offsets), singleton form | No | n/a | No | No list/delete — single record, `id=1` |
| No Due Verification (`ExamNodueSetup.jsx`) | `ExamSelector` (current-year only), course/semester pills, per-cell native `<select>` (clearance status) | No | Single per cell | No | Dynamic page size (`pageSizeForSubjects`), Prev/page-number/Next pager; no fee cross-check (EDGE-3) |
| Exam Examiners (`ExamExaminersSetup.jsx`) | `ExamSelector`, course/semester, native `<select>` (Subject, highlighted when configured), per-row text/textarea inputs | No | Single | No | Cross-screen nudge link to Examiner Setup when master data missing |
| Examiner Setup (`ExaminerSetupSetup.jsx`) | `CourseYearSelector` (course-name-keyed), radio pills (Year), **checkbox grid** (examiner type × batch, hand-rolled, mutually exclusive per row via `disabled` logic) | No | Grid = mutually-exclusive single-pick-per-row | **Per-batch-column header "Select" checkbox** bulk-selects that batch for every eligible row | Client-side validation blocks save with no batch/type picked at all |
| Camp Activity Add (`CampActivityAddSetup.jsx`) | Checkboxes (Type), `datetime-local` ×2, `<input type="file">` (single attachment) + `<input type="file" multiple accept="image/*">` (gallery), radio (Web View) | No | Type = multi (raw checkboxes) | No | Reset button (native `type="reset"` + manual state clear) |
| Camp Activity Edit (`CampActivityEditSetup.jsx`) | Search `<input>` + table (list mode); same field set as Add plus radio (Status) and a gallery management sub-table (per-photo Order/Title inputs + **select checkbox**) | Yes (list search) | Single; gallery select checkboxes are multi | **"Delete Selected Gallery"** bulk action on checked photos | Prev/Next pager in list mode; `ConfirmModal` on delete |
| Camp Activity Type (`CampActivityTypeSetup.jsx`) | Inline-editable table + dynamic "add new" rows | No | Single | No | Typing into the last blank row auto-reveals another via `+` |
| Attendance Entry (`AttendanceEntrySetup.jsx`) | Same paginated selector+column-per-subject table pattern as No Due, free-text % inputs | No | Single per cell | No | Prev/Next pager |
| Sheets Upload (`SheetsUploadSetup.jsx`) | `<input type="file">` (client-validated ext/size before any request) | n/a | Sequential single-file uploads | No | Progress bar per file; rejected files never reach the server (EDGE-8), mixed into the same results list as server responses |
| Exam SMS (`ExamSmsSetup.jsx`) | `ExamSelector`, course/semester selectors, confirm-modal-gated **Send SMS** button | No | n/a (batch send, not a selection control) | n/a | Recipients sent one-at-a-time with a live progress bar, not a true bulk API call |
| Exam Dashboard (`ExamDashboard.jsx`) | No input controls — static widget with Print/Refresh/Back | n/a | n/a | n/a | `sessionStorage` client cache, server in-memory cache + inflight-dedup |
| Student Exam Statement (`ExamStudentStatement.jsx`) | Plain text `<input>` (register number) | No | Single | No | Raw legacy-form re-POST wiring inside the injected HTML |
| Term Report / Statement / Progress Card / Report Analysis (`ExamReportScreen.jsx`, shared) | `ExamSelector`, course/semester selectors, Go button | No | Single | No | Read-only; no `save()` ever called |
| Report Analysis v1 (`ReportAnalysisV1Setup.jsx`) | `ExamSelector`, course/semester selectors | No | Single | No | Multiple conditionally-rendered result tables, no editing |
| Schedule/Invigilator Print (`SchedulePrintSetup.jsx`, `InvigilatorPrintSetup.jsx`) | `ExamSelector`, radio (Theory/Clinical [/Session]) | No | Single | No | Print-only, `printReportHtml` |
| Sheets Status / Mark Sheet Status / Mark Sheet Received (readOnly reports) | Date inputs, text `<input>` (Batch ID), checkbox groups (Marks/Status filters), `ExamSelector`/course-semester where applicable | No | Filter checkboxes = multi (raw, small fixed lists) | No | Deep-link via URL query (`batchId`), status badges, some columns unwired placeholders |

### 2a. Control-type frequency (~30 screens)

| Control pattern | Screens using it | Notes |
|---|---|---|
| `ExamSelector` / `CourseYearSelector` / `CourseSemesterSelector` (shared, `ExamSelectors.jsx`) | ~20 of ~30 screens | The module's dominant single-select pattern — plain native `<select>`/radio pills under the hood, no search |
| `ChipMultiSelect` (search + multi) | 1 (`ExamScheduleSetup.jsx`, used twice — Batch and Invigilator) | The only screen in the module with a modern multi-select |
| Hand-rolled checkbox grid (bespoke per screen) | 2 (`ExamBatchSetup.jsx` batch grid, `ExaminerSetupSetup.jsx` examiner-type/batch grid) | Structurally similar to each other and to Academic's `SubjectBatchSetup.jsx`, but implemented independently three times across two modules |
| `<input type="file">` | 4 (`MarksUploadSetup.jsx`, `SheetsUploadSetup.jsx`, `CampActivityAddSetup.jsx`, `CampActivityEditSetup.jsx`) | Client-side validation only in `SheetsUploadSetup.jsx` (ext/size); the others rely on server-side rejection |
| `SearchableSelect` | 0 | Never imported anywhere in `client/src/pages/exam/` |
| `CheckListSelect` | 0 | Never imported anywhere in `client/src/pages/exam/` |
| `ConfirmModal` | 3 screens (`ExamNameSetup.jsx`, `ExamScheduleSetup.jsx`, `TermExamSetup.jsx`) plus `CampActivityEditSetup.jsx`'s list-mode delete | Notably *not* used by `ExamBatchSetup.jsx`, `ExaminerSetupSetup.jsx`, or the mark-entry-family screens, none of which have row-level delete in the same sense |
| `ReportPrintBar` | 7 screens | Consistently applied; `MarkSheetSetup.jsx` is the one print screen that bypasses it in favor of a raw `window.open` popup |
| Confirm-modal-gated destructive/bulk action (not row delete) | 1 (`ExamSmsSetup.jsx`'s Send SMS confirmation) | The only "confirm before bulk side-effect" pattern in the module, appropriately used given SMS sends cost money/carrier quota |

Compared to the Academic module (§09), Exam has an even lower rate of shared-multi-select adoption:
**only 1 of ~30 screens uses `ChipMultiSelect`**, versus 3 of 34 in Academic. Both modules show zero
adoption of `SearchableSelect`/`CheckListSelect`.

## 3. Advanced feature gaps

1. **Exam Batch Allocation's student×batch grid has no bulk-assign, unlike the structurally
   identical grid in Academic's `SubjectBatchSetup.jsx`.** Both screens render the same shape (one
   row per student, one column per batch letter, mutually-exclusive checkboxes), but only the
   Academic version has a per-column header checkbox to assign/unassign an entire batch at once.
   Exam Batch Allocation (`ExamBatchSetup.jsx`) requires clicking every student individually even
   for the common "assign the whole remaining class to Batch D" case. This is a proven pattern one
   screen over in a sibling module — porting the header-checkbox bulk-assign is a same-shape,
   low-risk change.

2. **Mark Entry has no keyboard-driven flow between roll numbers.** `MarkEntrySetup.jsx` renders a
   plain HTML table of `<input>`s in DOM row order with no explicit `onKeyDown` handling — native
   Tab order technically moves left-to-right through cells, but there's no Enter-to-next-row shortcut,
   no auto-advance after a 2-character internal mark is complete, and no visual focus ring styling
   tuned for rapid entry. For a faculty member entering marks for 60+ students in one sitting, this
   is the single highest-friction screen in the module purely from a data-entry-speed standpoint.

3. **No autosave anywhere in Mark Entry, Exam Schedule, No-Due, or Attendance Entry** — all four are
   long, session-based, table-heavy entry screens (60+ students, one row each) with a single **Save**
   button at the bottom and no periodic persistence. A lost network connection, an accidental tab
   close, or a session-timeout mid-entry loses the entire unsaved table for these specifically
   long-lived screens.

4. **Exam Batch vs. Term Exam Setup have no visual distinction in the UI despite EDGE-1's real
   correctness risk.** Per user-stories EDGE-1, these two screens use *different table and key
   formats* (`cia_batch_tb`/course_id vs `cia_setup`/course_name) but render visually near-identical
   "Course & Academic year" selectors with no styling, badge, or copy difference signaling which
   mode you're in. This is a pure UI/copy gap, not a control-type gap — see UX suggestion #2 below.

5. **No search on any of this module's grouped course/exam `<select>`s.** `ExamSelector` and
   `CourseYearSelector` (`ExamSelectors.jsx`) both render plain `<optgroup>`-grouped native
   `<select>`s with no search box, used by nearly every screen in the module. A college with many
   active exams/degree programs (the grouping already implies multiple `optgroup`s per dropdown)
   would benefit from `SearchableSelect` here exactly as it's already used to solve this in other
   modules — but this is a module-wide, ~15-screen change since `ExamSelector`/`CourseYearSelector`
   are shared components, so fixing it once fixes it everywhere.

6. **Examiner Setup's grid has a header-checkbox bulk-select but no equivalent "clear all" per
   column** — the "Select" checkbox in each batch column only ever *sets* that batch for eligible
   rows; there's no symmetric way to bulk-clear a column once selections exist, forcing individual
   unchecking (or the awkward workaround of unchecking a different batch's Select box, which doesn't
   touch already-set rows in this column).

7. **Mark Sheet Print's raw `window.open` popup bypasses the module's own `printReportHtml`
   convention** — every other print-producing screen in this module (`ExamBatchSetup.jsx`,
   `ExamReportScreen.jsx`, `ReportAnalysisV1Setup.jsx`, `MarkSheetReceivedSetup.jsx`,
   `MarkSheetStatusSetup.jsx`, `AttendanceReportSetup.jsx`, `ExamAttendanceCertificateSetup.jsx`)
   uses `ReportPrintBar` + `printReportHtml`, which per CLAUDE.md's print rules deliberately avoids
   `window.open(..., 'noopener')` so `win.print()` still works. `MarkSheetSetup.jsx` instead calls
   `window.open('/api/exam/marksheet/print?...', 'Report', 'scrollbars=1')` directly against a `GET`
   endpoint that self-triggers `window.print()` via `<body onload>` — functionally fine today (it is
   legacy-parity behavior per user-stories §3.11), but it means this one screen's print path can't
   benefit from any future centralized print-flow change (error handling, print-mode CSS injection)
   made to `printReportHtml` without a separate fix.

8. **No screen in this module offers a "preview before send" gate finer than the existing confirm
   modal for Exam SMS.** `ExamSmsSetup.jsx` shows a recipient preview table before sending, which is
   good, but the confirm modal itself is a single generic "Are you sure to send SMS..." — there's no
   quick way to exclude an individual recipient from the batch at confirm time (e.g. a student whose
   number is known to be wrong) short of leaving the screen and adjusting the course/semester filter,
   which would drop the entire recipient set rather than one row.

1. **Bulk batch-letter assignment for Exam Batch Allocation.** As noted in gap #1, porting the
   header-checkbox pattern already proven in Academic's `SubjectBatchSetup.jsx` directly reduces
   click count for the exam cell staff workflow of splitting a large clinical class into batches —
   this is the module's single highest-volume manual-checkbox screen (one click per student per
   batch today).

2. **A clearer visual distinction between the `exam_batch.php`-style (course_id) and
   `term_exam_setup.php`-style (course_name) screens.** Given EDGE-1's documented risk — a developer
   or future agent wiring the wrong course-key builder into either screen silently corrupts
   `cia_batch_tb.course_id` or `cia_setup.course_name` with no exception thrown — the *runtime UI*
   should carry the same distinction the code already has internally. Concretely: a small badge or
   subtitle under the "Course & Academic year" label reading "Batch Allocation — grouped by
   course/degree" vs. "Term Exam Setup — grouped by course type" (echoing each screen's actual
   `optgroup` grouping style, which already differs: exam-batch groups by
   `course_name | degree_name | dept | FT/PT | type`, exam-setup groups by plain course name)
   would give staff a visible cue they're on the right screen before they ever touch the dropdown —
   catching operator confusion, not just developer confusion, since both screens' entry points sit
   next to each other on the Exam Setup Hub.

3. **Autosave for long Mark Entry / Exam Schedule / No-Due / Attendance Entry sessions.** These four
   screens share the same shape — a single big table, one save button at the end, tens of rows filled
   in over several minutes. A periodic silent autosave (e.g. every 30-60s, or on blur-out of a row)
   would protect against exactly the kind of lost-session risk these screens are most exposed to,
   given they have no autosave today and a single client-side Save gate.

4. **Keyboard-driven marks entry (tab/Enter between roll numbers) in Mark Entry.** Concretely: Enter
   in the last enabled mark field of a row should move focus to the first enabled mark field of the
   next row (not just rely on native Tab order, which currently also has to pass through the
   read-only Total/Result cells). For a faculty member entering marks for an entire class, this
   converts the workflow from mouse-click-per-cell to a fast keyboard rhythm — exactly the kind of
   screen where this pattern earns its complexity, unlike a rarely-touched config form.

5. **Inline validation for out-of-range marks, replacing the current silent-clear behavior.**
   Per user-stories §3.9/EDGE-2, when a typed mark exceeds its configured maximum, `normalizeMarkInput`
   / the max-length input attributes simply prevent or clear the value with no visible feedback — a
   faculty member fat-fingering "45" into a field capped at "40" (maxLength 2 wouldn't even stop
   that) currently gets silent truncation rather than a red-bordered field + tooltip explaining why.
   Given EDGE-2 already documents how easy it is to conflate 'A' (absent) and 'NA' in the same tiny
   input, visible inline validation matters doubly here — it's the only screen in the module where a
   silent data-shape mismatch (absent vs. not-applicable) has already been flagged as a real risk.

6. **Surface the 25-character invigilator-list truncation (EDGE-7) in the `ChipMultiSelect` itself.**
   `ExamScheduleSetup.jsx`'s Invigilator picker is this module's one screen already using the shared
   `ChipMultiSelect` — its `max` prop (already supported by the component per
   `client/src/components/ChipMultiSelect.jsx`) could be set to reflect roughly how many staff IDs
   fit in 25 characters, or at minimum the picker's `footer` slot could render a live "≈N more will
   be truncated on save" warning as selections grow, rather than the current silent server-side
   `.slice(0, 25)` that only shows up later on the printed invigilator roster.

7. **Distinguish client-side-rejected files from server-acknowledged results in Sheets Upload.**
   Per EDGE-8, `SheetsUploadSetup.jsx` mixes "you picked a .png" (client-only rejection, never sent)
   into the same results list styled identically to genuine server responses — a distinct visual
   treatment (e.g. a grey/neutral badge for client-side rejections vs. green/red for server
   responses) would let exam cell staff immediately tell "this file never left my browser" from
   "the server processed and rejected this file," which matters for a screen whose whole job is
   tracking upload provenance for OMR sheets.

8. **Symmetric bulk-clear for Examiner Setup's per-column "Select" checkbox.** Addressing gap #6:
   making the header checkbox a true toggle (checked = all-selected-in-column, unchecking clears the
   column) rather than a fire-once "select all" action would match the mental model users already
   have from the equivalent header checkbox elsewhere in the app.

9. **Per-recipient exclusion in Exam SMS's preview table.** Addressing gap #8: adding a per-row
   "exclude" checkbox to the recipient preview table (with a running "Sending to N of M" count) would
   let exam cell staff drop a known-bad number without abandoning the whole batch — a small addition
   to an already-rendered table, not a new screen.

10. **Route Mark Sheet Print through the shared `printReportHtml` convention where feasible.**
    Even preserving the `<body onload="window.print()">` auto-trigger behavior for legacy parity
    (per gap #7), wrapping the popup open in the same helper used elsewhere would centralize any
    future print-flow fix (e.g. error handling when the endpoint 404s) instead of leaving this one
    screen on a bespoke path.

11. **Accessibility: the hand-rolled batch/examiner grids lack the ARIA structure the shared
    `ChipMultiSelect` already provides.** `ChipMultiSelect` sets `role="listbox"` /
    `aria-multiselectable` / `aria-selected` on its items; `ExamBatchSetup.jsx`'s student×batch grid
    and `ExaminerSetupSetup.jsx`'s examiner-type×batch grid are plain `<table>`/checkbox markup with
    no equivalent semantics — a screen-reader user navigating either grid gets an undifferentiated
    stream of "checkbox" announcements rather than row/column context (which student, which batch).

12. **Mobile/responsive scope.** Per `mobile.md` (as cited in the underlying user-stories doc), a
    read-only mobile exam schedule/results view is explicitly scoped for a future phase, with all
    setup/admin screens (everything audited in this file) staying web-only — appropriate given how
    wide and checkbox-dense screens like Exam Batch Allocation, Exam Schedule, and the No-Due/
    Attendance-Entry column-per-subject tables are; none of them have a responsive collapse today,
    and building one for admin-only desktop workflows is lower priority than the mobile read-only
    view already planned.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Port the header-checkbox bulk-assign column pattern from Academic's `SubjectBatchSetup.jsx` into
  `ExamBatchSetup.jsx` — same grid shape, proven pattern, one file to change.
- Add a subtitle/badge distinguishing Exam Batch Allocation from Term Exam Setup on both the Exam
  Setup Hub cards and each screen's own header — pure copy/styling change, directly mitigates a
  documented (EDGE-1) correctness risk.
- Make Examiner Setup's per-column "Select" checkbox a true toggle instead of a fire-once action.
- Add a live truncation warning to `ExamScheduleSetup.jsx`'s Invigilator `ChipMultiSelect` via its
  existing `footer`/`max` props — no new component needed.
- Visually distinguish client-rejected vs. server-processed rows in `SheetsUploadSetup.jsx`'s results
  list.

**Bigger investments (needs design/product buy-in first):**
- Keyboard-driven marks entry (Enter-to-next-row, focus management across conditional I/V/E columns)
  in `MarkEntrySetup.jsx` — needs UX design for exactly which keys do what given the columns are
  conditional per exam config.
- Inline out-of-range / absent-vs-NA validation styling in Mark Entry — needs a decision on where the
  validation message appears (inline tooltip vs. banner) and whether it should block Save or only warn.
- Autosave across Mark Entry / Exam Schedule / No-Due / Attendance Entry — a shared mechanism (likely
  a debounced background save or local-storage draft) that would need to be built once and reused
  across all four screens, plus a decision on how autosave interacts with the existing soft-delete-
  then-recreate save semantics.
- Module-wide swap of `ExamSelector`/`CourseYearSelector` (shared across ~15 screens) from native
  `<select>` to `SearchableSelect` — high leverage (fixes every screen at once) but touches a widely-
  shared component, so needs regression testing across the whole module before rollout.
- Any true multi-select bulk-assign rework of Exam Batch's/Examiner Setup's mutually-exclusive grids
  into a friendlier interaction (e.g. drag-select a range of students) is a bigger redesign than the
  quick-win header-checkbox port, and would need product input on whether mutual exclusivity is even
  the right constraint to keep.

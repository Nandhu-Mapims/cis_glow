# 05 — Students — Frontend Control & UX Audit

## 1. Module recap

The Students module (`client/src/pages/students/`) covers search, admission, profile
edit/status, attachments, photos, ID cards, address labels, collage/group-photo tools,
academic promotion, the ad-hoc export report builder, and the alumni sub-flow. Full
field-by-field detail, legacy `.php` mapping, and user stories live in
[`user-stories/05-students.md`](../user-stories/05-students.md) — this file assumes that
research and only adds a control-pattern inventory and UX audit on top of it.

---

## 2. Frontend control inventory

| Screen (component) | Control type(s) used | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| `/students` search (`StudentList.jsx`) | Native `<select>` w/ `<optgroup>` (batch mode); text input (roll mode); `DataTable` for results | No on select; browser type-ahead only | Single | No | `DataTable` gets `searchable={students.length > 8}`, `pageSize={25}`, sortable Register No column; two named empty states (pre-search vs. no-results); tab-style mode switch (Roll no. / Course-batch) driven by URL `?by=` |
| `/students/new` admission (`StudentAdmission.jsx`) | 12 native `<select>`s (Batch, Degree, Course, Father/Mother Title, Blood Group, Religion, Community, State ×2, Bank, Mark-sheet Program per row); radio groups (Source, Student Title, Gender, Scholarship Type); plain text/date inputs; editable mark-sheet table with add/remove rows | No | Single per select | No | `FormSectionNav` scroll-spy left rail over 11 sections; "Same as P.Addr." checkbox auto-mirrors 7 fields via `useEffect`; dirty-state note; `ConfirmModal` on Cancel-with-changes; `beforeunload` guard; toast/banner on save error |
| `/students/:id` profile (`StudentProfile.jsx`) | Tab bar (4 tabs); Edit tab = all plain text `<input>`s, no selects at all; Status tab = date/number/textarea | No | n/a | No | Dirty-dot indicator on Edit tab; `ConfirmModal` on tab-away while dirty; **Reset** button restores form from server copy; status pill computed client-side from zero-date sentinel |
| `/students/reports` (`StudentReport.jsx`) | Native `<select>` (Course, Year/Batch); radio groups (Search-by, Show, Print options); bespoke grouped **checklist-with-search** for column picker (own implementation, not `CheckListSelect`) + custom-field text input + ordered list with **↑ / ↓ / ×** reorder | Yes — but hand-rolled, not `CheckListSelect`/`SearchableSelect` | Multi (columns) | Yes — per-group "Select all"/"Clear group" + top-level "Clear all" | `<iframe srcDoc>` preview; result HTML cached 5 min client-side (`cachedGet`/IndexedDB); pre-opens a blank print window synchronously on click to dodge popup blockers |
| `/students/temp-admission-add\|edit` | Plain text inputs; one Load/Save button | No | n/a | No | Edit mode has a search-then-reveal flow (Application No → Load) |
| `/students/temp-affidavit` | Single text input + Generate | No | n/a | No | Print-only report card |
| `/students/academic-promotion` | Single text input + Load; read-only audit table | No | n/a | No | No editing — pure lookup/audit view |
| `/students/promote` (`PromotePanel.jsx`) | 4 cascading native `<select>`s (From/To academic, From/To course); per-row native `<select>` (From year / To year); per-row plain checkbox (`row.allow`); free-text comma list (Fail list) | No | Single per select; checkboxes are independent, not a set | **No** — each row's "Promote" checkbox toggled individually, no select-all/none for the whole batch | Submit disabled until `to_a_year` set; "no year steps" empty state suppresses the Promote button entirely |
| `/students/attachments-upload\|view` (`StudentAttachmentsPanel`) | Text search input; per-row `<input type=file>`; per-row text (attachment number) | Yes (register-no substring via `searchMore`) | n/a | No | Each file input uploads **immediately** on selection (`POST .../attachments/upload`) — no staged multi-file review before commit; separate **Save Attachments** only persists the "Number" text fields |
| `/students/attachments-report` (`AttachmentsReportPanel.jsx`) | Native `<select>` (Search by: Register No / Batch); conditional text or course-batch select; `DataTable` results | Table: `searchable={data.students.length > 8}`, `pageSize={10}` | n/a | No | `AttachmentStatusBadge` (Pending/In Review/Complete); row actions deep-link into Upload or View-All with `?studentId=` |
| `/students/id-card` (`StudentIdCardPanel.jsx`) | Checkboxes (Front/Back, both default-checked); radio (Search by Register No / Batch); text or course-batch select | No | n/a | No | Simple "Go" → count → conditional Print button pattern, no table |
| `/students/photo-empty` | One select + one free-text Year input | No | n/a | No | Server-rendered report only |
| `/students/photo-upload` — single (`PhotoUploadFields`) | Text search (min-3-digit gate) + clickable disambiguation list when multiple matches; file input | Yes (register-no substring) | Single (forces explicit pick on ambiguity) | No | Photo input stays `disabled` until a student is unambiguously selected |
| `/students/photo-upload` — bulk (`PhotoBulkUploadFields`) | Multi-file `<input type=file multiple>` (native browser multi-file picker, not a list-style control) | n/a | Multi (files) | No pre-upload deselect — only "N file(s) selected" count | Per-file result list (green success / red per-file error) after save — partial-failure-tolerant |
| `/students/address-label` (`AddressLabelPanel.jsx`) | `ChipMultiSelect` (checkbox-list replacement for native `<select multiple>`, supports shift-click range-select, ctrl/cmd-click, "select all"/"clear") bound to Batch or Year groups; radio (Search By, Show) | Yes (`ChipMultiSelect` has built-in search) | **Multi** | Yes — built into `ChipMultiSelect` | Right pane shows live "Selected: N · Labels: M" counts; ✉ empty state before generation |
| `/students/collage-generate` (`CollageGeneratePanel.jsx`) | Plain numeric/text/color inputs; comma-separated register-no text list; one native `<select>` (Template); toggle checkbox reveals extra fields | No | n/a | No | Live client-side SVG-free HTML grid preview (`buildGridHtml`) highlighting merged cells before submit |
| `/students/collage-image` (`CollageImagePanel.jsx`) | Multi-file `<input type=file multiple>`; per-image plain checkbox in a grid + inline title `<input>` | No | Multi (checkboxes, independent — no select-all) | **No** select-all/clear-all for the image grid | **Delete Selected** disabled until ≥1 checked; per-image title is inline-editable directly in the grid |
| `/students/alumni-registration` | Date range (mutually constrained min/max), text find, native `<select>` (Field) | No | n/a | No | Feeds a find-or-create flow into Alumni Edit |
| `/students/alumni-edit` (`AlumniEditPanel.jsx`) | Radio (Search by Name/Register No); text + Go; clickable result list (not a `DataTable`); 3 native `<select>`s (Year of Passing, Degree, Course — cascading) | Yes (server-side substring on Name/Reg No submit) | Single | No | Info banner for "no alumni yet, prefilled from student" case; submit label switches Create/Update based on `form.isNew` |
| `/students/alumni-report` | Date range, 2 native `<select>`s (Year of pass, Course) | No | n/a | No | This `type` renders its own **Search** label instead of the shared Generate/Save button |
| `/students/alumni-id-card` (`AlumniIdCardPanel.jsx`) | Identical shape to `/students/id-card` | No | n/a | No | — |

### 2a. Native `<select>` count per screen (raw grep of `<select` tags)

| File | `<select>` count | Longest/riskiest list |
|---|---|---|
| `StudentAdmission.jsx` | 12 | Course (fetched per Batch+Degree — grows with every admitted year); Bank Name |
| `StudentScreenPage.jsx` (dispatcher, several `type`s) | 8 | Course/batch selects reused across id-card, photo-empty, attachments-report |
| `PromotePanel.jsx` | 6 | From/To course, per-row From/To year |
| `AlumniEditPanel.jsx` | 3 | Year of Passing / Degree / Course (cascading) |
| `StudentReport.jsx` | 2 | Course filter |
| `CollageGeneratePanel.jsx` | 2 | Template |
| `StudentList.jsx` | 1 | Course/batch (`<optgroup>` per course) — flagged in gap #1 below |
| `StudentIdCardPanel.jsx` / `AlumniIdCardPanel.jsx` | 1 each | Course/batch |
| `StudentProfile.jsx` | **0** | Edit tab is 100% plain text inputs — no dropdowns to search at all |

None of these selects use `SearchableSelect` or `CheckListSelect` anywhere in the module —
every single one is a bare `<select className="form-select">`. This is a genuine,
verified gap (confirmed via `grep -rn "import.*SearchableSelect\|import.*CheckListSelect"
pages/students/`, which returns zero matches), not a guess.

---

## 3. Advanced feature gaps

1. **Batch/Course select on `/students` (StudentList.jsx line ~245) has no search.** It's a
   plain `<select>` with one `<optgroup>` per course, and a college running many years of
   history can easily accumulate 40–100+ batch options across all courses/years. `CheckListSelect`
   already solves exactly this "long grouped option list" problem two modules over (e.g.
   `DeptAuthSetup.jsx`), and even the simpler `SearchableSelect` (single-value, substring filter,
   portal dropdown) would remove the need to scroll a native dropdown to find "2019-2020 (Regular)".

2. **12 native `<select>`s on `/students/new` (StudentAdmission.jsx) have zero search**,
   most critically Batch (`options.academicYears`), Course (fetched per Batch+Degree — can be
   long for a multi-department college), Bank Name, and State. `SearchableSelect` is a drop-in
   value/onChange-compatible replacement (same contract, per its own doc comment) — this is the
   single highest-leverage swap in the module, since admission is the module's most
   frequently-run screen.

3. **Mark-sheet "Program" select and Bank/State selects reuse the same unsearched pattern** —
   worth batching into the same `SearchableSelect` migration pass as #2 rather than doing it
   piecemeal, since they share the same `<select className="form-select">` shape.

4. **`/students/promote` (PromotePanel.jsx) Promote-row checkboxes have no bulk toggle.**
   A batch of 60+ students to promote means 60+ individual clicks with no "Select all" / "Invert
   selection" / "Clear all". `CheckListSelect`'s "Select all"/"Clear" toolbar (or a lighter
   bespoke header checkbox) is proven UX elsewhere in the app and directly maps onto this table's
   `row.allow` column.

5. **`/students/collage-image` (CollageImagePanel.jsx) image grid has per-image checkboxes but
   no select-all/clear-all**, so "Delete Selected" across a large album (dozens of group photos)
   requires clicking every thumbnail. The exact same bulk-toolbar affordance already exists in
   `ChipMultiSelect` (used two screens over on Address Label) and could be adapted to a grid
   layout.

6. **`StudentReport.jsx`'s column picker reimplements search + multi-select + bulk select-all
   from scratch** instead of reusing `CheckListSelect`, which already ships search (auto-enabled
   above 8 options), a selected-count label, and Select-all/Clear — the exact feature set the
   report builder hand-rolled independently. Consolidating would cut duplicate code and guarantee
   the two report builders (Students, Staff — both use the identical pattern, see 06-staff.md)
   behave identically.

7. **Attachments upload (`StudentAttachmentsPanel`) has no staged multi-file review.** Each file
   input commits to the server the instant a file is chosen (`POST .../attachments/upload`
   per-row). There's no "select 5 files across 5 rows, review, then Save all" step — a mis-click
   on the wrong row's file input is not undoable from the UI before the network call fires. The
   bulk photo uploader on the same module (`PhotoBulkUploadFields`) already demonstrates the
   "stage locally, then submit as a batch with a combined result list" pattern that would fit
   here.

8. **`/students/alumni-edit`'s result list is a plain clickable `<button>` list, not a
   `DataTable`**, even though the student/staff searches one hop away (`StudentList.jsx`) use
   `DataTable` for the identical "list of matches, click a row" job — losing sortability and the
   consistent empty-state styling for what can be a long alumni roster.

9. **The "Same as P.Addr." mirroring on `StudentAdmission.jsx` is a one-way checkbox, not a true
   linked-fields affordance.** Once checked, the 7 Communication Address fields disable and copy
   from Permanent Address via `useEffect` — but if the operator later edits a Permanent Address
   field, the already-mirrored Communication fields silently stay in sync only because the
   `useEffect` re-runs; there's no visible indicator (e.g. a small "synced" badge) distinguishing
   "these fields are live-mirrored" from "these fields happen to match right now," which becomes
   confusing on `/students/:id` Edit tab where the equivalent mirroring toggle doesn't exist at all
   and Communication fields are just independent plain inputs.

10. **`AttachmentsReportPanel.jsx`'s `DataTable` hides the Actions column on mobile
    (`hidden on mobile` per the user-stories doc) with no replacement affordance** — a
    front-office user on a tablet reviewing attachment completeness loses the Upload/View-All
    row actions entirely rather than getting a collapsed menu or swipe action, which is a real
    functional gap (not just visual) on the one report in this module most likely to be checked
    on the move.

---

## 4. User-experience suggestions

- **Autosave / draft recovery on `StudentAdmission.jsx`.** This is an 11-section, ~50-field form
  that already tracks a `dirty` flag and warns on `beforeunload` — but a browser crash or
  accidental navigation still loses everything. Periodically persisting the in-progress form to
  `localStorage` (keyed by a session id) and offering "Restore your unsaved admission?" on next
  visit would protect front-office staff from re-typing a multi-page form after a stray back-swipe
  on a tablet.

- **Inline validation instead of submit-time errors on admission/staff-admission.** Required
  fields (Admission No, Aadhar No, Register No for students; Staff ID, Staff Name for staff) are
  currently only enforced via `required` + server round-trip. Real-time inline hints (e.g. "Aadhar
  must be 12 digits" as you type) would catch typos before the ~50-field form is submitted, rather
  than after — this matters more here than on smaller setup screens because a rejected submit
  means re-scanning an 11-section form for the one bad field.

- **Skeleton loading instead of a single "Loading…" spinner on `StudentProfile.jsx`.** The
  profile hero + 4 tabs currently gate behind one `PageLoading` spinner
  (`StudentPageShell.jsx`). A skeleton that outlines the hero block and tab shape while
  `GET /api/students/:id` resolves reads faster and avoids the "did it freeze?" moment on a slow
  connection, which matters on this screen because it's the module's most-visited destination.

- **Empty-state guidance for `/students` batch search with a course that has zero students.**
  Today the generic "No students found — check the roll number, or pick a different course
  batch" copy fires the same way whether the operator mistyped a roll number or picked a batch
  that genuinely has no admissions yet. A batch-mode-specific message ("This batch has no
  admitted students yet — try Admission → New Profile") would remove the ambiguity for the
  academic-office user who came in via Course/Batch mode specifically to browse a batch.

- **Optimistic UI on `/students/:id` Status tab.** "Update Status" currently waits for the
  `PATCH` round-trip before flipping the Active/Released pill. Since the client already computes
  the pill from a simple zero-date check (`StudentProfile.jsx`), it could flip immediately on
  submit and roll back only if the request fails — small win, but this is the exact screen where
  front-office staff process one-off "student just left" updates in a queue and want instant
  confirmation.

- **Confirmation modal for the destructive `/students/collage-image` "Delete Selected."** It is
  currently a plain disabled/enabled button with no confirm step — deleting album images is
  irreversible, and every other destructive action documented in this module (admission Cancel,
  Edit-tab tab-away) already uses `ConfirmModal`. This screen should match that pattern rather
  than being the one silent exception.

- **Contextual help for course-key formats on `/students/promote`.** From-academic → To-academic
  auto-derivation (`"{yr}-{yr+1}"` from the last 4 chars) and the `{course}___{year}` mapping key
  format are invisible business logic to a new academic-office hire. A small "?" tooltip next to
  the From/To academic selects explaining "the academic year format is YYYY-YYYY, e.g.
  2024-2025" would reduce support tickets when a new staff member picks the wrong year pairing.

- **Mobile responsiveness for `/students/photo-upload` and `/students/attachments-upload`.**
  These two screens are the most plausible "front-office staff walking around with a phone/tablet"
  workflows in the whole module (matching a physical photo/document to a student record on the
  spot) — camera-capture-friendly file inputs (`capture="environment"`) and a single-column
  layout below 768px would turn a desktop-only flow into a genuinely mobile one, ahead of any
  speculative native-app work described in the user-stories "Future" section.

- **Table export (CSV) directly from `DataTable` results on `/students` and
  `/students/attachments-report`,** not just from the dedicated `/students/reports` builder — a
  front-office user who just ran a batch search often wants to grab that exact filtered list
  without re-building it in the full report tool.

- **Keyboard shortcut for the report builder's "Add custom field" Enter-to-add** already exists;
  extending the same instinct — `Ctrl+Enter` to trigger Print/Export from anywhere in the column
  list — would speed up the report-building loop for staff who run the same report repeatedly
  with small column tweaks.

- **Accessibility pass on the two icon-only header actions on `/students` (Module Hub, Export
  Report) and the tab bar's `fa`-icon tabs.** The pixel-level doc confirms these render as
  `btn-outline-secondary`/`btn-outline-primary` with a Font Awesome icon plus visible text label
  (not icon-only), which is already reasonable — but the Overview/Edit/Attachments/Status tab
  bar's dirty-dot indicator on the Edit tab (a small visual dot, per `StudentProfile.jsx`) has no
  accompanying `aria-label` or screen-reader text called out in the spec; a screen-reader user has
  no way to know the Edit tab has unsaved changes without seeing the dot. Adding
  `aria-label="Edit (unsaved changes)"` when dirty is a one-line, high-value fix for a
  frequently-used indicator.

- **Explicit "why is this required" tooltip on Admission No vs. Register No vs. Roll No on
  `StudentAdmission.jsx`.** These three near-identical-sounding required fields (plus University
  Register No, EMIS No, UMIS No — all *not* required) are a well-documented source of confusion
  for new admission staff, since the legacy PHP form carries the same ambiguity forward. A short
  inline tooltip per field ("Register No is the primary academic-year identifier used across
  Fees/Exam/Attendance; Roll No defaults to Register No if left blank") would reduce the
  duplicate-key rejection (`US-E1`) rate by helping staff pick the right value the first time,
  not just react to the error after the fact.

---

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win)**
- Swap the Batch/Course `<select>` on `StudentList.jsx` for `SearchableSelect` (drop-in
  value/onChange contract).
- Add a header "Select all / Clear all" checkbox to `PromotePanel.jsx`'s Promote-row table.
- Add a "Select all / Clear all" toolbar to `CollageImagePanel.jsx`'s image grid, matching what
  `ChipMultiSelect` already provides elsewhere.
- Wrap `CollageImagePanel.jsx`'s "Delete Selected" in `ConfirmModal`, matching the module's
  existing pattern.
- Add a batch-specific empty-state message to `/students` when Course/Batch search returns zero
  rows.
- Add `aria-label="Edit (unsaved changes)"` to the dirty-dot indicator on `StudentProfile.jsx`'s
  Edit tab.
- Replace `AlumniEditPanel.jsx`'s plain clickable-button result list with `DataTable`, matching
  `StudentList.jsx`'s existing pattern for the identical "list of matches" job.

**Bigger investments (needs design/product buy-in)**
- Migrate `StudentAdmission.jsx`'s 12 native selects (and `StaffAdmission.jsx`'s equivalent) to
  `SearchableSelect` as a coordinated pass — touches a large, frequently-used form and needs
  visual QA across every section.
- Replace the hand-rolled column picker in `StudentReport.jsx` (and its `StaffReport.jsx` twin)
  with `CheckListSelect`, or extract a shared "report column picker" component so both report
  builders stay in sync going forward.
- Restage `StudentAttachmentsPanel` uploads as "select multiple files, review, submit as a
  batch" instead of per-input-immediate-commit — a real interaction redesign, not a component
  swap.
- Add keyboard-accessible bulk selection (not just mouse checkbox toggling) to the new
  `PromotePanel.jsx` Promote-row bulk toolbar and the `CollageImagePanel.jsx` image grid bulk
  toolbar once built, so both additions are usable without a mouse from day one rather than
  needing a follow-up accessibility pass.
- Autosave/draft-recovery for the admission form — needs a decision on storage/expiry policy,
  not just a component change.

# 06 — Staff — Frontend Control & UX Audit

## 1. Module recap

The Staff module (`client/src/pages/staff/`) covers staff search, admission (which also
provisions a login account), profile edit/records/status, certificates/attachments, ID
cards, transport, org-structure/org-chart, DCI/TNMGRMU regulatory inspection & publication
reports, the export report builder, and a family of setup screens (designation,
attachment category hierarchy, org-chart config, inspection config, transport setup,
login help). Full field-by-field detail, legacy `.php` mapping, and user stories live in
[`user-stories/06-staff.md`](../user-stories/06-staff.md) — this file assumes that
research and only adds a control-pattern inventory and UX audit on top of it.

---

## 2. Frontend control inventory

| Screen (component) | Control type(s) used | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| `/staff` search (`StaffList.jsx`) | Native `<select>` (Category mode); text input (Name/Staff ID modes); `DataTable` results | No on select | Single | No | 3-way mode tabs (Name/Staff ID/Category) via URL `?by=`; `DataTable` gets `searchable={staff.length > 8}`, `pageSize={25}`; Status badge Active(green)/Relieved(grey) |
| `/staff/new` admission (`StaffAdmission.jsx`) | 8 `FormSelect`-wrapped native `<select>`s (Blood Group, Religion, Community, Category, Department, Designation, State Dental Council, State, Bank Name); bespoke **pill-checkbox row** for Levels (`toggleLevel`, plain checkboxes styled as rounded-pill chips); radio groups (Title, Gender, Marital Status); embedded `EducationTab`/`ExperienceTab`/`SkillsTab` add/remove-row grids | No on any select; Staff ID has live-async availability check (`onBlur` → `check-id`), not a search control | Single per select; Levels is multi via independent checkboxes | **No** bulk toggle for Levels (no select-all/clear) | `FormSectionNav` scroll-spy over 10 sections; Department change clears+refetches Designation; success banner shows one-time temp password/PIN + "Open profile" |
| `/staff/:id` profile (`StaffProfile.jsx`) | 9-tab bar; Edit tab = plain text inputs (`PersonalEditTab`); Education/Experience/Awards/Skills tabs = add/remove-row grids, one native `<select multiple>` inside Skills (Activity Types sub-category, see gap #1); Status tab = date + file input + textarea | No | n/a (Skills' native multi-select is unsearched — see gaps) | No | Best-effort `profile-options` fetch (silently falls back to `{}`, never blocks viewing); Legacy Form tab always renders a deliberate 410 notice; resignation letter is base64-encoded client-side and posted alongside status fields |
| `/staff/reports` (`StaffReport.jsx`) | Native `<select>` (Category); radio (Show); bespoke grouped **checklist-with-search** column picker (same hand-rolled pattern as `StudentReport.jsx`, not `CheckListSelect`) + custom-field input + ordered ↑/↓/× list | Yes, hand-rolled | Multi (columns) | Yes — per-group select-all/clear-group + clear-all | Same shell CSS as the student report (`StudentReport.css` reused); reference data is **not** IndexedDB-cached here (unlike the student version) |
| `/staff/certificates` (+ profile Attachments tab) | Text search ("Staff ID or name") + Find; per-category file upload | Yes (substring, min-length gated like student photo-upload) | n/a | No | Distinct upload endpoint (`.../certificates/upload`) from the generic per-staff attachments route, matching legacy's named-category vs. free-form-row split |
| `/staff/appoint-order`, `/staff/id-card`, `/staff/inspection-attn-cert`, `/staff/affidavit-dci`, `/staff/affidavit-tnmgrmu`, `/staff/attach-print` (`type: staff-search-report`) | One shared text input + Find/search button, reused verbatim across all six screens | Yes (substring) | n/a | No | Identical UI shell for 6 different legacy print targets — only the resulting `reportHtml` differs |
| `/staff/salary-note` (`type: date-category-report`) | 2 date inputs + 1 native `<select>` (Category) | No | n/a | No | — |
| `/staff/photo-empty` (`type: category-report`) | 1 native `<select>` (Category) | No | n/a | No | Mirrors student photo-empty |
| `/staff/photo-upload` — single | Text search (min-length gate) + Find; file input | Yes | Single | No | Same "must select before enabling file input" pattern as students |
| `/staff/photo-upload` — bulk | Multi-file `<input type=file multiple>`; **Overwrite existing files** checkbox | n/a | Multi (files) | No pre-upload deselect | Overwrite toggle is unique to staff (not present on the student bulk photo screen) |
| `/staff/org-structure` (`type: org-structure`) | 2 native `<select>`s (Department, Type) | No | n/a | No | Renders a tree/report HTML, not an interactive tree widget |
| `/staff/transport` (`type: transport-grid`) | 1 native `<select>` (Mode) + grid | No | n/a | No | Distinct from setup-side transport route definitions |
| `/staff/photos` (`type: auto-report`) | None — auto-loads on entry | n/a | n/a | No | No filter form at all |
| `/staff/inspection-details` (`type: inspection-grid`) | 1 required native `<select>` (Inspection Department) + row grid | No | n/a | No | — |
| `/staff/inspection-attn-sheet` (`type: attn-sheet`) | Filter + Update submit | No | n/a | No | — |
| `/staff/dci-report`, `/staff/tnmgr-report`, `/staff/publication-dci`, `/staff/publication-tnmgrmu` (`type: dept-report`) | 1 shared native `<select>` (Department) | No | n/a | No | Same filter shell, 4 different regulatory-body report targets |
| Setup screens (`StaffSetupPage.jsx`, all 8: designation-edit, attachment-category/scategory/setup, org-chart-config, inspection-config/name, transport-setup, login-help) | `CrudRows` editable grid: plain text `<input>` cells, `type:'checkbox'` cells, optional drag-handle + `useDragReorder`-driven reorder (order column becomes read-only when active); `org-chart-config` additionally uses a `<select>`-with-`<optgroup>` "DesignationSelect" (via `mergeGroupOption` to preserve stale-but-selected values) | No search on any `CrudRows` field or the `DesignationSelect` | n/a (rows are independent) | **No** row-level select-all — only Add row / per-row delete | Drag-reorder only wired where an `order` column exists; `mergeGroupOption` synthesizes a "Selected" group so a deleted/stale designation still displays instead of silently reverting to blank |

**`ChipMultiSelect` note:** used twice in this module (`StaffScreenPage.jsx` lines ~307
and ~322) for filter pickers on some of the report-shell screens — same checkbox-list,
shift-click-range, search, and select-all/clear behavior documented in the Students file.

### 2a. Native `<select>` count per screen (raw grep of `<select` tags)

| File | `<select>` count | Longest/riskiest list |
|---|---|---|
| `StaffSetupPage.jsx` | 15 | `DesignationSelect` in org-chart-config (grouped by department, `mergeGroupOption` fallback) |
| `StaffScreenPage.jsx` (dispatcher, several `type`s) | 9 | Department/Category filters reused across appoint-order, transport, dept-report screens |
| `StaffProfileSections.jsx` | 3 | Activity Types (native `<select multiple>` — flagged in gap #1) |
| `StaffReport.jsx` / `StaffList.jsx` | 1 each | Category |
| `StaffAdmission.jsx` (via `FormSelect` wrapper) | 8 | Designation (re-fetched per Department); Department itself |
| `StaffProfile.jsx` | **0** direct — Edit tab is plain text inputs like the student profile | n/a |

Like the Students module, **zero** screens in this module import `SearchableSelect` or
`CheckListSelect` (verified via `grep -rn "import.*SearchableSelect\|import.*CheckListSelect"
pages/staff/` — no matches). `StaffAdmission.jsx` uses a shared `FormSelect` wrapper
(defined inside `StaffProfileSections.jsx`, line ~36) which is itself just a native
`<select>` under the hood, not a different control class — so "wrapped in `FormSelect`"
does not mean it already has search; it's cosmetic/label consistency only.

---

## 3. Advanced feature gaps

1. **Skills tab's native `<select multiple>` (StaffProfileSections.jsx, ~line 648, Activity
   Types sub-category picker) has no search, no visible selected-count, and no select-all/clear.**
   It's a plain browser multi-select box (ctrl/cmd-click). `CheckListSelect` is purpose-built for
   exactly this shape (per-option checkbox rows, search auto-enabled above 8 options, live
   "N selected" label, Select all / Clear) and is already proven elsewhere in the app (e.g.
   `DeptAuthSetup.jsx`) — this is the single clearest control-pattern gap in the whole module.

2. **8 native `<select>`s on `/staff/new` (StaffAdmission.jsx) have no search**, most notably
   Designation (re-fetched per Department and can be long in a multi-department college) and
   Department itself. Same fix as the student-side admission form: `SearchableSelect` is a
   drop-in value/onChange replacement.

3. **"Levels" pill-checkbox row (StaffAdmission.jsx `toggleLevel`) has no bulk select-all/clear.**
   For a staff member who teaches across many class levels, each pill must be clicked
   individually. `ChipMultiSelect`'s bulk toolbar (already used twice in this same module's
   `StaffScreenPage.jsx`) is the nearest proven pattern and could replace the bespoke pill row
   directly.

4. **`StaffSetupPage.jsx`'s `CrudRows` has no bulk row actions** — no "select several rows and
   delete", no "select all"/"clear" for `type:'checkbox'` columns (e.g. the `mandatory` column on
   attachment-setup, or `journeyUp`/`journeyDown`/`discontinued` on transport-setup). Every one of
   the 8 setup screens sharing this component inherits the same limitation; a single
   `CrudRows` enhancement (checkbox-select-row + a shared "select all" header checkbox + bulk
   delete) would fix all 8 screens at once rather than needing per-screen work.

5. **`StaffReport.jsx`'s column picker duplicates `StudentReport.jsx`'s hand-rolled
   search+multi-select+bulk-select-all implementation** instead of using `CheckListSelect` — see
   the identical finding in `05-students.md` §3.6. Because both report builders share
   `StudentReport.css` already, they're clearly meant to stay visually identical; consolidating
   onto one shared component (built on `CheckListSelect`) would guarantee that instead of relying
   on manual parity.

6. **`DesignationSelect` in org-chart-config is unsearched** despite grouping by department
   (`<optgroup>`) — the exact shape `SearchableSelect`/`CheckListSelect` were built for. A large
   institution's full designation list across every department is a prime "hard to scan a plain
   dropdown" case.

7. **No table-level search/sort/export on any `dept-report` or `staff-search-report` screen's
   output** — these render server HTML (`reportHtml`) rather than a `DataTable`, so once a DCI
   report or appointment-order print is generated, there's no client-side way to filter/search
   within it (unlike `/staff` or `/staff/certificates`, which do use `DataTable` for their
   underlying staff lists).

8. **`StaffAdmission.jsx`'s Staff ID availability check is the module's only "smart" input, and
   it has no visible loading state.** Per `US-E3` in the user-stories doc, a failed `check-id`
   call silently leaves `idStatus` as `null` with neither an "available" nor "taken" badge shown —
   there is also no separate "checking…" state between the `onBlur` firing and the response
   landing, so a slow network makes the field look inert rather than busy. Every other async
   affordance in the module (search screens) at least flips a button label to "Searching…"; this
   one doesn't.

9. **`FormSelect` (StaffProfileSections.jsx, used by `StaffAdmission.jsx`) has no `disabled`,
   `placeholder`, or grouped-`optgroup` support in its own prop signature** (`label, value,
   onChange, options, optionValue, optionLabelKey, className` — no `disabled` prop at all per its
   definition), unlike `SearchableSelect`, which explicitly supports `disabled` and a
   `placeholder`. That means Department-dependent Designation disabling (a natural UX pattern —
   grey out Designation until Department is picked) isn't even structurally available today
   without a separate wrapper `<div>` hack.

10. **`CrudRows`'s reorder-via-drag (`useDragReorder`) has no keyboard equivalent.** Drag-handle
    reordering on screens like designation-edit or attachment-category is mouse/touch-only per
    the current implementation — a keyboard-only or screen-reader user has no way to reorder rows
    on any of the setup screens that rely on `onReorder`.

---

## 4. User-experience suggestions

- **Replace the Skills-tab native multi-select with `CheckListSelect`.** Beyond the raw control
  upgrade (gap #1), this directly helps the HR staff who maintain add-on skill sets: the current
  no-search box makes it easy to miss an option in a long "extra_skills" list, and there's no
  visual confirmation of what's currently selected without scrolling the tiny native box.

- **Inline availability feedback should stay but gain a debounce + clearer state.** Staff ID
  availability already checks on `onBlur` — good — but a live-as-you-type debounced check (with a
  small spinner instead of only a static "Available"/"Not available" label) would let HR staff
  catch a typo'd ID before tabbing away, since Staff ID formatting mistakes (`US-E1`/`US-E3` in
  the user-stories file) are a documented edge case here.

- **Skeleton loading for `/staff/:id`'s 9-tab profile.** With 9 tabs (more than the student
  module's 4) and a best-effort options fetch that can silently fail, a skeleton for the hero +
  tab bar while `GET /api/staff/:id` resolves reduces the "is this broken?" uncertainty window —
  particularly valuable here since a slow/failed `profile-options` call is explicitly tolerated
  (US-E4) and shouldn't visually read the same as a still-loading page.

- **Bulk row selection + bulk delete for every `CrudRows`-based setup screen.** All 8 setup
  screens (designation-edit, attachment-category/scategory/setup, org-chart-config,
  inspection-config/name, transport-setup, login-help) currently require per-row delete clicks.
  A setup admin cleaning up a stale attachment sub-category list, or retiring several old
  designations at once, has no faster path than one-at-a-time. This is a single shared-component
  investment with 8x the payoff.

- **Confirmation modal for `CrudRows` per-row delete.** Today's per-row trash-icon delete
  (`fa fa-trash`, title "Delete row") appears to fire immediately with no confirm step across all
  8 setup screens — unlike the Students module, which consistently wraps destructive actions in
  `ConfirmModal`. Designation/category rows can be referenced elsewhere (e.g. a designation used
  by staff profiles, or an org-chart "reports-to" target per US-E12/E13) — an accidental delete
  here has a wider blast radius than most Students-module deletes, making a confirm step more
  important, not less.

- **Contextual tooltip on org-chart-config explaining "stale value" badges.** `mergeGroupOption`
  (US-E12/E13) silently synthesizes a "Selected" group when a saved designation/reports-to value
  no longer exists in the fresh option list — visually this could look like a normal group to a
  new setup admin who won't know it means "this designation was deleted but is still referenced
  here." A small inline note ("This value no longer exists in the active list — resolve or
  reassign it") would surface a real data-integrity issue the UI currently papers over silently.

- **Optimistic UI on the Status tab's Update Status.** Same rationale as the Students module:
  the Active/Resigned pill is computed once and re-rendered from the server response
  (`profile.resigned`), so flipping it optimistically on submit (with rollback on failure) would
  make the single most common "an employee just left" action feel instant for HR staff processing
  several relieving updates in a row.

- **Mobile responsiveness for `/staff/photo-upload` and `/staff/certificates`.** Same rationale
  as the Students module's equivalent screens — these are the two flows most likely to happen
  away from a desk (HR staff photographing a new hire's ID/certificates on the spot), and neither
  currently has camera-capture-aware inputs or a mobile-first layout.

- **Autosave/draft protection for `StaffAdmission.jsx`.** This form additionally has real
  one-time-only side effects (Staff ID reservation, login credential provisioning) that make
  losing progress mid-form costlier than most admission forms — a crash after filling 8 of 10
  sections means re-doing real work, not just re-typing. Periodic localStorage draft persistence
  (same suggestion as the student admission form) is arguably higher priority here because of
  that credential-provisioning side effect.

- **Table export on `/staff` and `/staff/certificates` result tables**, matching the same
  suggestion made for the Students module — a quick CSV export straight from the `DataTable`
  results would save HR staff from re-running the same query in the dedicated `/staff/reports`
  builder just to get a spreadsheet of a search result they already have on screen.

- **Keyboard shortcut / accessibility pass on the 6 near-identical `staff-search-report`
  screens.** Since all six (appoint-order, id-card, inspection-attn-cert, affidavit-dci,
  affidavit-tnmgrmu, attach-print) share the exact same search-and-generate shell, an Enter-to-
  search + Enter-to-print shortcut pair implemented once in that shared component benefits all
  six screens simultaneously — a rare case where one small fix multiplies across the module.

- **Async loading state for the Staff ID availability check.** Building on gap #8, a small inline
  spinner between `onBlur` and the `check-id` response landing (distinct from both "Available" and
  "Not available") would remove the ambiguous "is it still checking, or did it silently fail?"
  moment that `US-E3` already documents as an accepted edge case — turning a tolerated failure
  mode into a visibly-handled one costs little and directly serves the HR staff who fill this
  field first on every admission.

- **Keyboard-accessible reorder alternative for `CrudRows`' drag-handle rows.** Since 5 of the
  8 setup screens use `onReorder` (designation-edit and the attachment-category hierarchy are the
  most frequently touched), adding simple up/down icon buttons alongside the drag handle — not
  replacing it — would let a keyboard-only setup admin reorder designations without needing mouse
  drag support, addressing gap #10 with a minimal, additive change rather than a new interaction
  model.

- **Visible "why can't I pick a Designation yet" hint on `/staff/new`.** Designation options load
  reactively only after Department is chosen (`GET /api/staff/admission/designations?departmentId=`)
  — until then the Designation select is presumably empty or disabled with no explanation text.
  A one-line hint ("Choose a Department first") directly under the Designation field would remove
  a moment of confusion for new HR staff filling the form top-to-bottom for the first time, since
  nothing else on the page currently signals the dependency.

---

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win)**
- Swap the Skills tab's native `<select multiple>` (Activity Types) for `CheckListSelect`.
- Add a bulk toolbar (Select all / Clear) to the "Levels" pill-checkbox row on
  `StaffAdmission.jsx`, reusing the `ChipMultiSelect` pattern already present twice in this
  module.
- Wrap `CrudRows`'s per-row delete in a `ConfirmModal` across all 8 setup screens (one shared
  component change).
- Add Enter-to-search to the shared `staff-search-report` filter block used by 6 screens.
- Add a "checking…" inline state to the Staff ID availability check between `onBlur` and the
  `check-id` response landing.
- Add a "Choose a Department first" hint under the Designation select on `StaffAdmission.jsx`.

**Bigger investments (needs design/product buy-in)**
- Add bulk row-select + bulk delete to `CrudRows` — touches all 8 setup screens and needs a
  decision on how "select row" interacts with the existing drag-reorder affordance.
- Migrate `StaffAdmission.jsx`'s 8 native selects (and `DesignationSelect` in org-chart-config)
  to `SearchableSelect`/`CheckListSelect` as a coordinated pass alongside the equivalent Students
  module work, so both admission forms move together.
- Extract a shared "report column picker" component (built on `CheckListSelect`) used by both
  `StaffReport.jsx` and `StudentReport.jsx` instead of two independent hand-rolled
  implementations.
- Autosave/draft recovery for `StaffAdmission.jsx` — complicated slightly by the one-time
  credential-provisioning side effect, so needs a product decision on what "resuming a draft
  after partial submission" should even mean.

# 04 — Settings — Frontend Control & UX Audit

## 1. Module recap

See [user-stories/04-settings.md](../user-stories/04-settings.md) for the full pixel-level
flow. Settings is the admin/HR/payroll "back office" module: 14 setup screens (department &
designation masters, approval toggles, three SMS notification-group screens, print layout &
CSS, lesson-plan config, payroll salary signatures, and two cron-recipient screens), all
sharing one route pattern (`/settings/setup/:screen`), one page shell
(`SettingsSetupPage.jsx`), and one bespoke API hook (`useSettingsSetupApi.js` — deliberately
**not** the generic `createSetupApi` factory used by SMS/TV/kiosk modules, so it lacks that
factory's response caching, request-sequence guarding, and `?view=` URL sync). This is the
single most control-dense module of the four covered in this file — nearly every screen is a
"pick a category, edit a grid of rows, save" pattern, which makes it the best place in this
batch to see the app's uneven native-`<select>`-vs-modern-component story play out
screen-by-screen.

## 2. Frontend control inventory

| Screen | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| `designation` | Native `<select>` (Department, + literal "Add New" option) + editable grid (text inputs for Order/Designation) | No | single dept | No | "+" appends a blank row; per-row "Delete" → `ConfirmModal` ("Are you sure to delete...", buttons "Close"/"Confirm"); server round-trip on every dept change (`onLoad({deptRef})`), no client debounce. |
| `d-order` | No filter control at all — loads immediately on mount | — | — | No | Table: designation name is **plain text** (not editable), Order is a text input per row; single "Save" button, no per-row delete. |
| `staff-master` | Native `<select>` with 2 `<optgroup>`s, options **hardcoded** (22 entries, not DB-driven) + editable grid | No | single category | No | Same "+" / per-row Delete / `ConfirmModal` pattern as `designation`. |
| `staff-edu-master` | **Two cascading native `<select>`s** (Category→Sub Category) + editable grid | No | single value each | No | Grid only renders once *both* dropdowns have a value; changing either re-fetches. |
| `approval` | No filter — loads on mount. Pure checkbox grid (one row per fixed `approval_tb` record) | — | N/A (fixed row set) | No — each row toggled independently, no group/select-all | Only button "Save"; no add/delete at all — a closed set of toggle rows. |
| `college` | Checkbox grid **grouped by title prefix** (Staff/Student/Hostel/Others) | No | multi (independent checkboxes) | **Yes** — group-header checkbox toggles every item in that group at once (checked state reflects "all enabled") | This is the module's only in-house "select-all per group" bulk pattern, hand-rolled rather than using `CheckListSelect`'s built-in Select all/Clear. |
| `hospital` | Table: checkbox (Enable) + free-text input (Mobile) per row | No | multi (independent) | No | No client-side phone-format validation on the Mobile field. |
| `budget` | Same shape as `hospital`, different table | No | multi | No | Structurally identical component to `hospital`. |
| `print-setup` | Native `<select>` grouped by `<optgroup>` (+ "Add New") + large form (text inputs, textarea, 3 radio buttons, 6 checkboxes, 3 repeated Name/Designation input pairs) | No | single page | No | Densest single-screen form in the module; "Save" only visible once a page is selected/created. |
| `print-style` | Single `<textarea rows={18}>` — raw CSS file content | No | — | No | Not a database-backed screen — reads/writes a file on disk (`css/salary.css`); no syntax highlighting, no validation, just a monospace textarea. |
| `lesson-plan` | Native `<select>` (hardcoded 2 options: Type/Limit) → conditionally either one text input (Limit) or an editable grid with a checkbox column (Type, "Enable Topic") | No | single mode | No | Grid shares the "+" / per-row Delete / `ConfirmModal` pattern; Limit mode has no delete path. |
| `signature` | Native `<select>` (1 hardcoded option) + editable grid with **file upload** (`type="file" accept="image/png,image/jpeg,image/gif"`) per row, image preview | No | single category | No | Only screen in this module (and one of very few in the whole app) with file upload; client reads each file via `FileReader.readAsDataURL`, base64-encodes into the save payload; a bad upload aborts the *entire* save request, including rows already processed in the same loop (see §3). |
| `payroll-emailer` | Native `<select>` (fixed single-row filter — 0 or 1 real option), text input, checkbox, native `<select>` (zero-padded day 01–31) + editable contacts grid (Name/Email) | No | single cron entry | No | Contacts grid shares the "+" / Delete / `ConfirmModal` pattern. |
| `sms-cron` | Same shape as `payroll-emailer`, but Day is a **plain text input** (not a padded `<select>`) and contacts grid is Name/Mobile instead of Name/Email | No | single cron entry | No | Structurally near-identical sibling to `payroll-emailer` with two small field-type divergences worth flagging (see §3). |

**Every dropdown in this entire module is a native `<select>`.** There is zero usage of
`SearchableSelect` or `CheckListSelect` anywhere in Settings — confirmed by grep across all 14
setup components. This is the most concentrated example in the app of the README's core
observation: a module built entirely on the *oldest* control pattern (`SearchableSelect.jsx`
and `CheckListSelect.jsx` post-date this module's screens), even though several of its
dropdowns (`print-setup`'s page picker, `staff-master`'s 22-entry hardcoded category list) are
exactly the kind of "long-ish list, no search" case those components exist to solve.

## 3. Advanced feature gaps

1. **`staff-master`'s Category `<select>` has 22 hardcoded options across 2 optgroups with no
   search** — this is a textbook case for `SearchableSelect`, which already exists in this
   codebase specifically to add substring search to exactly this kind of longer flat list
   without changing the value/onChange contract. A user scanning for "Salary Advance Type"
   among 22 alphabetically-unsorted-looking entries currently has to read the whole list; a
   `SearchableSelect` swap would let them type "salary" and jump straight there.
2. **`print-setup`'s page-header `<select>` groups options by `<optgroup category>` and shows
   `${id} | ${title}` labels** — as the number of configured print pages grows, this dropdown
   has no search either, and it's arguably a stronger `SearchableSelect` candidate than
   `staff-master` because the option count is DB-driven and unbounded (not a fixed 22), unlike
   the hardcoded category list above.
3. **The `college` screen's group-header "select all in this group" checkbox is a bespoke,
   hand-rolled reimplementation of exactly what `CheckListSelect`'s built-in "Select all /
   Clear" toolbar already does** (`client/src/components/CheckListSelect.jsx` — see the
   `selectAll`/`clearAll` functions and the toolbar meta strip showing "N selected"). The
   `college` screen re-derives "is every item in this group enabled" on every render instead of
   reusing the proven component; not a bug, but a real duplication of already-solved logic
   two screens over from where the reference implementation lives.
4. **`hospital` and `budget` have no per-row bulk action at all**, unlike `college`'s
   group-header toggle three screens over in the same module family (all three are SMS
   notification screens with the same underlying shape: checkbox + editable field per row).
   A user managing many hospital/budget SMS types currently must click every checkbox
   individually, even though the sibling `college` screen already demonstrates the
   group-bulk-toggle pattern is both wanted and implemented for this exact use case.
5. **No `useDragReorder` anywhere in Settings, despite `d-order` being explicitly an
   ordering screen.** `d-order`'s entire purpose is to let an admin reorder designation names,
   but it does this via a plain numeric text input per row (type a number, save, re-sort) —
   the app already has a `useDragReorder` hook (`client/src/hooks/useDragReorder.jsx`, per the
   README's pattern table) for exactly this "reorder a list" interaction, and this is the one
   screen in the entire module whose stated purpose is reordering, yet it's the one screen not
   using the drag-reorder pattern.
6. **`payroll-emailer`'s Day field is a padded `<select>` (`01`–`31`), `sms-cron`'s equivalent
   field is a free-text input** — these two screens are otherwise structural siblings (same
   cron-entry-picker → title/status/day → contacts-grid shape), so the divergence in the Day
   field's control type (constrained dropdown vs. unvalidated free text) is an inconsistency
   within the same screen family, not a deliberate design choice documented anywhere — worth
   normalizing to the `payroll-emailer` pattern (which at least prevents invalid day values at
   entry time) unless there's a legacy-parity reason `sms-cron` needs free text.
7. **`signature`'s file upload has no drag-and-drop, no upload progress indicator, and no
   client-side pre-validation against the server's own `2MB` / `jpeg|jpg|gif|png` limits** —
   the constraint (`saveLegacyBinaryFile({maxBytes: 2*1024*1024, allowedExt: ...})`) is enforced
   only server-side, after the full base64 payload round-trips; a client-side size/type check
   before submit (this module's *only* file upload, so there's no existing sibling pattern to
   point to, but it's a common, well-understood upgrade) would catch the E6 partial-write edge
   case (documented in user-stories §5) before it ever reaches the server.
8. **No screen in this module uses `SearchableSelect` or `CheckListSelect` even once**, despite
   this module having the single highest concentration of "pick from a list, then edit a grid"
   screens in the four modules covered by this batch of files. Every other module audited here
   ([01](01-auth-session.md), [02](02-dashboard.md), [03](03-navigation-menu.md)) has *at most*
   one or two native `<select>`s total; Settings has one in nearly every one of its 14 screens
   — making it the module where a targeted `SearchableSelect`/`CheckListSelect` adoption pass
   would move the needle the most for the least total number of screens touched.
9. **`print-setup`'s three role blocks (Approved/Checked/Verified) are copy-pasted markup**,
   each with its own Name/Designation input pair bound to `form[role].name`/`form[role]
   .designation` — functionally a fixed 3-item list rendered as three separate hardcoded
   sections rather than one small reusable "signature role" sub-component looped 3 times. Not a
   control-pattern gap exactly, but a maintainability one directly adjacent to this module's
   theme: the same "list of similar items" shape recurring without a shared component, mirrored
   at a larger scale by the `hospital`/`budget`/`college` triplet (gap #4).

## 4. User-experience suggestions

1. **Swap `staff-master`'s 22-option Category `<select>` and `print-setup`'s page-header
   `<select>` for `SearchableSelect`.** Why it helps: both are exactly the "flat list too long
   to scan, but not a multi-select" shape `SearchableSelect` was purpose-built for, and it's a
   drop-in replacement (same value/onChange contract per the component's own doc comment) —
   low risk, immediate scan-time reduction for admins who use these screens daily.
2. **Give `hospital` and `budget` the same group-header bulk-toggle `college` already has**, or
   better, replace all three SMS screens' checkbox grids with `CheckListSelect` in `multiple`
   mode, using its built-in "Select all / Clear" toolbar instead of three separately
   hand-maintained checkbox-grid implementations. Why it helps: reduces three near-duplicate
   custom components to one shared, already-tested component, and immediately gives `hospital`/
   `budget` feature parity with `college`'s bulk toggle that admins managing many rows are
   likely to expect once they've used any of the three.
3. **Add inline validation on `hospital`/`budget`'s Mobile field** (basic length/digit check
   before Save, not just a trimmed pass-through). Why it helps: today a malformed mobile number
   silently saves and only fails much later when the actual SMS job runs — catching an obvious
   typo (letters in a mobile field, wrong digit count) at entry time avoids a failure that's
   invisible until the next scheduled SMS batch, which could be hours or days later.
4. **Add autosave-on-blur (or at least a "you have unsaved changes" indicator) to every grid
   screen in this module.** Why it helps: every one of the 14 screens uses a manual, single
   "Save" button for a whole grid of edits — on a screen like `designation` or `staff-master`
   where an admin might edit 5-10 rows before saving, there's currently no protection against
   navigating away mid-edit (no route-change guard is documented anywhere in this module) and
   no visual cue that changes are pending; even a simple "Unsaved changes" badge next to Save
   would reduce accidental data loss on a form-heavy module used by less technical HR/payroll
   staff.
5. **Convert `d-order` to `useDragReorder`.** Why it helps: reordering by typing numbers into a
   column of text inputs requires the user to compute the right integer for every row they want
   to move, then verify the resulting sort — an actual drag handle (which the app already has
   the infrastructure for) turns "figure out the right number" into "drag it where it goes,"
   which is strictly faster and less error-prone for a screen whose *entire job* is reordering.
6. **Add client-side pre-validation to `signature`'s file input** (`accept` attribute already
   restricts the file picker, but add an explicit size/type check with an inline error before
   the base64-encode-and-submit step). Why it helps: directly prevents the E6 partial-write edge
   case documented in the user-stories doc, where an oversized/wrong-type file can abort a save
   *after* earlier rows in the same batch have already been soft-deleted-and-restored — catching
   it client-side means the user never triggers that partial-write window in the first place.
7. **Standardize the Day field between `payroll-emailer` and `sms-cron`** to both use the padded
   `<select>` (or explain in the UI why SMS cron intentionally allows free text, if that's a
   legacy-parity requirement). Why it helps: two screens with otherwise identical layouts having
   different input types for the "same" concept (a day-of-month) is the kind of inconsistency
   that makes an admin second-guess whether they filled the field in correctly on one of the two.
8. **Add a lightweight "who changed this and when" surfacing**, reusing the `log_tb` audit rows
   every load/save already writes via `logSettingsSetup` (per the user-stories doc, the data
   already exists — no schema change needed). Why it helps: Settings screens have real
   institution-wide blast radius (department structure, SMS routing, print layouts used
   everywhere) and currently give zero in-app visibility into recent changes — even a small
   "Last updated by X on Y" line per screen, sourced from data already being written, would help
   an admin sanity-check they're looking at current, intentional configuration.
9. **Show the print-style textarea's line/character count and basic CSS lint feedback.** Why it
   helps: `print-style` is a raw, unvalidated CSS file editor with no syntax highlighting — a
   typo here breaks salary/payslip print formatting institution-wide with zero warning until
   someone actually prints a payslip and notices; even basic brace-matching feedback would catch
   the most common class of accidental breakage before Save.
10. **Address the soft-delete-then-recreate concurrent-edit race (E5) with an optimistic
    "someone else may have changed this" banner** — not a full locking system, but even a
    "reload before editing? Last saved N minutes ago" prompt on grid screens with typically-
    multi-admin usage (`approval`, `college`) would reduce the last-writer-wins surprise
    documented in the user-stories doc, where one admin's save can silently resurrect or wipe
    rows another admin just changed.
11. **Add a confirmation step before Save on destructive-shaped screens** — the delete action
    already goes through `ConfirmModal`, but Save on a soft-delete-then-recreate grid (e.g.
    `designation`, `staff-master`) is functionally also somewhat destructive (per gap #10/E5,
    it can silently wipe concurrently-added rows) yet has no equivalent confirmation step. Why
    this matters as a UX suggestion, not just a backend concern: even a lightweight "Save N
    changes?" summary (row-count-based, no version-check needed) would at least make the *scope*
    of a save action visible before it's irreversible, independent of whether the underlying
    race condition itself ever gets fixed.
12. **Extract `print-setup`'s three repeated role blocks into one looped sub-component.** Why it
    helps: directly closes gap #9 — reduces ~60 lines of near-identical JSX to one small
    component rendered 3 times with a `role` prop, making it far less likely a future edit
    (e.g. adding a 4th role, or changing the field set) misses one of the three copies, a class
    of bug this exact copy-paste pattern invites.
13. **Group the 14-screen settings hub by workflow frequency, not just alphabetically/by
    section** — `SettingsHub.jsx`/`SettingsSetupHub.jsx` already group by `meta.section`
    (Staff/Workflow/SMS/Print/Academic/Payroll/Cron); consider surfacing a small "frequently
    used" or "recently opened" strip above the full grouped list (reusing the same
    `sessionStorage`-recents pattern the command palette already implements, see
    [03-navigation-menu.md](03-navigation-menu.md) §3.8). Why it helps: a payroll admin who
    only ever touches `signature`/`payroll-emailer` currently scans the same full 14-item list
    every visit to find their 2 relevant screens — a recents strip (already a proven pattern
    elsewhere in this codebase) removes that repeated scan.
14. **Show a persistent "Category is required" / "Please select a department first" placeholder
    state** on screens whose grid only renders after a dropdown pick (`designation`,
    `staff-master`, `staff-edu-master`, `lesson-plan`, `signature`) — right now the area below
    the dropdown is presumably just blank until a selection is made. Why it helps: an explicit
    "Pick a department above to see its designations" placeholder (rather than empty space)
    confirms to a first-time user that the blank area is expected behavior, not a loading
    failure — directly addresses the empty-state-guidance principle already applied elsewhere
    in this app (e.g. Dashboard's "No panels assigned" empty state, see
    [02-dashboard.md](02-dashboard.md)).

## 5. Quick wins vs. bigger investments

**Small diff, immediate win:**
- Swap `staff-master`'s and `print-setup`'s native `<select>`s for `SearchableSelect` (#1) —
  drop-in component swap, no API/data-shape change.
- Add basic inline Mobile-field validation on `hospital`/`budget` (#3) — client-only regex/
  length check before submit.
- Normalize `sms-cron`'s Day field to match `payroll-emailer`'s padded `<select>` (#7) — small,
  contained component change (confirm no legacy-parity reason blocks it first, per CLAUDE.md's
  "open the legacy PHP first" rule).
- Add client-side file-size/type pre-check to `signature`'s upload (#6) — a guard clause before
  the existing `FileReader` call, no server change.
- Extract `print-setup`'s three role blocks into one looped sub-component (#12) — a contained
  refactor within a single file, no API/data-shape change.
- Add "pick a department/category first" placeholder copy to the 5 gated-grid screens (#14) —
  a conditional render with static copy, no logic change.

**Needs design/product buy-in:**
- Replacing all three SMS screens' checkbox grids with `CheckListSelect` (#2) — a real
  component migration across three files; worth scoping as one consolidated change rather than
  three separate ones since they share the same underlying shape.
- Converting `d-order` to `useDragReorder` (#5) — a genuine interaction-model change from
  numeric-input reordering to drag reordering; needs a UX decision on fallback behavior for
  keyboard-only/accessibility users.
- Unsaved-changes protection across all 14 grid screens (#4) — needs a shared pattern decision
  (route-guard vs. badge-only) applied consistently, not a per-screen patch.
- Audit-trail visibility in-app (#8) — needs a small new UI surface (even a modest one), plus a
  decision on how much history to expose to which roles.
- Optimistic-concurrency / "someone else may have changed this" handling (#10) — the
  user-stories doc explicitly flags this as architecturally deeper than a UI tweak (would
  ideally pair with a real version-check on the server side), so it should be scoped as a
  backend-plus-frontend change, not a frontend-only patch.
- Pre-save confirmation summary on soft-delete-then-recreate grids (#11) — needs a product
  decision on which of the 14 screens actually warrant an extra confirmation step vs. which are
  low-risk enough (e.g. `approval`'s fixed-row toggle grid) to leave as a single-click Save.
- A "recently used settings screens" strip on the hub pages (#13) — needs UX design for where
  it sits relative to the existing section-grouped grid, plus a decision on whether it reuses
  the command palette's exact `sessionStorage` key/format or gets its own.

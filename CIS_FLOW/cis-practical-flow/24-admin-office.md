# 24 — Admin Office

## 1. Module recap

Admin Office covers three unrelated back-office logs sharing one screen shape (Add / Edit /
Report): event participation with prizes (Student/Staff Activities), inward/outward courier,
and campus incidents — plus an intentionally-stubbed Events Group screen with no save path.
Field-by-field behavior, validation rules, the participant Lookup mechanism, and all sixteen
user stories already live in
[user-stories/24-admin-office.md](../user-stories/24-admin-office.md) — this file audits the
**input controls** those eleven screens use today.

Component directory: `client/src/pages/adminOffice/` and `client/src/pages/adminOffice/setup/`.

## 2. Frontend control inventory

| Screen | File | Control(s) used | Search? | Multi-select? | Bulk actions? | Other interaction detail |
|---|---|---|---|---|---|---|
| Student/Staff Activities — Add | `setup/ActivitiesAddSetup.jsx` (`ActivityForm`, shared) | Text inputs (Event Name, Venue, Content, Participant IDs), native `<select>` ×2 (Category — 5 fixed options, Type — 4 fixed options), `<input type="date">`, `<textarea>` (Participant Names), repeatable row group (Prize/Type text, ID text, Names textarea) with per-row **Lookup** + **Remove** buttons and a **"+ Add row"** link-button | No | No — participant rows are free-text, not a picker | No | Lookup is a per-row async fetch (`api.post`), not a picker — resolved names are written back into a plain textarea, not selectable chips |
| Student/Staff Activities — Edit | `ActivitiesEditSetup` (same file) | Text search input + Search button; `<table>` result list with per-row **Edit** link-button; same `ActivityForm` fields once loaded | Yes (server `LIKE`, button-triggered) | No | No | **Delete has no confirm dialog**; "← Back to list" is a link-style button, not a real nav (calls `onLoad({})`) |
| Courier Add | `setup/CourierAddSetup.jsx` + `CourierFields.jsx` (shared) | `<input type="datetime-local">`, native `<select>` ×2 (In/Out — 2 options; Department — server-driven with `--Select--` placeholder), text inputs (From, To, Item, Quantity, Receiver), native `<select>` (Type — 3 options) that **conditionally reveals** two more text-input pairs depending on the selected Type | No | No | No | Conditional-field pattern (`cType !== 'Hand'` vs `=== 'Hand'`) is hand-rolled `&&` JSX branching, not a stepper/wizard |
| Courier Edit | `setup/CourierEditSetup.jsx` | Text search input + Search button; `<table>` list, per-row **Edit** link-button; same `CourierFields.jsx` once loaded | Yes (server `LIKE` across from/to/in-out) | No | No | Delete has no confirm dialog; identical shape to Activities Edit |
| Courier Report | `setup/CourierReportSetup.jsx` | `<input type="date">` ×2 (cross min/max) + free-text Search input + **Show** button, all inside one native `<form>` using `FormData` on submit | No live search (submit-triggered) | — | — | Returns `null` (nothing rendered) until first load — no skeleton/spinner in the JSX itself |
| Incident Add | `setup/IncidentAddSetup.jsx` (`IncidentFields`, exported for reuse) | `<input type="datetime-local">`, native `<select>` (Department, server-driven), text inputs (Title, Location, First Aid By), `<textarea>` (Details) | No | No | No | Every field always visible — no Courier-style conditional branching |
| Incident Edit | `setup/IncidentEditSetup.jsx` | Same search-then-list-then-`IncidentFields` shape as Courier/Activities Edit | Yes (button-triggered) | No | No | Delete has no confirm dialog |
| Incident Report | `setup/IncidentReportSetup.jsx` | Identical `FormData`-on-submit date-range + search pattern as Courier Report | No live search | — | — | Returns `null` until first load, same as Courier Report |
| Events Group | `setup/EventsGroupSetup.jsx` | None — a single read-only `<div className="alert alert-info">` | — | — | — | Intentional stub; no controls at all (server has no working save path to port) |

**Cross-cutting observations:**
- **Three independent Add/Edit/Report triads (Activities, Courier, Incident) each hand-roll the
  exact same search-then-list-then-form shape** with no shared component — the search input,
  the results `<table>`, the per-row Edit link, the "← Back to list" button, and the
  Update/Delete button pair are copy-pasted (with field-name substitutions) across six files
  (`ActivitiesEditSetup`, `CourierEditSetup`, `IncidentEditSetup` and their sibling Report
  screens' date-range form). None of the six list tables have pagination controls in the JSX
  even where the server supports paged loads (Activities Edit: `page`, fixed `limit=20`).
- **Every Department dropdown in this module (Courier Add/Edit, Incident Add/Edit) is a plain
  native `<select>`** with a manually-inserted `--Select--` placeholder option — none use
  `SearchableSelect` even though department lists across the app can run into dozens of rows.
- **No screen in this module uses `CheckListSelect` or any multi-select control anywhere** —
  the closest thing to multi-select is the Activities module's free-text "Participant IDs"
  input, which is comma-separated raw text resolved server-side, not a picker at all.

## 3. Advanced feature gaps

1. **Participant lookup (Activities Add/Edit) is a free-text ID box, not a directory search.**
   A coordinator must already know exact admission numbers or staff IDs to type into the
   "Participant IDs"/row `studentList` fields — there's no way to browse or search by name.
   `SearchableSelect` (substring match, portal dropdown) is proven elsewhere for exactly this
   "pick from a long list by typing part of the name" problem; wiring a searchable
   student/staff picker in front of the existing Lookup endpoint (which already resolves
   IDs → names) would eliminate the current typo-prone workflow entirely, not just improve it.
   This is also exactly what user-stories US-13 (future) already anticipates for the mobile app.
2. **Participant lookup errors are silently dropped by the client** (user-stories US-8): the
   server's `resolveParticipantNames` returns an `errors` array for unmatched IDs, but
   `ActivitiesAddSetup.jsx`'s `lookup()` only reads `res.data.names`. This isn't a control-type
   gap so much as a **wiring** gap — no error-display control (inline alert, red list) exists to
   receive that data even though the payload already carries it (also flagged as future
   US-15 in the user-stories file).
3. **All three Department `<select>` dropdowns (Courier Add/Edit, Incident Add/Edit) would
   benefit from `SearchableSelect`** once the department list grows past a screenful — today
   it's a small fixed list from `staff_dept_master`, but as the only other screens in the app
   that reach this size already use the searchable variant, this native-select-with-placeholder
   pattern is the oldest style still present in a screen this frequently used (every Courier/
   Incident Add and Edit).
4. **The three search-then-list screens (Activities/Courier/Incident Edit) have no shared
   `SearchableList`/`RecordPicker` component**, so pagination, "N results found" counts, and
   sort-by-column are absent from all three independently rather than fixed once. This is the
   admin-office analogue of the Circular module's Edit Circular gap — the same underlying
   pattern repeats module-to-module with no shared abstraction.
5. **Courier's Type-conditional fields (`cType !== 'Hand'` vs `=== 'Hand'`) are a plain
   JS `&&` branch, not a guided radio-with-conditional-panel pattern** — functionally correct
   (and the server force-blanks the inapplicable fields on save, so data integrity is fine) but
   there's no visual affordance (e.g. a highlighted panel) signaling to the user that switching
   Type will discard values already typed into the fields for the other type. A user who fills
   Courier No/Company, then switches Type to Hand, then switches back to Postal, will find their
   original values gone with no warning — this is a real "surprise data loss" gap, not just a
   cosmetic one.

## 4. User-experience suggestions

1. **Participant search with fuzzy match on Activities Add/Edit.** Replace the raw
   "Participant IDs" text box with a `SearchableSelect`-based (or a purpose-built
   autocomplete reusing the same portal-dropdown mechanics) student/staff directory search that
   fuzzy-matches on name as well as exact ID, then appends the picked person's ID into the row.
   *Why it helps:* today a coordinator must know exact admission/staff numbers; a name-based
   fuzzy search removes the single biggest source of the "invalid admission number" Lookup
   errors described in user-stories US-8, and turns a two-step type-then-Lookup workflow into a
   one-step pick.
2. **Duplicate-detection warning on Activities Add/Edit and Courier Add.** Before Submit, warn
   if the same participant ID appears twice across Prize/Participant Rows in one event, or if a
   courier entry with the same From/To/Date/Item combination was logged in the last few minutes
   (heuristic double-submit guard). *Why it helps:* user-stories US-9 documents that there is
   currently no de-duplication at all — a slow network causing a double-click Submit creates two
   full duplicate events with duplicate participants, and nothing in the UI would catch it
   before or after the fact. Even a client-side "this looks like a duplicate — submit anyway?"
   confirm would close most of the accidental-double-submit cases.
3. **Surface the Lookup `errors` array inline.** A small red list under the Participant IDs
   field (or under each row's ID input) rendering `res.data.errors.join(', ')` whenever any
   come back. *Why it helps:* directly closes user-stories US-8/US-15 — today a zero-match
   lookup silently blanks the Names field with no signal to the coordinator that anything went
   wrong at all.
4. **Confirm dialogs before every Delete** (Activities/Courier/Incident Edit all currently fire
   immediately). *Why it helps:* all three Edit screens soft-delete on a single click with zero
   confirmation — for Activities specifically, Delete also cascades to soft-delete every
   participant row for that event (user-stories US-3), making an accidental click more
   consequential than a typical single-record delete.
5. **A visual warning when switching Courier Type discards the other type's fields.** Even a
   simple inline note ("Switching to Hand will clear Courier No/Company") next to the Type
   `<select>` in `CourierFields.jsx`. *Why it helps:* closes the silent-data-loss gap described
   in §3.5 above — the server already force-blanks those fields on save, so the UI should say so
   before the user loses typed data, not after.
6. **Fix the Add/Edit Title-validation inconsistency on Incident (US-12).** `saveIncidentAddSetup`
   requires a non-blank Title; `saveIncidentEditSetup` does not, so an Edit can blank the Title
   silently. *Why it helps:* this is a data-quality gap as much as a UX one — adding the same
   client-side "Title is required" inline validation to `IncidentEditSetup.jsx` that a
   well-behaved Add form would have closes the parity gap without any server change (the server
   validation should also be aligned, but the client fix alone stops most accidental blanks).
7. **Pagination controls on the three search-then-list screens.** Activities Edit already
   supports a paged load (`page`, `limit=20`) server-side but the JSX renders every returned row
   with no Prev/Next control and no page indicator. *Why it helps:* a coordinator searching a
   common term (e.g. "sports") with hundreds of matching historical events currently has no way
   to see page 2 — the UI silently caps at whatever the first load returned.
8. **Loading skeleton instead of blank `null` on Courier/Incident Report.** Both screens
   `return null` until `data` is populated, with no visible loading indicator of their own.
   *Why it helps:* on a slow connection this reads as "the screen is broken" rather than
   "the report is loading" — a simple spinner or skeleton row set closes that ambiguity, and is
   consistent with the page shell's own busy indicator being the only current signal.
9. **A single shared `RecordSearchList` component for the three Edit triads.** *Why it helps:*
   collapsing the near-identical search-box + results-table + Edit-link + Back-to-list pattern
   used by Activities/Courier/Incident Edit into one component would mean pagination, empty-state
   messaging, and sort-by-column only need to be built once and then apply to all three (and any
   future module that needs the same shape) instead of three times independently.
10. **Autosave/draft-recovery for the Prize/Participant Rows on Activities Add.** A coordinator
    filling out several rows (each with a Lookup round trip) risks losing the whole in-progress
    form on an accidental navigation or refresh — there is no `localStorage` backup today. *Why
    it helps:* the Lookup step already makes this form the most time-invested one in the module
    (each row potentially requires a network round trip before the row is "done"), so it has the
    highest cost-of-loss of any form in Admin Office and is the best candidate to autosave first.
11. **A visible row count / "N participants added" summary on Activities Add/Edit.** Today the
    only way to know how many Prize/Participant rows exist is to scroll and count them — a small
    header line ("3 rows") above the repeatable group would help when an event has many prize
    categories.
12. **Keyboard-friendly row add/remove.** The "+ Add row" link-button and per-row Remove button
    both require a mouse click; there's no keyboard shortcut (e.g. Enter-in-last-row-adds-a-row)
    despite the form otherwise being a fairly rapid-entry data-heavy screen (an activities
    coordinator logging a multi-winner event may add a dozen rows in one sitting). *Why it
    helps:* a data-entry-heavy repeatable-row form is exactly the case where keyboard-only entry
    saves the most time relative to mouse-driven entry.
13. **Mobile responsiveness on the Courier/Incident field grids.** `CourierFields.jsx` and
    `IncidentFields.jsx` both use Bootstrap `col-md-*` classes that stack correctly on narrow
    viewports by default, but the Courier Type-conditional field pairs (Courier No/Company vs.
    Hand Name/Designation) reflow abruptly when the conditional branch swaps — on a phone-width
    viewport this causes a visible content jump as fields appear/disappear. A min-height
    placeholder for the conditional region would smooth this out.
14. **Accessibility labels on the Lookup/Remove button pairs.** Like Circular's Approve/Reject
    buttons, Activities' per-row **Lookup** and **Remove** buttons carry only generic text with
    no row-identifying `aria-label` — for a screen-reader user working through many rows, an
    `aria-label={`Lookup names for row ${index + 1}`}` (and the Remove equivalent) removes the
    "which row" ambiguity.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Surface `res.data.errors` from the participant Lookup as an inline warning list — the backend
  payload already carries this, only the client display is missing.
- Add `window.confirm()` before Delete on Activities/Courier/Incident Edit (three near-identical
  one-line changes).
- Add client-side "Title is required" validation to `IncidentEditSetup.jsx` to match Add's
  server-side rule (US-12 parity fix).
- Add a one-line inline note next to Courier's Type `<select>` warning that switching types
  clears the other type's fields.
- Replace the bare `return null` loading state on Courier/Incident Report with a simple
  "Loading…" placeholder.
- Add `aria-label`s to the per-row Lookup/Remove buttons on Activities Add/Edit so each button's
  accessible name includes the row it acts on.
- Add a "N rows" summary line above the Prize/Participant Rows group on Activities Add/Edit.

**Bigger investments (needs design/product buy-in first):**
- A searchable/fuzzy-match participant picker replacing the free-text Participant IDs box —
  needs a decision on whether it hits `/api/students`/`/api/staff` search directly or a new
  admin-office-scoped endpoint, plus UX design for how picked names render in the row.
- Duplicate-detection warnings for participant rows and courier entries — needs a product
  decision on what counts as a "likely duplicate" (exact match vs. fuzzy time-window heuristic).
- A shared `RecordSearchList` component consolidating the three Edit triads' search-then-list
  pattern — worth doing once but touches six files across this module alone, plus likely
  candidates in Circular and other modules with the identical shape.
- Pagination UI for the three search-then-list screens — small on the client side but needs the
  server's existing paged-load support (already present for Activities, would need adding for
  Courier/Incident) audited for consistency first.
- A real save path for Events Group (US-16) — explicitly out of scope for a pure UX audit since
  it requires a schema/product decision on whether events-group tracking belongs in Admin Office
  or the Committee module, per the code's own docstring pointing at Committee as the likely home.

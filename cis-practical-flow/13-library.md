# 13 — Library — Frontend Control & UX Audit

## 1. Module recap

The Library module runs the college's catalog, supplier records, issue/return desk, inter-branch
transfers, barcode label printing, an OPAC search, and library gate attendance. It has 19 setup
screens plus a hub and a dashboard drill-down, all served by a hand-rolled hook
(`client/src/pages/library/useLibrarySetupApi.js`) and page shell
(`client/src/pages/library/LibrarySetupPage.jsx`) rather than the shared
`createSetupApi`/`ModuleSetupFactory` pattern — no client-side response caching and no
`loadSeq`/`saveSeq` race-guarding, unlike Committee. Full field-by-field detail:
[user-stories/13-library.md](../user-stories/13-library.md).

The module has a distinct split in usage pattern: several screens (`transaction-issue`,
`transaction-return`, `attendance`) are built for a standing service-desk operator scanning
barcodes/typing IDs rapidly, while the rest (catalog CRUD, reports, attendance admin) are
back-office data-entry/reporting screens. That split matters a lot for section 4 below — desk
screens need speed/focus ergonomics, back-office screens need better list controls.

## 2. Frontend control inventory

| Screen (slug) | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Dashboard (`dashboard`) | Native `<input type="date">`, clickable drill-down buttons/links | No | — | No | Auto-loads on date change; drill-down renders inline card with `ReportPrintBar`; no save path at all |
| Book Categories (`book-category`) | Native `<select>` (category filter), editable table (text inputs per row) | No | Single (category filter) | No — row add/delete only, one at a time | `window.confirm` before delete (not `ConfirmModal`); trash disabled on unsaved rows |
| Resources Add (`book-add`) | Native `<select>` (×4: resource type, supplier, source, subject), native `<select multiple>` (Branch/department), text/number/date inputs, `<input type="file">`, checkboxes | Availability "search" is a dedicated check-availability button/blur, not list search | Multi only for Branch (ctrl/cmd-click) | No | Long 4-section form with sticky `FormSectionNav`; async availability check on Accession No. blur |
| Resources Edit (`book-edit`) | Native `<select>` (searchBy, resourceType, department filters), text search input, editable form fields identical to Add + 3 extra checkboxes, native `<select multiple>` (Branch) | Yes — text + `searchBy` field-scoped dropdown | Multi only for Branch | No — one row edited/deleted at a time | List/edit toggle (no route change); Bootstrap numbered pagination; `window.confirm` before delete; separate "Add Book (copy accession numbers)" repeatable-row sub-form |
| Resources Report (`book-report`) | Native `<select>` (searchBy, resourceType, department), text search | Yes | Single | No | Print button gated on `printHtml` presence; no pagination — full result set rendered |
| OPAC (`resources-report`) | Same filter shape as Book Report | Yes | Single | No | Paginated ("Showing X to Y of Z"); search-and-list only (submits via save, not load) |
| Barcode (`resources-barcode`) | Text search, native `<select>` (resourceType, department), number-range text inputs (From/To A.No), radio group (copies per label) | Yes (accession list text) | Single | No | Renders N duplicate label cards per matched resource per `copiesPerLabel` |
| Transfer (`resource-transfer`) | Text input + Go button (book lookup), native `<select>` (destination), date inputs | Lookup by exact Book ID only, not fuzzy search | Single | No | Two-mode form (transfer vs. return) driven by server-reported `lookup.mode` |
| Supplier Add (`supplier-add`) | Plain text inputs | No | — | No | Simplest form in the module, array-literal field mapping |
| Supplier Edit (`supplier-edit`) | Text search, table with Edit/Delete actions | Yes | Single | No | Only library screen using shared `ConfirmModal`; edit-mode labels are raw camelCase keys (unpolished) |
| Limit Setup (`transaction-setup`) | Fixed 3-row editable table (U.G/P.G/Staff × limit/duration) | No | — | No | No add/remove rows — fixed row set |
| Book Issue (`transaction-issue`) | Text input + Go (ID lookup), text input + Go (accession lookup), date inputs, checkbox | Lookup-by-exact-ID only | Single | No | Enter-to-submit on ID field; person-first flow; branches into issue or return sub-form based on server state |
| Book Return (`transaction-return`) | Mirror of Issue, book-first | Lookup-by-exact-ID only | Single | No | Same shared save handler as Issue (`saveLibraryTransaction`) |
| Transactions Report (`transaction-report`) | Date range, native `<select>` (issueReturn, isDamaged), text (Register/Staff ID) | Yes (by ID) | Single | No | Simple flat table, no pagination |
| Daily Summary (`entry-report`) | Date range + Load button | No | — | No | Summary line + fixed-column table |
| Library Attendance (`attendance`) | Single large auto-focus text input | No | — | No | Kiosk mode: every keystroke-driven lookup is actually a save (records in/out); Enter or blur triggers |
| Manual Attendance Entry (`att-entry`) | Date input (reloads grid), editable table (Reg No, In/Out time text) | No | — | Row add/remove (`+`/`-`), always ≥1 row | No confirm on row removal (local-only until Save) |
| Library Attendance Report (`att-report`) | Native `<select multiple>` with `<optgroup>` (Category/course-year), date range, checkbox | No | Multi (ctrl/cmd-click) | No | Go button disabled until ≥1 category selected; vertical-rotated per-day columns |

**Module-wide pattern:** zero uses of `SearchableSelect` or `CheckListSelect` anywhere in
`client/src/pages/library/`. Every "pick from a list" control is either a plain native `<select>`
or a native `<select multiple>` (Branch/department on Book Add & Edit; Category on the Attendance
Report). Confirm-before-delete is inconsistent: `window.confirm` (Book Categories, Book Edit),
shared `ConfirmModal` (Supplier Edit only), or no confirm at all is not present here (Library
avoids the zero-confirm pattern Committee's `RowSetupScreen` has).

## 3. Advanced feature gaps

1. **Book Add / Book Edit "Branch" multi-select** (§3.3/§3.4 in user-stories) is a bare
   `<select multiple>` with a "Ctrl/Cmd-click" hint — the exact scenario `CheckListSelect` exists
   to fix. Departments/branches in a multi-college dental institution can run into a dozen+ options;
   a native multi-select box gives no visual feedback about what's currently selected beyond
   highlighted rows in a tiny listbox, and offers no "Select all" / "Clear" bulk action. Swapping in
   `CheckListSelect` (already used successfully in `DeptAuthSetup.jsx` per the README) would need
   no new component work, just wiring.

2. **Library Attendance Report `Category`** (§3.18) is a grouped `<select multiple>` with
   `<optgroup>`s built from `courseYearOptions`, and the Go button is explicitly disabled until at
   least one category is chosen. `CheckListSelect` doesn't natively support `<optgroup>`-style
   grouping today, so this is a slightly bigger lift than Branch above, but the payoff is larger:
   this list can span every active course/year/type combination in the college, and the current
   control offers zero search.

3. **Resources Edit / Book Report / OPAC's `searchBy` field-scoped search** (§3.4/§3.5/§3.6) — the
   search box only filters by one field at a time (`--All--`, Title, Accession No., Convert Title,
   Call Number, Author, Publisher). This is a config gap, not a control-type gap: a `SearchableSelect`
   swap wouldn't help here, but exposing 2–3 simultaneous fields (e.g. title AND author) would, since
   right now a librarian who half-remembers a title and an author has to run two separate searches.

4. **Transfer / Book Issue / Book Return "Go" lookups** (§3.8, §3.12, §3.13) are exact-match only —
   type the wrong accession number by one digit and you get an inline error, not a suggestion. A
   `SearchableSelect`-style typeahead (or even a lightweight autocomplete backed by the existing
   `searchBooks()`/member-lookup functions) would materially speed up the desk flow versus the
   current type-exact/see-error/retype loop, especially for accession numbers that aren't barcode-scanned.

5. **Supplier Add/Edit and Book Add's Supplier/Source `<select>`s** are plain native selects with
   no search — fine while the supplier list is short, but this module has no cap on suppliers and
   the option list will only grow as new vendors are onboarded over years.

6. **Resources Edit's "Add Book (copy accession numbers)" repeatable-row sub-form** (§3.4) is
   hand-rolled +row/blank-row logic distinct from `RowSetupScreen`'s reorderable grid pattern used
   in Committee — it has no drag-reorder, no bulk-paste, and each new accession/copy pair must be
   typed individually. For a librarian receiving a shelf of 10 identical new copies at once, typing
   10 rows one at a time (rather than, say, pasting a newline/comma-separated list of accession
   numbers and letting the form split it into rows) is a real throughput bottleneck at
   accession-heavy times of year (start of term, new curriculum rollouts).

7. **Book Issue/Return's Accession lookup has no "recently scanned" memory.** Because both desk
   screens reset to a blank Accession field after each `Go`, an operator who mis-scans and needs to
   retry has no quick way to recall what was just typed/scanned — unlike a browser address bar's
   history, there's no local suggestion list built from the current session's own lookups.

8. **No keyboard shortcut to jump between the ID field and Accession field on Book Issue.** The
   flow already supports Enter-to-submit on the ID field (§3.12), but once the member is found the
   operator must click into the Accession field manually before scanning — see suggestion 1 for the
   auto-focus fix, which doubles as an implicit "keyboard shortcut" once implemented.

## 4. User-experience suggestions

1. **Barcode-scan auto-focus/auto-submit for Issue and Return desks.** Book Issue and Book Return
   already require the operator to click into "Student/Staff ID" and "Accession No." fields and
   press Enter or click Go — for a barcode-scanner-as-keyboard workflow at a busy circulation desk,
   every extra click costs real seconds across hundreds of daily transactions. Auto-focusing the next
   empty field the instant the previous lookup resolves (member found → auto-focus Accession field;
   book resolved → auto-focus the date field) and auto-submitting on a scanner's trailing Enter
   (already partially done — `Go` fires on Enter, per §3.12/§3.13) closes the loop end-to-end so an
   operator never touches the mouse during a normal issue/return.

2. **Due-date countdown badge on Book Issue's "Issued Details" table.** The Issued Details panel
   (§3.12 step 3) lists `{accessionNo} : {resourceName}` per book but no due date or overdue flag —
   the operator has no visibility into whether the member standing at the counter already has an
   overdue book. Since §5.2 of the user-stories notes there's no fine calculation, a simple red
   "Overdue by N days" / amber "Due in N days" badge next to each issued title (computed client-side
   from data already available: `dueDate` vs. today) would at least surface the situation at the
   point of contact, even before a fines feature exists.

3. **Bulk book-category tagging.** Book Categories (`book-category`) lets you rename/reorder
   categories but there is no bulk "move these 40 resources from Category A to Category B" tool —
   that has to happen one-by-one through Book Edit's per-row edit form. A dedicated bulk-recategorize
   action on the Book Edit list view (checkbox column + "Move selected to…" select) would remove a
   large amount of repetitive per-book editing when a librarian reorganizes the catalog taxonomy.

4. **Availability check as a debounced live validator, not blur-only.** Book Add's "Check
   availability" (§3.3) fires on click or blur — a librarian who tabs quickly through the form (a
   common data-entry habit) still triggers it correctly, but there's no inline hint *while typing*
   that this Accession No. is likely a duplicate. A short debounce-on-keystroke check would catch a
   duplicate accession number before the librarian has filled out the rest of a 20+ field form,
   instead of after.

5. **Skeleton/empty-state polish for report screens.** Book Report/OPAC's `!data?.hasFilter` state
   just shows "Please select search option" — fine, but combined with the fact these are the module's
   heaviest tables (15–20 columns), a first-time user has no indication of *what* a good search looks
   like. A short example hint ("Try searching by Title or Accession No.") next to the empty state
   would reduce the trial-and-error currently needed to discover the `searchBy` dropdown exists.

6. **Reference-copy issue should require an explicit acknowledgment, not just a warning.** §5.5 of
   the user-stories flags that "This is Reference Copy. It should be returned today itself." is
   advisory-only — the Issue submit button is not gated on it. A checkbox "I understand this is a
   same-day reference copy" that must be ticked before Issue is enabled would turn a message an
   operator can easily skim past into an actual confirmation step, closing a real operational risk
   (reference material walking out for the standard loan period).

7. **Manual Attendance Entry row removal should warn before dropping a filled row.** `att-entry`'s
   `-` button (§3.17) removes a row instantly with no confirmation — if a row already has a Reg No
   and times typed in, one misclick silently discards that entry before Save. A row with any
   non-empty field could require a lightweight inline confirm (not a full modal — just a
   "Remove — click again to confirm" two-step button) to prevent accidental data loss on the
   compact, keyboard-fast attendance grid.

8. **Attendance kiosk should replay a short toast/history, not only the latest scan.** The
   `attendance` kiosk screen only ever shows the last lookup's result — if two people scan in quick
   succession, the desk operator has no way to confirm the *previous* scan actually registered
   before it's overwritten. A small "last 3 scans" strip beneath the main result panel would give
   the operator a visible audit trail without leaving kiosk mode.

9. **Paste-to-fill for "Add Book (copy accession numbers)."** Following gap 6, letting the librarian
   paste a newline- or comma-separated list of new accession numbers into the first row and having
   the form auto-expand into that many rows (splitting on the delimiter) would turn a repetitive
   typing task into a single paste for the common case of accessioning a batch of identical new
   copies at once.

10. **Optimistic UI on Book Categories' row Save.** Today the `+` button appends a local blank row
    and Save submits the whole `rows` array in bulk (§3.2) — reasonable, but there's no per-row
    "saved" indicator once the bulk save resolves, so on a large category list it's not obvious
    which rows actually persisted vs. which are still pending the next Save click. A brief
    checkmark/highlight on newly-persisted rows after a successful save would close that feedback
    gap.

11. **Mobile/responsive pass on the 15–20 column report tables.** Book Report, OPAC, and Barcode all
    render wide fixed-column tables (§3.5–§3.7) with no horizontal-scroll affordance called out in the
    JSX beyond whatever the surrounding card provides — on a tablet-sized screen (plausible for a
    librarian working the floor with a tablet rather than the front-desk PC), these tables need an
    explicit `overflow-x: auto` wrapper and possibly a condensed/priority-column mode, not just
    reliance on the browser's default table overflow behavior.

12. **Accessibility: label the raw-object-key gaps.** Unlike Hostel's Attendance Setup (which has the
    same raw-object-key label problem), Library doesn't currently exhibit this pattern based on the
    traced JSX — worth a quick audit sweep across the module's remaining un-excerpted screens (Task
    Category-equivalent bespoke screens don't exist in Library, but Dashboard's stat labels and drill
    filter chips render `f.label: f.value` directly, §3.1) to confirm no screen-reader-unfriendly raw
    keys have crept in as the module gets extended.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Swap Book Add / Book Edit's Branch `<select multiple>` for `CheckListSelect` (component
  already exists, just wire it in — gap 1).
- Add a due-date countdown badge to Book Issue's Issued Details table (client-only computation
  from existing `dueDate` data — suggestion 2).
- Add auto-focus-next-field to Book Issue / Book Return after each successful lookup
  (suggestion 1, first half).
- Add a "click again to confirm" guard on Manual Attendance Entry row removal for non-empty rows
  (suggestion 7).
- Add a short example hint to the Book Report/OPAC empty-filter state (suggestion 5).
- Add an `overflow-x: auto` wrapper (if not already present at a parent level) around the wide
  report tables so they degrade gracefully on tablet-width screens (suggestion 11).
- Add a per-row "saved" checkmark/highlight after Book Categories' bulk Save resolves
  (suggestion 10).

**Bigger investments (needs design/product buy-in first):**
- Multi-field simultaneous search (title + author together) on Book Report/OPAC/Book Edit list —
  changes the filter form's shape and the server-side query builder (gap 3).
- Typeahead/autocomplete lookup for accession numbers and member IDs on Transfer/Issue/Return
  (gap 4) — needs a debounced search endpoint and a `SearchableSelect`-style UI, more than a
  component swap since these are currently plain text inputs, not selects.
- Bulk book-category reassignment tool on the Book Edit list view (suggestion 3) — needs a new
  checkbox-select-and-bulk-action UI plus a new bulk save endpoint.
- Reference-copy same-day acknowledgment + enforcement (suggestion 6) — UI is small but the
  product decision (should it also warn on save server-side / restrict due-date field) needs
  sign-off since it changes desk behavior, not just cosmetics.
- Grouped (`<optgroup>`-aware) `CheckListSelect` variant for Library Attendance Report's Category
  field (gap 2) — requires extending the shared component, not just consuming it.
- Paste-to-fill row expansion for the "Add Book (copy accession numbers)" sub-form (gap 6/
  suggestion 9) — needs a parsing/validation UX decision (what happens on malformed paste input,
  duplicate accession numbers within the pasted batch) before implementation.
- "Recently scanned" local suggestion list for Book Issue/Return's Accession field (gap 7) — small
  in isolation, but should be scoped alongside the auto-focus work (suggestion 1) so the two don't
  conflict on the same field's interaction model.

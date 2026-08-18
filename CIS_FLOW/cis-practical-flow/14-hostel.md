# 14 — Hostel — Frontend Control & UX Audit

## 1. Module recap

The Hostel module manages hostel/quarters blocks and rooms, room rental pricing, student hostel
allocation, staff quarters allocation, school transport (vehicles, stops, fee config), hostel gate
attendance windows, and hostel pass (leave) approval — 15 setup screens plus a hub, entirely
back-office (no student/staff self-service screen exists anywhere in this module today). Like
Library, it has its own hand-rolled hook (`client/src/pages/hostel/useHostelSetupApi.js`) and page
shell (`client/src/pages/hostel/HostelSetupPage.jsx`) instead of the shared factory, though it
mirrors the factory's contract closely (including its own `stripSaveMeta()` and
`useTransientNotice()`). Full field-by-field detail:
[user-stories/14-hostel.md](../user-stories/14-hostel.md).

The defining characteristic of this module for a UX audit is that room/bed occupancy is managed
entirely through **free-text fields and one-form-per-allocation flows** — there is no visual map of
which rooms exist, which are full, or which are empty anywhere in the module (see gaps below).

## 2. Frontend control inventory

| Screen (slug) | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Dashboard (`dashboard`) | Native `<input type="date">`, stat tiles | No | — | No | Stat labels are raw server-returned object keys, not curated friendly text; read-only |
| Block Setup (`block-setup`) | Radio groups (Block Type, Floor) per row, text inputs, editable grid | No | — | No — row add/delete one at a time | Shared `ConfirmModal` before delete; delete button hidden for unsaved rows; no check for rooms/occupants under a deleted block |
| Room Add (`room-setup-add`) | Native `<select>` (`BlockSelect`, grouped by `<optgroup>`), text inputs (incl. free-text `Bed` — not numeric-typed) | No | Single | No | Room No pre-filled from server-suggested `nextRoomNo` |
| Room Edit (`room-setup-edit`) | Text search, native `<select>` (`BlockSelect`, Room Type), table with Edit/Delete | Yes | Single | No | List/edit toggle; Previous/Next pager (not numbered pages); `ConfirmModal` before delete; Room Type only assignable here, not on Add |
| Rental Config (`room-rental-setup`) | Native `<select>` (`BlockSelect`), editable table (Amount per room) | No | Single (block filter) | No — bulk update via one Save, but no row selection | Table only renders once a block is chosen |
| Transport Add (`transport-add`) | Radio group (Vehicle Type), native `<select>` (Trip 1–5), text/number inputs, `<input type="file">`, checkbox grid (Stops) | No | Multi (checkbox grid, one per stop) | No "select all"/"clear" on the stop checkbox grid | Photo uploaded via `FileReader`→base64 into `files` array |
| Transport Edit (`transport-edit`) | Same as Add + list/search + existing-photo preview | Yes (list search) | Single (list); multi (stop checkboxes) | No | `ConfirmModal` before delete; keeps old photo if no new file chosen |
| Stopping Setup (`transport-stopping-setup`) | Editable grid (Order/Name/KM text) | No | — | No — row add/delete one at a time | Same shape as Block Setup; `ConfirmModal` before delete |
| Transport Fee Config (`transport-fee-config`) | Editable table (Amount per stop), pager | No | — | No | "Page X of Y" Previous/Next pager, client-assumed page size |
| Student Hostel (`student-hostel`) | Text input + Load button (register no.), free-text `Block`/`Room` fields per stay row, date-range inputs | Exact register-no. lookup only | Single | **No add/delete row buttons rendered at all** despite server supporting delete | Server defaults to one blank stay row if student has none; Block/Room are plain text, not a dropdown of actual rooms |
| Attendance Setup (`att-setup`) | Four `<input type="time">` fields | No | — | No | Field labels are raw object keys (`outFrom`, `outTo`, `inFrom`, `inTo`), not friendly text |
| Attendance Report (`attendance-report`) | Date range + Load button | No | — | No | Table columns/headers derived dynamically from `Object.keys(data.rows[0])` — not a fixed friendly header set |
| Pass Approval (`pass-approval`) | Per-row Approve/Reject buttons | No | — | No — one row approved/rejected at a time | Zero filter controls; always loads whatever the server considers pending |
| Pass Report (`pass-report`) | Date range + Load button | No | — | No | Same dynamic-header pattern as Attendance Report |
| Staff Rental (`staff-rental`) | Radio group (Search By: Name/Staff ID/Category), native `<select>` (Category, when chosen), clickable staff-picker button list, per-stay native `<select>`s (Type/Block/Room), checkboxes, date range | Yes (name/ID/category) | Single (staff picker); per-stay rows are add/delete | Row-level delete (`ConfirmModal`), no bulk selection | Staff-picker buttons color-code selection state and existing-allocation state (`hasHostel`) |

**Module-wide pattern:** zero uses of `SearchableSelect` or `CheckListSelect` in
`client/src/pages/hostel/`. `ConfirmModal` (shared component) is used consistently across every
row-delete flow in this module (Block Setup, Room Edit, Transport Edit, Stopping Setup, Staff
Rental) — this module is actually the most consistent of the three about confirm-before-delete.
Transport Add's Stops checkbox grid is the only true multi-select control anywhere in the module,
and it has no bulk toggle.

## 3. Advanced feature gaps

1. **Student Hostel's `Block`/`Room` fields are free text, not a picker against real rooms**
   (§3.10 in user-stories). Every other allocation-adjacent screen in this module (Room Add/Edit,
   Rental Config, Staff Rental) resolves rooms through an actual `BlockSelect` + room list — Student
   Hostel alone lets an operator type any string into Block/Room with zero validation against
   `hostel_rooms_tb`. This isn't just a missing search feature, it's the root cause of the room
   over-allocation gap flagged in user-stories §5.1: because there's no dropdown of real rooms, there's
   nothing to cross-check bed count against. Reusing `BlockSelect` + a room `SearchableSelect` here
   (mirroring Staff Rental's pattern, §3.15) would close both the UX gap and materially reduce the
   data-integrity risk.

2. **Staff Rental's staff-picker list** (§3.15) is a plain clickable button list with a
   Name/ID/Category radio filter — functionally a hand-rolled single-select list, exactly what
   `SearchableSelect` already generalizes (search-as-you-type, single value, portal dropdown). At a
   college with hundreds of staff, scrolling a button list to find one person by eye is slower than
   typing a few characters into a search box.

3. **Transport Add's Stops checkbox grid** (§3.6) has no "Select all routes" / "Clear" affordance —
   for a vehicle serving 15+ stops, toggling each checkbox individually is tedious. `CheckListSelect`
   already provides exactly this (`Select all`/`Clear` toolbar, plus search once the option count
   exceeds 8) and would drop in directly since Stops is already conceptually a multi-value array of
   IDs.

4. **Room Edit's list search** (§3.4) is a single free-text box with no field-scoped filter (unlike
   Library's Book Edit, which offers a `searchBy` dropdown) — a hostel officer can't narrow to "just
   this block" or "just this room type" without typing block/type names into the same box as the
   room number, if that's even supported server-side.

5. **Rental Config and Transport Fee Config's editable-amount tables** have no bulk "apply this
   amount to all rows" action — every room/stop's amount must be typed individually even when a
   flat rate applies to most of them (a common real-world case: all standard rooms cost the same,
   only a few premium rooms differ).

6. **Transport Edit's list search** (§3.7) is a single free-text box against vehicle records with no
   field-scoped filter (route vs. reg. no. vs. vehicle ID) — same shape of gap as Room Edit (gap 4),
   worth fixing together since both list screens share the same list/edit toggle pattern and could
   share one field-scoped search component.

7. **Pass Report and Attendance Report's dynamically-derived columns** (§3.12/§3.14) mean the UI has
   no fixed idea of what columns *should* exist — if the server's SQL result shape changes (a column
   added/renamed), the table silently reflects it with no guardrail, and there's no way to sort or
   filter by a specific column since the client doesn't know which key means what. This is a control
   gap (no sort/filter at all on either report) as much as a labeling gap (covered in suggestion 5).

## 4. User-experience suggestions

1. **Visual room-occupancy grid instead of a form-per-allocation.** This is the single biggest gap
   in the module. Today, understanding "which rooms in Block A are full/empty/how many beds free"
   requires either the warden's memory or manually cross-referencing Room Edit's list against every
   Student Hostel record — there is no dashboard, grid, or summary view anywhere in
   `client/src/pages/hostel/` that shows occupancy at a glance. A room-occupancy grid (one tile per
   room, grouped by floor/block, showing occupant count vs. `bed_count`, color-coded full/partial/
   empty) on the Hostel Dashboard or as its own screen would let a warden see capacity instantly
   instead of paging through Room Edit's list or opening individual student records — and it would
   make the over-allocation risk (user-stories §5.1) visible in the UI even before a hard server-side
   check exists.

2. **Bulk room reassignment.** When a block is renovated or students are reshuffled between wings, a
   warden currently has to open Student Hostel once per affected student and retype Block/Room by
   hand. A bulk-reassignment tool (select N students currently in Room X, move all to Room Y in one
   action) would remove the most repetitive part of a real semester-turnover workflow — this pairs
   naturally with suggestion 1's occupancy grid, since selecting students-to-move from a visual room
   tile is a much more natural interaction than hunting through free-text search results.

3. **Make Student Hostel's Block/Room an actual dropdown, not free text (see gap 1).** Beyond fixing
   the data-integrity risk, this alone is a UX win: a warden typing a room number today gets zero
   autocomplete and no feedback if they mistype it — the room reference just silently becomes an
   orphaned string with no link back to `hostel_rooms_tb`.

4. **Restore Student Hostel's missing delete-row control.** User-stories §5.4 documents that
   `saveStudentHostelSetup` already supports `action: 'delete'` server-side, but
   `StudentHostelSetup.jsx` never renders a delete button — Staff Rental's near-identical screen does.
   Adding the same per-row delete + `ConfirmModal` pattern already proven on Staff Rental closes a
   real capability gap (a warden currently cannot remove an erroneous hostel-stay entry from this
   screen at all) with a pattern that's already implemented once in this exact module.

5. **Friendly labels instead of raw field-name/object-key text.** Attendance Setup's four time
   fields render the literal strings `outFrom`/`outTo`/`inFrom`/`inTo` as labels (§3.11), and both
   Attendance Report and Pass Report derive table headers from `Object.keys(data.rows[0])` (§3.12/
   §3.14) — meaning column labels are whatever the server happens to name its SQL result columns.
   This is a low-effort, module-wide polish item: map field/column keys through a small
   label-lookup table (`{outFrom: 'Gate Out (From)', ...}`) the way most other CIS screens already
   do, so the UI doesn't leak internal naming to end users.

6. **Warn (not silently allow) Discontinue + Rental Fee together on Staff Rental.** §5.6 of the
   user-stories flags that a discontinued allocation can still be flagged fee-liable because the two
   checkboxes are wired independently. A simple inline warning ("This allocation is marked
   Discontinued but Rental Fee is still Yes — clear it?") when both are checked would catch a
   plausible data-entry mistake at the point of entry instead of downstream in a billing report.

7. **Bulk "apply to all" for Rental Config / Transport Fee Config amount tables.** As noted in gap 5,
   a single "Set all to ₹___" action (with per-row override still available afterward) would remove
   the most repetitive part of configuring rates for a block/route where most rows share one price.

8. **Pass Approval needs at least a date/type filter.** §3.13 notes zero filter controls exist — the
   screen always shows whatever the server considers pending. As the pending queue grows (multiple
   hostels, multiple pass types), an approver has no way to narrow the list to, say, "just today's
   requests" or "just Block A" without server-side changes to what counts as pending — worth adding
   basic filters even if the "pending" definition itself is fine to leave server-controlled.

9. **Add sortable, fixed-friendly-label columns to Attendance Report and Pass Report.** Following
   gap 7, giving these two reports a fixed column set with click-to-sort headers (even a simple
   client-side sort over the already-fetched `data.rows`) would let an officer answer "who was last
   in/out" or "which pass is oldest" without exporting the data elsewhere first.

10. **Photo-forward vehicle list on Transport Edit.** Since Transport Add/Edit already capture and
    preview a vehicle photo (§3.6/§3.7), showing a small thumbnail in the Transport Edit list table
    (not just after opening the edit form) would let transport staff visually identify a vehicle by
    its photo rather than only its Vehicle ID/Reg No text — useful when multiple similar buses share
    similar ID patterns.

11. **Staff Rental's staff-picker list could show occupancy detail inline, not just a color flag.**
    Today `hasHostel` only changes a button's outline color (§3.15) — hovering or expanding to see
    *which* block/room that staff already occupies (without leaving the picker) would save a click
    into that staff's record just to check before deciding whether to reassign them.

12. **Empty-state guidance on Rental Config before a block is chosen.** The rate table only renders
    once a block is selected (§3.5) — a first-time user sees nothing until they realize they need to
    pick a block first. A short "Select a block above to configure room rates" placeholder (the same
    pattern Library's report screens already use for their `!data?.hasFilter` state) would remove
    that initial confusion.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Add the missing per-row delete button to Student Hostel, reusing the exact pattern already
  built for Staff Rental (`ConfirmModal` + `action: 'delete'`) — suggestion 4.
- Swap Transport Add's Stops checkbox grid for `CheckListSelect` (component exists, drop-in swap,
  Stops is already an array of IDs) — gap 3.
- Replace friendly-label gaps (Attendance Setup field labels, Attendance/Pass Report dynamic
  headers) with a small label-lookup map — suggestion 5.
- Add an inline warning when Discontinue + Rental Fee are both checked on Staff Rental —
  suggestion 6.
- Add a basic date/type filter row to Pass Approval — suggestion 8.
- Add an empty-state placeholder to Rental Config before a block is selected — suggestion 12.
- Add vehicle photo thumbnails to Transport Edit's list table (photo data already fetched for the
  edit form, just needs surfacing in the list row) — suggestion 10.
- Add basic client-side column sort to Attendance Report / Pass Report over already-loaded rows —
  suggestion 9.

**Bigger investments (needs design/product buy-in first):**
- Visual room-occupancy grid (dashboard or standalone screen) — suggestion 1; needs a new
  aggregation endpoint (rooms × current occupants) and new UI design, not a component swap.
- Bulk room reassignment tool — suggestion 2; depends on the occupancy grid existing first, and
  needs a new bulk-save endpoint.
- Convert Student Hostel's Block/Room from free text to a real `BlockSelect` + room picker —
  gap 1/suggestion 3; touches both client form shape and the server save/load contract
  (`studentHostelSetup.js`), and should be paired with the server-side bed-capacity check flagged
  in user-stories §6.2 rather than shipped as a UI-only change.
- `SearchableSelect` swap for Staff Rental's staff-picker button list — gap 2; needs the staff
  list piped through as `{value, label}` options plus deciding how the existing `hasHostel`/
  selected-state styling survives inside the shared component's item rendering.
- "Apply to all" bulk-amount action for Rental Config / Transport Fee Config — gap 5/suggestion 7;
  small UI addition but needs product sign-off on whether it should overwrite existing per-row
  overrides or only fill blanks.
- Fixed, sortable, field-scoped column/filter model for Attendance Report, Pass Report, and
  Transport Edit's list search (gaps 6/7) — requires agreeing on a canonical column set with the
  server team so the client can stop relying on `Object.keys(data.rows[0])` and instead render a
  known, labeled, sortable schema; also unblocks per-column filtering that isn't possible today.
- Staff Rental picker's inline occupancy detail (suggestion 11) — needs a small new data field from
  the staff-list load (current block/room, not just the boolean `hasHostel` flag) plus a UI decision
  on hover-card vs. inline expansion.

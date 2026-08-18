# 23 — Circular

## 1. Module recap

The Circular module is the office-notice/memo workflow: draft → (optional signature-routed
approval) → print by audience (Student/Staff/Department). Nine screens share one hook
(`useCircularSetupApi`) and one dispatcher (`circularSetup.js`). Full field-by-field behavior,
save/validation rules, and all twelve user stories already live in
[user-stories/23-circular.md](../user-stories/23-circular.md) — this file does not repeat that
detail, it audits the **input controls** those screens use today and where they fall short of
patterns already proven elsewhere in the app (`SearchableSelect`, `CheckListSelect`).

Component directory: `client/src/pages/circular/` and `client/src/pages/circular/setup/`.

## 2. Frontend control inventory

| Screen | File | Control(s) used | Search? | Multi-select? | Bulk actions? | Other interaction detail |
|---|---|---|---|---|---|---|
| Circular Dashboard | `setup/DashboardSetup.jsx` | Native `<input type="date">` | — | — | — | `onChange` immediately re-loads (no Go button); stat cards are read-only `Object.entries()` render, no drill-down click |
| Circular Setup (Copy To / Signature lists) | `setup/SetupSetup.jsx` | Native `<select>` (Category, 3 fixed options) + inline-editable plain `<input>` grid (Order/Name/Mobile/Attachment) | No | No | No — `+` only appends one blank row, no "select rows then delete" | No delete button on a row at all in the JSX (server supports `action:'delete'` but nothing in this component calls it); Save re-submits the whole `rows` array every time |
| Add Circular | `setup/AddSetup.jsx` | Text inputs (Title, Sub Title), `<input type="date">` ×2 with cross `min`/`max`, native `<select>` (Audience, 3 hardcoded options), `<textarea>` (Description), `<input type="file">` (single file, no `accept` attribute) | — | — | — | No Copy To Department / Copy To Board / Signature picker rendered at all — see gap below |
| Edit Circular | `setup/EditSetup.jsx` | Text search input + Search button; `<ul className="list-group">` result list with per-row Edit button; edit form: text input (Title), `HtmlRichTextEditor` (Description) with live HTML preview pane | Yes (server-side substring `LIKE`, triggered by explicit button, not live-as-you-type) | No | No | Delete button has **no confirm dialog** — direct `onSave({action:'delete'})` on click |
| Approve Circular | `setup/ApproveSetup.jsx` | Plain HTML table, one Approve + one Reject `<button>` per row | — | No — one row acted on at a time | No "Approve all" / bulk action | No confirm dialog on either button; row disappears from the list immediately on success (optimistic-feeling but actually a full reload) |
| Circular Report | `setup/ReportSetup.jsx` | `<input type="date">` ×2 (cross min/max) + Load button | — | — | — | Table header is auto-generated from `Object.keys(row)` — raw camelCase field names shown to the user, not friendly labels; no empty-state message |
| Print — Student/Staff/Department | `setup/CircularPrintSetup.jsx` (shared by 3 routes) | `<input type="date">` ×2 + Load button; per-row **View/Collapse** toggle button expanding an inline preview card; **Print** button inside the preview card | — | — | — | Attachment cell is a plain `<a target="_blank">`; description preview is a manually truncated (160-char) strip-tags string, not a rich preview |

**Cross-cutting observation:** every date-range screen in this module (Dashboard, Report, all
three Print screens) hand-rolls its own pair of `<input type="date">` with matching
`min`/`max` cross-constraints — five near-identical copies of the same six lines of JSX, no
shared `DateRangePicker` component exists yet.

## 3. Advanced feature gaps

1. **Add Circular has no Copy To Department / Copy To Board / Signature picker at all**, even
   though the load response already includes `departments`/`boards`/`signatures` option arrays
   and the save endpoint already accepts `copyToDept`/`copyToBoard`/`signatures` (user-stories
   US-15). This isn't a "wrong control" gap, it's a **missing control** gap — and when it's
   built, `CheckListSelect` (searchable, multi-select, "Select all"/"Clear", used today in
   `DeptAuthSetup.jsx`) is the obvious fit for all three lists, not a bare
   `<select multiple>`. Signature selection in particular drives the approval-routing rule
   (US-2: any signature selected ⇒ starts pending) — surfacing it as a `CheckListSelect` panel
   with a visible "N selected" count would make that consequence legible to the drafter before
   they submit, instead of it being an invisible backend side effect.
2. **Circular Setup's Category dropdown is a native `<select>` for a fixed 3-item list** — this
   one is fine as-is (3 options never needs search), but the **row grid below it** has no way to
   remove a row from the UI even though the server fully supports soft-delete
   (`action:'delete'`). This isn't a control-type mismatch, it's an entirely absent control — a
   per-row **Delete** icon button (matching the `btn-outline-danger btn-sm` style used elsewhere
   in this same module, e.g. Edit Circular's Delete button) is the natural fix.
3. **Edit Circular's search-then-list pattern has no pagination or result cap surfaced to the
   user.** The server caps default (no-search) results at 50 rows server-side, but the list
   `<ul>` renders all of them with no "showing 50 of N, refine your search" hint — a user with a
   large circular history has no way to know the list is truncated.
4. **Approve Circular's list has no filter/search control at all** — it always shows up to 100
   pending rows with no way to narrow by audience or title. A backlog of 100 pending circulars
   forces manual scanning. `SearchableSelect`-style substring filtering (or even a plain
   client-side text filter above the table) is proven elsewhere and would drop in cleanly since
   the whole row set is already loaded client-side.
5. **Circular Report's dynamically-generated table (`Object.keys(row)`) has no column
   configuration, sort, or filter control** — it is the least "controlled" report table in the
   audited screens. Every other report screen in the app that reaches this many columns
   (e.g. academic/fee reports) at minimum sorts by a clicked header; this one has neither
   click-to-sort nor a status/audience filter control in the UI even though the server already
   accepts `status`/`source` filters from a prior load cycle (per user-stories §3.6) — those
   filters are simply never set by any control in the JSX.

## 4. User-experience suggestions

1. **Read-receipt / acknowledgement tracking on Print — Student/Staff/Department.** Right now a
   circular is "delivered" the moment it's approved and printable, but there's no record of who
   actually opened/viewed/printed it. Adding a lightweight acknowledgement action (e.g. a
   "Mark as read" checkbox per audience group, or auto-logging a view when the preview card is
   expanded) would let office staff answer "did the department heads actually see this notice?"
   — currently unanswerable from the UI. This matters specifically for compliance-flavored
   circulars (exam schedule changes, safety notices) where "we sent it" isn't the same as "they
   saw it."
2. **Urgent-flag styling on Add/Edit and the print/report tables.** The data model has no
   urgency concept today — every circular looks identical in the Approve queue and the Report
   table regardless of whether it's a routine notice or a same-day emergency announcement. A
   simple "Urgent" toggle on Add/Edit that renders a red badge/row-highlight in Approve Circular,
   Circular Report, and the Print screens would let an approver triage a 100-row pending queue
   at a glance instead of reading every title. This directly helps the "we approved the wrong
   thing / too slowly" failure mode called out in user-stories US-8 (no retraction path once
   printed).
3. **Confirm dialog before Delete on Edit Circular and (once built) on Circular Setup's row
   grid.** Both current Delete buttons fire immediately on click with no "Are you sure?" step —
   for Edit Circular this is a destructive soft-delete of a potentially already-distributed
   notice. A simple `window.confirm()` or inline confirm-in-place pattern (already used
   elsewhere in the app for destructive actions) closes an easy accidental-click gap.
4. **Bulk Approve/Reject on the Approve Circular screen.** When multiple circulars from the
   same drafter/batch arrive together (e.g. department-wide notices submitted in one sitting),
   an approver currently must click Approve once per row. A `CheckListSelect`-style checkbox
   column with a "Approve selected" bulk action (mirroring the "Select all"/bulk pattern
   `CheckListSelect` already implements) would cut a 10-circular batch from 10 clicks to 2.
5. **Friendly column headers on Circular Report.** Replace the raw `Object.keys(row)` header
   render (`subTitle`, `audienceFor`, `circularFrom`, …) with a small label map
   (`{ subTitle: 'Sub Title', audienceFor: 'Audience', circularFrom: 'From', … }`) — a five-line
   change that immediately makes the report presentable/printable to a non-technical reader
   without touching the underlying dynamic-column mechanism.
6. **Empty-state message on Circular Report.** `CircularPrintSetup.jsx` already shows "No
   approved circulars in this date range." for zero rows; `ReportSetup.jsx` has no equivalent
   (user-stories US-10) — copying that one line closes a real inconsistency a user would notice
   when comparing the two nearly-identical screens side by side.
7. **Inline validation on Add Circular's date range.** From/To Date already have `min`/`max`
   cross-constraints (so the browser blocks an invalid range once one date is picked), but there
   is no inline hint if a user tabs through both fields quickly before the constraint applies —
   a small "To Date must be on or after From Date" helper text under the fields would make the
   constraint legible instead of only enforced.
8. **Autosave / draft-recovery for Add Circular and Edit Circular's rich-text Description.**
   Both forms hold meaningful, potentially long-form content (rich HTML for Edit, a full notice
   body for Add) in plain component state with no localStorage backup — a browser refresh or
   accidental navigation away loses everything typed. A debounced `localStorage` draft save
   (keyed by circular id, or a "new" sentinel for Add) recoverable on next visit would protect
   against this without any server change.
9. **Live preview toggle for the description on Add Circular**, matching the "Document preview"
   card that Edit Circular already has next to its `HtmlRichTextEditor`. Add currently uses a
   plain `<textarea>` with no preview at all, so a drafter writing a Description with HTML
   markup (e.g. pasted from Word) has no way to see how it will actually render on the print
   screens until after Submit — inconsistent with Edit, which already solves this.
10. **Keyboard shortcut for Search on Edit Circular.** The search box requires an explicit click
    on the **Search** button — pressing Enter inside the text input does nothing today since it
    isn't wrapped in a `<form onSubmit>` the way Activities/Courier/Incident Edit's search boxes
    are (compare [24-admin-office.md](24-admin-office.md), whose search inputs are `<form>`-
    wrapped and therefore already submit on Enter). Wrapping Circular's search bar in the same
    `<form onSubmit>` pattern used elsewhere in the app would fix this with a near-zero diff and
    remove an inconsistency between two modules doing the same search-box job differently.
11. **Optimistic UI on Approve/Reject.** Today a click on Approve/Reject waits for the full
    save-then-reload round trip before the row visibly disappears from the pending queue —
    for an approver working through a long backlog, removing the row from the table immediately
    on click (rolling back only if the save actually fails) would make the bulk-triage workflow
    feel noticeably faster, especially once/if bulk approve (suggestion 4) is built on top of it.
12. **Mobile responsiveness check on Circular Report's dynamic table.** Since the column set is
    generated from `Object.keys(row)` and can include long fields like `description`, the table
    has no responsive column-hiding or horizontal-scroll affordance beyond the generic Bootstrap
    `.table-responsive` wrapper already used elsewhere — on a narrow viewport this produces a
    wide table requiring horizontal scroll with no sticky first column (Title/ID), making it hard
    to keep context while scrolling right to read later columns.
13. **Accessibility pass on the Approve/Reject buttons.** Both buttons currently carry only
    visible text ("Approve"/"Reject") with no `aria-label` tying them to which circular's title
    they act on — for a screen-reader user tabbing through a table of same-looking button pairs,
    an `aria-label={`Approve "${row.title}"`}` (and the Reject equivalent) would remove the
    ambiguity of "which row am I on" that sighted users resolve visually via table position.
14. **Skeleton loading state on all seven data-bearing screens.** None of the audited components
    (Dashboard, Setup, Edit's list, Approve, Report, Print) render a loading skeleton distinct
    from whatever the page shell's own `busy` indicator provides — a first-time page load or a
    slow filter reload shows either nothing (Approve's table stays whatever it last was) or a
    blank area (Dashboard's stat cards) until data arrives. *Why it matters specifically here:*
    Approve Circular in particular can hold up to 100 rows; a skeleton row set (even a generic
    3-row shimmer placeholder) would give an approver clearer feedback that a reload is in
    progress versus the screen simply being empty.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Add the "No records for this range" empty-state message to `ReportSetup.jsx` (copy the one
  line already used in `CircularPrintSetup.jsx`).
- Add a friendly column-label map to Circular Report instead of raw `Object.keys()`.
- Add a `window.confirm()` step before the Delete actions in `EditSetup.jsx` (and any future
  Circular Setup row-delete button).
- Add a per-row Delete button to `SetupSetup.jsx`'s Order/Name/Mobile/Attachment grid — the
  server-side `action:'delete'` path already exists and is unused by any control.
- Add a live HTML preview panel to `AddSetup.jsx`'s Description textarea, matching the one
  Edit Circular already has.
- Wrap Edit Circular's search bar in a `<form onSubmit>` so pressing Enter triggers Search,
  matching the pattern Admin Office's Edit screens already use.
- Add `aria-label`s to the Approve/Reject button pairs so each button's accessible name includes
  the circular title it acts on.

**Bigger investments (needs design/product buy-in first):**
- Building the Copy To Department / Copy To Board / Signature `CheckListSelect` pickers into
  Add Circular — touches approval-routing UX (US-2) and needs product sign-off on how the
  "signatures selected ⇒ pending" rule should be surfaced/explained to drafters.
- Read-receipt/acknowledgement tracking — new data model surface (who viewed/printed what),
  not just a UI change.
- Urgent-flag styling — needs a schema decision (new column vs. reusing an existing status
  field) plus a design pass on how urgency renders across Approve/Report/Print.
- Bulk Approve/Reject on the Approve Circular screen — needs a decision on whether bulk actions
  should log one `log_tb` entry per circular or one batched entry (audit-parity question).
- A shared `DateRangePicker` component to de-duplicate the five hand-rolled From/To date pairs
  across this module (and, per the cross-cutting Print & Reports audit, many other modules) —
  worth doing once, but is a cross-module refactor, not a Circular-only change.

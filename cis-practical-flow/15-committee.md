# 15 — Committee — Frontend Control & UX Audit

## 1. Module recap

Committee is the largest and most heterogeneous of the three modules covered in this doc —
academic/college committee membership rosters plus a full "St Task" task-management sub-system
(clients, task types, work types, budgets, documents, timesheets, approvals, and a TV/academic
calendar display), 28 registered screens across a single 2,738-line component file
(`client/src/pages/committee/setup/CommitteeScreens.jsx`). Unlike Library and Hostel, Committee
**does** use the shared `createSetupApi`/`ModuleSetupFactory` infrastructure
(`client/src/pages/committee/CommitteeModule.jsx`), which is why it gets client-side response
caching (`cachedGet`), `loadSeq`/`saveSeq` race-guarding, and a consistent breadcrumb/alert shell
that Library and Hostel lack. Full field-by-field detail:
[user-stories/15-committee.md](../user-stories/15-committee.md).

The most important fact carried over from the user-stories doc for this audit: **`RowSetupScreen`
— the shared generic component backing 8 of the module's reference-list screens (Designation, Task
Type, Task Work Type, Task Participator, Task Budget Expenses, Task Event Org, Task Miscellaneous,
Task Document Type) — deletes a persisted row on a single click with zero confirmation.** This is
called out explicitly in user-stories §5.5 as a real data-safety gap, and it is the headline item
in section 4 below, both as a data-safety issue and a UX issue.

## 2. Frontend control inventory

| Screen (slug) | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Committee Dashboard (`dashboard`) | Native `<input type="month">`, clickable drill-down cards | No | — | No | Read-only; drill-down resets on month change |
| Committee Report (`committee-report`) | Native `<select>` (Committee) | No | Single | No | Auto-loads on select; client-side print (clones DOM + inline CSS, unlike server-`printHtml` pattern used elsewhere) |
| Committee Add (`committee-add`) | Text, `HtmlRichTextEditor`, `<input type="file">`, checkbox grid (Category) | No | Multi (category checkboxes) | No "select all"/"clear" on category grid | 2 MB logo cap enforced server-side |
| Committee Edit (`committee-edit`) | Clickable list-group (committee picker), text, rich text, file, checkbox grid (Category) | No | Single (picker); multi (categories) | No | Loading overlay while switching committees; `Reset` restores last-loaded state; server delete branch exists with **no delete button rendered** in the screen |
| Manage Members (`committee-member`) | Native `<select>` (Committee filter, Staff per row, Designation per row), checkbox (Meeting Owner), date range per row, drag-reorder (`useDragReorder`) | No | Single (Committee filter); rows are add/delete | No bulk row actions | Drag handle reorders the read-only Order column; custom inline confirm modal (not shared `ConfirmModal`) for deleting persisted rows; server auto-seeds one blank row for a zero-member committee |
| Designation (`designation`) | `RowSetupScreen`: editable text-per-column table, drag-reorder | No | — | No | **Deletes persisted row with zero confirmation** (see §3) |
| Event Type (`event-type`) | Native `<select>` (with literal `"add_new"` option), detail form | No | Single | No | Master-detail; "Add new" is a select value, not a separate button |
| Task Category (`task-category`) | Bespoke (not traced in full pixel detail beyond user-stories §3.8) | — | — | — | — |
| Client Add/Edit (`client-add`/`client-edit`) | Form fields, one component parameterized by `isEdit` | — | — | — | — |
| Colour Setup (`task-colour`) | Bespoke | — | — | — | — |
| Task Type / Work Type / Participator / Budget Expenses / Event Org / Doc Type (`task-type`, `task-wtype`, `task-participator`, `task-budget-expenses`, `task-event-org`, `task-doc-type`) | `RowSetupScreen` (same shared component as Designation) | No | — | No | **All six share Designation's zero-confirmation delete** |
| Task Miscellaneous (`task-misc`) | `RowSetupScreen`, no Order column (not drag-sortable) | No | — | No | Same zero-confirmation delete; single `title` column only |
| Timesheet (`task-time-sheet`) | Bespoke | — | — | — | — |
| Task Dashboard (`task-dashboard`) | Bespoke | — | — | — | — |
| Task Allocation v1/v2 (`task-allocation`, `task-allocation-v2`) | Tabbed workspace, ~200 lines | — | — | — | Same component for both routes, differs only in seeded `initialLoadFields: {tab: 'open'}` |
| Task Report (`task-manage-report`) | Bespoke, multi-section report | Implied filters (`eventStatus`, `taskStatus` seeded) | — | — | Three-file server backend (1,065 combined lines); section-by-section print via `printTaskManageReportSection` (distinct from the flat `printHtml` pattern used elsewhere) |
| Task Documents (`task-document`) | Bespoke, file-oriented | — | — | — | — |
| Budget Approved (`task-budget-approved`) | Bespoke | — | — | — | — |
| Approve Event / Report / Reschedule (`approve-event`, `approve-event-report`, `approve-reschedule`) | Bespoke approve/reject controls | — | — | Presumably one row at a time | Reschedule has its own dedicated server file (`committeeApproveReschedule.js`) |
| TV Academic Event / Print (`tv-academic-event`, `tv-academic-print`) | Native `<select multiple size={3}>` (Department filter), Month/Year picker (years hard-coded 2017–currentYear+1), color-legend | No | Multi (department) | No | Prev/Next month navigation; conditional legend items (`showRejectedLegend`) |

**Module-wide pattern:** zero uses of `SearchableSelect` or `CheckListSelect` in
`client/src/pages/committee/`. `RowSetupScreen` (8 screens) is the module's dominant list-CRUD
pattern and is the **only** place in this entire three-module document where a persisted-row
delete has no confirmation step whatsoever — Committee Member uses a custom inline modal instead
of the shared `ConfirmModal`, and Committee Add/Edit's category picker is a plain checkbox grid
with no bulk toggle (unlike the toolbar `CheckListSelect` already provides for exactly this shape
of control).

## 3. Advanced feature gaps

1. **`RowSetupScreen`'s zero-confirmation delete (data-safety AND UX issue — call this out
   explicitly).** Per user-stories §5.5, `RowSetupScreen`'s `deleteRow` function calls
   `onSave({ action: 'delete', id: row.id })` directly on click, with no modal, no `window.confirm`,
   nothing — the one CRUD pattern in the entire Library/Hostel/Committee trio that behaves this way.
   This backs 8 screens: Designation, Task Type, Task Work Type, Task Participator, Task Budget
   Expenses, Task Event Org/Partners-Sponsors, Task Miscellaneous, Task Document Type — all
   reference-data used across the whole task-management sub-system. It is a **data-safety issue**
   because these rows are soft-deleted (`del=0`) and referenced by ids elsewhere (task allocations,
   budgets, documents point at these type/category ids), meaning a misclick during a normal row-edit
   session (e.g. clicking the delete icon instead of an adjacent edit control while scanning a dense
   table) permanently removes reference data other live records depend on. It is also a **UX issue**
   because every *other* delete flow in this three-module document confirms first — Block Setup,
   Room Edit, Transport Edit, Stopping Setup, Staff Rental (Hostel) all use the shared `ConfirmModal`;
   Committee Member uses a custom inline modal; Library uses `window.confirm` or `ConfirmModal`.
   `RowSetupScreen` is the sole outlier, so a user who has built a "delete always asks first" mental
   model from using the rest of the app gets no such safety net on these 8 screens specifically. The
   fix is small and already proven in this exact module: wire `RowSetupScreen`'s delete through the
   same shared `ConfirmModal` component Hostel already uses consistently, or the custom inline modal
   Committee Member already uses one screen over.

2. **Committee Add/Edit's Category checkbox grid** has no "Select all" / "Clear" bulk toggle — for a
   committee that legitimately spans most categories (e.g. a cross-cutting steering committee), an
   admin ticks every box by hand. `CheckListSelect` already provides exactly this toolbar and would
   be a straightforward swap since categories are already tracked as `form.categories` (an array of
   string ids) — the same shape `CheckListSelect`'s `value`/`onChange` contract expects.

3. **TV Academic Event/Print's Department filter** is a bare `<select multiple size={3}>` — the
   smallest, most cramped multi-select in this entire document (a 3-row visible listbox that
   requires scrolling to see all departments, with no visual indication of how many are selected
   beyond the ctrl/cmd-click highlight). Given this screen is meant for month-by-month browsing by
   staff preparing a lobby TV display, a `CheckListSelect` swap (with its "N selected" summary and
   larger click targets) would be a clear ergonomics win over the current listbox.

4. **Manage Members' Staff/Designation per-row `<select>`s** are plain native selects with no
   search — for a college-wide staff list, finding one name in an unsorted (or alphabetically sorted
   but unsearchable) native dropdown is slow, especially since this table can have many rows each
   needing an independent staff pick. `SearchableSelect` is a direct fit here since each row's Staff
   field is a single value, exactly the contract `SearchableSelect` implements.

5. **Committee Edit's list-group committee picker** has no search box — for a college with dozens of
   committees, the "click through a list-group to find yours" pattern (§3.4) doesn't scale as well as
   a searchable list would. This is a smaller gap than the others since list-groups are at least
   visually scannable (unlike a cramped native multiselect), but it's the same underlying
   "no search on a growing list" pattern seen across gaps 3 and 4.

6. **Event Type's `"add_new"` sentinel-value select** (§3.7) overloads a single native `<select>` to
   mean both "pick an existing event type" and "create a new one," via a magic string literal option
   value. This is a control-pattern smell independent of search/multi-select: a first-time user
   scanning the dropdown has no visual distinction between "Add new" and the real data rows below it
   until they've already read every option. A dedicated "+ Add new event type" button next to (not
   inside) the select would remove the ambiguity without needing any shared-component work.

7. **Task Allocation v1/v2's tabbed workspace** (§3.8, ~200 lines, the module's largest single
   screen) is entirely bespoke and not traced to individual control level in the user-stories source
   — given its size and the fact two routes (`task-allocation`, `task-allocation-v2`) share one
   component differing only by a seeded tab, it's worth a follow-up pixel-level pass (beyond this
   audit's scope) specifically to check whether its internal pickers (assignee, task type, date
   range) already use `SearchableSelect`/`CheckListSelect` or fall into the same native-select gap
   documented everywhere else in this file.

## 4. User-experience suggestions

1. **Confirm-before-delete on `RowSetupScreen` (highest priority in this file).** As detailed in
   gap 1, add a confirmation step before the delete `onSave` call fires — this single change protects
   8 screens' worth of reference data at once because they all funnel through the same shared
   component. Given `ConfirmModal` is already imported and used elsewhere in the codebase
   (`client/src/pages/fees/setup/ConfirmModal.jsx`), this is a genuinely small diff with
   disproportionate risk reduction — it should not wait for a broader design pass.

2. **Member search/filter on Manage Members.** With drag-reorder already implemented for ordering
   members (§3.5), the missing complement is being able to *find* a member quickly in a long roster —
   today the only way to locate a specific person in Manage Members is to visually scan the table.
   Adding a lightweight text filter above the member table (filtering visible rows by staff name,
   client-side, no server round-trip needed since the full row set is already loaded) would help
   committees with large rosters (e.g. college-wide bodies with 20+ members) without touching the
   save/drag logic at all.

3. **Confirmation consistency between Committee Member's custom modal and the shared `ConfirmModal`.**
   Committee Member (§3.5) uses its own inline Bootstrap modal for delete confirmation rather than the
   shared `ConfirmModal` component used elsewhere (Hostel, Library's Supplier Edit). Functionally
   equivalent, but consolidating onto one component reduces the chance that a future edit to
   `ConfirmModal` (e.g. adding a "type DELETE to confirm" step for destructive actions) misses this
   screen because it's a separate, hand-rolled copy.

4. **Surface Committee Edit's hidden delete capability, deliberately.** User-stories §3.4 notes the
   server delete branch exists but no client button triggers it — unlike Hostel's Student Hostel
   (also missing a delete button, flagged as a likely oversight), Committee Edit's omission could be
   intentional (committees may be considered too consequential to delete casually from this screen).
   Recommend a product decision either way rather than silently leaving a server capability
   unreachable: if delete should be possible from this screen, add the button behind the same
   `ConfirmModal` pattern the module needs anyway per suggestion 1; if it shouldn't, remove or
   document the unused server branch so a future contributor doesn't assume it's wired up.

5. **`CheckListSelect` for Category pickers (Committee Add/Edit) and Department filter (TV Academic
   Event).** Both are already array-of-ids controls under the hood (gaps 2 and 3) — swapping in the
   shared component gets "N selected" visibility and select-all/clear for free, improving screens used
   respectively at committee-creation time and every time staff prep the lobby TV calendar.

6. **Loading-overlay pattern (already good) should extend to Manage Members' Staff/Designation
   selects while switching committees.** Committee Edit and Committee Member both show a "Loading…"
   overlay while switching records (§3.4/§3.5) — a nice touch that prevents editing stale data. Worth
   confirming this overlay also disables/greys the Staff and Designation dropdowns during the fetch
   (not just the top-level committee selector), since a fast clicker could otherwise start picking a
   staff member into a row that's about to be replaced by the incoming committee's data.

7. **Approval screens (`approve-event`, `approve-event-report`, `approve-reschedule`) should share a
   consistent one-click Approve/Reject pattern with visible undo**, mirroring Hostel's Pass Approval
   (`status: 1`/`status: 2` on click, no confirm needed since it's non-destructive and reversible by
   re-approving). If Committee's approval screens already work this way, no change needed; if any of
   them lack an easy "I clicked the wrong button" recovery path, a brief toast with an "Undo" action
   (re-submitting the opposite status) would reduce anxiety around one-click approve/reject the same
   way it would on the Hostel side.

8. **Split Event Type's "Add new" sentinel into a dedicated button (see gap 6).** Same reasoning as
   gap 6 — a small, isolated change that removes a genuine "what does this option even mean" moment
   for first-time users of that screen.

9. **TV Academic Event/Print's hard-coded year range (2017–currentYear+1)** (§3.8) will silently stop
   making sense once "currentYear+1" rolls past whatever the original author assumed as a reasonable
   upper bound, and offers no way to jump to a specific year without scrolling a dropdown — worth a
   quick check that the range still auto-extends correctly rather than being a literal frozen array,
   and considering a plain year-number input as an alternative to a long dropdown.

10. **Committee Report's client-side print path is the only one in this module that clones DOM and
    inlines its own `<style>` block** (§3.2), instead of using the server-generated `printHtml` +
    `ReportPrintBar` pattern every other report screen in this document uses (Library's OPAC/Book
    Report, Task Manage Report's section-print). This isn't wrong, but it means print output for this
    one screen can drift from the server's canonical rendering (e.g. if `printReportHtml()`'s legacy
    CSS injection logic changes, this screen's inline styles won't pick it up automatically) — worth
    flagging for consistency even though it's not a broken feature today.

11. **Skeleton loading for the Committee Dashboard's category cards.** The dashboard's category cards
    (§3.1) presumably render blank/empty until `data.categories` resolves — a brief skeleton
    (placeholder card outlines) rather than a sudden pop-in would smooth the initial month-load
    experience, consistent with the "skeleton loading" pattern called out as a general option in this
    audit series' template.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Add confirm-before-delete to `RowSetupScreen` (gap 1/suggestion 1) — single component change,
  protects 8 screens, should be treated as the top-priority item in this file given the data-safety
  angle, not just a UX nice-to-have.
- Add a client-side text filter above Manage Members' member table (suggestion 2) — pure client-side
  filtering of already-loaded rows, no server change needed.
- Consolidate Committee Member's custom delete modal onto the shared `ConfirmModal` component
  (suggestion 3) — mechanical refactor, no behavior change.
- Swap Committee Add/Edit's Category checkbox grid for `CheckListSelect` (gap 2/suggestion 5) —
  component exists, data shape already matches (`form.categories` array of ids).
- Split Event Type's `"add_new"` sentinel option into a dedicated "+ Add new" button next to the
  select (gap 6/suggestion 8) — no shared-component work needed, just a small JSX restructure.
- Verify/harden TV Academic Event's hard-coded year range so it doesn't silently go stale
  (suggestion 9) — a one-line check against `currentYear + 1` logic.
- Add skeleton placeholders to the Committee Dashboard's category cards during month-load
  (suggestion 11) — purely presentational, no data/contract change.

**Bigger investments (needs design/product buy-in first):**
- Product decision + implementation for Committee Edit's hidden delete capability (suggestion 4) —
  needs sign-off on whether committee deletion should be exposed here at all, not just a UI add.
- `SearchableSelect` swap for Manage Members' per-row Staff/Designation selects (gap 4) — larger
  surface than a single control since it touches every row of a repeatable table, and needs UX
  review on how the search interacts with drag-reorder.
- `CheckListSelect` swap for TV Academic Event/Print's Department filter (gap 3) — small in isolation
  but should be bundled with a broader look at the TV/print screens' overall control consistency
  given how many bespoke pieces (`TvAcademicToolbar`, hard-coded year range) already live there.
- Undo affordance for Approve/Reject actions across the approval screens (suggestion 7) — needs
  product input on whether "undo" should be a client-side toast action or a proper server-side
  audit-trail reversal, especially given these are workflow-state transitions other users may act on
  immediately after approval.
- Follow-up pixel-level audit of Task Allocation v1/v2's internal pickers (gap 7) — this file's audit
  was bounded by what the user-stories source traced in detail; the ~200-line tabbed workspace
  deserves its own dedicated control-inventory pass before deciding what (if anything) to upgrade.
- Consolidate Committee Report's print path onto the shared server-`printHtml` + `ReportPrintBar`
  pattern (suggestion 10) — a real refactor (removing the hand-rolled DOM-clone + inline-`<style>`
  logic and building a server-side `printHtml` for this screen instead), not a quick swap, and should
  be scoped alongside any broader print-consistency pass across the app (see the cross-cutting
  Print & Reports audit file once it exists).

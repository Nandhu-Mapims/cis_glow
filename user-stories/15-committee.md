# 15 — Committee

## 1. Module overview

**Purpose.** The Committee module is the largest and most heterogeneous of the three modules in
this document — it covers (a) academic/college **committees** (membership rosters, designations,
categories, printable reports), and (b) a full **task-management sub-system** ("St Task" /
"T-" prefixed screens: clients, task types, work types, budgets, document uploads, timesheets,
approval workflows, and a TV/academic-calendar display) that shares the same setup-factory
infrastructure and route namespace as committees but is conceptually its own mini-module for
event/task planning, approvals, and budgeting.

**Actors.**
- Committee administrators — create/edit committees, manage membership rosters, designations,
  event types.
- Task/project coordinators — task allocation, budgets, documents, timesheets, clients.
- Approvers — Approve Event, Approve Event Report, Reschedule Approval screens.
- General staff/committee members — read the Committee Report (printable member roster) and TV
  Academic Event calendar.

**Legacy PHP files replaced** (from `client/src/pages/committee/committeeSetupMeta.js`):

| Legacy file | Modern screen |
|---|---|
| `committee_dashboard.php` (+ `committee_dashboard_more.php`) | Committee Dashboard |
| `event_committee_report.php` | Committees Information |
| `event_committee_add.php` | Committee Add |
| `event_committee_edit.php` | Committee Edit |
| `event_committee_member.php` | Manage Members |
| `event_committee_designation.php` | Designation |
| `committee_event_type.php` | Event Type |
| `task_category_setup.php` | Task Category |
| `t_client_add.php` / `t_client_edit.php` | Add/Edit Client |
| `task_colour_setup.php` | Colour Setup |
| `task_type_setup.php` | Report Type |
| `task_wtype_setup.php` | Work Type |
| `task_participator_setup.php` | Participator |
| `task_miscellaneous_setup.php` | Miscellaneous |
| `task_document_type.php` | Document Type |
| `task_time_sheet_setup.php` | Time Sheet |
| `task_budget_expenses.php` | Budget Expenses |
| `task_event_organization.php` | Partners/Sponsors |
| `st_task_dashboard.php` | Task Dashboard |
| `st_task_allocation_approved.php` / `_v2.php` | Manage Task (v1/v2) |
| `task_manage_report.php` | Task Report |
| `task_document.php` | Task Documents |
| `task_budget_approved.php` | Budget Approved |
| `approve_event.php` | Approve Event |
| `approve_event_report.php` | Approve Event Report |
| `approve_reschedule_event_v1.php` | Reschedule Approval |
| `tv_academic_event.php` | Academic Event Calendar |
| `tv_academic_print.php` | Academic Event Print |

Committee is the module that **does** use the shared factory. `client/src/pages/committee/CommitteeModule.jsx`
wires it up directly:

```js
export const useCommitteeSetupApi = createSetupApi('/api/committee');
export const CommitteeSetupPage = createModuleSetupPage({
  moduleTitle: 'Committee', hubPath: '/committee/setup',
  metaMap: COMMITTEE_SCREEN_META, components: COMPONENTS, useSetupApi: useCommitteeSetupApi,
});
export const CommitteeHub = createModuleHub({ title: 'Committee', basePath: '/committee', metaMap: COMMITTEE_SCREEN_META });
export const CommitteeSetupHub = createModuleSetupHub({ title: 'Committee', basePath: '/committee', metaMap: COMMITTEE_SCREEN_META, parentPath: '/committee' });
```

**Factory contract (traced once, applies to every screen below):**

- `createSetupApi(basePath)` (`client/src/hooks/createSetupApi.js`) returns a
  `useModuleSetupApi(screen)` hook exposing `{ data, busy, error, notice, setError, setNotice,
  load, save }`.
  - `load(fields = {}, query = {})` → `POST {basePath}/setup/{screen}/load` with body `{ fields,
    query }`. Responses are cached client-side via `cachedGet()` (`client/src/utils/idbCache.js`,
    `ttlMs: 60_000`) keyed on `` `${basePath}/setup/${screen}/load:${JSON.stringify(fields)}:${JSON.stringify(query)}` ``,
    so a cached response paints immediately (`onCache`) and is then replaced by a fresh network
    response (`onFresh`) once it lands. A `loadSeq` ref guards against out-of-order responses
    (only the latest in-flight `load()` call is allowed to update state).
  - `save(fields, files = [])` → `POST {basePath}/setup/{screen}/save` with body `{ fields,
    files }`. On success, `stripSaveMeta()` drops `message`/`success`/`error` from the response
    and merges the remainder into `data` (so a save can update the same screen state a load
    would); `invalidateCachePrefix()` clears cached loads for that screen so the next `load()`
    call re-fetches. Notices from `res.data.message` auto-display via `useTransientNotice`;
    `res.data.success === false` sets `error` instead.
- `createModuleSetupPage({...})` (`client/src/components/ModuleSetupFactory.jsx`) returns the
  page component actually routed to. On mount it resolves `meta = metaMap[screen]`, seeds the
  first `load()` call with `initialFields ?? meta.initialLoadFields ?? {}` (three committee
  screens set a non-empty `initialLoadFields` — `task-allocation`/`task-allocation-v2`:
  `{tab:'open'}`; `task-manage-report`: `{eventStatus:'1', taskStatus:'Open'}`), and also
  side-effects the URL's `?view=` query param to `cleanLegacyKey(meta.legacy)` for deep-linking
  parity with the legacy menu. It renders breadcrumbs `Home / Committee / Setup / {meta.title}`,
  a `SetupAlerts` bar for `notice`/`error`/`busy`, and passes `{ data, busy, readOnly: meta.readOnly,
  onLoad, onSave }` into the matched `ScreenComponent` from `COMPONENTS`.
- Server side: `server/src/routes/committee.js` mounts `POST /api/committee/setup/:screen/load|save`
  behind `authMiddleware` + `menuAuthForModule('committee')`, delegating to
  `server/src/services/committee/committeeSetup.js`'s `loadCommitteeScreen`/`saveCommitteeScreen`,
  which look up the screen in `VALID_SCREENS`/`LOADERS`/`SAVERS` maps (28 screens registered) and
  call the matching function in one of the 19 `server/src/services/committee/committee*.js`
  files.

## 2. Screen inventory

All screens are implemented as named exports of the single file
`client/src/pages/committee/setup/CommitteeScreens.jsx` (2,738 lines total).

| Route | Component (export) | Legacy `.php` |
|---|---|---|
| `/committee/setup/dashboard` | `CommitteeDashboardScreen` | `committee_dashboard.php` |
| `/committee/setup/committee-report` | `CommitteeReportScreen` | `event_committee_report.php` |
| `/committee/setup/committee-add` | `CommitteeAddScreen` | `event_committee_add.php` |
| `/committee/setup/committee-edit` | `CommitteeEditScreen` | `event_committee_edit.php` |
| `/committee/setup/committee-member` | `CommitteeMemberScreen` | `event_committee_member.php` |
| `/committee/setup/designation` | `DesignationScreen` (→ `RowSetupScreen`) | `event_committee_designation.php` |
| `/committee/setup/event-type` | `EventTypeScreen` | `committee_event_type.php` |
| `/committee/setup/task-category` | `TaskCategoryScreen` | `task_category_setup.php` |
| `/committee/setup/client-add` | `ClientFormScreen` (`isEdit=false`) | `t_client_add.php` |
| `/committee/setup/client-edit` | `ClientFormScreen` (`isEdit=true`) | `t_client_edit.php` |
| `/committee/setup/task-colour` | `ColourSetupScreen` | `task_colour_setup.php` |
| `/committee/setup/task-type` | `TaskTypeScreen` (→ `RowSetupScreen`) | `task_type_setup.php` |
| `/committee/setup/task-wtype` | `TaskWtypeScreen` (→ `RowSetupScreen`) | `task_wtype_setup.php` |
| `/committee/setup/task-participator` | `TaskParticipatorScreen` (→ `TaskWtypeScreen`) | `task_participator_setup.php` |
| `/committee/setup/task-misc` | `TaskMiscScreen` (→ `RowSetupScreen`) | `task_miscellaneous_setup.php` |
| `/committee/setup/task-doc-type` | `TaskDocTypeScreen` (→ `RowSetupScreen`) | `task_document_type.php` |
| `/committee/setup/task-time-sheet` | `TimesheetSetupScreen` | `task_time_sheet_setup.php` |
| `/committee/setup/task-budget-expenses` | `TaskBudgetExpensesScreen` (→ `TaskWtypeScreen`) | `task_budget_expenses.php` |
| `/committee/setup/task-event-org` | `TaskEventOrgScreen` (→ `TaskWtypeScreen`) | `task_event_organization.php` |
| `/committee/setup/task-dashboard` | `TaskDashboardScreen` | `st_task_dashboard.php` |
| `/committee/setup/task-allocation` | `TaskAllocationScreen` | `st_task_allocation_approved.php` |
| `/committee/setup/task-allocation-v2` | `TaskAllocationScreen` (same component) | `st_task_allocation_approved_v2.php` |
| `/committee/setup/task-manage-report` | `TaskManageReportScreen` | `task_manage_report.php` |
| `/committee/setup/task-document` | `TaskDocumentScreen` | `task_document.php` |
| `/committee/setup/task-budget-approved` | `TaskBudgetScreen` | `task_budget_approved.php` |
| `/committee/setup/approve-event` | `ApproveEventScreen` | `approve_event.php` |
| `/committee/setup/approve-event-report` | `ApproveEventReportScreen` | `approve_event_report.php` |
| `/committee/setup/approve-reschedule` | `ApproveRescheduleScreen` | `approve_reschedule_event_v1.php` |
| `/committee/setup/tv-academic-event` | `TvAcademicEventScreen` | `tv_academic_event.php` |
| `/committee/setup/tv-academic-print` | `TvAcademicPrintScreen` | `tv_academic_print.php` |

Server services (`server/src/services/committee/`): `committeeDashboard.js`, `committeeCrud.js`
(Add/Edit/Report for committees), `committeeMember.js`, `committeeMasterSetup.js` (Designation +
Event Type), `committeeRowSetup.js` (generic row-CRUD backing 7 of the `RowSetupScreen`-based
screens: task-type, task-wtype, task-participator, task-misc, task-doc-type,
task-budget-expenses, task-event-org — Designation is *not* in this list, it has its own loader
`loadCommitteeDesignation`/`saveCommitteeDesignation` in `committeeMasterSetup.js`),
`committeeCategory.js` (Task Category), `committeeClient.js` (Client Add/Edit),
`committeeProjectSetup.js` (Colour Setup + Timesheet), `committeeTasks.js` (Task Dashboard,
Allocation, Document, Budget Approved), `committeeTaskManageReport.js` +
`committeeTaskManageReportSections.js` + `committeeTaskManageReportPrint.js` (Task Report — the
largest single feature, 532+463+70 lines), `committeeTaskDocument.js`,
`committeeTaskBudgetApproved.js`, `committeeApproveReschedule.js`, `committeeEvents.js`
(Approve Event / Approve Event Report / Reschedule / TV Event / TV Print dispatch), `committeeTvAcademic.js`,
`committeeTvPrint.js`, and `committeeShared.js` (category/committee/designation/staff option
loaders, shared by nearly every other file).

## 3. Pixel-level flow per screen

### 3.1 Committee Dashboard (`dashboard`, `CommitteeDashboardScreen`)

- `Month` — `<input type="month">`, `onChange` calls `loadMonth(calendarMonth)` which resets
  drill-down state (`flag: null, categoryId: null, committees: []`) and reloads.
- One card per category (`data?.categories`, from `loadEventCategories()`), showing
  `{c.name}` header, a big count (`c.committeeCount`), and a `View committees` link-button
  (`disabled={busy || c.committeeCount === 0}`) → `viewCommittees(category)` →
  `onLoad({ calendarMonth: month, flag: 1, categoryId: category.id, categoryName: category.name })`.
  The active category card gets class `committee-dash-card-active`.
- When a category is drilled into: a card "{categoryName} committees" listing `#` / `Committee`
  rows from `data.committees`.
- "Month events" card (always visible): table `Date` / `Event` / `Task` (Yes/No from
  `e.hasTask`); empty state "No events for this month." Server: `loadCommitteeDashboard()` /
  `loadCommitteeDashboardDetails()` in `server/src/services/committee/committeeDashboard.js`,
  reading `tv_academic_event` filtered by `DATE_FORMAT(from_date, '%Y-%m') = calendarMonth`.
- Read-only — `onSave` is imported but never actually called in this component's JSX.

### 3.2 Committees Information / Committee Report (`committee-report`, `CommitteeReportScreen`)

- `Committee` select (`data?.committees`, `--Select--` default) — `onChange` both sets local
  state and calls `onLoad({ committeeId: id })` immediately (auto-loads on selection, no
  separate Go needed, though a `Go` button also exists for re-fetching, showing a spinner +
  "Loading…" while `busy`).
- `Print` button (`btn-info`, shown only once `committee && !busy`) — this is a **client-side**
  print: it clones `printRef.current.outerHTML` (the rendered report DOM), wraps it in an inline
  `<style>` block hard-coded in this component (grid/card CSS for the member photo grid), and
  calls `printReportHtml()` directly — unlike most other report screens which print
  server-generated `printHtml`.
- Report body (`#committee_details_span`): committee title (`h3`), category chips, logo image
  (`committee.logoUrl`), rich-text description (`dangerouslySetInnerHTML`), then a photo-grid of
  members (`committee-report-card` per member: photo with `onError` fallback from `.png` to
  `.JPG` extension via `photoUrlAlt`, staff ID + name, designation). Empty: "No current members
  found for this committee." Placeholder state before any committee is chosen: "Select a
  committee and click Go to view member information."
- **Server-side member filtering is date-scoped** (`loadCommitteeReport()` in
  `server/src/services/committee/committeeCrud.js`): `WHERE m.from_date <= DATE(NOW()) AND
  (m.to_date = '0000-00-00' OR m.to_date >= DATE(NOW()))` — i.e. a member whose `to_date` has
  passed silently disappears from this report, even though their row still exists (`del=1`) in
  `t_committee_member`. Save is a no-op: `saveCommitteeReport()` always returns `{ success:
  false, message: 'Report is read-only.' }`.

### 3.3 Committee Add (`committee-add`, `CommitteeAddScreen`)

- `Name` — text, required.
- `Activities` — `HtmlRichTextEditor` (`client/src/components/HtmlRichTextEditor.jsx`), required.
- `Logo` — `<input type="file">` (no `accept` restriction in the JSX itself).
- Category checkboxes — one per `data?.categories` entry, toggling membership in
  `form.categories` (array of string ids).
- `Save` submit (`btn-primary`) — logo file (if any) is base64-encoded via `fileToPayload()`
  (`FileReader.readAsDataURL`) into `{name, data}` and passed as the `files` array to
  `onSave(form, files)`.
- Server (`saveCommitteeAdd`, `committeeCrud.js`): rejects empty `title` with `{success: false,
  message: 'Name is required.'}`; uploads via `saveLegacyBinaryFile({folder: 'committee', maxBytes:
  2*1024*1024})` — **2 MB logo size cap**, enforced server-side (any upload error from that
  helper is surfaced verbatim as `message`); inserts into `t_committee` with `del: 1`.

### 3.4 Committee Edit (`committee-edit`, `CommitteeEditScreen`)

- Left column: a `list-group` of all committees (`data?.committees`), the active one highlighted
  (`active` class); clicking loads it (`onLoad({ committeeId: c.id })`).
- Right column: before any selection, "Select a committee from the list to edit." While a
  committee is loading (`busy && committeeId`), an overlay shows a spinner + "Loading
  committee…" text over the (stale) form.
- Form fields: `Name` (required), `Activities` (rich text, required), `Logo` file input, category
  checkboxes — same shape as Add, plus a `clearLogo()` helper (not obviously wired to a visible
  button in the excerpted JSX beyond `form.logo`/`logoUrl` reset) and a `Reset` capability via
  `handleReset()` that restores the form to `savedFormRef.current` (the last-loaded server
  state), discarding unsaved edits.
- Server delete branch exists (`saveCommitteeEdit` with `payload.action === 'delete'` →
  `UPDATE t_committee SET del=0…`) but **no delete button is visible in the excerpted
  `CommitteeEditScreen` JSX** for triggering it from this screen — same "server capability
  without a client control" pattern seen in Hostel's Student Hostel screen.

### 3.5 Manage Members (`committee-member`, `CommitteeMemberScreen`)

- `Committee` select (`--Select--` + `data?.committees`) — changing it loads that committee's
  member rows.
- Placeholder: "Select a committee to manage members." Loading overlay: "Loading members…"
  (same overlay pattern as Committee Edit).
- Table columns: drag handle (`DragHandle`/`useDragReorder` from
  `client/src/hooks/useDragReorder.js` — rows are reorderable by dragging, which rewrites the
  read-only `Order` column), `Order` (read-only, `title="Drag the row's handle to reorder"`),
  `Staff` (select from `data?.staffOptions`), `Designation` (select from `data?.designations`),
  `Meeting Owner` (checkbox), `From` (date, `max={toDate}`), `To` (date, `min={fromDate}`), and a
  delete button per row.
  - Deleting a **new, unsaved** row (`!row.id`) just removes it from local state.
  - Deleting a **persisted** row opens a confirm dialog (custom inline Bootstrap modal, not the
    shared `ConfirmModal` component — "Confirm" title, "Are you sure to delete this member?"
    body, `Close`/`Confirm` buttons) → `onSave({ action: 'delete', rowId: deleteId, committeeId })`.
- `Add row` button appends `{staffId:'', designation:'', fromDate:'', toDate:'', order:
  rows.length+1, owner:false}`.
- `Save` button (spinner + "Saving…" while busy) → `onSave({ committeeId, rows })`.
- `Reset` button restores `rows` to `savedRowsRef.current` (last-loaded state, or a single blank
  row if none existed).
- **Server-side** (`loadCommitteeMember`, `committeeMember.js`): if the committee has zero active
  members, the server itself substitutes one blank placeholder row
  (`rows = [{staffId:'', designation:'', fromDate:'', toDate:'', order:1, owner:false}]`) — the
  "zero members" state is never rendered as an empty table, it's always at least one editable
  blank row. The loader also back-fills `staffOptions` with any staff referenced by existing rows
  but missing from the normal active-staff dropdown (e.g. a staff member later marked inactive) so
  their name still resolves in the `<select>` instead of showing a blank.
- Save: `saveCommitteeMember()` skips any row missing `staffId` or a numeric `designation` (no
  error is raised for a partially-filled blank row — it's just silently dropped from the save).
  Delete sets `t_committee_member.del=0`.

### 3.6 Designation (`designation`, `DesignationScreen` → `RowSetupScreen`)

Generic reorderable-row-CRUD list (see `RowSetupScreen` below), columns: `Name`, `Short`
(`shortName`), `Order`.

### `RowSetupScreen` (shared component, backs 8 screens)

- Drag-reorderable table (`useDragReorder`) with an `Order` column shown as read-only **only
  when** the column set includes a `key === 'order'` field (`sortable` flag); otherwise plain
  editable text inputs for every configured column.
- Per-row delete: unsaved row → removed from local state; persisted row (`row.id`) → immediately
  calls `onSave({ action: 'delete', id: row.id })` with **no confirmation dialog at all** (unlike
  Committee Member / Block Setup / Room Edit which all confirm first) — this is the one CRUD
  pattern in this whole document that deletes on a single click.
- `Add row` button appends a blank row shaped from the configured `columns` keys.
- `Save` button submits `{ rows }` in bulk.
- Screens using this exact shape: **Designation** (`name`, `shortName`, `order`), **Task Type**
  (`title`, `format`, `order`), **Task Work Type** (`title`, `shortName`, `order`) — reused
  verbatim by **Task Participator**, **Task Budget Expenses**, and **Task Event
  Org/Partners-Sponsors**, **Task Miscellaneous** (`title` only, no order column → not
  drag-sortable), **Task Document Type** (`title`, `order`).

### 3.7 Event Type (`event-type`, `EventTypeScreen`)

Master-detail pattern distinct from `RowSetupScreen`: a top select (`data?.eventTypes` +
literal `Add new` option value `"add_new"`) drives `onLoad({ eventTypeId })`; once one is chosen
(including "add new"), a detail form appears (`Name` text field visible in the excerpt) with its
own `Save`.

### 3.8–3.30 (Task management / approval / TV screens)

Given the sheer count of remaining screens (Task Category, Client Add/Edit, Colour Setup,
Timesheet, Task Dashboard, Task Allocation (v1/v2), Task Report, Task Documents, Budget Approved,
Approve Event / Approve Event Report / Reschedule Approval, TV Academic Event / TV Academic
Print), each is its own bespoke component in `CommitteeScreens.jsx` (lines 926–2738) rather than
a shared pattern. Representative, code-verified highlights:

- **`TaskAllocationScreen`** (`task-allocation` / `task-allocation-v2`, both routed to the same
  component, differing only by their `initialLoadFields: { tab: 'open' }` from
  `committeeSetupMeta.js`) is one of the largest single screens (spans lines 1065–1269, ~200
  lines) — a tabbed task list/allocation workspace.
- **`TaskManageReportScreen`** (`task-manage-report`) is seeded with
  `initialLoadFields: { eventStatus: '1', taskStatus: 'Open' }` and is backed by three separate
  server files (`committeeTaskManageReport.js`, `committeeTaskManageReportSections.js`,
  `committeeTaskManageReportPrint.js`, 1,065 combined lines) — the single most complex report in
  this module, using `printTaskManageReportSection` from `client/src/utils/printReport.js`
  (imported at the top of `CommitteeScreens.jsx`) for section-by-section print output rather than
  one flat `printHtml` blob.
- **`ApproveEventScreen` / `ApproveEventReportScreen` / `ApproveRescheduleScreen`** implement the
  approval workflow for proposed committee/task events, including a reschedule-specific approval
  path (`committeeApproveReschedule.js`, 283 lines) distinct from a plain approve/reject.
- **`TvAcademicEventScreen`** and its shared `TvAcademicToolbar` sub-component (top of the file,
  lines 19–108) render a Month/Year picker (years hard-coded to range from `2017` through
  `currentYear + 1`, generated by `tvAcademicYears()`), an optional multi-select `Department`
  filter (`size={3}` list box), `Go`/`Print` buttons, a color legend (`Task Created` / `Task
  Approved` / `Task Rejected` (conditionally shown via `showRejectedLegend`) / `Task Completed`),
  and Prev/Next navigation links with dynamic labels (`prevLabel`/`nextLabel` passed in by the
  parent, implying month-to-month paging).
- **`ClientFormScreen`** is parameterized by an `isEdit` boolean prop so the same component
  backs both `client-add` (`isEdit={false}`) and `client-edit` (`isEdit={true}`).

## 4. Primary user stories

1. **As a committee administrator, I want to create a new committee with a name, rich-text
   activity description, an optional logo, and one or more categories** (`committee-add` §3.3),
   so it appears in the roster and category-driven dashboard counts.
   *Acceptance:* Name and Activities are HTML5-required; logo upload is capped at 2 MB
   server-side (`saveLegacyBinaryFile`); a missing title is rejected with "Name is required."

2. **As a committee administrator, I want to pick an existing committee from a list and edit its
   name, description, logo, and categories** (`committee-edit` §3.4), with a visible loading
   overlay while the next committee's data is fetched so I don't edit stale data.

3. **As a committee administrator, I want to add, reorder (drag), and remove members of a
   committee, assigning each a staff person, a designation, an optional "meeting owner" flag, and
   an active date range** (`committee-member` §3.5), so membership rosters stay current.
   *Acceptance:* removing a never-saved row is instant/local; removing a saved row requires
   confirming in a modal; the `Order` column always reflects drag position and cannot be typed
   directly.

4. **As any staff member, I want to select a committee and print/view a member roster with
   photos and designations** (`committee-report` §3.2), so I can see current membership without
   digging through raw data.
   *Acceptance:* only members whose `from_date`/`to_date` window currently covers today are
   shown — a member with a past `to_date` silently drops off this specific report even though
   their historical record remains in the database.

5. **As a committee administrator, I want to maintain reference lists** — Designations, Event
   Types, Task Category, Task Type, Work Type, Participator, Miscellaneous, Document Type, Colour
   Setup — **using a consistent add-row/reorder/delete grid** (`RowSetupScreen`, §3.6), so setup
   screens behave predictably across the whole task-management sub-system.

6. **As a task coordinator, I want to view a monthly committee dashboard** showing per-category
   committee counts and this month's calendar events, drilling into a category to see its
   committee list (`dashboard` §3.1), so I can see committee activity for the month at a glance.

7. **As an approver, I want to approve or reject proposed events/tasks and reschedule requests**
   (`approve-event`, `approve-event-report`, `approve-reschedule` §3.8) as part of the
   task-approval workflow.

8. **As task/administrative staff, I want a printable TV academic-event calendar with a
   month/year/department picker and a color-coded status legend** (`tv-academic-event`,
   `tv-academic-print` §3.8), for lobby/hallway display screens.

## 5. Rare / edge-case user stories

1. **Member removed mid-term (dated out but not deleted).** As a committee administrator, if I
   set a member's `To` date to yesterday instead of deleting their row outright, they should stop
   appearing on the printed roster while their historical membership record is preserved.
   *Evidence:* `loadCommitteeReport()`'s SQL filters `m.to_date != '0000-00-00' AND m.to_date >=
   DATE(NOW())` (i.e. excludes expired memberships) while `loadCommitteeMember()`'s edit-grid
   query has no such date filter — the same underlying `t_committee_member` row is fully
   editable in Manage Members but invisible in Committee Report the moment its `to_date` passes,
   which is intentional legacy parity, not a bug, but worth calling out because two screens over
   the same table disagree on "who's a current member."

2. **Committee with zero members.** As a committee administrator opening Manage Members for a
   brand-new committee, I want a ready-to-fill row instead of a blank table.
   *Evidence:* `loadCommitteeMember()` explicitly substitutes
   `rows = [{staffId:'', designation:'', fromDate:'', toDate:'', order:1, owner:false}]` when the
   SQL query returns zero rows for that `committeeId` — this happens server-side, not as a
   client-only UI convenience, so every consumer of this load endpoint sees the same behavior.

3. **Access revoked while user is viewing the screen.** As an admin who removes a user's
   `committee` module menu access while they have `Committee Dashboard` or `Manage Members` open
   in another tab, the next `load()`/`save()` call from that tab will 401/403 against
   `authMiddleware`/`menuAuthForModule('committee')` (`server/src/routes/committee.js` line
   `router.use(authMiddleware, menuAuthForModule('committee'))` runs on **every** request, not
   just the initial page load) — because the factory's `useModuleSetupApi` re-checks on every
   `load`/`save` call rather than caching an authorization decision client-side, the very next
   drag-reorder Save or Committee select would fail with the standard `setError(err.response?.data?.message
   || 'Save failed')` path, surfacing as a red `SetupAlerts` banner rather than a silent no-op.

4. **Deleting a committee that still has active members.** `saveCommitteeEdit()`'s delete branch
   (`server/src/services/committee/committeeCrud.js`) sets `t_committee.del=0` unconditionally —
   there is no query checking `t_committee_member` for rows still pointing at that
   `committee_id` first. A deleted committee's members remain in `t_committee_member` with
   `del=1`, referencing a now-inactive committee; any screen that resolves `committee_id` back to
   a title (e.g. the `Committee` dropdown filter on `committee-report`/`committee-member`, both
   sourced from `loadCommitteeOptions()` which almost certainly filters `del=1` on `t_committee`)
   would simply stop offering that committee as an option, effectively orphaning its member rows
   with no UI path back to them.

5. **Row-level delete on `RowSetupScreen` has no confirmation.** Unlike every other delete flow
   in this module (Committee Member uses a custom modal; Block Setup/Room Edit/Transport Edit in
   Hostel use the shared `ConfirmModal`), a persisted row deleted from any `RowSetupScreen`-based
   screen (Designation, Task Type, Work Type, Participator, Misc, Doc Type, Budget Expenses,
   Event Org) fires `onSave({ action: 'delete', id: row.id })` **immediately on click**, with no
   confirm step in the JSX (`RowSetupScreen`'s `deleteRow` function calls `onSave` directly). A
   misclick permanently (soft-)deletes a reference-data row used across the task sub-system.

6. **Staff removed from `staff_profile_tb` while still referenced by a committee.**
   `loadCommitteeMember()` explicitly handles this: it computes `known` (ids present in the
   normal active `staffOptions` list) versus the ids actually referenced by existing member rows,
   and re-queries `staff_profile_tb` directly (without the `del=1` filter implied by
   `loadStaffOptions()`) for any missing ids so the `<select>` can still render that staff
   member's name instead of a blank/unmatched option — evidence that this exact "member points at
   a since-inactivated staff record" scenario was anticipated and coded around.

7. **Logo upload rejected mid-edit.** If an admin picks a >2 MB logo file on Committee Edit,
   `saveLegacyBinaryFile()`'s size check fails and `saveCommitteeAdd`/`saveCommitteeEdit` return
   `{ success: false, message: <upload error> }` — because the factory's `save()` merges the
   response into `data` regardless of `success`, and `CommitteeEditScreen`'s form state is
   locally controlled (not reset from `data` unless a fresh `load()` runs), the user's typed
   Name/Activities edits are **not** lost when the logo alone fails — only the file needs
   re-selecting.

## 6. Future / predicted user stories

### Future (not implemented)

`mobile.md` does not name the Committee module in its v1 feature table (§6) at all — the closest
analog it lists is Circulars/Notices ("push-notification-worthy"). The following are speculative
extrapolations of the current desk-oriented committee/task pattern, explicitly not grounded in
any concrete mobile.md line item for this module:

1. *(Speculative)* As a committee member, I want to see which committees I currently belong to
   and my role/designation on each, from the mobile app — read-only, reusing
   `loadCommitteeMember`/`loadCommitteeReport`-style queries scoped to "my staff id" instead of a
   picked committee.
2. *(Speculative)* As an approver, I want to approve/reject pending events and reschedule
   requests (`approve-event`, `approve-reschedule`, §3.8) from a mobile push notification instead
   of having to be at a desktop — this pairs with the push-infrastructure gap flagged generally
   in `mobile.md` §8, which is explicitly **not yet built and requires sign-off**.
3. *(Speculative)* As a committee administrator, I want to attach meeting minutes or supporting
   documents to a committee (beyond the existing Task Documents feature, which is scoped to
   tasks, not committees themselves — `committeeTaskDocument.js` operates on `task`-linked
   records, not `t_committee` rows) — this would be new schema/service surface, not a UI-only
   change.
4. *(Speculative)* As staff viewing the TV Academic Event calendar, I want it accessible from a
   personal mobile view instead of only the lobby TV/kiosk display — the current `tv-academic-event`
   screen already has all the query/print plumbing (`committeeTvAcademic.js`,
   `committeeTvPrint.js`); a mobile read view would mostly be a client-side reuse of those
   existing endpoints.

## 7. Traceability

| Story | Client file (export in `CommitteeScreens.jsx`) | Server endpoint / service | Table(s) |
|---|---|---|---|
| Committee Dashboard | `CommitteeDashboardScreen` | `POST /api/committee/setup/dashboard/load` → `server/src/services/committee/committeeDashboard.js` | `t_committee`, `tv_academic_event` |
| Committee Add | `CommitteeAddScreen` | `.../committee-add/save` → `server/src/services/committee/committeeCrud.js` (`saveCommitteeAdd`) | `t_committee` |
| Committee Edit / Delete | `CommitteeEditScreen` | `.../committee-edit/save` → `committeeCrud.js` (`saveCommitteeEdit`) | `t_committee` |
| Committee Report | `CommitteeReportScreen` | `.../committee-report/load` → `committeeCrud.js` (`loadCommitteeReport`) | `t_committee`, `t_committee_member`, `staff_profile_tb`, `t_client_master` |
| Manage Members | `CommitteeMemberScreen` | `.../committee-member/save` → `server/src/services/committee/committeeMember.js` | `t_committee_member`, `staff_profile_tb` |
| Designation / row-CRUD screens | `DesignationScreen`, `TaskTypeScreen`, `TaskWtypeScreen`, `TaskParticipatorScreen`, `TaskMiscScreen`, `TaskDocTypeScreen`, `TaskBudgetExpensesScreen`, `TaskEventOrgScreen` | `.../{screen}/save` → `server/src/services/committee/committeeMasterSetup.js` (designation) or `committeeRowSetup.js` (the rest) | designation/type/participator/misc/doc-type/budget-expense/event-org master tables |
| Event Type | `EventTypeScreen` | `.../event-type/save` → `committeeMasterSetup.js` (`saveCommitteeEventType`) | event type master table |
| Task Category | `TaskCategoryScreen` | `.../task-category/save` → `server/src/services/committee/committeeCategory.js` | task category table |
| Client Add/Edit | `ClientFormScreen` | `.../client-add`, `.../client-edit` → `server/src/services/committee/committeeClient.js` | `t_client_master` |
| Colour Setup / Timesheet | `ColourSetupScreen`, `TimesheetSetupScreen` | `.../task-colour`, `.../task-time-sheet` → `server/src/services/committee/committeeProjectSetup.js` | colour/timesheet config tables |
| Task Dashboard / Allocation / Document / Budget Approved | `TaskDashboardScreen`, `TaskAllocationScreen`, `TaskDocumentScreen`, `TaskBudgetScreen` | `.../task-dashboard`, `.../task-allocation[-v2]`, `.../task-document`, `.../task-budget-approved` → `server/src/services/committee/committeeTasks.js`, `committeeTaskDocument.js`, `committeeTaskBudgetApproved.js` | task/allocation/document/budget tables |
| Task Report | `TaskManageReportScreen` | `.../task-manage-report/load` → `committeeTaskManageReport.js` + `committeeTaskManageReportSections.js` + `committeeTaskManageReportPrint.js` | task tables (multi-section report) |
| Approve Event / Report / Reschedule | `ApproveEventScreen`, `ApproveEventReportScreen`, `ApproveRescheduleScreen` | `.../approve-event`, `.../approve-event-report`, `.../approve-reschedule` → `server/src/services/committee/committeeEvents.js` + `committeeApproveReschedule.js` | event/approval tables |
| TV Academic Event / Print | `TvAcademicEventScreen`, `TvAcademicPrintScreen` | `.../tv-academic-event`, `.../tv-academic-print` → `server/src/services/committee/committeeTvAcademic.js`, `committeeTvPrint.js` | `tv_academic_event` |
| Audit / logging | all screens | `logModulePage()` / `auditFields()` in `server/src/services/shared/moduleAudit.js` | `log_tb` |

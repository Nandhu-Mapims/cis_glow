# 14 — Hostel

## 1. Module overview

**Purpose.** The Hostel module manages hostel/quarters blocks and rooms, room rental pricing,
student hostel allocation, staff quarters allocation, school transport (vehicles, stops, fee
config), hostel gate attendance windows, and hostel pass (leave) approval.

**Actors.**
- Hostel/warden office staff — Block/Room setup, Student Hostel allocation, Pass Approval.
- Transport office staff — Transport Add/Edit, Stopping Setup, Transport Fee Config.
- Admin/HR — Staff Rental (staff quarters allocation).
- Students/staff — never touch this module directly today; it is entirely back-office (no
  self-service allocation or pass-request screen exists in this module — see §6).

**Legacy PHP files replaced** (from `client/src/pages/hostel/hostelSetupMeta.js`):

| Legacy file | Modern screen |
|---|---|
| `dashboard_hostel.php` | Hostel Dashboard |
| `block_setup.php` | Block Setup |
| `room_setup_add.php` | Room Add |
| `room_setup_edit.php` | Room Edit |
| `room_rental_setup.php` | Rental Config |
| `transport_add.php` | Transport Add |
| `transport_edit.php` | Transport Edit |
| `transport_stopping_setup.php` | Stopping Setup |
| `transport_fee_config.php` | Transport Fee Config |
| `student_hostel.php` | Student Hostel |
| `hostel_att_setup.php` | Attendance Setup |
| `hostel_attendance_report.php` | Attendance Report |
| `hostel_pass_approval.php` | Pass Approval |
| `hostel_student_report.php` | Hostel Pass Report |
| `staff_rental_hostel.php` | Staff Rental |

Unlike Committee, Hostel does **not** use the generic `createSetupApi`/`ModuleSetupFactory`
either — it has its own hook, `client/src/pages/hostel/useHostelSetupApi.js`, and its own page
shell `client/src/pages/hostel/HostelSetupPage.jsx`, reading `HOSTEL_SCREEN_META`
(`client/src/pages/hostel/hostelSetupMeta.js`). Functionally it is very close to the shared
factory contract (`POST /api/hostel/setup/:screen/load|save` with `{fields, query}` /
`{fields, files}`), including a local `stripSaveMeta()` that mirrors `createSetupApi.js`'s
behavior of merging save-response data back into `data` while dropping `message`/`success`
keys, and a local `useTransientNotice()` hook that auto-clears notices after 4000ms — the same
pattern as the shared `useTransientNotice` used by `createSetupApi`. There is no client cache
(`cachedGet`) and no `loadSeq`/`saveSeq` race-guarding, unlike the true factory hook.

## 2. Screen inventory

| Route | Component | Legacy `.php` |
|---|---|---|
| `/hostel` | `client/src/pages/hostel/HostelHub.jsx` | (hub) |
| `/hostel/setup/dashboard` | `client/src/pages/hostel/setup/DashboardSetup.jsx` | `dashboard_hostel.php` |
| `/hostel/setup/block-setup` | `client/src/pages/hostel/setup/BlockSetupSetup.jsx` | `block_setup.php` |
| `/hostel/setup/room-setup-add` | `client/src/pages/hostel/setup/RoomSetupAddSetup.jsx` | `room_setup_add.php` |
| `/hostel/setup/room-setup-edit` | `client/src/pages/hostel/setup/RoomSetupEditSetup.jsx` | `room_setup_edit.php` |
| `/hostel/setup/room-rental-setup` | `client/src/pages/hostel/setup/RoomRentalSetupSetup.jsx` | `room_rental_setup.php` |
| `/hostel/setup/transport-add` | `client/src/pages/hostel/setup/TransportAddSetup.jsx` | `transport_add.php` |
| `/hostel/setup/transport-edit` | `client/src/pages/hostel/setup/TransportEditSetup.jsx` | `transport_edit.php` |
| `/hostel/setup/transport-stopping-setup` | `client/src/pages/hostel/setup/TransportStoppingSetup.jsx` | `transport_stopping_setup.php` |
| `/hostel/setup/transport-fee-config` | `client/src/pages/hostel/setup/TransportFeeConfigSetup.jsx` | `transport_fee_config.php` |
| `/hostel/setup/student-hostel` | `client/src/pages/hostel/setup/StudentHostelSetup.jsx` | `student_hostel.php` |
| `/hostel/setup/att-setup` | `client/src/pages/hostel/setup/AttSetupSetup.jsx` | `hostel_att_setup.php` |
| `/hostel/setup/attendance-report` | `client/src/pages/hostel/setup/AttendanceReportSetup.jsx` | `hostel_attendance_report.php` |
| `/hostel/setup/pass-approval` | `client/src/pages/hostel/setup/PassApprovalSetup.jsx` | `hostel_pass_approval.php` |
| `/hostel/setup/pass-report` | `client/src/pages/hostel/setup/PassReportSetup.jsx` | `hostel_student_report.php` |
| `/hostel/setup/staff-rental` | `client/src/pages/hostel/setup/StaffRentalSetup.jsx` | `staff_rental_hostel.php` |

Server dispatcher: `server/src/services/hostel/hostelSetup.js` (`VALID_SCREENS`,
`LOADERS`/`SAVERS`), mounted by `server/src/routes/hostel.js`
(`POST /api/hostel/setup/:screen/load|save`, both behind
`menuAuthForModule('hostel')`). Shared helpers (block/room option builders, student/staff
lookup) live in `server/src/services/hostel/hostelShared.js` and
`server/src/services/hostel/transportShared.js`; audit helpers in
`server/src/services/hostel/setupAudit.js`. Per-screen logic in
`server/src/services/hostel/setup/*.js` (14 files, one per screen except the shared
`BlockSelect` client component reused across Room Add/Edit/Rental/Staff Rental).

## 3. Pixel-level flow per screen

### 3.1 Hostel Dashboard (`dashboard`, `DashboardSetup.jsx`)

- `Date` — `<input type="date">`, `onChange` immediately calls `onLoad({ date })`.
- Stat cards: `Object.entries(data?.stats || {})` rendered as `<div className="card">` tiles,
  each showing the numeric value (`h4`) and the raw stat key as its label (small muted text) —
  i.e. whatever keys the server returns become the on-screen labels verbatim.
- "By Department" section (if `data?.departmentCounts?.length`): bordered tiles, `count` +
  `name`.
- "Recent" table (if `data?.recent?.length`): columns `Title`, `Date`, `Status`.
- Read-only; no save call anywhere in this component.

### 3.2 Block Setup (`block-setup`, `BlockSetupSetup.jsx`)

Editable grid, one row per block:

- Columns: `SNo.` (index), `Block Type` (two radios per row: `Hostel` / `Quarters`), `Block Id`
  (text), `Floor` (three radios: `G`=Ground, `1`=First, `2`=Second — label text is the
  abbreviation, radio group name is scoped per-row via `` `floor-${row.key}` ``), `Block Name`
  (text), and a trash-icon delete button (`<i className="icon-trash">`) shown **only** for
  persisted rows (`row.id` truthy).
- `+` button (`btn-info`) appends a blank row defaulting to `{ blockType: 'Hostel', floor:
  'Ground' }`.
- `Save` submits `{ action: 'update', rows: [{id, blockType, blockId, floor, blockName}, …] }`.
- Delete uses the shared `ConfirmModal` (`client/src/pages/fees/setup/ConfirmModal.jsx`),
  message "Are you sure to delete...", confirming calls `onSave({ action: 'delete', id:
  deleteId })`.
- Server delete (`server/src/services/hostel/setup/blockSetupSetup.js`): `UPDATE hostel_blocks_tb
  SET del = 0, …` — soft-delete, no check for rooms/students still referencing the block.

### 3.3 Room Add (`room-setup-add`, `RoomSetupAddSetup.jsx`)

- `Block *` — `<select>` built by the shared `BlockSelect` component (exported from this same
  file and reused by Room Edit / Rental / Staff Rental), grouped by `<optgroup label={group.type}>`
  from `data?.blockGroups` (each group is `{type, blocks: [{id, label}]}` — i.e. one optgroup per
  block type, "Hostel" vs "Quarters").
- `Room No *` — text, pre-filled from `data.nextRoomNo` on first load if the user hasn't typed
  anything yet (`prev.roomNo || data.nextRoomNo`).
- `Room Name` — text (optional).
- `Floor` — text (free text, not a select, unlike Block Setup's Floor radios).
- `Bed` — text input (**not numeric-typed, not validated** — see §5 room over-allocation).
- `Save` submit (`btn-danger`) → `onSave(form)`.

### 3.4 Room Edit (`room-setup-edit`, `RoomSetupEditSetup.jsx`)

List/edit toggle on `data.mode`.

- **List:** `Search room` text + `Search` button (`btn-info`); right-aligned summary "Showing
  page {page} of {totalPages} ({total} total)"; table columns `Room Id`, `Room Name`, `Room
  Type`, `Block`, `Floor`, actions (`Edit`/`Delete`); empty state `<td colSpan={6}>No data
  available</td>`; `Previous`/`Next` pager buttons (disabled at bounds).
- **Edit:** `Back` link button; `Block *` (`BlockSelect`, required); `Room Type *` — select
  (`data.roomTypes`, required) — **this field does not exist on Room Add**, i.e. room type is
  only assignable from the Edit screen, not at creation time; `Room No *` (text, required);
  `Room Name`; `Floor`; `Bed`; `Save` submit.
- Save payload includes `prevRoomNo: form.roomNo` captured at load time (used server-side to
  detect a room-number rename — see `server/src/services/hostel/setup/roomSetupEditSetup.js`
  line ~140 which matches on `bed_count = '...'` etc. by id, not by old room number, so
  `prevRoomNo` is informational/audit only in the code as read).
- Delete via `ConfirmModal`, same message pattern; server sets `hostel_rooms_tb.del = 0`.

### 3.5 Rental Config (`room-rental-setup`, `RoomRentalSetupSetup.jsx`)

- `Block *` (`BlockSelect`) — changing it triggers `onLoad({ blockId: value })`.
- Table (rendered only once a block is chosen): columns `#`, `Room No`, `Name` (+ floor in
  parens if present), `Amount` (editable text input per row, keyed by `row.roomPk`).
- `Update` submit (`btn-danger`) → `onSave({ blockId, rows })`.

### 3.6 Transport Add (`transport-add`, `TransportAddSetup.jsx`)

- `Vehicle Id *` text, `Vehicle No *` text, `Vehicle Type` — 3 radios (`Bus` / `Van` / `Auto`,
  default `Bus`), `Capacity *` number, `Photo` — `<input type="file" accept="image/png,image/jpeg,image/gif">`,
  `Trip *` — select `1`–`5` (default `'1'`), `Route` text, `Contact` text.
- `Stops *` — a grid of checkboxes, one per `data?.stops` entry, toggling membership in
  `form.stopIds` (array of string ids).
- `Save` submit → photo (if chosen) is converted via `FileReader.readAsDataURL` into
  `{ field: 'photo', name, data }` and passed as the `files` array argument to `onSave(form,
  files)` — this is the one Hostel screen (besides Transport Edit) that actually uses the
  `files` parameter of the save call.

### 3.7 Transport Edit (`transport-edit`, `TransportEditSetup.jsx`)

Same list/edit toggle pattern as Room Edit. List columns: `Vehicle Id`, `Reg No`, `Type`,
`Capacity`, `Route`, `Trip`, actions. Edit form mirrors Transport Add's fields plus: existing
photo preview (`form.imageUrl`, shown above the fields, `maxHeight: 120`), and passes
`existingImage: form.image` in the payload so the server can keep the old photo if no new file
is chosen. Delete via `ConfirmModal`; server: `UPDATE transport_tb SET del = 0, …`.

### 3.8 Stopping Setup (`transport-stopping-setup`, `TransportStoppingSetup.jsx`)

Editable grid (same shape as Block Setup): columns `SNo.`, `Order` (text), `Stopping Name`
(text), `KM` (text), delete button (persisted rows only). `+` appends a blank row; `Save` submits
`{ rows: [{id, order, name, km}] }`. Delete via `ConfirmModal`; server: `UPDATE
transport_stopping_tb SET del = 0, …`.

### 3.9 Transport Fee Config (`transport-fee-config`, `TransportFeeConfigSetup.jsx`)

Read the stopping list paginated (`data.pageSize` per page, default assumed 60 client-side),
table columns `SNo.`, `Route`, `Stopping Name`, `Amount` (editable text, right-aligned). Pager
shows "Page {page} of {totalPages} ({total} stops)" with `Previous`/`Next`. `Update` submit
(`btn-danger`) → `onSave({ page, rows })`.

### 3.10 Student Hostel (`student-hostel`, `StudentHostelSetup.jsx`)

- `Register no` text + `Load` button → `onLoad({ registerNo })`.
- On student found (`data?.student`): shows `{name} ({registerNo})`, then one row per stay
  (`data.stays`, defaults to a single blank stay `{stayYear: '1', hostelDiscontinue: false}` if
  none exist yet — see §3, server default): `Block` text, `Room` text, `fromMonth`/`toMonth`
  date range (each `max`/`min`-bounded by the other).
- `Save` submit → `onSave({ studentId: data.student.id, registerNo, stays, smsMobile:
  data.student.smsMobile })`.
- **No Add/Delete row buttons are rendered in this component** — despite the server supporting
  `action: 'delete'` (`saveStudentHostelSetup` in
  `server/src/services/hostel/setup/studentHostelSetup.js`), the client UI here has no button
  wired to it (unlike Staff Rental's near-identical stay-row pattern, which does have a delete
  button per row — see §3.15). This is a real client/server capability gap: deleting a student's
  hostel stay isn't reachable from this screen's JSX as written.
- **Server save has no bed/capacity check** (`server/src/services/hostel/setup/studentHostelSetup.js`):
  it blindly `UPDATE`s or `INSERT`s into `student_hostel_tb` per stay row — `blockNo`/`roomNo`
  are free-text values copied straight from the client, with no lookup against `hostel_rooms_tb.bed_count`
  and no check for how many other active students already occupy that room. See §5 for the
  over-allocation edge case this permits.

### 3.11 Attendance Setup (`att-setup`, `AttSetupSetup.jsx`)

Four `<input type="time">` fields with **raw object-key labels** (not friendly text — the code
literally does `<label className="form-label">{f}</label>` for `f` in `['outFrom', 'outTo',
'inFrom', 'inTo']`, so the rendered labels are the strings `outFrom`, `outTo`, `inFrom`, `inTo`).
Single `Save` button, disabled until `data` has loaded (`disabled={busy || !data}`, label reads
"Loading…" while waiting).

### 3.12 Attendance Report (`attendance-report`, `AttendanceReportSetup.jsx`)

`From`/`To` date + `Load` button → `onLoad({ fromDate, toDate, search: true })`. Table headers
are derived dynamically from `Object.keys(data.rows[0])` (falling back to `['ticketNo', 'date',
'time', 'inOut']` when there's no data yet) — i.e. **the column labels are whatever raw field
names the server returns**, not a fixed friendly header set.

### 3.13 Pass Approval (`pass-approval`, `PassApprovalSetup.jsx`)

Table columns: `Student` (`{studentName} ({registerNo})`), `Type` (`passType`), `From`, `To`,
`Action` (two buttons per row: `Approve` (`btn-success`, `onSave({ id: row.id, status: 1 })`) and
`Reject` (`btn-danger`, `onSave({ id: row.id, status: 2 })`)). No filter controls on this screen
at all — it always loads (`onLoad()` on mount) whatever the server considers pending.

### 3.14 Pass Report (`pass-report`, `PassReportSetup.jsx`)

`From`/`To` date + `Load` button; like Attendance Report, table columns are derived dynamically
from `Object.keys(data.rows[0])`. `run()` re-sends any previously-returned `status`/`source`
fields from `data` back to the server on each reload, letting the server-side loader control
additional implicit filtering that isn't exposed as its own UI control.

### 3.15 Staff Rental (`staff-rental`, `StaffRentalSetup.jsx`)

- Left column "Filter" card: `Search By` — 3 radios (`Name` / `Staff ID` / `Category`); if
  `Category` chosen, a select from `data?.categories` replaces the plain text input; `Go` button
  (`btn-info btn-sm`); below it, a list of staff buttons — highlighted `btn-success` if currently
  selected, `btn-outline-danger` if `staff.hasHostel` (already has a hostel/quarters allocation),
  else `btn-outline-secondary`.
- Right column: once a staff member is selected (`data?.staff`), shows name + Staff ID, then one
  card per stay row with: `Type` select (`Hostel`/`Quarters`), `Block` select (grouped
  `data.blockGroups`, resetting `roomNo` on change), `Room` select (filtered to the chosen
  block via `roomsForBlock()`, showing `{roomId} : {name}`), `Rental Fee` checkbox ("Yes"),
  `From`/`To` date range, `Discontinue` checkbox, `Reason` text (bound to
  `discontinueReason || joinReason`), and — **unlike Student Hostel** — a per-row `Delete row`
  button (only for persisted rows, `stay.id` truthy) that opens the shared `ConfirmModal`.
- `+` button appends a blank stay row (`{stayType: 'Hostel', rentalFee: false,
  hostelDiscontinue: false}`); `Save` submits `{ staffId, searchBy, searchInput, stays }`.
- Delete confirm calls `onSave({ action: 'delete', id: deleteId, staffId, searchBy,
  searchInput })`; server: `UPDATE staff_hostel_tb SET del = 0, …` (two call sites in
  `staffRentalSetup.js`).
- If no staff selected: "Select a staff member from the list."

## 4. Primary user stories

1. **As hostel office staff, I want to define hostel and quarters blocks with a type, ID, floor,
   and name** (`block-setup` §3.2), so that rooms can be organized under them.
   *Acceptance:* Block Type and Floor are radio-selected per row; only persisted rows (with an
   `id`) can be deleted; delete requires confirming in the shared modal.

2. **As hostel office staff, I want to add rooms to a block with a bed count** (`room-setup-add`
   §3.3), so students/staff can later be allocated there.
   *Acceptance:* Room No defaults to the server-suggested `nextRoomNo`; Block is required.

3. **As hostel office staff, I want to search, edit, and soft-delete existing rooms**
   (`room-setup-edit` §3.4), including assigning a Room Type that wasn't set at creation time.

4. **As hostel office staff, I want to set a rental amount per room within a block**
   (`room-rental-setup` §3.5), so fee/rent billing has a source amount per room.

5. **As transport office staff, I want to register vehicles with a photo, capacity, trip count,
   route, and the stops they serve** (`transport-add`/`transport-edit` §3.6–3.7).

6. **As transport office staff, I want to maintain the master list of bus stops and their
   distance**, and **configure a fee amount per stop** (`transport-stopping-setup` §3.8,
   `transport-fee-config` §3.9).

7. **As hostel office staff, I want to look up a student by register number and record their
   block/room and stay date range** (`student-hostel` §3.10), so their hostel occupancy is on
   file.
   *Acceptance:* saving persists one or more stay rows tied to `data.student.id`; if the student
   has no stay yet, a blank stay row is offered by default (`stayYear: '1'`).

8. **As HR/admin, I want to search for a staff member and allocate them a quarters/hostel room
   with a rental-fee flag and date range** (`staff-rental` §3.15), and see at a glance in the
   staff-picker list which staff already hold an allocation (`hasHostel` styling).

9. **As hostel office staff, I want to approve or reject pending student hostel pass requests
   with one click each** (`pass-approval` §3.13).
   *Acceptance:* `Approve` sends `status: 1`, `Reject` sends `status: 2` — the row disappears
   from the pending list once the reload after save excludes it (implied by the loader
   presumably filtering on pending status, since no explicit "pending" filter exists client-side).

## 5. Rare / edge-case user stories

1. **Room over-allocation (more students than beds) — not prevented by the system.** As a hostel
   warden, if I try to assign a 6th student to a room that has `bed_count = 5`, I would expect a
   warning or block. *Evidence:* `RoomSetupAddSetup.jsx`'s `Bed` field is a free-text `<input>`
   with no numeric validation, and `saveStudentHostelSetup()`
   (`server/src/services/hostel/setup/studentHostelSetup.js`) performs a raw `INSERT`/`UPDATE`
   into `student_hostel_tb` per stay row using the client-supplied `blockNo`/`roomNo` strings —
   there is no query anywhere in that file joining back to `hostel_rooms_tb.bed_count` or
   counting existing occupants of the target room before saving. Over-allocation is possible
   today and undetected by the application.

2. **Student allocated to two rooms simultaneously.** Because `Student Hostel`'s `stays` array
   is saved as independent rows with no overlap check between `fromMonth`/`toMonth` ranges
   (`saveStudentHostelSetup` loops the array and inserts/updates each row without comparing it
   against the student's other active stays), a data-entry mistake — adding a second stay row
   with an overlapping date range instead of editing the existing one — silently produces two
   concurrently-active hostel_stay records for the same student. The UI provides no cross-row
   validation to catch this before Save.

3. **Block/room deletion with active occupants.** Deleting a block (`Block Setup` §3.2 →
   `UPDATE hostel_blocks_tb SET del = 0`) or a room (`Room Edit` §3.4 →
   `UPDATE hostel_rooms_tb SET del = 0`) does not check `student_hostel_tb` or
   `staff_hostel_tb` for active (`del=1`, undischarged) stays referencing that block/room id
   first. As a hostel office user, deleting a block that still has occupied rooms under it (or a
   room that still has a current occupant) succeeds silently — the occupant's stay row is left
   pointing at a now-inactive block/room, and any screen that re-resolves block/room labels from
   the (now `del=0`) lookup would show blank labels for that occupant going forward.

4. **Student Hostel row deletion is unreachable from the UI.** As documented in §3.10, the server
   (`saveStudentHostelSetup`) supports `payload.action === 'delete'`, but
   `StudentHostelSetup.jsx` never renders a delete button for a stay row — only Staff Rental
   (§3.15) exposes that control. A hostel officer wanting to remove an erroneous student stay
   entry cannot do so from this screen today; the closest workaround is editing the existing row
   in place.

5. **Transport vehicle over capacity / stop reassigned mid-route.** No validation exists in
   `TransportAddSetup.jsx`/`TransportEditSetup.jsx` or their server counterparts tying
   `capacity` to the number of students later assigned to that vehicle's stops (no such
   assignment even appears to exist in this module — students are tied to stops via fee config,
   not vehicle capacity), so a vehicle field described as "Capacity" is informational display
   data only, not an enforced limit anywhere in this module's save logic.

6. **Staff Rental discontinue without clearing rental fee.** A staff row can have `Discontinue`
   checked while `Rental Fee` remains checked `Yes` — the JSX only wires the two checkboxes
   independently (`hostelDiscontinue` and `rentalFee` are unrelated state), so nothing stops a
   discontinued allocation from still being flagged as fee-liable on save.

## 6. Future / predicted user stories

### Future (not implemented)

Grounded in `mobile.md` — the plan explicitly scopes hostel-style "light write" screens (self
check-in/allocation, pass requests) as **later phases**, not v1, and calls out that "Admin/setup
screens... stay on the web app — they're desk/desktop workflows, not mobile ones" (§6). No
hostel-specific mobile screen is named in `mobile.md` at all today; the following are reasonable
extrapolations of the current desk-only pattern, not anything drafted in the plan.

1. *(Speculative)* As a student, I want to submit my own hostel pass (leave) request from the
   mobile app instead of a warden entering it, with the existing `pass-approval` screen (§3.13)
   becoming the approval inbox for those self-submitted requests — this would require a new
   student-facing submission endpoint that doesn't exist in `server/src/services/hostel/` today
   (only the approve/reject side is implemented).
2. *(Speculative)* As a hostel warden, I want the system to warn me at Save time when a room's
   `bed_count` would be exceeded by a new Student Hostel allocation, closing the gap in §5.1 —
   this is a natural server-side validation to add to `saveStudentHostelSetup`, not present
   today.
3. *(Speculative)* As a student, I want a self-service room-booking flow (pick an available room
   from a visual block/floor map) rather than a warden manually typing block/room text into my
   profile — today's `Block`/`Room` inputs on Student Hostel are free-text, not even a dropdown
   of actual rooms, so this would be a substantial rework, not a small addition.
4. *(Speculative)* As transport office staff, I want live bus-location tracking surfaced to
   students on mobile — no location/GPS integration exists anywhere in this module's schema or
   services today.

## 7. Traceability

| Story | Client file | Server endpoint / service | Table(s) |
|---|---|---|---|
| Block Setup | `client/src/pages/hostel/setup/BlockSetupSetup.jsx` | `POST /api/hostel/setup/block-setup/save` → `server/src/services/hostel/setup/blockSetupSetup.js` | `hostel_blocks_tb` |
| Room Add | `RoomSetupAddSetup.jsx` | `.../room-setup-add/save` → `server/src/services/hostel/setup/roomSetupAddSetup.js` | `hostel_rooms_tb` |
| Room Edit | `RoomSetupEditSetup.jsx` | `.../room-setup-edit/save` → `server/src/services/hostel/setup/roomSetupEditSetup.js` | `hostel_rooms_tb` |
| Rental Config | `RoomRentalSetupSetup.jsx` | `.../room-rental-setup/save` → `server/src/services/hostel/setup/roomRentalSetupSetup.js` | `hostel_rental_tb` |
| Transport Add/Edit | `TransportAddSetup.jsx` / `TransportEditSetup.jsx` | `.../transport-add`, `.../transport-edit` → `server/src/services/hostel/setup/transportAddSetup.js`, `transportEditSetup.js` | `transport_tb` |
| Stopping Setup | `TransportStoppingSetup.jsx` | `.../transport-stopping-setup/save` → `server/src/services/hostel/setup/transportStoppingSetup.js` | `transport_stopping_tb` |
| Transport Fee Config | `TransportFeeConfigSetup.jsx` | `.../transport-fee-config/save` → `server/src/services/hostel/setup/transportFeeConfigSetup.js` | stop/fee amount table |
| Student Hostel | `StudentHostelSetup.jsx` | `.../student-hostel/save` → `server/src/services/hostel/setup/studentHostelSetup.js` | `student_hostel_tb`, `student_profile_tb` (`sms_mobile`) |
| Attendance Setup | `AttSetupSetup.jsx` | `.../att-setup/save` → `server/src/services/hostel/setup/attSetupSetup.js` | hostel attendance window config table |
| Attendance Report | `AttendanceReportSetup.jsx` | `.../attendance-report` → `server/src/services/hostel/setup/attendanceReportSetup.js` | hostel gate attendance log |
| Pass Approval | `PassApprovalSetup.jsx` | `.../pass-approval/save` → `server/src/services/hostel/setup/passApprovalSetup.js` | hostel pass request table |
| Pass Report | `PassReportSetup.jsx` | `.../pass-report` → `server/src/services/hostel/setup/passReportSetup.js` | hostel pass request table |
| Staff Rental | `StaffRentalSetup.jsx` | `.../staff-rental/save` → `server/src/services/hostel/setup/staffRentalSetup.js` | `staff_hostel_tb` |
| Audit / logging | all screens | `auditFields()` / log helpers in `server/src/services/hostel/setupAudit.js` | `log_tb` |

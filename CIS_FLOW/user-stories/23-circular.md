# 23 — Circular

## 1. Module overview

The Circular module is the office-notice / memo workflow for the college: staff (usually an
admin-office or principal's-office user) drafts a circular, optionally routes it through an
approval step, and it becomes visible/printable to Student, Staff, or Department audiences.
It also tracks "Copy To" distribution lists (departments, boards, signatures) and a signature
sign-off chain.

**Primary actors**
- **Circular drafter** — creates (`Add Circular`) and maintains (`Edit Circular`) circulars.
- **Approver** — reviews pending circulars and approves/rejects them (`Approve Circular`).
- **Front-office / any staff** — reads the dashboard, runs the report, and prints approved
  circulars filtered by audience (student/staff/department).
- **Setup admin** — maintains the "Copy To Department", "Copy To Board", and "Signature"
  reference lists used by the Add/Edit forms (`Circular Setup`).

**Legacy PHP files replaced** (per `client/src/pages/circular/circularSetupMeta.js` and
`client/src/utils/legacyRoutes.js` lines 338–346):

| Legacy file | Modern screen |
|---|---|
| `circular_dashboard.php` | Circular Dashboard |
| `circular_setup.php` | Circular Setup |
| `circular_add.php` | Add Circular |
| `circular_edit.php` | Edit Circular |
| `circular_approve.php` | Approve Circular |
| `circular_report.php` | Circular Report |
| `circular_print_student.php` | Print — Student |
| `circular_print_staff.php` | Print — Staff |
| `circular_print_department.php` | Print — Department |

Server dispatcher: `server/src/services/circular/circularSetup.js` (`VALID_SCREENS` set lists
the same nine screens). Route: `server/src/routes/circular.js`, mounted at `/api/circular`
(`server/src/app.js` line 119), guarded by `authMiddleware` + `menuAuthForModule('circular')`.

Core table: **`circular_tb`** (`del=1` active per the repo-wide soft-delete rule). Reference
table: **`circular_setup`** (`c_type` in `'Copy To Department'`, `'Copy To Board'`,
`'Signature'`, ordered by `c_order`).

## 2. Screen inventory

| Route | Component file | Legacy `.php` |
|---|---|---|
| `/circular` | `client/src/pages/circular/CircularHub.jsx` | (hub, no direct legacy page) |
| `/circular/setup/dashboard` | `client/src/pages/circular/setup/DashboardSetup.jsx` | `circular_dashboard.php` |
| `/circular/setup/setup` | `client/src/pages/circular/setup/SetupSetup.jsx` | `circular_setup.php` |
| `/circular/setup/add` | `client/src/pages/circular/setup/AddSetup.jsx` | `circular_add.php` |
| `/circular/setup/edit` | `client/src/pages/circular/setup/EditSetup.jsx` | `circular_edit.php` |
| `/circular/setup/approve` | `client/src/pages/circular/setup/ApproveSetup.jsx` | `circular_approve.php` |
| `/circular/setup/report` | `client/src/pages/circular/setup/ReportSetup.jsx` | `circular_report.php` |
| `/circular/setup/print-student` | `client/src/pages/circular/setup/PrintStudentSetup.jsx` (re-exports `CircularPrintSetup.jsx`) | `circular_print_student.php` |
| `/circular/setup/print-staff` | `client/src/pages/circular/setup/PrintStaffSetup.jsx` (re-exports `CircularPrintSetup.jsx`) | `circular_print_staff.php` |
| `/circular/setup/print-department` | `client/src/pages/circular/setup/PrintDepartmentSetup.jsx` (re-exports `CircularPrintSetup.jsx`) | `circular_print_department.php` |

Routing: `client/src/routes/AppRoutes.jsx` lines 105–106, 278–279 (`/circular` →
`CircularHub`, `/circular/setup/:screen` → `CircularSetupPage`). The page shell
(`CircularSetupPage.jsx`) looks up `CIRCULAR_SCREEN_META[screen]`, renders
`SetupPageShell` with breadcrumbs `Home / Circular / <title>`, and dispatches to the matching
component from `SETUP_COMPONENTS`.

All nine screens share one hook, `useCircularSetupApi(screen)`
(`client/src/pages/circular/useCircularSetupApi.js`), which posts to
`POST /api/circular/setup/${screen}/load` and `POST /api/circular/setup/${screen}/save`.
Server-side, `loadCircularSetupScreen`/`saveCircularSetupScreen` in
`server/src/services/circular/circularSetup.js` route to per-screen loaders/savers under
`server/src/services/circular/setup/`.

## 3. Pixel-level flow per screen

### 3.1 Circular Dashboard (`DashboardSetup.jsx` / `dashboardSetup.js`)

On mount, `useEffect(() => { onLoad(); }, [onLoad])` calls load with no fields.

Fields (DOM order):
1. **Date** — `<label className="form-label">Date</label>`, `<input type="date">`, bound to
   `data?.date`. `onChange` immediately calls `onLoad({ date: e.target.value })` — no explicit
   "Go" button; changing the date re-triggers the load.

Stat cards: `Object.entries(stats).map(...)` renders one Bootstrap card per stat key
(`total`, `pending`, `approved`, `today` — the server's exact object keys from
`loadCircularDashboard`), each showing the numeric value large (`<div className="h4 mb-0">`)
and the raw key name as a small muted label underneath.

Conditional section "By Department" (`data?.departmentCounts?.length`): renders one bordered
box per dept with `<strong>{d.count}</strong>` and `<div className="small">{d.name}</div>`.
**Note:** the server's `loadCircularDashboard` (`server/src/services/circular/setup/dashboardSetup.js`)
does not currently return `departmentCounts` — this block is dead/future UI unless another
save path populates it.

Conditional "recent" table (`data?.recent?.length`): columns `Title | Date | Status`, one row
per item from `recent.map(...)`.

**Load returns:**
```js
{
  date,                 // resolved ISO date (fields.date or today)
  stats: { total, pending, approved, today },
  recent: [{ id, title, date, status, audienceFor }],  // fetchCircularList({ limit: 10 })
}
```
`total` = `countCircular('del = 1')`, `pending` = `del=1 AND c_status=0`, `approved` =
`del=1 AND c_status=1`, `today` = count where `DATE(c_date) = date`.
Audit log page: `circular_dashboard.php`, operation `View`.

No save action from the UI (`onSave` prop is unused); `saveCircularDashboard` exists server-side
purely as an alias that re-runs `loadCircularDashboard`.

### 3.2 Circular Setup (`SetupSetup.jsx` / `setupSetup.js`)

Loads on mount. Fields:
1. **Category** — `<label className="form-label">Category</label>`, `<select className="form-select">`
   populated from `data?.categories` (server returns the fixed array
   `['Copy To Department', 'Copy To Board', 'Signature']`). Changing it calls
   `onLoad({ category: e.target.value })`.
2. Table `Order | Name | Mobile | Attachment` — every cell is a plain text `<input>` (no
   validation, no type constraints) bound to `row.order` / `row.name` / `row.mobileNo` /
   `row.attach`.

Buttons: **`+`** (`btn btn-sm btn-info`) appends a blank row
`{ key: 'new-<timestamp>', order: rows.length+1, name: '', mobileNo: '', attach: '' }`.
**`Save`** (`btn btn-danger`, disabled while `busy`) submits `{ category, rows }`.

Save behavior (`saveCircularSetupSetup`): requires `category` non-empty
(`{ success: false, message: 'Category is required' }` otherwise). For `payload.action ===
'delete'`: soft-deletes one row (`del: 0`) and returns message `'Your details are deleted...'`.
Otherwise iterates `rows`; skips a row if `!name && !row.id`; existing rows (`row.id` truthy)
get `prisma.circular_setup.update` with `del: 1`; new rows get `prisma.circular_setup.create`.
Success message: `'Your details are Updated...'`. Reload is chained into the response so the
grid refreshes with fresh IDs.

Load empty state: if no rows exist for a category, the server seeds
`[{ order: 1, name: '', mobileNo: '', attach: '' }]` so the form always shows at least one row.

### 3.3 Add Circular (`AddSetup.jsx` / `addSetup.js`)

Loads once on mount (no filters). Fields, in DOM order:
1. **Title** — text input, `form.title`.
2. **Sub Title** — text input, `form.subTitle`.
3. **From Date** — `type="date"`, `max={form.toDate}`.
4. **To Date** — `type="date"`, `min={form.fromDate}`.
5. **Audience** — `<select className="form-select">` with hardcoded options **Staff**,
   **Student**, **Department** (not server-driven), defaulting to `Staff`.
6. **Description** — `<textarea rows={4}>`.
7. **Attachment** — `<input type="file">`, stored in local `file` state (single file only).

Button: **Submit** (`btn btn-danger`, disabled while `busy`).

`onSubmit` calls `onSave(form, file ? [file] : [])`. The hook's `save()`
(`useCircularSetupApi.js`) base64-encodes the file client-side into
`{ filename, dataBase64 }` before posting `{ fields, files }` to
`POST /api/circular/setup/add/save`.

Server (`saveCircularAddSetup`): requires `title` trimmed non-empty, else
`{ success: false, message: 'Title is required' }`. If a file was sent,
`saveCircularAttachment` (in `setupAudit.js`) validates extension against
`['.pdf', '.jpeg', '.jpg', '.gif', '.png']` — non-matching returns
`{ error: 'Please upload PNG, JPEG, GIF, or PDF formats.' }`; over 2 MB returns
`{ error: 'Image size must be less than 2 MB.' }`. Valid uploads are renamed
`${Date.now()}${Math.floor(Math.random()*10000)}${basename}` and written under
`<LEGACY_FILES_PATH>/circular/`.

`c_status` is computed as `signatures ? 0 : 1` — i.e. **if any signature reviewers are
selected the circular starts unapproved (`c_status=0`, pending)**; if none are selected it is
auto-approved (`c_status=1`). This is the implicit approval-routing rule baked into
`saveCircularAddSetup`.

Success: `{ success: true, message: 'Your details are added...' , ...freshLoadPayload }`.
The freshly reloaded `departments`/`boards`/`signatures` option lists come from
`circular_setup` rows where `c_type` is `'Copy To Department'` / `'Copy To Board'` /
`'Signature'` respectively, `del=1`, ordered by `c_order`. **Note:** the AddSetup.jsx UI does
not currently render `copyToDept`/`copyToBoard`/`signatures` pickers even though the load
payload includes those option lists and the save path accepts them — only Title, Sub Title,
dates, Audience, Description, and Attachment are wired up in the form today.

### 3.4 Edit Circular (`EditSetup.jsx` / `editSetup.js`)

Two-mode screen: search/list, then edit-in-place.

Search bar: text input placeholder **"Search title"**, button **Search**
(`btn btn-primary`) → `onLoad({ search })`.

List (shown when `data.list.length && !form.id`): `<ul className="list-group">`, one row per
circular with the title on the left and a small outline **Edit** button on the right that
calls `onLoad({ id: c.id })`.

Edit form (shown once `form.id` is set from `data.circular`):
1. **Title** — text input.
2. **Description** — `HtmlRichTextEditor` component (`client/src/components/HtmlRichTextEditor.jsx`),
   with a live "Document preview" card alongside showing
   `dangerouslySetInnerHTML={{ __html: form.description || '<p class="text-muted mb-0">Start typing to preview the circular.</p>' }}`.

Buttons: **Save** (`btn btn-danger`) submits `{ ...form, id: form.id }`. **Delete**
(`btn btn-outline-danger`) calls `onSave({ action: 'delete', id: form.id })` directly (no
confirm dialog in the JSX).

Load logic (`loadCircularEditSetup`): if `fields.id` given → `fetchCircularById(id)`
(single record, `mapCircularRow`); else if `fields.search` given →
`searchCircularByTitle` (`title LIKE '%term%'`, `del=1`); else → `fetchCircularList()`
(default `del=1 ORDER BY c_date DESC LIMIT 50`). Always also returns the same
`departments`/`boards`/`signatures` option lists as Add.

Save (`saveCircularEditSetup`): `action === 'delete'` → raw SQL
`UPDATE circular_tb SET del = 0, updated_dt = NOW(), updated_by=..., updated_ip=... WHERE id=?`,
message `'Your details are deleted...'`. Otherwise requires `parseId(payload.id)`, else
`{ success: false, message: 'Circular not found' }`. If a new file arrives it's re-validated
through `saveCircularAttachment` exactly as in Add; otherwise the existing `attach` filename
is preserved. Full raw `UPDATE` sets title/s_title/c_date/to_date/a_for/c_format/c_venue/
c_from/description/c_attach/to_dept/to_board/c_signature and audit columns. Success message:
`'Your details are saved...'`, and the response is re-loaded scoped to that `id` so the edit
form stays populated.

**Note:** although `EditSetup.jsx`'s form only exposes Title and Description (rich text), the
save payload spreads the whole `form` object (which was seeded from `data.circular` — i.e. all
`mapCircularRow` fields: subTitle, fromDate, toDate, audienceFor, format, venue, circularFrom,
copyToDept, copyToBoard, signatures) so those untouched fields round-trip unchanged even though
there's no UI to edit them on this screen.

### 3.5 Approve Circular (`ApproveSetup.jsx` / `approveSetup.js`)

Loads pending circulars on mount (`fetchCircularPending(100)` = `del=1 AND c_status=0`,
newest first, capped at 100). Table columns: **Title | Audience | Action**. Each row has two
buttons: **Approve** (`btn btn-sm btn-success`) → `onSave({ id: row.id, action: 'approve' })`;
**Reject** (`btn btn-sm btn-danger`) → `onSave({ id: row.id, action: 'reject' })`. Both
disabled while `busy`.

Save (`saveCircularApproveSetup`): requires `parseId(payload.id)`, else
`{ success: false, message: 'Circular is required' }`. Sets `c_status = 1` for approve or `2`
for reject, and stamps `c_approved = memberId` (the approving user's member id, not a display
name) via raw SQL. Success message is `'Circular approved.'` or `'Circular rejected.'`
respectively, and the pending list is reloaded so the acted-on row disappears.

There is no "Reset to pending" action anywhere in the UI — once rejected (`c_status=2`), a
circular no longer appears on this screen (it only lists `c_status=0`) and has no path back to
pending except a direct DB edit or re-adding a new circular.

### 3.6 Circular Report (`ReportSetup.jsx` / `reportSetup.js`)

Fields: **From** (`type="date"`, `max={toDate}`), **To** (`type="date"`, `min={fromDate}`),
button **Load** (`btn btn-primary`). On mount, `onLoad()` is called with no args, and the
resolved `fromDate`/`toDate` from the response seed the local date inputs (server defaults
both to "today" if not supplied).

Table: dynamically generated header from `Object.keys(data.rows[0])` (so column headers are
the *raw camelCase field names* — `id, title, subTitle, fromDate, toDate, audienceFor, status,
circularFrom` — not human-friendly labels) and one `<td>` per `Object.values(row)`. Falls back
to a single `id` header when there are no rows.

Server (`loadCircularReportSetup`): filters `del=1 AND DATE(c_date) BETWEEN fromDate AND
toDate`, optional `AND a_for = audience` and `AND c_status = status` if those fields are
present in `data` from a prior load (the client re-sends `data?.status`/`data?.source` if
present — but no UI control sets them, so in practice only the date range filters). Result
capped at 500 rows, `ORDER BY c_date DESC`.

### 3.7 Print — Student / Staff / Department (`CircularPrintSetup.jsx`, shared by all three)

Fields: **From** date, **To** date (same min/max cross-constraint pattern as Report), button
**Load** (`btn btn-primary`).

Empty state: `<p className="text-muted mb-0">No approved circulars in this date range.</p>`
when `rows.length === 0`.

Table columns: **ID | Title | Subtitle | Date | Description | Attach | From | (blank action
column)**. Description cell shows a stripped-tag, whitespace-collapsed, 160-char preview with
a trailing `…` if truncated. Attach cell renders **View** (`<a target="_blank">`) via
`legacyPublicFileUrl('circular', row.attach)` → `/legacy/files/circular/<filename>` when an
attachment exists, else `—`. Action column has a **View**/**Collapse** toggle button
(`btn btn-sm btn-outline-secondary`) that expands a preview card below the table.

Preview card (shown when a row is expanded): header **"Preview — {title}"** plus a **Print**
button (`btn btn-sm btn-outline-primary`) that calls
`printCircularPreview({ title, subTitle, description, date })`
(`client/src/utils/printReport.js`) — opens a new window styled with
`/legacy/css/circular.css` and calls `win.print()`. Body renders the circular description
HTML via `dangerouslySetInnerHTML`.

Server (`printSetup.js`'s `printLoader(page, audienceFor)` factory, shared by all three
screens): filters `del=1 AND c_status=1 AND a_for='<Student|Staff|Department>' AND
DATE(c_date) BETWEEN fromDate AND toDate`, capped at 200, `ORDER BY c_date DESC`. **Only
approved (`c_status=1`) circulars for the matching audience ever appear here** — pending or
rejected circulars are invisible on these print screens by construction.

## 4. Primary user stories

**US-1 — Draft a new circular.**
As a circular drafter, I want to fill in Title, Sub Title, From/To Date, Audience, Description,
and optionally attach a PDF/image on the **Add Circular** screen and click **Submit**, so that
a new record is created in `circular_tb` for staff/student/department visibility.
*Acceptance:* Title is required (`'Title is required'` if blank); attachment must be PDF/JPEG/
JPG/GIF/PNG under 2 MB; on success the form reloads with the message `'Your details are
added...'`.

**US-2 — Route a circular for approval by attaching signatures.**
As a drafter, I want a circular with at least one signature reviewer selected to start as
pending (`c_status=0`) rather than auto-approved, so that it goes through the Approve screen
before it can print.
*Acceptance:* `saveCircularAddSetup` sets `c_status = signatures ? 0 : 1` — verified by the
presence/absence of `payload.signatures`.

**US-3 — Approve or reject a pending circular.**
As an approver, I want to see all `c_status=0` circulars on the **Approve Circular** screen and
click **Approve** or **Reject** per row, so that only vetted circulars ever reach the print
screens.
*Acceptance:* Approve sets `c_status=1` and `c_approved=<memberId>`, message `'Circular
approved.'`; Reject sets `c_status=2`, message `'Circular rejected.'`; the row disappears from
the pending list either way (list is re-scoped to `c_status=0`).

**US-4 — Search, edit, or delete an existing circular.**
As a drafter, I want to search by title on **Edit Circular**, pick a result, change the Title
or rich-text Description, and Save (or Delete), so that mistakes can be corrected without
recreating the circular.
*Acceptance:* Search with no query lists the 50 most recent active circulars; Save re-issues
the raw `UPDATE` with the full field set; Delete performs `del=0` soft delete and message
`'Your details are deleted...'`.

**US-5 — Print approved circulars by audience.**
As office staff, I want to pick a date range on **Print — Student** (or Staff/Department) and
click **Load**, then **View** and **Print** an individual circular, so that I can hand a
physical notice to the intended audience in the exact legacy letter layout
(`/legacy/css/circular.css`).
*Acceptance:* only `c_status=1` circulars matching the audience and date range appear; Print
opens a new window with the circular's title/subtitle/date/description and calls `win.print()`.

**US-6 — Maintain "Copy To" / Signature reference lists.**
As a setup admin, I want to switch the **Category** dropdown between "Copy To Department",
"Copy To Board", and "Signature" on **Circular Setup**, edit Order/Name/Mobile/Attachment
inline, add rows with **+**, and **Save**, so that the Add/Edit forms' distribution pickers
stay current.
*Acceptance:* rows with a blank Name and no `id` are silently skipped on save; existing rows
are updated in place (`del:1`); message `'Your details are Updated...'`.

**US-7 — Check circular volume from the dashboard.**
As office staff, I want to see total/pending/approved/today counts and the 10 most recent
circulars on **Circular Dashboard**, and change the **Date** field to re-count "today" for a
different day, so that I get a quick operational snapshot.
*Acceptance:* changing the date input immediately reloads `stats.today` for that date without
a separate Go button.

## 5. Rare / edge-case user stories

**US-8 — Circular published then needing urgent retraction.**
As an approver who just clicked **Approve** on a circular that turns out to contain wrong
information, I want a way to pull it back before anyone prints it, so that the wrong notice
doesn't circulate.
*Reality check:* there is no "unapprove" or "retract" action anywhere in the code — Approve
Circular only lists `c_status=0` rows, so an approved circular (`c_status=1`) vanishes from
that screen. The only way to stop it is to open **Edit Circular**, search for it, and either
**Delete** it (soft `del=0`, which also removes it from Print/Report since those all filter
`del=1`) or edit the Description to a correction notice. There is no audit trail entry
differentiating "retracted" from "normal edit" beyond the generic `log_tb` row written by
`logCircularSetup(PAGE, 'Save', ...)`.
*Acceptance:* document that emergency retraction = Edit Circular → Delete, and that print
screens self-heal immediately since they always re-query `del=1 AND c_status=1` live (no
caching).

**US-9 — Circular targeting a department that no longer exists.**
As a drafter, I want copyToDept/copyToBoard IDs to remain meaningful even if a department is
later deactivated in `circular_setup` (`del=0`), so reports don't silently break.
*Reality check:* `copyToDept`/`copyToBoard` are stored as comma-joined **id strings**
(`to_dept`, `to_board` columns) with no foreign-key cleanup. If the underlying
`circular_setup` row is soft-deleted, `loadOptions()` (used by both Add and Edit) simply won't
return that id in the current `departments`/`boards` array, so a previously-saved circular
still has the stale id in `to_dept` but the Add/Edit form has no way to show its label (no
lookup join back from id to name is performed when rendering an existing circular — the
raw ids are exposed as `copyToDept: row.to_dept.split(',')` in `mapCircularRow`, an array of
bare id strings, not names). Print/Report screens don't render `to_dept`/`to_board` at all, so
this only surfaces if a future screen adds a "Copy To" display column.
*Acceptance:* note that this is a latent-not-crashing gap — no error is thrown, the id array is
just unresolved-to-name in the UI.

**US-10 — Empty date-range print/report.**
As office staff, I want a clear message when no approved circulars exist for a chosen range on
Print — Student/Staff/Department, so I don't think the screen is broken.
*Acceptance:* `CircularPrintSetup.jsx` renders `"No approved circulars in this date range."`
when `rows.length === 0`; `ReportSetup.jsx` has no equivalent empty-state text — it just
renders a table with the fallback single `id` header and zero body rows, which is a UX gap
worth flagging (unlike the print screens, the generic report has no "no data" message).

**US-11 — Oversized or wrong-format attachment.**
As a drafter attaching a scanned circular, I want a clear rejection message if I pick a `.docx`
or a 5 MB image, so I know to convert/compress it.
*Acceptance:* `saveCircularAttachment` returns `{ error: 'Please upload PNG, JPEG, GIF, or PDF
formats.' }` for disallowed extensions and `{ error: 'Image size must be less than 2 MB.' }`
for anything over `2 * 1024 * 1024` bytes; both are surfaced to the user via
`{ success: false, message: uploaded.error }` from `saveCircularAddSetup`/`saveCircularEditSetup`.

**US-12 — Concurrent edit race on Edit Circular.**
As two office staff editing the same circular at once, I want to understand what happens if
both Save, so I'm not surprised.
*Reality check:* there is no optimistic-lock/version column check in `saveCircularEditSetup` —
the raw `UPDATE ... WHERE id=?` always succeeds and simply last-write-wins; the second Save
silently overwrites the first with no conflict warning.

## 6. Future / predicted user stories

### Future (not implemented)

**US-13 (speculative).** As a student or staff member using the future mobile app, I want a
push notification the moment a circular addressed to my audience is approved, so I don't have
to check the portal manually. Grounded in `mobile.md` §6 ("Circulars/Notices | `/api/circular`
| Push-notification-worthy — see §8") and §8's explicit gap: *"there is no push infrastructure
today… This is new backend surface — flag and scope separately, get sign-off before
building."* Would require a new `server/src/services/push/` sender triggered from
`saveCircularApproveSetup`'s approve branch.

**US-14 (speculative).** As a mobile user, I want to view and Share/Save-as-PDF an approved
circular instead of relying on a desktop browser print dialog, reusing the same `printHtml`-
style payload the web `printCircularPreview` builds, rendered via `react-native-webview` +
`expo-print` (`mobile.md` §7.1: *"Backend already builds `printHtml`/`reportHtml` strings —
reuse as-is… No backend change required — same `printHtml` payload, new renderer."*).

**US-15 (speculative).** As a drafter, I want the Add Circular form to actually expose the
Copy To Department / Copy To Board / Signature multi-selects that the backend already accepts
(`payload.copyToDept`, `copyToBoard`, `signatures`) but `AddSetup.jsx` doesn't render, so the
approval-routing behavior (US-2) is fully usable from the UI rather than only reachable by a
direct API call.

**US-16 (speculative).** As an approver, I want an explicit "Retract" action (distinct from
Delete) that flips an approved circular back to pending or withdrawn with its own status code
and a dedicated `log_tb` "Retract" operation, addressing the gap identified in US-8, so
retraction is auditable and reversible rather than indistinguishable from a normal edit/delete.

## 7. Traceability table

| Story | Client file | Server file / endpoint | Table |
|---|---|---|---|
| US-1 Add circular | `client/src/pages/circular/setup/AddSetup.jsx` | `POST /api/circular/setup/add/save` → `server/src/services/circular/setup/addSetup.js` (`saveCircularAddSetup`) | `circular_tb` |
| US-2 Signature routing | `AddSetup.jsx` | `addSetup.js` `saveCircularAddSetup` (`c_status = signatures ? 0 : 1`) | `circular_tb.c_status` |
| US-3 Approve/Reject | `client/src/pages/circular/setup/ApproveSetup.jsx` | `POST /api/circular/setup/approve/save` → `server/src/services/circular/setup/approveSetup.js` | `circular_tb.c_status`, `c_approved` |
| US-4 Edit/Delete | `client/src/pages/circular/setup/EditSetup.jsx` | `POST /api/circular/setup/edit/load\|save` → `server/src/services/circular/setup/editSetup.js` | `circular_tb` |
| US-5 Print by audience | `client/src/pages/circular/setup/CircularPrintSetup.jsx` | `POST /api/circular/setup/print-student\|print-staff\|print-department/load` → `server/src/services/circular/setup/printSetup.js` | `circular_tb` |
| US-6 Setup reference lists | `client/src/pages/circular/setup/SetupSetup.jsx` | `POST /api/circular/setup/setup/load\|save` → `server/src/services/circular/setup/setupSetup.js` | `circular_setup` |
| US-7 Dashboard | `client/src/pages/circular/setup/DashboardSetup.jsx` | `POST /api/circular/setup/dashboard/load` → `server/src/services/circular/setup/dashboardSetup.js` | `circular_tb` |
| US-8 Retraction (manual via delete) | `EditSetup.jsx` Delete button | `editSetup.js` `saveCircularEditSetup` (`action:'delete'`) | `circular_tb.del` |
| US-9 Stale department ids | n/a (latent) | `server/src/services/circular/circularShared.js` `mapCircularRow` | `circular_tb.to_dept/to_board`, `circular_setup` |
| US-10 Empty range | `CircularPrintSetup.jsx`, `ReportSetup.jsx` | `printSetup.js`, `reportSetup.js` | `circular_tb` |
| US-11 Attachment validation | `AddSetup.jsx`, `EditSetup.jsx` | `server/src/services/circular/setupAudit.js` (`saveCircularAttachment`) | filesystem `<LEGACY_FILES_PATH>/circular/` |
| US-12 Concurrent edit | `EditSetup.jsx` | `editSetup.js` raw `UPDATE circular_tb` | `circular_tb` |
| US-13 Push notifications (future) | n/a | future `server/src/services/push/` | `circular_tb` |
| US-14 Mobile print/share (future) | future `mobile/src/screens/circular` | reuses `printSetup.js` output | `circular_tb` |
| US-15 Full Add form (future) | future `AddSetup.jsx` update | existing `addSetup.js` (already accepts fields) | `circular_tb` |
| US-16 Explicit retract status (future) | future `ApproveSetup.jsx`/`EditSetup.jsx` | future status branch in `approveSetup.js` | `circular_tb.c_status` |

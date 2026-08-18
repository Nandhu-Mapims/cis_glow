# 13 — Library

## 1. Module overview

**Purpose.** The Library module manages the college's book/resource catalog, supplier records,
issue/return transactions, inter-branch resource transfers, barcode label printing, an OPAC
(public catalog) search, and library gate attendance (students/staff swiping in/out of the
library, distinct from academic attendance).

**Actors.**
- Library staff / librarian (`accessType` gated by `menuAuthForModule('library')` — see
  `server/src/routes/library.js`) — runs almost every screen in this module.
- Front-desk/circulation staff — Book Issue / Book Return / Barcode / OPAC screens, used at a
  service counter with a barcode scanner acting as a keyboard (accession numbers/IDs are typed
  or scanned into plain text inputs, then submitted with Enter or a "Go" button).
- Admin/Global users — bypass `menuAuthForModule` checks entirely (`accessType === 'Global'`).

**Legacy PHP files replaced** (from `client/src/pages/library/librarySetupMeta.js`):

| Legacy file | Modern screen |
|---|---|
| `dashboard_library.php` | Library Dashboard |
| `library_book_cate.php` | Book Categories |
| `library_book_add.php` | Resources Add |
| `library_book_edit.php` | Resources Edit |
| `library_book_report.php` | Resources Report |
| `resources_report.php` | OPAC |
| `resources_barcode.php` | Barcode |
| `resource_transfer.php` | Transfer |
| `supplier_add.php` | Supplier Add |
| `supplier_edit.php` | Supplier Edit |
| `transaction_setup.php` | Limit Setup |
| `library_transaction1.php` (+ `transaction_more1.php`) | Book Issue |
| `library_transaction.php` (+ `transaction_more.php`) | Book Return |
| `transaction_report.php` | Transactions Report |
| `library_entry_report.php` | Daily Summary |
| `library_attendance.php` | Library Attendance |
| `library_att_entry.php` | Manual Attendance Entry |
| `lib_attendance_report.php` | Library Attendance Report |

Unlike hostel/committee, the Library module does **not** use the generic
`createSetupApi`/`ModuleSetupFactory` pattern. It has its own hand-rolled hook,
`client/src/pages/library/useLibrarySetupApi.js`, and its own page shell,
`client/src/pages/library/LibrarySetupPage.jsx`, which read `LIBRARY_SCREEN_META`
(`client/src/pages/library/librarySetupMeta.js`) instead of going through
`createModuleSetupPage`. The request/response contract is nearly identical to the shared
factory (`POST /api/library/setup/:screen/load` and `/save` with `{ fields, query }` /
`{ fields }` bodies), but there is no client-side caching (`cachedGet`/`idbCache`) and no
`loadSeq`/`saveSeq` race-guarding — every `load()`/`save()` call replaces `data` unconditionally
when it resolves.

## 2. Screen inventory

| Route | Component | Legacy `.php` |
|---|---|---|
| `/library` | `client/src/pages/library/LibraryHub.jsx` | (hub, no direct legacy file) |
| `/library/setup/dashboard` | `client/src/pages/library/setup/DashboardSetup.jsx` | `dashboard_library.php` |
| `/library/setup/book-category` | `client/src/pages/library/setup/BookCategorySetup.jsx` | `library_book_cate.php` |
| `/library/setup/book-add` | `client/src/pages/library/setup/BookAddSetup.jsx` | `library_book_add.php` |
| `/library/setup/book-edit` | `client/src/pages/library/setup/BookEditSetup.jsx` | `library_book_edit.php` |
| `/library/setup/book-report` | `client/src/pages/library/setup/BookReportSetup.jsx` | `library_book_report.php` |
| `/library/setup/resources-report` | `client/src/pages/library/setup/ResourcesReportSetup.jsx` | `resources_report.php` (OPAC) |
| `/library/setup/resources-barcode` | `client/src/pages/library/setup/ResourcesBarcodeSetup.jsx` | `resources_barcode.php` |
| `/library/setup/resource-transfer` | `client/src/pages/library/setup/ResourceTransferSetup.jsx` | `resource_transfer.php` |
| `/library/setup/supplier-add` | `client/src/pages/library/setup/SupplierAddSetup.jsx` | `supplier_add.php` |
| `/library/setup/supplier-edit` | `client/src/pages/library/setup/SupplierEditSetup.jsx` | `supplier_edit.php` |
| `/library/setup/transaction-setup` | `client/src/pages/library/setup/TransactionSetupSetup.jsx` | `transaction_setup.php` |
| `/library/setup/transaction-issue` | `client/src/pages/library/setup/TransactionIssueSetup.jsx` | `library_transaction1.php` |
| `/library/setup/transaction-return` | `client/src/pages/library/setup/TransactionReturnSetup.jsx` | `library_transaction.php` |
| `/library/setup/transaction-report` | `client/src/pages/library/setup/TransactionReportSetup.jsx` | `transaction_report.php` |
| `/library/setup/entry-report` | `client/src/pages/library/setup/EntryReportSetup.jsx` | `library_entry_report.php` |
| `/library/setup/attendance` | `client/src/pages/library/setup/AttendanceSetup.jsx` | `library_attendance.php` |
| `/library/setup/att-entry` | `client/src/pages/library/setup/AttEntrySetup.jsx` | `library_att_entry.php` |
| `/library/setup/att-report` | `client/src/pages/library/setup/AttReportSetup.jsx` | `lib_attendance_report.php` |
| (drill-down, no route — invoked from Dashboard) | `dashboard-report` screen, loaded via `api.post('/api/library/setup/dashboard-report/load', …)` inside `DashboardSetup.jsx`'s `useDrillDown()` | `dashboard_lib_report.php` |

Server dispatcher: `server/src/services/library/librarySetup.js` — `VALID_SCREENS` Set,
`LOADERS`/`SAVERS` maps keyed by the same screen slugs, invoked from
`server/src/routes/library.js` (`POST /api/library/setup/:screen/load|save`). Per-screen logic
lives in `server/src/services/library/setup/*.js`; shared cross-screen helpers (member lookup,
issue/return save, book search, category options) live in
`server/src/services/library/libraryShared.js`; audit/log helpers live in
`server/src/services/library/setupAudit.js` (`auditFields`, `logLibrarySetup`, `toIsoDate`,
`formatDateDisplay`, `todayIso`, `addDaysIso`).

## 3. Pixel-level flow per screen

### 3.1 Library Dashboard (`dashboard`, `DashboardSetup.jsx`)

- **Fields (DOM order):** `Date` — `<input type="date">`, value `data?.date`, `onChange` calls
  `onLoad({ date })` immediately (no separate "Go" button for the date).
- **Three summary cards**, each a `<table className="table table-bordered table-sm">`:
  - "Total Summary" — columns `Resources` / `Total`, rows from `data.totalSummary`.
  - "Issue/Return" — columns `Days` / `I` / `R` / `D`; each cell is a `<button className="btn btn-link btn-sm p-0">`
    showing the count, wired to `callTrans(row.label, 'I'|'R'|'D')`.
  - "Attendance" — columns `Class` / `In` / `Out`, plus a `Total` row; each number is a
    clickable link button wired to `callStudentAttendance`/`callStaffAttendance`/`callTotalAttendance`.
- **"Resources by Branch"** section (only if `data.branches.length`): a grid of bordered buttons,
  each showing `<strong className="d-block fs-5">{count}</strong>` and the branch name; click
  calls `callBooks(b.id)`.
- All drill-downs funnel into `useDrillDown()`, which POSTs to
  `/api/library/setup/dashboard-report/load` with `{ flag, cat/course/cyear, cdate, ctype }` and
  renders the result in a card below: title, filter chips (`f.label: f.value`), a data table
  (`drill.report.columns` / `drill.report.rows`), a `<ReportPrintBar html={drill.report.printHtml} />`,
  and a `Close` button (`drill.close`). Empty rows render `"No records"` (colSpan-ed placeholder
  row). Errors render `<div className="alert alert-danger">{drill.error}</div>`.
- **Save:** this screen never calls `onSave` — it is read-only/drill-down-only.

### 3.2 Book Categories (`book-category`, `BookCategorySetup.jsx`)

- **Field:** `Category` — `<select className="form-select">`, `onChange` both sets local state
  and re-calls `onLoad({ category })`. Options come from `data.categories` (`{value, label}`).
- **Table** columns: `Order` (text input, `row.order`), `Name` (text input, `row.name`), and a
  trash button (`<i className="fa fa-trash">`) per row, `disabled={!row.id || busy}` — i.e. only
  persisted rows can be deleted, unsaved new rows just get their trash disabled.
- **Buttons:** `+` (`btn-info`, appends a blank row `{key, order: rows.length+1, name: ''}`) and
  `Save` (`btn-danger`, submits the form).
- **Delete confirmation:** plain `window.confirm('Delete this entry?')` (not the `ConfirmModal`
  component used elsewhere in this module) before calling
  `onSave({ category, action: 'delete', id: row.id })`.
- **Save payload:** `{ category, rows }` (bulk) or `{ category, action: 'delete', id }`.
  Server: `server/src/services/library/setup/bookCategorySetup.js` — delete branch comment:
  `// Soft delete: del=1 is active, del=0 is deleted (see library_book_cate.php delete branch).`

### 3.3 Resources Add (`book-add`, `BookAddSetup.jsx`)

Uses shared `FormSection`/`FormSectionNav`/`FormActionBar`/`useScrollSpy` from
`client/src/components/FormShell.js` (a 4-section long form with a sticky side nav:
`resource-details`, `contributors`, `classification`, `inventory`).

- **Section "Resource details"** (`FormSection id="resource-details"`, description "Identify the
  item and its title information."):
  - `Resource` * — `<select>` from `data?.resourceTypes` (`SelectField`), first option `-- Select --`.
  - `Accession No.` * — text input, `maxLength={20}`, with a trailing
    `<button title="Check availability"><i className="fa fa-search"></i></button>` (`checkAvailability`)
    that also fires on blur. Calls `POST /api/library/setup/book-add/load` with
    `{ fields: { action: 'check-availability', accessionNo } }` and shows
    `<div className="form-text text-success">Available</div>` or
    `<div className="form-text text-danger">Not Available</div>` beneath the field.
  - `Title` * — text input, placeholder "Enter the resource title".
  - `Sub title` — text input, placeholder "Optional subtitle".
  - `Convert title` — text input, placeholder "Enter converted title".
  - `Title (converted)` — text input, placeholder "Enter translated title".
  - `E-book upload (.pdf)` — `<input type="file" accept=".pdf,application/pdf">`, **only rendered
    when** `isEbook` (`data.ebookCategoryId === form.resourceType`); shows the picked filename
    with a paperclip icon below.
  - `Keep as reference copy` — checkbox.
- **Section "Contributors & source"**: `Author` * text, `Publisher` text, `Supplier` select
  (`data?.suppliers`), `Source` select (`data?.sources`).
- **Section "Classification"**: `Subject` select (`data?.subjects`); `Branch` — `<select multiple>`
  over `data?.departments`, with hint text "Ctrl/Cmd-click to select multiple branches."; `Call No.`
  text; `Copy No.` text (default `'1'`); `ISBN No.` (label becomes `ISSN No.` when `isJournal` is
  true — detected via regex `/journal/i` against the selected resource type's name); `Month`
  (only shown when `isJournal`); `Edition` text; `Revised edition` checkbox; `Published year`
  number input; `Volume` text.
- **Section "Inventory & price"**: `Shelf No.`, `Rack No.`, `Page No.`, `No. of disks` (number),
  `Bill No.`, `Bill date` (date), `Price` (number), `Remarks`.
- **Footer** (`FormActionBar note="Fields marked with * are required."`): single button
  `<button type="submit">{busy ? 'Adding resource…' : 'Add resource'}</button>` with a plus icon.
- **Save:** the e-book file (if any) is read via `FileReader.readAsDataURL` into
  `{ name, data }` and sent as `ebookFile` inside the same fields object (no separate `files`
  array) — `onSave({ ...form, ebookFile })`. On `result.success`, the form resets to `emptyForm`
  and availability indicator clears.
- **Server:** `server/src/services/library/setup/bookAddSetup.js`. `resourceType==1` "magic
  number" from legacy is resolved via `resolveEbookCategoryId()`, which first tries to match a
  `book_category_tb` row whose name contains "E-book"/"E-Book" (case-insensitive), falling back
  to the first "Resource" category row — documented in the code as parity with a legacy
  hard-coded assumption.

### 3.4 Resources Edit (`book-edit`, `BookEditSetup.jsx`)

Two internal views, `ListView` and `EditView`, toggled by local `editRowId` state (no route
change).

- **`ListView` search form:** `Search` text input; `searchBy` select — options from
  `SEARCH_FIELDS` constant: `--All--` (`''`), `Title` (`resource_name`), `Accession No.`
  (`accession_no`), `Convert Title` (`convert_name`), `Call Number` (`call_number`), `Author`
  (`author_name`), `Publisher` (`publisher_name`); `resourceType` select (`--All Resource--` +
  `data?.resourceTypes`); `department` select (`--All Department--` + `data?.departments`);
  submit button (search icon, `btn-primary`).
- **Results table:** columns `Resource`, `Status`, `Accession`, `Title`, and an actions cell with
  an `Edit` (pencil icon, `openEdit(row.id, filters)`) and `Trash` (trash icon,
  `handleDelete(row.id)`) button. Empty state: `<td colSpan={5}>No data available</td>`.
  `handleDelete` uses `window.confirm('Delete this resource?')` then
  `onSave({ action: 'delete', id, filters })`.
- **Pagination:** rendered only if `data.totalPages > 1`, Bootstrap `pagination pagination-sm`
  with numbered page buttons.
- **`EditView`:** `« Back to list` button (`onBack`), then the same field set as Book Add
  (Resource, Accession No., Title, Sub title, Convert title, Title (converted), Author,
  Publisher, Supplier, Source, Subject, Branch multi-select, Call No., Copy No., ISBN/ISSN No.,
  Month (journal only), Edition, Published year, Volume, Shelf No., Rack No., Page No., No. of
  disks, Bill No., Bill date, Price, Remarks) **plus** three checkboxes not present on Add:
  `Revised edition`, `Reference copy`, `Damaged` (`isDamage`). E-book file input shown only when
  `isEbook`; if an e-book is already attached and no new file is chosen, shows
  `<a href="https://www.cis.apdch.edu.in/files/library_ebook/{ebookAttachment}">View current
  e-book</a>`. Submit button: `Save`.
- **"Add Book (copy accession numbers)" sub-form** below the main edit form: repeatable rows of
  `New Accession No` / `New Copy No` text inputs, `+` button to add a row, `Add Book` submit
  button (`btn-success`) — calls `onSave({ action: 'add-copies', copyBookId: form.id, copies })`
  with blank rows filtered out; resets the copy rows to one blank row on submit (does not exit
  edit mode, unlike the main Save which returns to the list via `save()` wrapper in the parent).
- Not-found state: `if (!form.id) return <p className="text-danger">Resource not found.</p>;`

### 3.5 Resources Report (`book-report`, `BookReportSetup.jsx`)

- Same search form shape as Book Edit's list (`Search`, `searchBy` from `data?.searchFields`,
  `resourceType`, `department`), plus a `Print` button
  (`disabled={!data?.printHtml}`, calls `printReportHtml(data.printHtml)`).
- **States:** `!data?.hasFilter` → "Please select search option"; `hasFilter && !rows.length` →
  "No records found"; else a 15-column table: `S.No.`, `Resource`, `Status`, `Accession No`,
  `No. Available`, `Title`, `Sub Title`, `Call No`, `Subject`, `Branch`, `Author`, `Publication`,
  `Year / Volume / Edition`, `Shelf / Rack No`, `E-book`. A row's Status cell is highlighted
  `#F6C3C3` when `r.highlight` is set, and appends `(Damaged)` when `r.isDamage`.

### 3.6 OPAC (`resources-report`, `ResourcesReportSetup.jsx`)

Same filter/table shape as Book Report but paginated (submits via `onSave` not `onLoad`, so it's
a search-and-list-only screen) and adds a 20th column set including `No. of Copies Available`,
`Total No. of Copies`, `Disk No`. Shows "Showing X to Y of Z entries" summary line above the
table. `!data?.hasFilter` → "Please select search option"; `hasFilter && !rows.length` → "No
records found...".

### 3.7 Barcode (`resources-barcode`, `ResourcesBarcodeSetup.jsx`)

- Filter row: `Accession list` search text, `resourceType` select (`All Resource`), `department`
  select (`--All Department--` + `Others` option), `From A.No` / `To A.No` number-range text
  inputs, `Search` submit (`btn-success`).
- `copiesPerLabel` radio group: `1 copies` / `2 copies` / `3 copies` / `4 copies`.
- Label grid `#final_result_span`: for each matched row, renders `copiesPerLabel` duplicate
  label cards showing accession no, call number, `Copy {copyNo}`, author name.
- `data?.hasFilter && !rows.length` → "No records found..."

### 3.8 Transfer (`resource-transfer`, `ResourceTransferSetup.jsx`)

Book-lookup-first, two-mode flow:

- `Book ID` text input + `Go` button → `onLoad({ accessionNo })`.
- `data.lookup.error` → red text.
- `data.lookup.book` found → card showing title + `{authorName} — {accessionNo}`.
- If `data.lookup.mode === 'transfer'`: `Transfer to` select (`data.destinations`, required),
  transfer date (required), `Transfer` submit (`btn-danger`) →
  `onSave({ action: 'transfer', accessionNo, transferTo, transferDate })`.
- If `data.lookup.mode === 'return'`: shows "Transferred to: {transferTo} on {transferDate}",
  a receive date input (required), `Return` submit →
  `onSave({ action: 'return', transferId: data.lookup.transfer.id, receiveDate })`.

### 3.9 Supplier Add (`supplier-add`, `SupplierAddSetup.jsx`)

Simple form: `Supplier Name *` (required), `Contact Person`, `Contact No`, `Address` — all text
inputs, mapped from an array literal `[[key, label, required], …]`. Single `Save` button
(`btn-danger`).

### 3.10 Supplier Edit (`supplier-edit`, `SupplierEditSetup.jsx`)

List/edit toggle keyed on `data.mode`. List: search text + `Search` (`btn-info`) button; table
columns `Supplier`, `Contact`, `Phone`, actions (`Edit`/`Delete`). Delete uses the shared
`ConfirmModal` component (`client/src/pages/fees/setup/ConfirmModal.jsx`) with message "Are you
sure to delete..." — note this is the **only** library screen using `ConfirmModal` instead of
`window.confirm`. Edit mode: `Back` link button, then raw field-name labels (`supplierName`,
`contactName`, `contactNo`, `address` — literally the camelCase key, not a friendly label — this
is a smaller/less-polished screen than Supplier Add), `Save` submit.

### 3.11 Limit Setup (`transaction-setup`, `TransactionSetupSetup.jsx`)

A 3-row table (`U.G Student`, `P.G Student`, `Staff`) with two editable columns each: `Book
Limit` and `Duration (Days)`, keyed to `ugLimit`/`ugDuration`, `pgLimit`/`pgDuration`,
`staffLimit`/`staffDuration`. Single `Save` submit. Backs
`getLibrarySetupLimits()`/`memberLimitDuration()` in `libraryShared.js`, which every Issue action
consults (see §3.13).

### 3.12 Book Issue (`transaction-issue`, `TransactionIssueSetup.jsx`)

Person-first flow (parity comment in the file cites `library_transaction1.php` +
`transaction_more1.php`):

1. `Student / Staff ID` text (auto-uppercased on change), `Go` button (disabled until non-empty)
   → `onLoad({ registerNo })`; also fires on Enter. `Clear` button resets all local state and
   calls `onLoad({})`.
2. `data?.error` → `**Oops!** {error}` in red.
3. On member found (`data?.member`): table showing `{name}`, `{designation}`, `Issued: {issuedCount} / {limit}`;
   if `data.issuedBooks?.length`, a second table "Issued Details" listing `{accessionNo} :
   {resourceName}` per row.
4. If `data.limitExceeded` → `**Oops!** Issue Limit Exceed....` (red) and the Accession field is
   hidden entirely. Otherwise: `Accession No` text + `Go` button → `onLoad({ registerNo, bookId })`.
5. On book resolved (`data?.book`): if `data.book.error`, shows it in red. Else a card with
   title, `{authorName} — {resourceType}` (+ `(Damaged)` suffix), and:
   - `data.book.mode === 'issue'`: optional warning `"This is Reference Copy. It should be
     returned today itself."` (when `referenceCopyWarning`), then `Check-out Date` (date,
     required) and `Due Date` (date, required), `Issue` submit (`btn-danger`) →
     `onSave({ action: 'issue', registerNo, bookId, checkOutDate, dueDate })`.
   - `data.book.mode === 'return'`: read-only Check-out/Due Date display, editable `Return Date`
     (required), `Damaged` checkbox, `Return` submit →
     `onSave({ action: 'return', transId: data.book.transId, returnDate, isDamage })`. (This
     branch is reached when the accession scanned is already checked out **to the same
     person**, i.e. the desk operator scans a book the visitor is returning, not issuing.)

### 3.13 Book Return (`transaction-return`, `TransactionReturnSetup.jsx`)

Book-first flow (mirror of Issue; parity comment cites `library_transaction.php` +
`transaction_more.php`):

1. `Accession No` text + `Go` → `onLoad({ bookId })`; `Clear` resets everything.
2. Book found → card with title/author/type/damage flag. Branches on `data.mode`:
   - `'return'`: table showing holder `{name}` / `{designation}` (`data.holder`), read-only
     Check-out/Due Date, editable `Return Date` (required), `Damaged` checkbox, `Return` submit
     → `onSave({ action: 'return', transId: data.transId, returnDate, isDamage })`.
   - `'need-member' | 'issue' | 'limit-exceeded'`: this book is **not currently on loan** — the
     desk is instead issuing it fresh. Shows `Student / Staff ID` + `Go` → `onLoad({ bookId,
     registerNo })`. `data.memberError` → red `**Oops!** {memberError}`. On member found: table
     of name/designation/`Issued: {issuedCount} / {limit}`. `mode === 'limit-exceeded'` → red
     `**Oops!** Issue Limit Exceed....` and no form. `mode === 'issue'`: Check-out Date / Due
     Date (both required) + `Issue` submit → `onSave({ action: 'issue', registerNo, bookId:
     data.accessionNo, checkOutDate, dueDate })`.

**Shared save handler for both 3.12 and 3.13:** `saveLibraryTransaction()` in
`server/src/services/library/libraryShared.js`. Key server-side rules (real code, not
paraphrased):
- Issue with missing `bookId`/`registerNo` → `{ success: false, message: 'Check Book ID and
  Student/Staff ID....' }` and logs `Issued`/`Unsuccessful` to `log_tb`.
- If the accession already has an open loan (`OPEN_CHECK_IN_SQL`: `check_in_date` is
  `'0000-00-00 00:00:00'`, `'1970-01-01 00:00:00'`, or `NULL`) →
  `{ success: false, message: 'Book ID Already Issued ....' }`.
- Issue-limit re-check (doc comment in the file explicitly calls out that this closes a legacy
  parity gap: the old Book Return screen's own "Issue" sub-path didn't always re-check the
  limit; this shared function enforces it for **every** Issue action regardless of which screen
  triggered it) — if `issued.count >= limit` → `{ success: false, message: 'Issue Limit
  Exceed....' }`.
- Successful issue inserts into `library_transaction_tb` with `check_in_date='0000-00-00
  00:00:00'`, `is_damage=0`, `del=1`, and returns `{ success: true, message: 'Issued...' }`.
- Return with missing id/date → `{ success: false, message: 'Check Book ID....' }`.
- Successful return sets `check_in_date`, `is_damage`; if `isDamage`, also flips
  `book_tb.is_damage = 1` for that accession. Returns `{ success: true, message: 'Returned...' }`.
- **No overdue-fine calculation exists anywhere in this code path** — `returnDate` is stored but
  never compared against `dueDate` to compute a charge (see §5, "no fine on late return").

### 3.14 Transactions Report (`transaction-report`, `TransactionReportSetup.jsx`)

Filters: `From`/`To` date, `issueReturn` select (`Issued & Return` / `Issued` / `Return` /
`Due`), `Register/Staff ID` text, `isDamaged` select (`Damage: All` / `Damaged` (`1`) / `Not
damaged` (`0`)); `Search` submit → `onSave({ ...form, search: true })`. Table columns: `Register`,
`Book`, `Checkout`, `Due`, `Return`, `Title`, `Author`, `Dmg` (`Yes` or blank).

### 3.15 Daily Summary (`entry-report`, `EntryReportSetup.jsx`)

`From`/`To` date + `Load` button (`onLoad({ fromDate, toDate, load: true })`). Summary line:
"Total issued: {issued} · Total returned: {returned} · Days: {rowCount}". Table columns: `S.No`,
`Date`, `Issued`, `Return`, `Due`, `U.G In`, `U.G Out`, `P.G In`, `P.G Out`, `Staff In`, `Staff
Out`. Empty: "No summary rows for the selected date range." while loading: "Loading…".

### 3.16 Library Attendance (`attendance`, `AttendanceSetup.jsx`)

Kiosk-style single-field screen: `Student/Staff ID *` — large input (`form-control-lg`),
`autoFocus`, `maxLength={10}`, fires `lookup()` on Enter **or** on blur. `lookup()` calls
`onSave({ staffId: id })` (note: this screen's every keystroke-driven lookup is actually a save
call, not a load — each swipe records an in/out event). Result panel (`<dl>`): `Name`,
`Designation`, `Time`, `In/Out`. Errors show as `{result.error}` or a generated
`` `Invalid ID: ${id}` `` fallback. `Clear` button resets. Right column shows a captured photo
(`result.photoUrl`) or one of two static messages depending on `data?.liveAttPhoto`: "Webcam
capture requires the kiosk device; this screen only replays the ID lookup + In/Out logic." (when
`liveAttPhoto === 1`) or "Live photo capture is disabled in Library settings (live_att_photo=0)."

### 3.17 Manual Attendance Entry (`att-entry`, `AttEntrySetup.jsx`)

`Date *` field drives a reload (`onLoad({ attDate: value })`) that replaces the row grid. Table
columns: `SNo.`, `Reg No. / Emp ID` (`maxLength={10}`), `In Time (24:00 Hrs)` (placeholder
`HH:MM`, `maxLength={5}`), `Out Time (24:00 Hrs)` (same). `+`/`-` buttons (`btn-info`) add/remove
rows (minimum 1 row always kept). `Save` submit (`btn-danger`) → `onSave({ attDate, rows })`.

### 3.18 Library Attendance Report (`att-report`, `AttReportSetup.jsx`)

`Category` — `<select multiple>` grouped by `optgroup` from `data.courseYearOptions`; `From`/`To`
date; `Show Empty` checkbox; `Go` button (`disabled={busy || !selectedKeys.length}`) →
`onSave({ fromDate, toDate, courseKeys, showEmpty, load: true })`. Renders a per-course grid with
one vertically-rotated (`writingMode: 'vertical-rl'`) column per day, plus `Total Days`,
`Punched Days`, `Time`, `Avg.` summary columns. `data?.generated && groups.length === 0` → "No
students found for the selected category/date range."

## 4. Primary user stories

1. **As a librarian, I want to add a new resource to the catalog** (`book-add` — §3.3), filling
   in Resource type, Accession No., Title, Author, and optional classification/inventory fields,
   so that the book becomes searchable via OPAC and issuable to members.
   *Acceptance:* required fields (`resourceType`, `accessionNo`, `resourceName`, `authorName`)
   enforced by HTML5 `required`; clicking the search icon or blurring Accession No. shows
   "Available"/"Not Available"; successful submit resets the form and shows a success notice
   from `res.data.message`.

2. **As front-desk staff, I want to issue a book to a student by scanning their ID then the book's
   accession number** (`transaction-issue` — §3.12), so that the loan is recorded with a due
   date and the person's issued-book count is enforced against their limit.
   *Acceptance:* if `issuedCount >= limit`, the Accession field never appears and "Issue Limit
   Exceed…." is shown; issuing succeeds only when both ID and Accession resolve and the book has
   no existing open loan.

3. **As front-desk staff, I want to return a book by scanning its accession number** (either
   `transaction-return` §3.13, book-first, or the return sub-path of `transaction-issue` §3.12,
   person-first), so that the item becomes available for the next issue and damage can be
   flagged in the same step.
   *Acceptance:* checking `Damaged` on return sets `book_tb.is_damage=1` for that accession
   (visible thereafter as `(Damaged)` in search/report screens).

4. **As a librarian, I want to search and filter the catalog by title/accession/author/publisher,
   resource type, and department** (`book-report` §3.5 / `resources-report` OPAC §3.6), so that
   I can quickly locate items and print a filtered list.
   *Acceptance:* no search executes until a filter is applied (`hasFilter` guard); Print button
   is disabled until `data.printHtml` exists.

5. **As a librarian, I want to print barcode labels for a range or list of accession numbers**
   (`resources-barcode` §3.7), choosing how many copies of each label to print, so that new
   stock can be physically labeled.
   *Acceptance:* selecting `N copies` renders exactly `N` duplicate label cards per matched
   resource.

6. **As a librarian, I want to transfer a resource to another branch and later record its
   return** (`resource-transfer` §3.8), so that inter-branch stock movement is tracked.
   *Acceptance:* the screen only shows a Transfer form when the looked-up book has no open
   transfer, and only shows a Return form when it does (`data.lookup.mode` drives which form
   renders).

7. **As a librarian, I want to configure per-category issue limits and loan durations**
   (`transaction-setup` §3.11) for U.G students, P.G students, and Staff, so that issue-time
   limit checks (see story 2) use the correct numbers.

8. **As library staff, I want a live gate-attendance kiosk that shows a member's name, photo, and
   In/Out status the instant their ID is scanned** (`attendance` §3.16), so that footfall is
   logged without a separate confirmation step.

## 5. Rare / edge-case user stories

1. **Book already issued to another member.** As front-desk staff, when I scan an accession
   number that's already checked out to someone else, I want the system to refuse a second issue
   with a clear message, so a book is never double-issued. *Evidence:* `saveLibraryTransaction()`
   checks `OPEN_CHECK_IN_SQL` before inserting and returns `{ success: false, message: 'Book ID
   Already Issued ....' }` — this check runs regardless of which screen (Issue or Return) the
   librarian is on, since both save through the same shared function.

2. **Overdue fine calculation — not implemented.** As a librarian returning a book weeks late, I
   would expect a fine to be calculated from `dueDate` vs. `returnDate`. *Evidence:*
   `saveLibraryTransaction()`'s return branch only writes `check_in_date` and `is_damage`; no
   fine/penalty table or amount field exists anywhere in `libraryShared.js` or
   `transactionIssueSetup.js`/`transactionReturnSetup.js`. The Transactions Report (§3.14) has an
   `issueReturn` filter value `Due` implying overdue tracking exists conceptually, but no monetary
   fine is computed or stored by any save path in this module today.

3. **Barcode scan mismatch (accession not found).** As front-desk staff, if I scan/type an
   accession number that doesn't exist or isn't active (`del != 1`), the Issue/Return/Transfer
   screens should tell me instead of silently doing nothing. *Evidence:*
   `findBookByAccession()` returns `null` on no match; `TransactionIssueSetup.jsx` and
   `TransactionReturnSetup.jsx` both render `data.book.error` in red when the server signals a
   miss (`**Oops!** {error}`), and `ResourceTransferSetup.jsx` renders `data.lookup.error`
   similarly.

4. **Lost-book write-off — not implemented.** As a librarian, I want to mark a book "Lost" and
   remove it from circulation/inventory counts without a return event. *Evidence:* the only
   status-changing flags found in `book_tb` handling are `is_damage` (Damaged) and the implicit
   `del` soft-delete via Book Edit's delete action; there is no "lost" status field, write-off
   workflow, or fine assessed for a lost item anywhere in `server/src/services/library/`. This
   remains a gap versus what a full ILS would need — currently the only recourse is to soft-delete
   the resource (`book-edit` list Delete, §3.4) which removes it from search but does not close
   out any open loan against it.

5. **Reference copy issued anyway.** As front-desk staff, if I try to issue a reference copy, the
   system still allows it but warns me it must come back the same day.
   *Evidence:* `TransactionIssueSetup.jsx` renders "This is Reference Copy. It should be returned
   today itself." when `data.book.referenceCopyWarning` is set, but nothing in
   `saveLibraryTransaction()` actually enforces a same-day due date or blocks the issue — it's an
   advisory message only.

6. **Concurrent double-issue race.** Two desk staff scanning the same accession number at nearly
   the same instant could both pass the "not currently issued" check before either INSERT lands
   (no row lock/unique constraint visible in the raw SQL in `saveLibraryTransaction()`), leading
   to two open `library_transaction_tb` rows for one physical book. This is a plausible failure
   mode given the code as written, not something explicitly guarded against.

7. **Supplier delete while books reference it.** `SupplierEditSetup.jsx`'s delete flow
   (`server/src/services/library/setup/supplierEditSetup.js`) soft-deletes the supplier row with
   no check for existing `book_tb.supplier_code` references — a book's supplier dropdown would
   then show a blank/unmatched value on next edit.

## 6. Future / predicted user stories

### Future (not implemented)

Grounded in `mobile.md` §6 ("Library | `/api/library` | Book search, my issued books, due dates;
barcode scan via `expo-camera`/`expo-barcode-scanner` reusing `/api/library` lookup endpoints.")
and §7.1 (print → share/export via `expo-print`).

1. *(Speculative)* As a student, I want to search the library catalog and see my currently
   issued books and due dates from the mobile app, reusing the existing `/api/library` OPAC and
   member-lookup endpoints read-only, so I don't need a desktop browser to check what I have out.
2. *(Speculative)* As a student, I want to scan a book's barcode with my phone camera
   (`expo-camera`/`expo-barcode-scanner`) to self-check a book's availability before walking to
   the shelf, reusing the same accession lookup the desk's Book Issue screen already performs.
3. *(Speculative)* As a librarian, I want overdue-fine amounts calculated automatically from
   `dueDate`/`returnDate` and shown at return time, and eventually payable through the fees
   module, closing the gap noted in §5.2 — this would require new schema/service work, not just
   a UI change.
4. *(Speculative)* As a librarian, I want a self-checkout kiosk mode (student scans their own ID
   + the book, no staff intervention) built on the existing `attendance`-style kiosk pattern
   (§3.16) combined with the Issue save path (§3.12), for high-traffic periods.
5. *(Speculative)* As a student on the mobile app, I want a push notification a day before a
   book's due date — this depends on the not-yet-built push infrastructure flagged as an open
   gap in `mobile.md` §8 ("no push infrastructure today... requires sign-off before building").

## 7. Traceability

| Story | Client file | Server endpoint / service | Table(s) |
|---|---|---|---|
| Add resource | `client/src/pages/library/setup/BookAddSetup.jsx` | `POST /api/library/setup/book-add/save` → `server/src/services/library/setup/bookAddSetup.js` | `book_tb`, `book_category_tb` |
| Edit/delete resource | `client/src/pages/library/setup/BookEditSetup.jsx` | `.../book-edit/save` → `server/src/services/library/setup/bookEditSetup.js` | `book_tb` |
| Book Issue | `client/src/pages/library/setup/TransactionIssueSetup.jsx` | `.../transaction-issue/save` → `saveLibraryTransaction()` in `server/src/services/library/libraryShared.js` | `library_transaction_tb`, `student_profile_tb`, `staff_profile_tb` |
| Book Return | `client/src/pages/library/setup/TransactionReturnSetup.jsx` | `.../transaction-return/save` → same `saveLibraryTransaction()` | `library_transaction_tb`, `book_tb` (`is_damage`) |
| Limit Setup | `client/src/pages/library/setup/TransactionSetupSetup.jsx` | `.../transaction-setup/save` → `server/src/services/library/setup/transactionSetupSetup.js` | `library_setup_tb` |
| Resources Report / OPAC | `BookReportSetup.jsx` / `ResourcesReportSetup.jsx` | `.../book-report`, `.../resources-report` | `book_tb` (via `searchBooks()` in `libraryShared.js`) |
| Barcode | `ResourcesBarcodeSetup.jsx` | `.../resources-barcode/save` → `server/src/services/library/setup/resourcesBarcodeSetup.js` | `book_tb` |
| Resource Transfer | `ResourceTransferSetup.jsx` | `.../resource-transfer/save` → `server/src/services/library/setup/resourceTransferSetup.js` | `book_transfer` |
| Supplier Add/Edit | `SupplierAddSetup.jsx` / `SupplierEditSetup.jsx` | `.../supplier-add`, `.../supplier-edit` | `book_supplier` |
| Library Attendance (kiosk) | `AttendanceSetup.jsx` | `.../attendance/save` → `server/src/services/library/setup/attendanceSetup.js` | library attendance table (device punch log) |
| Manual Attendance Entry | `AttEntrySetup.jsx` | `.../att-entry/save` → `server/src/services/library/setup/attEntrySetup.js` | same, manual rows, soft-deleted via `del=0` on removal |
| Attendance Report | `AttReportSetup.jsx` | `.../att-report` (load with `load:true`) | same |
| Dashboard drill-down | `DashboardSetup.jsx` (`useDrillDown`) | `POST /api/library/setup/dashboard-report/load` → `server/src/services/library/setup/dashboardSetup.js` (`loadLibraryDashboardReport`) | `library_transaction_tb`, attendance tables |
| Audit / logging | all screens | `logLibrarySetup()` / `auditFields()` in `server/src/services/library/setupAudit.js` | `log_tb` |

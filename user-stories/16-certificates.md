# 16 — Certificates

## 1. Module overview

**Purpose.** The Certificates module lets office/admin staff issue the documents students request
throughout their time at the college and after leaving it: bonafide/fee/custom certificates,
Transfer Certificates (TC), CRI/internship completion certificates, and two specialty AAADAR
programme certificates (Implant, Laser). It covers the full lifecycle: a student (or staff on
their behalf) files a request → office reviews and approves/rejects it → office generates and
prints the certificate → office tracks payment receipts for certificate fees.

**Primary actors.**
- **Front-office / admin staff** — create receipts, approve/reject requests, generate and print
  certificates, manage the category/subcategory catalog (`certificate_setup.php`).
- **Students** (indirectly, via `create_crequest.php`-style self-request flow, or staff filing on
  their behalf via `certificate_receipt_add.php`).
- **Academic/registrar staff** — TC (Transfer Certificate) issuance, marking students as
  completed/discontinued (`tc_details.php`), internship schedule entry.

**Legacy PHP files replaced** (from `client/src/pages/certificate/certificateSetupMeta.js`):

| Legacy file | Screen slug |
|---|---|
| `certificate_setup.php` | `setup` |
| `certificate_approve.php` | `approve` |
| `certificate_generate.php` | `generate` |
| `certificate_receipt_add.php` | `receipt-add` |
| `certificate_receipt_edit.php` | `receipt-edit` |
| `certificate_receipt_report.php` | `receipt-report` |
| `create_crequest.php` | `cert-request` |
| `tc_details.php` | `tc-details` |
| `tc_approve_add.php` | `tc-request-add` |
| `tc_approve_edit.php` | `tc-request-edit` |
| `tc_generate.php` | `tc-generate` |
| `student_internship.php` | `internship-schedule` |
| `internship_generate.php` | `internship-generate` |
| `student_internship_photo.php` | `internship-photo` |
| `aaadar_implant.php` | `implant-cert` |
| `aaadar_laser.php` | `laser-cert` |

## 2. Screen inventory

All screens are mounted through the generic setup factory (see §3.0). Base client route is
`/certificates/setup/:screen`; hub is `/certificates`.

| Screen (slug) | Route | Component | Server dispatch service | Legacy `.php` |
|---|---|---|---|---|
| `setup` | `/certificates/setup/setup` | `CertificateSetupScreen` (`client/src/pages/certificate/setup/CertificateScreens.jsx`) | `certificateCategorySetup.js` | `certificate_setup.php` |
| `approve` | `/certificates/setup/approve` | `ApproveScreen` (`client/src/pages/certificate/setup/ApproveScreen.jsx`) | `certificateApprove.js` | `certificate_approve.php` |
| `generate` | `/certificates/setup/generate` | `GenerateScreen` | `certificateGenerate.js` | `certificate_generate.php` |
| `receipt-add` | `/certificates/setup/receipt-add` | `ReceiptAddScreen` | `certificateReceipt.js` | `certificate_receipt_add.php` |
| `receipt-edit` | `/certificates/setup/receipt-edit` | `ReceiptEditScreen` | `certificateReceipt.js` | `certificate_receipt_edit.php` |
| `receipt-report` | `/certificates/setup/receipt-report` | `ReceiptReportScreen` | `certificateReceipt.js` | `certificate_receipt_report.php` |
| `cert-request` | `/certificates/setup/cert-request` | `CertRequestScreen` | `certificateRequest.js` | `create_crequest.php` |
| `tc-details` | `/certificates/setup/tc-details` | `TcDetailsScreen` | `certificateTc.js` | `tc_details.php` |
| `tc-request-add` | `/certificates/setup/tc-request-add` | `TcRequestAddScreen` | `certificateTc.js` | `tc_approve_add.php` |
| `tc-request-edit` | `/certificates/setup/tc-request-edit` | `TcRequestEditScreen` | `certificateTc.js` | `tc_approve_edit.php` |
| `tc-generate` | `/certificates/setup/tc-generate` | `TcGenerateScreen` | `certificateTc.js` | `tc_generate.php` |
| `internship-schedule` | `/certificates/setup/internship-schedule` | `InternshipScheduleScreen` | `certificateInternship.js` | `student_internship.php` |
| `internship-generate` | `/certificates/setup/internship-generate` | `InternshipGenerateScreen` | `certificateInternship.js` + `internshipGenerateCore.js` | `internship_generate.php` |
| `internship-photo` | `/certificates/setup/internship-photo` | `InternshipPhotoScreen` | `certificateInternship.js` | `student_internship_photo.php` |
| `implant-cert` | `/certificates/setup/implant-cert` | `ImplantCertScreen` (wraps `AaadarCertificateScreen`) | `certificateAaadar.js` + `aaadarCertificateCore.js` | `aaadar_implant.php` |
| `laser-cert` | `/certificates/setup/laser-cert` | `LaserCertScreen` (wraps `AaadarCertificateScreen`) | `certificateAaadar.js` + `aaadarCertificateCore.js` | `aaadar_laser.php` |

Server routes: `server/src/routes/certificate.js` mounts `POST /api/certificates/setup/:screen/load`
and `POST /api/certificates/setup/:screen/save`, both gated by `authMiddleware` +
`menuAuthForModule('certificates')`. Both dispatch through
`server/src/services/certificate/certificateSetup.js` → `loadCertificateScreen` /
`saveCertificateScreen`, which validate `screen` against a `VALID_SCREENS` set (unknown screen →
`{ error: 'Unknown certificate screen' }`, HTTP 400 message `"Unknown certificate screen"`).

## 3. Pixel-level flow per screen

### 3.0 Shared factory contract (read once)

`createSetupApi(basePath)` (`client/src/hooks/createSetupApi.js`) returns a hook
`useModuleSetupApi(screen)` exposing `{ data, busy, error, notice, setError, setNotice, load, save }`.

- `load(fields = {}, query = {})` → `POST ${basePath}/setup/${screen}/load` with body
  `{ fields, query }`. Response cached client-side via `cachedGet` (60s TTL, IndexedDB) keyed on
  `${basePath}/setup/${screen}/load:${JSON(fields)}:${JSON(query)}`. If `res.data.error` is set,
  it throws and `error` state becomes that message (fallback `'Unable to load screen'`).
- `save(fields, files = [])` → `POST ${basePath}/setup/${screen}/save` with body
  `{ fields, files }`. On `res.data.error` → sets `error`. On `res.data.success === false` → sets
  `error` to `res.data.message || 'Save failed'`. Otherwise sets `notice` to `res.data.message`
  (if present) and merges the response (minus `message`/`success`/`error`) into `data`.
  Invalidates the load cache prefix for this screen.

`createModuleSetupPage({ moduleTitle, hubPath, metaMap, components, useSetupApi })`
(`client/src/components/ModuleSetupFactory.jsx`) wraps each screen component in
`SetupPageShell` with breadcrumbs `Home → {moduleTitle} → Setup → {meta.title}`, sets the
`?view=<cleanLegacyKey(meta.legacy)>` query param for deep-link parity, shows `SetupAlerts`
(notice/error/busy banner), auto-calls `load(meta.initialLoadFields || {})` on mount (shown as
page-level `loading` spinner via `SetupPageShell`'s `loading` prop), and passes
`{ data, busy, readOnly: meta.readOnly, onLoad, onSave }` to the mapped `ScreenComponent`.
`useCertificateSetupApi = createSetupApi('/api/certificates')` is the concrete hook for this
module (`client/src/pages/certificate/CertificateModule.jsx`).

`CERTIFICATE_SCREEN_META` (`certificateSetupMeta.js`) supplies `initialLoadFields` for two
screens: `approve` → `{ status: '0' }` (defaults the Approve screen to Pending on first load),
`tc-request-edit` → `{ fromDate: <today ISO>, toDate: '' }`.

### 3.1 `setup` — Certificate Setup (`certificate_setup.php`)

Component: `CertificateSetupScreen`. Local state `form = { categoryId, categoryName,
categoryOrder: 0, subcategories: [] }`.

Fields (DOM order):
1. **Label "Category"** — `<select className="form-select">`, `value={form.categoryId}`.
   `onChange` calls `onLoad({ categoryId: e.target.value })` (re-fetches, does not just set local
   state). Options: static `<option value="add_new">Add new category</option>` first, then
   `data.categories` (`{id, name}` from `cer_category_tb`, `del=1`, ordered by `c_order, name`).
2. **Label "Category name"** — `<input className="form-control">`, `value={form.categoryName}`,
   plain local `setForm`.
3. **Label "Order"** — `<input type="number" className="form-control">`, `value={form.categoryOrder}`.
4. **Subcategory table** — columns `Name | Order | Template | Details | (delete)`. Each row is
   editable via `setSub(i, patch)`. "Template" is a `<select>` populated from `data.templates`
   (server hard-codes `['bonafide', 'fee', 'others', 'photocopy', 'custom']`), first option is
   an em-dash `—`.
5. **Row delete button** — text `Del`, class `btn btn-sm btn-outline-danger`. If the row has an
   `id` (persisted `cer_subcategory_tb` row), calls
   `onSave({ action: 'delete', id: s.id, categoryId: form.categoryId })` (soft-delete, `del=0`).
   If the row is new (no `id`), just removes it from local `form.subcategories` array — no API
   call.
6. **"Add row" button** — `btn btn-sm btn-outline-secondary`, appends
   `{ name: '', order: 0, format: '', details: '' }` to `form.subcategories`.
7. **"Save" button** — `btn btn-primary`, `onClick={() => onSave(form)}`.

Server load (`loadCertificateSetup` in `certificateCategorySetup.js`): resolves categoryId
(defaults to first category id if none given, or `'add_new'` clears the form entirely).
Returns `{ success: true, categories, templates, form }`. Logs `certificate_setup.php` / `View`.

Server save (`saveCertificateSetup`): two branches —
- `payload.action === 'delete'` → `UPDATE cer_subcategory_tb SET del=0 ...` then re-runs load,
  message `"Subcategory deleted."`.
- Otherwise: requires `categoryName` truthy, else `{ success: false, message: 'Category name required.' }`.
  If `categoryId` is falsy/`'add_new'`, `INSERT INTO cer_category_tb (... del=1)` and reads back
  `LAST_INSERT_ID()`; else `UPDATE cer_category_tb` and soft-deletes (`del=0`) existing
  subcategories under that category before re-inserting/updating the submitted rows (so removed
  rows in the UI are actually deleted server-side, not just skipped). Each subcategory with a
  blank trimmed `name` is skipped silently. Message on success: `"Certificate setup saved."`.

### 3.2 `approve` — Approve & Print (`certificate_approve.php`)

Component: `ApproveScreen.jsx` (a standalone component, not from `CertificateScreens.jsx`).
Local state: `filters = { status: '0', fromDate: '', toDate: '', search: '', page: 1 }`,
`draft` (the record being approved/rejected), `modalOpen`.

Filter card fields:
1. **"Search By"** — `<input>` placeholder `Roll No`, bound to `filters.search`.
2. **"From Date"** — `<input type="date">`, `max={filters.toDate || undefined}`.
3. **"To Date"** — `<input type="date">`, `min={filters.fromDate || undefined}`.
4. **"Status"** radio group (3 `<input type="radio" name="approve_status">`): `Pending` (`'0'`),
   `Approved` (`'1'`), `Rejected` (`'2'`).
5. **"Search" button** — `btn btn-info text-white`, calls `runSearch()` → resets `page` to 1,
   closes any open modal, calls `onLoad(payload)`.
6. Result count line: `Showing {from} to {to} of {total} entries` or `Showing 0 to 0 of 0 entries`.
7. **Results table** — columns `R.ID | Student | Date | Request For | Status | (action)`. Empty
   state row: `<td colSpan={6} className="text-danger">No data found...</td>`. Each row has an
   **"Approve / Reject"** button (`btn btn-sm btn-danger`) → `openApprove(r)` which sets the
   draft, opens the modal, and re-`onLoad`s with `receiptId: r.id` to fetch the full detail row
   (subject attempts/passing fields not present in the list query).
8. **Pagination** — `Previous` / `Next` buttons (`btn btn-sm btn-outline-secondary`), shown only
   if `pagination.total > pagination.pageSize` (server page size = 20).
9. **Report card** (right column) — static table: `Total`, `Approve`, `Pending`, `Rejected` counts
   from `data.summary` (server aggregates `GROUP BY status` over the whole table, unfiltered).

Approve/Reject modal (Bootstrap-style, manually rendered `div.modal.d-block`):
- Title `"Approve"`, close `×` via `btn-close`.
- Read-only rows: Request ID (`CR{applicationNo}` or `receiptLabel`), Student, Register No,
  Request For.
- **Status radios** inside modal (separate `name="draft_status"` group): `Pending` (0),
  `Approved & Print` (1), `Rejected` (2).
- **Comments** — `<textarea rows={2}>`.
- **Year of completion** — `<input>`.
- **Exam month / year** — two side-by-side `<input>`s, placeholders `Month` / `Year`.
- **Conduct** — `<input>`.
- Footer buttons: **"Close"** (`btn btn-secondary`) and **"Confirm"** (`btn btn-danger`, calls
  `submitDraft(draft.status)` → `onSave({ ...draft, status, filters })` then closes modal).

Server load (`loadCertificateApprove`): builds `WHERE R.del=1` plus status/date-range/search
filters (`buildApproveWhere`); search matches exact `register_no` OR `LIKE %term%` on the
subcategory name. Paginates at 20/page, orders `R.created_dt DESC`. Also computes the unfiltered
summary and, if `fields.receiptId` given, the full detail row (including all 19
`SUBJECT_FIELDS` attempts/passing pairs used for CRI exam certificates). Logs
`certificate_approve.php` / `View`.

Server save (`saveCertificateApprove`): requires `payload.id`, else
`{ success: false, message: 'Receipt id required.' }`. Updates `status`, `comments`,
`year_of_completion`, `exam_month`, `exam_year`, `conduct_char`, all subject attempts/passing
fields present in the payload, plus `generated_date = CURDATE()` and audit fields. Message
depends on submitted status: `2` → `"Certificate request rejected."`, `0` →
`"Certificate request set to pending."`, else → `"Certificate approved."`. Re-runs the list +
summary query using `payload.filters` and returns `selectedReceipt: null` (closes the modal
implicitly by clearing the selection on the client next render).

### 3.3 `generate` — Certificate Generate (`certificate_generate.php`)

Component: `GenerateScreen`. Single field: **"Receipt / register numbers"** `<textarea rows={3}>`
free text, plus **"Search" button** (`btn btn-primary`) → `onLoad({ searchInput })`.
Results render as cards: `Receipt {applicationNo} — {studentName}`, `{degreeName} /
{departmentName}`, and `{applyFor}: {applyReason}`.

Server (`loadCertificateGenerate`): splits `searchInput` on whitespace/commas; numeric tokens
match `R.application_no IN (...)`, non-numeric tokens (uppercased) match
`CERTIFICATE_REGISTER_NO_EXPR IN (...)` (a `COALESCE` across `certificate_receipt_tb.register_no`
and the joined student's `register_no`, handling both linked-by-id and linked-by-register-no
receipts). No filters at all → `receipts: []`. Logs `certificate_generate.php` / `View`. `save`
is identical to `load` (`saveCertificateGenerate` just re-runs the query, no mutation — this
screen never persists anything).

### 3.4 `receipt-add` — Receipt Add (`certificate_receipt_add.php`)

Component: `ReceiptAddScreen`. Fields:
1. **"Register No"** — required `<input>`.
2. **"Apply for"** — `<select>`, options from `data.applyTypes` (server default
   `['Bonafide', 'Fee', 'Others']`).
3. **"Fee"** — `<input>` (`applicationFee`).
4. **"Date"** — `<input type="date">` (`applicationDate`).
5. **"Reason (comma-separated)"** — `<input>`, on change splits on comma, trims, drops empties
   into `form.applyReason` array.
6. **"Create receipt" submit button** — `btn btn-primary`.
7. `<Alert data={data}/>` — renders `alert-success`/`alert-danger` from `data.message` /
   `data.success`.

Server save (`saveCertificateReceiptAdd`): requires `registerNo` and `applyFor`, else
`{ success:false, message:'Register number and apply type required.' }`. Looks up the student
(`lookupStudent`); if not found **and** `applyFor !== 'Others'` →
`{ success:false, message:'Student not found.' }` (i.e. "Others" apply-type tolerates an
unmatched register number — matches the legacy general-purpose receipt use case). Builds the
reason string via `buildReasonString` (joins `applyReason` array with `^^^`, optionally appends
`applyForName`/`otherApplyName` with `^^^^^` separators — legacy delimiter convention). Computes
next `application_no` via `MAX(application_no)+1` over `del=1` rows. Inserts into
`certificate_receipt_tb` including all `RECEIPT_BLANK_TEXT_COLUMNS`/`RECEIPT_BLANK_DATE_COLUMNS`/
`RECEIPT_BLANK_INT_COLUMNS` from `certificateShared.js` (NOT NULL legacy columns with no default —
CRI exam attempt/passing fields, training/leave dates, etc. — populated blank here, filled in
later at approval time). Success message: `` `Receipt ${appNo} created.` ``.

### 3.5 `receipt-edit` — Edit Receipt (`certificate_receipt_edit.php`)

Component: `ReceiptEditScreen`. Fields: **"Receipt no"** `<input>` + **"Load" button**
(`btn btn-secondary`) → `onLoad({ applicationNo })`. If `data.receipt` returns (has `.id`), shows
an edit form: Register No, Apply for, Fee, Date, **"Update" submit button**.

Server load looks up by exact `application_no` (`Number(applicationNo)`), returns `receipt: null`
if not found (the form then simply doesn't render). Server save requires `payload.id`
(`{success:false,message:'Receipt id required.'}` otherwise); re-validates the student the same
way as receipt-add (blocks unknown student unless `applyFor === 'Others'`). Message:
`"Receipt updated."`.

### 3.6 `receipt-report` — Receipt Report (`certificate_receipt_report.php`)

Component: `ReceiptReportScreen`. Filters: **From** / **To** date pickers (cross-constrained via
`min`/`max`), **Type** `<select>` (options from `data.applyTypes`, default `All`), **"Search"
button**. Below: `Total amount: {data?.totalAmount ?? 0}`, then a table
`Receipt | Date | Reg.No | Name | Course | Apply for | Amount`.

Server (`loadCertificateReceiptReport`): defaults `fromDate` to **today** if not supplied
(`new Date().toISOString().slice(0,10)`), `toDate`/`searchType` empty by default. Filters use
`DATE(R.application_date) >= / <=`. `totalAmount` is summed client-... no, server-side, by
stripping non-numeric characters from `application_fee` and summing. `save` (triggered by the
Search button via `onSave({ filters })`) just re-runs `load` with those filters (report screen
never mutates).

### 3.7 `cert-request` — Certificate Request (`create_crequest.php`)

Component: `CertRequestScreen`. Two-column layout: form (`col-md-8`) + "Last Request" card
(`col-md-4`).

Form fields:
1. **"Category"** `<select>` — `onChange` both updates local `categoryId` and calls
   `onLoad({ categoryId: v })` to refresh the subcategory list, and resets `subcategoryId`/
   `photocopyList`.
2. **"Certificate"** `<select required>` — options `data.subcategories` for the selected category.
   First option `<option value="">Select</option>`.
3. **"Register No"** `<input required>`.
4. Conditional **"Certificate For"** checkbox group — shown only when the selected subcategory's
   `format` (lower-cased) equals `'photocopy'`; options from `data.photocopyItems` (sourced from
   `master_setup` where `category='Attachment'`). Each is a checkbox toggling membership in
   `form.photocopyList`.
5. **"Submit request" button** (`btn btn-primary`) — on success, resets
   `subcategoryId`/`registerNo`/`photocopyList` (keeps `categoryId`).
6. `<Alert data={data}/>`.

"Last Request" card: shows `CR{applicationNo}`, `{certificateName} @ {applicationDate}`, student
name, `{registerNo} | {degreeName}{departmentName}`, or `No requests yet.` if `data.lastRequest`
is null.

Server load (`loadCertificateRequest`): defaults `categoryId` to the first category if not
given; loads that category's subcategories, the photocopy attachment items, and the single most
recent request (`ORDER BY R.application_no + 0 DESC LIMIT 1` — numeric-cast ordering since
`application_no` is stored as text/varchar historically).

Server save (`saveCertificateRequest`): requires `registerNo` and `subcategoryId`, else
`{success:false,message:'Register number and certificate type required.'}`. Requires the student
to exist (`lookupStudent`) — **unlike receipt-add, there is no "Others" bypass here** — missing
student → `{success:false,message:'Student not found.'}`. Requires the subcategory to resolve to
a real row → else `'Invalid certificate type.'`. **Duplicate-request guard**: queries for an
existing `del=1 AND apply_for=<subcategoryId> AND student_id=<id> AND status=0` row; if found →
`{success:false,message:'A pending request already exists for this certificate.'}` (there is no
UI hint about this before submit — it surfaces only as the save error). For `format==='photocopy'`
subcategories, requires at least one `photocopyList` item selected, else `'Select photocopy items.'`.
On success inserts a new receipt with `status:0` and message `` `Request ${appNo} created.` ``.

### 3.8 `tc-details` — TC Details (`tc_details.php`)

Component: `TcDetailsScreen`. Fields:
1. **"Course"** `<select>` grouped by `optgroup` (`data.courseOptions`, grouped by
   `option.group`). `onChange` → `loadCourse(value, 1)` (resets to page 1).
2. Entry-count line `Showing {from} to {to} of {total} entries` (only shown once a course is
   selected) or `Showing 0 to 0 of 0 entries`.
3. **Students table**, columns: `# | Roll No | Name | Admission No. | Admission Date | Leaving
   Date | Issue Date | Reason | Disc.` Admission No/Date, Leaving Date, Issue Date are editable
   inputs (`admissionNo` text, three `type="date"`). "Reason" is two radios per row
   (`name="reason_{s.id}"`): **"Completed"** and **"Discontinued"** — selecting Discontinued
   defaults `discontinuedYear` to `'1'`; selecting Completed clears it. "Disc." column shows a
   year `<select>` (options `data.discontinuedYearOptions`, default `['1','2','3','4']`) only
   when that row's reason is `discontinued`.
   Empty state: `<td colSpan={9} className="text-danger">` — `"No data available"` if a course
   is selected but has no students, `"Select a course to load students."` otherwise.
4. **Previous / Next** pagination buttons shown only if `pagination.total > pagination.pageSize`
   (server page size 50).
5. **"Save" button** (`btn btn-danger`, shown only when `students.length`) →
   `onSave({ courseRef: data?.courseRef, page, students })`.

Server (`certificateTc.js`): `courseRef` format is `{courseId}___{academicYear}` — **note this is
the `courseId___year` key format**, distinct from exam's `courseId___year___type`; built by
`buildTcCourseOptions`, which walks each active course from `basic_setup_course_tb` from its
configured academic-year start (P.G courses use `pg_academic_year`, everything else uses
`ug_academic_year` from `basic_setup_tb`) down to `year_of_start`, producing one dropdown option
per year with `group` label `{course_name} | {degree_name}{dept} | FT/PT`. Save
(`saveTcDetails`) requires both `courseId` and `academicYear` parsed from `courseRef`, else
`{success:false,message:'Please select a course and academic year.'}`. For each student row with
an `id`, updates `student_profile_tb` (admission_no/date, `releaving_date`, `tc_issue_date`,
`releaving_info` — `'discontinued'`/`'completed'`, `releaving_year`, `cri_status`) **scoped to
that `course_id`/`academic_year`** — a student who doesn't belong to the currently-loaded
course/year silently isn't updated (`WHERE ... AND course_id=... AND academic_year=...`).
Zero/blank dates default to `'0000-00-00'`.

### 3.9 `tc-request-add` — TC Request (`tc_approve_add.php`)

Component: `TcRequestAddScreen`. Fields: **"Date"** `<input type="date" required>`
(`approveDate`), **"Roll No (separated by comma)"** `<textarea rows={4} required>`
(`registerNo`), **"Save"** submit button (`btn btn-danger`).

Server save (`saveTcRequestAdd`): splits `registerNo` on newlines/commas, trims, uppercases,
rejoins with `,`; empty after cleanup → `{success:false,message:'Register number required.'}`.
Inserts one row into `tc_approve_tb` (comma-joined register numbers stored as a single string —
matches legacy batch-approval convention). Message: `"TC request added."` and the form resets
`registerNo` to `''` (keeps `approveDate`).

### 3.10 `tc-request-edit` — Edit TC Request (`tc_approve_edit.php`)

Component: `TcRequestEditScreen`. Meta sets `initialLoadFields: { fromDate: <today>, toDate: '' }`.
Filter card: **"From"**/**"To"** date pickers, **"Search"** button (`btn btn-danger`).
Table: `S.No. | Date | Roll No | Delete`; empty state `No data found...`. Each row has a
**"Delete"** button (`btn btn-sm btn-danger`) that opens a confirm modal (title `"Confirm"`,
body `"Are you sure to delete..."`, footer `Close` / `Confirm` (`btn btn-warning`)).

Server load returns `requests: []` unless at least one of `fromDate`/`toDate` is set (matches
legacy behavior of not dumping the whole table by default). Delete soft-deletes (`del=0`) via
`payload.action === 'delete'`.

### 3.11 `tc-generate` — TC Generate (`tc_generate.php`)

Component: `TcGenerateScreen`. Fields: `<input placeholder="Register no">` + **"Load"** button
(`btn btn-primary`) → `onLoad({ registerNo })`. Results render as cards per student: name +
register no, degree/department, and `Admission: {admissionDate} | Leaving: {leavingDate} |
Issue: {issueDate}`.

Server (`loadTcGenerate`): looks up `tc_approve_tb` rows where `register_no LIKE
'%{registerNo}%'` (substring match against the comma-joined strings from `tc-request-add`), then
dedupes the matched register numbers and joins `student_profile_tb`/`basic_setup_course_tb` for
display. This screen has **no print button in the current React port** — `certificateHtml`
generation exists for internship/aaadar screens but not for TC (gap vs. legacy, which prints the
TC document directly).

### 3.12 `internship-schedule` — Internship Schedule (`student_internship.php`)

Component: `InternshipScheduleScreen`. Fields: `<input placeholder="Register no">` + **"Load"**
button (`btn btn-secondary`). Once a student is found (`data.student`), shows
`{student.student_name}` — `{student.degree_name}`, then six generic labeled inputs (labels are
the raw camelCase keys, **not humanized**: `department`, `elDepartment`, `totalPeriod`,
`fromDate`, `toDate`, `grade`). **"Save internship"** button (`btn btn-primary`) →
`onSave({ registerNo, internship })`. Below, a table of existing internship rows for the student
(`Department | Period | From | To | Grade | (delete)`), each row deletable
(`onSave({ action:'delete', id, registerNo })`, soft delete).

Server load also fetches `student_internship_related_tb` (leave/final-year/lr-number metadata)
into `related`, but **the client component never renders `data.related`** — loaded but unused in
the current UI (parity gap vs. legacy which shows this data).

### 3.13 `internship-generate` — Internship Print (`internship_generate.php`)

Component: `InternshipGenerateScreen`. Injects `/internship-certificate.css` into `<head>` on
mount (only once, guarded by `document.getElementById('internship-cert-css')`).

Filter card:
1. **"Search By"** radios: `Roll No` / `Batch` (`name="internshipSearchBy"`).
2. If Roll No: **"Roll No"** `<input placeholder="Roll No. separated by ,">` + **"Go"** button
   (`btn btn-info`).
3. If Batch: **"Course / Batch"** `<select>` grouped by `optgroup`, `--Select--` placeholder;
   selecting a value immediately triggers `onLoad({ searchBy: 'batch', searchInput: value })`.
4. Matched student list rendered as `btn btn-link` rows, styled green (`#7AB12C`) when selected
   (`data.selectedStudentId`); clicking re-loads with `studentId` set.
5. `data.message` (e.g. `"No details found..."`) shown in red if present.

Right pane: **"Print"** button (`btn btn-info`, disabled unless `data.certificateHtml` present) →
`printInternshipCertificate(data.certificateHtml)` (`client/src/utils/printReport.js`, opens a
new window with `/internship-certificate.css` injected, calls `.print()` — **never uses
`window.open(..., 'noopener')`**, per CLAUDE.md rule 7). Certificate preview rendered via
`dangerouslySetInnerHTML`. Empty state: `"Search by roll number or batch to load the internship
certificate."`

Server (`certificateInternship.js` + `internshipGenerateCore.js`): when a `studentId` is present,
directly builds `certificateHtml` for that student (calling `buildInternshipCertificateHtml`,
which pulls the student's internship + related rows and formats dates, blanking to `-Nil-` where
missing via `nilOrDate`/`nilOrText`, and looks up an ID-card photo at
`legacy/files/student_idcard/{registerNo}A.jpg` if present). When only a search term is given, it
auto-selects the **first** matched student and generates their certificate. `message` is set to
`"No details found..."` whenever the certificate couldn't be built (student found but no
internship record, or no student matched at all).

### 3.14 `internship-photo` — Photo Upload (`student_internship_photo.php`)

Component: `InternshipPhotoScreen`. Fields:
1. **"Upload Internship Certificate Photo"** — `<input type="file" accept=".jpg,.jpeg" multiple>`.
2. **"Overwrite Existing File"** checkbox.
3. Static red note block: `NOTE: 1. File name should be "rollno"A.jpg (e.g. 1718007A.jpg) 2.
   Individual files size less than 3 MB 3. JPG format only`.
4. Progress bar (`.progress`/`.progress-bar`, shown only while `0 < progress < 100`).
5. Result list: each row `Success! {filename} uploaded.` (green) or `Wrong! {filename} —
   {message}` (red).

Client-side validation (before any network call, per-file, inside `handleFiles`):
- Extension must be `.jpg`/`.jpeg` (case-insensitive) → else message `"Unsupported file type!"`.
- Size must be ≤ 3 MB (`3 * 1024 * 1024`) → else `"File is too big, it should be less than 3 MB."`.
Valid files are individually base64-encoded (`FileReader.readAsDataURL`, stripped of the data-URL
prefix) and posted one at a time via `onSave({ overwriteExists }, [{ filename, content }])`.

Server save (`saveInternshipPhoto`): re-validates extension and 3 MB size server-side (defense in
depth — same messages). Writes files under `LEGACY_FILES_PATH/student_idcard/` after sanitizing
the filename (strips whitespace, `-`, `()`, `[]`). If a same-named file exists and
`overwriteExists` is false → `` `${storedName} already exists...` `` per-file, does not
overwrite. Returns `{ success: <all files ok>, message, results }`.

### 3.15 `implant-cert` / `laser-cert` — AAADAR Certificates (`aaadar_implant.php`,
`aaadar_laser.php`)

Both render the same shared `AaadarCertificateScreen` (in `CertificateScreens.jsx`), parameterized
by a `title` prop (`"Implant Certificate"` / `"Laser Certificate"`). UI/interaction pattern is
**identical** to `internship-generate` (§3.13): search-by-roll/batch radios, roll-no input + "Go"
button or batch `<select>`, student list, "Print" button (disabled unless `certificateHtml`),
preview via `dangerouslySetInnerHTML`. Print goes through `printAaadarCertificate` (loads
`/aaadar-certificate.css`). CSS file injected as `/aaadar-certificate.css` with id
`aaadar-cert-css`.

Server dispatch (`certificateAaadar.js`) calls the shared `loadAaadarCertificateScreen(memberId,
fields, audit, 'implant'|'laser')` in `aaadarCertificateCore.js`, which differs per certificate
type only in `CERT_CONFIG`: background image filename (`Certificate-Implant.jpg` /
`Certificate-Laser.jpg`), the DB column storing the issued certificate number
(`aaadar_imp_cno` / `aaadar_las_cno`), and the fixed programme-description sentence embedded in
the certificate body (`"has completed Standard Dental Implant Competency Programme (10
months)"` vs `"...Soft & Hard Tissue Laser Competency Programme (6 Days)"`). Course/batch
dropdown options are built from `basic_setup_course_tb` using **`courseId___academicYear`** keys
(the `internship-generate`/AAADAR screens use `courseId___academicYear`, distinct from exam's
`courseId___academicYear___type` — see `loadAaadarCourseOptions`), spanning from
`endYear - course_duration` down to `year_of_start`. `save` for both screens is a pure re-load
(no persistence — these are read/print-only certificates in the current native port; QR code
generation is imported (`qrcode` package) but not shown wired into the returned HTML fully in the
excerpt read — treat as a display concern to verify against `aaadarCertificateCore.js` if editing
this screen).

## 4. Primary user stories

**US-16.1 — Configure certificate categories and templates**
As an **admin office staff member**, I want to create/edit certificate categories and their
subcategories (with a template format and free-text details) on the **Setup** screen, so that
the certificate catalog students can request from stays current.
*Acceptance criteria:* Selecting "Add new category" clears the form; saving with an empty
"Category name" is rejected with `"Category name required."`; adding a subcategory row and
saving persists it with `del=1`; deleting a persisted row soft-deletes it (`del=0`) immediately
without a confirm dialog on this screen (unlike NAAC's `ConfirmModal`).

**US-16.2 — File a certificate request as/for a student**
As an **office staff member**, I want to submit a **Certificate Request** (`cert-request`) by
picking a category, a certificate type, and entering the student's register number, so that a
pending receipt (`status=0`) is created for approval.
*Acceptance criteria:* Submitting without a matched student returns `"Student not found."`;
submitting a second request for the same student+certificate while one is still pending (`status
=0`) is rejected with `"A pending request already exists for this certificate."`; a photocopy-type
certificate requires at least one item checked in "Certificate For" or is rejected with `"Select
photocopy items."`; on success the form resets (category preserved) and the "Last Request" card
updates.

**US-16.3 — Approve, reject, or hold a certificate request**
As an **office staff member**, I want to filter pending requests on the **Approve & Print**
screen by status/date/roll-no, open one, and set it to Approved/Rejected/Pending with comments
and (for exam-related certificates) subject attempt/passing values, so that the request pipeline
moves forward.
*Acceptance criteria:* The screen defaults to `status=0` (Pending) on first load
(`initialLoadFields`); the summary card always reflects **unfiltered** totals across all
statuses; confirming "Approved & Print" sets `generated_date = CURDATE()` and returns message
`"Certificate approved."`; confirming "Rejected" returns `"Certificate request rejected."`.

**US-16.4 — Record and edit a fee/receipt for a certificate request**
As an **office staff member**, I want to add a receipt (`receipt-add`) for Bonafide/Fee/Others
certificate requests with an application fee and date, edit it later by receipt number
(`receipt-edit`), and run a dated Receipt Report (`receipt-report`) with a running total, so that
certificate-related collections are auditable.
*Acceptance criteria:* "Others" apply-type is the only type allowed for an unmatched register
number; the report defaults its "From" date to today and totals the fee column after stripping
non-numeric characters.

**US-16.5 — Issue a Transfer Certificate**
As a **registrar/academic staff member**, I want to mark students in a course/year as
Completed or Discontinued (with a discontinuation year) and set admission/leaving/issue dates on
**TC Details**, batch-add TC requests by comma-separated roll numbers on **TC Request**, review
and delete pending TC requests on **Edit TC Request**, and pull up a student's TC data for
generation on **TC Generate**.
*Acceptance criteria:* Saving TC Details without selecting a course/year is rejected
(`"Please select a course and academic year."`); a student update only applies if that student's
`course_id`/`academic_year` matches the currently loaded course/year; TC Request rejects an empty
roll-number list (`"Register number required."`).

**US-16.6 — Generate and print an internship (CRI) completion certificate**
As an **office staff member**, I want to search a student by roll number or by course/batch on
**Internship Print**, preview the formatted certificate, and print it, so that graduating
students receive their internship completion document.
*Acceptance criteria:* The Print button is disabled until `certificateHtml` is present; searching
with no match shows `"No details found..."`; the print call never uses
`window.open(..., 'noopener')` (breaks `.print()` per CLAUDE.md rule 7).

**US-16.7 — Bulk-upload internship ID photos**
As an **office staff member**, I want to select multiple JPG photos named `{rollno}A.jpg` and
upload them for internship certificates, with a progress bar and a per-file success/failure list,
so that photos are attached without one-by-one manual uploads.
*Acceptance criteria:* Non-JPG files are rejected client-side with `"Unsupported file type!"`
without a network call; files over 3 MB are rejected with `"File is too big, it should be less
than 3 MB."`; re-uploading an existing filename without checking "Overwrite Existing File"
returns `` `${storedName} already exists...` `` per file.

**US-16.8 — Generate Implant/Laser AAADAR certificates**
As an **office staff member**, I want to search a student and print their Implant or Laser
competency certificate with the correct fixed programme description and background image, so
that specialty-programme graduates receive the right document.
*Acceptance criteria:* Implant and Laser share one UI component but never mix background image,
column, or programme text (verified via `CERT_CONFIG` keyed by cert type).

## 5. Rare / edge-case user stories

**US-16.9 — Issuing a duplicate certificate request**
As an **office staff member**, when I try to submit a Certificate Request for a certificate type
the same student already has pending, I want the system to block it with `"A pending request
already exists for this certificate."` rather than silently create a second receipt, so the
office doesn't double-process (and double-bill) the same request.
*Note:* the guard only checks `status = 0` (pending); a student can freely request the **same**
certificate again once a prior request has been Approved (`status=1`) or Rejected (`status=2`) —
this matches legacy business logic (no history-based block), not a bug.

**US-16.10 — Certificate request for a student who has already left (TC issued)**
As an **office staff member**, if I look up a register number on `cert-request`, `receipt-add`,
or `internship-generate` for a student who has already been marked "Completed"/"Discontinued" and
issued a TC on `tc-details`, the system still resolves them via `lookupStudent` (which does not
filter on `releaving_info`/`releaving_date`) and lets me create a receipt or print a certificate
for them, so that certificates (e.g. re-issuing a bonafide for alumni purposes) remain obtainable
after leaving.
*Caveat:* there is no UI warning that the student has left — staff must know from context; this
is worth flagging if legacy PHP shows a "student has left" banner that the modern screens omit.

**US-16.11 — Template/subcategory format mismatch on Certificate Request**
As an **office staff member**, if a subcategory's `c_format` is anything other than the literal
string `"photocopy"` (case-insensitive), the "Certificate For" checkbox section never renders —
so a subcategory misconfigured with a typo'd format (e.g. `"Photo Copy"` with a space) silently
loses its item-selection UI and the request is submitted with an empty `applyReason`, which is
allowed for non-photocopy formats. Office staff configuring templates on the `setup` screen
should keep `c_format` values exactly matching the four expected values
(`bonafide|fee|others|photocopy|custom` per `TEMPLATES` in `certificateCategorySetup.js`) to avoid
silently losing functionality.

**US-16.12 — TC save on a page of students spanning a course/year mismatch**
As a **registrar staff member**, if I edit a row's fields (e.g. leaving date) while a different
course/year happens to be loaded (stale cache, or a race between navigating and the page's async
load), my "Save" click is filtered server-side by `course_id`/`academic_year` — the update
silently no-ops for a mismatched student rather than throwing an error, so I should re-verify the
save actually applied to the intended course/year page rather than trusting a generic success
toast.

**US-16.13 — Internship certificate print with missing internship record**
As an **office staff member**, if I select a student who has no rows in `student_internship_tb`,
the Print button stays disabled (`certificateHtml` never populates) and I see `"No details
found..."`, so I know to first record the internship on `internship-schedule` before generating
the certificate.

**US-16.14 — Photo upload with an internship photo folder that has grown very large**
As an **office staff member** uploading many photos in one batch, the client processes files
**sequentially, one `onSave` POST per file** (not a single multi-file request) — for a batch of,
say, 200 photos this means 200 sequential round-trips; there is no batch-cancel button once
started, so a large upload should be split into smaller batches to avoid a long-running,
un-cancelable upload.

### Future (not implemented)

The following extrapolate from the current pattern and from `mobile.md` — these are proposals,
not existing behavior.

- *(Future — not implemented)* **QR-code certificate verification**: `aaadarCertificateCore.js`
  already imports the `qrcode` npm package, suggesting a QR code could be embedded in generated
  AAADAR certificates linking to a public verification page (`/verify/:certNo`) that confirms
  authenticity without contacting the office — this would need a new public (unauthenticated)
  endpoint and is not currently wired into the returned certificate HTML per the code read.
- *(Future — not implemented)* **Mobile "my certificates" self-request screen**: per
  `mobile.md` §6/§8, a v1 mobile app is read-mostly; a certificate self-request flow (student logs
  in on the phone, submits `cert-request` themselves instead of visiting the office) would be a
  Phase 3 "light write" mobile feature, reusing `/api/certificates/setup/cert-request/save` as-is.
- *(Future — not implemented)* **Push notification on approval**: notifying a student by SMS/push
  when their `certificate_approve.php`-equivalent request flips to Approved — `mobile.md` §8
  explicitly flags push infrastructure as new backend surface requiring separate sign-off.
- *(Future — not implemented)* **PDF export via `expo-print`**: mobile rendering of
  `certificateHtml`/TC documents through `react-native-webview` + `Print.printToFileAsync` +
  `expo-sharing`, replacing the web's `printReportHtml`/`printAaadarCertificate`/
  `printInternshipCertificate` window-based printing, per `mobile.md` §7.1.

## 6. Traceability

| Story | Client file(s) | Server endpoint | Service file | Table(s) |
|---|---|---|---|---|
| US-16.1 | `CertificateScreens.jsx` (`CertificateSetupScreen`) | `POST /api/certificates/setup/setup/load\|save` | `certificateCategorySetup.js` | `cer_category_tb`, `cer_subcategory_tb` |
| US-16.2 | `CertificateScreens.jsx` (`CertRequestScreen`) | `POST /api/certificates/setup/cert-request/load\|save` | `certificateRequest.js` | `certificate_receipt_tb`, `cer_category_tb`, `cer_subcategory_tb`, `master_setup`, `student_profile_tb` |
| US-16.3 | `ApproveScreen.jsx` | `POST /api/certificates/setup/approve/load\|save` | `certificateApprove.js` | `certificate_receipt_tb`, `student_profile_tb`, `basic_setup_course_tb`, `cer_subcategory_tb` |
| US-16.4 | `CertificateScreens.jsx` (`ReceiptAddScreen`, `ReceiptEditScreen`, `ReceiptReportScreen`) | `POST /api/certificates/setup/receipt-*/load\|save` | `certificateReceipt.js`, `certificateShared.js` | `certificate_receipt_tb` |
| US-16.5 | `CertificateScreens.jsx` (`TcDetailsScreen`, `TcRequestAddScreen`, `TcRequestEditScreen`, `TcGenerateScreen`) | `POST /api/certificates/setup/tc-*/load\|save` | `certificateTc.js` | `student_profile_tb`, `tc_approve_tb`, `basic_setup_course_tb`, `basic_setup_tb` |
| US-16.6 | `CertificateScreens.jsx` (`InternshipGenerateScreen`), `printReport.js` | `POST /api/certificates/setup/internship-generate/load` | `certificateInternship.js`, `internshipGenerateCore.js` | `student_internship_tb`, `student_internship_related_tb`, `student_profile_tb`, `basic_setup_course_tb` |
| US-16.7 | `CertificateScreens.jsx` (`InternshipPhotoScreen`) | `POST /api/certificates/setup/internship-photo/save` | `certificateInternship.js` | filesystem (`LEGACY_FILES_PATH/student_idcard/`) |
| US-16.8 | `CertificateScreens.jsx` (`ImplantCertScreen`, `LaserCertScreen`), `printReport.js` | `POST /api/certificates/setup/implant-cert\|laser-cert/load` | `certificateAaadar.js`, `aaadarCertificateCore.js` | `student_profile_tb`, `basic_setup_course_tb`, `basic_setup_tb` |
| US-16.9 | `CertRequestScreen` | `POST /api/certificates/setup/cert-request/save` | `certificateRequest.js` | `certificate_receipt_tb` |
| US-16.10 | `CertRequestScreen`, `ReceiptAddScreen`, `InternshipGenerateScreen` | various `/load`, `/save` | `certificateShared.js` (`lookupStudent`) | `student_profile_tb` |
| US-16.11 | `CertificateSetupScreen`, `CertRequestScreen` | `POST /api/certificates/setup/setup/save`, `cert-request/save` | `certificateCategorySetup.js`, `certificateRequest.js` | `cer_subcategory_tb` |
| US-16.12 | `TcDetailsScreen` | `POST /api/certificates/setup/tc-details/save` | `certificateTc.js` | `student_profile_tb` |
| US-16.13 | `InternshipGenerateScreen` | `POST /api/certificates/setup/internship-generate/load` | `internshipGenerateCore.js` | `student_internship_tb` |
| US-16.14 | `InternshipPhotoScreen` | `POST /api/certificates/setup/internship-photo/save` (repeated) | `certificateInternship.js` | filesystem |

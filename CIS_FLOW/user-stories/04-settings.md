# 04 — Settings Module

> Companion deep-dive to [../userstory.md](../userstory.md). Cites concrete file paths and
> legacy `.php` filenames so every story is verifiable against the real code.

---

## 1. Module overview

**Purpose.** The Settings module is the institution/system configuration surface for admins —
staff department & designation master data, workflow approval toggles, SMS notification
toggles (college/hospital/budget), print layout & CSS setup, lesson-plan configuration,
payroll salary signatures, and payroll/SMS cron email/mobile recipient lists. It is the
"back office" screen set: nobody outside admin/HR/payroll staff normally touches it, and it
has no analogue in `mobile.md`'s mobile client scope (see §6).

**Primary actors.**
- **Global admin** (`req.user.accessType === 'Global'`) — bypasses menu-based authorization
  entirely (`menuAuthForModule`), can reach every screen listed here.
- **Module-scoped admin/HR/payroll staff** — reaches a screen only if their `accessType`'s
  enabled menu links include a PHP pattern for the `settings` module (via
  `authentication_tb` ⋈ `basic_admin_menu_tb`), enforced by `menuAuthForModule('settings')`
  in `server/src/routes/settings.js`.
- **Every authenticated user (indirectly)** — `GET /api/settings/basic` and the unauthenticated
  `GET /api/settings/public` feed institution name/logo into the shell/login screen for all
  users, though those two endpoints are not "setup" screens and have no UI form of their own.

**Legacy `.php` files this module replaces** (14 setup screens, one meta entry each in
`client/src/pages/settings/settingsSetupMeta.js`):

| Legacy file | Modern screen slug |
|---|---|
| `staff_dept_setup.php` | `designation` |
| `staff_dept_order.php` | `d-order` |
| `staff_profile_setup.php` | `staff-master` |
| `staff_edu_allied.php` | `staff-edu-master` |
| `approval_setup.php` | `approval` |
| `sms_approval_setup.php` | `college` |
| `hospital_sms_approval.php` | `hospital` |
| `task_sms_approval.php` | `budget` |
| `print_setup.php` | `print-setup` |
| `print_style.php` | `print-style` |
| `lession_plan_setup.php` (legacy spelling of "lesson") | `lesson-plan` |
| `salary_signature.php` | `signature` |
| `payroll_cron_setup.php` | `payroll-emailer` |
| `sms_cron_setup.php` | `sms-cron` |

`SettingsHub.jsx` / `SettingsSetupHub.jsx` also surface six **academic-module screens ported
into the Settings hub UI** (`ACADEMIC_SETTINGS_LINKS` in `settingsSetupMeta.js`) — these are
not part of this module's own load/save API and are out of scope for section 3 below beyond
noting they exist: `academic.php` (Academic Years), `course_add.php`, `course_edit.php`,
`master_setup.php`, `subject_master.php`, and `dashboard_access.php`.

---

## 2. Screen inventory

All 14 screens share one route pattern, one page shell, and one API-hook wrapper — there is
no per-screen route or component file beyond the form component itself:

- Route: `/settings/setup/:screen` → `client/src/routes/AppRoutes.jsx` renders
  `SettingsSetupPage` for the `settings` module.
- Shell/dispatcher: `client/src/pages/settings/SettingsSetupPage.jsx` — looks up
  `SETTINGS_SCREEN_META[screen]` for title/breadcrumbs and `SETUP_COMPONENTS[screen]` for the
  form component; calls `useSettingsSetupApi(screen)`.
- Hub pages: `client/src/pages/settings/SettingsHub.jsx` (`/settings`) and
  `client/src/pages/settings/SettingsSetupHub.jsx` (`/settings/setup`) both list all 14 links
  (icons `fa fa-wrench` / `fa fa-cog` respectively) grouped by `meta.section`.

| Route | Component file | Legacy `.php` | `meta.section` |
|---|---|---|---|
| `/settings/setup/designation` | `client/src/pages/settings/setup/DesignationSetup.jsx` | `staff_dept_setup.php` | Staff |
| `/settings/setup/d-order` | `client/src/pages/settings/setup/DOrderSetup.jsx` | `staff_dept_order.php` | Staff |
| `/settings/setup/staff-master` | `client/src/pages/settings/setup/StaffMasterSetup.jsx` | `staff_profile_setup.php` | Staff |
| `/settings/setup/staff-edu-master` | `client/src/pages/settings/setup/StaffEduMasterSetup.jsx` | `staff_edu_allied.php` | Staff |
| `/settings/setup/approval` | `client/src/pages/settings/setup/ApprovalSetup.jsx` | `approval_setup.php` | Workflow |
| `/settings/setup/college` | `client/src/pages/settings/setup/CollegeSmsSetup.jsx` | `sms_approval_setup.php` | SMS |
| `/settings/setup/hospital` | `client/src/pages/settings/setup/HospitalSmsSetup.jsx` | `hospital_sms_approval.php` | SMS |
| `/settings/setup/budget` | `client/src/pages/settings/setup/BudgetSmsSetup.jsx` | `task_sms_approval.php` | SMS |
| `/settings/setup/print-setup` | `client/src/pages/settings/setup/PrintSetupSetup.jsx` | `print_setup.php` | Print |
| `/settings/setup/print-style` | `client/src/pages/settings/setup/PrintStyleSetup.jsx` | `print_style.php` | Print |
| `/settings/setup/lesson-plan` | `client/src/pages/settings/setup/LessonPlanSetup.jsx` | `lession_plan_setup.php` | Academic |
| `/settings/setup/signature` | `client/src/pages/settings/setup/SignatureSetup.jsx` | `salary_signature.php` | Payroll |
| `/settings/setup/payroll-emailer` | `client/src/pages/settings/setup/PayrollEmailerSetup.jsx` | `payroll_cron_setup.php` | Cron |
| `/settings/setup/sms-cron` | `client/src/pages/settings/setup/SmsCronSetup.jsx` | `sms_cron_setup.php` | Cron |

**Not a screen** but part of the module's plumbing:
- `client/src/pages/settings/settingsSetupMeta.js` — `SETTINGS_SCREEN_META` + `ACADEMIC_SETTINGS_LINKS`.
- `client/src/pages/settings/useSettingsSetupApi.js` — the module's own hook, **not** the
  generic `createSetupApi` factory (see note below).
- `server/src/routes/settings.js` — mounts `GET /api/settings/public`, `GET /api/settings/basic`,
  and `POST /api/settings/setup/:screen/load|save`.
- `server/src/services/settings/settingsSetup.js` — dispatcher (`VALID_SCREENS`, `LOADERS`, `SAVERS`).
- `server/src/services/settings/setupAudit.js` — `auditFields()` / `logSettingsSetup()`.
- `server/src/services/settings/setup/*.js` — one loader/saver pair per screen (14 files).

**Factory note.** Unlike SMS/TV/kiosk modules, Settings does **not** use
`client/src/components/ModuleSetupFactory.jsx` + `client/src/hooks/createSetupApi.js`. It has
its own bespoke `SettingsSetupPage.jsx` and `useSettingsSetupApi.js`. The practical
differences from the generic factory (confirmed by reading both):
- No client-side response caching — `useSettingsSetupApi.load()` calls `api.post(...)` directly
  every time, whereas the generic `createSetupApi` wraps loads in `cachedGet(...)` with a
  60-second TTL (`client/src/utils/idbCache.js`) and invalidates that cache prefix after save.
- No request-sequence guarding (`loadSeq`/`saveSeq` refs) — a slow load/save in Settings can
  resolve after a newer one and clobber `data` with stale results; the generic factory guards
  against this with sequence counters.
- No `?view=<legacy-file>` query-param sync — the generic factory's `createModuleSetupPage`
  writes `cleanLegacyKey(meta.legacy)` into the URL search params on mount; `SettingsSetupPage`
  does not.
- Both hooks otherwise share the same request/response contract: `POST .../load` with
  `{ fields, query }`, `POST .../save` with `{ fields, files }`, and the same
  `res.data.error` / `res.data.success === false` / `res.data.message` handling.

---

## 3. Pixel-level flow per screen

Every screen wraps its body in a local `<SetupAlerts notice={null} error={null} busy={busy} />`
(`client/src/pages/fees/setup/SetupAlerts.jsx`, itself a re-export of
`client/src/components/SetupAlerts.jsx`) — because `notice`/`error` are hardcoded to `null`
here, this **inner** alert box only ever renders the `busy` line (`<div className="cis-setup-busy">Working</div>`)
while a request is in flight; it never shows text since `notice`/`error` are always null in this
inner instance. The real notice/error text renders **above** the form, in the outer
`SetupAlerts` that `SettingsSetupPage.jsx` passes to `SetupPageShell`'s `alerts` prop, wired to
the hook's actual `notice`/`error` state. Delete confirmations across every list screen render
via `client/src/pages/fees/setup/ConfirmModal.jsx`: title defaults to **"Confirm"**, body
defaults to **"Are you sure?"** but every settings screen supplies the message
**"Are you sure to delete..."**, buttons are **"Close"** and **"Confirm"**.

Loading state: `SetupPageShell` (`client/src/components/PageShell.jsx`) renders
`PageLoading` — spinner + text **"Loading…"** — while `SettingsSetupPage`'s local `loading`
state is `true` (set `true` on mount, cleared once the initial `onLoad({})` call resolves in the
`useEffect`). Unknown screen state: if `SETTINGS_SCREEN_META[screen]` has no entry,
`SettingsSetupPage` renders `<p className="text-danger mb-0">Unknown settings screen.</p>`
inside the shell instead of loading anything.

### 3.1 Department & Designation — `designation` (`staff_dept_setup.php`)

Fields, in DOM order:
1. **"Department"** — `<select className="form-select">`. Options: `--Select One--` (value
   `''`), then `data.departments` (from `GET`-equivalent load, source: `staff_dept_master`
   table, `WHERE del=1 ORDER BY d_order asc`, mapped `{id, name, order}`), then a literal
   **"Add New"** option (`value="add_new"`). `onChange` calls `onLoad({ deptRef: value })`
   immediately (server round-trip on every department pick).
2. Only rendered when `data.showGrid` is true (i.e. an existing department was picked, or
   `deptRef === 'add_new'`):
   - **"Dept. Name"** — text input, bound to `deptName`.
   - **"Dept. Order"** — text input, bound to `deptOrder`.
3. Grid table (only when `showGrid`), columns **Order / Designation / (delete button col)**.
   Rows come from `data.designations` (source: `staff_desg_master`,
   `WHERE del=1 AND d_id=<selectedDept.id>`, `ORDER BY d_order asc`); each existing row shows a
   **"Delete"** button (`btn btn-sm btn-danger`), new rows (no `id`) show none.
4. **"+"** button (`btn btn-sm btn-info`) appends a blank row `{ order: rows.length+1, name: '' }`.
5. **"Save"** button (`btn btn-danger`, `disabled={busy}`), submits the form.

Save call: `onSave({ deptRef, deptName, deptOrder, designations: rows.map(({id,order,name}) => ({id,order,name})) })`
→ `POST /api/settings/setup/designation/save` with body `{ fields: {...above}, files: [] }` →
`saveDesignationSetup` (`server/src/services/settings/setup/designationSetup.js`).
- If `deptRef === 'add_new'`: requires non-empty `deptName` or returns
  `{ success: false, message: 'Department name is required' }`; else `staff_dept_master.create`
  with the new dept (`d_dept: 0, category: '', course_id: '', college: ''` hardcoded blanks) and
  `auditFields(memberId, audit).create` (`del: 1`).
- Else if `deptId` resolves: `staff_dept_master.update` (name/order + `update` audit fields),
  then a **soft-delete-before-recreate pass**: `staff_desg_master.updateMany({ where: { d_id, del: 1 }, data: { del: 0, ...update } })` before looping rows.
- Else (`deptRef` blank/unresolvable): `{ success: false, message: 'Department is required' }`.
- Per designation row: no `id` + blank `name` → skipped; no `id` + non-blank `name` →
  `staff_desg_master.create` (`desg_catg: ''`); has `id` → `staff_desg_master.update` with
  `del: 1` (undoes the soft-delete pass above for rows still present in the save payload).
- Success response merges `{ success: true, message: 'Your details are Updated...' }` with a
  fresh `loadDesignationSetup(memberId, { deptRef: String(deptId) }, { skipLog: true })` result
  (so the client's `data` refreshes from the same `save` response, no second round trip).

Delete action: `onSave({ action: 'delete', id: deleteId, deptRef })` → in
`saveDesignationSetup`, `staff_desg_master.update({ where: { id }, data: { del: 0, ...update } })`
inside a `try/catch`; success → `{ success: true, message: 'Your details are deleted...' }` +
fresh load; failure (e.g. `id` no longer exists) → `{ success: false, message: 'Please try again...' }`.
Every load/save/delete call also writes an audit row via `logSettingsSetup('staff_dept_setup.php', 'View'|'Update'|'Delete', 'Successful'|'Unsuccessful', <description>, memberId, audit)`.

### 3.2 Designation Order — `d-order` (`staff_dept_order.php`)

No filter control — loads immediately on mount (`useEffect(() => { onLoad(); }, [onLoad])`
with no fields). Table columns **Designation / Order**: designation name cell is
plain text (not editable — `{row.name}`), Order cell is a text input. Rows are built server-side
in `loadDOrderSetup` from `staff_desg_master` **distinct names** (`WHERE del=1`, `distinct: ['name']`)
left-joined in memory against `staff_desg_order` (`WHERE del=1`) by name, sorted by resolved
order ascending; if no distinct names exist, falls back to a single placeholder row
`{ name: '', order: 1 }`.

Only button: **"Save"** (`btn btn-danger`, `disabled={busy}`). Save sends
`onSave({ rows: rows.map(({id,name,order}) => ({id,name,order})) })` → `saveDOrderSetup`:
soft-deletes all active `staff_desg_order` rows first (`updateMany del:1 → del:0`), then per row
with non-blank `name`, creates (`!id`) or updates-with-`del:1` (`id` present) a
`staff_desg_order` row. Response: `{ success: true, message: 'Your details are Updated...' }` +
fresh `loadDOrderSetup` result.

### 3.3 Staff Profile Master — `staff-master` (`staff_profile_setup.php`)

1. **"Category"** — `<select className="form-select">` with two `<optgroup>`s labeled
   **"Staff"** and **"Other"**, populated from a **hardcoded** `CATEGORY_OPTIONS` list of 22
   entries in `staffMasterSetup.js` (e.g. `Staff Name Title`, `Dental Council`, `Address Proof`,
   `Identity Proof`, `Category`→"Staff Category", `Course`, `Degree`, `Major`, `Course Type`,
   `University`, `Experience Institution`, `Experience Type`, `Skills`→"Add-on Skillsets",
   `Extra Curricular`→"Extension Activities", `Area of Interest`→"Area of Specialization",
   `Area of Interests`→"Sports", `Languages Known`, `Attachments` in group Staff; `Bank`→"Bank
   Details", `Salary Advance`→"Salary Advance Type", `Salary Arrear`→"Salary Arrears Type",
   `Article Type`, `DCI Norms Category` in group Other) — **not** read from any table.
   `onChange` triggers `onLoad({ category: value })`.
2. Grid (rendered only when `category` truthy), columns **Order / Name / Short Name / Sub Name
   List / (delete)**. Backed by `edu_setup_tb` (`WHERE category=<cat> AND del != 0`,
   `ORDER BY category_order asc`); mapped fields `order↔category_order`, `name↔category_name`,
   `shortName↔category_sname`, `subCategory↔sub_category`.
3. **"+"** button appends a blank row; **"Save"** submits.

Save: `onSave({ action: 'update', category, rows: [...] })` → `saveStaffMasterSetup` — requires
`category` truthy else `{ success: false, message: 'Category is required' }`; soft-deletes all
active rows for that category, then per row creates/updates as above with `del:1` restore on
update. Delete action mirrors the designation screen (`del:0`, try/catch,
**"Please try again..."** on failure).

### 3.4 Staff Education Allied — `staff-edu-master` (`staff_edu_allied.php`)

Two cascading dropdowns:
1. **"Category (Degree)"** — options `data.degreeOptions`, sourced from
   `edu_setup_tb WHERE category='Degree' AND del=1 ORDER BY category_order asc`
   (value = row id, label = `category_name`). `onChange` → `onLoad({ category: value, subCategory })`.
2. **"Sub Category (Major)"** — options `data.majorOptions`, same source with
   `category='Major'`. `onChange` → `onLoad({ category, subCategory: value })`.

Grid renders only when **both** `category` and `subCategory` are set. Columns **Order / Name /
Short Name / (delete)**, backed by `edu_allied_tb` (`WHERE category=<cat> AND sub_category=<sub>
AND del != 0`). Save requires both category and subCategory or returns
`{ success: false, message: 'Category and sub-category are required' }`; same soft-delete +
upsert pattern as 3.3, targeting `edu_allied_tb`.

### 3.5 Approval Setup — `approval` (`approval_setup.php`)

No filter — loads on mount. Table **Type / Enable**, one row per `approval_tb` record
(`WHERE del=1 ORDER BY id asc`), `pageType↔page_type`, `enabled` = `approval_enable === 1`.
Each row's Enable cell is a checkbox labeled **"Enable approval option"**. Only button:
**"Save"**. `onSave({ items })` → `saveApprovalSetup` updates `approval_tb.approval_enable`
(1/0) per item **only for items with an `id`** (no create/delete path on this screen — it is a
pure toggle grid over a fixed row set).

### 3.6 College SMS Config — `college` (`sms_approval_setup.php`)

Loads `sms_config_tb` (`WHERE del=1`) and buckets rows into 4 fixed groups by title prefix
(`SMS_GROUPS` in `collegeSmsSetup.js`): **Staff** (`c_title` starts with "Staff"), **Student**
(starts with "Student"), **Hostel** (starts with "Hostel"), **Others** (none of the above);
empty groups are filtered out of the response. Rendered per group as an `<h5>` with a
**group-level checkbox** (checked when every item in the group is enabled; toggling it flips
every item in that group at once) followed by a 3-col grid of per-item checkboxes labeled with
`item.title`. Only button: **"Save"**, sends the flattened `items` array (all groups
concatenated); `saveCollegeSmsSetup` updates `sms_config_tb.c_status` per item with an `id`.

### 3.7 Hospital SMS Config — `hospital` (`hospital_sms_approval.php`)

Table **Title / Enable / Mobile** over `sms_config_hospital` (`WHERE del=1`). Enable is a
checkbox; Mobile is a free-text input bound to `item.mobile`. Save →
`saveHospitalSmsSetup` updates `c_status` (1/0) **and** `c_mobile` (trimmed) per item with an
`id`. No client-side phone-format validation.

### 3.8 Budget Task SMS — `budget` (`task_sms_approval.php`)

Structurally identical to 3.7 but against `sms_config_task`
(`saveBudgetSmsSetup` updates `c_status` + `c_mobile`).

### 3.9 Print Setup — `print-setup` (`print_setup.php`)

1. **"Header Title"** — `<select>` grouped by `<optgroup>` per `category`. Options: `--Select
   One--`, **"Add New"** (`value="add_new"`), then `data.pageOptions` grouped by
   `opt.category`, sourced from `print_setup_tb` (`WHERE del=1 ORDER BY category asc, p_order
   asc`), each option labeled `${row.id} | ${row.title}`. `onChange` → `onLoad({ pageRef: value })`.
2. When `data.selected` is truthy (existing page picked or `add_new`):
   - **"Title"** text input (bound to `form.title`), rendered next to the dropdown.
   - **"Sub Title"**, **"Content Title"** (bound `form.bodyTitle`), **"Category"** (free text,
     not a dropdown — `form.category`), **"Order"** (`form.order`).
   - **"Note"** — `<textarea rows={3}>` bound to `form.pageNote`.
   - **"Page No"** — 3 radio buttons named `pageNo`: **"None"** (`value 'none'`), **"Page:
     x"** (`value 'css'`), **"Page: x of y"** (`value 'php'`).
   - **"Rows/page"**, **"Home height"**, **"Inner height"** text inputs.
   - Six checkboxes: **"Header first page"** (`homeHeader`), **"Header inner page"**
     (`innerHeader`), **"Footer"**, **"Right text"**, **"Signature block"**, **"Generated by"**.
   - Three role blocks, each headed by a capitalized role name (**"Approved"**, **"Checked"**,
     **"Verified"** — via `text-capitalize` on `role`), each with **"Name"** and
     **"Designation"** placeholder text inputs, bound to `form[role].name` /
     `form[role].designation`.
   - **"Save"** button, only visible when `data.selected` truthy.

Load (`loadPrintSetupSetup`): resolves `selected` from `print_setup_tb` by numeric id match
against `pageRef`; if found, also loads per-page role signatures from `print_signature_tb`
(`WHERE print_id=<id> AND del=1 AND category != 'signature'`), keyed by `category` into
`approved`/`checked`/`verified` sub-objects (falls back to `{id:null,name:'',designation:''}`
when a role has no row). `pageRef === 'add_new'` synthesizes a blank `selected` object
client-independently (all defaults, `pageNo: 'none'`).

Save: `onSave({ pageRef, form })` → `savePrintSetupSetup`. New page (`pageRef === 'add_new'`)
requires non-blank `form.title` else `{ success: false, message: 'Header title is required' }`;
creates a `print_setup_tb` row with all mapped boolean-as-int fields
(`home_header/inner_header/footer/right_text/signature/generated_by` each `1`/`0`, plus derived
`approved_by/checked_by/verified_by` set to `1` if that role's name-or-designation is non-blank).
Existing page: updates `print_setup_tb`, then soft-delete-restore pass on
`print_signature_tb` (`del:0` for all non-"signature" rows on that `print_id`) before
`upsertRoleSignature` per role — a role with no `id` and no name/designation is skipped
entirely (no blank row created); otherwise create (`!id`) or update-with-`del:1` (`id` present).
Neither `pageRef` blank nor unresolvable id → `{ success: false, message: 'Please select a print page' }`.

### 3.10 Print Style (CSS) — `print-style` (`print_style.php`)

Single field: **"Style (salary.css)"** — `<textarea rows={18} className="form-control
font-monospace">` bound to raw file content. Load (`loadPrintStyleSetup`) reads
`<LEGACY_CIS_PATH>/css/salary.css` directly off disk via `fs.readFile` — **not a database
table** — and returns `content: ''` silently (caught, no error surfaced) if the file is
missing/unreadable. Save (`savePrintStyleSetup`) writes the textarea content verbatim back to
the same file via `fs.writeFile`; on success returns `{ success: true, message: 'Your details
are updated...', content }` (note: lowercase "updated" here, unlike every other screen's "Your
details are Updated..."); on write failure (caught) returns `{ success: false, message: 'Unable
to save style file' }`. Only button: **"Save"**.

### 3.11 Lesson Plan Setup — `lesson-plan` (`lession_plan_setup.php`)

1. **"Category"** — plain `<select>` (no data-driven options; hardcoded `<option value="Type">Type</option>`
   and `<option value="Limit">Limit</option>`). `onChange` → `onLoad({ category: value })`.
2. If `category === 'Limit'` and `data.mode === 'limit'`: single field **"Edit limit (in
   days)"** text input (`w-auto`), bound to `limitValue`, backed by
   `lesson_plan_setup.findFirst({ category:'Limit', del: {not:0} }, order l_order asc)` — reads
   `.name` as the numeric-as-string limit value.
3. If `category === 'Type'` and `data.mode === 'grid'`: grid **Order / Name / Enable Topic /
   (delete)** over `lesson_plan_setup WHERE category='Type' AND del != 0`; `enableTopic` maps
   from `l_type === '1' || l_type === 1` (loose string/number check — see edge case §5).
   **"+"** appends a row; **"Save"** submits either branch.

Save (`saveLessonPlanSetup`): `category` required else `{ success:false, message:'Category is
required' }`. `Limit` branch: updates the existing `limitId` row (`name: value, l_type:'',
l_order:1, del:1`) if `limitId` present, else creates one if `value` non-blank — **no delete
path for the Limit row**. `Type` branch: soft-delete-restore pass then per-row
create/update exactly like other grid screens, storing `enableTopic` as string `'1'`/`'0'` in
`l_type`. Delete action available only from the grid (`Type`) branch.

### 3.12 Salary Signature — `signature` (`salary_signature.php`)

1. **"Category"** — `<select>`, options from `CATEGORY_OPTIONS` = single hardcoded entry
   `{ value: 'progress card', label: 'Progress Card' }`. `onChange` → `onLoad({ category: value })`.
2. Grid, columns **Enable / Ref ID / Designation / Existing file / (delete)**, backed by
   `signature_setup WHERE category=<cat> AND del != 0 ORDER BY ref_name asc`. `enabled` maps
   from `staff_order === 1` (the `order` field doubles as the enable flag — see edge case §5).
   "Existing file" cell shows an `<img>` preview (`height:100`) when
   `row.existingFileUrl` is set (`/legacy/files/stf_signature/<staff_name>`), plus a
   `<input type="file" accept="image/png,image/jpeg,image/gif">` to replace it, plus the
   picked filename as small muted text once chosen.
3. **"+"** appends a blank row; **"Save"** submits.

Save: client reads each row's picked `File` via `FileReader.readAsDataURL` and builds a
`files` array of `{ field: 'sig_<index>', name, data: <base64 data URL> }` before calling
`onSave({ action:'update', category, rows: rows.map(({id,refName,designation,enabled,existingFile}) => ({...}))}, files)`.
Server `saveSignatureSetup` (dispatcher passes `saveSignatureSetup({ ...fields, files },
memberId, audit)` — note the dispatcher, not the screen, merges `files` into the fields
object) requires `category`; soft-delete-restore pass on `signature_setup`; per row, if a
matching file was uploaded, calls `saveLegacyBinaryFile({ folder:'stf_signature', file, maxBytes:
2*1024*1024, allowedExt: new Set(['jpeg','jpg','gif','png']) })` — **if that upload rejects
(oversize or bad extension), the whole save aborts** and returns
`{ success:false, message: uploaded.error }` without persisting any row in that request. Rows
with neither `refName` nor `designation` and no existing `id` are skipped.

### 3.13 Payroll Cron Email — `payroll-emailer` (`payroll_cron_setup.php`)

1. **"Cron Type"** — `<select>`, options `data.cronOptions` from `basic_cron_tb WHERE del=1 AND
   id=1` (a **fixed single-row filter** — `PAYROLL_CRON_WHERE = { del:1, id:1 }` — so this
   dropdown can only ever show 0 or 1 option in practice). `onChange` → `onLoad({ cronRef: value })`.
2. **"Title"** text input bound to `cronTitle`.
3. **"Status"** — single checkbox labeled **"Yes"**, bound to `cronStatus`.
4. **"Day"** — `<select>` of zero-padded day options `'01'`…`'31'` (`DAY_OPTIONS`, generated by
   `Array.from({length:31})`), value coerced through `formatCronDay()` (clamps invalid/out-of-
   range to `'01'`).
5. When `cronRef` set: contacts grid **Name / Email / (delete)**, backed by `basic_cron_email
   WHERE del=1 AND cron_id=<selected.id>`. **"+"** appends `{ name:'', email:'' }`; **"Save"**
   submits.

Save: `onSave({ cronRef, cronTitle, cronStatus, cronDay, contacts })` → `savePayrollEmailerSetup`
— requires `cronRef` truthy (`Number(payload.cronRef)`) else `{ success:false, message:'Please
select a cron entry' }`; re-verifies the row exists inside `PAYROLL_CRON_WHERE` else
`{ success:false, message:'Invalid payroll cron entry' }`; updates `basic_cron_tb` (title,
status, `cron_day`), soft-delete-restore pass on `basic_cron_email` for that `cron_id`, then
per-contact create/update (rows with blank name **and** blank email are skipped).

### 3.14 SMS Cron — `sms-cron` (`sms_cron_setup.php`)

Same shape as 3.13 but: cron options filter is `SMS_CRON_WHERE = { del:1, id: { not: 1 } }`
(everything **except** id 1 — the complement of the payroll screen's filter, so the two screens
never see overlapping cron rows), the **"Day"** field is a plain text input (not a padded
`<select>`), and the contacts grid columns are **Name / Mobile / (delete)** (bound to
`contacts[].mobile`, stored in `basic_cron_email.mobile_no` with `email_id: ''`, whereas the
payroll screen stores `email_id` with `mobile_no: ''`). Save validation mirrors 3.13
(`'Please select a cron entry'` / `'Invalid SMS cron entry'`).

### Shared request/response envelope (all 14 screens)

- Load: `POST /api/settings/setup/<screen>/load` — body `{ fields, query: {} }` (query is
  always `{}` from `SettingsSetupPage`/`useSettingsSetupApi`, not used by any settings loader).
  Response is the raw loader object (shape differs per screen, documented above) on success, or
  `{ message: <string> }` with **HTTP 400** if the loader itself returns `{ error }` (only
  reachable via `assertSettingsSetupScreen` rejecting an unknown `screen` param), or **HTTP
  500** `{ message: 'Unable to load settings form' }` on an uncaught exception
  (`handleSetupError` in `routes/settings.js`, which also `console.error`s the real error
  server-side).
- Save: `POST /api/settings/setup/<screen>/save` — body `{ fields, files }` (`files` empty
  except on `signature`). Response is `{ success, message, ...freshLoadResult }` on the
  service's own validation success/failure path, or the same 400/500 envelope as load for
  unknown-screen / uncaught-exception cases.
- Auth: both routes sit behind `authMiddleware` then `menuAuthForModule('settings')`
  (`setupRouter.use(...)` in `routes/settings.js`) — a request without a valid JWT gets the
  standard 401 from `authMiddleware`; a request from a non-Global user whose `accessType` lacks
  an enabled settings menu link gets the standard menu-auth rejection.
- Audit: every loader/saver calls `logSettingsSetup(<legacy .php name>, 'View'|'Update'|'Delete',
  'Successful'|'Unsuccessful', <description>, memberId, audit)` → `insertLog(...)` into
  `log_tb`, unless `audit.skipLog` is true (set internally when a saver re-loads fresh data to
  return in its own response, avoiding a duplicate "View" log entry per save).

---

## 4. Primary user stories

**S1 — Configure a department's designations.**
As an **admin**, I want to pick a department from the **"Department"** dropdown on
`/settings/setup/designation`, edit the **"Dept. Name"**/**"Dept. Order"** fields and the
Order/Designation grid, and click **"Save"**, so that `staff_dept_master` and
`staff_desg_master` reflect the current department/designation hierarchy used everywhere else
staff records reference a department.
*Acceptance:* selecting a department loads its designation rows via `onLoad({ deptRef })`;
saving with valid `deptName`/rows returns `{ success:true, message:'Your details are
Updated...' }` and the grid refreshes from the same response; a `"Delete"` click on an existing
row soft-deletes it (`del:0`) after confirming in the modal.

**S2 — Add a brand-new department.**
As an **admin**, I want to choose **"Add New"** in the Department dropdown, so that I get an
empty **"Dept. Name"**/**"Dept. Order"** form and grid to create a department that doesn't
exist yet.
*Acceptance:* `deptRef === 'add_new'` makes `showGrid` true with no existing designations;
saving with a blank `deptName` is rejected client-visibly with **"Department name is
required"**; saving with a name creates the `staff_dept_master` row with `del:1`.

**S3 — Reorder designation titles institution-wide.**
As an **HR admin**, I want to open `/settings/setup/d-order`, adjust the **Order** number next
to each designation name, and **Save**, so that staff-listing screens elsewhere in the system
that sort by designation order reflect the new sequence.
*Acceptance:* the grid loads every distinct active designation name with its current order (or
`0` if it has none yet); saving persists one `staff_desg_order` row per named designation.

**S4 — Maintain staff-profile dropdown master data.**
As an **admin**, I want to pick a **"Category"** (e.g. "Skills", "Bank Details") on
`/settings/setup/staff-master`, edit its Order/Name/Short Name/Sub Name List rows, and save, so
that the corresponding dropdown on staff-profile screens elsewhere shows the right options.
*Acceptance:* grid appears only after a category is chosen; unsaved category selection with no
rows shows an empty grid ready for `"+"`; delete removes a row via the confirm modal.

**S5 — Maintain degree/major-scoped education master lists.**
As an **admin**, I want to cascade **"Category (Degree)"** → **"Sub Category (Major)"** on
`/settings/setup/staff-edu-master` and edit that combination's Order/Name/Short Name rows, so
that staff education-history dropdowns are scoped correctly per degree+major.
*Acceptance:* the grid only renders when both dropdowns have a value; changing either dropdown
re-fetches via `onLoad`.

**S6 — Toggle which workflow steps require approval.**
As an **admin**, I want to flip the **"Enable approval option"** checkbox per row on
`/settings/setup/approval` and click **"Save"**, so that downstream approval workflows honor
the updated `approval_tb.approval_enable` flags.
*Acceptance:* toggling a checkbox is purely local state until Save; Save persists only rows
that carry an `id`.

**S7 — Enable/disable college SMS notification types by group.**
As an **admin**, I want to use the group-header checkbox on `/settings/setup/college` (e.g.
"Student") to enable/disable every SMS type in that group at once, or toggle individual types,
so that only relevant automated SMS categories fire.
*Acceptance:* the group checkbox reflects "all items enabled" state and toggling it cascades to
every item in that group; Save flattens all groups back into one `items` array.

**S8 — Enable hospital/budget SMS types and set their target mobile numbers.**
As an **admin**, I want to toggle **Enable** and edit the **Mobile** field per row on
`/settings/setup/hospital` or `/settings/setup/budget`, so that hospital/budget task alerts go
to the right number.
*Acceptance:* Save persists `c_status` and trimmed `c_mobile` per row with an `id`.

**S9 — Configure a print page's header/footer/signature layout.**
As an **admin**, I want to pick or create a print page on `/settings/setup/print-setup`, fill in
Title/Sub Title/Content Title/Category/Order/Note, choose a **"Page No"** style, set
rows-per-page and header/inner heights, toggle the six layout checkboxes, and fill in
Approved/Checked/Verified name+designation, so that the generated print output for that page
matches institution format requirements.
*Acceptance:* picking **"Add New"** shows a blank form gated on a required **"Header Title"** on
save; picking an existing page pre-fills every field including role-signature sub-forms from
`print_signature_tb`.

**S10 — Edit the salary print CSS directly.**
As an **admin**, I want to edit the raw CSS in the **"Style (salary.css)"** textarea on
`/settings/setup/print-style` and click **"Save"**, so that payslip/salary print layouts change
immediately without a deploy.
*Acceptance:* Save writes the textarea content verbatim to `css/salary.css` under
`LEGACY_CIS_PATH` and returns the updated content; reloading the screen shows the persisted CSS.

**S11 — Configure lesson-plan types and the edit-window limit.**
As an **academic admin**, I want to choose **"Type"** on `/settings/setup/lesson-plan` to manage
named lesson-plan types (with an **"Enable Topic"** flag each), or choose **"Limit"** to set the
**"Edit limit (in days)"** value, so that staff lesson-plan entry screens enforce the right
types and edit window.
*Acceptance:* switching category between Type/Limit swaps the whole form; Limit save updates
(or creates, if none exists yet) a single `lesson_plan_setup` row with `category:'Limit'`.

**S12 — Maintain payroll salary-slip signature blocks.**
As a **payroll admin**, I want to add/edit rows on `/settings/setup/signature` (Ref ID,
Designation, Enable, and an uploaded signature image) for the **"Progress Card"** category, so
that generated salary/progress documents show the correct signatory image and name.
*Acceptance:* uploading a file for a row shows the picked filename before Save; after a
successful Save, the row shows the persisted `existingFileUrl` preview from
`/legacy/files/stf_signature/<file>`.

**S13 — Set up payroll cron email recipients.**
As a **payroll admin**, I want to select the payroll cron entry on
`/settings/setup/payroll-emailer`, set its Title/Status/Day, and manage a Name/Email contacts
grid, so that the monthly payroll email job (external cron) notifies the right people on the
right day.
*Acceptance:* the Day dropdown always shows a zero-padded two-digit value even if the stored
`cron_day` is out of range (clamped to `'01'` by `formatCronDay`); Save re-validates the cron
row still exists before writing.

**S14 — Set up SMS cron mobile recipients.**
As an **admin**, I want to select the SMS cron entry on `/settings/setup/sms-cron`, set its
Title/Status/Day, and manage a Name/Mobile contacts grid, so that the SMS batch job notifies the
right numbers.
*Acceptance:* same as S13 but for `mobile_no` instead of `email_id`, and the cron dropdown
excludes the payroll cron (`id != 1`).

---

## 5. Rare / edge-case user stories

**E1 — Non-Global user without settings menu access.**
As a **teaching-staff user** whose `accessType` has no enabled menu link for the `settings`
module, when I call any `/api/settings/setup/*` endpoint directly, `menuAuthForModule('settings')`
rejects the request before it reaches the loader/saver — the form never renders data and no
audit "View" row is written, because rejection happens in middleware, before
`loadSettingsSetupScreen` runs.

**E2 — Unauthenticated request to the setup API.**
As an anonymous caller (expired/missing JWT), any `/api/settings/setup/*` call is rejected by
`authMiddleware` with the standard 401 before `menuAuthForModule` or any settings code runs;
only `GET /api/settings/public` works without auth (feeds the login screen's institution
name/logo).

**E3 — Unknown screen slug.**
As a client sending an unrecognized `:screen` value (e.g. a stale bookmark or typo), both
`loadSettingsSetupScreen` and `saveSettingsSetupScreen` call `assertSettingsSetupScreen`, which
returns `{ error: 'Unknown settings setup screen' }`; the route handler turns this into **HTTP
400** with body `{ message: 'Unknown settings setup screen' }`. On the client, if the slug also
isn't a key in `SETTINGS_SCREEN_META`, `SettingsSetupPage` never even calls `load()` — it
short-circuits to the **"Unknown settings screen."** paragraph instead.

**E4 — Delete of an already-deleted or nonexistent row.**
As an admin who double-clicks **"Delete"** (or another session already deleted the row), the
`prisma.<table>.update({ where: { id } })` call throws (record not found) inside every
delete-branch's `try/catch` (`designationSetup.js`, `staffMasterSetup.js`,
`staffEduMasterSetup.js`, `lessonPlanSetup.js`, `signatureSetup.js`) — caught and turned into
`{ success: false, message: 'Please try again...' }` plus a `logSettingsSetup(..., 'Delete',
'Unsuccessful', ...)` audit row, rather than a 500. Note `approval`/`college`/`hospital`/
`budget`/`print-style`/`d-order`/`payroll-emailer`/`sms-cron` have **no per-row delete action at
all** in their UI (only bulk save-all-toggle patterns), so this race is specific to the six
screens with a `"Delete"` button (`designation`, `staff-master`, `staff-edu-master`,
`lesson-plan`, `signature`, and implicitly `print-setup`'s signature-role soft-delete pass which
has no user-facing delete button but the same soft-delete-then-recreate race window).

**E5 — Concurrent edits / soft-delete-then-recreate race.**
As two admins editing the same category/department grid simultaneously, each Save first
soft-deletes (`del:1 → del:0`) every currently-active row for that scope, then recreates/updates
rows from its own payload with `del:1`. If admin A's save runs between admin B's soft-delete and
recreate steps, admin B's save can resurrect (`del:1`) a row admin A just intentionally removed,
or admin A's save can wipe rows admin B just added — a classic last-writer-wins race inherent to
this soft-delete-before-recreate pattern (used identically in `designationSetup.js`,
`staffMasterSetup.js`, `staffEduMasterSetup.js`, `dOrderSetup.js`, `lessonPlanSetup.js` Type
branch, `signatureSetup.js`, and `print-setup`'s signature sub-rows). There is no optimistic
locking / version check anywhere in these services.

**E6 — Signature file upload rejected mid-save.**
As a payroll admin uploading an oversized (`> 2 * 1024 * 1024` bytes) or wrong-extension (not
`jpeg`/`jpg`/`gif`/`png`) signature image on `/settings/setup/signature`, `saveLegacyBinaryFile`
returns `{ error }`, and `saveSignatureSetup` immediately returns `{ success: false, message:
uploaded.error }` — **the entire save aborts**, including the soft-delete-restore pass already
executed on prior rows in the same loop iteration, meaning earlier rows in the same batch may
already be partially soft-deleted/restored while later rows (including the failing upload) never
get their new data written. The `try/catch` around delete elsewhere does not cover this path;
this is a genuine partial-write edge case visible directly in the loop structure of
`signatureSetup.js`.

**E7 — Print style file missing or unwritable.**
As an admin opening `/settings/setup/print-style` when `css/salary.css` doesn't exist yet under
`LEGACY_CIS_PATH` (e.g. fresh environment, path misconfigured), `loadPrintStyleSetup`'s
`fs.readFile` throws, is caught, and silently returns `content: ''` — the textarea just appears
empty, with no error shown to the user (no "file not found" message is ever surfaced). If the
directory is not writable (e.g. permissions, disk full) on Save, `fs.writeFile` throws, is
caught, and returns `{ success: false, message: 'Unable to save style file' }` — visible via the
outer `SetupAlerts` error banner.

**E8 — Payroll/SMS cron entry deleted or reassigned between load and save.**
As an admin who has the payroll/SMS cron form open while another process deletes or re-scopes
that `basic_cron_tb` row, `savePayrollEmailerSetup` / `saveSmsCronSetup` re-verify the row still
matches `PAYROLL_CRON_WHERE` / `SMS_CRON_WHERE` (`del:1` plus the id-scoping filter) before
writing; if it no longer matches, the save is rejected with **"Invalid payroll cron entry"** /
**"Invalid SMS cron entry"** instead of silently updating/creating a row outside the intended
scope.

**E9 — Lesson-plan `enableTopic` loose-type read.**
`mapTypeRow` in `lessonPlanSetup.js` checks `row.l_type === '1' || row.l_type === 1` — because
`l_type` is a VARCHAR column, only the exact string `'1'` (or, defensively, the number `1`)
counts as enabled; any other truthy-looking legacy value (`'Y'`, `'true'`, `' 1'` with
whitespace) written by the legacy PHP screen would read as **disabled** in the modern grid, a
possible parity mismatch if legacy ever wrote non-`'1'`/`'0'` values into that column.

**E10 — Salary Signature `enabled` reuses the `order` column.**
`mapRow` in `signatureSetup.js` derives `enabled: row.staff_order === 1` and, on save, writes
`staff_order: row.enabled ? 1 : 0` — there is **no independent ordering field** for signature
rows despite the column name; enabling a row and giving it a display order are the same legacy
column, so this screen cannot both order signatures and independently enable/disable more than
a binary 0/1 position.

**E11 — Print-setup role signature skipped silently.**
In `upsertRoleSignature` (`printSetupSetup.js`), a role sub-form with `!data.id` and both
`name` and `designation` blank is skipped entirely — no row is created and no error is shown —
so leaving all three role blocks empty on a **new** print page silently persists zero
`print_signature_tb` rows for that page, which is expected behavior but easy to mistake for a
bug when re-opening the page and seeing no signature rows despite the "Signature block"
checkbox being checked (`form.signature` is a display flag on `print_setup_tb`, independent of
whether any role rows actually exist).

**E12 — Network/API failure surfaces a generic message.**
As an admin whose request hits a network failure or a non-JSON/5xx response, both
`useSettingsSetupApi.load` and `.save` catch the exception and set a generic fallback message —
**"Unable to load settings form"** or **"Save failed"** respectively (`err.response?.data?.message`
takes precedence when the server did respond with JSON) — shown via the outer `SetupAlerts`
error banner; `data` is cleared to `null` on a load failure (form disappears / shows the "No
form available" fallback), but a save failure leaves whatever `data` was already loaded intact
(no full-form wipe on save failure).

**E13 — Zero-date relevance.** None of the 14 Settings screens documented here expose a date
field directly (`created_dt`/`updated_dt` audit columns are write-only from these forms, never
displayed or edited) — so the project's general zero-date (`0000-00-00`) parity concern from
`CLAUDE.md` does not surface as a user-facing edge case anywhere in this module.

---

## 6. Future / predicted user stories

### Future (not implemented)

Per `mobile.md` §6 ("Feature-by-feature mapping") and §6 v1 principle: *"Admin/setup screens
(`exam_batch.php` style configuration, fee setup, etc.) stay on the web app — they're
desk/desktop workflows, not mobile ones."* Settings is explicitly the archetype of that
excluded category — every one of the 14 screens here is an admin configuration grid, not a
read-mostly or self-service screen a phone user would need. Honestly, **no mobile Settings app
is planned**; `mobile.md` names Dashboard, Attendance, Fees, Exam results, Library, and
Staff/Student directory as the v1 mobile scope (§6, §9 Phase 1–3), and Settings appears nowhere
in that list.

The following are plausible, honestly-speculative extrapolations of the current *web* pattern,
not implied by any concrete backlog item:

- *(Future — not implemented, speculative)* **Audit-log viewer for settings changes.** Every
  Settings load/save already writes to `log_tb` via `logSettingsSetup` with page name,
  operation, status, description, member, IP, and timestamp — the data needed for a "who
  changed this designation order and when" screen already exists. A read-only
  `/settings/setup/audit-log` screen filtered to the settings `.php` page names would be a
  natural, low-risk addition reusing existing data, but no such screen, route, or service
  function exists today.
- *(Future — not implemented, speculative)* **Role-scoped settings visibility.** Today,
  authorization is all-or-nothing per module via `menuAuthForModule('settings')` — any user with
  a settings menu link can reach any of the 14 screens. A finer-grained per-screen permission
  model (e.g. payroll staff can reach `signature`/`payroll-emailer` but not `designation`) would
  extend the existing `authentication_tb` ⋈ `basic_admin_menu_tb` pattern, but nothing in the
  current menu-auth middleware or `basic_admin_menu_tb` schema usage suggests per-screen (as
  opposed to per-module) enforcement is planned.
- *(Future — not implemented, speculative)* **Optimistic locking on the soft-delete-recreate
  grids.** Given the concurrent-edit race documented in E5, a natural hardening (version column
  or `updated_dt` compare-and-swap before the soft-delete pass) is a reasonable next step, but
  is not hinted at anywhere in the current code or `mobile.md`.
- Explicitly **not** future work per `mobile.md` §2 ("Non-goals"): no new REST endpoints, no PHP
  bridge changes, and no mobile client for this module.

---

## 7. Traceability table

| Story | Client file(s) | Server route / service | Table(s) |
|---|---|---|---|
| S1, S2 | `client/src/pages/settings/setup/DesignationSetup.jsx` | `POST /api/settings/setup/designation/load\|save` → `server/src/services/settings/setup/designationSetup.js` | `staff_dept_master`, `staff_desg_master` |
| S3 | `client/src/pages/settings/setup/DOrderSetup.jsx` | `.../d-order/load\|save` → `server/src/services/settings/setup/dOrderSetup.js` | `staff_desg_master` (read), `staff_desg_order` (write) |
| S4 | `client/src/pages/settings/setup/StaffMasterSetup.jsx` | `.../staff-master/load\|save` → `server/src/services/settings/setup/staffMasterSetup.js` | `edu_setup_tb` |
| S5 | `client/src/pages/settings/setup/StaffEduMasterSetup.jsx` | `.../staff-edu-master/load\|save` → `server/src/services/settings/setup/staffEduMasterSetup.js` | `edu_setup_tb` (dropdowns), `edu_allied_tb` (rows) |
| S6 | `client/src/pages/settings/setup/ApprovalSetup.jsx` | `.../approval/load\|save` → `server/src/services/settings/setup/approvalSetup.js` | `approval_tb` |
| S7 | `client/src/pages/settings/setup/CollegeSmsSetup.jsx` | `.../college/load\|save` → `server/src/services/settings/setup/collegeSmsSetup.js` | `sms_config_tb` |
| S8 (hospital) | `client/src/pages/settings/setup/HospitalSmsSetup.jsx` | `.../hospital/load\|save` → `server/src/services/settings/setup/hospitalSmsSetup.js` | `sms_config_hospital` |
| S8 (budget) | `client/src/pages/settings/setup/BudgetSmsSetup.jsx` | `.../budget/load\|save` → `server/src/services/settings/setup/budgetSmsSetup.js` | `sms_config_task` |
| S9 | `client/src/pages/settings/setup/PrintSetupSetup.jsx` | `.../print-setup/load\|save` → `server/src/services/settings/setup/printSetupSetup.js` | `print_setup_tb`, `print_signature_tb` |
| S10 | `client/src/pages/settings/setup/PrintStyleSetup.jsx` | `.../print-style/load\|save` → `server/src/services/settings/setup/printStyleSetup.js` | none (filesystem: `<LEGACY_CIS_PATH>/css/salary.css`) |
| S11 | `client/src/pages/settings/setup/LessonPlanSetup.jsx` | `.../lesson-plan/load\|save` → `server/src/services/settings/setup/lessonPlanSetup.js` | `lesson_plan_setup` |
| S12 | `client/src/pages/settings/setup/SignatureSetup.jsx` | `.../signature/load\|save` → `server/src/services/settings/setup/signatureSetup.js` (+ `server/src/services/web/webUpload.js` `saveLegacyBinaryFile`) | `signature_setup` |
| S13 | `client/src/pages/settings/setup/PayrollEmailerSetup.jsx` | `.../payroll-emailer/load\|save` → `server/src/services/settings/setup/payrollEmailerSetup.js` | `basic_cron_tb`, `basic_cron_email` |
| S14 | `client/src/pages/settings/setup/SmsCronSetup.jsx` | `.../sms-cron/load\|save` → `server/src/services/settings/setup/smsCronSetup.js` | `basic_cron_tb`, `basic_cron_email` |
| E1, E2 | — (all screens) | `server/src/middleware/auth.js` (`authMiddleware`), `server/src/middleware/menuAuth.js` (`menuAuthForModule('settings')`), wired in `server/src/routes/settings.js` | `authentication_tb`, `basic_admin_menu_tb`, `web_account_setup` |
| E3 | `client/src/pages/settings/SettingsSetupPage.jsx` | `server/src/services/settings/settingsSetup.js` (`assertSettingsSetupScreen`) | — |
| E4, E5 | Every list/grid screen in section 3 | Respective `save*Setup.js` files (soft-delete-then-recreate pattern) | Respective tables above |
| E6 | `client/src/pages/settings/setup/SignatureSetup.jsx` | `server/src/services/settings/setup/signatureSetup.js`, `server/src/services/web/webUpload.js` | `signature_setup` |
| E7 | `client/src/pages/settings/setup/PrintStyleSetup.jsx` | `server/src/services/settings/setup/printStyleSetup.js` | filesystem only |
| E8 | `client/src/pages/settings/setup/PayrollEmailerSetup.jsx`, `SmsCronSetup.jsx` | `server/src/services/settings/setup/payrollEmailerSetup.js`, `smsCronSetup.js` | `basic_cron_tb` |
| E9 | `server/src/services/settings/setup/lessonPlanSetup.js` (`mapTypeRow`) | same | `lesson_plan_setup` |
| E10 | `server/src/services/settings/setup/signatureSetup.js` (`mapRow`) | same | `signature_setup` |
| E11 | `server/src/services/settings/setup/printSetupSetup.js` (`upsertRoleSignature`) | same | `print_signature_tb` |
| E12 | `client/src/pages/settings/useSettingsSetupApi.js` | all `/api/settings/setup/*` routes | — |
| E13 | — | — | — (no date fields in this module's forms) |
| Audit trail (all stories) | — | `server/src/services/settings/setupAudit.js` (`auditFields`, `logSettingsSetup`) → `server/src/services/logService.js` (`insertLog`) | `log_tb` |
| Institution branding (context, not a setup screen) | shell/login consumers of `GET /api/settings/public`, `GET /api/settings/basic` | `server/src/routes/settings.js` | `basic_setup_tb` |

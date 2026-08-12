# 06 — Staff

## 1. Module overview

**Purpose.** The Staff module is the system of record for every employee (teaching and
non-teaching): admission/registration (creates a login account), full profile
(personal/job/contact/registration/address/bank), education/experience/awards/skills
records, photo & certificate attachments, ID cards, transport, org-structure/org-chart,
inspection (DCI/TNMGRMU regulatory) reports, publication reports, salary notes, and
several setup screens (designations, attachment categories, org-chart config, inspection
config, transport setup, login help).

**Primary actors**
- **HR / admin office staff** — register new staff (`StaffAdmission.jsx`), edit
  profiles, manage attachments/certificates, run appointment-order and ID-card prints.
- **Registrar / compliance office** — generate DCI/TNMGRMU inspection, affidavit, and
  publication reports for regulatory submissions.
- **Payroll-adjacent staff** — salary note prints, transport allocation.
- **Department heads / setup admins** — designation edits, org-chart configuration,
  inspection configuration, attachment category/sub-category/setup screens.
- **Reporting staff** — ad-hoc staff export report builder (`StaffReport.jsx`).

**Legacy PHP files this module replaces** (see `client/src/pages/staff/staffModuleMeta.js`):

| Legacy file | Modern screen |
|---|---|
| `staff_profile_edit.php` | `/staff` (`StaffList.jsx`) + `/staff/:id` edit tab |
| `staff_profile_add.php` | `/staff/new` (`StaffAdmission.jsx`) |
| `staff_profile_export.php` | `/staff/reports` (`StaffReport.jsx`) |
| `staff_attachments.php` | `/staff/certificates` and Attachments tab on profile |
| `staff_designation_edit.php` | `/staff/setup/designation-edit` |
| `staff_attachment_category.php` | `/staff/setup/attachment-category` |
| `staff_attachment_scategory.php` | `/staff/setup/attachment-scategory` |
| `staff_attachment_setup.php` | `/staff/setup/attachment-setup` |
| `org_chart_config.php` | `/staff/setup/org-chart-config` |
| `inspection_config.php` | `/staff/setup/inspection-config` |
| `inspection_name.php` | `/staff/setup/inspection-name` |
| `staff_transport_setup.php` | `/staff/setup/transport-setup` |
| `staff_help.php` | `/staff/setup/login-help` |
| `staff_appoint_order.php` | `/staff/appoint-order` |
| `staff_salary_note.php` | `/staff/salary-note` |
| `staff_id_card.php` | `/staff/id-card` |
| `staff_photo_empty.php` | `/staff/photo-empty` |
| `staff_photo_upload.php` | `/staff/photo-upload` |
| `org_structure.php` | `/staff/org-structure` |
| `staff_transport.php` | `/staff/transport` |
| `staff_photos.php` | `/staff/photos` |
| `inspection_details.php` | `/staff/inspection-details` |
| `staff_attendance_sign_with_photo.php` | `/staff/inspection-attn-sheet` |
| `inspection_attn_certificate.php` | `/staff/inspection-attn-cert` |
| `staff_dci_report.php` | `/staff/dci-report` |
| `staff_tnmgr_report.php` | `/staff/tnmgr-report` |
| `staff_affidavit_dci.php` | `/staff/affidavit-dci` |
| `staff_affidavit_TNMGRMU.php` | `/staff/affidavit-tnmgrmu` |
| `staff_attach_print.php` | `/staff/attach-print` |
| `dci_staff_publication_report.php` | `/staff/publication-dci` |
| `tnmgrmu_staff_publication_report.php` | `/staff/publication-tnmgrmu` |

Client: `client/src/pages/staff/StaffHub.jsx`, `StaffList.jsx`, `StaffAdmission.jsx`,
`StaffProfile.jsx`, `StaffProfileSections.jsx` (shared tab building blocks),
`StaffScreenPage.jsx` (dispatcher for `STAFF_SCREEN_META`), `StaffSetupPage.jsx`
(dispatcher for `STAFF_SETUP_META`), `StaffReport.jsx`, `useStaffModuleApi.js`
(`useStaffSetupApi` + `useStaffScreenApi`).
Server: `server/src/routes/staff.js` → `server/src/services/staff/*.js`
(`staffAdmission.js`, `staffProfile.js`, `staffProfileExtras.js`, `staffStatus.js`,
`staffAttachments.js`, `staffSearch.js`, `staffCategories.js`, `staffReport.js`,
`staffModuleScreens.js`, `staffModuleSetup.js`, `staffShared.js`,
`screens/`, `setup/`).

Core table: `staff_profile_tb` (`del=1` active, house rule). Department/designation
reference tables: `staff_dept_master`, `staff_desg_master`.

---

## 2. Screen inventory

| Route | Component | Legacy `.php` |
|---|---|---|
| `/staff` | `client/src/pages/staff/StaffList.jsx` | `staff_profile_edit.php` |
| `/staff/new` | `client/src/pages/staff/StaffAdmission.jsx` | `staff_profile_add.php` |
| `/staff/:id` | `client/src/pages/staff/StaffProfile.jsx` | `staff_profile_edit.php` |
| `/staff/reports` | `client/src/pages/staff/StaffReport.jsx` | `staff_profile_export.php` |
| `/staff/certificates` | `StaffScreenPage.jsx` (`type: certificates`) | `staff_attachments.php` |
| `/staff/hub` | `client/src/pages/staff/StaffHub.jsx` | n/a (module hub) |
| `/staff/appoint-order` | `StaffScreenPage.jsx` (`type: staff-search-report`) | `staff_appoint_order.php` |
| `/staff/salary-note` | `StaffScreenPage.jsx` (`type: date-category-report`) | `staff_salary_note.php` |
| `/staff/id-card` | `StaffScreenPage.jsx` (`type: staff-search-report`) | `staff_id_card.php` |
| `/staff/photo-empty` | `StaffScreenPage.jsx` (`type: category-report`) | `staff_photo_empty.php` |
| `/staff/photo-upload` | `StaffScreenPage.jsx` (`type: upload`) | `staff_photo_upload.php` |
| `/staff/org-structure` | `StaffScreenPage.jsx` (`type: org-structure`) | `org_structure.php` |
| `/staff/transport` | `StaffScreenPage.jsx` (`type: transport-grid`) | `staff_transport.php` |
| `/staff/photos` | `StaffScreenPage.jsx` (`type: auto-report`) | `staff_photos.php` |
| `/staff/inspection-details` | `StaffScreenPage.jsx` (`type: inspection-grid`) | `inspection_details.php` |
| `/staff/inspection-attn-sheet` | `StaffScreenPage.jsx` (`type: attn-sheet`) | `staff_attendance_sign_with_photo.php` |
| `/staff/inspection-attn-cert` | `StaffScreenPage.jsx` (`type: staff-search-report`) | `inspection_attn_certificate.php` |
| `/staff/dci-report` | `StaffScreenPage.jsx` (`type: dept-report`) | `staff_dci_report.php` |
| `/staff/tnmgr-report` | `StaffScreenPage.jsx` (`type: dept-report`) | `staff_tnmgr_report.php` |
| `/staff/affidavit-dci` | `StaffScreenPage.jsx` (`type: staff-search-report`) | `staff_affidavit_dci.php` |
| `/staff/affidavit-tnmgrmu` | `StaffScreenPage.jsx` (`type: staff-search-report`) | `staff_affidavit_TNMGRMU.php` |
| `/staff/attach-print` | `StaffScreenPage.jsx` (`type: staff-search-report`) | `staff_attach_print.php` |
| `/staff/publication-dci` | `StaffScreenPage.jsx` (`type: dept-report`) | `dci_staff_publication_report.php` |
| `/staff/publication-tnmgrmu` | `StaffScreenPage.jsx` (`type: dept-report`) | `tnmgrmu_staff_publication_report.php` |
| `/staff/setup/designation-edit` | `client/src/pages/staff/StaffSetupPage.jsx` | `staff_designation_edit.php` |
| `/staff/setup/attachment-category` | `StaffSetupPage.jsx` | `staff_attachment_category.php` |
| `/staff/setup/attachment-scategory` | `StaffSetupPage.jsx` | `staff_attachment_scategory.php` |
| `/staff/setup/attachment-setup` | `StaffSetupPage.jsx` | `staff_attachment_setup.php` |
| `/staff/setup/org-chart-config` | `StaffSetupPage.jsx` | `org_chart_config.php` |
| `/staff/setup/inspection-config` | `StaffSetupPage.jsx` | `inspection_config.php` |
| `/staff/setup/inspection-name` | `StaffSetupPage.jsx` | `inspection_name.php` |
| `/staff/setup/transport-setup` | `StaffSetupPage.jsx` | `staff_transport_setup.php` |
| `/staff/setup/login-help` | `StaffSetupPage.jsx` | `staff_help.php` |

---

## 3. Pixel-level flow per screen

### 3.1 `/staff` — Staff search (`StaffList.jsx`)

DOM order:
1. Breadcrumbs **Home → Staff → Search**.
2. `PageHeader` title **"Staff"**, subtitle *"Find staff by name, staff ID, or category"*.
3. Actions: **Module Hub**, **Export Report** (→ `/staff/reports`), **New Profile**
   (`fa fa-plus` → `/staff/new`).
4. Search-mode tabs (`MODES` array): **Name** (`fa fa-user`), **Staff ID** (`fa fa-id-badge`),
   **Category** (`fa fa-users`), URL-driven via `?by=`.
5. Name/Staff ID modes: label matches mode (*"Name"* or *"Staff ID"*), text input
   `id="staff-q"` (placeholder *"Staff name"* or *"e.g. ST001, ST002"*), **Search** button
   (*"Searching…"* while busy); hint text differs by mode (*"Matches name, initial, or
   staff ID."* vs *"Enter one staff ID, or several separated by commas."*).
6. Category mode: label **"Category"**, `<select id="staff-category">` populated from
   `GET /api/staff/categories`, option `Select a category…`; hint *"Lists every active
   staff member in the selected category."*
7. Results `DataTable`: columns **Staff ID** (primary, sortable, searchField),
   **Name**, **Designation**, **Category** (`jobCategory`, hidden on mobile), **Status**
   badge — green **Active** vs grey **Relieved** (`row.resigned`). Row click →
   `/staff/:id`. Empty states mirror the student list pattern: pre-search icon
   `fa fa-search` *"Search for staff"*; post-search-empty icon `fa fa-user-times` *"No
   staff found"*.

Data: `GET /api/staff/categories` on mount; `GET /api/staff/search?by=name|staff_id|category&q=`
on submit. A single match auto-navigates to `/staff/:id`.

### 3.2 `/staff/new` — Staff Admission (`StaffAdmission.jsx`)

Reference data: `GET /api/staff/admission/options` (titles, blood groups, religions,
communities, categories, departments, levels, banks, states,
`education.regCouncils`, `lastStaffId`); `GET /api/staff/admission/designations?departmentId=`
loaded reactively whenever `form.departmentId` changes.

Left rail `FormSectionNav` over 10 sections (`SECTIONS`): Staff Details, Personal
Details, Contact, Job Details, Council Registration, Permanent Address, Education,
Experience, Activities & Skills, Bank Details.

Fields per section (exact labels):

- **Staff Details** — *Staff ID* * (required, `maxLength 7`, `onBlur` triggers
  `checkStaffId` → `GET /api/staff/admission/check-id?staffId=`, shows *"Available"*
  (green) / *"Not available"* (red); a **"Check availability"** link button also
  triggers it manually; hint *"Last Staff ID is **{options.lastStaffId}**"*), *Title* *
  (radio over `options.titles` fallback `['Dr','Mr','Mrs','Ms']`), *Staff Name* *
  (required, maxLength 155), *Initial*.
- **Personal Details** — *Gender* * (radio Male/Female/Transgender), *Date of Birth*
  (date), *Blood Group* (select), *Religion* (select), *Community* (select), *Caste*,
  *Marital Status* (radio Unmarried/Married — flips the Contact-section father/spouse
  label).
- **Contact** — label is **"Father's name"** normally, **"Spouse's name"** when
  `maritalStatus === 'Married'`; *Mobile 1*, *Mobile 2*, *Email*.
- **Job Details** — *Date of Joining* (date, defaults to today), *Category* (select,
  `options.categories`), *Department* (select, `options.departments` — changing it
  clears `designationId` and refetches designations), *Designation* (select, populated
  from the department-scoped `designations` fetch), *Levels* (multi-select as pill
  checkboxes over `options.levels`, toggled via `toggleLevel`).
- **Dental Council Registration** — *Reg. No.*, *Reg. Date* (date), *State Dental
  Council* (select, `options.education.regCouncils`), *Aadhar No*, *PAN No.*
- **Permanent Address** — *Door No.*, *Street*, *Post*, *Taluk*, *District*, *State*
  (select, `options.states`), *Pincode*.
- **Educational Qualification** — `EducationTab` (from `StaffProfileSections.jsx`,
  `variant="admission"`, embedded, add/remove rows).
- **Work Experience** — `ExperienceTab` (same pattern).
- **Activities & Skills** — two side-by-side `SkillsTab` instances: "Extension
  Activities" (`groupKeys=['extra_curricular']`) and "Add-on Skill Sets"
  (`groupKeys=['extra_skills']`), languages hidden (`showLanguages={false}`).
- **Bank Details** — *A/c No.*, *A/c Name*, *Bank Name* (select, `options.banks`),
  *Branch*, *IFSC Code*, *PF A/c No.*

Footer `FormActionBar`: note *"Fields marked * are required."*; buttons **Cancel**
(→ `/staff`) and **Create New Profile** (`btn-primary`, disabled while saving, while
`idStatus === 'taken'`, or once credentials have already been created).

**Save call**: `POST /api/staff` with the form plus `{education, experience,
activities}` from `records` (built by `buildRecordsForm`) →
`server/src/services/staff/staffAdmission.js::createStaffAdmission`. Server
validation: `staffId, staffName, jobCategory, departmentId, and designationId are
required`; `Staff ID already exists`. On success (`201`), if the response includes a
`tempPassword`, the client shows a success banner:
*"Staff **{staffId}** created successfully. Temp password: **{tempPassword}** · PIN:
**{tempPin}**"* with an **Open profile** button (→ `/staff/{profileId}`) — i.e.
admission also provisions a login account (`web_account_setup`-style credentials),
distinct from the student flow which has no login side-effect.

### 3.3 `/staff/:id` — Staff Profile (`StaffProfile.jsx`)

Loads `GET /api/staff/{id}` (404 → `Staff not found`) and, best-effort,
`GET /api/staff/profile-options` (falls back to `{}` silently on failure — profile
viewing must not hard-fail just because dropdown option lookups fail).

Hero: `UserAvatar`, name, status pill **Active** vs **Resigned** (`profile.resigned`,
server-computed — unlike the student "zero-date" client-side check, this flag comes
pre-computed from the API). Facts: Staff ID, Role (`currentRoleLabel` /
`designationName` / `jobCategoryName`), Department, Category. Header actions:
**Designation Edit** (→ `/staff/setup/designation-edit`, passes `state={{staffId:
profile.id}}`), **Attendance** (→ `/attendance/staff?staffId=`), **Search** (→ `/staff`).

Tab bar — 9 tabs: **Overview**, **Edit**, **Education**, **Experience**, **Awards**,
**Skills**, **Attachments**, **Status**, **Legacy Form**.

- **Overview** — `OverviewTab` (from `StaffProfileSections.jsx`), read-only summary.
- **Edit** — `PersonalEditTab`; **Save Profile** button (`btn-primary`) →
  `PUT /api/staff/:id`.
- **Education / Experience / Awards / Skills** (the `RECORD_TABS` set) — respectively
  `EducationTab`, `ExperienceTab`, `AwardsTab`, `SkillsTab`; shared **Save Records**
  button → `PUT /api/staff/:id/records`.
- **Attachments** — `client/src/components/staff/StaffAttachments.jsx`
  (`staffRowId={id}`).
- **Status** — `FormSection` "Transfer / Relieve", description *"Set a relieving date
  to mark this staff member as resigned. Leave blank to keep them active."*:
  **Relieving Date** (date), **Resignation Letter** (file input,
  `accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"`, shows *"Current: {link}"* when one
  already exists and no new file is staged), **Relieving Reason** (textarea, 4 rows).
  Footer note *"Current status: **Active/Resigned**"*; **Update Status** button.
- **Legacy Form** — on first visit calls `GET /api/staff/{id}/legacy-form`, which
  the server answers with HTTP `410 Gone` and a JSON `note`
  (*"Legacy PHP staff form removed. Use native profile APIs instead."*); the client
  shows that note (or a fallback *"Use the tabs on this page to manage this staff
  profile."*) in an info alert — this tab intentionally documents the removal of the
  PHP bridge for this screen rather than embedding a legacy form.

**Save calls**:
- `PUT /api/staff/:id` (Edit tab) → `updateStaffProfile`
  (`server/src/services/staff/staffProfile.js`). Validation: `Staff not found` (404),
  `Staff ID already exists` (duplicate `staffId` check), `No fields to update`.
- `PUT /api/staff/:id/records` (record tabs) → `saveProfileRecords`
  (`server/src/services/staff/staffProfileExtras.js`); errors return `{error}` with
  404 for `Staff not found`, else 400.
- `PATCH /api/staff/:id/status` → `updateStaffStatus`
  (`server/src/services/staff/staffStatus.js`). Validation: `Staff not found`, an
  uploaded resignation-letter error bubbles through (`if (uploaded.error) return
  {error: uploaded.error}`), `No status fields to update`. The client base64-encodes
  the resignation-letter file (`readFileAsBase64`) and sends it as
  `releavingAttachmentUpload: {filename, dataBase64}` alongside the other status
  fields.

### 3.4 `/staff/reports` — Staff Export Report (`StaffReport.jsx`)

Same builder pattern as the Student report (`client/src/pages/students/StudentReport.css`
reused). Reference data: `GET /api/staff/reports/fields`, `GET /api/staff/reports/filters`
(loaded together, not IndexedDB-cached unlike the student version). Filters: *Category*
(`categoryId`), *Report title*, *Print options* (College header / Serial no. column
checkboxes), *Show* (Regular/Discontinue/All). Column picker: same grouped
checklist-with-search + custom-field-add + ordered-list-with-↑/↓/× pattern as
`StudentReport.jsx`. Generate guard: *"Please select at least one field."* Save/generate
call: `POST /api/staff/reports/generate` → `staffReport.js`.

### 3.5 `/staff/certificates` and the Attachments tab — Certificates

`type: certificates` on `StaffScreenPage.jsx`; search box labelled **"Staff ID or
name"** with **Find** (`runSearch`, min-length gate similar to the student photo-upload
search). Upload flow posts to `POST /api/staff/screens/certificates/upload` via
`uploadCertificatesFile` (`staffModuleScreens.js`) — a dedicated endpoint distinct from
the generic per-staff `attachments/upload` route, matching legacy `staff_attachments.php`
which handles named certificate categories rather than free-form attachment rows.

### 3.6 `/staff/appoint-order`, `/staff/id-card`, `/staff/inspection-attn-cert`,
`/staff/affidavit-dci`, `/staff/affidavit-tnmgrmu`, `/staff/attach-print`
— `type: staff-search-report`

Shared "staff search" filter block (`staffSearch` JSX in `StaffScreenPage.jsx`, lines
~80-100): label **"Staff ID or name"**, text input + **Find**/Search-style button
(`btn-outline-primary`), reused verbatim across all six screens — each maps to a
different legacy print/report (appointment order letter, ID card, inspection attendance
certificate, DCI/TNMGRMU affidavits, attachment print) but shares the identical
search-and-generate UI shell, only the resulting `reportHtml`/print target differs.

### 3.7 `/staff/salary-note` — `type: date-category-report`

Filters: **From** date, **To** date, **Category** select, **Letter Date** (date) — used
to print salary confirmation notes for a date range / category.

### 3.8 `/staff/photo-empty` — `type: category-report`

Filter: **Category** select; lists staff missing a profile photo for that category
(mirrors the student `photo-empty` screen).

### 3.9 `/staff/photo-upload` — `type: upload`

Same two-part pattern as students: single-staff search-then-upload (label **"Staff ID
or name"**, **Find**, then **Photo (PNG/JPG, any file name)** file input + **Save**) and
a bulk multi-file uploader (**"PNG files"** label, multi-file input, **Upload** button)
where the filename is expected to be the staff ID.

### 3.10 `/staff/org-structure` — `type: org-structure`

Filter row: **Department** select, **Type** select, plus a `&nbsp;`-labelled action
slot; renders the department's reporting hierarchy as a tree/report (`reportHtml`).

### 3.11 `/staff/transport` — `type: transport-grid`

Filter: **Mode** select; a grid assigning staff to transport routes/vehicles
(distinct from the setup-side `/staff/setup/transport-setup`, which defines the routes
themselves).

### 3.12 `/staff/photos` — `type: auto-report`

No manual filter form — loads and renders automatically on screen entry (a straight
photo-roster report).

### 3.13 `/staff/inspection-details` — `type: inspection-grid`

Field: **Inspection Department** * (required, red asterisk) plus a grid of inspection
detail rows — feeds DCI/TNMGRMU regulatory inspection documentation.

### 3.14 `/staff/inspection-attn-sheet` — `type: attn-sheet`

Generates an attendance-with-photo signature sheet for inspection visits (legacy
`staff_attendance_sign_with_photo.php`) — filter + **Update** submit button
(`btn-primary`).

### 3.15 `/staff/dci-report`, `/staff/tnmgr-report`, `/staff/publication-dci`,
`/staff/publication-tnmgrmu` — `type: dept-report`

Shared filter: **Department** select (`div.col-md-4`); each renders a different
regulatory-body (DCI vs TNMGRMU) staff or publication roster for that department.

### 3.16 Setup screens (`StaffSetupPage.jsx`, `STAFF_SETUP_META`)

All setup screens share the `CrudRows` table building block: an editable grid where
each row is either a plain text `<input>`, a `type: 'checkbox'`, or — for reorderable
tables — a drag-handle + read-only `order` column driven by `useDragReorder`
(`client/src/hooks/useDragReorder.js`). Row actions: **Add row** (`btn-outline-secondary`)
and, per row, a **trash icon** delete button (`fa fa-trash`, title *"Delete row"*).

- **`/staff/setup/designation-edit`** (`staff_designation_edit.php`) — can be deep-linked
  from a staff profile's **Designation Edit** header action with `state={{staffId}}`,
  pre-scoping the edit to that staff member.
- **`/staff/setup/attachment-category`** / **`attachment-scategory`** / **`attachment-setup`**
  — three-level hierarchy (category → sub-category → per-category setup) mirroring the
  three legacy PHP files, configuring the attachment types shown on the Certificates /
  Attachments tab.
- **`/staff/setup/org-chart-config`** — uses `DesignationSelect` (a `<select>` with
  `<optgroup>` per department, built via `mergeGroupOption` so a currently-selected value
  not in the loaded groups is still shown) for **positions** and **reports-to**
  relationships (`OrgChartPositionsTable`), feeding `/staff/org-structure`.
- **`/staff/setup/inspection-config`** / **`inspection-name`** — configure inspection
  types/names used by `/staff/inspection-details` and the attendance-sign sheet.
- **`/staff/setup/transport-setup`** — defines transport routes/modes consumed by
  `/staff/transport`.
- **`/staff/setup/login-help`** — legacy `staff_help.php`; staff-facing login help
  content editor.

**Setup save/load pattern** (`useStaffSetupApi`): `POST /api/staff/setup/:screen/load`
with `{fields, query}`; `POST /api/staff/setup/:screen/save` with `{fields}` — response
`success: false` surfaces `res.data.message || 'Save failed'` as an error; otherwise a
`message` becomes a transient (4s) success notice. Dispatched server-side by
`server/src/services/staff/staffModuleSetup.js` (`loadStaffSetupScreen` /
`saveStaffSetupScreen` / `staffSetupMore`).

---

## 4. Primary user stories

**US-1 — Search for staff by name, ID, or category**
As **HR/admin office staff**, I want to switch between Name / Staff ID / Category modes
on `/staff` and search, so that I can quickly find the right employee record.
*Acceptance criteria:* `GET /api/staff/search?by=name|staff_id|category&q=` is called
per submit; a single result auto-navigates to `/staff/:id`; the Status column shows
Active (green) / Relieved (grey) from `row.resigned`.

**US-2 — Register a new staff member**
As **HR staff**, I want to fill Staff Details through Bank Details, confirm the Staff ID
is available, and click **Create New Profile**, so that a `staff_profile_tb` row and
login credentials are created together.
*Acceptance criteria:* Staff ID, Title, Staff Name, and Gender are required; `onBlur`
on Staff ID calls `check-id` and disables submission while `idStatus === 'taken'`;
server rejects with `staffId, staffName, jobCategory, departmentId, and designationId
are required` or `Staff ID already exists`; on success the temp password/PIN banner is
shown exactly once (submit disables once `createdCreds` is set, preventing a duplicate
POST).

**US-3 — Edit a staff member's personal details**
As **HR staff**, I want to open the **Edit** tab on a staff profile, change fields, and
click **Save Profile**, so the change is persisted.
*Acceptance criteria:* `PUT /api/staff/:id`; duplicate Staff ID rejected with `Staff ID
already exists`; no-op save rejected with `No fields to update`.

**US-4 — Maintain education/experience/awards/skills records**
As **HR staff**, I want to add/edit/remove rows on the Education, Experience, Awards, and
Skills tabs and click **Save Records**, so the staff member's qualification history stays
current.
*Acceptance criteria:* `PUT /api/staff/:id/records` sends the full `records` shape;
`Staff not found` returns 404 if the id is stale.

**US-5 — Relieve/resign a staff member with a resignation letter**
As **HR staff**, I want to set a Relieving Date, attach the resignation letter, add a
Relieving Reason, and click **Update Status**, so the staff record reflects resignation
without deleting it.
*Acceptance criteria:* `PATCH /api/staff/:id/status`; the file is base64-encoded and
sent as `releavingAttachmentUpload`; an upload failure is surfaced via the same
`{error}` path as any other status validation failure; the status pill flips to
"Resigned".

**US-6 — Manage staff certificates/attachments**
As **HR staff**, I want to search a staff member and upload their certificate files on
`/staff/certificates` (or the profile's Attachments tab), so their document catalog stays
complete for compliance reporting.
*Acceptance criteria:* uploads post to `POST /api/staff/screens/certificates/upload`
(bulk certificate screen) or the per-staff `/api/staff/:id/attachments/upload` route
(profile tab), depending on entry point.

**US-7 — Print an appointment order / ID card / affidavit for a staff member**
As **admin/compliance staff**, I want to search by Staff ID or name on any of the
`staff-search-report` screens and generate the corresponding printable document, so I
can produce appointment letters, ID cards, or DCI/TNMGRMU affidavits on demand.
*Acceptance criteria:* all six screens share the same search UI; each produces its own
`reportHtml`/print target per legacy `.php` counterpart.

**US-8 — Run a department-scoped DCI/TNMGRMU or publication report**
As the **registrar/compliance office**, I want to pick a Department and generate the
DCI, TNMGR, or publication roster, so I can submit it to the regulatory body.
*Acceptance criteria:* the Department filter drives `dept-report` screens
(`dci-report`, `tnmgr-report`, `publication-dci`, `publication-tnmgrmu`) consistently.

**US-9 — Build and export a custom staff report**
As **reporting staff**, I want to filter by Category/Show, tick fields, reorder columns,
and export, so I get exactly the staff data I need in print or spreadsheet form.
*Acceptance criteria:* mirrors student report US-10 — zero fields blocks generation with
*"Please select at least one field."*

**US-10 — Configure designations, attachment categories, and org-chart positions**
As a **setup admin**, I want to add/edit/reorder/delete rows in the various
`STAFF_SETUP_META` CRUD grids (designation edit, attachment category/sub-category/setup,
org-chart config, inspection config/name, transport setup, login help), so the
dropdowns and structures used across the rest of the Staff module stay accurate.
*Acceptance criteria:* `POST /api/staff/setup/:screen/load|save`; drag-and-drop
reordering only applies where `onReorder` is wired and an `order` column exists, in
which case that column becomes read-only client-side.

**US-11 — Jump from a staff profile straight into Designation Edit**
As **HR staff**, I want to click **Designation Edit** from a staff profile's header
action, so the setup screen opens pre-scoped to that staff member instead of making me
search again.
*Acceptance criteria:* the link passes React Router `state={{staffId: profile.id}}` to
`/staff/setup/designation-edit`.

---

## 5. Rare / edge-case user stories

**US-E1 — Duplicate Staff ID at admission**
Submitting a Staff ID already in use (even after a client-side availability check the
user ignored/skipped) is rejected server-side with **"Staff ID already exists"** —
the availability check is advisory, not the sole guard; `createStaffAdmission` performs
its own dup lookup at save time.

**US-E2 — Duplicate Staff ID on profile edit**
Editing an existing staff member's `staffId` field to a value used by a different
active row fails with **"Staff ID already exists"** — same duplicate-key guard pattern
as the student profile edit.

**US-E3 — Staff ID check-availability network failure**
If `GET /api/staff/admission/check-id` throws, the client swallows the error and leaves
`idStatus` as `null` (`catch { setIdStatus(null); }`) — neither "available" nor "taken"
badge is shown, and submission is **not** blocked purely by the failed check (only an
explicit `taken` result blocks submit), so a transient network blip during availability
checking doesn't lock out a legitimate admission.

**US-E4 — Profile-options fetch failure doesn't block viewing a profile**
`StaffProfile.jsx` wraps its `GET /api/staff/profile-options` call in its own
`try/catch` and falls back to `setOptions({})` — a broken dropdown-options endpoint
must never prevent the Overview/Attachments/Status tabs (which don't need those
options) from rendering.

**US-E5 — Legacy Form tab always shows a 410**
Visiting the **Legacy Form** tab always receives HTTP `410 Gone` from
`GET /api/staff/:id/legacy-form` by design — this is not a bug but a deliberate
"this bridge screen was retired" notice pattern (same as the student module's
equivalent endpoint), verified so that the tab never silently 500s.

**US-E6 — Search with no results**
Searching by an unmatched name/ID, or a category with zero active staff, shows the
`DataTable` empty state *"No staff found — Nothing matched this search. Check the
spelling, or pick a different category."*

**US-E7 — Resigning without a resignation letter**
The Status tab allows **Update Status** with no file attached — `Resignation Letter`
is not marked required; the server only rejects when *no* status field at all changed
(`No status fields to update`), so a relieving date alone (without a letter) is a valid
save.

**US-E8 — Missing mandatory registration/education fields**
Since `EducationTab`/`ExperienceTab` rows are free-form add/remove grids with no
client-side required-field enforcement visible in `StaffProfileSections.jsx`, a staff
record can legitimately be saved with zero education/experience rows — this reflects
legacy behavior (optional at save time) rather than a defect; report generation and
compliance screens (DCI/TNMGRMU/publication) are the actual enforcement points for
data completeness, not the edit form.

**US-E9 — Large photo upload rejected**
As with students, a photo exceeding the server's accepted size on
`/staff/photo-upload` must return an inline error rather than hang the upload button
indefinitely — surfaced through the same `uploadError`-style alert pattern used across
the module's upload screens.

**US-E10 — Network/API failure mid-save**
Any of the module's `PUT`/`PATCH`/`POST` save calls failing (timeout, 500, dropped
connection) must show `err.response?.data?.message || '<Screen> failed'` in an
`alert-danger` and reset `saving`/`busy` to `false` without clearing the in-progress
form — matching `StaffAdmission.jsx`'s `catch (err) { setError(err.response?.data
?.message || 'Registration failed'); }` pattern used consistently across the module.

**US-E11 — Permission-denied for a department-restricted HOD**
A non-`Global` user whose `basic_admin_menu_tb` links don't cover the Staff module's
PHP patterns is blocked at the middleware layer (`menuAuthForModule('staff')` on every
`server/src/routes/staff.js` route) before any staff data is touched — relevant for an
HOD who should see only their own department's staff via department-scoped reports
(`dept-report` screens) but must not reach admission/edit endpoints if their menu
profile doesn't grant it.

**US-E12 — Org-chart selection for a value no longer in the option list**
`StaffSetupPage.jsx`'s `mergeGroupOption` helper explicitly guards against a previously
saved designation/reports-to value that no longer appears in the freshly loaded
`designationGroups`/`reportsToGroups` (e.g. the designation was later deleted) — it
synthesizes a one-off "Selected" group so the stale value still renders instead of
silently reverting to blank and losing the operator's context.

**US-E13 — Discontinuing a staff member who is a designation-edit "reports-to" target**
If a staff member set as another position's "reports-to" in Org Chart Config is later
relieved (Status tab), the org-chart config screen must still resolve their name via
the `mergeGroupOption` stale-value fallback (US-E12) rather than breaking the reporting
line's display — no automatic re-parenting is implemented; this is a data-integrity
edge the setup screens paper over visually rather than solve structurally.

**US-E14 — Search-by-category with an empty roster**
Selecting a Category with currently zero active staff assigned shows the standard "no
staff found" empty state rather than an error — categories themselves are valid to
select even when unpopulated.

---

## 6. Future / predicted user stories

### Future (not implemented)

Grounded in `mobile.md` (§6 "Staff/Student directory... Search + profile view, no
editing in v1") and realistic extrapolation of today's pattern — **none of this exists
today**; the current app is web-only.

- *As HR/front-office staff on the move*, I want a **mobile staff directory** — search
  by name/ID/category and view a read-only profile — reusing `GET /api/staff/search`
  and `GET /api/staff/:id` exactly as `mobile.md` §6 describes ("Staff/Student
  directory... no editing in v1"). (Speculative — no mobile client exists.)
- *As a staff member*, I want **self-service access** to my own profile, attendance, and
  payslip via a staff portal, extrapolating from the existing `/api/staff/:id` read
  endpoint plus `mobile.md`'s Attendance/Fees v1 read-only scope pattern applied to
  staff instead of students. (Speculative — today's JWT identity is issued to
  admin/office accounts operating on staff records, not to staff logging in as
  themselves.)
- *As HR staff*, I want to **capture a staff photo via phone camera** directly into
  `/staff/photo-upload`'s underlying endpoint using `expo-image-picker`, per `mobile.md`
  §7.5's file-upload guidance. (Speculative.)
- *As the registrar*, I want **push reminders** when a staff member's Dental Council
  registration (`regDate`/`dentalCouncil` fields captured at admission) is nearing
  expiry, extending the existing registration fields with a notification trigger.
  (Speculative — `mobile.md` §8 explicitly flags push notifications as new backend
  surface requiring separate sign-off; no expiry-tracking logic exists today.)
- *As a department head*, I want a **mobile org-chart viewer** rendering the same
  `org_structure.php`-derived `reportHtml` from `/staff/org-structure` inside a
  `react-native-webview`, per `mobile.md` §7.1's print→share/webview pattern.
  (Speculative.)
- *As HR staff*, I want **biometric or digital ID-card issuance** for new staff at
  admission time, extrapolating from the existing paper ID-card generation
  (`/staff/id-card`) plus the mobile "digital ID card" pattern used elsewhere in this
  plan. (Speculative — no biometric capture exists anywhere in the current codebase.)

---

## 7. Traceability table

| Story | Client file | Server endpoint | Server service | Table(s) |
|---|---|---|---|---|
| US-1 search | `StaffList.jsx` | `GET /api/staff/search`, `GET /api/staff/categories` | `staffSearch.js`, `staffCategories.js` | `staff_profile_tb` |
| US-2 admission | `StaffAdmission.jsx` | `POST /api/staff`, `GET /api/staff/admission/options|designations|check-id` | `staffAdmission.js` | `staff_profile_tb`, `staff_dept_master`, `staff_desg_master` |
| US-3 edit profile | `StaffProfile.jsx` (Edit tab) | `GET /api/staff/:id`, `PUT /api/staff/:id` | `staffProfile.js` | `staff_profile_tb` |
| US-4 records | `StaffProfileSections.jsx` (Education/Experience/Awards/Skills tabs) | `PUT /api/staff/:id/records` | `staffProfileExtras.js` | staff education/experience/awards/skills tables (see `staffProfileExtras.js`) |
| US-5 status | `StaffProfile.jsx` (Status tab) | `PATCH /api/staff/:id/status` | `staffStatus.js` | `staff_profile_tb` |
| US-6 attachments/certificates | `StaffScreenPage.jsx` (`certificates`), `components/staff/StaffAttachments.jsx` | `GET/POST/PUT /api/staff/:id/attachments*`, `POST /api/staff/screens/certificates/upload` | `staffAttachments.js`, `staffModuleScreens.js` | staff attachment tables |
| US-7 search-report prints | `StaffScreenPage.jsx` (`staff-search-report` type) | `POST /api/staff/screens/:screen/load` | `staff/screens/*.js` | `staff_profile_tb` |
| US-8 dept reports | `StaffScreenPage.jsx` (`dept-report` type) | `POST /api/staff/screens/:screen/load` | `staff/screens/*.js` | `staff_profile_tb`, `staff_dept_master` |
| US-9 report builder | `StaffReport.jsx` | `GET /reports/fields`, `GET /reports/filters`, `POST /reports/generate` | `staffReport.js` | `staff_profile_tb` |
| US-10 setup CRUD | `StaffSetupPage.jsx` | `POST /api/staff/setup/:screen/load|save` | `staffModuleSetup.js`, `staff/setup/*.js` | designation/attachment-category/org-chart/inspection/transport tables per screen |
| US-11 designation-edit deep link | `StaffProfile.jsx` → `StaffSetupPage.jsx` | `POST /api/staff/setup/designation-edit/load` | `staffModuleSetup.js` | `staff_desg_master`, `staff_profile_tb` |
| US-E1/E2 duplicate Staff ID | `StaffAdmission.jsx` / `StaffProfile.jsx` | `POST /api/staff` / `PUT /api/staff/:id` | `staffAdmission.js` / `staffProfile.js` | `staff_profile_tb` |
| US-E5 legacy form 410 | `StaffProfile.jsx` (Legacy Form tab) | `GET /api/staff/:id/legacy-form` | `server/src/routes/staff.js` (inline) | n/a |
| US-E11 permission denial | any `/staff/*` route | all `/api/staff/*` | `server/src/middleware/menuAuth.js` (`menuAuthForModule('staff')`) | `authentication_tb`, `basic_admin_menu_tb` |
| US-E12/E13 org-chart stale value | `StaffSetupPage.jsx` (`mergeGroupOption`, `DesignationSelect`) | `POST /api/staff/setup/org-chart-config/load` | `staffModuleSetup.js` | org-chart position table |

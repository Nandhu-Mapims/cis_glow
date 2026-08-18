# 05 — Students

## 1. Module overview

**Purpose.** The Students module is the system of record for every student who has ever
been admitted to the college: provisional/temporary admission, permanent profile
(admission, personal, family, address, bank, mark-sheets), academic year/batch history,
photo & document attachments, ID cards, promotion between academic years, address
labels, "collage" group photo generation, and the post-graduation alumni lifecycle
(registration, profile edit, alumni ID cards, alumni reports).

**Primary actors**
- **Admission/Front-office staff** — create new admissions (`StudentAdmission.jsx`),
  edit temp admissions, upload photos/attachments, generate ID cards and address labels.
- **Academic office / HOD** — promote a batch to the next academic year, run academic
  promotion audits, view/edit student profile, mark a student released/discontinued.
- **Alumni office** — register alumni, edit alumni profiles, run alumni reports, print
  alumni ID cards.
- **Reporting staff / management** — build ad-hoc export reports (`StudentReport.jsx`)
  and attachment-completeness reports.

**Legacy PHP files this module replaces** (see `client/src/pages/students/studentModuleMeta.js`):

| Legacy file | Modern screen |
|---|---|
| `student_profile_edit.php` | `/students` (StudentList search + `StudentProfile` edit tab) |
| `student_profile_add.php` | `/students/new` (`StudentAdmission.jsx`) |
| `student_profile_export.php` | `/students/reports` (`StudentReport.jsx`) |
| `student_profile_temp_add.php` | `/students/temp-admission-add` |
| `student_profile_temp_edit.php` | `/students/temp-admission-edit` |
| `student_profile_temp_affidavit.php` | `/students/temp-affidavit` |
| `student_academic.php` | `/students/academic-promotion` |
| `student_promote.php` | `/students/promote` (`PromotePanel.jsx`) |
| `student_attachments.php` | `/students/attachments-upload` |
| `student_attachments_view.php` | `/students/attachments-view` |
| `student_attachments_report.php` | `/students/attachments-report` |
| `student_id_card.php` | `/students/id-card` (`StudentIdCardPanel.jsx`) |
| `student_photo_empty.php` | `/students/photo-empty` |
| `student_photo_upload.php` | `/students/photo-upload` |
| `student_address.php` | `/students/address-label` (`AddressLabelPanel.jsx`) |
| `colage_generate.php` | `/students/collage-generate` (`CollageGeneratePanel.jsx`) |
| `colage_image.php` | `/students/collage-image` (`CollageImagePanel.jsx`) |
| `alumni_registration.php` | `/students/alumni-registration` |
| `alumni_profile_edit.php` | `/students/alumni-edit` (`AlumniEditPanel.jsx`) |
| `alumni_report.php` | `/students/alumni-report` |
| `alumni_id_card.php` | `/students/alumni-id-card` (`AlumniIdCardPanel.jsx`) |

Client entry points: `client/src/pages/students/StudentHub.jsx`,
`StudentList.jsx`, `StudentAdmission.jsx`, `StudentProfile.jsx`, `StudentScreenPage.jsx`
(generic dispatcher for all `STUDENT_SCREEN_META` slugs), `StudentReport.jsx`.
Server: `server/src/routes/students.js` → `server/src/services/students/*.js`
(`studentAdmission.js`, `studentProfile.js`, `studentStatus.js`, `studentAttachments.js`,
`studentSearch.js`, `studentCourses.js`, `studentReport.js`, `studentModuleScreens.js`,
`addressLabel.js`, `alumniIdCard.js`, `collageGenerate.js` / `collageGenerateNative.js`,
`promoteHelpers.js`, `studentIdCardBuilder.js`, `studentShared.js`,
`screens/actionScreens.js`, `screens/reportScreens.js`).

Core table: `student_profile_tb` (`del=1` active); academic history in
`student_academic_tb`; both filtered by `del=1` per house rule.

---

## 2. Screen inventory

| Route | Component | Legacy `.php` |
|---|---|---|
| `/students` | `client/src/pages/students/StudentList.jsx` | `student_profile_edit.php` |
| `/students/new` | `client/src/pages/students/StudentAdmission.jsx` | `student_profile_add.php` |
| `/students/:id` | `client/src/pages/students/StudentProfile.jsx` | `student_profile_edit.php` |
| `/students/reports` | `client/src/pages/students/StudentReport.jsx` | `student_profile_export.php` |
| `/students/hub` | `client/src/pages/students/StudentHub.jsx` | n/a (module hub) |
| `/students/temp-admission-add` | `StudentScreenPage.jsx` (`type: temp-form`) | `student_profile_temp_add.php` |
| `/students/temp-admission-edit` | `StudentScreenPage.jsx` (`type: temp-form-search`) | `student_profile_temp_edit.php` |
| `/students/temp-affidavit` | `StudentScreenPage.jsx` (`type: application-report`) | `student_profile_temp_affidavit.php` |
| `/students/academic-promotion` | `StudentScreenPage.jsx` (`type: academic-form`) | `student_academic.php` |
| `/students/promote` | `StudentScreenPage.jsx` → `PromotePanel.jsx` | `student_promote.php` |
| `/students/attachments-upload` | `StudentScreenPage.jsx` → `StudentAttachmentsPanel` | `student_attachments.php` |
| `/students/attachments-view` | `StudentScreenPage.jsx` → `StudentAttachmentsPanel` (readOnly) | `student_attachments_view.php` |
| `/students/attachments-report` | `StudentScreenPage.jsx` → `AttachmentsReportPanel` | `student_attachments_report.php` |
| `/students/id-card` | `StudentScreenPage.jsx` → `StudentIdCardPanel.jsx` | `student_id_card.php` |
| `/students/photo-empty` | `StudentScreenPage.jsx` (`type: course-year-report`) | `student_photo_empty.php` |
| `/students/photo-upload` | `StudentScreenPage.jsx` → `PhotoUploadFields` / `PhotoBulkUploadFields` | `student_photo_upload.php` |
| `/students/address-label` | `StudentScreenPage.jsx` → `AddressLabelPanel.jsx` | `student_address.php` |
| `/students/collage-generate` | `StudentScreenPage.jsx` → `CollageGeneratePanel.jsx` | `colage_generate.php` |
| `/students/collage-image` | `StudentScreenPage.jsx` → `CollageImagePanel.jsx` | `colage_image.php` |
| `/students/alumni-registration` | `StudentScreenPage.jsx` (`type: alumni-search`) | `alumni_registration.php` |
| `/students/alumni-edit` | `StudentScreenPage.jsx` → `AlumniEditPanel.jsx` | `alumni_profile_edit.php` |
| `/students/alumni-report` | `StudentScreenPage.jsx` (`type: alumni-filter`) | `alumni_report.php` |
| `/students/alumni-id-card` | `StudentScreenPage.jsx` → `AlumniIdCardPanel.jsx` | `alumni_id_card.php` |

---

## 3. Pixel-level flow per screen

### 3.1 `/students` — Student search (`StudentList.jsx`)

DOM order:
1. Breadcrumbs: **Home → Student → Edit Profile**.
2. `PageHeader` title **"Students"**, subtitle *"Find a student by roll number or course batch"*.
3. Header actions: **Module Hub** (`btn-outline-secondary`, → `/students/hub`), **Export Report**
   (`btn-outline-primary`, → `/students/reports`), **New Profile** (`btn-primary`, `fa fa-plus`, → `/students/new`).
4. Search-mode tabs (`role="tablist"`): **Roll number** (`fa fa-hashtag`) / **Course / batch** (`fa fa-users`),
   driven by URL param `?by=roll|batch`.
5. Roll-number mode: label **"Roll number"**, text `<input id="roll" name="roll">` placeholder
   *"e.g. 2021UG001, 2021UG002"*, autoFocus; **Search** button (`btn-primary`, disabled while `searching`,
   label flips to *"Searching…"*); hint *"Enter one roll number, or several separated by commas."*
6. Batch mode: label **"Course / batch"**, `<select id="batch">` with `<option>Select a course batch…</option>`
   then `<optgroup label="{courseName} | {label}">` per course from `GET /api/students/courses`, options from
   each course's `batchOptions`; hint *"Lists every student admitted in the selected batch."*
7. Results `DataTable` — columns **Register No** (numeric, sortable, searchField), **Student Name**,
   **Course** (derived from `courseId` via loaded `courses` list, format `"{degreeName} · {departmentName}"`),
   **Admission Year**, **Admission No**. Row click → `/students/:id`. Empty state (no search yet): icon
   `fa fa-search`, title *"Search for a student"*, message *"Enter one or more roll numbers, or choose a course
   batch above to list its students."* Empty state (search returned nothing): icon `fa fa-user-times`, title
   *"No students found"*, message *"Nothing matched this search. Check the roll number, or pick a different
   course batch."*
8. Footnote (only if `user.accessType` and results present): *"Signed in as {memberName} ({memberId})"*.

Data: `GET /api/students/courses` on mount; `GET /api/students/search?by=roll|batch&q=...` on submit
(aborts in-flight request via `AbortController` if a newer search starts). If exactly one match, auto-navigates
to `/students/:id`.

### 3.2 `/students/new` — Student Admission (`StudentAdmission.jsx`)

Loaded reference data: `GET /api/students/admission/options` (course types, academic years, quotas, blood
groups, religions, communities, titles, banks, states, mark programs) and, once Batch+Degree chosen,
`GET /api/students/admission/degrees?academicYear=&courseName=`.

Left rail: `FormSectionNav` jump-nav driven by `useScrollSpy` over 11 sections (ids in `SECTIONS`):
Admission, Identity & Names, Personal Details, Parents, Guardian, Scholarship, Contact, Permanent Address,
Communication Address, Bank Details, Mark Sheets.

Fields, in DOM order, per section (exact labels from `<Field label="…">` / raw `<label>`):

- **Admission Details** — *Application No* (text, maxLength 20), *Admission No* * (required, maxLength 20),
  *Admission Date* * (date, required, defaults to today), *Source* (radio group over `options.quotas`, full
  width), *Batch* * (select over `options.academicYears`, required), *Degree* * (select over `courseTypeOptions`
  = `options.courseTypes` fallback `['U.G','P.G']`, required — changing it resets `academicYear` to
  `settings.pgAcademicYear`/`ugAcademicYear` and clears `courseId`), *Course* * (select over `degrees` fetched
  per Batch+Degree, required), *AR No*, *AR Rank*, *NEET Roll No* (maxLength 10), *NEET Score* (maxLength 3).
- **Identity & Names** — *Student Title* (radio over `options.studentTitles`), *Student Name* * (required,
  maxLength 155), *Student Initial*, *Father Title* (select), *Father Name*, *Mother Title* (select),
  *Mother Name*, *Aadhar No* * (required, maxLength 12), *Roll No* * (required, maxLength 20),
  *University Register No*, *Register No* * (required, maxLength 20), *EMIS No*, *UMIS No*.
- **Personal Details** — *Gender* (radio: Male/Female/Transgender), *Date of Birth* (date), *Blood Group*
  (select), *Willingness to donate Blood* (checkbox "Yes"), *Religion* (select), *Community* (select),
  *Caste* (text), *Nationality* (text, default "Indian").
- **Parents — Occupation & Income** — *Father Occupation*, *Father Income* * (required), *Mother Occupation*,
  *Mother Income* * (required).
- **Guardian** — *Staying with Guardian* (checkbox), *Relation*, *Guardian Name*, *Guardian Mobile*,
  *Guardian Email* (type=email), *Guardian Address* (textarea), *City*, *Pincode*.
- **Scholarship** — *DME Tuition Fees Date* (date), *Receipt No.*, *Amount*, *Scholarship* (checkbox) — when
  checked reveals **Scholarship Type** radio (`SC/ST`/`SCA`/`BC`/`MBC`) + **First Graduate** checkbox;
  *ACMEC Scholarship* (checkbox) — when checked reveals **ACMEC Amount** and **Approved by**.
- **Contact** — *Student Mobile No*, *Father's Mobile No.*, *Mother's Mobile No.*, *Telephone No*,
  *Student Email* (type=email), *Father's Email* (type=email).
- **Permanent Address** — *Door No.*, *Street*, *Post*, *Taluk*, *District*, *State* (select over
  `options.states`), *Pincode*.
- **Communication Address** — header action checkbox **"Same as P.Addr."**; when checked, all 7 fields
  (Door No./Street/Post/Taluk/District/State/Pincode) are `disabled` and auto-mirrored from Permanent Address
  via a `useEffect`.
- **Bank Details** — *A/c No.*, *A/c Name*, *Bank Name* (select over `options.banks`), *Branch*, *IFSC Code*.
- **Mark Sheets** — header action **"+ Add row"**; editable table with columns S.No., Class/Program (select
  over `options.markPrograms`, mapping `X`→"10th", `XII`→"12th"), Board/University, Register No.,
  Passed Out (YYYY), % , delete (`×`, hidden when only one row remains, `removeMarkRow`).

Footer `FormActionBar`: note toggles between *"Unsaved changes"* (dirty) and *"Fields marked * are required."*;
buttons **Cancel** (`btn-outline-secondary` → if dirty opens `ConfirmModal` *"Discard this admission?"* with
confirm **Discard changes** / cancel **Keep editing**, else navigates to `/students`) and **Create New Profile**
(`btn-primary`, label *"Saving…"* while `saving`).

**Save call**: `POST /api/students` with the full form (booleans coerced to `0`/`1`; `rollNo` defaults to
`registerNo`; `casteScholarship` cleared unless `scholarship` is truthy) plus `markSheets` array →
`server/src/services/students/studentAdmission.js::createStudentAdmission`. Server validation (exact
messages): `registerNo, courseId, academicYear, and studentName are required`; `Admission number is required`;
`Aadhar number is required`; `Register number already exists` (duplicate check via `registerExists(rollNo)`).
On success (`201`): navigates to `/students/{res.data.id}`. `beforeunload` guard warns on tab-close while dirty.

### 3.3 `/students/:id` — Student Profile (`StudentProfile.jsx`)

Loads `GET /api/students/:id` → 404 if not found (`Student not found`). Hero block: `UserAvatar`
(name + `photoUrl`), name line with status pill — **Active** (`fa fa-check-circle`) vs **Released**
(`fa fa-sign-out`); "released" is computed client-side as
`Boolean(d && !String(d).startsWith('0000') && d !== '—')` — i.e. a `releaving_date` of `0000-00-00` (the
legacy empty marker) is treated as **still active**, matching the "zero dates are real, del/date sentinels
mean empty" house rule. Fact list: Register No, Admission No, Course (`degreeName · departmentName`), Batch.
Header actions: **Fee History** (→ `/fees/history?registerNo=`), **Search** (→ `/students`).

Tab bar (`role="tablist"`): **Overview** (`fa fa-id-badge`), **Edit** (`fa fa-pencil`, shows a dot indicator
when dirty), **Attachments** (`fa fa-paperclip`), **Status** (`fa fa-exchange`).

- **Overview tab** — read-only `FormSection` "Personal" (Register No, Gender, Date of Birth, Blood Group,
  Religion, Community, Caste, Aadhar) and "Family & Contact" (Father, Mother, Mobile, Father Mobile,
  Personal Email, Address — joined door/street/post/district/state/pincode); "Academic Records" table
  (Year, Batch, Current Year, Type) if `profile.academics.length > 0`.
- **Edit tab** — grouped sections from `EDIT_SECTIONS`: Identity (Register No, Name, Initial, Title, Aadhar),
  Personal (Gender, Blood Group, Religion, Community, Caste, Nationality), Family (Father Name/Title,
  Mother Name/Title), Contact (Mobile, Contact, Father Mobile, Mother Mobile, Father Email, Personal Email),
  Permanent Address (Door No, Street, Post, District, State, Pincode), Communication Address (Comm.
  equivalents), Guardian (Guardian Name, Guardian Mobile, Guardian Email, Guardian Relation) — all plain text
  `<input>`s. Footer: **Reset** (`btn-outline-secondary`, disabled unless dirty, restores form from `profile`)
  and **Update Profile** (`btn-primary`, *"Saving…"* while saving). Switching away from Edit while dirty opens
  `ConfirmModal` *"Discard unsaved changes?"*.
- **Attachments tab** — `client/src/components/students/StudentAttachments.jsx` (separate component,
  `studentId={id}`).
- **Status tab** — `FormSection` "Transfer / Discontinue", description *"Set a releaving date to mark this
  student as released. Leave blank to keep the student active."*: **Releaving Date** (date), **Releaving
  Year** (number), **Releaving Info** (textarea, 3 rows). Footer note *"Current status: **Active/Released**"*;
  button **Update Status** (`btn-primary`).

**Save calls**:
- Edit: `PUT /api/students/:id` with the flat edit form → `updateStudentProfile`. Validation:
  `Student not found` (404), `Roll number already exists` (duplicate `registerNo` check against other rows),
  `No fields to update` (400 if nothing changed).
- Status: `PATCH /api/students/:id/status` with `{ releavingDate, releavingInfo, releavingYear }` →
  `updateStudentStatus`. Validation: `Student not found`, `No status fields to update`. Uses
  `sqlDateOrNull`/`escapeSql` raw SQL (`server/src/services/students/studentStatus.js`).

### 3.4 `/students/reports` — Student Export Report (`StudentReport.jsx`)

Reference data (`students/reports/builder-meta`, IndexedDB-cached 24h via `cachedGet`):
`GET /api/students/reports/fields` (grouped field catalog) and `GET /api/students/reports/filters`
(course/batch/year option lists).

**"Report scope"** section: *Course* (select, options `filters.courseOptions` + grouped `filters.groupedCourses`
optgroups, default `All---All`), *Search by* (radio **Batch**/**Year** — switching to Year resets
`academicYear` to `All___`), the year/batch select itself (label flips between *Batch*/*Year*), *Show*
(radio **Regular**/**Discontinue**/**All**, default Regular), *Report title* (free text, optional heading),
*Print options* (checkboxes **College header**, **Serial no. column**).

**"Choose columns"** section: searchable checklist grouped by `fieldGroups` (search box placeholder
*"Search fields…"*, per-group **Select all**/**Clear group** link, "No fields match "{query}"." when filtered
to nothing), a custom-field text input + **Add** button (Enter key also adds), and an ordered "Report columns
(N)" list on the right with per-row **↑ / ↓ / ×** reorder/remove and a **Clear all** link.

Preview: `<iframe srcDoc={previewHtml}>` shown after a successful HTML generation.

Footer `FormActionBar`: note *"Select at least one field to generate a report."* or *"N column(s) selected"*;
buttons **Clear fields**, **Export XLS** (`btn-outline-primary`), **Print report** (`btn-primary`, label
*"Generating…"* while busy — opens `window.open('', '_blank')` synchronously in the `onClick` to avoid
popup-blocking, since the actual `printReportHtml` call happens after an `await`).

**Save/generate call**: `POST /api/students/reports/generate` with
`{courseName, searchBy, academicYear, reportTitle, showHeader, showSerialNo, discontinued, fields, format}`
→ `generateStudentReport` (`server/src/services/students/studentReport.js`, 911 lines). `format: 'html'`
returns `{html}` (cached 5 min per exact filter+column combination, then reprinted via `printReportHtml`);
other formats return `{downloadUrl,filename}` or `{csv,filename}` triggering a browser download. Client-side
guard: *"Please select at least one field."* if `selectedFields.length === 0`.

### 3.5 `/students/temp-admission-add` & `/students/temp-admission-edit` — Provisional Admission

`type: temp-form` (add): *Application no* * , *Student name*, *Register no*, *Mobile*, then the generic
**Generate**/**Save** submit button (screen is in `SAVE_SCREENS`, so label is **Save**).
`type: temp-form-search` (edit): *Application no* + **Load** button (`onGenerate`); once loaded, `data.profile`
reveals editable *Name* and *Register no* plus a hidden `student_id` field. Server: `screens/actionScreens.js`
— validation `application_no is required`, `Application number already exists` (duplicate guard on both
add and edit paths, lines ~216/265).

### 3.6 `/students/temp-affidavit` — Affidavit print (`type: application-report`)

Single field *Application no*, submit **Generate**; result rendered via `data.reportHtml` in a
`report-html` card and printable via the page-level **Print** action button
(`printReportHtml(data.reportHtml)`).

### 3.7 `/students/academic-promotion` — Academic Promotion audit (`type: academic-form`)

Field *Register no* + **Load** button. On load, if `data.academics?.length > 0`, renders a read-only table
(Year, Batch, Current Year, Type, Register) of every `student_academic_tb` row for that student — used to
audit/verify a student's per-year academic records (distinct from the bulk `promote` screen below).

### 3.8 `/students/promote` — Promotion (`PromotePanel.jsx`, legacy `student_promote.php`)

Cascading selects: **From academic** (select over `data.academicYears`) → choosing it derives a default
**To academic** as `"{yr}-{yr+1}"` from the last 4 chars of the from-year and resets From/To course. **To
academic** (select, options `data.toAcademicYears` falling back to `data.academicYears`). **From course**
(select over `data.promoteCourses[].batchOptions`, flattened) — selecting it sets `to_class` equal to
`from_class` initially and reloads. **To course** (select over `data.promotion.toCourseOptions`, only shown
once `from_class` set and options exist).

If a course has no year steps: *"This course has no year steps to promote."* Otherwise a table with columns
**Promote** (checkbox per row, `row.allow`), **From year** (select over `data.promotion.yearOptions`),
**To year** (select, same options), **Fail list (register nos)** (free-text comma list) — one row per
year-step returned by the server. Submit button **Promote** (only rendered once rows exist), disabled unless
`form.to_a_year` is set.

**Save call**: `onPromote` → screen save → payload `{...form, mappings, Submit: 'Promote'}` where each
mapping parses `fromYear`/`toYear` (`{course}___{year}` keys, split on `___`, default type `regular`) via
`parseYearType`. Server: `server/src/services/students/promoteHelpers.js`.

### 3.9 `/students/attachments-upload` & `/students/attachments-view`

`StudentAttachmentsPanel` (shared component, `readOnly` prop distinguishes the two). Search bar: text input
placeholder *"Search by register no..."* + **Search** button (calls `searchMore({by:'roll', q})`, auto-loads
first match). Deep-link support: `?studentId=` query param auto-loads that student (used from the
Attachments Report's row actions).

Once a student catalog loads: heading **"Student #{studentId}"**; upload mode shows hint *"Supported: jpg,
png, gif, doc, docx, pdf"*; table columns **Attachment** (type name), **Number** (text input, `readOnly` in
view mode), **File** (link to `fileUrls[i]` or *"No file"*, plus a `<input type=file accept=".jpg,.jpeg,.png,.gif,.doc,.docx,.pdf">`
in upload mode). Per-file upload posts immediately to
`POST /api/students/{studentId}/attachments/upload` with `{filename, dataBase64}` (base64 read via
`FileReader.readAsDataURL`); failure shows `err.response?.data?.message || 'Upload failed'` in a
`alert-danger`. Form submit button **Save Attachments** (`btn-primary`, upload mode only) → `PUT
/api/students/:id/attachments` with `{items}` (`attachId, attachNo, attachFile, recordId` per row).

### 3.10 `/students/attachments-report` — Attachments Report (`AttachmentsReportPanel.jsx`)

Filters card "Report Filters": **Search by** select (**Register No** `roll_no` / **Batch** `batch`);
`roll_no` reveals *Register nos / batch value* text input; `batch` reveals *Course / batch* select
(`data.courses[].batchOptions`). Submit **Generate Report** (`btn-primary`, `fa fa-refresh`).

Results `DataTable` "Student Attachments Report": columns S.No, **Register No**, **Full Name**,
**File Count**, **Status** (`AttachmentStatusBadge`: Pending/red, In Review/blue, Complete/green — keyed off
`row.status`), **Actions** (hidden on mobile) — **Upload** link (if `fileCount === 0`, → attachments-upload)
or **View All** link (→ attachments-view), plus an eye icon → student profile. Header shows a live count
(*"N student(s)"*). Empty state icon `fa fa-folder-open-o`, *"No students found"*.

### 3.11 `/students/id-card` — Student ID Card (`StudentIdCardPanel.jsx`)

"Filter" card: **Option** checkboxes **Front** / **Back** (both default checked); **Search by** radio
**Register No** `roll_no` / **Batch** `batch`; `roll_no` reveals *Register numbers* text (comma-separated);
`batch` reveals *Course / batch* select. Submit **Go** (`btn-primary`).

Results card: before any search, empty state *"Enter search criteria and click Go to generate ID cards."*
(🪪 icon). After search: *"Search results: {data.count} found..."* in red text; if `data.reportHtml` and
`count > 0`, shows *"ID card generated successfully. Use Print to open the print preview."* + **Print** button
(`printStudentIdCard(data.reportHtml)` from `client/src/utils/printReport.js`); otherwise
*"No students with an ID card photo found for the selected criteria."*

### 3.12 `/students/photo-empty` — Photo Empty Report (`type: course-year-report`)

Filters: *Course / batch* select, *Year* free-text input; submit **Generate**. Lists students missing a
photo for the chosen batch/year (server-rendered `reportHtml`).

### 3.13 `/students/photo-upload` — Upload Photo

Two independent tools rendered together (`meta.type === 'upload'`):
- **`PhotoUploadFields`** — *Register no* input (min 3 digits enforced client-side: *"Type at least 3 digits
  of the register no."*) + **Find student** button (`searchMore({by:'roll', q})`); zero matches shows *"No
  student found for that register no."*; multiple matches list as clickable buttons *"{name} ({registerNo})"*;
  a single match auto-selects, showing *"Selected: **{name}** ({registerNo})"*. Then *Photo (PNG/JPG, any
  file name)* file input (disabled until a student is selected) and **Save** button (disabled until both
  student and file are present).
- **`PhotoBulkUploadFields`** — hint *"Bulk upload — file name is the register no (e.g. 24CSE001.jpg)"*,
  multi-file input (`accept=".png,.jpg,.jpeg" multiple`), shows *"N file(s) selected"*, button label
  *"Upload N photo(s)"* / *"Uploading…"*; per-file result list after save: *"{name} → saved as {savedAs}"*
  (green) or *"{name} — {error}"* (red).

Both call the screen's `save` action (`POST /api/students/screens/photo-upload/save`), single-photo mode
sending `{registerNo, file}`, bulk mode sending `{files:[{name,data}]}`.

### 3.14 `/students/address-label` — Address Label (`AddressLabelPanel.jsx`)

"Filter" panel: **Search By** radio **Batch** / **Year**; a `ChipMultiSelect` (multi-value chip picker) bound
to whichever grouping is active, labelled *Batch* or *Year*, sourced from `data.batchGroups` /
`data.yearGroups`, empty-selection text *"No batches/years selected"*; **Show** radio
**Regular**/**Discontinue**/**All** (default Regular); submit **Generate labels** (`btn-primary`, *"Generating…"*
while busy). Right pane shows selected-count and, once generated, label count (*"Selected: N · Labels: M"*);
before generation, empty state ✉ *"Choose Batch or Year, select one or more options, then generate printable
address labels."* Save/generate payload: `{Submit:'Update', search_by, display_opt, search_course,
search_year}` → `server/src/services/students/addressLabel.js`.

### 3.15 `/students/collage-generate` & `/students/collage-image` — group photo tools

**Collage Generate** (`CollageGeneratePanel.jsx`, legacy `colage_generate.php`): "Grid layout" (Rows,
Columns, Margin px), "Photos" (Register/staff numbers comma list — required, client validation *"Enter
register / staff numbers (comma separated)."*; Width/Height; Background hex swatch+input; "Show name under
each photo" toggle revealing Font size/Line height/Text colour; Template select), "Merged cells (optional)"
(Photos for merged area, Cells to merge e.g. `15,16,21,22`, merged Width/Height/Background, merged name
toggle, merged Template). Live SVG-free HTML grid preview built client-side (`buildGridHtml`) highlighting
the would-be-merged cells. Submit **Generate collage** → server `collageGenerate.js` /
`collageGenerateNative.js`; output image shown via `data.outputUrl`.

**Collage Image library** (`CollageImagePanel.jsx`, legacy `colage_image.php`): *Album title* input, multi
*Images* file input (`.png,.jpg,.jpeg,.gif`); grid of existing images each with a select checkbox, preview,
and an editable per-image title input; buttons **Update** (saves title edits + newly staged uploads) and
**Delete Selected** (`btn-outline-danger`, disabled until ≥1 selected).

### 3.16 `/students/alumni-registration` — Alumni search/register (`type: alumni-search`)

Filters: *From date* / *To date* (date inputs, mutually constrain `max`/`min`), *Find* (free text),
*Field* (select over `data.fieldLabels`). Feeds into finding-or-creating an alumni record, then hands off to
the Alumni Edit screen.

### 3.17 `/students/alumni-edit` — Alumni Profile Edit (`AlumniEditPanel.jsx`)

Left "Filter" card: **Search by** radio **Name** / **Register No**; search input + **Go** button (also
Enter-to-search); result list of matching alumni as buttons *"{regNo} - {name}"* (or just name), highlighting
the active selection; *"No alumni to list."* when empty.

Right panel states: not-found alert (`data.message` or *"No alumni profile found."*); *"No alumni record
exists yet. Profile prefilled from student register no {regNo}."* info banner when `data.fromStudent`; empty
prompt 🎓 *"Search or select an alumni profile from the list to begin editing."* when nothing chosen.

Form (two cards side by side):
- **Personal Information** — *Name* * (required), *Register No* * (required), *Gender* (radio Male/Female),
  *Date of Birth* (date), *Photo* (view-only link if present), *E-Mail*, *Mobile*, *Address* (textarea).
- **Alumni Information** — *Year of Passing* (select, `data.yopOptions`, changing it reloads class options),
  *Degree* (select, `data.courseOptions`, changing it reloads class options), *Course* (select,
  `data.classOptions`), *PG Details (If Any)*, *Clinical Practice (If Any)*, *Current Working Status (If
  Any)* (textarea).

Submit button label switches on `form.isNew`: **Create Alumni Profile** vs **Update Profile**. Save payload:
`{isNew, student_id, reg_no, name, email, mobile, address, course, dept, yop, pgd, cp, ws, gender, dob}`.

### 3.18 `/students/alumni-report` — Alumni Report (`type: alumni-filter`)

Heading "Filter"; *From date* / *To date* (date), *Year of pass* (select `data.yopOptions`), *Course*
(select `data.courseOptions`); submit label is **Search** (this `type` is excluded from the default
Generate/Save button and gets its own submit rendering `Search`).

### 3.19 `/students/alumni-id-card` — Alumni ID Card (`AlumniIdCardPanel.jsx`)

Same shape as Student ID Card (§3.11): **Front**/**Back** checkboxes, **Register No**/**Batch** search-by
radio with matching input, **Go** button; result messaging identical pattern (*"Search results: N found..."*,
**Print** via `printAlumniIdCard`, or *"No alumni with ID card photos found for the selected criteria."*).

---

## 4. Primary user stories

**US-1 — Search for a student by roll number**
As an **admission/front-office staff member**, I want to type one or more register numbers into the
"Roll number" search box on `/students` and click **Search**, so that I can jump straight to a student's
profile without browsing lists.
*Acceptance criteria:* typing a valid register no and clicking **Search** calls
`GET /api/students/search?by=roll&q=...`; a single match auto-navigates to `/students/:id`; multiple matches
render in the `DataTable`; results are sortable/searchable client-side.

**US-2 — List an entire batch**
As **academic office staff**, I want to switch to "Course / batch" mode and pick a batch from the grouped
`<select>`, so that I can see every student admitted in that batch at once.
*Acceptance criteria:* the select is grouped by course (`<optgroup>`); choosing an option calls
`GET /api/students/search?by=batch&q=...` and lists all matches.

**US-3 — Admit a new student**
As **admission staff**, I want to fill out the full Student Admission form (Admission Details through Mark
Sheets) and click **Create New Profile**, so that a new `student_profile_tb` row (with `del=1`) and mark-sheet
rows are created and I land on that student's profile.
*Acceptance criteria:* Admission No, Admission Date, Batch, Degree, Course, Student Name, Aadhar No, Roll No,
Register No are enforced client-side (`required`); server re-validates `registerNo, courseId, academicYear,
studentName` presence, Admission number, Aadhar number, and rejects a duplicate register number with
`Register number already exists`; success returns `201` and the client redirects to `/students/{id}`.

**US-4 — Edit a student's demographic/contact details**
As **front-office staff**, I want to open a student's **Edit** tab, change any of the grouped fields, and
click **Update Profile**, so that the change is saved and reflected on the Overview tab.
*Acceptance criteria:* `PUT /api/students/:id` only sends fields present in `UPDATABLE_FIELDS`; a duplicate
`registerNo` is rejected with `Roll number already exists`; a no-op save returns `No fields to update`;
successful save shows *"Profile updated successfully."* and switches back to Overview.

**US-5 — Mark a student released/discontinued**
As **academic office staff**, I want to set a Releaving Date/Year/Info on the **Status** tab and click
**Update Status**, so that the student is flagged released without deleting their record (`del` stays `1`).
*Acceptance criteria:* `PATCH /api/students/:id/status`; the status pill flips to "Released" only when the
saved date is non-empty and not a `0000-00-00` sentinel; leaving the date blank keeps the student "Active".

**US-6 — Upload a required attachment**
As **front-office staff**, I want to search for a student on `/students/attachments-upload`, then choose a
file for each attachment type row, so that the file uploads immediately and is linked to that catalog row.
*Acceptance criteria:* each row's file input posts independently to
`POST /api/students/:id/attachments/upload`; **Save Attachments** persists any edited "Number" fields via
`PUT /api/students/:id/attachments`; unsupported types are rejected server-side.

**US-7 — Run the Attachments completeness report**
As **compliance/reporting staff**, I want to filter by register numbers or a batch and click **Generate
Report**, so that I get a per-student file-count and status (Pending/In Review/Complete) with direct links to
Upload or View All.
*Acceptance criteria:* zero-file students show an **Upload** action; ≥1-file students show **View All**;
report is client-searchable/paginated via `DataTable`.

**US-8 — Generate and print a batch of Student ID cards**
As **admission staff**, I want to pick Front/Back options and either a comma list of register numbers or a
course batch, click **Go**, and then **Print**, so that the printable HTML opens (without `noopener`, per the
house rule) and prints correctly.
*Acceptance criteria:* `data.count` reflects the match count; **Print** only appears when `reportHtml` exists
and `count > 0`.

**US-9 — Promote a batch to the next academic year**
As **academic office staff**, I want to choose From/To academic year and From/To course, review the
per-year-step Promote table (toggle rows, adjust from/to year per row, list register numbers to fail), and
click **Promote**, so that eligible students' `student_academic_tb` rows advance while failed students do not.
*Acceptance criteria:* **Promote** is disabled until `to_a_year` is chosen; only rows with `allow` checked are
promoted; register numbers in "Fail list" are excluded from promotion for that row.

**US-10 — Build and export a custom student report**
As **reporting staff**, I want to pick a Course/Batch-or-Year/Show filter, tick fields from the grouped
checklist (or add a custom field), reorder the selected columns, and click **Print report** or **Export XLS**,
so that I get exactly the columns I need in print-preview or spreadsheet form.
*Acceptance criteria:* generating with zero fields selected shows *"Please select at least one field."*
and does not call the API; **Print report** pre-opens the target window synchronously on click to avoid
popup blocking; HTML results are cached 5 minutes per identical filter+column signature.

**US-11 — Register / edit an alumni profile**
As **alumni office staff**, I want to search by Name or Register No, select a match (or get prefilled from a
student record when none exists), edit Personal/Alumni Information, and Save, so that the alumni record is
created or updated.
*Acceptance criteria:* Name and Register No are required; submit label reflects create vs. update
(`form.isNew`); Year-of-Passing/Degree changes reload the dependent Course/class options.

---

## 5. Rare / edge-case user stories

**US-E1 — Duplicate register number on admission**
As admission staff, if I submit a register number that already exists in `student_profile_tb` (`del=1`), the
save must fail with **"Register number already exists"** and the form must stay populated (nothing is lost)
so I can correct the number and resubmit. Source: `studentAdmission.js` `registerExists(rollNo)` check.

**US-E2 — Duplicate register number on profile edit**
If I edit a student's Register No on the Edit tab to a value already used by a *different* active student,
the save fails with **"Roll number already exists"** and the Edit tab stays open with my unsaved changes
intact (dirty flag not cleared). Source: `updateStudentProfile` dup check excluding the current row's own id.

**US-E3 — Student with a zero release date is still "Active"**
Per the CLAUDE.md house rule, a `releaving_date` of `0000-00-00` must render as **Active**, not "Released" —
the client explicitly checks `!String(d).startsWith('0000')` before showing the Released pill. A regression
here would incorrectly flag every never-released legacy student as released.

**US-E4 — Search with no results**
Searching `/students` by an unmatched roll number or an empty batch shows the `DataTable` empty state
*"No students found — Nothing matched this search. Check the roll number, or pick a different course
batch."* rather than a blank table or a thrown error.

**US-E5 — Missing mandatory attachment blocks completeness**
A student with `fileCount === 0` on the Attachments Report shows a red "Pending" badge and only an
**Upload** action (no "View All"), making it visually obvious which students still need documents chased.

**US-E6 — Photo search too short**
On `/students/photo-upload`, typing fewer than 3 digits into the register-no box keeps **Find student**
disabled and, if triggered via Enter, shows *"Type at least 3 digits of the register no."* without calling
the API.

**US-E7 — Ambiguous photo-upload match**
If a register-no search on `/students/photo-upload` returns multiple students, the panel lists them as
clickable rows instead of guessing — the operator must explicitly pick the right student before the photo
input is enabled, preventing a photo being attached to the wrong student.

**US-E8 — Bulk photo upload with mixed results**
Uploading a batch of photos where filenames are register numbers can partially fail (e.g. one filename
doesn't match any student). The UI shows a per-file result list — green *"{name} → saved as {savedAs}"* for
successes, red *"{name} — {error}"* for failures — rather than an all-or-nothing outcome, and only clears the
file picker (`inputKey` bump) when `result.success` is true overall.

**US-E9 — Address label with nothing selected**
Selecting neither a batch nor a year in the `ChipMultiSelect` and clicking **Generate labels** leaves the
right pane showing the ✉ empty-state prompt rather than producing an empty printable page (no `reportHtml`
until at least one option is chosen and generated).

**US-E10 — Alumni record doesn't exist yet**
Searching for an alumnus by register number who has no `alumni` row yet, but does have a `student_profile_tb`
record, surfaces the info banner *"No alumni record exists yet. Profile prefilled from student register no
{regNo}."* — the Alumni Edit form is pre-populated from the student profile and `form.isNew` is `true`, so
Save creates rather than updates.

**US-E11 — Promoting into a course with no year steps**
Selecting a From-course whose promotion configuration has no year-to-year mapping shows *"This course has no
year steps to promote."* instead of an empty, confusing table — and no Promote button is rendered.

**US-E12 — Re-promoting a batch that already has next-year records**
If a promotion is re-run for a batch/year pair whose students already have `student_academic_tb` rows for
the target year, `promoteHelpers.js` must not create duplicate academic-year rows (soft-delete-then-recreate
pattern, matching the CLAUDE.md `del=0`→`del=1` convention) — otherwise a student would appear twice in that
year's roster/attendance/fees screens.

**US-E13 — Network/API failure mid-save**
If `POST /api/students` (or any screen's save) throws (network drop, 500), the client shows
`err.response?.data?.message || 'Admission failed'` (or the screen-specific fallback, e.g. `'Save failed'`)
in an `alert-danger`, `saving`/`busy` resets to `false`, and the form's entered values are preserved — no
silent data loss.

**US-E14 — Discarding a half-filled admission**
Clicking **Cancel** on `/students/new` after any field has been touched opens the `ConfirmModal` *"Discard
this admission? You have unsaved changes. Leaving now will discard everything entered on this form."*
rather than navigating away silently; a browser refresh/tab-close with unsaved changes triggers the native
`beforeunload` prompt via the same `dirty` flag.

**US-E15 — Permission-denied for a department-restricted user**
A non-`Global` `accessType` user without an enabled `basic_admin_menu_tb` link for the Students module's PHP
patterns is blocked by `menuAuthForModule('students')` (`server/src/middleware/menuAuth.js`) before any
service runs — every route in `server/src/routes/students.js` is behind `authMiddleware,
menuAuthForModule('students')`.

**US-E16 — Large photo upload rejected**
A photo file that exceeds the upload size limit enforced by the attachment/photo upload endpoints must
surface the server's error message (`result.error`) inline rather than hanging the "Uploading…" state
indefinitely; the UI's `uploadError` alert-danger is the intended surface for this.

---

## 6. Future / predicted user stories

### Future (not implemented)

These are speculative extrapolations grounded in `mobile.md` (§6 "Feature-by-feature mapping",
§6.5/7.5 file uploads) — **none of this exists today**; the current app is web-only, read/write via the
existing `/api/students` REST surface.

- *As a student*, I want to view my own profile, attachments, and ID card on a mobile app via a **self-service
  student portal**, reusing `GET /api/students/:id` read-only, so that I don't need to visit the front office
  for basic record checks. (Speculative — `mobile.md` §6 lists "Staff/Student directory" as read-only v1
  scope but does not describe self-service login as the student themselves; today's JWT identity model is
  staff/admin-only via `web_account_setup`.)
- *As a student*, I want a **digital/mobile ID card** (wallet-style) generated from the same `printHtml` the
  Student ID Card screen already builds, rendered via `expo-print`/`react-native-webview` per `mobile.md`
  §7.1, instead of only a printable paper card. (Speculative.)
- *As admission staff on the move*, I want to **upload a student photo from a phone camera** directly via
  `expo-image-picker` to the existing `/api/students/:id/attachments/upload`-style endpoint, per `mobile.md`
  §7.5, instead of only a desktop file picker. (Speculative.)
- *As a records officer*, I want a **biometric-linked profile** (fingerprint/face capture tied to
  `student_profile_tb`) for library/hostel/attendance gating, extrapolating from the existing ID-card and
  attachment infrastructure. (Speculative — no biometric capture exists anywhere in the current codebase;
  this is a plausible next step given the ID-card and photo-upload patterns, not a documented plan.)
- *As alumni office staff*, I want **push notifications** to alumni about reunion events sent from the
  Alumni Report cohort, per `mobile.md` §8 ("Push notifications... is new backend surface — flag and scope
  separately"). (Speculative and explicitly flagged as requiring backend sign-off in `mobile.md`.)
- *As a parent/guardian*, I want **read-only mobile access** to my child's basic profile and attendance,
  extrapolating from the Guardian fields already captured on admission (`guardianEmail`, `guardianNo`).
  (Speculative — no guardian-facing auth exists today.)

---

## 7. Traceability table

| Story | Client file | Server endpoint | Server service | Table(s) |
|---|---|---|---|---|
| US-1/US-2 search | `StudentList.jsx` | `GET /api/students/search`, `GET /api/students/courses` | `studentSearch.js`, `studentCourses.js` | `student_profile_tb`, `basic_setup_course_tb` |
| US-3 admission | `StudentAdmission.jsx` | `POST /api/students`, `GET /api/students/admission/options`, `GET /api/students/admission/degrees` | `studentAdmission.js` | `student_profile_tb`, mark-sheet table (see `buildProfileInsertRow`/`saveMarkSheets` in `studentAdmission.js`) |
| US-4 edit profile | `StudentProfile.jsx` (Edit tab) | `GET /api/students/:id`, `PUT /api/students/:id` | `studentProfile.js` | `student_profile_tb`, `student_academic_tb` |
| US-5 status | `StudentProfile.jsx` (Status tab) | `PATCH /api/students/:id/status` | `studentStatus.js` | `student_profile_tb` |
| US-6 attachments upload | `StudentScreenPage.jsx` → `StudentAttachmentsPanel` | `GET /:id/attachments`, `POST /:id/attachments/upload`, `PUT /:id/attachments` | `studentAttachments.js` | attachment table(s) referenced by `studentAttachments.js` |
| US-7 attachments report | `AttachmentsReportPanel` (in `StudentScreenPage.jsx`) | `POST /api/students/screens/attachments-report/load` | `studentModuleScreens.js` → `screens/reportScreens.js` | `student_profile_tb` + attachment tables |
| US-8 ID card | `StudentIdCardPanel.jsx` | `POST /api/students/screens/id-card/load` | `studentIdCardBuilder.js` | `student_profile_tb` |
| US-9 promote | `PromotePanel.jsx` | `POST /api/students/screens/promote/load|save` | `promoteHelpers.js` | `student_academic_tb`, `basic_setup_course_tb`, `basic_setup_tb` |
| US-10 report builder | `StudentReport.jsx` | `GET /reports/fields`, `GET /reports/filters`, `POST /reports/generate` | `studentReport.js` | `student_profile_tb`, `student_academic_tb` |
| US-11 alumni edit | `AlumniEditPanel.jsx` | `POST /api/students/screens/alumni-edit/load|save` | `studentModuleScreens.js` → `screens/actionScreens.js` | alumni table(s) + `student_profile_tb` (fallback prefill) |
| US-E1/E2 duplicate keys | `StudentAdmission.jsx` / `StudentProfile.jsx` | `POST /api/students` / `PUT /api/students/:id` | `studentAdmission.js` / `studentProfile.js` | `student_profile_tb` |
| US-E3 zero-date active | `StudentProfile.jsx` | `GET /api/students/:id` | `studentProfile.js` (`normalizeLegacyDate`) | `student_profile_tb.releaving_date` |
| US-E12 re-promotion | `PromotePanel.jsx` | `POST /api/students/screens/promote/save` | `promoteHelpers.js` | `student_academic_tb` |
| US-E15 permission denial | any `/students/*` route | all `/api/students/*` | `server/src/middleware/menuAuth.js` (`menuAuthForModule('students')`) | `authentication_tb`, `basic_admin_menu_tb` |

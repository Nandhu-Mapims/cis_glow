# 20 — SMS / Communication

## 1. Module overview

**Purpose.** The SMS module lets staff broadcast text messages to students, staff, parents, and
ad-hoc groups, manage reusable message templates and mobile-number groups, and review a history
of everything sent. It does **not** integrate with any live SMS gateway in this native port —
every "send" ends in a single row written to `sms_message_tb` with `sms_report: 'queued'`
(`recordSmsSend` in `server/src/services/sms/smsShared.js:326-364`). There is no outbound HTTP
call to a telecom aggregator anywhere in `server/src/services/sms/`; the actual gateway dispatch,
if it exists at all in production, is presumably still handled by the legacy PHP cron
(`SMS Cron`, linked from the hub, but its screen lives under `/settings/setup/sms-cron`, outside
this module's own files).

**Primary actors.**
- **Class teachers / office staff** — send batch SMS to students by course/year/batch
  (`student-sms`) or to parents ahead of a PTM (`parent-meeting-sms`).
- **HR / admin office staff** — send SMS to staff by job category (`staff-sms`).
- **Any staff with SMS module access** — send to arbitrary saved groups (`group-sms`), manage
  those groups (`group-add`, `group-edit`), manage reusable templates (`sms-template-add`,
  `sms-template-edit`), and audit what was sent (`sms-history`).

**Legacy PHP files replaced:**

| Legacy file | Screen slug |
|---|---|
| `student_sms.php` | `student-sms` |
| `staff_sms.php` | `staff-sms` |
| `group_sms.php` | `group-sms` |
| `parent_meeting_sms.php` | `parent-meeting-sms` |
| `student_sms_history.php` | `sms-history` |
| `sms_template.php` (legacy combined add/edit; native port splits it) | `sms-template-add`, `sms-template-edit` |
| `group_add.php` | `group-add` |
| `group_edit.php` | `group-edit` |

Note: the native `smsSetup.js` dispatcher also registers a `sms-template` screen key
(`loadSmsTemplate`/`saveSmsTemplate` in `server/src/services/sms/smsTemplate.js`), but no
`SMS_SCREEN_META` entry or client component maps to it — it is reachable only by calling
`POST /api/sms/setup/sms-template/load|save` directly, not through any menu link or hub tile.
Treat it as dead/legacy-compat surface unless a caller is found.

## 2. Screen inventory

Base client route for factory screens: `/sms/setup/:screen`; hub `/sms`. All screens run through
the generic `createSetupApi`/`createModuleSetupPage` factory (`client/src/pages/sms/SmsModule.jsx`).

| Screen | Route | Component | Server load/save | Legacy `.php` |
|---|---|---|---|---|
| Hub | `/sms` | `SmsHub` (`createModuleHub`, no dashboard) | — | — |
| Setup hub | `/sms/setup` | `SmsSetupHub` (`createModuleSetupHub`) | — | — |
| `student-sms` | `/sms/setup/student-sms` | `SmsSendScreen` (`studentMode`, `groupKey="selectedCourses"`) | `POST /api/sms/setup/student-sms/load\|save` | `student_sms.php` |
| `staff-sms` | `/sms/setup/staff-sms` | `SmsSendScreen` (`groupMode`, `groupKey="selectedGroups"`) | `POST /api/sms/setup/staff-sms/load\|save` | `staff_sms.php` |
| `group-sms` | `/sms/setup/group-sms` | `SmsSendScreen` (`groupMode`, `groupKey="selectedGroups"`) | `POST /api/sms/setup/group-sms/load\|save` | `group_sms.php` |
| `parent-meeting-sms` | `/sms/setup/parent-meeting-sms` | `ParentMeetingSmsScreen` | `POST /api/sms/setup/parent-meeting-sms/load\|save` | `parent_meeting_sms.php` |
| `sms-history` | `/sms/setup/sms-history` | `SmsHistoryScreen` | `POST /api/sms/setup/sms-history/load\|save` | `student_sms_history.php` |
| `sms-template-add` | `/sms/setup/sms-template-add` | `SmsTemplateAddScreen` | `POST /api/sms/setup/sms-template-add/load\|save` | `sms_template_add.php` |
| `sms-template-edit` | `/sms/setup/sms-template-edit` | `SmsTemplateEditScreen` | `POST /api/sms/setup/sms-template-edit/load\|save` | `sms_template_edit.php` |
| `group-add` | `/sms/setup/group-add` | `SmsGroupAddScreen` | `POST /api/sms/setup/group-add/load\|save` | `group_add.php` |
| `group-edit` | `/sms/setup/group-edit` | `SmsGroupEditScreen` | `POST /api/sms/setup/group-edit/load\|save` | `group_edit.php` |
| (unreachable via UI) `sms-template` | — | none | `POST /api/sms/setup/sms-template/load\|save` | `sms_template.php` |
| SMS Cron (extra hub link, not part of this module's files) | `/settings/setup/sms-cron` | (settings module) | — | — |

Server routes (`server/src/routes/sms.js`), gated by `authMiddleware` + `menuAuthForModule('sms')`:
- `POST /api/sms/setup/:screen/load` → `loadSmsScreen(screen, fields, memberId, query, audit)`
  (`server/src/services/sms/smsSetup.js`). Unknown screen → `{error:'Unknown SMS screen'}` → HTTP
  400 `{message:'Unknown SMS screen'}`.
- `POST /api/sms/setup/:screen/save` → `saveSmsScreen(screen, fields, memberId, files, audit)`.
  Every screen in `SAVERS` accepts writes (no read-only screens in this module, unlike NAAC/
  Elearning) — including report-style screens (`sms-history`) whose "save" is really just a
  server-side re-run of the search (`saveSmsHistory` calls `loadSmsHistory` with
  `action:'search'`).

## 3. Pixel-level flow per screen

### 3.0 Shared factory contract

`useSmsSetupApi = createSetupApi('/api/sms')` (`client/src/pages/sms/SmsModule.jsx:12`). Per
`client/src/hooks/createSetupApi.js`: `load(fields, query)` POSTs to `.../load`, results cached
client-side for 60s per exact `(fields, query)` JSON key (`cachedGet`, `ttlMs: 60_000`); `save`
POSTs to `.../save`, invalidates the load cache prefix on success, merges the response (minus
`message`/`success`/`error`) into `data`, and sets a transient `notice` banner from
`res.data.message` (or an `error` banner from `res.data.message` if `success === false`, or from
`res.data.error` if present — a hard 400). `createModuleSetupPage` (`ModuleSetupFactory.jsx`)
wraps this in `SetupPageShell` with a `loading` spinner during the mount-time `load()`, and passes
`data, busy, readOnly, onLoad, onSave` to the mapped component. No screen in `SMS_SCREEN_META` sets
`readOnly: true`.

### 3.1 `student-sms` — Student SMS (`student_sms.php`)

Component: `SmsSendScreen` rendered with `studentMode` → internally `StudentSmsFlow`
(`client/src/pages/sms/setup/SmsSendScreen.jsx:401-763`). Three visual "steps" (not literal
labels but a stepper bar): **"Select batches"**, **"Review recipients"**, **"Compose & send"**
(step index computed from `!mobilesLoaded` / `!message.trim()`).

Left panel (`col-md-5`), header **"Class / batch"** (the `groupLabel` prop) with a badge showing
`{selected.length} selected`:
1. **Search `<input type="search">`**, placeholder `"Search class or batch…"` — filters
   `data.courseGroups` (each group has a `label` and nested `options`) by option label or group
   label substring match.
2. Nested checkbox list, one group-header checkbox per course/batch group (indeterminate state
   supported via a raw DOM `ref` callback) and one checkbox per year option, label text is the
   option's `label` with any trailing `" (n)"` count stripped, plus a separate pill badge showing
   `opt.mobileCount ?? 0`.
3. **"Load recipients"** button (`btn btn-primary w-100`), label toggles to `"Loading…"` while
   `busy`; disabled if `busy` or nothing selected. Calls
   `onLoad({ action:'preview', selectedCourses: selected, message, templateId })`.

Right panel (`col-md-7`):
- Before load: empty state, icon `fa-users`, heading **"No recipients loaded yet"**, text
  *"Select one or more class/batch rows on the left, then click **Load recipients**."*
- After load: **"Recipients"** panel header with badge `{recipients.length} mobile(s)`; a
  **search `<input type="search">`**, placeholder `"Search name or mobile…"`; a
  **"Edit comma list" / "Hide raw list"** toggle button; either a raw
  `<textarea>` (placeholder `"9999999999,9999999999"`) with helper text `"Max 100 numbers. Total:
  {n}"` and an **"Apply list"** button, or a table (`Mobile | Student | ` trash-icon column) with
  a per-row remove (`fa-times`) button and empty-search row `"No recipients match your search."`.
- **"Message"** panel: if `data.templates` non-empty, a **"Quick templates"** row of buttons
  labeled `tpl.sample || tpl.templateId` that overwrite `message`/`templateId` on click.
  **"Template ID"** required text input. **"SMS text"** label with a live `{charCount} chars`
  counter, required `<textarea rows={5}>` — **no client-side character-limit enforcement**
  (see US-20.8).
- Submit: first click on **"Send SMS"** (`btn btn-danger`, disabled if `busy`, no recipients, empty
  message, or empty template ID) does not send — it flips to a confirm banner: *"Send SMS to
  **{n}** recipient(s)?"* with **"Confirm send"** (`btn btn-danger btn-sm`) and **"Cancel"**
  (`btn btn-outline-secondary btn-sm`). Only "Confirm send" actually calls
  `onSave({ selectedCourses: selected, mobiles, message, templateId })`.

Server load (`loadStudentSms`, `server/src/services/sms/studentSms.js`): course/batch options via
`loadCourseSmsOptions()` (`smsShared.js:148-162`, itself built on `basic_setup_course_tb` +
`basic_setup_tb` academic years + a live `student_profile_tb`/`student_academic_tb` count of
students with a non-empty `mobile_no` per `course_id___academic_year___current_year___academic_type`
slot). If `selectedCourses` provided, resolves mobiles via `resolveCourseSlotMobiles` (raw SQL,
`WHERE del=1 AND mobile_no != '' AND (releaving_date > CURDATE() OR releaving_date='0000-00-00')`)
with student names attached. Logs `logModulePage('student_sms.php','View',...)` on every load.

Server save (`saveStudentSms`): if `payload.action==='preview'`, delegates straight back to
`loadStudentSms` (no send, no `sms_message_tb` write) — this is how the "Load recipients" button's
`onLoad` call and any preview round-trip work even though it hits the `/save` route in some flows.
A real send calls `recordSmsSend({ registerNo: selected.join(', '), mobiles, messageType:'Student
Announcement', message, templateId })` (`smsShared.js:326`), which **requires** both a non-empty
mobile list and a non-empty trimmed message — otherwise returns
`{ success:false, message:'Message and mobile numbers are required' }` (client-side validation
already blocks this via the disabled Send button, but the server re-checks). On success, creates
one `sms_message_tb` row (`sms_report:'queued'`, `mobile_no` joined with `', '`) and logs
`logModulePage('student_sms.php','Send SMS','Successful', sentCount, ...)`, returning
`{ success:true, message:'Message queued for {n} mobile(s)...', sentCount }` merged with a fresh
`loadStudentSms({})` payload (so the form resets to no-selection state after send).

### 3.2 `staff-sms` — Staff SMS (`staff_sms.php`)

Component: `SmsSendScreen` with `groupMode`, `groupKey="selectedGroups"`, `groupLabel="Category"`,
`showRecipientNames`, `stepSelectLabel="Select categories"`,
`searchPlaceholder="Search categories…"`, `emptyHint="Select staff categories on the left, then
click Load recipients."` → internally `GroupSmsFlow`
(`client/src/pages/sms/setup/SmsSendScreen.jsx:48-399`). Same three-step stepper, same
"Load recipients"/"Send SMS"/confirm-banner mechanics as 3.1, but left panel is a **flat**
checkbox list (no nested groups) of `data.groups` (`group.title` + `` (mobileCount)``) with a
**"Select all shown"** checkbox above the list. Right panel recipient table shows a **Name**
column (since `showRecipientNames` is true) in addition to Mobile.

Server load (`loadStaffSms`, `server/src/services/sms/staffSms.js`): groups from
`loadStaffCategorySmsGroups()` — `staff_profile_tb` joined to `edu_setup_tb WHERE category =
'Category'`, active (`del=1`, not yet relieved, non-empty `mobile_1`), grouped by category with a
count. Selected-group mobiles resolved via `resolveStaffCategoryMobiles` (same active-staff
filter). Logs `logModulePage('staff_sms.php','View',...)`.

Server save (`saveStaffSms`): same preview/send split as student-sms;
`recordSmsSend({ messageType:'Staff Announcement', ... })`; success message identical format
(`'Message queued for {n} mobile(s)...'`); logs `'Send SMS'`.

### 3.3 `group-sms` — Group SMS (`group_sms.php`)

Component: `SmsSendScreen` with `groupMode`, `groupKey="selectedGroups"`,
`groupLabel="SMS groups"`, `stepSelectLabel="Select groups"`,
`searchPlaceholder="Search groups…"`, default `emptyHint` (no `showRecipientNames`, so the
recipient table shows only a Mobile column, no Name). Same `GroupSmsFlow` mechanics.

Server load (`loadGroupSms`, `server/src/services/sms/groupSms.js`): groups from
`loadStaffSmsGroups()` (`sms_group_tb`, `del=1` — the same table `group-add`/`group-edit`
maintain), each group's `mobiles` parsed from its stored `group_mobile` text via
`parseMobileList` (regex-extracts valid 10-digit Indian mobile numbers, tolerant of `91`-prefixed
12-digit numbers, comma/newline/semicolon-separated or embedded in free text). Selected-group
mobiles de-duplicated across groups. Logs `logModulePage('group_sms.php','View',...)`.

Server save (`saveGroupSms`): `messageType:'Announcement'`; otherwise identical preview/send
pattern; logs `'Send SMS'`.

### 3.4 `parent-meeting-sms` — Parent Message (`parent_meeting_sms.php`)

Component: `ParentMeetingSmsScreen` (`client/src/pages/sms/setup/ParentMeetingSmsScreen.jsx`).
Not a stepper flow — a single-page form, `onLoad()` fired unconditionally on mount (no fields, so
it always re-fetches course options fresh, unlike the cached step-flows above).

Fields in DOM order:
1. **"Class"** label, `<select multiple size={10}>` — options from `data.courseOptions` (built by
   `loadParentCourseOptions()`, same course/year/batch slot universe as student SMS but labeled
   `` `${degree}${dept} ${romanYearNumeral} (${batch})` ``, e.g. `"BDS - Dental III (regular)"`).
2. **"Meeting Title"** text `<input>`.
3. **"Date & Time"** `<input type="datetime-local">`.
4. **"Preview recipients"** button (`btn btn-outline-info btn-sm`, disabled while `busy`) — calls
   `onLoad({ action:'preview', search_course: selectedCourses, meeting_name: meetingName,
   meeting_date: meetingDate })`.
5. If `data.recipientCount > 0`: info alert **"{n} parent mobile(s) ready to send."**
6. If `data.recipients.length > 0`: table `Register No | Student | Parent Mobile`, capped to the
   first 50 rows client-side with caption `"Showing first 50 of {n} recipients."` if more exist
   (the full unsliced list is still submitted on send — only the *display* is capped).
7. **"Send SMS"** submit button (`btn btn-danger`), disabled if `busy`, no `recipientCount`, empty
   meeting name, or empty meeting date. Submits
   `{ search_course: selectedCourses, meeting_name, meeting_date, mobiles: data?.mobiles,
   templateId: data?.templateId }`.

Server load (`loadParentMeetingSms`, `server/src/services/sms/parentMeetingSms.js`): resolves
recipients only when `fields.action === 'preview'` and courses are selected, via
`loadParentRecipients` — queries `student_profile_tb`/`student_academic_tb` per selected slot,
filtering on `father_mobile_1 != ''` (parent's mobile, distinct from the student's own
`mobile_no` used by `student-sms`), active/not-released. `templateId` is always the fixed literal
`'ptm_schedule'` (`TEMPLATE_ID` constant) — there's no template picker on this screen; the message
body is generated server-side, not typed by the user (see save below).

Server save (`saveParentMeetingSms`): **requires** `meeting_name` and `meeting_date` — if either
is blank, returns `{ success:false, message:'Meeting title and date/time are required.' }` before
touching the DB (this mirrors the client's disabled-button gating but is also enforced
server-side). Re-resolves recipients server-side from the submitted `search_course` (does not
trust the client's `mobiles` unless present). Builds the actual outbound
`sampleMessage` as `` `${meetingName} | ${date} | ${time}` `` where `date`/`time` come from
`formatMeetingDate` (`DD-MM-YYYY` and localized 12-hour time) — **the free-text "Meeting Title"
the user typed becomes part of the literal SMS body**, unlike the other three send screens where
the user types the full message themselves. Calls `recordSmsSend({ messageType:'Parent Meeting',
templateId:'ptm_schedule', message: sampleMessage })`; logs `logModulePage('parent_meeting_sms.php',
'Send SMS', ...)` on success.

### 3.5 `sms-history` — SMS Report (`student_sms_history.php`)

Component: `SmsHistoryScreen` (`client/src/pages/sms/setup/SmsHistoryScreen.jsx`). `onLoad({
action:'search', ...filters })` fires on mount with default filters (`mobile:''`, `user_by:''`,
`from_date: today`, `to_date:''`).

Left filter card (`col-lg-3`), header **"Filter"**:
1. **"Mobile No"** text `<input>`.
2. **"User"** `<select>`, placeholder `"--Select--"`, options `data.senders` (label = sender's
   `member_name`, restricted server-side to accounts that have actually sent at least one message
   — see below).
3. **"From"** `<input type="date">`, `max` capped to the current `to_date` value.
4. **"To"** `<input type="date">`, `min` floored to the current `from_date` value.
5. **"Search"** submit button (`btn btn-danger w-100`).

Right panel (`col-lg-9`): if `data.rows` is empty, plain text **"No data found..."** (styled
`text-danger`, not a table empty-row — different pattern from the template/group screens' `"No
data available"` table row). Otherwise a bordered table: `S.No. | Date | Purpose | Mobile Number
| Count | Sample Message | User` — Date formatted via `formatDisplayDate` (`en-IN`
`DD/MM/YYYY, hh:mm`), Sample Message rendered with `white-space: pre-wrap`.

Server (`loadSmsHistory`, `server/src/services/sms/smsHistory.js`): only actually queries
`sms_message_tb` when `fields.action === 'search'` or `fields.Submit === 'Search'` — otherwise
`rows` stays `[]` even though `filters`/`senders` are always computed. Filter conditions built as
raw SQL string fragments (`del=1 AND mobile_no != ''`, plus optional `DATE(created_dt) >=/<=`,
`created_by = <userBy>`, and a mobile filter that **OR**s a `LIKE '%part%'` clause per
comma-separated fragment the user typed into "Mobile No" — so typing `"98,99"` matches any message
whose `mobile_no` field contains either substring, not an exact-match list). `senders` restricted
to `web_account_setup` accounts with an `EXISTS` match against at least one `sms_message_tb` row
they created (`del=1`), capped at 300, so a brand-new account that has never sent an SMS never
appears in the "User" dropdown even if it has SMS module access. The **"Search"** form's own
submit handler calls `onSave` (not `onLoad`) with `Submit:'Search'` — `saveSmsHistory` just proxies
back into `loadSmsHistory` (this screen has no real "write" despite being wired through the save
endpoint).

### 3.6 `sms-template-add` — Add Template (`sms_template_add.php`)

Component: `SmsTemplateAddScreen` (`client/src/pages/sms/setup/SmsTemplateAddScreen.jsx`). No
`onLoad` call at all (no `useEffect`) — the form starts from local blank state
`{ templateId:'', content:'', sample:'' }` every mount.

Fields in DOM order: **"Title"** (maps to `sample`, required), **"Template ID"** (required),
**"Template Content"** `<textarea rows={5}>` (required). **"Save"** submit button (`btn
btn-danger`, disabled while `busy`) — on success the local form resets to blank again
(`setForm({ templateId:'', content:'', sample:'' })` runs unconditionally after `await onSave`,
even if the save actually failed server-side — see US-20.9).

Server (`loadSmsTemplateAdd`/`saveSmsTemplateAdd`, `server/src/services/sms/smsTemplateAdd.js`):
load just logs a view and returns an empty form shape (unused by the client, which never calls
`onLoad`). Save delegates to the shared `saveSmsTemplate` (`smsTemplate.js`) — requires non-empty
`templateId` and `content` (`sample`/Title is not validated server-side despite being `required`
on the client input) — else `{success:false, message:'Template ID and content are required'}`.
Inserts a new `sms_template_tb` row (`del:1` via `auditFields`), logs
`logModulePage('sms_template_add.php','Add',...)`.

### 3.7 `sms-template-edit` — Edit Template (`sms_template_edit.php`)

Component: `SmsTemplateEditScreen` (`client/src/pages/sms/setup/SmsTemplateEditScreen.jsx`).
`onLoad()` fires on mount with no fields.

List view: search `<input>` placeholder `"Search templates..."` + **"Search"** button (`btn
btn-info`), a page-status caption `"Showing page {page} of {totalPages} ({total} total)"` once
`data.total` is known. Table `Template ID | Template | ` (third column unlabeled, holds actions);
each `Template` cell renders `{sample} : {content}` concatenated. Per-row **"Edit"** (`btn
btn-sm btn-primary`) and **"Delete"** (`btn btn-sm btn-danger`) buttons — Delete has **no confirm
dialog/step** (unlike the send screens' confirm-banner pattern), it fires
`onSave({ action:'delete', delete:'Confirm', confirm: String(tpl.id), search, page })`
immediately on click. Empty state: single table row **"No data available"** spanning all columns.
Pagination: **"Previous"**/**"Next"** buttons (`btn btn-sm btn-outline-secondary`), shown only if
`totalPages > 1`, disabled at the first/last page respectively.

Edit view (replaces the list when `data.editing` is set, triggered by clicking "Edit" which calls
`reload({ editId: tpl.id })`): **"Title"** (`sample`), **"Template ID"** (`templateId`),
**"Template Content"** `<textarea rows={5}>` (`content`) — all required. **"Save"** (`btn
btn-danger`) and **"Cancel"** (`btn btn-outline-secondary`, clears local `editing` state without
saving) buttons.

Server (`loadSmsTemplateEdit`/`saveSmsTemplateEdit`,
`server/src/services/sms/smsTemplateEdit.js`): search matches `sample_message`, `sms_template`,
or `template_id` via `LIKE '%q%'`, `del=1`, paginated 20/page, ordered `created_dt DESC`. Save
delete path: soft-deletes (`del=0`) via raw SQL requiring a numeric `confirm`/`id`, returns
`'Template deleted...'`. Save edit path: requires `id`, `templateId`, `content` non-empty (Title
not enforced server-side, same gap as Add) → else `{success:false, message:'Template ID and
content are required.'}` (note trailing period differs from the Add screen's message — a minor
text inconsistency); updates in place, message `'Template updated...'`.

### 3.8 `group-add` — Add Group (`group_add.php`)

Component: `SmsGroupAddScreen` (`client/src/pages/sms/setup/SmsGroupAddScreen.jsx`). No `onLoad`.
Fields: **"Title"** (required), **"Mobile No. (comma-separated, max 100)"** `<textarea rows={4}>`
(required) — the "max 100" is UI copy only, **not enforced** anywhere in `saveSmsGroupAdd` (no
count check on `groupMobile`). **"Save"** submit (`btn btn-danger`), payload
`{ group_title, group_mobile, Submit:'Update' }` (the `Submit:'Update'` field is legacy-form
compat cruft the native service never reads). Resets to blank form after any `onSave` resolves,
success or not.

Server (`smsGroupAdd.js`): requires non-empty `group_title` and `group_mobile` (raw, unparsed —
stored as free text, not normalized into individual numbers at save time; parsing into a mobile
list happens later, on-demand, wherever the group is *used* via `parseMobileList`). Inserts into
`sms_group_tb`, `del:1`; logs `logModulePage('group_add.php','Add',...)`; message `'Group
added...'`.

### 3.9 `group-edit` — Edit Group (`group_edit.php`)

Component: `SmsGroupEditScreen` (`client/src/pages/sms/setup/SmsGroupEditScreen.jsx`). Structurally
identical to `sms-template-edit` (search + paginated table + inline edit/delete), operating on
`sms_group_tb` instead. Table columns: `Title | Mobiles | ` (Mobiles cell rendered
`white-space:pre-wrap`, showing the full raw stored string). Same immediate (no-confirm) Delete
button behavior, same `"No data available"` empty row, same Previous/Next pagination.

Server (`smsGroupEdit.js`): search matches `group_title`/`group_mobile` via `LIKE`; delete
soft-deletes (`del=0`); edit requires `id`, `groupTitle`, `groupMobile` non-empty → message
`'Title and mobile numbers are required.'`; success messages `'Group deleted...'` /
`'Group updated...'`.

## 4. Primary user stories

**US-20.1 — Send SMS to a class/batch of students**
As a **class teacher/office staff member**, I want to pick one or more course/year/batch rows on
Student SMS, load their mobile numbers, compose a message (optionally starting from a saved
template), and confirm-send it, so that the whole batch is notified in one action.
*Acceptance criteria:* "Send SMS" is disabled until at least one recipient is loaded and both
Template ID and SMS text are non-empty; clicking it shows a confirm banner
(`"Send SMS to {n} recipient(s)?"`) before the actual `recordSmsSend` write happens; the send
result is a single `sms_message_tb` row with `sms_report:'queued'`, not an immediate delivery.

**US-20.2 — Send SMS to staff by job category**
As an **HR/admin office staff member**, I want to select one or more staff job categories on
Staff SMS, preview the resolved mobile numbers with names, and send a message, so that an entire
department/category is reached without looking up numbers manually.
*Acceptance criteria:* only active staff (`del=1`, not yet relieved) with a non-blank `mobile_1`
and a category row where `edu_setup_tb.category='Category'` are counted/resolved.

**US-20.3 — Send SMS to a custom saved group**
As **any staff member with SMS access**, I want to select one or more previously-created SMS
groups on Group SMS and send them a message, so that ad-hoc recipient lists (e.g. a committee, a
specific parent set) don't need to be rebuilt every time.
*Acceptance criteria:* group membership resolves via `parseMobileList` against each group's
free-text `group_mobile` field at send time, not at group-creation time, so editing a group's
number list changes who future sends reach.

**US-20.4 — Notify parents of an upcoming PTM**
As **office staff**, I want to select classes, enter a meeting title and date/time, preview how
many parent mobiles will receive it, and send, so that parents are informed of a parent-teacher
meeting via SMS built from a consistent template.
*Acceptance criteria:* "Send SMS" stays disabled until `recipientCount > 0` and both title and
date/time are filled; the actual SMS body sent is server-generated as
`"{title} | {DD-MM-YYYY} | {time}"`, not the raw title alone.

**US-20.5 — Audit what was sent, by date/user/mobile**
As an **admin/reporting staff member**, I want to filter SMS History by date range, sender, and/or
mobile number substring, so that I can verify a specific message went out or investigate a
complaint.
*Acceptance criteria:* the "User" dropdown only lists accounts that have sent at least one
message historically; an empty result set shows literal text `"No data found..."`, not a blank
table.

**US-20.6 — Maintain reusable message templates**
As **any staff member with SMS access**, I want to add new templates and search/edit/delete
existing ones from Add/Edit Template, so that common messages (fee reminders, event notices) can
be reused with one click from the "Quick templates" row on send screens.
*Acceptance criteria:* Template ID and Content are required server-side on both add and edit; the
"Title" (`sample`) field is required in the UI but **not** enforced server-side, so a template
saved with client-side validation bypassed (e.g. a scripted request) can persist with an empty
Title.

**US-20.7 — Maintain custom SMS groups**
As **any staff member with SMS access**, I want to add new groups (title + comma-separated mobile
list) and search/edit/delete existing ones, so that recipient sets used repeatedly across sends
don't need to be re-typed.
*Acceptance criteria:* Title and mobile-number text are both required server-side; the UI's "max
100" hint on the mobile textarea is not enforced anywhere — a group can be saved with any number
of entries.

## 5. Rare / edge-case user stories

**US-20.8 — Sending to zero recipients**
As a **user on any of the three step-flow send screens** (Student/Staff/Group SMS), if my
selected course/category/group resolves to zero valid mobile numbers (e.g. every student in that
batch has a blank `mobile_no`, or a group's `group_mobile` text has no recognizable 10-digit
numbers), the "Load recipients" step still completes (`mobilesLoaded` flips true) but the
recipient table renders the warning alert *"No valid 10-digit mobile numbers found in the selected
group(s). Some groups may store message text instead of numbers — update them under **SMS → Edit
Group**."* — visible only in the group-mode flows (`GroupSmsFlow`), not surfaced identically in
`StudentSmsFlow`, which just shows an empty recipient table with no equivalent warning text. The
"Send SMS" button stays disabled (`recipients.length === 0`) either way, and if bypassed via a
direct API call, `recordSmsSend` independently rejects an empty mobile list server-side
(`{success:false, message:'Message and mobile numbers are required'}`).

**US-20.9 — No SMS gateway integration — "send" only queues a database row**
As **any user of any send screen**, be aware that clicking "Confirm send" never calls an external
SMS gateway from this native code path — `recordSmsSend` (`smsShared.js:326-364`) only inserts a
row into `sms_message_tb` with `sms_report: 'queued'` and returns success. There is no
gateway-failure/timeout handling to speak of in this module because there is no gateway call to
fail; the promised `"Message queued for {n} mobile(s)..."` text intentionally says "queued," not
"sent." If actual delivery depends on `SMS Cron` (linked from the hub but outside this module's
files) reading `sms_message_tb` and forwarding to a real aggregator, a cron failure or backlog
would leave rows permanently `'queued'` with **no UI in this module surfacing delivery status** —
`sms-history` shows `sample_message`/`mobile_no`/count but no delivery-status column at all.

**US-20.10 — Message exceeding a practical SMS character limit**
As a **user composing a message** on any send screen, the "SMS text" `<textarea>` shows a live
`{charCount} chars` counter but enforces **no maximum length** anywhere client- or server-side —
neither `SmsSendScreen.jsx` nor `recordSmsSend`/`saveStudentSms`/`saveStaffSms`/`saveGroupSms`
check message length against the traditional 160-character (or 70-character Unicode) single-SMS
segment limit. A very long message is stored verbatim in `sample_message` and queued; actual
multi-segment billing/concatenation behavior would depend entirely on the (absent, per US-20.9)
downstream gateway, not on anything in this module.

**US-20.11 — Duplicate campaign send**
As a **user who double-clicks "Confirm send" or resubmits after a slow response**, note the send
button is `disabled={busy}` while a save is in flight, which should prevent a literal double-click
race in the UI — but there is no server-side idempotency key/dedupe check in `recordSmsSend`: two
distinct save requests with identical `mobiles`/`message`/`templateId` (e.g. from a second browser
tab, a retried request after a timeout where the first actually succeeded, or two staff members
independently sending the same PTM notice) each create their own separate `sms_message_tb` row
and each report success — recipients would receive the message twice with no dedupe warning
anywhere in this module.

**US-20.12 — Immediate, non-confirmed template/group deletion**
As a **user on Edit Template or Edit Group**, unlike the send screens' explicit confirm-banner
step, clicking **"Delete"** fires the soft-delete (`del=0`) immediately with no confirmation
dialog — a misclick removes a template or group from all future dropdowns/quick-template lists
right away (though soft-deleted, so recoverable at the DB level via `del=1` restore, nothing in
this UI offers an "undo" or restore screen).

### Future (not implemented)

- *(Future — not implemented)* **Real SMS gateway integration with delivery-status webhooks** —
  directly closing the gap in US-20.9: replace the `sms_report:'queued'` placeholder with an
  actual outbound call to a telecom aggregator, and add a webhook receiver that updates
  `sms_message_tb.sms_report` to `delivered`/`failed`/etc., surfaced as a new status column on
  `sms-history`. `mobile.md` does not mention SMS specifically (it is an admin/back-office
  workflow, explicitly out of scope for the mobile v1 read-only screens per `mobile.md` §6's
  table, which only lists Circulars/Notices as the push-notification-worthy item) — this
  extrapolation is grounded in the existing `sms_report` column already present in the schema but
  unused beyond the literal string `'queued'`.
- *(Future — not implemented)* **Character-limit / segment-count enforcement**, addressing
  US-20.10 — a live "N segments, M/160 chars" indicator and a soft warning (not necessarily a hard
  block) before send, consistent with how most SMS gateways bill per 160/70-char segment.
- *(Future — not implemented)* **Send idempotency / duplicate-campaign guard**, addressing
  US-20.11 — e.g. hashing `(mobiles, message, templateId)` within a short time window and warning
  "You just sent this same message N minutes ago — send again?" before allowing a second
  `recordSmsSend` call.
- *(Future — not implemented)* **Push notifications as a mobile-native alternative/complement to
  SMS** — `mobile.md` §8 explicitly flags push notifications (for circulars, fee due, attendance
  alerts) as "no push infrastructure today... this *is* new backend surface — flag and scope
  separately, get sign-off before building." The same new `server/src/services/push/` sender
  concept could reasonably extend to SMS-triggering workflows in this module (e.g. a PTM notice
  fanning out to both SMS and a push notification), but this is speculative extrapolation beyond
  anything `mobile.md` states about the SMS module specifically.
- *(Future — not implemented)* **Confirm-before-delete for templates/groups**, addressing
  US-20.12 — reusing the same confirm-banner pattern already built for the three send screens
  (`confirmSend` state in `SmsSendScreen.jsx`) on the Edit Template/Edit Group Delete buttons for
  UI consistency.

## 6. Traceability

| Story | Client file(s) | Server endpoint | Service file | Table(s) |
|---|---|---|---|---|
| US-20.1 | `SmsSendScreen.jsx` (`StudentSmsFlow`) | `POST /api/sms/setup/student-sms/load\|save` | `studentSms.js`, `smsShared.js` | `sms_message_tb`, `student_profile_tb`, `student_academic_tb`, `basic_setup_course_tb` |
| US-20.2 | `SmsSendScreen.jsx` (`GroupSmsFlow`, `staff-sms`) | `POST /api/sms/setup/staff-sms/load\|save` | `staffSms.js`, `smsShared.js` | `sms_message_tb`, `staff_profile_tb`, `edu_setup_tb` |
| US-20.3 | `SmsSendScreen.jsx` (`GroupSmsFlow`, `group-sms`) | `POST /api/sms/setup/group-sms/load\|save` | `groupSms.js`, `smsShared.js` | `sms_message_tb`, `sms_group_tb` |
| US-20.4 | `ParentMeetingSmsScreen.jsx` | `POST /api/sms/setup/parent-meeting-sms/load\|save` | `parentMeetingSms.js`, `smsShared.js` | `sms_message_tb`, `student_profile_tb`, `student_academic_tb` |
| US-20.5 | `SmsHistoryScreen.jsx` | `POST /api/sms/setup/sms-history/load\|save` | `smsHistory.js` | `sms_message_tb`, `web_account_setup` |
| US-20.6 | `SmsTemplateAddScreen.jsx`, `SmsTemplateEditScreen.jsx` | `POST /api/sms/setup/sms-template-add\|sms-template-edit/load\|save` | `smsTemplateAdd.js`, `smsTemplateEdit.js`, `smsTemplate.js` | `sms_template_tb` |
| US-20.7 | `SmsGroupAddScreen.jsx`, `SmsGroupEditScreen.jsx` | `POST /api/sms/setup/group-add\|group-edit/load\|save` | `smsGroupAdd.js`, `smsGroupEdit.js` | `sms_group_tb` |
| US-20.8 | `SmsSendScreen.jsx` (`GroupSmsFlow`, `StudentSmsFlow`) | `POST /api/sms/setup/*/save` (`action:'preview'`) | `smsShared.js` (`recordSmsSend`) | `sms_message_tb` |
| US-20.9 | all send screens | `POST /api/sms/setup/*/save` | `smsShared.js` (`recordSmsSend`) | `sms_message_tb` |
| US-20.10 | `SmsSendScreen.jsx` | `POST /api/sms/setup/*/save` | `studentSms.js`, `staffSms.js`, `groupSms.js`, `parentMeetingSms.js` | `sms_message_tb` |
| US-20.11 | `SmsSendScreen.jsx`, `ParentMeetingSmsScreen.jsx` | `POST /api/sms/setup/*/save` | `smsShared.js` (`recordSmsSend`) | `sms_message_tb` |
| US-20.12 | `SmsTemplateEditScreen.jsx`, `SmsGroupEditScreen.jsx` | `POST /api/sms/setup/sms-template-edit\|group-edit/save` | `smsTemplateEdit.js`, `smsGroupEdit.js` | `sms_template_tb`, `sms_group_tb` |

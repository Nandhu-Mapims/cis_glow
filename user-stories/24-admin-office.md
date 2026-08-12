# 24 — Admin Office

## 1. Module overview

Admin Office covers the college's back-office logistics that don't fit Students/Staff/Fees:
tracking student and staff **event participation** (competitions, prizes), logging **inward/
outward courier**, and logging **incidents** (accidents, first-aid events) with reporting.
There is also a stubbed **Events Group** screen that intentionally has no working save path.

**Primary actors**
- **Activities coordinator** — records student/staff participation in events and prizes won
  (`Student/Staff Activities — Add/Edit`).
- **Front-office / mailroom staff** — logs courier in/out (`Courier Add/Edit/Report`).
- **Safety/admin staff** — logs incidents and first-aid response (`Incident Add/Edit/Report`).

**Legacy PHP files replaced** (per `server/src/services/adminOffice/setup/activitiesSetup.js`
`pageFor()` and the other setup files' `PAGE` constants, cross-checked against
`client/src/utils/legacyRoutes.js` lines 239–249):

| Legacy file | Modern screen |
|---|---|
| `student_activities_add.php` | Student Activities — Add |
| `student_activities_edit.php` | Student Activities — Edit |
| `staff_activities_add.php` | Staff Activities — Add |
| `staff_activities_edit.php` | Staff Activities — Edit |
| `courier_add.php` | Courier Add |
| `courier_edit.php` | Courier Edit |
| `courier_report.php` | Courier Report |
| `incident_add.php` | Incident Add |
| `incident_edit.php` | Incident Edit |
| `incident_report.php` | Incident Report |
| `events_group_add.php` | Events Group (stub — no working save) |

Server dispatcher: `server/src/services/adminOffice/adminOfficeSetup.js`. Route:
`server/src/routes/adminOffice.js`, mounted at `/api/admin-office`
(`server/src/app.js` line 120), guarded by `authMiddleware` +
`menuAuthForModule('adminOffice')`.

Core tables: **`event_tb`** + **`event_participant_tb`** (activities), **`courier_tb`**
(courier log), **`incident_tb`** (incident log). Shared lookups from
`server/src/services/adminOffice/shared.js`: `staff_dept_master` (department dropdown/label
map) and `basic_setup_tb.ug_academic_year` (stamped onto new events).

## 2. Screen inventory

| Route | Component file | Legacy `.php` |
|---|---|---|
| `/admin-office` | `client/src/pages/adminOffice/AdminOfficeHub.jsx` | (hub) |
| `/admin-office/setup/student-activities-add` | `client/src/pages/adminOffice/setup/ActivitiesAddSetup.jsx` | `student_activities_add.php` |
| `/admin-office/setup/student-activities-edit` | `client/src/pages/adminOffice/setup/ActivitiesEditSetup.jsx` (re-exports `ActivitiesEditSetup` from `ActivitiesAddSetup.jsx`) | `student_activities_edit.php` |
| `/admin-office/setup/staff-activities-add` | `ActivitiesAddSetup.jsx` (same component, `eventFor='staff'`) | `staff_activities_add.php` |
| `/admin-office/setup/staff-activities-edit` | `ActivitiesEditSetup.jsx` (same, `eventFor='staff'`) | `staff_activities_edit.php` |
| `/admin-office/setup/courier-add` | `client/src/pages/adminOffice/setup/CourierAddSetup.jsx` (+ shared `CourierFields.jsx`) | `courier_add.php` |
| `/admin-office/setup/courier-edit` | `client/src/pages/adminOffice/setup/CourierEditSetup.jsx` (+ `CourierFields.jsx`) | `courier_edit.php` |
| `/admin-office/setup/courier-report` | `client/src/pages/adminOffice/setup/CourierReportSetup.jsx` | `courier_report.php` |
| `/admin-office/setup/incident-add` | `client/src/pages/adminOffice/setup/IncidentAddSetup.jsx` | `incident_add.php` |
| `/admin-office/setup/incident-edit` | `client/src/pages/adminOffice/setup/IncidentEditSetup.jsx` | `incident_edit.php` |
| `/admin-office/setup/incident-report` | `client/src/pages/adminOffice/setup/IncidentReportSetup.jsx` | `incident_report.php` |
| `/admin-office/setup/events-group-add` | `client/src/pages/adminOffice/setup/EventsGroupSetup.jsx` | `events_group_add.php` |

Routing: `client/src/routes/AppRoutes.jsx` lines 132–133, 250–251 (`/admin-office` →
`AdminOfficeHub`, `/admin-office/setup/:screen` → `AdminOfficeSetupPage`). Unlike Circular,
`AdminOfficeSetupPage.jsx` is hand-rolled (not using `ModuleSetupFactory`) but follows the same
shape: looks up `ADMIN_OFFICE_SCREEN_META[screen]`, renders a `DashboardLayout` +
`Breadcrumbs` (`Home / Admin Office / <title>`) + `PageHeader` with a **Back** button
(`btn btn-outline-secondary btn-sm`, links to `/admin-office`), and dispatches to
`SETUP_COMPONENTS[screen]`.

All screens share `useAdminOfficeSetupApi(screen)`
(`client/src/pages/adminOffice/useAdminOfficeSetupApi.js`), posting to
`POST /api/admin-office/setup/${screen}/load` and `.../save`. **Unlike Circular's hook, this
one's `save()` does not support file uploads** — it posts only `{ fields }`, no `files` array
— consistent with the fact that no admin-office screen currently has a file input in its JSX.
There is also a standalone endpoint `POST /api/admin-office/lookup-participants` (not part of
the load/save pattern) used by the Activities forms' **Lookup** button.

## 3. Pixel-level flow per screen

### 3.1 Student/Staff Activities — Add (`ActivitiesAddSetup.jsx` default export / `activitiesSetup.js`)

One component (`ActivityForm`) is shared by both Add and Edit; `eventFor` (`'student'` or
`'staff'`) is baked in by the dispatcher (`server/src/services/adminOffice/adminOfficeSetup.js`
LOADERS/SAVERS wrap the shared functions with a fixed `eventFor`). Fields in DOM order:

1. **Event Name** — text input, `form.eventName`.
2. **Category** — `<select className="form-select">`, options from `data.categoryOptions`:
   `Academic, Sports, Finearts (label "Fine Arts"), Association, Others` (fixed
   `CATEGORY_OPTIONS` array server-side, not DB-driven).
3. **Type** — `<select>`, options from `data.eventTypes`: `Inter, Intra, National,
   International` (fixed `EVENT_TYPES` array).
4. **Date** — `type="date"`, `form.eventDate`.
5. **Venue** — text input, `form.eventVenue`.
6. **Content** — text input, `form.eventContent`.
7. **Participant IDs** — text input, `form.participantsNo` (free-text list, not validated).
8. **Participant Names** — `<textarea rows={2}>`, `form.participantsName`.
9. **Prize / Participant Rows** (`<h6>Prize / Participant Rows</h6>`) — a repeatable set of
   rows, each with: text input placeholder **"Prize / Type"** (`row.prizeName`), text input
   with placeholder equal to `idLabel` (`"Staff ID"` when `data.eventFor==='staff'`, else
   `"Admission No"`) bound to `row.studentList`, a 1-row `<textarea>` placeholder **"Names"**
   (`row.studentNameList`), a **Lookup** button (`btn btn-outline-secondary btn-sm`), and a
   **Remove** button (`btn btn-outline-danger btn-sm`, disabled if only one row remains).
   Below the rows: **`+ Add row`** link-style button appends a blank row.

Button: **Submit** (`btn btn-primary`, disabled while `busy`).

**Lookup** button behavior: calls `POST /api/admin-office/lookup-participants` with
`{ eventFor: data.eventFor, ids: form.participantRows[index].studentList }`
(`server/src/routes/adminOffice.js` → `lookupActivityParticipants` →
`resolveParticipantNames` in `server/src/services/adminOffice/shared.js`). On success,
`res.data.names` (a comma+newline-joined string) is written into that row's
`studentNameList`. Resolution logic: splits `ids` on comma; for `eventFor==='student'`, joins
`student_profile_tb` to `basic_setup_course_tb` on `course_id`, filters
`register_no=<id> AND del=1 AND B.del=1`, and formats
`"<student_name> <student_initial> (<degree_name>-<department_short_name>, <2-digit-yr><2-digit-yr>)"`;
unmatched ids push the error string `"<id> is an invalid admission number"` (errors are
returned in `res.data.errors` but the JSX doesn't currently render them anywhere). For
`eventFor==='staff'`, looks up `staff_profile_tb` by `staff_id`, formats
`"<staff_name> <staff_initial> (Staff)"`; unmatched pushes `"<id> is an invalid staff id"`.

Load (`loadActivitiesAddSetup`): always returns a blank form (`eventDate:''`,
`eventType:'inter'`, `eventCategory:'Academic'`, one blank participant row) plus
`academicYear` (from `loadAcademicYearRef()` — `basic_setup_tb.ug_academic_year`, `id=1`,
`del=1`).

Save (`saveActivitiesAddSetup`): requires `toIsoDate(payload.eventDate)` truthy (else
`{ success:false, message:'Event date is required' }`) and non-blank `eventName` (else
`'Event name is required'`). Creates one `event_tb` row (`event_for`, `academic_year`,
event fields, `c_completed:0`, audit `create`), then loops `participantRows`, skipping rows
where both `prizeName` and `studentList` are blank, creating one `event_participant_tb` row
per surviving row (`event_id` = created event's id as a string, `house_name:''` always blank).
Success message: `'Your details are added...'`.

### 3.2 Student/Staff Activities — Edit (`ActivitiesEditSetup` named export in `ActivitiesAddSetup.jsx`)

Search-then-edit pattern. Search state: form with text input placeholder **"Search event"**
and **Search** button (`btn btn-outline-primary`) → `onLoad({ search: value })`. List table:
`Date | Event | Category | (Edit link)` — clicking **Edit** (link-style button) calls
`onLoad({ id: row.id })`.

Once `data.event` is populated: **← Back to list** link button (`onLoad({})`), then the same
`ActivityForm` fields as Add, prefilled from `data.event`. Buttons: **Update**
(`btn btn-primary`) submits `{ ...form, id: data.event.id }`; **Delete**
(`btn btn-outline-danger`) directly calls `onSave({ action: 'delete', id: data.event.id })`
with no confirm dialog.

Load (`loadActivitiesEditSetup`): if `fields.id` → `loadEventById` (joins `event_tb` +
`event_participant_tb`, both `del=1`, filtered by `event_for` so a student search can't
surface a staff event or vice versa). Else paginated list (`page`, fixed `limit=20`) filtered
`del=1 AND event_for=<eventFor>` plus optional `event_name LIKE '%search%'`, ordered
`event_date DESC`.

Save (`saveActivitiesEditSetup`): `action==='delete'` soft-deletes both the `event_tb` row and
all its `event_participant_tb` rows (`del:0`), message `'Your details are deleted...'`.
Otherwise requires `parseId(payload.id)` (`'Event not found'`) and a valid `eventDate`
(`'Event date is required'`). Updates the event row, then **soft-deletes all existing
participant rows first** (`event_participant_tb.updateMany({ del:0 })`) before re-applying the
submitted `participantRows`: rows with an `id` are updated back to `del:1` with new values;
rows without an `id` but with content are newly created. This delete-then-recreate pattern
means a participant row silently dropped from the client form (e.g. a stale array) is
soft-deleted on save. Success message: `'Your details are Updated...'`.

### 3.3 Courier Add (`CourierAddSetup.jsx` + `CourierFields.jsx` / `courierAddSetup.js`)

Fields (all in `CourierFields.jsx`, shared with Courier Edit), in DOM order:
1. **Date & Time** — `type="datetime-local"`, `form.courierDate`.
2. **In / Out** — `<select>`, options **In**, **Out** (default `In`).
3. **Department** — `<select>` with leading `<option value="">--Select--</option>`, options
   from `data.departmentOptions` (= `loadDepartmentOptions()` → `staff_dept_master`,
   `del=1`, ordered `d_order`).
4. **From** — text input, `form.fromName`.
5. **To** — text input, `form.toName`.
6. **Type** — `<select>`, options **Postal**, **Courier**, **Hand** (default `Postal`).
7. Conditional on Type ≠ `Hand`: **Courier No** and **Courier Company** text inputs.
   Conditional on Type === `Hand`: **Hand Name** and **Designation** text inputs instead.
8. **Item** — text input, `form.itemName`.
9. **Quantity** — text input (not numeric-typed), `form.quantity`.
10. **Receiver / Sender** — text input, `form.courierReceiver`.

Button: **Submit** (`btn btn-primary`, disabled while `busy`).

Save (`saveCourierAddSetup`): requires `parseDateTimeInput(payload.courierDate)` truthy, else
`{ success:false, message:'Date and time are required' }`. Creates one `courier_tb` row with
all fields plus `staff_id:''` and `courier_note:''` always blank (no UI for them). Success
message: `'Your details are added...'`.

### 3.4 Courier Edit (`CourierEditSetup.jsx` / `courierEditSetup.js`)

Search-then-edit, same shape as Activities Edit. Search placeholder **"Search from / to /
in-out"**; list columns `Date | In/Out | From | To | Type | (Edit)`. Edit form reuses
`CourierFields.jsx`; **Update** / **Delete** buttons identical pattern to Activities Edit.

Load: search matches `courier_from LIKE ... OR courier_to LIKE ... OR courier_inout LIKE ...`;
list rows resolve `department` via `loadDepartmentMap()` (id→name lookup), falling back to the
raw stored `category` value if the id isn't found in the map (this is the "stale department"
edge case — see §5).

Save: delete branch soft-deletes (`del:0`). Update branch requires a valid `courierDate`
(same message as Add) and re-derives `cType`: **when `cType==='Hand'` the server force-blanks
`courier_no`/`courier_company`, and when `cType!=='Hand'` it force-blanks `h_name`/
`h_designation`** — i.e. switching Type on edit always clears the fields that no longer apply,
even if the client sent stale values for them.

### 3.5 Courier Report (`CourierReportSetup.jsx` / `courierReportSetup.js`)

Fields: **From** date, **To** date, **Search** text input (placeholder **"Search"**), button
**Show** (`btn btn-primary w-100`). Table columns: `Date | In/Out | Dept | From | To | Type |
Item | Qty | Receiver`. If `data` hasn't loaded yet the component returns `null` (no loading
spinner text in the JSX itself — relies on the page shell's `busy` indicator).

Server: defaults both dates to today if unsupplied; date range filter on `courier_date`;
optional search matches `courier_inout`/`courier_from`/`courier_to`; capped 500 rows,
`ORDER BY courier_date DESC`; department resolved via `loadDepartmentMap()`.

### 3.6 Incident Add / Edit / Report

Structurally identical to Courier Add/Edit/Report but with `IncidentFields` (exported from
`IncidentAddSetup.jsx`, reused by `IncidentEditSetup.jsx`): **Date & Time**
(`datetime-local`), **Department** (`--Select--` + `data.departmentOptions`), **Title**,
**Location**, **First Aid By**, **Details** (`<textarea rows={4}>`). No Courier-style
conditional Postal/Hand branching — every field is always visible.

Add validation (`saveIncidentAddSetup`): requires valid `incidentDate`
(`'Date and time are required'`) and non-blank `title` (`'Title is required'`).
Edit validation (`saveIncidentEditSetup`): same date check; **no title-required check on
edit** (an Edit save with a blanked-out Title is allowed, unlike Add). Report columns:
`Date | Dept | Title | Location | First Aid | Details`; same date-range + search pattern
(search matches `incident_title`/`incident_location`/`first_aid_by`).

### 3.7 Events Group (`EventsGroupSetup.jsx` / `eventsGroupSetup.js`) — intentional stub

The JSX renders a single `<div className="alert alert-info mb-0">` showing `data.notice`, no
form fields at all: `{data.notice || 'Event group setup is not available in this build.'}`.

Load (`loadEventsGroupSetup`) returns `readOnly: true` and the notice
`"Event group setup is not fully implemented in the legacy PHP screen. Use Committee module
screens for committee-based events when available."`, plus a `form` shape and
`categoryOptions` that are **defined but never rendered by the JSX** (dead payload).

Save (`saveEventsGroupSetup`) unconditionally returns
`{ success: false, message: 'Event group save is not available in this build. Legacy
events_group_add.php had no database save logic.' }` and logs an `Unsuccessful` audit entry —
this is a deliberate no-op, not a bug, because the source legacy PHP page itself had no working
save path to port.

## 4. Primary user stories

**US-1 — Record student event participation with prize winners.**
As an activities coordinator, I want to fill Event Name/Category/Type/Date/Venue/Content on
**Student Activities — Add**, add one or more Prize/Participant rows with admission numbers,
click **Lookup** to auto-fill names, and **Submit**, so participation and prize history is
recorded against `event_tb`/`event_participant_tb`.
*Acceptance:* Event date and Event name are required; Lookup resolves valid admission numbers
to `"<name> <initial> (<degree>-<dept short>, <yr>)"`; unmatched ids surface
`"<id> is an invalid admission number"` in `res.data.errors`.

**US-2 — Record staff event participation.**
As an activities coordinator, I want the identical Add/Edit flow for `eventFor='staff'`, with
the participant ID field labeled **"Staff ID"** instead of **"Admission No"**, so staff
competition/seminar participation is tracked the same way.
*Acceptance:* `idLabel = data.eventFor === 'staff' ? 'Staff ID' : 'Admission No'`; Lookup
resolves staff via `staff_profile_tb.staff_id`.

**US-3 — Edit or delete a past event record.**
As a coordinator, I want to search events by name on **Student/Staff Activities — Edit**, open
one, change fields, and **Update** (or **Delete**), so incorrect historical entries can be
corrected.
*Acceptance:* Delete soft-deletes both the event and all its participant rows; Update replaces
all participant rows (delete-then-recreate), so removing a row from the client form actually
soft-deletes it server-side.

**US-4 — Log an inbound or outbound courier item.**
As mailroom staff, I want to record Date & Time, In/Out, Department, From/To, Type (Postal/
Courier/Hand with the type-specific fields it reveals), Item, Quantity, and Receiver on
**Courier Add**, so there's a searchable log of physical mail movement.
*Acceptance:* Date & Time is required; the visible fields change based on Type (`Hand` shows
Hand Name/Designation instead of Courier No/Company).

**US-5 — Search and correct a courier entry.**
As mailroom staff, I want to search couriers by From/To/In-Out text on **Courier Edit**, open a
match, fix a field, and **Update**, so logging mistakes are corrected.
*Acceptance:* switching `cType` on update force-clears the fields belonging to the other type
server-side, even if the client still holds stale values for them.

**US-6 — Run a courier or incident report for a date range.**
As office staff, I want From/To dates plus a free-text Search on **Courier Report** /
**Incident Report**, click **Show**, and see a table of matching entries with the department
name resolved, so I can audit activity for a period.
*Acceptance:* results capped at 500 rows, `ORDER BY <date> DESC`; department id is resolved to
its display name via `loadDepartmentMap()`.

**US-7 — Log a workplace/campus incident with first-aid response.**
As safety/admin staff, I want to record Date & Time, Department, Title, Location, First Aid By,
and Details on **Incident Add**, so incidents are tracked for compliance.
*Acceptance:* Date & Time and Title are both required on Add.

## 5. Rare / edge-case user stories

**US-8 — Participant lookup with zero matches.**
As a coordinator, I want a clear signal when every ID I typed in the Participant IDs box is
invalid, so I know to re-check the admission/staff numbers.
*Reality check:* `resolveParticipantNames` does build an `errors` array
(`"<id> is an invalid admission number"` / `"<id> is an invalid staff id"`) and the route
returns it as `res.data.errors`, but `ActivitiesAddSetup.jsx`'s `lookup()` handler only reads
`res.data.names` — it never inspects or displays `res.data.errors`. With zero matches,
`res.data.names` is `''`, so `studentNameList` is set to an empty string with **no visible
error to the coordinator** — this is a real UX gap, not a crash.
*Acceptance:* document that today, a zero-match Lookup silently blanks the Names field; a
proper fix would surface `res.data.errors.join(', ')` as an inline warning.

**US-9 — Duplicate participant records.**
As a coordinator re-clicking Lookup or re-submitting a form, I want duplicate participant
entries in `event_participant_tb` to be avoided.
*Reality check:* both `saveActivitiesAddSetup` and `saveActivitiesEditSetup` iterate
`payload.participantRows` and `create` a new `event_participant_tb` row for every row that has
no `id` and has content — there is no de-duplication against `student_list`/`prize_name`
already present for that event. On Add, a double-submit (e.g. slow network, user clicks Submit
twice) would create two full events with duplicate participant sets since there's no
idempotency key. On Edit, resubmitting the same unsaved (no-`id`) row twice in one Save call
(unlikely from the UI, but possible via direct API use) would create two participant rows.
*Acceptance:* document the absence of a uniqueness constraint or debounce; recommend disabling
Submit while `busy` is already done in the JSX (`disabled={busy}`), which mitigates but does
not eliminate double-submission from two independent double-clicks before the first request's
`busy` state propagates.

**US-10 — Department deleted after being referenced by a courier/incident entry.**
As office staff viewing an old Courier/Incident report, I want the department column to still
show something meaningful even if that `staff_dept_master` row was later soft-deleted.
*Acceptance:* `loadDepartmentMap()` only includes `del=1` rows, so
`deptMap[String(r.category)] || r.category` falls back to the **raw stored id/category
string** (not a friendly name) once the department is deactivated — verified in both
`courierReportSetup.js` and `incidentReportSetup.js`. This is graceful degradation, not a
crash, but the displayed value becomes a bare id instead of a label.

**US-11 — Events Group screen is opened expecting a working form.**
As a user who navigates to **Events Group** from the hub expecting to add an events group (the
hub link says "Create a new events group" style copy), I want to understand why nothing saves.
*Acceptance:* the screen always shows the info alert
`"Event group setup is not fully implemented in the legacy PHP screen. Use Committee module
screens for committee-based events when available."` and any Save attempt (if a future UI adds
a submit button) returns `success:false` with message `"Event group save is not available in
this build. Legacy events_group_add.php had no database save logic."` — this mirrors the
legacy PHP page's own missing save logic rather than being a modernization regression.

**US-12 — Incident Edit allows saving with a blank Title.**
As safety staff editing an incident, I want the app to warn me if I accidentally clear the
Title field before Update.
*Reality check:* `saveIncidentAddSetup` requires a non-blank title but `saveIncidentEditSetup`
does not re-check it — an Update with `title: ''` succeeds silently. This is an inconsistency
between Add and Edit validation worth flagging for parity.

## 6. Future / predicted user stories

### Future (not implemented)

**US-13 (speculative).** As a coordinator using the future mobile app, I want to search/view
staff and student directories to find IDs faster while filling out the Participant Rows,
reusing `/api/students` and `/api/staff` search the way `mobile.md` §6 lists "Staff/Student
directory | `/api/students`, `/api/staff` | Search + profile view, no editing in v1" — reducing
Lookup misses (US-8) by letting the coordinator browse instead of typing raw ids.

**US-14 (speculative).** As mailroom staff, I want to scan a courier's barcode/tracking number
with the phone camera to auto-fill Courier No, extrapolating from `mobile.md` §3's mention of
`expo-camera`/`expo-barcode-scanner` being planned for library barcode scanning — the same
capability would apply to Courier Add's **Courier No** field.

**US-15 (speculative).** As an activities coordinator, I want the participant Lookup's
`errors` array (already returned by the backend but currently dropped by the client per US-8)
surfaced as an inline red list under the Participant IDs field, so invalid ids are visible
immediately instead of silently producing a blank Names field.

**US-16 (speculative).** As an admin-office user, I want the Events Group screen to gain a real
save path backed by a proper `events_group_tb` (or similar) — grounded in the code's own
`eventsGroupSetup.js` docstring pointing at "Committee module screens" as the intended
replacement — once product decides whether events-group tracking belongs in Admin Office or
Committee.

## 7. Traceability table

| Story | Client file | Server file / endpoint | Table |
|---|---|---|---|
| US-1 Student activity add | `client/src/pages/adminOffice/setup/ActivitiesAddSetup.jsx` | `POST /api/admin-office/setup/student-activities-add/save` → `server/src/services/adminOffice/setup/activitiesSetup.js` (`saveActivitiesAddSetup`) | `event_tb`, `event_participant_tb` |
| US-2 Staff activity add | same component, `eventFor='staff'` | same file, wrapped for `staff-activities-add` in `adminOfficeSetup.js` | `event_tb`, `event_participant_tb` |
| US-3 Edit/delete activity | `client/src/pages/adminOffice/setup/ActivitiesEditSetup.jsx` | `POST /api/admin-office/setup/student-activities-edit\|staff-activities-edit/load\|save` → `activitiesSetup.js` | `event_tb`, `event_participant_tb` |
| US-4 Courier add | `client/src/pages/adminOffice/setup/CourierAddSetup.jsx`, `CourierFields.jsx` | `POST /api/admin-office/setup/courier-add/save` → `server/src/services/adminOffice/setup/courierAddSetup.js` | `courier_tb` |
| US-5 Courier edit | `client/src/pages/adminOffice/setup/CourierEditSetup.jsx` | `POST /api/admin-office/setup/courier-edit/load\|save` → `server/src/services/adminOffice/setup/courierEditSetup.js` | `courier_tb` |
| US-6 Courier/Incident report | `CourierReportSetup.jsx`, `IncidentReportSetup.jsx` | `courierReportSetup.js`, `incidentReportSetup.js` | `courier_tb`, `incident_tb` |
| US-7 Incident add | `client/src/pages/adminOffice/setup/IncidentAddSetup.jsx` | `POST /api/admin-office/setup/incident-add/save` → `server/src/services/adminOffice/setup/incidentAddSetup.js` | `incident_tb` |
| US-8 Zero-match lookup | `ActivitiesAddSetup.jsx` `lookup()` | `POST /api/admin-office/lookup-participants` → `server/src/services/adminOffice/shared.js` (`resolveParticipantNames`) | `student_profile_tb`, `staff_profile_tb` |
| US-9 Duplicate participants | `ActivitiesAddSetup.jsx`/`ActivitiesEditSetup.jsx` | `activitiesSetup.js` (`saveActivitiesAddSetup`/`saveActivitiesEditSetup`) | `event_participant_tb` |
| US-10 Stale department | `CourierReportSetup.jsx`, `IncidentReportSetup.jsx` | `shared.js` (`loadDepartmentMap`) | `staff_dept_master` |
| US-11 Events Group stub | `client/src/pages/adminOffice/setup/EventsGroupSetup.jsx` | `server/src/services/adminOffice/setup/eventsGroupSetup.js` | (none — stub) |
| US-12 Incident edit title gap | `client/src/pages/adminOffice/setup/IncidentEditSetup.jsx` | `incidentEditSetup.js` (`saveIncidentEditSetup`) | `incident_tb` |
| US-13 Directory search in lookup (future) | future mobile screen | existing `/api/students`, `/api/staff` | `student_profile_tb`, `staff_profile_tb` |
| US-14 Barcode scan courier (future) | future mobile `CourierAdd` screen | existing `courierAddSetup.js` | `courier_tb` |
| US-15 Surface lookup errors (future) | future `ActivitiesAddSetup.jsx` update | existing `lookupActivityParticipants` (already returns `errors`) | n/a |
| US-16 Real Events Group save (future) | future `EventsGroupSetup.jsx` | future `eventsGroupSetup.js` save logic | future `events_group_tb` or Committee tables |

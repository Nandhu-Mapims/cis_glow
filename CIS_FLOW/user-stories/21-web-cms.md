# 21 — Web CMS

## 1. Module overview

**Purpose.** The Web CMS module lets admin/marketing staff manage content that appears on the
college's public website: static content pages (About Us, Departments, LMS, Journal, Facilities,
AAADAR, Research, Academic, IQAC, Outreach), the homepage hero slider, photo galleries, PDF
document downloads, staff display order per department, research-program/news announcements, and
festival/campus events with their own category master. There is **no live preview or publish
pipeline** anywhere in this module's code — "Enable"/"Draft" (pages), `web_view` (photos,
research, events), and `webView` toggles are the only publish-state controls, all persisted
directly to the row; whatever renders the actual public website (outside this repo) is presumably
expected to read these same tables/flags.

**Primary actors.**
- **Web content editors / marketing staff** — manage all CMS screens (pages, slider, photos,
  documents, research, events).
- **Academic/HR office staff** — maintain the Staff Web Display Order screen, since it draws from
  `staff_profile_tb`/`staff_dept_master`.

**Legacy PHP files replaced:**

| Legacy file | Screen slug |
|---|---|
| `web_aboutus_v1.php` | `about-us` |
| `web_departments_v1.php` | `departments` |
| `web_lms_v1.php` | `lms` |
| `web_journal_v1.php` | `journal` |
| `web_facilities_v1.php` | `facilities` |
| `web_aaadar_v1.php` | `aaadar` |
| `web_research_v1.php` | `research` |
| `web_academic_v1.php` | `academic` |
| `web_iqac_v1.php` | `iqac` |
| `web_out_reach_v1.php` | `outreach` |
| `home_slider_widget_edit.php` | `slider-animation` |
| `photos_add.php` | `photos-add` |
| `photos_edit.php` | `photos-edit` |
| `staff_web_display_order_setup.php` | `staff-display-order` |
| `website_doc_upload.php` | `doc-upload` |
| `web_research_news_add.php` | `research-program-add` |
| `web_research_news_edit.php` | `research-program-edit` |
| `festival_event_add.php` | `event-add` |
| `festival_event_edit.php` | `event-edit` |
| `event_category.php` | `event-type` |

**Schema note — self-provisioned tables.** Unlike most modules in this codebase (which strictly
use the pre-existing shared MariaDB schema per house rule #2), Web CMS is unusual: `webDb.js`
(`server/src/services/web/webDb.js`) runs `CREATE TABLE IF NOT EXISTS` for `web_pages`,
`web_photos_gallery`/`web_photos`, `research_program`/`research_photos`, and
`web_event_type`/`web_events` on first use (`ensureWebPagesTable`, `ensureWebPhotosTables`,
`ensureResearchTables`, `ensureWebEventsTables`, each memoized with a module-level boolean so the
DDL only runs once per server process). If these tables don't already exist in the legacy schema
under these exact names, this module effectively **adds new tables** to `apdchedu_cisapp` — worth
confirming against the legacy PHP schema before assuming this is pure "read the existing schema"
migration; it may be a genuinely new native feature area rather than a port of an existing legacy
table structure (the legacy `.php` names strongly suggest a real legacy predecessor existed, so
the safer assumption is these tables already exist in production and `CREATE TABLE IF NOT EXISTS`
is a no-op safety net, but this was not independently verified against `schema.prisma`).

## 2. Screen inventory

Base client route `/web/setup/:screen`; hub `/web`. All screens run through the generic
`createSetupApi`/`createModuleSetupPage` factory (`client/src/pages/web/WebModule.jsx`).

| Screen | Route | Component | Server load/save | Legacy `.php` |
|---|---|---|---|---|
| Hub | `/web` | `WebHub` (`createModuleHub`) | — | — |
| Setup hub | `/web/setup` | `WebSetupHub` (`createModuleSetupHub`) | — | — |
| `about-us`, `departments`, `lms`, `journal`, `facilities`, `aaadar`, `research`, `academic`, `iqac`, `outreach` | `/web/setup/<slug>` | `WebPageScreen` (shared component, 10 slugs) | `POST /api/web/setup/<slug>/load\|save` | see table above |
| `slider-animation` | `/web/setup/slider-animation` | `WebSliderScreen` | `POST /api/web/setup/slider-animation/load\|save` | `home_slider_widget_edit.php` |
| `photos-add` | `/web/setup/photos-add` | `WebPhotosAddScreen` | `POST /api/web/setup/photos-add/load\|save` | `photos_add.php` |
| `photos-edit` | `/web/setup/photos-edit` | `WebPhotosEditScreen` | `POST /api/web/setup/photos-edit/load\|save` | `photos_edit.php` |
| `staff-display-order` | `/web/setup/staff-display-order` | `WebStaffDisplayScreen` | `POST /api/web/setup/staff-display-order/load\|save` | `staff_web_display_order_setup.php` |
| `doc-upload` | `/web/setup/doc-upload` | `WebDocUploadScreen` | `POST /api/web/setup/doc-upload/load\|save` | `website_doc_upload.php` |
| `research-program-add` | `/web/setup/research-program-add` | `WebResearchAddScreen` | `POST /api/web/setup/research-program-add/load\|save` | `web_research_news_add.php` |
| `research-program-edit` | `/web/setup/research-program-edit` | `WebResearchEditScreen` | `POST /api/web/setup/research-program-edit/load\|save` | `web_research_news_edit.php` |
| `event-add` | `/web/setup/event-add` | `WebEventAddScreen` | `POST /api/web/setup/event-add/load\|save` | `festival_event_add.php` |
| `event-edit` | `/web/setup/event-edit` | `WebEventEditScreen` | `POST /api/web/setup/event-edit/load\|save` | `festival_event_edit.php` |
| `event-type` | `/web/setup/event-type` | `WebEventTypeScreen` | `POST /api/web/setup/event-type/load\|save` | `event_category.php` |

Server routes (`server/src/routes/web.js`), gated by `authMiddleware` + `menuAuthForModule('web')`,
dispatch through `loadWebScreen`/`saveWebScreen` (`server/src/services/web/webSetup.js`).
`PAGE_SCREENS` (the 10 static-page slugs) route to `webPageSetup.js`; every other slug routes to a
dedicated handler in `SETUP_HANDLERS`. Unknown screen → `{error:'Unknown web screen'}` → HTTP 400.
`saveWebScreen` always merges `files` from the top-level request body into the `fields` payload
(`{ ...fields, files: files.length ? files : fields.files }`) before dispatch — file uploads are
base64 data URLs sent as `{ field, name, data }` objects, decoded server-side by
`saveLegacyBinaryFile` (`server/src/services/web/webUpload.js`), which enforces a byte-size cap
and an extension allowlist per call site and writes into `config.legacyFilesPath/<folder>/...`.

## 3. Pixel-level flow per screen

### 3.0 Shared factory contract

`useWebSetupApi = createSetupApi('/api/web')` (`client/src/pages/web/WebModule.jsx:13`). Same
`load`/`save` contract as SMS (§3.0 of `20-sms.md`): 60s client-side load cache, `notice`/`error`
banners from `res.data.message`/`res.data.error`, `readOnly` prop from `WEB_SCREEN_META[screen]`
(no `readOnly: true` entries exist in `webSetupMeta.js`, so every screen renders its save
button/form — the `WebPageScreen` component still guards `if (readOnly) return;` defensively in
its submit handler even though nothing sets that flag today).

### 3.1 Static content pages — `about-us` / `departments` / `lms` / `journal` / `facilities` /
`aaadar` / `research` / `academic` / `iqac` / `outreach` (10 legacy `web_*_v1.php` files)

Component: `WebPageScreen` (`client/src/pages/web/setup/WebPageScreen.jsx`), shared verbatim
across all 10 slugs — the only per-slug difference is which `pageType` bucket (`Page1`…`Page10`)
the server maps the slug to (`PAGE_TYPES` in `webPageSetup.js`).

Left column (`col-md-3`): a `list-group` of existing pages for this `pageType`
(`data.pages`, each button labeled `p.title || 'Page {id}'`) plus a **"+ Add New Page"** button at
the top that resets the form to a blank draft locally (`pageId:'new'`) **without** calling the
server — clicking an existing page instead calls `onLoad({ pageId })`.

Right column (`col-md-9`) form fields in DOM order: unlabeled **page title** text `<input>`
(placeholder `"Page title"`, required), unlabeled **order** `<input type="number">` (placeholder
`"Order"`), unlabeled **link slug** text `<input>` (placeholder `"Link slug"`), unlabeled
**publish date** `<input type="date">` (bound to `postOn`), a small muted label **"Page type:
{data?.pageType}"** (read-only display, e.g. `"Page type: Page1"`), unlabeled **HTML content**
`<textarea rows={12}>` (placeholder `"HTML content"` — the CMS body is raw HTML typed by hand, no
WYSIWYG editor anywhere in this module), and two radio buttons **"Enable"** / **"Draft"** bound to
`form.enabled`. **"Save page"** submit button (`btn btn-primary`), hidden entirely when
`readOnly`.

Server load (`loadWebPageScreen`, `webPageSetup.js`): resolves `pages` for the slug's `pageType`
via `listWebPages` (`del=1`, `ORDER BY page_order ASC, id ASC`), defaults `pageId` to
`fields.pageId || pages[0]?.id || 0` (so on first load the **first page in order** is shown, not a
blank form, unless there are zero existing pages for that type). Logs
`logModulePage(meta.legacy, 'View', ...)`.

Server save (`saveWebPageScreen`): `action==='delete'` soft-deletes (`del=0`) by `pageId` and
reloads. Otherwise requires non-empty `title` (else `{success:false, message:'Page title is
required'}`); auto-derives `link` from a slugified `title` if the user left Link slug blank
(`title.toLowerCase().replace(/\s+/g,'-')`); `postOn` parsed via bare `new Date(payload.postOn)`
(no zero-date guard needed here since it's a fresh insert, not reading a legacy zero-date column);
`enabled` maps to `page_enable` (`1`/`0`). On success, message **`'Page saved...'`**, and the
response is re-hydrated with a fresh `loadWebPageScreen` call for the just-saved `pageId` (so the
list and form both refresh) — note the client's own `"+ Add New Page"` button only clears local
state and never round-trips, so navigating away and back re-shows the first page in `pages`, not a
blank form, unless "+ Add New Page" is clicked again.

### 3.2 `slider-animation` — Slider Animation (`home_slider_widget_edit.php`)

Component: `WebSliderScreen` (`client/src/pages/web/setup/WebSliderScreen.jsx`). No add/delete —
purely an editor over a **fixed set of pre-existing rows** (server caps at `LIMIT 7` — see
below), each rendered as a card **"Slide {n}"** with fields: **"Type"** `<select>` (`Image`/
`Video`), **"Order"** number input, **"Image filename"** text input (a raw filename string, not a
file picker — there is **no `<input type="file">` anywhere on this screen**, despite it
controlling the homepage hero images; uploading the actual image file must happen through some
other path not covered by this screen), **"BG color"** and **"Text color"** text inputs (raw hex
strings, no color-picker widget), **"Content link"**, **"Title"**, **"Message"** `<textarea
rows={2}>`, and three checkboxes **"Widget"** / **"Image"** / **"Content"** (map to
`widgetEnable`/`imageEnable`/`contentEnable`). **"Save slider"** submit button (`btn btn-danger`),
disabled if `busy` or there are zero slides.

Server load (`loadWebSliderSetup`, `webSliderSetup.js`): `SELECT ... FROM slider_animation_tb
WHERE del != 0 ORDER BY order_no ASC LIMIT 7` — note the filter is `del != 0`, not the module-wide
convention `del = 1`; functionally equivalent for the binary 0/1 values this table presumably
uses, but a deviation from the documented `del=1` convention worth flagging if this table ever
gains other `del` values. Server save (`saveWebSliderSetup`): iterates `fields.slides`, **skips
any slide without a numeric `id`** (`if (!id) continue` — so a slide row with no `id`, which
should never occur given there's no "add slide" UI, silently vanishes from the save instead of
erroring), updates all fields in place by raw SQL; message `'Slider settings updated.'`.

### 3.3 `photos-add` — Photos, Add Gallery (`photos_add.php`)

Component: `WebPhotosAddScreen` (`client/src/pages/web/setup/WebPhotosAddScreen.jsx`). Fields:
**"Date"** `<input type="date">` (defaults to today), **"Title"** text input (required),
**"Description"** `<textarea rows={4}>`, **"Cover image"** `<input type="file" accept="image/*">`
(single file, read via `FileReader.readAsDataURL` client-side into a base64 payload tagged
`field:'cover'`), **"Gallery images (multiple)"** `<input type="file" accept="image/*" multiple>`
(each file tagged `field: 'photo_{i}'`), checkbox **"Show on website"** (`webView`, default
checked). **"Save gallery"** submit (`btn btn-danger`). On success the form resets to a fresh
blank draft (date=today, everything else empty) regardless of save outcome.

Server (`loadWebPhotosAdd`/`saveWebPhotosAdd`, `webPhotosSetup.js`): load just ensures the tables
exist and returns a blank form (unused since the client never calls `onLoad` with fields). Save
requires non-empty `title` (`'Title is required.'`); cover upload restricted to
`IMG_EXT = {jpeg, jpg, gif, png, webp}`, max 5 MB, saved into the shared `documents` folder (not a
dedicated `photos` folder — see US-21.9); inserts one `web_photos_gallery` row, then one
`web_photos` row per uploaded gallery image (skips any `photos[i]` entry that ends up with no
resolved `filename`, i.e. a `photos` array slot the client sent without a matching file).

### 3.4 `photos-edit` — Photos, Edit Gallery (`photos_edit.php`)

Component: `WebPhotosEditScreen`. Left column: `list-group` of existing galleries
(`data.galleries`, label `g.title || 'Gallery {id}'`); clicking one calls
`onLoad({ galleryId })`. Right column (only rendered once a gallery is picked): **"Date"**,
**"Title"** (required), **"Description"**, **"Replace cover"** `<input type="file"
accept="image/*">` (optional — omitting it leaves the existing cover attachment untouched, see
server notes), checkbox **"Show on website"**, then a read-only **"Photos"** list (`ul.list-group`)
of the gallery's existing images with a **"View"** link opening `p.url` in a new tab — **no
add/remove/reorder controls for individual photos exist on this edit screen** (compare
`WebStaffDisplayScreen`'s per-row order inputs, which this screen lacks for photos). **"Update
gallery"** submit (`btn btn-danger mt-3`).

Server (`loadWebPhotosEdit`/`saveWebPhotosEdit`): galleries listed newest-first
(`ORDER BY n_date DESC, id DESC LIMIT 100`) with a live `photo_count` subquery per row; detail
resolves the gallery plus its `web_photos` rows (each given a `url:
/legacy/files/documents/{attachment}`). Save requires a resolvable `galleryId` (`'Select a
gallery.'` if missing); cover replacement follows the same 5 MB/`IMG_EXT` rule as Add; **the
`photos` array save loop is present in the service** (iterates `fields.photos`, updates existing
`photoId` rows' `title`/`order`/optionally `attachment`, or inserts a new row if a `photo_{i}`
file was attached with no `photoId`) even though **the current `WebPhotosEditScreen.jsx` UI never
lets the user add or edit individual photo rows** — the client always submits `photos` as
whatever `data.detail.photos` was loaded, unmodified, so in practice this save path only ever
round-trips existing rows' order/title unchanged; the richer per-photo edit capability the service
supports is not reachable through this specific screen's UI (a similar "service supports more than
the wired-up form" pattern as `subject-test` in the E-learning module).

### 3.5 `staff-display-order` — Staff Web Display Order (`staff_web_display_order_setup.php`)

Component: `WebStaffDisplayScreen`. **"Department"** `<select>` (placeholder `"Select
department"`, options `data.departments` labeled `` `${id} - ${name}` ``) — choosing one calls
`onLoad({ deptId })`. Once staff rows are returned, a table `# | Staff | Designation | Order`,
where **Order** is the only editable cell (`<input type="number" className="form-control-sm">`);
Staff and Designation are plain text. **"Save order"** submit (`btn btn-danger`), rendered only
when `rows.length > 0`.

Server (`loadWebStaffDisplaySetup`, `webStaffDisplaySetup.js`): departments from
`staff_dept_master` (`del=1`, ordered by `d_order`). Staff rows resolved by a join across
`staff_designation_tb` ⋈ `staff_profile_tb` ⋈ `staff_desg_master`, **left-joined** to
`staff_web_desg_order` (the actual persisted order table) to pick up any existing `d_order`/row id
— filtered to `is_academic=1` and `job_category IN ('255','257')` (hardcoded numeric category IDs,
not resolved from any lookup label in this file — worth checking `edu_setup_tb` if those codes
ever need to change) and not-yet-relieved staff. Save requires a resolvable `deptId`
(`'Select a department.'`); for each row, updates the existing `staff_web_desg_order` row by
`rowId` if present, otherwise inserts a new one — this is an **upsert-per-row pattern**, unlike
most other web screens' single-record save.

### 3.6 `doc-upload` — Web Document Upload (`website_doc_upload.php`)

Component: `WebDocUploadScreen`. **"PDF documents"** `<input type="file" accept=".pdf,
application/pdf" multiple>`, checkbox **"Overwrite existing files"** (default unchecked),
**"Upload"** submit (`btn btn-danger`, disabled if `busy` or no files selected). Below the form: a
**"Documents folder"** table (`File | Size | Link`) listing everything already in the folder, with
each row's Size shown in KB and a **"Open"** link to `f.url`. Empty state: single muted row
**"No documents yet."**. After a successful upload, the client resets `selected` and re-calls
`onLoad()` to refresh the folder listing.

Server (`loadWebDocUploadSetup`/`saveWebDocUploadSetup`, `webDocUploadSetup.js`): load simply
lists the `documents` folder on disk (`listLegacyFolderFiles`, `server/src/services/web/
webUpload.js`) — **not database-backed at all**, this screen operates directly on the filesystem.
Save: each file must have a `.pdf` extension (else per-file error `"{name}: PDF only"`, collected
but not fatal to the whole batch); if `overwrite` is unchecked and a same-named file already
exists on disk, that file is skipped with error `"{name}: already exists (enable overwrite)"`;
otherwise saved via `saveLegacyBinaryFile` with `preserveName: true` (so, unlike photo/attachment
uploads elsewhere in this module which get a randomized timestamp-based filename, **PDF uploads
here keep their original filename** — a deliberate choice since these are meant to be
directly-linkable public document URLs), 20 MB cap. If **zero** files ended up saved and at least
one error occurred, the whole save reports `{success:false, message: errors.join('; ')}`;
otherwise `{success:true, message: 'Uploaded {n} file(s).' [+ ' Skipped: ...' if any per-file
errors occurred alongside at least one success]}`.

### 3.7 `research-program-add` / `research-program-edit` — Research Program (`web_research_news_add.php` / `_edit.php`)

Components: `WebResearchAddScreen` / `WebResearchEditScreen`, both built on a shared `ResearchForm`
(`client/src/pages/web/setup/WebResearchScreen.jsx`). Fields in DOM order: **"Research topic"**
(required), **"Program date"** (`fromDate`, defaults today), **"Registration close"** date,
**"Time"** (`progTime`, free text — no time-of-day input type used), **"Venue"**,
**"Description"** `<textarea rows={4}>`, **"Presenter name"**, **"Designation"**, **"Department"**,
**"College"**, **"City"** (five separate free-text fields describing the guest presenter — no
lookup against `staff_profile_tb`, this is for external presenters), **"Target link"**,
**"Attachment"** `<input type="file">` (any type — `DOC_EXT = {pdf, doc, docx}` enforced only
server-side), checkboxes **"Web view"** / **"Member view"**. **"Save"** submit (`btn btn-danger`).
Edit screen additionally has a left `list-group` of existing programs (`data.programs`, label
`p.topic`) that calls `onLoad({ programId })` on click; the form only renders once a program is
selected.

Server (`webResearchSetup.js`): both Add and Edit funnel through a shared `saveProgramFields`
helper. Add requires non-empty `researchTopic` (`'Research topic is required.'`); Edit requires a
resolvable `programId` (`'Select a program.'`) — **note Edit does not separately re-validate
`researchTopic` non-empty**, since `saveProgramFields` is shared and only the Add-screen wrapper
does that check before calling it; an edit save that clears the topic to blank would persist an
empty `research_topic`. Attachment upload reuses `saveLegacyBinaryFile` (10 MB cap, `DOC_EXT`).
Messages: `'Research program added.'` / `'Research program updated.'`.

### 3.8 `event-add` / `event-edit` — Events (`festival_event_add.php` / `festival_event_edit.php`)

Components: `WebEventAddScreen` / `WebEventEditScreen`, built on a shared `EventForm`
(`client/src/pages/web/setup/WebEventsScreen.jsx`). Fields in DOM order: **"Event name"**
(required, marked with a red `*`), **"Type"** — a `<select multiple>` sized `Math.min(6,
Math.max(3, options.length))` populated from `data.eventTypes` (from the `event-type` screen's
master list), **"From date"** / **"To date"** both `<input type="datetime-local">` (both required,
marked `*`), **"Venue"** (required, marked `*`), **"Description"** `<textarea rows={6}>`,
**"Attachment"** `<input type="file">` (any extension client-side; server enforces `DOC_EXT =
{pdf, doc, docx, xls, xlsx, ppt, pptx}`) with a small "Current: {url}" hint if one is already
attached, **"Gallery photos"** `<input type="file" multiple accept="image/*">`, an **"Existing
gallery"** row of link-buttons (`Photo {order||id}`) if `form.photos` is non-empty, **"Web view"**
Yes/No radio pair, and — **only on the Edit screen** (`onDelete` prop present) — a **"Status"**
`<select>` with options **Confirm** (1) / **Not Yet Confirm** (4) / **Postpone** (2) / **Cancel**
(3) (note the value ordering 1,4,2,3 is intentional in the source, not a typo — Confirm/Not-Yet
grouped first, then Postpone/Cancel). **"Save"** submit (`btn btn-danger`); Edit screen only also
shows **"Delete event"** (`btn btn-outline-danger`).

Edit screen additionally: a search `<input>` (`"Search events..."`) + **"Search"** button filtering
the left `list-group` of events (title + venue shown per row); clicking an event calls
`onLoad({ eventId, search })`. Deleting shows a `ConfirmModal` (title **"Delete event?"**, message
**"Delete this event? This cannot be undone."**, confirm button **"Delete Event"**, `tone:
'danger'`) before calling `onSave({ action:'delete', eventId })`; on success a toast **"Event
deleted"** fires (`useToast()`), on failure a toast with the server's message or a generic
**"Delete failed"**.

Server (`webEventsSetup.js`): both Add and Edit funnel through `persistEvent`, which requires
non-empty `title` (`'Event name is required.'`) — again shared, so Edit doesn't independently
re-check beyond this. Event type multi-select stored as a **comma-joined string** in `event_type`
(not a join table) — `mapEvent` parses it back by splitting on commas. Datetime fields converted
from the `datetime-local` input string via `fromInputDateTime`/formatted back for display via
`toInputDateTime`. Gallery photo uploads (`gallery_{i}` fields) insert into the same `web_photos`
table used by the Photos module, tagged `photos_from:'Events'`, `ref_id: eventId`, continuing the
existing max `photo_order` for that event. Delete (`action==='delete'`) is a **soft-delete of both
the event row and all its `web_photos` rows** (`del=0` on `web_events` **and** on `web_photos
WHERE ref_id=eventId AND photos_from='Events'`) — so deleting an event also hides its gallery
photos, consistent with "this cannot be undone" messaging even though technically reversible at
the DB level via `del=1` restore. Messages: `'Event added.'` / `'Event updated.'` / `'Event
deleted.'`.

### 3.9 `event-type` — Event Type / Category Master (`event_category.php`)

Component: `WebEventTypeScreen`. A table `# | Category | ` — each row's Category cell is an
editable text `<input className="form-control-sm">`; existing rows (with an `id`) get a
**"Delete"** button (`btn btn-sm btn-outline-danger`, fires `onSave({ action:'delete', id })`
**immediately, no confirm modal** — unlike Events' delete, which does confirm); new unsaved rows
(no `id` yet) get a **"Remove"** button that just splices them out of local state without any
server call. Below the table: **"Add row"** (`btn btn-outline-secondary btn-sm`, appends a blank
`{title:''}` row locally) and **"Save"** (`btn btn-danger btn-sm`) which submits the **entire**
`rows` array in one `onSave({ rows })` call.

Server (`loadWebEventType`/`saveWebEventType`): load lists all `web_event_type` rows (`del=1`,
alphabetical). Save: delete path soft-deletes one row by `id`. Bulk-save path iterates every row
in the submitted array — **rows with a blank/whitespace-only title are silently skipped**
(`if (!title) continue`, so an accidentally-blanked existing row's title is simply never updated,
not deleted, not errored); rows with an `id` get updated, rows without get inserted. This means a
single "Save" click can create new categories and update existing ones' titles in the same
request, but never deletes via the bulk path (deletion is only the separate immediate per-row
button).

## 4. Primary user stories

**US-21.1 — Publish/update a static content page**
As a **web content editor**, I want to pick one of the ten static-page sections (About Us,
Departments, LMS, Journal, Facilities, AAADAR, Research, Academic, IQAC, Outreach), write/edit its
title, order, link slug, publish date, raw HTML body, and Enable/Draft state, and save it, so that
the corresponding section of the public website reflects current content.
*Acceptance criteria:* saving with a blank title is rejected (`'Page title is required'`); leaving
Link slug blank auto-derives one from the title; the page list on the left reflects the saved
order/title immediately after save (server reloads the just-saved page).

**US-21.2 — Configure the homepage hero slider**
As a **web content editor**, I want to edit each of up to 7 pre-existing slider slots' type,
order, image filename, colors, link/title/message content, and widget/image/content toggles, and
save all slides at once, so that the homepage hero rotates through current promotional content.
*Acceptance criteria:* only slides with a resolvable numeric `id` are updated — there is no way to
add an 8th slide from this screen, since the UI has no "add slide" control and the server silently
skips id-less rows.

**US-21.3 — Publish a new photo gallery**
As a **web content editor**, I want to set a date/title/description, upload a cover image and
multiple gallery images, and toggle website visibility, so that a new photo gallery appears on the
public site.
*Acceptance criteria:* Title is required; cover/gallery uploads are restricted to
jpeg/jpg/gif/png/webp under 5 MB each; the form resets to blank after any save attempt (success or
failure — see US-21.10).

**US-21.4 — Update an existing photo gallery's metadata**
As a **web content editor**, I want to pick an existing gallery, edit its date/title/description/
visibility and optionally replace its cover image, so that gallery metadata stays current without
re-uploading every photo.
*Acceptance criteria:* individual photos within the gallery cannot be added, removed, or
reordered from this screen — only the gallery's own cover/metadata are editable here, per the UI
gap noted in §3.4.

**US-21.5 — Set staff photo/order on department web pages**
As **academic/HR office staff**, I want to pick a department and set the display order for each
eligible academic staff member (job categories 255/257, not yet relieved) shown on that
department's public web page, so that staff appear in a deliberate, not alphabetical-only, order.
*Acceptance criteria:* saving without selecting a department is rejected (`'Select a
department.'`); each row upserts independently (existing `staff_web_desg_order` rows update,
missing ones insert).

**US-21.6 — Upload website PDF documents**
As a **web content editor**, I want to upload one or more PDFs (optionally overwriting
same-named existing files) and see the current documents folder listing with direct links, so
that downloadable resources (prospectuses, forms, circulars) are available on the public site.
*Acceptance criteria:* non-PDF files are rejected per-file with `"{name}: PDF only"`; a same-named
existing file is skipped unless "Overwrite existing files" is checked; uploaded PDFs keep their
original filename (unlike other upload types in this module) so existing public links keep
working after a re-upload with overwrite enabled.

**US-21.7 — Announce a research program/news item**
As a **web content editor**, I want to enter research-topic, schedule, presenter details, an
optional attachment, and visibility flags, and save it as a new or updated research program
announcement, so that the Research section of the website lists current programs.
*Acceptance criteria:* Add requires a non-blank Research topic; the Edit path reuses the same save
logic without independently re-validating topic non-blank once a program is selected (see
US-21.11).

**US-21.8 — Create, search, edit, and delete website events**
As a **web content editor**, I want to add events with name/type/date-range/venue/description/
attachment/gallery photos, search and pick existing events to edit their details or status
(Confirm/Not Yet Confirm/Postpone/Cancel), and delete an event with a confirmation prompt, so
that the public Events listing reflects the college's current festival/academic calendar.
*Acceptance criteria:* Name, From date, To date, and Venue are all required; deleting shows a
`ConfirmModal` before soft-deleting both the event and its gallery photos; a success toast reads
"Event deleted".

**US-21.9 — Maintain the event category master list**
As a **web content editor**, I want to add, rename, and delete event categories (used by the Type
multi-select on Events), so that events can be organized/filterable by category.
*Acceptance criteria:* deleting an existing category has no confirmation step (unlike deleting an
event itself); saving the whole grid at once both creates new rows and updates renamed existing
rows, but silently skips any row whose title was blanked out rather than deleting or erroring it.

## 5. Rare / edge-case user stories

**US-21.10 — Publishing content with a broken image/attachment link**
As a **web content editor**, none of the upload-bearing screens (Photos Add/Edit, Research
Add/Edit, Event Add/Edit, Doc Upload) validate that an uploaded file is actually a valid,
non-corrupt image/PDF/document beyond a byte-size cap and file-extension allowlist
(`IMG_EXT`/`DOC_EXT`/`PDF_EXT` checks in `webUpload.js`/each service) — a truncated or
zero-byte file with a valid `.jpg` extension would be written to disk and referenced by filename
in the DB exactly like a valid image, surfacing as a broken image only on the actual public
website (outside this module's screens, which mostly just render text filenames or `<a>` links,
not `<img>` previews — e.g. `WebPhotosEditScreen`'s photo list only shows a "View" link, no thumbnail).
Similarly, `WebSliderScreen`'s **"Image filename"** field is a raw text input, not a file
picker — an editor can type an arbitrary/non-existent filename directly, saving a slide that
references an image that was never uploaded through this module at all.

**US-21.11 — Unpublishing content currently displayed on the live public site**
As a **web content editor**, switching a static page to **"Draft"** (unchecking `enabled`),
unchecking a photo gallery's/research program's/event's **"Show on website"** (`webView`)
checkbox, or deleting an event outright, all take effect immediately on save with **no scheduling,
staging, or "are you sure this is currently live" warning** anywhere in this module (contrast with
Events' delete, which at least has a `ConfirmModal`, but toggling `webView`/`enabled` off on any
screen has none). Because there's no live-preview link back to the actual public page from any of
these screens, an editor cannot directly confirm from within this module whether the content
they're about to unpublish is presently visible before committing the change.

**US-21.12 — Editing a research program/event without re-validating required fields**
As noted in §3.7/§3.8, both `saveProgramFields` (research) and `persistEvent` (events) are shared
between the Add and Edit save paths and only check their own required field
(`researchTopic`/`title`) once inside the shared helper — this does mean Edit *does* still enforce
it (since the check lives in the shared function, not just the Add wrapper) for Research
`researchTopic`, but for Events, the venue/from-date/to-date `required` attributes are **only
enforced client-side** (the HTML5 `required` attribute on the `<input>`s) — `persistEvent`
server-side only checks `title`. A direct API call (or a browser with JS/HTML5 validation
disabled) could save an event with a blank venue or missing dates.

**US-21.13 — Photo gallery cover/gallery images uploaded to a shared, unscoped folder**
As a **developer maintaining this module**, note that `photos-add`/`photos-edit` write cover and
gallery images into the generic `documents` folder (`saveWebPhotosSetup.js`'s `folder:
'documents'`), the same folder `doc-upload` writes PDFs into and research attachments also use —
there is no dedicated `photos` folder for this screen (Events' gallery photos, by contrast, do use
a dedicated `photos` folder — see `webEventsSetup.js`'s `saveEventGallery`). Filenames are
randomized (`Date.now()` + random 4 digits) except for `doc-upload`'s PDFs, so collisions across
screens are unlikely, but there is no logical separation on disk between "photo gallery images,"
"PDF documents," and "research attachments" despite them serving different public-facing purposes.

### Future (not implemented)

- *(Future — not implemented)* **WYSIWYG editor for static page content** — every `WebPageScreen`
  content field today is a raw `<textarea>` requiring hand-typed HTML (§3.1); a rich-text editor
  (e.g. TinyMCE/Quill) with an image-upload-into-content flow would remove the need for editors to
  know HTML and would let them embed images without manually referencing uploaded filenames.
- *(Future — not implemented)* **Live preview / staging before publish**, directly addressing
  US-21.11 — a "Preview" link or side-by-side render of the actual public page before toggling
  Enable/Draft or `webView` off, plus a scheduled-publish date that's more than just the existing
  `postOn`/`fromDate` display field (none of the current fields actually gate visibility by date
  server-side within this module — `postOn` is stored but nothing here proves it's enforced as a
  future-publish gate on the public site, since that rendering logic is outside this module).
- *(Future — not implemented)* **Automatic broken-link/broken-image detection on save**, directly
  addressing US-21.10 — validating uploaded file integrity (not just extension/size) and,
  separately, validating that `WebSliderScreen`'s free-typed "Image filename" actually corresponds
  to a file that exists in the expected folder before allowing save.
- *(Future — not implemented)* **Drag-and-drop reordering for gallery photos and slider slots** —
  today reordering is a raw number-input per row (`staff-display-order`, `photos-edit` has no
  reorder UI at all); a proper drag-and-drop list would remove the risk of duplicate/gapped order
  values a numeric input allows.
- *(Future — not implemented)* **Mobile-facing "campus events" read view.** `mobile.md` §6 does
  not list a Web CMS/events feature in its v1 backend-reuse table (it focuses on
  Dashboard/Attendance/Fees/Exam/Library/Directory/Circulars/Files) — but §6's stated v1 principle
  ("ship read + light-write... before any heavy setup/admin screens... Admin/setup screens...stay
  on the web app") would apply equally here: a read-only mobile "Upcoming Events" screen consuming
  `web_events`/`web_event_type` (already `del=1`/`webView`-filterable server-side) is a plausible,
  low-risk mobile extension consistent with that stated principle, though it is not mentioned in
  `mobile.md` itself and is purely this document's extrapolation.
- *(Future — not implemented)* **Confirm-before-delete consistency** across Event Type (currently
  no confirm, §3.9) versus Events (has a `ConfirmModal`, §3.8) — standardizing on the confirm-modal
  pattern already built for Events.

## 6. Traceability

| Story | Client file(s) | Server endpoint | Service file | Table(s) |
|---|---|---|---|---|
| US-21.1 | `WebPageScreen.jsx` | `POST /api/web/setup/<page-slug>/load\|save` | `webPageSetup.js` | `web_pages` |
| US-21.2 | `WebSliderScreen.jsx` | `POST /api/web/setup/slider-animation/load\|save` | `webSliderSetup.js` | `slider_animation_tb` |
| US-21.3 | `WebPhotosAddScreen.jsx` | `POST /api/web/setup/photos-add/load\|save` | `webPhotosSetup.js`, `webUpload.js` | `web_photos_gallery`, `web_photos` |
| US-21.4 | `WebPhotosEditScreen.jsx` | `POST /api/web/setup/photos-edit/load\|save` | `webPhotosSetup.js`, `webUpload.js` | `web_photos_gallery`, `web_photos` |
| US-21.5 | `WebStaffDisplayScreen.jsx` | `POST /api/web/setup/staff-display-order/load\|save` | `webStaffDisplaySetup.js` | `staff_web_desg_order`, `staff_profile_tb`, `staff_dept_master`, `staff_desg_master`, `staff_designation_tb` |
| US-21.6 | `WebDocUploadScreen.jsx` | `POST /api/web/setup/doc-upload/load\|save` | `webDocUploadSetup.js`, `webUpload.js` | (filesystem only — `legacyFilesPath/documents`) |
| US-21.7 | `WebResearchScreen.jsx` | `POST /api/web/setup/research-program-add\|research-program-edit/load\|save` | `webResearchSetup.js`, `webUpload.js` | `research_program` |
| US-21.8 | `WebEventsScreen.jsx` (`WebEventAddScreen`, `WebEventEditScreen`) | `POST /api/web/setup/event-add\|event-edit/load\|save` | `webEventsSetup.js`, `webUpload.js` | `web_events`, `web_photos` |
| US-21.9 | `WebEventsScreen.jsx` (`WebEventTypeScreen`) | `POST /api/web/setup/event-type/load\|save` | `webEventsSetup.js` | `web_event_type` |
| US-21.10 | `WebPhotosAddScreen.jsx`, `WebPhotosEditScreen.jsx`, `WebResearchScreen.jsx`, `WebEventsScreen.jsx`, `WebSliderScreen.jsx` | `POST /api/web/setup/*/save` | `webUpload.js`, `webPhotosSetup.js`, `webResearchSetup.js`, `webEventsSetup.js`, `webSliderSetup.js` | `web_photos`, `research_program`, `web_events`, `slider_animation_tb` |
| US-21.11 | `WebPageScreen.jsx`, `WebPhotosAddScreen.jsx`/`Edit`, `WebResearchScreen.jsx`, `WebEventsScreen.jsx` | `POST /api/web/setup/*/save` | `webPageSetup.js`, `webPhotosSetup.js`, `webResearchSetup.js`, `webEventsSetup.js` | `web_pages`, `web_photos_gallery`, `research_program`, `web_events` |
| US-21.12 | `WebResearchScreen.jsx`, `WebEventsScreen.jsx` | `POST /api/web/setup/research-program-edit\|event-edit/save` | `webResearchSetup.js` (`saveProgramFields`), `webEventsSetup.js` (`persistEvent`) | `research_program`, `web_events` |
| US-21.13 | `WebPhotosAddScreen.jsx`, `WebDocUploadScreen.jsx`, `WebResearchScreen.jsx` | `POST /api/web/setup/photos-add\|doc-upload\|research-program-add/save` | `webUpload.js` (`saveLegacyBinaryFile`) | (filesystem — `legacyFilesPath/documents`) |

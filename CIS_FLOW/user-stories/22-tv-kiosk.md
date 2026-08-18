# 22 — TV & Kiosk Displays

> This file covers two related but separate modules: **TV** (digital-signage widgets shown on
> lobby/corridor TVs) and **Kiosk** (touchscreen attendance/machine kiosks placed in rooms).
> Both are entirely **admin/setup** screens in this repo — the actual full-screen device UI that
> plays the slider/widgets on a physical TV, or the touchscreen attendance flow on a physical
> kiosk, still lives in the legacy PHP tree (`tv/` folder, `att_menu.php`, etc.) and is **not**
> part of this modernized client. What has been migrated is the back-office configuration that
> feeds those legacy device screens their content.

---

# Part A — TV

## A.1 Module overview

**Purpose.** Configure the content shown on lobby/corridor TV displays: a rotating "slider" of
widgets (announcements, live feeds), photo/video/API galleries, YouTube playlists, a live-video
overlay, per-user dashboard widget access, and the TV's own print CSS file. The physical
full-screen slider that actually renders on the TV is legacy PHP under `tv/`; this module only
edits the rows/files that legacy renderer reads.

**Actors.**
- Admin/Global users (`accessType === 'Global'`) — bypass `menuAuthForModule('tv')` entirely.
- TV/media-desk staff — granted access via menu patterns `tv_%` / `tv/%`
  (`server/src/middleware/menuAuth.js` line 80: `tv: ['tv_%', 'tv/%']`).

**Legacy PHP files replaced** (`client/src/pages/tv/tvSetupMeta.js`):

| Legacy file | Modern screen |
|---|---|
| `tv_slider_widget.php` | Slider Widget |
| `tv_slider_config.php` | Slider Style |
| `tv_dashboard_access.php` | Dashboard Access |
| `tv_slider_access.php` | Individual Access |
| `tv_photo_gallery.php` | TV Photo Gallery |
| `tv_video_gallery.php` | TV Video Gallery |
| `tv_api_gallery.php` | TV API Gallery |
| `tv_youtube_gallery.php` | YouTube Gallery |
| `tv_live_video.php` | TV Live Video |
| `tv_print_style.php` | TV CSS |

TV uses the shared generic factory: `client/src/pages/tv/TvModule.jsx` wires `TV_SCREEN_META` +
a `COMPONENTS` map into `createModuleSetupPage` (`client/src/components/ModuleSetupFactory.jsx`)
and `createSetupApi('/api/tv')` (`client/src/hooks/createSetupApi.js`) — no custom hook or page
shell, unlike Library (§13). There is also a standalone `TvDashboardPage.jsx` (route
`/tv/dashboard`) that is **not** part of the setup factory — it calls `GET /api/tv/dashboard`
directly with plain `useState`/`useEffect`, not `useTvSetupApi`.

## A.2 Screen inventory

| Route | Component | Legacy `.php` |
|---|---|---|
| `/tv` | `TvHub` (`createModuleHub`) in `TvModule.jsx` | (hub) |
| `/tv/dashboard` | `client/src/pages/tv/TvDashboardPage.jsx` | (no direct 1:1 legacy page — summarizes `tv_setup_tb`/`tv_video_tb`/`tv_access_tb`/`tv_log_tb`) |
| `/tv/setup` | `TvSetupHub` (`createModuleSetupHub`) | (hub) |
| `/tv/setup/slider-widget` | `TvSliderWidgetScreen` in `client/src/pages/tv/setup/TvScreens.jsx` | `tv_slider_widget.php` |
| `/tv/setup/slider-config` | `TvSliderConfigScreen` | `tv_slider_config.php` |
| `/tv/setup/dashboard-access` | `TvAccessScreen` | `tv_dashboard_access.php` |
| `/tv/setup/slider-access` | `TvSliderAccessScreen` | `tv_slider_access.php` |
| `/tv/setup/photo-gallery` | `TvPhotoGalleryScreen` (via `GalleryEditor`) | `tv_photo_gallery.php` |
| `/tv/setup/video-gallery` | `TvVideoScreen` | `tv_video_gallery.php` |
| `/tv/setup/api-gallery` | `TvApiGalleryScreen` (via `GalleryEditor`) | `tv_api_gallery.php` |
| `/tv/setup/youtube-gallery` | `TvYoutubeScreen` | `tv_youtube_gallery.php` |
| `/tv/setup/live-video` | `TvLiveVideoScreen` | `tv_live_video.php` |
| `/tv/setup/print-style` | `TvPrintStyleScreen` | `tv_print_style.php` |

Routes registered in `client/src/routes/AppRoutes.jsx` (lines 286–289): `/tv`, `/tv/dashboard`,
`/tv/setup`, `/tv/setup/:screen`.

Server: `server/src/routes/tv.js` — `router.use(authMiddleware, menuAuthForModule('tv'))`, then
`GET /api/tv/dashboard`, `POST /api/tv/setup/:screen/load`, `POST /api/tv/setup/:screen/save`.
Dispatcher `server/src/services/tv/tvSetup.js` (`VALID_SCREENS`/`LOADERS`/`SAVERS` maps). Per-screen
logic in `server/src/services/tv/*.js`; shared audit helpers `auditFields`/`logModulePage` in
`server/src/services/shared/moduleAudit.js`.

## A.3 Pixel-level flow per screen

### A.3.1 TV Dashboard (`/tv/dashboard`, `TvDashboardPage.jsx`)

- On mount, `GET /api/tv/dashboard` → `loadTvDashboard()` in `server/src/services/tv/tvDashboard.js`.
- Three summary cards (`<div className="card p-3">`): **Widgets** (`prisma.tv_setup_tb.count({where:{del:1}})`),
  **Videos** (`SELECT COUNT(*) AS c FROM tv_video_tb WHERE del=1`), **Access rules**
  (`prisma.tv_access_tb.count({where:{del:1}})`) — each shown as `<strong>{title}</strong>` above a
  `<div className="fs-3">{count}</div>`.
- Table headed `Page | Operation | Status | User | When`, rows from the 10 most recent
  `tv_log_tb` rows (`orderBy: {id:'desc'}, take: 10`) — each timestamp sliced to `.slice(0, 19)`.
- Loading state: `<PageLoading />` while `loading` is true; no explicit empty-state text if
  `recentLogs` is empty (renders an empty `<tbody>`).
- This screen makes no save call — pure read view.

### A.3.2 Slider Widget (`slider-widget`, `TvSliderWidgetScreen`)

Uses the shared `ListEditor` (list on the left, field form on the right — same component reused
by Video Gallery, §A.3.6).
- **List:** buttons labeled by `item.name || item.widgetName || item.attachment || item.username || '#'+id`.
- **Fields:** `Widget name`, `Content` (textarea, rows 6), `Background image`, `Background color`,
  `Effect`, `Delay (ms)` — plain text inputs except Content.
- **Save:** single `Save` button (`btn-danger`). Server `saveTvSliderWidget()` in
  `server/src/services/tv/tvSliderWidget.js`: on `payload.id` present → `UPDATE`, else `INSERT`
  with `del: 1` via `auditFields`. Delete branch (`payload.action === 'delete'`) sets `del: 0` and
  returns message **"Widget deleted..."**; normal save returns **"Widget saved..."**. Both
  responses splice in a fresh `loadTvSliderWidget()` result so the list refreshes inline.
- The saved row always writes hard-coded defaults not exposed in the UI:
  `title_color: '#000000'`, `stitle_color: '#333333'`, `text_color: '#000000'`,
  `stext_color: '#666666'`, `font_size: '14'` (overwritten by Slider Style, §A.3.3, for existing
  rows).

### A.3.3 Slider Style (`slider-config`, `TvSliderConfigScreen`)

A single big table, one row per existing widget (rows come from `data.widgets`, not editable
count — this screen only styles widgets already created in A.3.2).
- **Columns (DOM order):** `S.no`, `Widget` (name, read-only text), `Effects` (`<select>` grouped
  by `<optgroup>` from `data.slideEffects`, sourced from
  `server/src/services/tv/tvSliderEffects.js`'s `TV_SLIDE_EFFECTS`), `Time (sec)` (text,
  `maxLength=7`), `BG Image` (`<input type=file accept="image/*">` + `View`/`Remove` links when
  an image is set), `Bg Color` (custom `ColorInput` — hex swatch input, `maxLength=7`,
  auto-uppercases and strips leading `#`), then two-row-header groups for `Title`
  (`Color`/`Size (px)`), `Sub Title`, `Content`, `Sub Content` — each a `ColorInput` + a
  3-char-max numeric text input.
- Uploading a background image reads it via `FileReader.readAsDataURL`, stores it in local
  `pendingFiles` keyed `bgImage_{id}`, and is included in the `files` array passed to `onSave`.
  Clicking `Remove` clears the pending file and sets `removeBgImage: true` on that row.
- **Save button:** `Save` (`btn-danger`), `disabled={busy || widgets.length === 0}`.
- **Server** `saveTvSliderConfig()` in `server/src/services/tv/tvSliderConfig.js`: if
  `payload.widgets` is empty, returns `{ success: false, message: 'No widgets to update' }` (no
  DB writes). For each row with a numeric `id`, resolves the background image (upload wins over
  `removeBgImage` wins over existing `bgImage`), strips `#` from all colors, joins the four size
  fields into a single `font_size` CSV column (`formatFontSizes` — `"30,20,16,14"` order:
  title/subtitle/text/subtext), updates `tv_setup_tb`, then **regenerates
  `tv/css/slider.css`** on disk (`config.legacyCisPath + 'tv/css/slider.css'`) from all saved
  rows via `buildSliderCss()` — this is the actual mechanism the legacy TV slider renderer reads
  for per-widget styling. Returns `{ success: true, message: 'Style updated.' }`.

### A.3.4 Dashboard Access (`dashboard-access`, `TvAccessScreen`)

- `Select user` dropdown (`data.users` from `loadTvUserOptions()` in `tvShared.js`); picking a
  user calls `onLoad({ userId })`.
- Once a user is chosen: two utility buttons `Check all` (sets every row's `enabled: true`
  locally) and `Fill default` (renumbers `order` sequentially 1..n, does not touch `enabled`).
- Table `Enable | Order | Widget`: checkbox + text order input per widget row (union of rows
  already assigned to this user in `tv_access_tb` and any unassigned `tv_setup_tb` widgets, per
  `loadTvDashboardAccess()` in `server/src/services/tv/tvDashboardAccess.js`).
- Empty state: `"No TV widgets are configured in Slider Widget setup."` when `widgets.length === 0`.
- **Save** button `Save access` (`btn-danger`) → `onSave({ userId, widgets })`. Server
  `saveTvDashboardAccess()`: first soft-deletes (`del=0`) **all** existing `tv_access_tb` rows for
  that user, then for every row with `enabled: true` either updates the existing row (`del=1`) or
  inserts a fresh one with `status`/`widget_order`/hard-coded `from_time`/`to_time`
  (`08:00`–`18:00`). Rows left unchecked simply stay soft-deleted. Message: **"Dashboard access
  updated."**

### A.3.5 Individual Access (`slider-access`, `TvSliderAccessScreen`)

Drag-reorderable per-user schedule table (`useDragReorder` hook, `DragHandle` component,
`client/src/hooks/useDragReorder.js`).
- `Select user` dropdown; on load without a user picked, `onLoad()` still fires on mount.
- Table columns: drag-handle, `Order` (read-only, "Drag the row's handle to reorder" tooltip),
  `Widget` (`<select>` from `data.widgetOptions`, first option `-- Select --`), `From`, `To`
  (plain text time inputs), `Active` checkbox, trash-icon delete button per row.
- `Add row` button (`btn-outline-secondary`) appends `{ rowId: null, widgetKey: '', order:
  rows.length+1, fromTime: '00:00', toTime: '23:59', active: true }`.
- Deleting a persisted row (`row.rowId` present) calls `onSave({ action: 'delete', rowId, userId })`
  immediately (no confirm dialog); deleting an unsaved row just splices it out of local state.
- `Save` button (`btn-danger btn-sm`) → `onSave({ userId, rows })`.

### A.3.6 TV Photo Gallery (`photo-gallery`) / TV API Gallery (`api-gallery`)

Both driven by the shared `GalleryEditor({ itemKey, itemLabel, showTimes })` in `TvScreens.jsx`:
- Left column: list of galleries (`data.galleries`) plus a `+ New gallery` button that clears the
  form to blank.
- Right column form: `Title` (required text), `From`/`To` (`datetime-local`).
- **Photo Gallery** (`showTimes=false`): a single multi-file `<input type=file accept="image/*"
  multiple>` — each selected file is base64-encoded and sent as `photo_{index}` in the `files`
  array; `payloadItems` rebuilt from `photoFiles` with sequential `order`.
- **API Gallery** (`showTimes=true`, `itemLabel="API URL"`): a table `Order | API URL | From | To`
  with an `Add API row` button (`btn-outline-secondary btn-sm`) appending a blank row.
- **Buttons:** `Save` (`btn-danger`) always; `Delete` (`btn-outline-danger`) only rendered when
  `galleryId` is set — `onSave({ action: 'delete', galleryId })`.
- Server: `server/src/services/tv/tvPhotoGallery.js` / `tvApiGallery.js` (screen-specific
  load/save pair registered in `tvSetup.js`'s `LOADERS`/`SAVERS`).

### A.3.7 TV Video Gallery (`video-gallery`, `TvVideoScreen`)

Same `ListEditor` pattern as Slider Widget (§A.3.2). Fields: `Video URL/path`, `From`, `To`.
Server `server/src/services/tv/tvVideoGallery.js` exposes `listTvVideosRaw()`, reused by the
YouTube Gallery loader (§A.3.8) since both read `tv_video_tb`.

### A.3.8 YouTube Gallery (`youtube-gallery`, `TvYoutubeScreen`)

Table `# | YouTube ID`, each row an `input-group` with a static prefix
`<span className="input-group-text">youtube.com/watch?v=</span>` followed by the editable ID
text input. `Save YouTube IDs` button (`btn-danger`) → `onSave({ videos })`. Server
`saveTvYoutubeGallery()` in `server/src/services/tv/tvExtraSetup.js` updates `attachment` on
each `tv_video_tb` row by numeric `id`; message **"YouTube IDs updated."**

### A.3.9 TV Live Video (`live-video`, `TvLiveVideoScreen`)

Single-record form (`live_setup_tb` row id=1, no list — this is a singleton config):
`Event title`, `Direct live` checkbox, `From`/`To` (`datetime-local`), `Player widget (HTML)`
(textarea, rows 4), `Description` (textarea, rows 3), `Background image` (`<input type=file
accept="image/*">`, shows `Current: {wImage}` when one exists). Submit reads any picked file via
`FileReader` and sends it as field `wImage`; button label `Save live settings`
(`btn-danger`). Server `saveTvLiveVideo()` in `tvExtraSetup.js` writes the uploaded image to
`config.legacyFilesPath/announcement/{timestamp}{random4digits}.{ext}` and updates
`live_setup_tb WHERE id=1`; message **"Live video settings saved."**

### A.3.10 TV CSS (`print-style`, `TvPrintStyleScreen`)

A raw textarea (`font-monospace`, rows 20) bound directly to the contents of
`tv/css/style.css` on the legacy filesystem (`server/src/services/tv/tvExtraSetup.js`,
`STYLE_PATH = path.join(config.legacyCisPath, 'tv/css/style.css')`). Load reads the file (falls
back to empty string on any read error, e.g. file missing — no error surfaced to the UI). `Save
CSS` button (`btn-danger`) writes the raw string back with `fs.writeFile`, creating the parent
directory if needed; message **"TV CSS updated."** There is no CSS syntax validation — any text
typed is written verbatim, so a malformed stylesheet can be saved and will break the TV's visual
rendering until corrected.

## A.4 Primary user stories

1. **As TV/media-desk staff, I want to create a slider widget with title/content/background** so
   it can be added to a user's dashboard rotation. *(§A.3.2)* *Acceptance:* saving without an
   `id` inserts a new `tv_setup_tb` row with `del:1`; the list on the left refreshes immediately
   from the server's bundled reload.
2. **As TV/media-desk staff, I want to style each widget's colors, fonts, and background image**
   so the on-screen slider matches branding. *(§A.3.3)* *Acceptance:* saving regenerates
   `tv/css/slider.css` on disk from every widget's current style row — this is the only way the
   physical TV picks up style changes, since the legacy renderer reads that static CSS file, not
   the database directly at render time.
3. **As an admin, I want to choose which widgets appear on a given user's TV dashboard, in what
   order, and toggle each on/off** so per-office/per-role displays differ. *(§A.3.4)* *Acceptance:*
   unchecking a widget and saving removes it from that user's `tv_access_tb` rotation (soft-delete),
   without affecting other users' assignments.
4. **As an admin, I want to schedule individual widgets to appear only during specific time
   windows, and reorder them by dragging**, for a single user's slider. *(§A.3.5)* *Acceptance:*
   dragging a row updates its `Order` value; deleting a persisted row calls the delete save
   immediately without a confirmation step.
5. **As TV/media-desk staff, I want to build a photo or API-driven gallery with a title and date
   range** for time-boxed campaigns (e.g. an event week). *(§A.3.6)* *Acceptance:* the `Delete`
   button only appears once a gallery has been saved (`galleryId` set) — new/unsaved galleries
   have no delete affordance.
6. **As TV/media-desk staff, I want to configure a live-video overlay with a title, time window,
   and background image** for streamed events (convocation, etc.). *(§A.3.9)*
7. **As an admin, I want to directly edit `tv/css/style.css`** for one-off visual tweaks without
   needing filesystem/SSH access. *(§A.3.10)*

## A.5 Rare / edge-case user stories

1. **Display with no content configured (blank screen).** As a visitor walking past a TV with no
   widgets ever created in Slider Widget (§A.3.2) and no gallery/video content, the physical
   slider has nothing to rotate. *Evidence:* `loadTvDashboard()` would report `widgets: 0`; the
   Dashboard Access screen explicitly renders `"No TV widgets are configured in Slider Widget
   setup."` when `data.widgets` (the union query) is empty — but this message only appears to the
   admin configuring access, never on the TV device itself (which is legacy PHP, out of scope
   here). The modernized admin UI has no synthetic "preview empty state" for what the TV would
   actually show.
2. **TV widget referencing a deleted record.** Dashboard Access (§A.3.4) and Individual Access
   (§A.3.5) both build their widget option lists by joining `tv_access_tb`/`tv_slider_access`
   rows against `tv_setup_tb WHERE del=1`. If a widget referenced by an access row is later
   deleted (soft-deleted via `saveTvSliderWidget()`'s delete branch, §A.3.2), that access row
   still exists with a `widget_name`/`widgetKey` pointing at a now-`del=0` id — the join in
   `loadTvDashboardAccess()` (`INNER JOIN tv_setup_tb AS A ON ... WHERE A.del=1`) simply drops it
   from the list; the stale `tv_access_tb` row is never cleaned up, so it becomes an orphaned row
   an admin can't see or delete from either screen.
3. **CSS file missing or unreadable.** `loadTvPrintStyle()` silently returns `content: ''` on any
   `fs.readFile` error (missing file, permission denied) rather than surfacing an error — the
   admin sees an empty textarea indistinguishable from "the file is genuinely empty," and saving
   from that state would overwrite/recreate the file with blank content.
4. **Concurrent Slider Style saves race the CSS file.** Two admins editing Slider Style (§A.3.3)
   for different widgets at the same time each call `saveTvSliderConfig()`, which rewrites the
   **entire** `tv/css/slider.css` file from just the widgets included in that save's payload
   (`savedRows`) — since the client only submits the currently-loaded widget table, a second
   save issued from a stale page load could silently drop styling for widgets the first admin
   just changed, because `buildSliderCss()` only iterates `savedRows` from the request that
   triggered it, not the full current table.
5. **Bad `slideDelay`/size values are not validated.** `Time (sec)`, `titleSize`, `stitleSize`,
   `textSize`, `stextSize` are all plain text inputs with only a `maxLength` clamp — no numeric
   `type` or range check on either client or server (`String(row.titleSize || ''))`), so a value
   like `abc` is stored as-is in the `font_size` CSV column and will simply fail to parse as a
   pixel size on the TV.

## A.6 Future / predicted user stories

### Future (not implemented)

Grounded in `mobile.md` — TV/kiosk are explicitly **not** in its mobile feature map (§6 lists
Login/Dashboard/Attendance/Fees/Exam/Library/Directory/Circulars/Files only) and are desk/admin
configuration screens, matching `mobile.md` §6's stated v1 principle ("Admin/setup screens...
stay on the web app — they're desk/desktop workflows, not mobile ones").

1. *(Speculative)* As TV/media-desk staff, I want a visual scheduling calendar (drag widgets onto
   a weekly grid) instead of the current per-row `From`/`To` text time inputs in Individual
   Access (§A.3.5), so time-window conflicts are visible before saving.
2. *(Speculative)* As an admin, I want a live browser-based preview of what a given TV/user's
   slider currently looks like, reusing the same widget/style data this module already edits,
   instead of only being able to check by physically walking to the display.
3. *(Speculative)* As an admin, I want the Slider Style save (§A.3.3) to validate numeric fields
   (delay, font sizes) before writing `tv/css/slider.css`, closing the gap noted in §A.5.5.
4. *(Speculative)* As an admin managing TV content from a phone, I want a read-only mobile view of
   the TV Dashboard summary (§A.3.1) — this would be a new `mobile/` screen per `mobile.md`'s
   pattern of reusing existing `/api/*` read endpoints, not a new backend capability.

---

# Part B — Kiosk

## B.1 Module overview

**Purpose.** Configure physical touchscreen kiosk machines used for staff/student self-service
attendance punching and small admin tasks (machine PIN reset, room/machine registry, kiosk-side
attendance menu content, announcements shown on the kiosk, and material-request receipt
formatting). Like TV, the actual full-screen kiosk touch UI is legacy PHP (`att_menu.php` etc.);
this module is the back-office configuration feeding it.

**Actors.**
- Admin/Global users — bypass `menuAuthForModule('kiosk')`.
- Facilities/attendance-desk staff — granted access via menu patterns (`server/src/middleware/menuAuth.js`
  line 81): `machine_%`, `att_menu%`, `att_instruction%`, `slider_widget%`, `student_machine%`,
  `staff_machine%`, `staff_mpassword%`, `student_mpassword%`, `announcement_%`, `m_recepit%`,
  `m_att_%`.

**Legacy PHP files replaced** (`client/src/pages/kiosk/kioskSetupMeta.js`):

| Legacy file | Modern screen |
|---|---|
| `machine_access.php` | Machine Access |
| `machine_room_add.php` | Machine Room Add |
| `machine_room_edit.php` | Machine Room Edit |
| `student_machine_password.php` | Student Machine PIN |
| `staff_machine_password.php` | Staff Machine PIN |
| `slider_widget.php` | Machine Slider |
| `slider_widget_edit.php` | Slider Widget Style |
| `att_menu.php` | Attendance Menu |
| `att_menu_access.php` | Attendance Menu Access |
| `att_instruction.php` | Attendance Instruction |
| `staff_mpassword_reset.php` | Staff PIN Reset |
| `student_mpassword_reset.php` | Student PIN Reset |
| `m_att_statement.php` | Attendance Statement |
| `announcement_add.php` | Add Announcement |
| `announcement_edit.php` | Edit Announcement |
| `m_recepit_setup.php` | Receipt Setup |

Kiosk also uses the shared generic factory: `client/src/pages/kiosk/KioskModule.jsx` wires
`KIOSK_SCREEN_META` + a `COMPONENTS` map into `createModuleSetupPage`/`createSetupApi('/api/kiosk')`
— identical pattern to TV (Part A). Three screen slugs are parameterized wrappers around one
shared component: `student-password`/`staff-password` both render `MachinePasswordScreen` with a
`type` prop; `staff-pin-reset`/`student-pin-reset` both render `PinResetScreen` with a `type`
prop; `machine-room-add`/`machine-room-edit` both render `MachineRoomScreen` with a `mode` prop.

## B.2 Screen inventory

| Route | Component | Legacy `.php` |
|---|---|---|
| `/kiosk` | `KioskHub` | (hub) |
| `/kiosk/setup` | `KioskSetupHub` | (hub) |
| `/kiosk/setup/machine-access` | `MachineAccessScreen` | `machine_access.php` |
| `/kiosk/setup/machine-room-add` | `MachineRoomAddScreen` → `MachineRoomScreen mode="add"` | `machine_room_add.php` |
| `/kiosk/setup/machine-room-edit` | `MachineRoomEditScreen` → `MachineRoomScreen mode="edit"` | `machine_room_edit.php` |
| `/kiosk/setup/student-password` | `MachinePasswordScreen type="student"` | `student_machine_password.php` |
| `/kiosk/setup/staff-password` | `MachinePasswordScreen type="staff"` | `staff_machine_password.php` |
| `/kiosk/setup/machine-slider` | `MachineSliderScreen` | `slider_widget.php` |
| `/kiosk/setup/slider-widget` | `SliderWidgetStyleScreen` | `slider_widget_edit.php` |
| `/kiosk/setup/att-menu` | `AttMenuScreen` | `att_menu.php` |
| `/kiosk/setup/att-menu-access` | `AttMenuAccessScreen` | `att_menu_access.php` |
| `/kiosk/setup/att-instruction` | `AttInstructionScreen` | `att_instruction.php` |
| `/kiosk/setup/staff-pin-reset` | `PinResetScreen type="staff"` | `staff_mpassword_reset.php` |
| `/kiosk/setup/student-pin-reset` | `PinResetScreen type="student"` | `student_mpassword_reset.php` |
| `/kiosk/setup/att-statement` | `AttStatementScreen` | `m_att_statement.php` |
| `/kiosk/setup/announcement-add` | `AnnouncementAddScreen` | `announcement_add.php` |
| `/kiosk/setup/announcement-edit` | `AnnouncementEditScreen` | `announcement_edit.php` |
| `/kiosk/setup/receipt-setup` | `ReceiptSetupScreen` | `m_recepit_setup.php` |

Routes: `client/src/routes/AppRoutes.jsx` lines 290–292 (`/kiosk`, `/kiosk/setup`,
`/kiosk/setup/:screen`). Server: `server/src/routes/kiosk.js` —
`router.use(authMiddleware, menuAuthForModule('kiosk'))`, `POST /api/kiosk/setup/:screen/load|save`
(no `GET /dashboard` — kiosk has no dashboard summary screen, unlike TV). Note the save route
has an extra branch not present in `tv.js`: `if (result.success === false) return
res.status(400).json({ message: result.message || 'Save failed' })` — kiosk save failures are
surfaced as HTTP 400s, whereas TV's route only checks `result.error`. Dispatcher
`server/src/services/kiosk/kioskSetup.js`. Shared constants (`KIOSK_MENU_CATEGORIES`,
`KIOSK_MENU_ACCESS_CATEGORIES`, `ATT_STATEMENT_OPTIONS`, `RECEIPT_TYPES`, `randomPin()`,
`loadJobCategories()`) in `server/src/services/kiosk/kioskShared.js`.

## B.3 Pixel-level flow per screen

### B.3.1 Machine Access (`machine-access`, `MachineAccessScreen`)

- `Staff category` — a free-text `<input list="staff-cats">` (native HTML `<datalist>`) backed by
  `data.staffCategories` (distinct `staff_cat` values from `access_machine`), plus a `Load groups`
  button (`btn-outline-info btn-sm`) that re-fires `onLoad({ staffCategory })`.
- Read-only table `Group | Days | From | To` showing `data.groups` for the selected category
  (times sliced `.slice(11,16)` from the stored datetime).
- New-group form row: `Group #` text, `Days (Mon,Tue)` text (split on comma client-side into an
  array), `From`/`To` (`<input type=time>`).
- `Save access` submit (`btn-primary`) → `onSave({ staffCategory, ...form })`. Server
  `saveMachineAccess()` in `server/src/services/kiosk/machineAccess.js`: if `staffCategory` is
  blank, returns `{ success: false, message: 'Staff category is required' }`. Delete branch
  (`action:'delete'`) soft-deletes all rows matching `staffCat`+`acc_group`, message **"Access
  group deleted..."**. On normal save, if no `group` number given, auto-assigns
  `max(acc_group)+1`; otherwise soft-deletes the prior row for that group before inserting the
  new one (so editing a group is delete-then-recreate, not an UPDATE). Message: **"Machine access
  updated..."**

### B.3.2 Machine Room Add / Edit (`machine-room-add` / `machine-room-edit`, `MachineRoomScreen`)

Add mode (`mode="add"`) shows only the room form centered in a card; Edit mode shows a two-column
layout with a searchable room list on the left.
- **Room list (edit mode only):** search box (`Search room, block, or machine ID`) + `Search`
  button; list items show room name + `{blockName} · {machineId}`; `Clear form` button
  (`btn-outline-primary btn-sm`) resets to blank via `startNewRoom()`.
- **Form fields:** `Block *` — `<select>` from `data.blockOptions` plus a synthetic `Add new
  block` option (value `'add_new'`); selecting it swaps the next field's label to `New block
  name *` (otherwise `Block name *`) and clears it for typing. `Hall / Room no. *`, `Machine ID *`
  (placeholder "Comma-separated IDs" — a room can map to multiple physical machine IDs),
  `IP address` (placeholder `e.g. 192.168.1.10`), `Description` (textarea, rows 3).
- **Buttons:** `Save`/`Save room` submit (label varies by mode/state); `Delete`
  (`btn-outline-danger`, edit mode with a room selected only) opens the shared `ConfirmModal`
  (`client/src/pages/fees/setup/ConfirmModal.jsx`) with message **"Delete this room?"**.
- **Server** `saveMachineRoom()` / `loadMachineRoom()` in `server/src/services/kiosk/machineRoom.js`:
  validation errors returned as `{ success: false, message: 'Hall/Room name is required.' }` or
  `'Machine ID is required.'`; block resolution (`resolveBlockId()`) can independently fail with
  `'Block name is required for a new block.'` or `'Block selection is required.'` — all surfaced
  through the same `{ success: false, message }` shape. On success: `'Room saved.'` or (delete)
  `'Room deleted.'`

### B.3.3 Student/Staff Machine PIN (`student-password` / `staff-password`, `MachinePasswordScreen`)

- `Search by ID or name` text + `Search` button (`btn-outline-info`); auto-loads on mount with an
  empty search (`onLoad({ type, search: '' })` in the initial `useEffect`).
- Table `Code | Name | PIN | (action)` — the PIN cell is an **uncontrolled** input
  (`defaultValue={row.password}`, `id={pin-${row.id}}`) read directly via `document.getElementById`
  at click time rather than React state; `Update` button per row (`btn-sm btn-primary`) →
  `onSave({ type, search, id: row.id, password: <that field's current DOM value> })`.
- Server `saveMachinePassword()` in `server/src/services/kiosk/machinePassword.js`: if `id` or
  `password` (trimmed) is missing, returns `{ success: false, message: 'Record and PIN are
  required' }`. Writes directly to `student_profile_tb.a_pin` / `staff_profile_tb.a_pin` by
  numeric `id` (no `del` filter on the UPDATE itself). Message: **"Machine PIN updated..."**

### B.3.4 Machine Slider (`machine-slider`, `MachineSliderScreen`)

Repeatable slide cards, each: `Type` select (`Image`/`Video`), `Order` number, `Image` text
(filename/path, not a file picker despite the "Image" label), `Interval (sec)` number, `BG`
(background color hex text), `Text` (foreground color hex text), `Link` (content link URL),
`Title` (content title), `Message` (textarea, rows 2), and three checkboxes: `Widget`, `Image`,
`Content` (enable flags per slide, independent of the slide's own Type). No add/remove-row UI
present in this screen (unlike most other Kiosk list screens) — slides come entirely from
`data.slides` on load. `Save slider` submit, `disabled={busy || !slides.length}`.

### B.3.5 Slider Widget Style (`slider-widget`, `SliderWidgetStyleScreen`)

Three raw-code textareas keyed `contentScript`, `contentJs`, `contentStyle` (labels are literally
these camelCase keys, not friendly text — the least-polished screen in this module, same pattern
noted for Library's Supplier Edit). `Save style` submit.

### B.3.6 Attendance Menu (`att-menu`, `AttMenuScreen`)

- `Category` picker (`CategoryPicker` shared component — `<select>` labeled `Category`, options
  from `data.categories` = `KIOSK_MENU_CATEGORIES`: `Staff`/`Student`/`Hostel`/`Inventory`/`Material`);
  changing it both sets local state and calls `onLoad({ menuCategory })`.
- Drag-reorderable table (`useDragReorder`) — columns: drag-handle, `On` checkbox (`enable`),
  `Order` (read-only, drag-only), `Title`, `URL`, `Icon`, trash-icon delete.
- `Add row` (`btn-outline-secondary btn-sm`) appends a blank enabled row with the next order
  number. `Save menu` (`btn-primary btn-sm`, `disabled={busy || !menuCategory}`).
- Deleting a persisted row calls `onSave({ menuCategory, action:'delete', rowId })` immediately.
- **Server** `saveKioskAttMenu()` in `server/src/services/kiosk/kioskAttSetup.js`: blank category
  → `{ success: false, message: 'Select a category.' }`. Loops every row in the payload doing raw
  `UPDATE`/`INSERT` against `att_menu_tb` (rows with a `rowId` update in place; new rows only
  insert **if `row.title` is truthy** — a blank new row added via `Add row` and left empty is
  silently dropped, not saved and not erroring). Delete sets `del=0`. Message: **"Menu saved."**

### B.3.7 Attendance Menu Access (`att-menu-access`, `AttMenuAccessScreen`)

`Category` picker (`KIOSK_MENU_ACCESS_CATEGORIES` — same list minus `Hostel`) + a single
`Staff IDs (comma-separated)` textarea (rows 4) storing a raw `staff_list` string against
`att_menu_access` (one row per `menu_cat`, upserted by presence-check). `Save access` submit,
`disabled={busy || !menuCategory}`.

### B.3.8 Attendance Instruction (`att-instruction`, `AttInstructionScreen`)

Singleton form (`pages_tb WHERE id=2`) — `Title` text, `Content` textarea (rows 10). `Save
instruction` submit. This is the instructional text shown on the physical kiosk before a
student/staff member punches in.

### B.3.9 Staff/Student PIN Reset (`staff-pin-reset` / `student-pin-reset`, `PinResetScreen`)

- Descriptive text: **"Regenerate machine PINs for {staff|students}."**
- `Search by` select: `Category / all` or `{Staff ID|Register no.} (comma-separated)`.
- If `roll_no` chosen: a single `IDs` text input. If `category` chosen and `type==='staff'`: a
  `Job category` `CategoryPicker` (options from `loadJobCategories()` — distinct
  `staff_profile_tb.job_category` joined to `edu_setup_tb` where `category='Category'`). If
  `type==='student'` and `category` mode, no extra field is shown at all (category-based reset
  for students has no scoping control in this screen — implies "all students" is the only
  category option, though no such note appears in the code beyond the missing UI).
- `Regenerate PINs` submit (`btn-danger`) → `onSave({ type, searchBy, searchInput,
  searchCategory })`. Server logic lives in `server/src/services/kiosk/kioskPinAndStatement.js`
  (`loadKioskPinReset`/`saveKioskPinReset`), reusing `randomPin()` from `kioskShared.js` (4-digit
  numeric string).

### B.3.10 Attendance Statement (`att-statement`, `AttStatementScreen`)

`Staff category` picker; on selection, a `list-group` of checkbox options is loaded from
`data.options` — the fixed label set is `ATT_STATEMENT_OPTIONS` in `kioskShared.js`: `Periods
Attended/Allocated`, `Deputation Periods`, `OD`, `Non FP Punch - Modified (days)`, `Pre Approval
Leave/Permission`, `Post Approval Leave/Permission`, `No. of Working Days`, `Present`, `Total
Leave`, `Late`, `Permission`, `LOP Deduction`. `Save options` button (`btn-primary`,
`disabled={busy || !staffCategory}`) — this configures which columns appear on the kiosk-printed
attendance statement for that staff category, not a report screen itself.

### B.3.11 Add / Edit Announcement (`announcement-add` / `announcement-edit`)

- **Add:** `Title *` (required), `Description` (textarea rows 4), `From`/`To` date inputs (each
  constrained via `max`/`min` against the other), `Audience` select (`All`/`Staff`/`Student`),
  two checkboxes `TV widget` and `TV flash` — an announcement can optionally also surface on the
  TV slider (cross-module link to Part A). `Add announcement` submit (`btn-primary`).
- **Edit:** left list of existing announcements (`{title}` + `{fromDate} – {toDate}` subtext,
  clicking loads it via `onLoad({ announcementId })`); same field set on the right; two buttons:
  `Update` (`disabled={busy || !announcementId}`) and `Delete`
  (`btn-outline-danger`, same disabled guard) → `onSave({ action:'delete', announcementId })`.
- Server: `server/src/services/kiosk/kioskAnnouncementAndReceipt.js`.

### B.3.12 Receipt Setup (`receipt-setup`, `ReceiptSetupScreen`)

- Two pickers: `Job category` (`loadJobCategories()`) and `Receipt type` (`RECEIPT_TYPES` —
  currently only `Material Request`). The setup form only renders once **both** are selected.
- Numeric fields: `Task assign`, `Task row` (default `1`), `Row height` (default `20`).
- `Receipt message` textarea (rows 3).
- Signature table: `Name | Designation | Order | Row`, `Add signature` button
  (`btn-outline-secondary btn-sm`).
- `Save receipt setup` submit (`btn-primary`) → `onSave({ jobCategory, receiptType, setup,
  signatures })`. This configures the printed receipt layout for kiosk-initiated material
  requests.

## B.4 Primary user stories

1. **As facilities staff, I want to define which staff category can use a kiosk on which days and
   time window** (`machine-access` — §B.3.1), so out-of-hours punching is blocked at the source.
   *Acceptance:* saving with a blank `Staff category` is rejected with **"Staff category is
   required"** before any DB write.
2. **As facilities staff, I want to register a room + its machine ID(s) + IP, optionally creating
   a new building block inline** (`machine-room-add`/`-edit` — §B.3.2), so new kiosk hardware maps
   to a physical location. *Acceptance:* choosing `Add new block` and leaving the new name blank
   is rejected with **"Block name is required for a new block."** before the room itself is saved.
3. **As facilities staff, I want to look up a student/staff member and reset their machine PIN by
   typing directly into the PIN cell** (`student-password`/`staff-password` — §B.3.3), so a
   forgotten kiosk PIN can be fixed on the spot without a full profile edit. *Acceptance:* the
   `Update` button per row writes only that row's `password` and `id` — no bulk save exists.
4. **As facilities staff, I want to bulk-regenerate PINs for a whole staff job-category or a
   pasted list of IDs** (`staff-pin-reset`/`student-pin-reset` — §B.3.9), for onboarding cohorts
   or a security reset, instead of doing it one row at a time via §B.3.3.
5. **As an attendance-desk admin, I want to build the kiosk's on-screen menu (title/URL/icon per
   item) per category and reorder it by dragging** (`att-menu` — §B.3.6), so the touchscreen shows
   the right options for staff vs. student vs. hostel kiosks.
6. **As an attendance-desk admin, I want to restrict which staff IDs can even see a given kiosk
   menu category** (`att-menu-access` — §B.3.7), layering access control on top of the menu
   content itself.
7. **As an admin, I want to publish a kiosk-side announcement with a date range and audience, and
   optionally also flash it on the TV slider** (`announcement-add` — §B.3.11), reusing one save
   action to reach two physical display types.
8. **As facilities staff, I want to configure which attendance metrics print on a staff category's
   attendance statement** (`att-statement` — §B.3.10), controlling report content per audience.

## B.5 Rare / edge-case user stories

1. **Kiosk offline / unreachable.** None of the Kiosk setup screens in this repo talk to the
   physical kiosk device directly — every save just writes rows the legacy `att_menu.php` device
   UI polls on its own next load. *Evidence:* there is no health-check, heartbeat, or "last seen"
   field anywhere in `server/src/services/kiosk/*.js` for a `machine_id`/`machine_ip` — Machine
   Room (§B.3.2) records an IP purely as metadata with no ping/reachability check on save, so an
   admin has no way from this UI to tell whether a configured kiosk is actually online; a change
   saved here (menu content, PIN, instruction text) will silently sit unapplied on a kiosk that's
   powered off or network-unreachable until it next polls.
2. **Kiosk display timeout mid-transaction.** Because the touchscreen punch flow itself is legacy
   PHP and out of scope for this modernized client, this repo has no session/timeout handling to
   document for a kiosk user who walks away mid-punch. The one indirectly related control is
   `ATT_STATEMENT_OPTIONS`'s `non_fp_punch` ("Non FP Punch - Modified (days)") column in
   Attendance Statement (§B.3.10) — implying the legacy system separately tracks/flags punches
   that were manually corrected because the original device interaction didn't complete cleanly,
   but no such correction workflow exists in the modernized Kiosk screens themselves.
3. **Blank new menu row silently dropped.** In `att-menu` (§B.3.6), clicking `Add row` then
   `Save menu` without ever typing a `Title` does not error — `saveKioskAttMenu()`'s insert branch
   is gated on `else if (row.title)`, so a blank new row is simply skipped, and the admin gets a
   success message (**"Menu saved."**) with no indication that row wasn't persisted.
4. **PIN Reset with no scoping for students in category mode.** `PinResetScreen` (§B.3.9) shows a
   `Job category` picker only when `type === 'staff'`; for `type === 'student'` with `Search by:
   Category / all` selected, no scoping field renders at all, meaning the only interpretation
   left is "reset every active student's PIN" — a single click on `Regenerate PINs` in that
   default state is a large blast-radius action with no extra confirmation step visible in
   `PinResetScreen.jsx` beyond the button itself.
5. **Editing a machine-access group is destructive, not additive.** `saveMachineAccess()`
   (§B.3.1) handles an edit to an existing `group` number by soft-deleting the prior row and
   inserting a new one rather than updating in place — if the insert step were to fail after the
   soft-delete succeeded (no transaction wraps the two statements), the group would be left with
   no active access row at all.
6. **Uncontrolled PIN input read via `document.getElementById`.** `MachinePasswordScreen`
   (§B.3.3) reads the PIN value directly from the DOM (`document.getElementById(pin-${row.id}).value`)
   at click time rather than through React state — if the table re-renders between typing and
   clicking `Update` (e.g. triggered by an unrelated `data` update from another concurrent
   `onLoad`), the typed value could be lost from the DOM before it's read.

## B.6 Future / predicted user stories

### Future (not implemented)

Grounded in `mobile.md` — Kiosk, like TV, is absent from the mobile feature map (§6); it is a
physical-hardware desk workflow, matching the "Admin/setup screens... stay on the web app" v1
principle stated there.

1. *(Speculative)* As facilities staff, I want a live kiosk-health dashboard (online/offline,
   last-punch timestamp per `machine_id`) closing the gap in §B.5.1 — this would require new
   heartbeat/polling infrastructure in the legacy kiosk client and a new backend endpoint, not
   just a UI change.
2. *(Speculative)* As a student/staff member, I want a kiosk-equivalent self-service check-in from
   my phone (geofenced or QR-based), reusing the same PIN/attendance tables this module already
   configures — this parallels `mobile.md` §6's "Attendance (student/staff)... Calendar/list view"
   read-only scope, but a self-check-in write path is explicitly a stretch beyond v1's "read +
   light-write" principle (§6, "mark self-attendance if the role allows it" is listed as Phase 3).
3. *(Speculative)* As an attendance-desk admin, I want `att-menu` (§B.3.6) to validate a new row's
   Title before allowing Save, so a blank row is never silently discarded as noted in §B.5.3.
4. *(Speculative)* As an admin, I want PIN Reset (§B.3.9) to require a typed confirmation phrase
   before a category-wide "all students" regeneration, given the blast radius noted in §B.5.4.

---

## Traceability

| Story | Client file | Server endpoint / service | Table(s) |
|---|---|---|---|
| TV Dashboard | `client/src/pages/tv/TvDashboardPage.jsx` | `GET /api/tv/dashboard` → `server/src/services/tv/tvDashboard.js` | `tv_setup_tb`, `tv_video_tb`, `tv_access_tb`, `tv_log_tb` |
| Slider Widget | `client/src/pages/tv/setup/TvScreens.jsx` (`TvSliderWidgetScreen`) | `POST /api/tv/setup/slider-widget/save` → `server/src/services/tv/tvSliderWidget.js` | `tv_setup_tb` |
| Slider Style | `TvSliderConfigScreen` | `.../slider-config/save` → `server/src/services/tv/tvSliderConfig.js` | `tv_setup_tb`; writes `tv/css/slider.css` on disk |
| Dashboard Access | `TvAccessScreen` | `.../dashboard-access/save` → `server/src/services/tv/tvDashboardAccess.js` | `tv_access_tb`, `tv_setup_tb` |
| Individual Access | `TvSliderAccessScreen` | `.../slider-access/save` → `server/src/services/tv/tvSliderAccess.js` | `tv_slider_access` (per-user schedule) |
| Photo/API Gallery | `TvPhotoGalleryScreen` / `TvApiGalleryScreen` (`GalleryEditor`) | `.../photo-gallery`, `.../api-gallery` save | `server/src/services/tv/tvPhotoGallery.js`, `tvApiGallery.js` |
| Video/YouTube Gallery | `TvVideoScreen` / `TvYoutubeScreen` | `.../video-gallery/save`, `.../youtube-gallery/save` → `tvVideoGallery.js`, `tvExtraSetup.js` | `tv_video_tb` |
| Live Video | `TvLiveVideoScreen` | `.../live-video/save` → `tvExtraSetup.js` | `live_setup_tb`; writes uploaded image under `legacyFilesPath/announcement/` |
| TV CSS | `TvPrintStyleScreen` | `.../print-style/save` → `tvExtraSetup.js` | filesystem: `tv/css/style.css` |
| Machine Access | `client/src/pages/kiosk/setup/KioskScreens.jsx` (`MachineAccessScreen`) | `POST /api/kiosk/setup/machine-access/save` → `server/src/services/kiosk/machineAccess.js` | `access_machine` |
| Machine Room Add/Edit | `MachineRoomScreen` | `.../machine-room-add`, `.../machine-room-edit` save → `server/src/services/kiosk/machineRoom.js` | `rooms_tb`, `blocks_tb` |
| Machine PIN (Student/Staff) | `MachinePasswordScreen` | `.../student-password`, `.../staff-password` save → `server/src/services/kiosk/machinePassword.js` | `student_profile_tb.a_pin`, `staff_profile_tb.a_pin` |
| PIN Reset | `PinResetScreen` | `.../staff-pin-reset`, `.../student-pin-reset` save → `server/src/services/kiosk/kioskPinAndStatement.js` | same PIN columns, bulk |
| Machine Slider / Slider Widget Style | `MachineSliderScreen` / `SliderWidgetStyleScreen` | `.../machine-slider`, `.../slider-widget` save → `server/src/services/kiosk/kioskSliderSetup.js` | kiosk slider tables |
| Attendance Menu / Menu Access | `AttMenuScreen` / `AttMenuAccessScreen` | `.../att-menu`, `.../att-menu-access` save → `server/src/services/kiosk/kioskAttSetup.js` | `att_menu_tb`, `att_menu_access` |
| Attendance Instruction | `AttInstructionScreen` | `.../att-instruction/save` → `kioskAttSetup.js` | `pages_tb` (id=2) |
| Attendance Statement | `AttStatementScreen` | `.../att-statement/save` → `server/src/services/kiosk/kioskPinAndStatement.js` | kiosk statement options table |
| Announcement Add/Edit | `AnnouncementAddScreen` / `AnnouncementEditScreen` | `.../announcement-add`, `.../announcement-edit` save → `server/src/services/kiosk/kioskAnnouncementAndReceipt.js` | announcement table (+ TV widget/flash flags) |
| Receipt Setup | `ReceiptSetupScreen` | `.../receipt-setup/save` → `kioskAnnouncementAndReceipt.js` | receipt setup/signature tables |
| Audit / logging (both modules) | all screens | `logModulePage()` / `auditFields()` in `server/src/services/shared/moduleAudit.js` → `insertLog()` in `server/src/services/logService.js` | `log_tb` (both modules); TV Dashboard's "recent logs" table separately reads `tv_log_tb`, a distinct table not written by `logModulePage` |

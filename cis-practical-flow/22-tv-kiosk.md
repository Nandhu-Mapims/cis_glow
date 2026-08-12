# 22 — TV & Kiosk Displays — Frontend Control & UX Audit

> Covers two related but separate modules, following the same split as
> [user-stories/22-tv-kiosk.md](../user-stories/22-tv-kiosk.md): **Part A — TV** (lobby/corridor
> digital-signage config) and **Part B — Kiosk** (touchscreen attendance-machine config). Both
> are pure back-office admin surfaces — the physical device UI itself is legacy PHP, out of
> scope for this repo — so every control here exists to shape what *later* renders somewhere
> else (a TV screen, a kiosk touchscreen), never to render it directly. That gap — no in-app
> preview of the physical output anywhere in either module — is the single biggest recurring
> theme in §A.4 and §B.4 below.

---

# Part A — TV

## A.1 Module recap

See [user-stories/22-tv-kiosk.md](../user-stories/22-tv-kiosk.md) §Part A for the full
pixel-level flow. TV configures a rotating widget slider, per-widget styling (which
regenerates a static `tv/css/slider.css` file the legacy renderer reads), per-user dashboard
widget access, a drag-reorderable per-user schedule, photo/API/video/YouTube galleries, a live-
video overlay, and a raw CSS editor. All ten setup screens live in one file,
`client/src/pages/tv/setup/TvScreens.jsx` (27 KB), built on two shared internal components:
`ListEditor` (list-on-left, field-form-on-right — reused by Slider Widget and Video Gallery) and
`GalleryEditor` (reused by Photo Gallery and API Gallery). `TvDashboardPage.jsx` is a separate,
read-only summary screen outside the setup factory.

## A.2 Frontend control inventory

| Screen | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| TV Dashboard (`/tv/dashboard`) | Read-only summary cards + a 10-row recent-activity table | No | — | — | Pure read view, no save; no explicit empty-state text for zero recent logs |
| Slider Widget (`ListEditor`) | `list-group` (click-to-load) + plain text inputs + one `<textarea rows={6}>` | No | Single (one widget at a time) | No | Delete branch reuses the same save endpoint (`action:'delete'`); several style fields (`title_color`, `font_size`, etc.) are written as hard-coded defaults not exposed anywhere in this screen's own UI |
| Slider Style | One big table, one row per **existing** widget (no add/remove here) — per-row native `<select>` (Effects, grouped by `<optgroup>`), custom `ColorInput` (hex swatch + text, auto-uppercase/strip `#`), numeric-ish text inputs (`maxLength` only, no `type="number"`), single-file `<input type="file" accept="image/*">` per row with View/Remove links | No | — (fixed set = existing widgets) | No | Save disabled if zero widgets exist; regenerates a static CSS file on disk as its actual side effect — the *only* screen in this module whose save has a filesystem effect beyond the DB |
| Dashboard Access | Native `<select>` (Select user) + a table of checkbox+text-order rows | No | Single (user) / multi (widget rows via checkboxes) | Yes — **"Check all"** (sets every row enabled) and **"Fill default"** (renumbers order 1..n) | Empty state text when zero widgets configured; delete-then-recreate save pattern (all prior rows soft-deleted, then re-inserted from checked rows) |
| Individual Access | Native `<select>` (Select user) + **drag-reorderable table** (`useDragReorder`) with per-row native `<select>` (Widget), text time inputs, checkbox (Active), trash-icon delete | No | Single (user) | No explicit bulk toggle (unlike Dashboard Access's Check-all/Fill-default) | "Add row" appends a blank row locally; deleting a **persisted** row saves immediately with no confirm; deleting an unsaved row just splices local state |
| TV Photo Gallery (`GalleryEditor`, `showTimes=false`) | `list-group` (click-to-load) + plain text/datetime fields + `<input type="file" accept="image/*" multiple>` | No | Single (gallery) | No | "+ New gallery" clears form locally; Delete button only appears once a gallery has a saved `galleryId` |
| TV API Gallery (`GalleryEditor`, `showTimes=true`) | Same `list-group` shell as Photo Gallery + a table `Order | API URL | From | To` with an "Add API row" button | No | Single (gallery) | No | No file upload — pure text/URL rows |
| TV Video Gallery (`ListEditor`) | Same `list-group` + text-field shell as Slider Widget | No | Single | No | Fields: Video URL/path, From, To — no file upload, path is typed |
| YouTube Gallery | Plain table, each row an `input-group` with a static prefix span + editable text ID | No | — (flat list) | No | Single "Save YouTube IDs" bulk-submits the whole table at once |
| TV Live Video | Singleton form (no list — one config row) | — | — | — | Single-file `<input type="file" accept="image/*">` for background image; shows "Current: {wImage}" hint when one exists |
| TV CSS | Single raw `<textarea rows={20} className="font-monospace">` bound to a file on disk | No | — | — | **No syntax validation** — any text saved verbatim; silent fallback to empty string on file-read error, indistinguishable from "file is genuinely empty" |

No screen in Part A uses `SearchableSelect` or `CheckListSelect`. The only genuinely advanced
control in the module is `useDragReorder` on Individual Access — which makes it stand out
sharply against Dashboard Access and Slider Style, structurally similar "manage a list of rows"
screens one click away, that use plain number inputs / no reorder at all instead.

## A.3 Advanced feature gaps

1. **Slider Style's numeric-ish fields (`Time (sec)`, four color-pair size fields) are plain
   text inputs with only `maxLength`, never `type="number"` or a range check** — a value like
   `abc` is written straight into the `font_size` CSV column and silently fails to parse on the
   TV (flagged directly in the user-stories doc, §A.5.5). This is a validation gap, not a
   missing-component gap, but it sits in the same screen responsible for the module's only
   filesystem side-effect (regenerating `slider.css`), which raises the cost of a bad value.
2. **Dashboard Access has "Check all"/"Fill default" bulk actions; Individual Access, the
   screen one click away covering the same widget universe for the same user, has neither.**
   A admin bulk-enabling a user's whole widget set on Dashboard Access, then wanting per-widget
   time windows on Individual Access, has to manually add/configure each row from scratch on
   the second screen with no "seed from Dashboard Access's enabled set" shortcut.
3. **No confirm step before deleting a persisted Individual Access row**, while TV Photo/API
   Gallery both gate their Delete button behind having a saved `galleryId` first (a soft guard,
   though still not an explicit confirm dialog) — Individual Access's per-row trash icon fires
   the delete save immediately on click with no intermediate step at all.
4. **Slider Widget/Video Gallery's `list-group` pickers have no search**, same pattern flagged
   repeatedly in the SMS and Web CMS audits — acceptable while a lobby TV realistically has a
   small number of widgets/videos, but there is no ceiling enforced anywhere, and the pattern
   ports directly from `SearchableSelect`'s "single value, substring filter" shape if a college
   ever accumulates enough widgets to need it.
5. **The background-image upload fields (Slider Style per-row, Live Video) show no thumbnail
   preview**, only a "View"/"Remove" link or a "Current: {filename}" text hint — same visual
   gap flagged in the Web CMS audit for its own image uploads. Given TV is *entirely* a visual-
   display config module, this is arguably a bigger miss here than in Web CMS.

## A.4 User-experience suggestions

1. **A live "what this will actually look like" preview panel, reusing the same widget/style
   data these screens already edit.** Why it helps: per the user-stories doc's own explicit
   edge case (§A.5.1 — "the modernized admin UI has no synthetic 'preview empty state' for what
   the TV would actually show"), an admin configuring Slider Widget/Slider Style/Dashboard
   Access today has no way to verify their changes short of physically walking to a TV. Even a
   simplified browser-rendered mock of the slider rotation (using the same `title_color`/
   `font_size`/background fields Slider Style already collects) would close the single largest
   confidence gap across the whole TV module — and is explicitly listed as a *(Speculative)*
   future story in the user-stories doc already (§A.6.2), so this isn't a new idea, just a
   concrete restatement of it with an implementation anchor (Slider Style's existing field data).
2. **Drag-reorder for Dashboard Access's widget ordering**, replacing the current text `Order`
   input, and reusing `useDragReorder` already proven one screen over on Individual Access. Why
   it helps: both screens configure the same conceptual thing (a per-user widget rotation order)
   for the same underlying `tv_setup_tb` widget universe — having one drag-reorderable and the
   other a raw number input is an unforced inconsistency within a two-screen workflow an admin
   moves between directly.
3. **Numeric input types + inline range validation on Slider Style's Time/Size fields**,
   directly closing gap #1. Why it helps: this screen's save is the only one in the module with
   a filesystem side effect (`slider.css` regeneration) — a bad value here breaks the *physical
   TV's rendering* until manually corrected, a higher blast radius than a typical form-validation
   miss, and the fix is a small, scoped `type="number"`/`min`/`max` change per field.
4. **Confirm-before-delete on Individual Access's per-row trash button**, addressing gap #3.
   Why it helps: this table already has real design investment (drag-reorder, per-row Active
   toggle) — adding the confirm step the rest of the row already implies ("this widget/time-
   window assignment is meaningful enough to drag-reorder") is a small, consistent finishing
   touch, not a new pattern (`ConfirmModal` already exists and is used elsewhere in the app).
5. **A visible "file missing/unreadable" state on TV CSS**, instead of a silent empty-textarea
   fallback (gap flagged in the user-stories doc §A.5.3). Why it helps: today an admin opening
   TV CSS when the underlying file is missing or unreadable sees the exact same blank textarea
   as a genuinely-empty-but-intentional stylesheet — a small banner ("Could not read
   `tv/css/style.css` — saving will create a new file") removes the risk of an admin
   accidentally overwriting/recreating a file they didn't realize had a read error.
6. **Race-guard or last-modified check on Slider Style's save**, addressing the concurrent-save
   issue in the user-stories doc (§A.5.4) — since `saveTvSliderConfig()` regenerates the *entire*
   `slider.css` from only the widgets in that save's payload, a second admin's stale page load
   can silently drop another admin's just-saved styling. Why it helps: even a lightweight
   `updatedAt` timestamp check ("This data changed since you loaded it — reload before saving?")
   would prevent one admin's work from silently vanishing without either admin being told.

## A.5 Quick wins vs. bigger investments (Part A)

**Quick wins:**
- Numeric input types on Slider Style's Time/Size fields (#3) — small, scoped, high-value given
  the filesystem side effect.
- Confirm-before-delete on Individual Access (#4) — reuse the existing `ConfirmModal`.
- "File missing/unreadable" banner on TV CSS (#5) — a few lines around the existing
  `fs.readFile` error handler.
- Bring Dashboard Access's "Check all"/"Fill default" pattern (or a subset) to Individual Access,
  or vice versa, so the two screens' bulk-action vocabulary matches (#2).

**Bigger investments:**
- A real slider preview panel (#1) — needs design input on fidelity (exact CSS reproduction vs.
  a simplified mock) and is the highest-value single addition to this module.
- Drag-reorder on Dashboard Access (#2, full version) — technically small (the hook exists) but
  changes that screen's saved data shape (`widget_order` semantics) and should be checked against
  how the legacy TV renderer consumes it.
- Concurrent-save protection on Slider Style (#6) — needs a product decision on whether to hard-
  block, warn-and-allow, or auto-merge.
- Thumbnail previews on image-upload fields module-wide (gap #5) — a shared component investment,
  likely worth building once and reusing across TV, Kiosk, and Web CMS's near-identical gaps.

---

# Part B — Kiosk

## B.1 Module recap

See [user-stories/22-tv-kiosk.md](../user-stories/22-tv-kiosk.md) §Part B for the full
pixel-level flow. Kiosk configures physical touchscreen attendance machines: which staff
category can access a machine on which days/times, room/machine/IP registry, student/staff
machine PIN management (both a per-row inline editor and a bulk regenerate flow), the kiosk's
own slider content, its on-screen attendance menu (per category, drag-reorderable) and access
list, instructional text, printed attendance-statement column selection, announcements (which
can cross-post to the TV slider), and material-request receipt layout. All sixteen screens live
in one file, `client/src/pages/kiosk/setup/KioskScreens.jsx` (33 KB — the largest single setup
file across either module), built on `createSetupApi('/api/kiosk')`
(`client/src/pages/kiosk/KioskModule.jsx`), the same generic factory TV uses.

## B.2 Frontend control inventory

| Screen | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Machine Access | Native `<input list="...">` (HTML `<datalist>` autocomplete) for Staff category + a "Load groups" button + a read-only table + a new-group form row | Yes — native `<datalist>` browser autocomplete (not `SearchableSelect`) | Single (category) | No | Editing an existing access group is delete-then-recreate server-side, not an in-place update (no transaction wrapping the two statements) |
| Machine Room Add/Edit | Add: single form. Edit: `list-group` w/ search `<input>` + "Search" button, native `<select>` (Block) with a synthetic "Add new block" option that relabels the next field inline | Edit only — plain text search | Single (room) | No | Delete (edit mode only) goes through the shared `ConfirmModal` — the only confirm-gated delete in the whole Kiosk module besides Events cross-references in Web CMS |
| Student/Staff Machine PIN | Search `<input>` + Search button (auto-loads on mount with empty search) + a table with an **uncontrolled** per-row PIN input (`defaultValue`, read via `document.getElementById` at click time, not React state) | Yes — server-side search | — (per-row action, not a picker) | No | Per-row "Update" button only — no bulk save; the uncontrolled-DOM-read pattern is a real correctness risk if the table re-renders between typing and clicking (flagged in user-stories §B.5.6) |
| Machine Slider | Repeatable slide cards — plain text/number inputs, raw filename text (no file picker despite an "Image" label), 3 checkboxes | No | — (fixed set from load) | No | **No add/remove-row UI at all** — the only Kiosk list screen without one; slides come entirely from what was already loaded |
| Slider Widget Style | Three raw-code `<textarea>`s labeled by their literal camelCase field names (`contentScript`, `contentJs`, `contentStyle`) | — | — | — | Least-polished screen in the module — labels are field names, not friendly text (explicitly called out in the user-stories doc as comparable to Library's Supplier Edit) |
| Attendance Menu | Native `<select>` (Category, a `CategoryPicker`) + **drag-reorderable table** (`useDragReorder`) with checkbox (On), read-only Order, text (Title/URL/Icon), trash delete | No | Single (category) | No | "Add row" appends a blank enabled row; a blank new row with no Title is **silently dropped** on save with a success message anyway (flagged §B.5.3) |
| Attendance Menu Access | Native `<select>` (Category) + one `<textarea rows={4}>` for a raw comma-separated Staff IDs string | No | — (free text, not a picker) | No | No validation of ID format/existence anywhere client-side — a raw string round-trips as-is |
| Attendance Instruction | Singleton form (text + textarea) | — | — | — | No list, no picker — one fixed `pages_tb id=2` row |
| Staff/Student PIN Reset | Native `<select>` ("Search by": Category/IDs) + conditionally a `CategoryPicker` (staff only) or a plain text `IDs` input | No | Single (category) or free-text ID list | Yes — this **is** the bulk action (regenerates many PINs in one submit) | For `type==='student'` + category mode, **no scoping field renders at all** — the only interpretation is "reset every active student," a large blast-radius action with no extra confirmation beyond the Regenerate button itself (§B.5.4) |
| Attendance Statement | `CategoryPicker` (Staff category) + a `list-group`-style checkbox list of fixed report-column labels | No | Multi (checkboxes) | No explicit select-all/clear (unlike SMS's analogous checkbox screens) | Configures printed statement columns, not a report itself |
| Announcement Add/Edit | Plain text/date/textarea fields + native `<select>` (Audience) + 2 checkboxes (TV widget/flash — cross-module); Edit adds a `list-group` (click-to-load, no search) | No | Single | No | Edit's Delete has a disabled-guard (`disabled={busy || !announcementId}`) but **no confirm dialog** |
| Receipt Setup | Two `CategoryPicker`s (Job category, Receipt type — form only renders once both chosen) + numeric fields + a signature sub-table with an "Add signature" button | No | — | No | Signature rows have no delete button visible in the inventory beyond what "Add signature" implies — row removal is not called out as present |

Like TV, no screen in Part B uses `SearchableSelect` or `CheckListSelect`. Kiosk does introduce
one control neither TV nor SMS/Web CMS use: a native `<input list>` `<datalist>` autocomplete
on Machine Access — a genuinely different (and lighter-weight) search affordance than either
shared component, worth noting since it's technically "has search" but via a third, unrelated
mechanism.

## B.3 Advanced feature gaps

1. **`MachinePasswordScreen`'s PIN field reads the DOM directly (`document.getElementById`)
   instead of using React state** — the single most concrete correctness gap in either module
   (flagged in the user-stories doc §B.5.6: a concurrent `onLoad` re-render between typing and
   clicking "Update" can silently lose the typed value). This isn't a missing-component gap so
   much as a latent bug that predates any control-upgrade question, but it's directly relevant
   here because converting the field to a normal controlled `<input>` (trivial React pattern,
   already used everywhere else in this module) removes the risk entirely.
2. **`PinResetScreen` has zero extra confirmation for its largest-blast-radius state**
   ("Category/all" + `type==='student'`, which resets *every active student's* PIN with a single
   click) — while structurally smaller actions elsewhere in the same module (Machine Room
   delete) already go through `ConfirmModal`. The size mismatch between action consequence and
   confirmation friction is inverted here, same pattern flagged in the SMS/Web CMS audits for
   their own delete flows, but with materially higher stakes (every student's kiosk PIN vs. one
   template row).
3. **Attendance Menu's blank-row-silently-dropped issue (§B.5.3) has no UI signal at all** — a
   staff member who adds a row, forgets to type a Title, and saves gets the same "Menu saved."
   success message as a fully-successful save. This is a validation-feedback gap, not a missing-
   component gap, but the fix (disable Save or flag the row red if any row has an empty required
   field) is a small, well-understood pattern already used elsewhere (e.g. SMS/Web CMS's various
   `required`-marked fields with disabled submit buttons).
4. **Machine Access's `<datalist>` autocomplete is weaker than `SearchableSelect` in one
   concrete way**: it offers no visual "here are your current matches" panel — the browser's own
   native datalist UI varies by browser/OS and doesn't support the rich label formatting
   `SearchableSelect`'s portal dropdown does. Given `SearchableSelect` already exists and is
   built for exactly "type to filter, then pick one value," swapping this one field over would
   both look consistent with the rest of the modernized app and behave predictably cross-browser.
5. **Machine Slider has no add/remove-row control**, the only Kiosk list screen missing one —
   inconsistent with Machine Access, Attendance Menu, Announcement, and Receipt Setup's signature
   table, all of which support adding rows. An admin who needs an 8th slide (Machine Slider's
   TV-module sibling, TV's own Slider Style screen, has the exact same "fixed set, no add" gap —
   see Part A gap analysis) has no path to do so from this screen at all.
6. **Attendance Statement's checkbox list has no "select all"/"clear" bulk toggle**, unlike the
   structurally identical checkbox-list screens in SMS (`staff-sms`/`group-sms`'s "Select all
   shown"). A staff category that wants every available statement column enabled must click each
   of the twelve fixed `ATT_STATEMENT_OPTIONS` individually.

## B.4 User-experience suggestions

1. **Simplified, touch-friendly control preview for kiosk-facing screens.** Why it helps: per
   the user-stories doc's own framing, everything configured here (Machine Slider, Attendance
   Menu, Attendance Instruction) ends up rendered on a physical touchscreen with presumably large
   touch targets and a simplified visual language very different from this admin app's dense
   desktop forms — none of these screens show *any* approximation of what the resulting kiosk
   screen will look like. Even a simple mocked-up "menu preview" strip (rendering Attendance
   Menu's Title/Icon rows as touch-sized buttons in the order they're currently set) would let
   an attendance-desk admin sanity-check the touch layout without walking to a physical kiosk —
   directly analogous to the TV slider-preview suggestion in Part A, and arguably higher-value
   here since kiosk UI misconfiguration affects a live attendance-punching workflow, not just a
   passive display.
2. **PIN-entry UX review, specifically around `MachinePasswordScreen`'s uncontrolled input and
   `PinResetScreen`'s missing confirmation.** Why it helps: PIN management is the single most
   security/operations-sensitive workflow in this module (it directly gates who can punch
   attendance) — fixing the uncontrolled-DOM-read bug (gap #1) and adding a typed-confirmation
   step before a category-wide "reset every student's PIN" action (gap #2, e.g. requiring the
   admin to type "RESET" or the count of affected records before the button un-disables) both
   reduce real operational risk, not just polish.
3. **Convert Machine Access's Staff category `<datalist>` to `SearchableSelect`**, addressing
   gap #4. Why it helps: consistent, predictable cross-browser search behavior, and visually
   matches the rest of the modernized app's already-established search pattern rather than
   relying on inconsistent native browser datalist rendering.
4. **Row-level validation styling on Attendance Menu**, addressing gap #3. Why it helps: prevents
   the confusing "success message but the row didn't actually save" experience — a red-bordered
   input or an inline "Title required" hint on any row with a blank Title before Save is enabled
   removes the silent-drop surprise entirely.
5. **Add-row support on Machine Slider**, addressing gap #5. Why it helps: brings this screen to
   parity with every other list-style Kiosk screen (Machine Access, Attendance Menu, Announcement,
   Receipt Setup) — today it's the sole exception, for no apparent functional reason distinguishing
   it from its siblings.
6. **"Select all"/"Clear" on Attendance Statement's checkbox list**, addressing gap #6. Why it
   helps: mirrors the exact pattern already built twice in SMS (`staff-sms`/`group-sms`) for a
   structurally identical "toggle many checkboxes" interaction — low effort given the precedent
   already exists in the same codebase.
7. **A kiosk-health indicator on Machine Room's list**, extending the existing IP-address field
   that today is pure unchecked metadata (flagged in user-stories §B.5.1: "no health-check,
   heartbeat, or 'last seen' field anywhere"). Why it helps: even a basic "last configuration
   change applied" timestamp (not a full ping/heartbeat, which needs new backend infrastructure
   per the user-stories doc's own Future section) would give an admin some signal beyond blind
   faith that a saved change actually reached the physical device — a small, UI-only improvement
   short of the bigger "live kiosk-health dashboard" investment already flagged as future work.

## B.5 Quick wins vs. bigger investments (Part B)

**Quick wins:**
- Convert `MachinePasswordScreen`'s PIN input from uncontrolled DOM-read to controlled React
  state (#2, first half) — a correctness fix, not a feature, and should arguably be prioritized
  above the other UX suggestions in this file given it's a latent data-loss bug.
- Row-level validation styling on Attendance Menu (#4) — small, scoped, prevents a confusing
  silent-drop UX.
- "Select all"/"Clear" on Attendance Statement (#6) — the pattern already exists twice in SMS to
  copy from.
- Add-row support on Machine Slider (#5) — brings one screen in line with its siblings' existing
  pattern.
- Swap Machine Access's `<datalist>` for `SearchableSelect` (#3) — drop-in, single field.

**Bigger investments:**
- Typed-confirmation step before a category-wide PIN Reset (#2, second half) — needs a product
  decision on exact confirmation UX (typed phrase vs. a simple "N records will be affected"
  modal) given the blast radius involved.
- Touch-friendly kiosk/menu preview panel (#1) — the highest-value single addition to this
  module, but a real design investment; likely worth building alongside (or reusing components
  from) the equivalent TV slider-preview suggestion in Part A, since both are "preview what a
  physical, non-desktop display will show" problems.
- Kiosk-health/last-applied indicator on Machine Room (#7) — the lightweight version proposed
  here (a timestamp) is a quick win, but the fuller "online/offline heartbeat" version explicitly
  flagged as future work in the user-stories doc needs new backend polling infrastructure and is
  a genuinely bigger investment.

---

## Cross-module note (TV + Kiosk)

Both modules share the exact same structural gap: **no in-app preview of what the physical
device will actually display**, and both already have a `useDragReorder`-based screen proving
drag-reorder works well in this codebase (TV's Individual Access, Kiosk's Attendance Menu) sitting
right next to sibling screens that still use plain number inputs for the same kind of ordering
problem (TV's Dashboard Access/Slider Style; Kiosk's Machine Slider has no ordering UI at all).
Any future investment in a "device preview" component or a "standardize on drag-reorder for order
fields" pass would most efficiently be scoped across both modules together rather than twice,
since the underlying data shapes (ordered widget/menu-item lists with enable flags) are nearly
identical between TV and Kiosk.

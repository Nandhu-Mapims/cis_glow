# 21 — Web CMS — Frontend Control & UX Audit

## 1. Module recap

See [user-stories/21-web-cms.md](../user-stories/21-web-cms.md) for the full pixel-level flow.
In short: Web CMS manages the public website's static content pages (10 legacy `web_*_v1.php`
sections sharing one `WebPageScreen` component), the homepage hero slider, photo galleries,
staff web-display order, PDF document uploads, research-program announcements, and
festival/campus events with their own category master. Every screen runs through
`createSetupApi('/api/web')` (`client/src/pages/web/WebModule.jsx`). There is **no live
preview or publish pipeline anywhere** — Enable/Draft, `web_view`/`webView` toggles are the
only publish-state controls, and content is authored as raw HTML in a plain `<textarea>` with
no WYSIWYG editor anywhere in the module.

## 2. Frontend control inventory

| Screen | Control type(s) | Search? | Single/multi | Bulk actions? | Other interaction notes |
|---|---|---|---|---|---|
| Static pages ×10 (`WebPageScreen`, shared) | `list-group` of existing pages (click-to-load, not a `<select>`) + plain text/number/date inputs + raw HTML `<textarea rows={12}>` + Enable/Draft radio pair | No | Single (one page edited at a time) | No | "+ Add New Page" only resets local state, never round-trips to server; no WYSIWYG, no HTML preview |
| `slider-animation` | Fixed set of ≤7 cards, each with plain text/number inputs, a raw filename text input (no file picker), two raw hex-string color inputs (no color-picker widget), and 3 checkboxes | No | — (fixed set, no picker) | No | No add/remove slide UI at all — server silently skips id-less rows |
| `photos-add` | Native `<input type="file" accept="image/*">` (single, cover) + `<input type="file" accept="image/*" multiple>` (gallery) + 1 checkbox | — | — | — | Form resets to blank after every save attempt regardless of success/failure |
| `photos-edit` | `list-group` of galleries (click-to-load) + optional single-file cover replace + read-only photo list with "View" links only | No | Single (one gallery) | No | **No add/remove/reorder controls for individual photos** — the only editable fields are gallery-level metadata; service supports per-photo edits the UI never exposes |
| `staff-display-order` | Native `<select>` (Department) + per-row `<input type="number">` (Order) in a plain table | No | Single (department) | No | Upsert-per-row save pattern; no drag-reorder despite "Order" being the entire purpose of the screen |
| `doc-upload` | Native `<input type="file" accept=".pdf" multiple>` + 1 checkbox (Overwrite) | — | — | — | Filesystem-backed, not DB-backed; folder listing table below the form, no search/filter/sort on it |
| `research-program-add`/`-edit` | Plain text/date/textarea fields + single-file `<input type="file">`; Edit adds a `list-group` of programs (click-to-load) | No (list-group, no search) | Single | No | Five free-text presenter fields with no lookup against `staff_profile_tb` |
| `event-add`/`-edit` | Native **`<select multiple>`** for event Type (sized `min(6,max(3,n))`) + date/time inputs + single-file attachment + multi-file gallery input; Edit adds a search `<input>` + `list-group` | Edit only — plain `<input>` + "Search" button, filters left list | Multi (Type field) | No | Edit's Delete uses `ConfirmModal` (the only confirm-before-delete anywhere in this module); event Type stored as comma-joined string, not a join table |
| `event-type` | Editable-in-place table (`<input>` per row, Category cell) | No | — (flat list) | No | "Add row"/"Save" bulk-submits the whole grid at once; per-row Delete is immediate, no confirm — inconsistent with Events' own confirm-modal delete |

No screen in this module uses `SearchableSelect` or `CheckListSelect`. The module's list-picker
vocabulary is limited to: `list-group` click-to-load lists (pages, galleries, research
programs, events), one native `<select multiple>` (Events' Type field), and one native
`<select>` (Staff Display Order's Department). None of the `list-group` lists have any search
box except Events' Edit screen, and none of the file-upload fields show an image thumbnail
preview anywhere — every upload control renders as a bare filename/link once saved, including
`photos-edit`'s own photo list (`"View"` link only, no `<img>` thumbnail).

## 3. Advanced feature gaps

1. **Events' Type field is a native `<select multiple>` with no search**, the same pattern
   flagged as the worst offender in the SMS audit (`parent-meeting-sms`'s Class field). As the
   event-category master (`event-type`) grows, this becomes an unsearchable OS listbox for a
   field that's core to how events get filtered/organized on the public site. `CheckListSelect`
   is a direct drop-in (checkbox rows, auto-search past 8 options, "Select all"/"Clear" already
   built) for a field that today reimplements none of that.
2. **None of the four `list-group` click-to-load lists (Static Pages, Photos Edit, Research
   Edit) have a search box**, while Events' Edit screen — built later, per the file's Aug 3 2026
   modification date vs. the other screens' June/July dates — *does* have one. This is a clear
   case where a UX improvement already proven in one screen of the same module (Events) hasn't
   been back-ported to its three older siblings. A college with many static pages per type, many
   photo galleries, or many research programs has no way to jump to a specific item without
   scrolling a plain list.
3. **No image thumbnail preview anywhere in a module whose entire purpose is visual content.**
   `photos-add`, `photos-edit`, `slider-animation`, and Events' gallery upload all accept image
   files but render only filenames/links post-save, never an `<img>` preview — not even a
   client-side `URL.createObjectURL` preview of the *just-selected* file before upload. Given
   `SearchableSelect`/`CheckListSelect` don't cover this gap (it's not a list-picker problem),
   this is really an "add a thumbnail" gap, but it's the single most consequential missing
   control in the whole module given how visual the content is.
4. **`staff-display-order`'s reorder control is a raw number input per row**, not a
   drag-reorder list — while TV and Kiosk (see `22-tv-kiosk.md`) already have a working
   `useDragReorder` hook in active use elsewhere in the same codebase for structurally identical
   "reorder a list of rows" screens (TV's Individual Access, Kiosk's Attendance Menu). Reusing
   that hook here would remove the risk of duplicate/gapped order values a numeric input allows
   (flagged directly in the user-stories doc's Future section).
5. **`photos-edit` has no per-photo add/remove/reorder UI at all**, even though the underlying
   service (`saveWebPhotosEdit`) already supports it — a "service supports more than the
   wired-up form" gap. The fastest path to close it isn't a new component, just wiring the
   existing service capability into the screen (add file inputs + a delete-per-row control +
   `useDragReorder` for photo order, mirroring what `photos-add`'s multi-file input already
   does).

## 4. User-experience suggestions

1. **Add a live HTML preview pane next to the raw `<textarea>` on `WebPageScreen`** (all 10
   static-page slugs). Why it helps: content editors currently type raw HTML blind — the first
   time they see how a page actually renders is on the live public site, since this module has
   no preview pipeline at all (per US-21.11). Even a simple same-page `<iframe srcDoc={content}>`
   or a sanitized inline render, updated on blur/debounce, closes the single biggest confidence
   gap in the module without needing a full WYSIWYG editor.
2. **Drag-and-drop image upload with inline preview thumbnails**, replacing the bare
   `<input type="file">` across `photos-add`, `photos-edit`'s cover replace, and Events'
   gallery/attachment fields. Why it helps: today a selected file shows only its raw filename
   until save — a drag-and-drop zone with an immediate thumbnail (client-side, before upload)
   lets an editor catch "wrong photo selected" before submitting, and is a familiar pattern for
   non-technical marketing staff who are this module's primary users.
3. **A clearer, single "Publish state" control replacing the scattered Enable/Draft radio /
   `webView` checkbox / event-status select**, each phrased and styled differently per screen
   today (`WebPageScreen`'s Enable/Draft radio pair, Photos' "Show on website" checkbox,
   Research's "Web view"/"Member view" checkboxes, Events' "Web view" Yes/No radio plus a
   separate Confirm/Not-Yet/Postpone/Cancel status select). Why it helps: per US-21.11, none of
   these currently warn "this content is likely live right now" before an editor flips it off —
   standardizing on one visual "Draft / Published" toggle component (badge + switch) across all
   content types would both look consistent and be the natural place to eventually add a "this
   is currently visible on the public site" indicator.
4. **Search boxes on the Static Pages, Photos Edit, and Research Edit `list-group`s**, matching
   the pattern Events' Edit screen already has. Why it helps: closes gap #2 directly — these are
   the exact same "pick an existing record from a list" interaction Events already solved with a
   plain `<input>` + Search button; porting that forward is a small, low-risk, screen-scoped
   change.
5. **Drag-reorder for Staff Web Display Order and Slider Animation's `order_no` fields**, reusing
   `client/src/hooks/useDragReorder.js` (already proven on TV's Individual Access and Kiosk's
   Attendance Menu). Why it helps: both screens exist specifically to control display order —
   forcing the editor to manually renumber overlapping/gapped integers by hand is exactly the
   failure mode drag-reorder was built to remove elsewhere in this same codebase.
6. **Confirm-before-delete on `event-type`'s per-row Delete**, matching the `ConfirmModal`
   already used one screen over on Events itself. Why it helps: per US-21.9, deleting an event
   category has zero confirmation while deleting the *event* that references it does — the
   category delete is arguably lower-stakes but the inconsistency (two screens in the same
   module handling "delete" completely differently) is confusing on its own, independent of risk.
7. **Autosave or an "unsaved changes" warning on `WebPageScreen`'s content textarea.** Why it
   helps: editors composing long raw-HTML page bodies in a plain `<textarea rows={12}>` risk
   losing work to an accidental navigation or session timeout — there's no `beforeunload` guard
   or draft-autosave anywhere in this module today, unlike form-heavy modules elsewhere in the
   app that at least warn before a destructive navigation.
8. **File-type/size feedback before submit, not just server-side rejection after.** Why it helps:
   `doc-upload` (PDF-only, 20 MB), Photos (image types, 5 MB), Research/Events (doc types, 10 MB)
   all validate purely server-side today — an editor who picks an oversized or wrong-type file
   only finds out after a full round-trip and a generic error string; a client-side pre-check
   using the already-known extension/size limits (shared constants already exist server-side —
   `IMG_EXT`, `DOC_EXT`, `PDF_EXT`) would give instant feedback instead.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Search box on Static Pages / Photos Edit / Research Edit `list-group`s (#4) — copy the exact
  pattern already implemented on Events' Edit screen.
- Confirm-before-delete on `event-type` (#6) — reuse the `ConfirmModal` already imported one
  screen over in `WebEventsScreen.jsx`.
- Client-side file-type/size pre-check with an inline message before submit (#8) — the
  extension/size constants already exist server-side; just mirror them client-side.
- Basic "unsaved changes" `beforeunload` guard on `WebPageScreen`'s form (#7, first half) — a
  small, self-contained addition.

**Bigger investments (needs design/product buy-in first):**
- Live HTML preview pane on the 10 static-page screens (#1) — needs a decision on sandboxing
  (iframe vs. sanitized inline render) and how closely it should mirror actual site CSS/layout.
- Drag-and-drop image upload with thumbnails across Photos/Events/Research (#2) — a genuine new
  shared component, not a copy-paste; should probably become a reusable `ImageUploadField`
  used by all three screens plus Slider Animation.
- Swapping Events' Type `<select multiple>` for `CheckListSelect` (gap #1) — technically simple
  but should be checked against the legacy `festival_event_add.php`/`_edit.php` layout for parity
  first, per the repo's migration philosophy.
- Drag-reorder for Staff Web Display Order and Slider Animation (#5) — straightforward technically
  (the hook already exists) but touches two screens' save contracts (order values sent to the
  server) and should be verified against how the legacy renderer consumes `order_no`/`d_order`.
- Unified "Publish state" component (#3) — a real design exercise spanning 4+ screens with
  different underlying fields (`page_enable`, `webView`, `memberView`, event status enum);
  needs product sign-off on what the shared visual language should be before implementation.
- WYSIWYG editor for page content — explicitly called out as future/not-implemented in the
  user-stories doc; a bigger lift than the live-preview pane above and should probably follow it,
  not precede it.

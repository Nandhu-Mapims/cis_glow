# 25 — Files (upload/download, cross-cutting)

## 1. Module recap

There is no dedicated Files screen or hub — this is the shared upload/download **pattern**
every module reuses: a base64-JSON upload convention on the client, a per-module
`save<Module>Attachment(file)` validator/writer on the server, and two symmetric download paths
(`/legacy/files/*` public-static, `/api/files/*` JWT-gated). Server internals (`fileStorageMap.js`,
`legacyStaticGuard.js`, the two URL builders in `legacyFileUrls.js`), the security layering, and
all twelve user stories already live in
[user-stories/25-files.md](../user-stories/25-files.md) — this file audits the **input controls**
(`<input type="file">` instances and their surrounding UX) as they actually appear across the
consuming modules' forms, per the README's cross-cutting guidance for this file.

There is no `server/src/routes/files.js`-adjacent client page to inventory — the relevant
controls live embedded inside other modules' Add/Edit forms. `grep -l 'type="file"'
client/src/pages -r` finds file inputs in 29 component files across Admin, Certificates,
Circular, Committee, Exam, Hostel, Library, Payroll, Settings, Staff, Students, TV, and Web —
below is a representative cross-section, not an exhaustive list.

## 2. Frontend control inventory (representative file-input consumers)

| Screen | File | Control | Validation shown before submit? | Multiple files? | Preview? | Progress indicator? |
|---|---|---|---|---|---|---|
| Add Circular | `client/src/pages/circular/setup/AddSetup.jsx` | `<input type="file">`, no `accept` attribute, single file into local state | No — server rejects non-PDF/image or >2 MB only after Submit | No | No | No — button just shows `disabled={busy}` |
| Student Photo/Attachments | `client/src/pages/students/CollageImagePanel.jsx` | `<input type="file" accept=".png,.jpg,.jpeg,.gif" multiple>` | Partial — `accept` narrows the OS file picker, but no size/count check before submit | Yes | Not confirmed here (album-style upload) | Not in this component |
| Admin Account Edit — Photo | `client/src/pages/admin/setup/AccountEditSetup.jsx` | `<input id="edit_photo" type="file" accept="image/jpeg,image/png,image/gif">`, single file into `photoFile` state | Partial — `accept` narrows picker only | No | Not confirmed | No |
| Library Book Add/Edit — ebook file | `client/src/pages/library/setup/BookAddSetup.jsx`, `BookEditSetup.jsx` | `<input type="file">` for the e-book PDF | No inline check | No | No | No |
| Staff Profile / setup attachments | `client/src/pages/staff/StaffProfile.jsx`, `StaffScreenPage.jsx`, `StaffSetupPage.jsx` | `<input type="file">` in multiple attachment/experience-document contexts | Varies per screen; none surfaced a pre-submit size/type check during this audit | Varies | No | No |
| Payroll (salary advance/arrear/security deposit) supporting documents | `client/src/pages/payroll/setup/SalaryAdvanceAddSetup.jsx` and siblings | `<input type="file">` per document slot | No | No | No | No |
| Web CMS (docs/photos/events/research) | `client/src/pages/web/setup/WebDocUploadScreen.jsx`, `WebPhotosAddScreen.jsx`, `WebPhotosEditScreen.jsx`, `WebEventsScreen.jsx`, `WebResearchScreen.jsx` | `<input type="file">`, some with `multiple` | No | Some | No | No |
| Exam sheets/marks upload | `client/src/pages/exam/setup/SheetsUploadSetup.jsx`, `MarksUploadSetup.jsx` | `<input type="file">` for bulk sheet/marks files | No | Varies | No | No |
| Settings — Signature image | `client/src/pages/settings/setup/SignatureSetup.jsx` | `<input type="file">` for the print-signature image | No | No | No | No |

**Pattern-wide finding: every audited file input across every module follows the identical
minimal shape** — a bare (or `accept`-narrowed) `<input type="file">`, local `useState` holding
the raw `File` object, no drag-and-drop zone, no client-side size/type pre-check, no upload
progress bar, and no image preview thumbnail before submit. Validation (extension allow-list,
byte-size cap — e.g. Circular's `.pdf/.jpeg/.jpg/.gif/.png` under 2 MB, per
[23-circular.md §3.3](23-circular.md)) exists but runs **entirely server-side, after the base64
payload has already been built and posted** — a rejected upload is discovered only after a full
round trip, never before.

Because uploads go through `fileToPayload()`'s in-browser base64 encoding (client-side
`arrayBuffer()` → `Uint8Array` → `btoa()` loop, per
[user-stories/25-files.md §3.1](../user-stories/25-files.md)) rather than
`multipart/form-data`, there is also **no native `XMLHttpRequest`/`fetch` upload-progress event**
available to any of these screens even if one wanted to add a progress bar — base64-encoding a
multi-MB file synchronously on the main thread, then sending it as one JSON body via Axios, gives
no natural place to hook incremental progress without restructuring the upload mechanism itself.

## 3. Advanced feature gaps

1. **No client-side pre-submit validation anywhere**, even though every consuming module's
   server-side helper already encodes the exact rule that could run client-side first (extension
   allow-list + byte cap — see `fileStorageMap.js` / each module's `save*Attachment`). A user
   picking a 5 MB PDF or a `.docx` on Add Circular currently: fills the whole form, clicks
   Submit, waits for the full base64-encode-and-upload round trip, and only then sees
   `'Image size must be less than 2 MB.'` or `'Please upload PNG, JPEG, GIF, or PDF formats.'`
   (per user-stories US-11). The same allow-list/cap values already exist server-side and could
   trivially run against `file.size`/`file.name` the moment the `<input>` fires `onChange`.
2. **No drag-and-drop zone on any audited screen** — every upload requires the OS file-picker
   dialog via a click on the bare `<input>`. This is consistent across all 29 files found, so it
   is a module-wide gap, not a one-off oversight in a single screen.
3. **No upload-progress feedback anywhere**, and the base64-JSON convention itself is the
   structural reason why — see the pattern-wide finding above. A user attaching a several-MB
   file (Library e-book PDFs are the largest realistic case in this app) sees the Submit button
   go `disabled={busy}` with no percentage, spinner detail, or estimated time, for however long
   the encode-and-post takes.
4. **No image/file preview before or after selecting a file** on any screen except the
   album-style `CollageImagePanel.jsx` (and even there, preview behavior wasn't confirmed to
   show before submit in this audit). A user attaching the wrong photo/PDF has no visual
   confirmation of what they picked until after Submit succeeds and they navigate to a view
   screen — increasing the odds of a silently-wrong attachment going out (relevant for Circular
   attachments specifically, which get publicly linked once approved).
5. **`accept` attribute is inconsistently applied.** `CollageImagePanel.jsx` and
   `AccountEditSetup.jsx` narrow the OS picker with `accept=".png,.jpg,.jpeg,.gif"` /
   `accept="image/jpeg,image/png,image/gif"`; Circular's `AddSetup.jsx` (which accepts PDF in
   addition to images) has **no `accept` attribute at all**, so the OS file picker shows every
   file type even though only five extensions will actually be accepted server-side. This is a
   quick, screen-by-screen inconsistency worth normalizing.

## 4. User-experience suggestions

1. **Drag-and-drop upload zones on the highest-traffic attachment screens** (Add/Edit Circular,
   Library Book Add/Edit's e-book upload, Student attachment panels). *Why it helps:* these are
   exactly the screens where a user is likely to already have the file open/visible (email
   attachment, downloads folder, scanned-doc app) — drag-and-drop removes the extra
   click-through-folders step the current bare `<input>` requires, and is a well-understood
   affordance users already expect from any modern upload form.
2. **Upload progress bars, scoped realistically to what the base64-JSON convention allows.**
   Since there's no native progress event available without restructuring to multipart (see §2),
   the practical near-term win is a **determinate encode-phase indicator** (e.g. "Encoding
   file… / Uploading…" with a spinner, or a coarse progress estimate based on `file.size`) rather
   than a byte-accurate bar — still a meaningful improvement over the current silent
   `disabled={busy}` state for anything above a second or two of round-trip time. *Why it helps:*
   without it, a user on a slow connection attaching a 1.9 MB file (just under Circular's 2 MB
   cap) has no way to distinguish "still working" from "frozen," and may click Submit again,
   risking the double-submit issue already documented for other module forms
   ([24-admin-office.md §4](24-admin-office.md) item 2).
3. **File-type/size validation feedback before submit, not just after.** *Why it helps:* every
   module's server-side allow-list and byte cap already exist and are trivially mirrorable
   client-side (`file.size > CAP_BYTES`, `!ALLOWED_EXTENSIONS.includes(ext)`) — running the same
   check the instant the `<input>` fires `onChange` turns a "fill the whole form, submit, get
   rejected" round trip into an immediate inline message ("This file is 4.8 MB — the limit is
   2 MB" / "Only PDF, JPEG, GIF, or PNG files are accepted"), saving the user from re-doing the
   rest of the form. This is the single highest-leverage fix in this file because the validation
   logic to reuse already exists server-side for every module.
4. **A small thumbnail/filename+size preview chip after a file is selected**, on every
   `<input type="file">` audited. *Why it helps:* today the only feedback that a file was picked
   is the browser's own native "chosen file" text inside the input control (styling and wording
   vary by browser) — an explicit "selected: circular_notice.pdf (1.4 MB) [x remove]" chip
   removes ambiguity about what will actually be submitted, and gives a one-click way to clear
   a wrong selection without re-opening the OS picker.
5. **Normalize the `accept` attribute across all file inputs to match each screen's actual
   server-side allow-list.** *Why it helps:* a five-minute, screen-by-screen fix
   (`accept=".pdf,.jpeg,.jpg,.gif,.png"` on Circular's Add/Edit, matching each other module's
   allow-list) that immediately narrows the OS picker to valid choices — cheap, no server change,
   directly reduces the number of submissions that fail server-side validation in the first
   place.
6. **A shared `FileUploadField` component** wrapping the `<input type="file">` +
   validation-before-submit + preview chip + (eventually) drag-and-drop, reused across the 29
   files currently hand-rolling this independently. *Why it helps:* every fix above (accept
   normalization, pre-submit validation, preview) currently has to be applied to each of 29
   files individually if done ad hoc; a shared component means building it once and getting
   consistent behavior everywhere, the same argument already made for a shared date-range picker
   in [23-circular.md](23-circular.md) and a shared record-search-list in
   [24-admin-office.md](24-admin-office.md) — this module has the same "same pattern, N
   independent copies" shape.
7. **Clearer 413 messaging scoped to uploads.** Per user-stories US-7, the global body-size-limit
   error (`'Request too large. Try a shorter date range or fewer subjects.'`) is written for
   report-generation payloads and is misleading when a user hits it while uploading a file.
   *Why it helps:* since this error is thrown by Express's `json()` middleware before any route
   handler runs, the fix has to happen client-side — catching a 413 specifically from an
   upload-carrying request (the client already knows it sent a `files` array) and substituting a
   file-specific message ("This file is too large to upload — please use a file under N MB")
   closes the mismatch without touching the shared server-side handler.
8. **Disable the Submit button (or show an explicit "Encoding…" state) while `fileToPayload()`
   is running**, not just while the network request itself is in flight. *Why it helps:*
   base64-encoding a multi-MB file synchronously in the browser (the `bytes.forEach` loop
   building a binary string character-by-character, per
   [user-stories/25-files.md §3.1](../user-stories/25-files.md)) can itself take a perceptible
   moment on a large file before the network request even starts — if the `busy` flag a screen
   uses to disable Submit is only set once the Axios POST begins, there's a window where a user
   could double-click Submit during the encode phase, before any `disabled` state has engaged.
9. **A visible per-module "max file size / allowed types" hint text under every file input.**
   *Why it helps:* right now the only place these limits are documented is server-side code and
   the [user-stories/25-files.md](../user-stories/25-files.md) research doc — a user has no way
   to know Circular's cap is 2 MB (vs. whatever cap another module's upload uses) without trying
   and failing first. A one-line `<small className="text-muted">PDF, JPEG, GIF, or PNG — max
   2 MB</small>` under each `<input type="file">`, sourced from the same constants the
   client-side pre-check in suggestion 3 would use, costs nothing extra once that pre-check
   exists.
10. **Consistent "view/download" link styling and target-blank behavior across modules.** Today
    Circular's attachment link (`<a href={attachUrl} target="_blank" rel="noreferrer">View</a>`)
    is the only such link confirmed in this audit's grep of consuming screens; other modules'
    view-existing-attachment affordances weren't individually inventoried here since they're
    documented per-module in files 05–22 of this folder. *Why it helps flagging it here:* as more
    modules add "view the file I already uploaded" links, keeping them on the same
    `legacyPublicFileUrl()`/`legacySecureFileUrl()` helper pair (rather than hand-built URL
    strings) is what keeps the `legacyStaticGuard` security properties (§3 of the user-stories
    file) intact everywhere, not just in Circular.

## 5. Quick wins vs. bigger investments

**Quick wins (small diff, immediate win):**
- Add matching `accept` attributes to every `<input type="file">` that's missing one (Circular
  Add/Edit is the clearest gap found — `accept=".pdf,.jpeg,.jpg,.gif,.png"`).
- Add client-side size/extension pre-checks mirroring each module's existing server-side
  allow-list/cap, surfaced as an inline message on file selection (Circular, Library ebook,
  Student attachments — start with the screens that already have the clearest documented caps).
- Add a "selected file: name (size) [remove]" chip under each `<input type="file">` so the user
  gets confirmation of what was picked.
- Substitute a file-upload-specific message for the generic 413 "Request too large…" response
  when the failing request is known (client-side) to be carrying a `files` payload.
- Add a "PDF, JPEG, GIF, or PNG — max 2 MB" (or module-appropriate) hint line under each
  `<input type="file">`, sourced from the same allow-list/cap constants used for the pre-check.
- Ensure Submit is disabled from the moment `fileToPayload()` starts encoding, not only once the
  network request begins, closing the double-submit window during the encode phase.

**Bigger investments (needs design/product buy-in first):**
- A shared `FileUploadField` component (validation + preview + eventually drag-and-drop) rolled
  out across the 29 files currently hand-rolling `<input type="file">` independently — worth
  scoping as its own small project given the count of call sites.
- Drag-and-drop zones — a design decision on visual treatment (dropzone border, hover state)
  that should be made once and applied consistently, not per-screen.
- Real upload-progress bars — blocked on a decision about whether to move off the base64-JSON
  convention toward `multipart/form-data` (which would unlock native progress events) or accept
  a coarser encode-phase indicator as the practical ceiling while keeping the current convention;
  this decision also intersects the future mobile-multipart compatibility question already
  flagged as open in [user-stories/25-files.md §6](../user-stories/25-files.md) (US-10).

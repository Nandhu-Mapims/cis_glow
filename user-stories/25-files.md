# 25 — Files (upload/download, cross-cutting)

## 1. Module overview

This is not a single feature screen but the **shared file storage pattern** every module reuses
for attachments, generated documents (ID cards, certificates), and legacy static assets
(CSS/img/JS). It replaces dozens of legacy PHP upload/download endpoints (e.g.
`student_attachment_more.php`, `staff_profile_edit_more.php`, `task_document_more.php`,
`library_book_add.php`) with **one** generic secure download route plus a base64-JSON upload
convention reused across module save handlers (Circular, Admin Office, Library ebooks,
Students, Staff, etc.).

**Two distinct serving paths, by design:**

1. **`/legacy/*`** — a raw Express `static()` mount over the entire legacy PHP application root
   (`config.legacyImgPath/..`, i.e. the parent of `img/`), guarded by
   `server/src/middleware/legacyStaticGuard.js`. **No auth required** — this is what
   `<link rel="stylesheet">`/`<img src>` tags and plain `<a target="_blank">` links use, because
   browsers don't attach `Authorization` headers to those. Public-by-necessity, so the guard's
   entire job is directory/extension allow-listing, not authentication.
2. **`/api/files/*`** — `server/src/routes/files.js`, requires a valid JWT
   (`authMiddleware`). Used when a download must be gated by login (not currently linked from
   most module UIs, which prefer the simpler `/legacy/files/...` public path — see §5 for the
   mobile-auth implication).

**Primary actors**
- **Any authenticated user** viewing/downloading an attachment, generated ID card, certificate,
  or circular attachment via a `<a href="/legacy/files/...">` link.
- **Module save handlers** (server-side code, not a human actor) that accept a base64-encoded
  file in a JSON POST body and write it to disk under `LEGACY_FILES_PATH`.
- **Backend developers** adding a new upload/download surface, who consult
  `server/src/config/fileStorageMap.js` as the single source of truth for "which folder holds
  what, and which DB column stores the filename."

**Legacy PHP files replaced (representative, not exhaustive — see `FILE_STORAGE_MAP` for the
full folder list):** `student_attachment_more.php`, `staff_profile_edit_more.php`,
`task_document_more.php`, `library_book_add.php` / `library_book_edit.php`, plus every screen
that linked to `files/<folder>/<filename>` on disk (circular attachments, ID cards, certificate
assets, OMR sheets, Excel export caches, progress cards, publication docs, payroll report
exports).

## 2. Screen inventory (representative endpoints, not screens)

There is no dedicated "Files" screen in the client — this is infrastructure consumed by other
modules' screens. The inventory below is the representative set of endpoints/consumers:

| Endpoint / mount | File | Auth | Used by |
|---|---|---|---|
| `GET /legacy/*` (static) | `server/src/app.js` line 89 → `legacyStaticGuard` + `express.static(path.resolve(config.legacyImgPath, '..'))` | None (guard only) | `<link rel="stylesheet" href="/legacy/css/...">` in every `printReport.js` mode; `<img src="/legacy/img/...">`; `legacyPublicFileUrl()` links across Circular, Library, Students, Staff |
| `GET /api/files/map` | `server/src/routes/files.js` | JWT | Diagnostic/reference endpoint returning `FILE_STORAGE_MAP` + rules, not linked from any screen currently |
| `GET /api/files/*` | `server/src/routes/files.js` (catch-all `router.get(/.*/, ...)`) | JWT | `legacySecureFileUrl()` helper (defined in `client/src/utils/legacyFileUrls.js`) — available for any screen that wants gated downloads, though most screens use the public `/legacy/files/...` path instead |
| `POST /api/students/:id/attachments/upload` | `server/src/routes/students.js` line 211 | JWT + `menuAuthForModule` | Student profile attachment upload (base64 JSON body: `{ filename, dataBase64 }` → `uploadStudentAttachmentFile`) |
| `POST /api/circular/setup/add\|edit/save` (files param) | `server/src/routes/circular.js` | JWT + `menuAuthForModule('circular')` | Circular attachment upload — see [23-circular.md](23-circular.md) §3.3 |
| `POST /api/library/setup/book-add\|book-edit/save` (ebookFile base64) | per `FILE_STORAGE_MAP` `library_ebook` entry | JWT + `menuAuthForModule('library')` | Library e-book PDF upload |

## 3. Pixel-level flow: the shared pattern

### 3.1 Upload convention (client → server)

There is no `<form encType="multipart/form-data">`/`multer` pattern anywhere in this
migration — every upload goes through the **same base64-JSON convention** seen in
`client/src/pages/circular/useCircularSetupApi.js`:

```js
async function fileToPayload(file) {
  if (!file) return null;
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return { filename: file.name, dataBase64: btoa(binary) };
}
```

The `<input type="file">` (e.g. Circular's **Attachment** field, DOM order: after
Description, before the Submit button — see [23-circular.md](23-circular.md) §3.3) is read
into a `File` object in local component state, converted to `{ filename, dataBase64 }` at
submit time, and sent as part of the JSON `save` POST body — for Circular specifically as
`{ fields, files: [payload] }` to `POST /api/circular/setup/${screen}/save`. This keeps every
module's save endpoint uniform JSON (no separate multipart route to secure/test) at the cost of
~33% payload inflation from base64 encoding, which is why the whole request is bounded by
Express's global body-size limit (see §3.3).

### 3.2 Server-side save + validation (per-module, same shape)

Each module's `setupAudit.js` (or equivalent) has a `save<Module>Attachment(file)` helper.
Circular's version (`server/src/services/circular/setupAudit.js`,
`saveCircularAttachment`) is representative:

```js
export async function saveCircularAttachment(file) {
  if (!file?.dataBase64 || !file?.filename) return '';
  const ext = path.extname(file.filename).toLowerCase();
  const allowed = ['.pdf', '.jpeg', '.jpg', '.gif', '.png'];
  if (!allowed.includes(ext)) {
    return { error: 'Please upload PNG, JPEG, GIF, or PDF formats.' };
  }
  const buf = Buffer.from(file.dataBase64, 'base64');
  if (buf.length > 2 * 1024 * 1024) {
    return { error: 'Image size must be less than 2 MB.' };
  }
  const random = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const newName = `${random}${path.basename(file.filename)}`;
  const dir = path.join(config.legacyFilesPath, 'circular');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, newName), buf);
  return newName;
}
```

Every such helper: (1) validates extension against a module-specific allow-list, (2) validates
decoded byte length against a module-specific cap (2 MB for circular attachments), (3) renames
the file to `${Date.now()}${random 0-9999}${path.basename(originalFilename)}` to avoid
collisions and directory traversal via the filename itself (`path.basename` strips any `../`
segments), (4) writes under `<LEGACY_FILES_PATH>/<folder>/`, creating the folder if needed, and
(5) returns just the **new filename string** — never a path — which is what gets stored in the
DB column (e.g. `circular_tb.c_attach`). This is why `FILE_STORAGE_MAP` documents "DB stores
filenames only; full path is resolved at runtime" as a rule.

### 3.3 Express body size limit

`server/src/app.js` lines 85–86:
```js
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
```
This is a **global** limit across every `/api/*` route, not file-upload-specific — it bounds
the entire JSON request body, including `dataBase64`. Since base64 inflates binary size by
~4/3, the practical raw-file ceiling under this limit is well under 5 MB (roughly 3.5 MB before
JSON framing overhead), which sits comfortably above each module's own tighter cap (e.g.
Circular's 2 MB) — the module-level cap is reached first in the common case, but a module
without its own byte-length check would still be bounded by this global 5 MB JSON limit.
A global error handler (`app.js` lines 122–128) catches `err.type === 'entity.too.large'` and
responds `413 { message: 'Request too large. Try a shorter date range or fewer subjects.' }` —
note this message is written for oversized *report* payloads (date-range/subject-count report
generation, the more common trigger of this limit in this codebase), not upload-specific, so a
user hitting it while uploading a file sees a slightly misleading hint.

### 3.4 Download / view: two URL builders

`client/src/utils/legacyFileUrls.js` exports two symmetric helpers, both first passing the
stored filename through `normalizeLegacyFilename()` (decodes up to two layers of `%XX`
URL-encoding that legacy DB values sometimes already contain, so re-encoding doesn't double-
encode) and then per-path-segment `encodeURIComponent`-ing it:

- **`legacyPublicFileUrl(folder, filename)`** → `/legacy/files/<folder>/<encoded-filename>` —
  no auth, served by the static mount. This is what Circular's print/preview screen uses:
  `client/src/pages/circular/setup/CircularPrintSetup.jsx` line 76,
  `circularFileUrl(filename) { return legacyPublicFileUrl('circular', filename); }`, rendered
  as `<a href={attachUrl} target="_blank" rel="noreferrer">View</a>`.
- **`legacySecureFileUrl(folder, filename)`** → `/api/files/<folder>/<encoded-filename>` — JWT
  required, served by `files.js`'s catch-all route. Available but not currently the primary
  pattern in the audited screens (Circular, Admin Office, Library use the public path).

### 3.5 `/legacy` static mount internals

`app.js` line 89: `app.use('/legacy', legacyStaticGuard, express.static(path.resolve(config.legacyImgPath, '..')))`.
`config.legacyImgPath` defaults to `/home/mapims/cis/cis/img` (`server/src/config/index.js`
line 16), so `path.resolve(..., '..')` serves the **entire legacy PHP application root**
(`/home/mapims/cis/cis`) as static files — this is intentional (reuses legacy CSS/img/JS/files
without duplicating them into the new repo) but means `legacyStaticGuard` is the *only* thing
standing between the public internet and the raw legacy PHP source tree, including files like
`config.php` that embed live DB credentials (per the guard's own header comment in
`server/src/middleware/legacyStaticGuard.js`).

`legacyStaticGuard` logic, in order:
1. `decodeURIComponent(req.path)` — wrapped in try/catch; malformed encoding → `400 { message:
   'Bad request' }`.
2. Split into path segments; if any segment is `.`, `..`, or starts with `.` (dotfiles) →
   `403 { message: 'Forbidden' }`. This blocks `../../etc/passwd`-style traversal and hidden
   files like `.env` even inside an allowed top-level directory.
3. Extension check: `BLOCKED_EXTENSIONS` = `.php, .php3, .php4, .php5, .phtml, .phar, .inc,
   .env, .sql, .log, .bak, .swp, .ini, .conf, .sh` (case-insensitive) → `403 Forbidden` if the
   last path segment ends in one of these, **even inside an allowed folder**. This is the
   defense-in-depth layer: even if a future allow-listed folder happened to contain a stray
   `.php` file, it can never be served as raw source through this mount.
4. Top-level directory allow-list: `ALLOWED_TOP_LEVEL_DIRS = new Set(['css', 'img', 'js',
   'assets', 'tv', 'naac', 'alumni'])`, plus a special case: `first === 'files' && second` (a
   second path segment must exist, e.g. `/legacy/files/circular/xyz.pdf` is allowed but bare
   `/legacy/files` or `/legacy/files/` alone is not). Anything else → `403 Forbidden`.

### 3.6 `FILE_STORAGE_MAP` reference

`server/src/config/fileStorageMap.js` documents every known `files/<folder>` with its purpose,
owning DB table/column, the modern upload route if one exists yet (several folders, e.g.
`task_document`, are explicitly annotated `modernUpload: 'Legacy PHP only (task_document_more.php)'`
meaning no Node upload path has been built for them), and both URL forms. `GET /api/files/map`
(JWT-protected) serves this same data as JSON plus a `rules` array:
`['Do not delete or rename legacy folders', 'DB stores filenames only; full path is resolved at
runtime', 'Browser links use /legacy/files/ (static); /api/files/ requires JWT']`.

## 4. Primary user stories

**US-1 — Attach a document while creating a Circular.**
As a circular drafter, I want to pick a PDF/image file on the Add Circular form's **Attachment**
`<input type="file">` and have it saved alongside the circular, so recipients can view the
original document.
*Acceptance:* only `.pdf/.jpeg/.jpg/.gif/.png` accepted, max 2 MB, stored filename is
`${timestamp}${random}${originalBasename}` under `<LEGACY_FILES_PATH>/circular/`.

**US-2 — View an attached document from a list screen.**
As any authenticated user browsing Print — Student/Staff/Department (Circular), I want to click
**View** next to an attachment and have it open in a new tab, so I can read the original file.
*Acceptance:* `legacyPublicFileUrl('circular', row.attach)` builds `/legacy/files/circular/
<encoded-filename>`; link opens with `target="_blank" rel="noreferrer"`.

**US-3 — Reuse legacy CSS/images without re-hosting them.**
As a developer building any print mode in `printReportHtml`, I want to `<link
href="/legacy/css/exam.css">` or similar and have it just work without copying the CSS file
into the new repo, so print parity with legacy PHP is exact.
*Acceptance:* `/legacy/css/*` is in `ALLOWED_TOP_LEVEL_DIRS`, served with no auth requirement
(stylesheets loaded by `<link>` tags can't carry `Authorization` headers).

**US-4 — Consult the file storage map before adding a new upload feature.**
As a backend developer adding an upload path for a new module, I want one file
(`fileStorageMap.js`) that tells me the folder name, DB table/column, and whether a modern
route already exists, so I don't duplicate or misplace a folder.
*Acceptance:* `GET /api/files/map` (JWT) returns the same data programmatically for tooling.

## 5. Rare / edge-case user stories

**US-5 — Requesting a file that was deleted or moved on disk.**
As a user clicking a **View** link for a circular attachment whose file was manually removed
from `<LEGACY_FILES_PATH>/circular/` (disk cleanup, migration, accidental delete) while the DB
row still references the old filename, I want a clear "not found" instead of a broken/blank
tab.
*Acceptance:* on the `/legacy/*` static path, `express.static` itself returns a plain **404**
(no custom message — Express's default static-file-not-found response) since
`legacyStaticGuard` only checks path shape, not file existence, and delegates to `express.static`
which 404s transparently. On the JWT-gated `/api/files/*` path, `server/src/routes/files.js`
explicitly checks `fs.existsSync(filePath)` and returns a friendlier
`404 { message: 'File not found' }` before calling `res.sendFile`. **This is an asymmetry worth
knowing:** the two download paths give different error bodies for the same missing-file
condition, because only the `/api/files` route added an explicit existence check.

**US-6 — Path-traversal attempt blocked by `legacyStaticGuard`.**
As a security reviewer, I want confidence that a request like
`GET /legacy/files/circular/..%2f..%2f..%2fconfig.php` (or its double-encoded variant) cannot
read `config.php`'s live DB credentials, so the public static mount can't be used to exfiltrate
secrets.
*Acceptance, traced through the guard:* `decodeURIComponent` resolves the `%2f`/`..` segments;
the split-and-check loop rejects any segment equal to `.` or `..` (or starting with `.`) with
`403 Forbidden` — this happens *before* the extension check, so the request never reaches
`express.static`. Even in the hypothetical case where segment-level `..` filtering were somehow
bypassed and the resolved path escaped `files/circular/`, the `.php` extension is separately
blocked by `BLOCKED_EXTENSIONS`, and `server/src/routes/files.js`'s own
`resolveSafeFile()` (used by the JWT-gated `/api/files` route, not the static mount) adds a
third independent layer: `path.resolve(base, relativePath)` must `.startsWith(base)` or the
request is rejected with `403 { message: 'Invalid file path' }` — so even a resolved-path
escape is caught a second time on that route specifically.
*Acceptance:* three independent layers (segment check, extension check, resolved-path prefix
check on the API route) must all be bypassed simultaneously for traversal to succeed — document
this as defense-in-depth, not a single point of failure.

**US-7 — Upload exceeding the 5 MB Express body limit.**
As a user attaching an unusually large file (e.g. a scanned multi-page PDF) that, once base64-
encoded, pushes the JSON POST body over 5 MB, I want a clear error rather than a silent hang or
generic 500.
*Acceptance:* Express's `json()` middleware rejects the request before it reaches the route
handler, throwing an error with `err.type === 'entity.too.large'`; the global error handler in
`app.js` (lines 122–128) catches it and responds `413 { message: 'Request too large. Try a
shorter date range or fewer subjects.' }`. Note this message doesn't mention file size at all
(it was written with report-generation payloads in mind) — a user hitting this while uploading
a Circular attachment sees a message that doesn't match their actual mistake, since in practice
the module-level 2 MB cap (US-1) is reached well before the global 5 MB one for Circular
specifically, but a module without its own explicit byte check (several folders in
`FILE_STORAGE_MAP` have no `modernUpload` entry at all) would surface this generic 413 as the
*only* size feedback the user gets.

**US-8 — Malformed/undecodable URL in a file request.**
As a client (or a scanner probing the endpoint) sending a request path with invalid percent-
encoding, I want the server to fail closed rather than crash.
*Acceptance:* `legacyStaticGuard`'s `decodeURIComponent(req.path)` is wrapped in try/catch;
failure returns `400 { message: 'Bad request' }` before any directory logic runs.

## 6. Future / predicted user stories

### Future (not implemented)

**US-9 (speculative).** As a mobile app user, I want to download a file attachment (ID card,
circular attachment) via `expo-file-system` and share/save it natively, attaching the JWT
manually since the mobile HTTP client doesn't share the web Axios instance's interceptor.
Grounded directly in `mobile.md` §8: *"**File download auth** — `/api/files` likely expects a
Bearer header; mobile downloads (via `expo-file-system`) must attach the JWT manually since
they don't share the Axios instance the way in-app fetches do."* This would push more traffic
onto the `/api/files/*` JWT-gated path rather than the public `/legacy/files/*` path the web
client currently prefers, since a mobile app has no browser-style `<a href>` "just works"
option for authenticated static assets.

**US-10 (speculative).** As a developer, I want photo/document uploads on mobile screens (ID
card photo, attachment upload) to use `expo-image-picker`/`expo-document-picker` and post
`multipart/form-data` to the same `/api/files` or module-specific upload routes — per
`mobile.md` §7.5: *"Where the web uses `<input type=file>`, mobile uses `expo-image-picker` /
`expo-document-picker` and posts `multipart/form-data`... verify each target route accepts
`multipart/form-data` from a non-browser client... test before relying on it."* Since every
current upload path (§3.1) expects base64-JSON, not multipart, this is flagged as an open
compatibility question, not a solved path.

**US-11 (speculative).** As the college migrates off a single VM, I want file storage to move
from the local `LEGACY_FILES_PATH` filesystem to object storage (S3-compatible), with
`FILE_STORAGE_MAP`'s folder-to-purpose mapping becoming a bucket-prefix mapping instead —
reasonable extrapolation from the fact that `fileStorageMap.js` already centralizes "folder →
purpose → DB column" in one place, making a storage-backend swap a smaller blast radius than if
every module hard-coded its own path logic. Not mentioned in `mobile.md`, purely inferred from
the existing architecture's single point of indirection.

**US-12 (speculative).** As a security-conscious operator, I want the `/legacy` static mount's
`ALLOWED_TOP_LEVEL_DIRS` allow-list enforced via a build-time manifest check (CI fails if a new
top-level legacy folder is referenced by app code but not yet allow-listed, or vice versa) so
the guard and `FILE_STORAGE_MAP` can't silently drift apart as new folders are added.

## 7. Traceability table

| Story | Client file | Server file / endpoint | Table / disk path |
|---|---|---|---|
| US-1 Circular attachment upload | `client/src/pages/circular/useCircularSetupApi.js` (`fileToPayload`) | `server/src/services/circular/setupAudit.js` (`saveCircularAttachment`) | `circular_tb.c_attach`, `<LEGACY_FILES_PATH>/circular/` |
| US-2 View attachment | `client/src/pages/circular/setup/CircularPrintSetup.jsx`, `client/src/utils/legacyFileUrls.js` (`legacyPublicFileUrl`) | `GET /legacy/files/circular/*` → `server/src/app.js` static mount + `legacyStaticGuard` | `<LEGACY_FILES_PATH>/circular/` |
| US-3 Legacy CSS reuse | `client/src/utils/printReport.js` (all `<link href="/legacy/css/...">` modes) | `GET /legacy/css/*` → static mount | `LEGACY_CIS_PATH` (legacy app root) `css/` |
| US-4 File storage map reference | n/a (dev tooling) | `GET /api/files/map` → `server/src/routes/files.js`; data from `server/src/config/fileStorageMap.js` | n/a |
| US-5 Missing file on disk | `CircularPrintSetup.jsx` `<a href>` link | `express.static` (404 default) vs `server/src/routes/files.js` (`fs.existsSync` → `404 { message: 'File not found' }`) | `<LEGACY_FILES_PATH>/<folder>/` |
| US-6 Path traversal blocked | n/a | `server/src/middleware/legacyStaticGuard.js`; `server/src/routes/files.js` (`resolveSafeFile`) | n/a |
| US-7 5 MB body limit | any upload-capable screen | `server/src/app.js` lines 85–86, 122–128 (`express.json` limit, `entity.too.large` handler) | n/a |
| US-8 Malformed URL | n/a | `legacyStaticGuard.js` (`decodeURIComponent` try/catch) | n/a |
| US-9 Mobile auth'd download (future) | future `mobile/src/utils/files.js` | existing `server/src/routes/files.js` | n/a |
| US-10 Mobile multipart upload (future) | future mobile picker screens | existing base64-JSON save handlers (compatibility TBD) | n/a |
| US-11 Object storage migration (future) | n/a | future rewrite of `fileStorageMap.js` + all `save*Attachment` helpers | n/a |
| US-12 CI allow-list drift check (future) | n/a | future CI step validating `legacyStaticGuard.js` vs `fileStorageMap.js` | n/a |

# Phase 10 — File Storage

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Architecture

| Access | URL pattern | Auth | Use case |
|--------|-------------|------|----------|
| Static | `/legacy/files/{folder}/{file}` | No (same-origin static) | Attachment links in React UI |
| API | `/api/files/{folder}/{file}` | JWT required | Programmatic download |
| Catalog | `GET /api/files/map` | JWT required | Folder mapping reference |

**Base path:** `LEGACY_FILES_PATH` (default `/home/mapims/cis/cis/files`)

**Images outside `files/`:** `/legacy/img/` — member photos, logos (`img/member/`, etc.)

## Migrated upload paths

| Folder | Modern API | Legacy PHP |
|--------|------------|------------|
| `student_attachment/` | `POST /api/students/:id/attachments/upload` | `student_attachments.php` |
| `staff_documents/` | `POST /api/staff/:id/attachments/upload` | `staff_attachments.php` |

## Preserved folders (legacy-only uploads)

`task_document`, `circular`, `certificate`, `omr`, `pcard`, `excel`, `publication_docs`, `payroll_reports`, `student_idcard`, `staff_idcard`, `documents`, and others — see `server/src/config/fileStorageMap.js` or `GET /api/files/map`.

## Code references

- `server/src/utils/fileUrls.js` — `legacyPublicFileUrl()`, `legacySecureFileUrl()`
- `server/src/routes/files.js` — secure download + map endpoint
- Student/staff attachment services use `legacyPublicFileUrl()`

## Rules (unchanged from legacy)

- Do not delete old files
- Do not rename folders
- Do not change stored file references in DB (filename-only columns)

## Remaining

- [ ] Bridge unmigrated modules that upload to `task_document`, `circular`, etc.
- [ ] Rewrite legacy bridged HTML `files/...` links to `/legacy/files/...` where needed

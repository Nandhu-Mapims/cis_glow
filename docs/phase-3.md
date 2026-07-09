# Phase 3 — Student Module (in progress)

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Completed (Phase 3 foundation)

### Backend

- `GET /api/students/courses` — course/batch filter options (legacy `student_profile_edit.php`)
- `GET /api/students/search?by=roll|batch&q=...` — student search
- `GET /api/students/:id` — structured student profile + academics
- `PUT /api/students/:id` — update key contact fields (roll-no uniqueness check)
- `GET /api/students/:id/legacy-form` — full legacy edit HTML via PHP bridge (~40KB parity)
- `GET /api/students/admission/degrees` — degree dropdown for admission
- `POST /api/students` — new student admission + `student_academic_tb` row
- `GET /api/students/:id/attachments` — attachment catalog + existing files
- `POST /api/students/:id/attachments/upload` — upload to `files/student_attachment/`
- `PUT /api/students/:id/attachments` — save attachment metadata
- `PATCH /api/students/:id/status` — releaving / discontinue fields
- `GET /api/students/reports/fields` — export field catalog
- `GET /api/students/reports/filters` — course/batch/year filter options
- `POST /api/students/reports/generate` — print HTML or XLS via PHP bridge
- `server/src/utils/sqlSafe.js` — SQL escape, zero-date handling, ID validation
- PHP bridges set `$_SERVER['REQUEST_METHOD']='GET'` for legacy includes

### Frontend

- `/students` — search by roll no or batch (maps from **Edit Profile** menu)
- `/students/new` — admission form (maps from **New Profile** menu)
- `/students/:id` — tabbed profile: Overview, Edit, Attachments, Status, Legacy Form
- `/students/reports` — student export report builder (maps from **Export** menu)
- Menu links `student_profile_edit.php` → `/students`, `student_profile_add.php` → `/students/new`, `student_profile_export.php` → `/students/reports`

### Legacy reference

- `student_profile_edit.php`, `student_profile_edit_more.php`, `student_profile_add.php`

## Pending (remaining Phase 3)

- Full admission form parity (certificates, transport, hostel, NEET marks)
- Full legacy edit write-back from Legacy Form tab
- ~~Student reports (`student_profile_export.php`)~~ — done via PHP bridge

## API summary

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/students/courses` | Batch search dropdown data |
| GET | `/api/students/search` | Search students |
| GET | `/api/students/:id` | Profile JSON |
| PUT | `/api/students/:id` | Update profile fields |
| GET | `/api/students/:id/legacy-form` | Legacy HTML form |
| GET | `/api/students/admission/degrees` | Degree options for admission |
| POST | `/api/students` | Create admission |
| GET | `/api/students/:id/attachments` | Attachment list |
| POST | `/api/students/:id/attachments/upload` | Upload file |
| PUT | `/api/students/:id/attachments` | Save attachments |
| PATCH | `/api/students/:id/status` | Releaving / discontinue |
| GET | `/api/students/reports/fields` | Export field catalog |
| GET | `/api/students/reports/filters` | Export filter options |
| POST | `/api/students/reports/generate` | Generate print HTML or XLS |

## Notes

- Raw SQL + `CAST(... AS CHAR)` used for legacy zero-date columns
- Course list uses raw SQL to avoid Prisma P2020 on `basic_setup_course_tb`

# Phase 4 — Staff Module (in progress)

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Completed (Phase 4 foundation)

### Backend

- `GET /api/staff/categories` — job category dropdown for search
- `GET /api/staff/search?by=name|staff_id|category&q=` — staff search
- `GET /api/staff/:id` — structured staff profile + designation history
- `PUT /api/staff/:id` — update key contact/identity fields
- `GET /api/staff/:id/legacy-form` — full legacy edit HTML via PHP bridge
- `GET /api/staff/:id/attachments` — attachment catalog by dept/designation
- `POST /api/staff/:id/attachments/upload` — upload to `files/staff_documents/`
- `PUT /api/staff/:id/attachments` — save attachment metadata
- `PATCH /api/staff/:id/status` — releaving date/info

### Frontend

- `/staff` — search by name, staff ID, or category
- `/staff/:id` — tabbed profile: Overview, Edit, Attachments, Status, Legacy Form
- Menu links `staff_profile_edit.php`, `staff_attachments.php` → `/staff`

### Legacy reference

- `staff_profile_edit.php`, `staff_profile_edit_more.php`, `staff_attachments.php`, `staff_attachments_more.php`

## Also completed

- `GET /api/staff/admission/options` — categories, departments, levels, attendance
- `GET /api/staff/admission/designations?departmentId=` — designation dropdown
- `GET /api/staff/admission/check-id?staffId=` — ID availability
- `POST /api/staff` — core staff registration + `staff_designation_tb` row
- `GET /api/staff/reports/fields` — export field catalog
- `GET /api/staff/reports/filters` — category filter options
- `POST /api/staff/reports/generate` — print HTML or XLS via PHP bridge
- `/staff/new` — staff registration form
- `/staff/reports` — staff export report builder
- Menu: `staff_profile_add.php` → `/staff/new`, `staff_profile_export.php` → `/staff/reports`

## Pending (remaining Phase 4)

- Full admission form parity (education, experience, salary blocks)
- Full legacy edit write-back from Legacy Form tab
- Staff attendance integration
- Full department/designation CRUD parity

## API summary

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/staff/categories` | Job categories for search |
| GET | `/api/staff/search` | Search staff |
| GET | `/api/staff/:id` | Profile JSON |
| PUT | `/api/staff/:id` | Update profile fields |
| GET | `/api/staff/:id/legacy-form` | Legacy HTML form |
| GET | `/api/staff/:id/attachments` | Attachment list |
| POST | `/api/staff/:id/attachments/upload` | Upload file |
| PUT | `/api/staff/:id/attachments` | Save attachments |
| PATCH | `/api/staff/:id/status` | Releaving / discontinue |
| GET | `/api/staff/admission/options` | Registration dropdowns |
| GET | `/api/staff/admission/designations` | Designations by department |
| GET | `/api/staff/admission/check-id` | Staff ID availability |
| POST | `/api/staff` | Create staff registration |
| GET | `/api/staff/reports/fields` | Export field catalog |
| GET | `/api/staff/reports/filters` | Export filter options |
| POST | `/api/staff/reports/generate` | Generate print HTML or XLS |

## Notes

- Raw SQL + `CAST(... AS CHAR)` used for legacy zero-date columns on `staff_profile_tb`
- Attachments resolve active dept/designation from `staff_designation_tb`
- Staff photos served from `/legacy/files/staff_images/`

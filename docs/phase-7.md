# Phase 7 — Academic Module (in progress)

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Completed

### Backend

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/academic/courses` | Paginated course list (`basic_setup_course_tb`) |
| POST | `/api/academic/setup/:screen/load` | Load legacy academic form via PHP bridge (`fields` + optional `query`) |
| POST | `/api/academic/setup/:screen/save` | Save legacy academic form via PHP bridge |

**Setup screens:** `subject-master`, `course-add`, `course-edit`, `academic-years`, `subject-setup`, `subject-batch`, `academic-calendar`, `subject-schedule`, `subject-unit`, `admission-exam`, `master-setup`

**Report screens (filter + display via load bridge):** `subject-report`, `timetable-report`, `batch-timetable-report`

**Legacy bridges:** `academic_config_load.php`, `academic_config_save.php`, `academic_config_helper.php`

### Frontend

- `/academic` — hub
- `/academic/setup` — setup hub
- `/academic/setup/:screen` — bridged legacy forms
- `/academic/reports` — reports hub
- `/academic/reports/:screen` — bridged report screens with print support
- `/academic/courses` — course directory
- `/academic/courses/:courseId/edit` — direct course edit

### Menu mapping

Maps all academic legacy PHP files listed above plus report PHP files in `legacyRoutes.js`.

## Known limitations

- Institution logo upload on `academic.php` uses multipart bridge (`legacy_multipart_helper.php`).
- `tt_config.php` (weekly grid timetable with AJAX via `tt_config_more.php`) not yet migrated — use `subject_schedule.php` for now.
- No standalone `basic_setup_section` PHP screen found; sections appear course-managed elsewhere.

## Remaining (Phase 7)

- [x] `tt_config.php` weekly timetable grid (`/api/academic/tt-config/more` proxies `tt_config_more.php`)
- [x] Institution logo upload bridge
- [ ] Additional academic reports if required by menu audit

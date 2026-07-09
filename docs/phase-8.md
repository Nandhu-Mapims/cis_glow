# Phase 8 — Examination Module (in progress)

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Completed (first slice)

### Backend

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/exam/dashboard` | Exam status summary (`exam_dashboard.php`) |
| POST | `/api/exam/student-statement` | Student CIA marks statement (`student/exam_statement.php`) |
| POST | `/api/exam/setup/:screen/load` | Load legacy exam form via PHP bridge |
| POST | `/api/exam/setup/:screen/save` | Save legacy exam form via PHP bridge |

**Setup screens:** `exam-names`, `exam-setup`, `mark-entry`, `exam-batch`

**Report screens:** `term-report`, `term-statement`, `progress-card`

**Legacy bridges:** `exam_config_load.php`, `exam_config_save.php`, `exam_config_helper.php`, `exam_dashboard.php`

### Frontend

- `/exam` — hub
- `/exam/dashboard` — exam dashboard with print
- `/exam/setup` — setup hub
- `/exam/setup/:screen` — bridged setup forms
- `/exam/reports` — reports hub
- `/exam/reports/:screen` — bridged report screens
- `/exam/student-statement` — per-student exam marks (staff enters register number)

### Menu mapping

`exam_name_config.php`, `term_exam_setup.php`, `term_mark_entry.php`, `exam_batch.php`, `exam_dashboard.php`, `term_report.php`, `term_report_statement.php`, `term_progress_card.php`

**Additional setup:** `mark-sheet` (`term_mark_sheet.php`), `exam-schedule` (`term_exam_schedule.php`)

**Marksheet print:** `GET /api/exam/marksheet/print` → `term_mark_sheet_print.php`

**Reports:** `schedule-print`, `invigilator-print`

**Multipart upload:** `marks-upload` (OMR scan upload via `legacy_multipart_helper.php`)

## Remaining (Phase 8)

- [ ] Result processing / grade rules (if separate from mark entry)
- [x] Student exam statement (`student/exam_statement.php` via `/exam/student-statement` staff proxy)

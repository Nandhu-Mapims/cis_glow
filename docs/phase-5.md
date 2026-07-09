# Phase 5 — Attendance Module (in progress)

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Completed

### Backend

- Staff calendar, category report, live punch
- Student daily sheet (view + save)
- Student subject report + quarterly variant (`variant: quarterly` on setup/generate)
- Report filters and batched chunk generation

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/attendance/staff/categories` | Staff categories for reports |
| POST | `/api/attendance/staff/calendar` | Staff calendar HTML |
| POST | `/api/attendance/staff/report` | Staff attendance report HTML |
| POST | `/api/attendance/staff/punch` | Staff live in/out punch |
| GET | `/api/attendance/students/filters` | Student course filter options |
| POST | `/api/attendance/students/daily` | Student daily sheet HTML + entries |
| PUT | `/api/attendance/students/daily` | Save student daily attendance |
| GET | `/api/attendance/students/report/years` | Academic years |
| POST | `/api/attendance/students/report/filters` | Report course/subject filters |
| POST | `/api/attendance/students/report/setup` | Report setup (`variant`: `standard` or `quarterly`) |
| POST | `/api/attendance/students/report/generate` | Batched row generation |

### Frontend

- `/attendance` — hub
- `/attendance/staff` — staff calendar
- `/attendance/staff/report` — staff category report (with print)
- `/attendance/staff/punch` — staff live punch
- `/attendance/students/daily` — daily sheet view + save
- `/attendance/students/report` — subject-wise report (with print)
- `/attendance/students/report/quarterly` — quarterly report (with print)

### Legacy bridges

- `staff_attendance_calendar.php`, `staff_attendance_report.php`, `staff_live_punch.php`
- `student_daily_attendance.php`, `student_daily_attendance_save.php`
- `attendance_report_filters.php`, `attendance_report_setup.php`, `attendance_report_chunk.php`
- `attendance_report_quarterly_setup.php`, `attendance_report_quarterly_chunk.php`

## Pending

- Webcam/photo capture on staff punch (legacy optional path)
- Month-wise reports beyond quarterly variant
- Staff attendance link from staff profile
- Performance tuning for large reports

## Notes

- Quarterly report uses `attendance_report_quartely.php` / `_more.php` (legacy spelling)
- Print uses `ReportPrintBar` + `printReportHtml()` utility

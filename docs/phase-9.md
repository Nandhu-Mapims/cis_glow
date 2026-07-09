# Phase 9 — Reports

Full scope checklist: `/home/mapims/cis/cis/new_cis/new_cis.md`

## Completed

- `/reports` — cross-module reports hub linking all migrated report screens
- Report screens bridged per module (fees, attendance, students, staff, academic, exam, admin audit)
- Print on bridged report screens (`ReportPrintBar` / print buttons)
- **Excel export:** student (`/students/reports` → `student_report_export.php`) and staff (`/staff/reports` → staff export bridge) support `format=xls`

## Menu audit (approx.)

~70 menu PHP links mapped in `legacyRoutes.js`; ~350+ legacy admin menu entries remain unmigrated. Largest unmigrated groups: payroll (`payroll_*`, `salary_*`), staff attendance variants, PG/intern attendance, task management, TV/slider widgets, tax reports.

## Remaining

- [ ] Prioritize and migrate high-traffic unmigrated modules (payroll, task reports, etc.)
- [ ] Excel export on remaining legacy reports (fees, attendance, exam) where legacy has Export XLS
- [ ] PDF export parity where legacy generates PDF (progress card, marksheet print bridges exist as HTML print)

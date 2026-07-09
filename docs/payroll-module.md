# Phase 13 — Payroll (started)

## Backend

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/payroll/dashboard` | Initial payroll dashboard form |
| POST | `/api/payroll/dashboard` | Month/category filter → salary summary |
| GET/POST | `/api/payroll/individual-report` | Individual payslip / bank / PF / ESI report |
| GET | `/api/payroll/individual-report/export` | Excel export (`payroll_individual_report_excel_report.php`) |
| GET/POST | `/api/payroll/consolidated-report` | Multi-month consolidated summary |
| GET/POST | `/api/payroll/salary-summary` | Category comparison summary |
| GET/POST | `/api/payroll/salary-statement` | Department salary statement |
| POST | `/api/payroll/setup/:screen/load` | Setup form load (filter / initial) |
| POST | `/api/payroll/setup/:screen/save` | Setup save (multipart for cover images) |
| GET/POST | `/api/payroll/group-report` | Multi-month group payroll report |
| GET/POST | `/api/payroll/stipend/report` | Stipend payroll summary report |
| GET/POST | `/api/payroll/stipend/statement` | Stipend salary statement |
| GET/POST | `/api/payroll/stipend/individual-report` | Stipend individual payslip report |
| GET/POST | `/api/payroll/stipend/generate-payroll` | Stipend batch generate form |
| GET | `/api/payroll/stipend/generate-payroll/more` | Per-student generate step (legacy AJAX) |
| POST | `/api/payroll/setup/stipend-amount-setup/load\|save` | Stipend amount configuration |
| POST | `/api/payroll/setup/stipend-deduction-add/load\|save` | Stipend deduction entry |
| POST | `/api/payroll/setup/stipend-payroll-close/load\|save` | Close / complete stipend month |
| GET/POST | `/api/payroll/stipend/att-report` | Stipend attendance report form |
| GET | `/api/payroll/stipend/att-report/more` | Per-student attendance row AJAX |

**Bridges:** report bridges above + `payroll_config_load.php` / `payroll_config_save.php` (`payroll_config_helper.php`)

**Auth:** `menuAuthForModule('payroll')` — patterns `payroll_%`, `salary_%`, `stipend_%`

## Frontend

- `/payroll` — hub
- `/payroll/dashboard` — month + staff category multi-select, summary tables, print
- `/payroll/individual-report` — report type radios, Generate, print, Excel (bank/PF/ESI)
- `/payroll/consolidated-report` — multi-month select, Generate, print
- `/payroll/salary-summary` — dual category groups, Generate, print
- `/payroll/salary-statement` — category + row-per-page, Generate, print
- `/payroll/setup` — setup hub
- `/payroll/setup/individual-setup` — cover page banner upload
- `/payroll/setup/cron-setup` — cron type, status, day, email list
- `/payroll/group-report` — multi-month group report
- `/payroll/stipend` — stipend hub
- `/payroll/stipend/report` — `stipend_payroll_report.php`
- `/payroll/stipend/statement` — `stipend_salary_statement.php`
- `/payroll/stipend/individual-report` — `stipend_payroll_individual_report1.php`

- `/payroll/stipend/generate-payroll` — batch generate with AJAX progress (`stipend_generate_payroll_more.php` proxy)
- `/payroll/stipend/setup/amount-setup` — stipend amount per course type
- `/payroll/stipend/setup/deduction-add` — monthly deduction entry

- `/payroll/stipend/setup/payroll-close` — mark month complete
- `/payroll/stipend/att-report` — attendance statement/report with AJAX build

## Remaining
- [ ] Minor stipend variants / dated PHP copies in menu audit
- [ ] Additional legacy payroll/stipend menu items from audit
